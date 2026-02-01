import express, { Request, Response, NextFunction } from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page, Frame, FileChooser } from 'puppeteer';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import fs from 'fs';
import https from 'https';
import http from 'http';
import { URL } from 'url';
import { execSync } from 'child_process';
import crypto from 'crypto';
import multer from 'multer';
import chokidar from 'chokidar';

// Add stealth plugin and use it
puppeteer.use(StealthPlugin());

const app = express();
const PORT = Number(process.env.PORT) || 112;
const BASE_DOWNLOADS_DIR = path.join(process.env.HOME || '/home/pptruser', 'Downloads');
const BASE_UPLOADS_DIR = path.join(process.env.HOME || '/home/pptruser', 'Uploads');
const CERT_DIR = path.join(__dirname, '../certs');
const API_KEY = process.env.API_KEY || 'bastion-browser-secret-key';
const VAULT_PATH = path.join(__dirname, '../vault.bin');
const MAX_TOTAL_SESSIONS = 5;

// Secure Vault Helpers
function encrypt(text: string, masterKey: string): string {
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(masterKey, 'bastion-salt', 32);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decrypt(encryptedData: string, masterKey: string): string | null {
    try {
        const [ivHex, authTagHex, encryptedText] = encryptedData.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const key = crypto.scryptSync(masterKey, 'bastion-salt', 32);
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (e) {
        return null;
    }
}

function saveToVault(data: object, masterKey: string) {
    const encrypted = encrypt(JSON.stringify(data), masterKey);
    fs.writeFileSync(VAULT_PATH, encrypted);
}

function loadFromVault(masterKey: string): any {
    if (!fs.existsSync(VAULT_PATH)) return {};
    const encrypted = fs.readFileSync(VAULT_PATH, 'utf8');
    const decrypted = decrypt(encrypted, masterKey);
    return decrypted ? JSON.parse(decrypted) : {};
}

// VirusTotal API Helpers using session-specific key
async function getVTUrlReport(targetUrl: string, vtKey: string): Promise<{ safe: boolean; reportUrl: string }> {
    if (!vtKey || vtKey === 'your_virustotal_api_key_here') return { safe: true, reportUrl: '' };
    
    try {
        const urlId = Buffer.from(targetUrl).toString('base64').replace(/=/g, '');
        const response = await fetch(`https://www.virustotal.com/api/v3/urls/${urlId}`, {
            headers: { 'x-apikey': vtKey }
        });

        if (response.status === 404) {
            // URL not scanned before, submit it
            const submitResponse = await fetch('https://www.virustotal.com/api/v3/urls', {
                method: 'POST',
                headers: { 'x-apikey': vtKey, 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `url=${encodeURIComponent(targetUrl)}`
            });
            const submitData: any = await submitResponse.json();
            return { safe: true, reportUrl: `https://www.virustotal.com/gui/url/${submitData.data?.id.split('-')[1]}` };
        }

        const data: any = await response.json();
        const stats = data.data?.attributes?.last_analysis_stats;
        const isSafe = stats ? (stats.malicious === 0 && stats.suspicious === 0) : true;
        const reportUrl = `https://www.virustotal.com/gui/url/${data.data?.id}`;
        
        return { safe: isSafe, reportUrl };
    } catch (e) {
        console.error('VT URL Analysis Error:', e);
        return { safe: true, reportUrl: '' };
    }
}

async function uploadFileToVT(filePath: string, vtKey: string): Promise<string> {
    if (!vtKey || vtKey === 'your_virustotal_api_key_here') return '';
    
    try {
        const formData = new FormData();
        const fileContent = fs.readFileSync(filePath);
        const blob = new Blob([fileContent]);
        formData.append('file', blob, path.basename(filePath));

        const response = await fetch('https://www.virustotal.com/api/v3/files', {
            method: 'POST',
            headers: { 'x-apikey': vtKey },
            body: formData
        });

        const data: any = await response.json();
        const fileHash = crypto.createHash('sha256').update(fileContent).digest('hex');
        return `https://www.virustotal.com/gui/file/${fileHash}`;
    } catch (e) {
        console.error('VT File Analysis Error:', e);
        return '';
    }
}
let currentSessions = 0;

if (!fs.existsSync(BASE_DOWNLOADS_DIR)) {
    fs.mkdirSync(BASE_DOWNLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(BASE_UPLOADS_DIR)) {
    fs.mkdirSync(BASE_UPLOADS_DIR, { recursive: true });
}

// Configure Multer for secure uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const sessionId = req.query.sessionId as string;
        if (!sessionId) return cb(new Error('Session ID required'), '');
        const uploadDir = path.join(BASE_UPLOADS_DIR, sessionId.replace(/[^a-zA-Z0-9-]/g, ''));
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, `${Date.now()}-${safeName}`);
    }
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB limit

// Generate self-signed certificate if it doesn't exist
if (!fs.existsSync(CERT_DIR)) {
    fs.mkdirSync(CERT_DIR, { recursive: true });
}

const keyPath = path.join(CERT_DIR, 'key.pem');
const certPath = path.join(CERT_DIR, 'cert.pem');

if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    console.log('Generating self-signed certificate...');
    try {
        execSync(`openssl req -x509 -newkey rsa:4096 -keyout ${keyPath} -out ${certPath} -days 365 -nodes -subj "/CN=localhost"`);
    } catch (e) {
        console.error('Failed to generate certificates. Make sure openssl is installed.', e);
    }
}

// SSRF Protection: Validate URL and prevent access to internal IPs
function isSafeUrl(urlStr: string): boolean {
    try {
        const uri = new URL(urlStr);
        if (!['http:', 'https:'].includes(uri.protocol)) return false;
        
        const hostname = uri.hostname;
        // Basic check for private IP ranges and localhost
        const isLocal = /^(localhost|127\.|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|169\.254\.)/.test(hostname);
        return !isLocal;
    } catch (e) {
        return false;
    }
}

async function downloadFileFromUrl(url: string, destDir: string): Promise<string> {
    if (!isSafeUrl(url)) {
        throw new Error('URL not allowed (SSRF Protection)');
    }

    const uri = new URL(url);
    const pkg = uri.protocol === 'https:' ? https : http;
    const fileName = path.basename(uri.pathname).replace(/[^a-zA-Z0-9.-]/g, '_') || `download-${Date.now()}`;
    const dest = path.join(destDir, fileName);
    
    // Enable SSL verification for security
    const options = {
        rejectUnauthorized: true
    };

    return new Promise((resolve, reject) => {
        const request = pkg.get(url, options, (response) => {
            if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
                const file = fs.createWriteStream(dest);
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve(fileName);
                });
            } else if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                // Handle redirect
                downloadFileFromUrl(response.headers.location, destDir).then(resolve).catch(reject);
            } else {
                reject(new Error(`Failed to download: ${response.statusCode}`));
            }
        });
        
        request.on('error', (err) => {
            reject(err);
        });
        
        // Timeout to prevent hanging connections
        request.setTimeout(10000, () => {
            request.destroy();
            reject(new Error('Download timeout'));
        });
    });
}

// Authentication Middleware
const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'] || req.query.api_key;
    const providedKey = typeof authHeader === 'string' && authHeader.startsWith('Bearer ') 
        ? authHeader.substring(7) 
        : authHeader;

    if (providedKey !== API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "img-src": ["'self'", "data:", "blob:", "*"],
            "connect-src": ["'self'", "ws:", "wss:", "blob:", "data:", "*"],
            "upgrade-insecure-requests": null,
        },
    },
    hsts: false,
    crossOriginOpenerPolicy: { policy: "unsafe-none" },
    originAgentCluster: false,
}));
app.use(cors());
app.use(express.json());

// Serve static frontend files (unprotected as they are public assets)
app.use(express.static(path.join(__dirname, '../../client/dist')));

// --- Protected API Endpoints ---

const getSessionDir = (sessionId: string) => {
    // Sanitize sessionId to prevent path traversal
    const safeId = sessionId.replace(/[^a-zA-Z0-9-]/g, '');
    const dir = path.join(BASE_DOWNLOADS_DIR, safeId);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
};

app.get('/api/downloads', authMiddleware, (req, res) => {
    const sessionId = req.query.sessionId as string;
    // Fallback: if no sessionId provided, we can't isolate (but for simplicity let's handle it)
    if (!sessionId) return res.status(400).json({ error: 'Session ID required' });
    
    const sessionDir = getSessionDir(sessionId);
    fs.readdir(sessionDir, (err, files) => {
        if (err) return res.status(500).json({ error: 'Failed to list downloads' });
        const fileInfos = files.map(file => {
            const stats = fs.statSync(path.join(sessionDir, file));
            return { name: file, size: stats.size, mtime: stats.mtime };
        });
        res.json(fileInfos);
    });
});

app.get('/api/downloads/:name', authMiddleware, (req, res) => {
    const sessionId = req.query.sessionId as string;
    if (!sessionId) return res.status(400).json({ error: 'Session ID required' });
    
    const fileName = path.basename(req.params.name); // Path traversal protection
    const filePath = path.join(getSessionDir(sessionId), fileName);
    
    if (fs.existsSync(filePath)) {
        res.download(filePath);
    } else {
        res.status(404).send('File not found');
    }
});

app.delete('/api/downloads/:name', authMiddleware, (req, res) => {
    const sessionId = req.query.sessionId as string;
    if (!sessionId) return res.status(400).json({ error: 'Session ID required' });
    
    const fileName = path.basename(req.params.name); // Path traversal protection
    const filePath = path.join(getSessionDir(sessionId), fileName);
    
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        res.sendStatus(200);
    } else {
        res.status(404).send('File not found');
    }
});

app.delete('/api/downloads', authMiddleware, (req, res) => {
    const sessionId = req.query.sessionId as string;
    if (!sessionId) return res.status(400).json({ error: 'Session ID required' });
    
    const sessionDir = getSessionDir(sessionId);
    fs.readdir(sessionDir, (err, files) => {
        if (err) return res.status(500).send('Failed to clear downloads');
        for (const file of files) {
            fs.unlinkSync(path.join(sessionDir, file));
        }
        res.sendStatus(200);
    });
});

// File Upload Endpoint
app.post('/api/upload', authMiddleware, upload.array('files'), (req, res) => {
    if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
        return res.status(400).send('No files uploaded');
    }
    const files = req.files as Express.Multer.File[];
    res.json({ filenames: files.map(f => f.filename) });
});

app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
});

// --- Browser Management ---
let browser: Browser | null = null;
let initializing: Promise<void> | null = null;

async function initBrowser() {
    if (browser) return;
    if (initializing) return initializing;

    initializing = (async () => {
        browser = await (puppeteer as any).launch({
            headless: "new",
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--remote-debugging-port=9222',
                '--window-size=1280,720',
                '--hide-scrollbars',
                '--disable-blink-features=AutomationControlled',
                '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            ],
            ignoreDefaultArgs: ['--enable-automation']
        });
        console.log('Browser launched successfully');
    })();

    return initializing;
}

// --- WebSocket Server ---
const serverOptions = {
    key: fs.existsSync(keyPath) ? fs.readFileSync(keyPath) : undefined,
    cert: fs.existsSync(certPath) ? fs.readFileSync(certPath) : undefined,
};

const server = https.createServer(serverOptions, app).listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on https://0.0.0.0:${PORT}`);
    initBrowser();
});

const wss = new WebSocketServer({ 
    server,
    verifyClient: (info, callback) => {
        const url = new URL(info.req.url || '', `https://${info.req.headers.host}`);
        const token = url.searchParams.get('api_key');
        
        if (currentSessions >= MAX_TOTAL_SESSIONS) {
            callback(false, 503, 'Max sessions reached');
            return;
        }

        if (token === API_KEY) {
            callback(true);
        } else {
            callback(false, 401, 'Unauthorized');
        }
    }
});

wss.on('connection', async (ws: WebSocket, req) => {
    const url = new URL(req.url || '', `https://${req.headers.host}`);
    const sessionId = url.searchParams.get('sessionId') || crypto.randomUUID();
    const sessionDir = getSessionDir(sessionId);
    const sessionUploadDir = path.join(BASE_UPLOADS_DIR, sessionId.replace(/[^a-zA-Z0-9-]/g, ''));
    
    currentSessions++;
    console.log(`Client connected (Session: ${sessionId}). Total sessions: ${currentSessions}`);
    
    // Start watching downloads directory for this session
    const watcher = chokidar.watch(sessionDir, {
        ignoreInitial: true,
        persistent: true,
        depth: 0,
        ignored: /(^|[\/\\])\..|.*\.crdownload$|.*\.tmp$/
    });

    watcher.on('add', async (filePath) => {
        const fileName = path.basename(filePath);
        console.log(`File detected in downloads: ${fileName}`);
        
        if (sessionConfig.vtAnalyzeDownloads) {
            console.log(`Analyzing file with VirusTotal: ${fileName}`);
            const reportUrl = await uploadFileToVT(filePath, vtKey);
            if (reportUrl) {
                ws.send(JSON.stringify({ type: 'vt_report', reportUrl, item: fileName }));
            }
        }

        // Give the OS a moment to release any locks
        setTimeout(() => {
            if (fs.existsSync(filePath)) {
                ws.send(JSON.stringify({ type: 'download_finished', filename: fileName }));
            }
        }, 1000);
    });

    if (!browser) await initBrowser();
    
    // Use the default context to share everything with MCP
    const context = browser!.defaultBrowserContext();

    const sessionPages = new Map<string, Page>();
    const pendingFileChoosers = new Map<string, FileChooser>();
    const MAX_TABS = 10;
    let activePageId: string | null = null;
    let sessionConfig = {
        language: 'es-ES',
        vtAnalyzeDownloads: false,
        vtAnalyzeUrls: false
    };

    const setupPage = async (page: Page, id: string) => {
        const lang = sessionConfig.language;
        
        // Emulate language before navigation
        await page.evaluateOnNewDocument((l: string) => {
            Object.defineProperty(navigator, 'language', { get: () => l, configurable: true });
            Object.defineProperty(navigator, 'languages', { get: () => [l, l.split('-')[0]], configurable: true });
        }, lang).catch(() => {});

        await page.setExtraHTTPHeaders({
            'Accept-Language': `${lang},${lang.split('-')[0]};q=0.9,en;q=0.8`
        }).catch(() => {});

        // Handle file selection requests
        page.on('filechooser', async (fileChooser) => {
            console.log(`[Session ${sessionId}] File selection requested in page ${id}`);
            pendingFileChoosers.set(id, fileChooser as any);
            ws.send(JSON.stringify({ type: 'file_requested', id, multiple: (fileChooser as any).isMultiple() }));
        });

        // Debug remote console
        page.on('console', msg => {
            if (msg.text() === '__BASTION_AI_ACTIVE__') {
                ws.send(JSON.stringify({ type: 'ai_active', id }));
                return;
            }
            if (msg.type() === 'error') console.log(`[Remote Browser Error - ${id}]: ${msg.text()}`);
        });

        // Set behaviors using CDP (Chrome DevTools Protocol) for maximum compatibility
        try {
            const client = await page.target().createCDPSession();
            
            // Enable file chooser interception at the protocol level
            await client.send('Page.setInterceptFileChooserDialog', { enabled: true });
            
            // Set download behavior
            await client.send('Page.setDownloadBehavior', {
                behavior: 'allow',
                downloadPath: sessionDir,
            });
            
            console.log(`[Session ${sessionId}] Browser behaviors enabled via CDP for page ${id}`);
        } catch (e) {
            console.error('Failed to set browser behaviors via CDP:', e);
        }

        await page.setViewport({ width: 1280, height: 720 }).catch(() => {});
        
        page.on('domcontentloaded', async () => {
            const title = await page.title().catch(() => '');
            ws.send(JSON.stringify({ type: 'title_changed', id, title: title || 'New Tab' }));
        });

        page.on('load', () => {
            ws.send(JSON.stringify({ type: 'loading_stop', id }));
        });

        page.on('framenavigated', (frame: Frame) => {
            if (frame === page.mainFrame()) {
                ws.send(JSON.stringify({ type: 'url_changed', url: page.url(), id }));
            }
        });
    };

    // Import existing pages into the UI session
    const existingPages = await context.pages();
    for (const p of existingPages) {
        const id = (p as any).target()._targetId;
        if (!sessionPages.has(id)) {
            await setupPage(p, id);
            sessionPages.set(id, p);
            ws.send(JSON.stringify({ type: 'tab_created', id }));
        }
    }

    // Listen for new targets (e.g. window.open)
    context.on('targetcreated', async (target: any) => {
        if (target.type() === 'page') {
            const newPage = await target.page();
            if (newPage) {
                const id = target._targetId;
                if (!sessionPages.has(id)) {
                    console.log(`New page detected: ${id}`);
                    await setupPage(newPage, id);
                    sessionPages.set(id, newPage);
                    ws.send(JSON.stringify({ type: 'tab_created', id }));
                }
            }
        }
    });

    // Load session-specific keys from encrypted vault
    let vault = loadFromVault(API_KEY);
    let vtKey = vault.vtKey || process.env.VIRUSTOTAL_API_KEY;

    ws.on('message', async (message: string) => {
        try {
            const data = JSON.parse(message);

            switch (data.type) {
                case 'save_vt_key': {
                    const currentVault = loadFromVault(API_KEY);
                    currentVault.vtKey = data.key;
                    saveToVault(currentVault, API_KEY);
                    vtKey = data.key;
                    console.log(`[Session ${sessionId}] VirusTotal API Key saved to encrypted vault.`);
                    break;
                }
                case 'update_config': {
                    sessionConfig = { ...sessionConfig, ...data.config };
                    console.log(`Session ${sessionId} updated config:`, sessionConfig);
                    const lang = sessionConfig.language;
                    
                    for (const page of sessionPages.values()) {
                        // Update headers
                        await page.setExtraHTTPHeaders({
                            'Accept-Language': `${lang},${lang.split('-')[0]};q=0.9,en;q=0.8`
                        }).catch(() => {});
                        
                        // Update JS navigator property
                        await page.evaluate((l: string) => {
                            Object.defineProperty(navigator, 'language', { get: () => l, configurable: true });
                            Object.defineProperty(navigator, 'languages', { get: () => [l, l.split('-')[0]], configurable: true });
                        }, lang).catch(() => {});
                    }
                    break;
                }

                case 'create_tab': {
                    if (sessionPages.size >= MAX_TABS) return;
                    const page = await context.newPage();
                    const id = (page as any).target()._targetId;
                    
                    if (!sessionPages.has(id)) {
                        await setupPage(page, id);
                        sessionPages.set(id, page);
                        // tab_created will be sent by targetcreated listener or here
                        // to be safe and avoid duplicates, let's check if we already sent it
                        ws.send(JSON.stringify({ type: 'tab_created', id }));
                    }

                    const targetUrl = data.url || 'about:blank';
                    if (targetUrl !== 'about:blank') {
                        ws.send(JSON.stringify({ type: 'loading_start', id }));
                        await page.goto(targetUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
                    }
                    
                    ws.send(JSON.stringify({ type: 'loading_stop', id }));
                    break;
                }

                case 'file_provided': {
                    const { id, filenames } = data;
                    const fileChooser = pendingFileChoosers.get(id);
                    if (fileChooser && filenames && Array.isArray(filenames)) {
                        const filePaths = filenames.map(filename => 
                            path.join(sessionUploadDir, path.basename(filename))
                        ).filter(p => fs.existsSync(p));

                        if (filePaths.length > 0) {
                            console.log(`Providing ${filePaths.length} files to browser:`, filePaths);
                            await fileChooser.accept(filePaths);
                            pendingFileChoosers.delete(id);
                            // Cleanup uploaded files after use
                            setTimeout(() => {
                                for (const p of filePaths) {
                                    try {
                                        if (fs.existsSync(p)) fs.unlinkSync(p);
                                    } catch (e) {}
                                }
                            }, 2000);
                        }
                    }
                    break;
                }

                case 'cancel_file_request': {
                    const { id } = data;
                    const fileChooser = pendingFileChoosers.get(id);
                    if (fileChooser) {
                        await fileChooser.cancel();
                        pendingFileChoosers.delete(id);
                    }
                    break;
                }

                case 'download_url': {
                    if (data.url) {
                        downloadFileFromUrl(data.url, sessionDir)
                            .then((filename) => {
                                ws.send(JSON.stringify({ type: 'download_finished', filename }));
                            })
                            .catch(err => {
                                ws.send(JSON.stringify({ type: 'download_failed', error: err.message }));
                            });
                    }
                    break;
                }

                case 'activate_tab': {
                    activePageId = data.id;
                    const page = sessionPages.get(activePageId!);
                    if (page) {
                         await page.bringToFront();
                         startScreencast(ws, page);
                         ws.send(JSON.stringify({ 
                             type: 'url_changed', 
                             url: page.url(), 
                             id: activePageId 
                         }));
                    }
                    break;
                }

                case 'navigate': {
                    if (!activePageId) return;
                    const page = sessionPages.get(activePageId);
                    if (page) {
                        let targetUrl = data.url;
                        try {
                            if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://') && !targetUrl.startsWith('about:')) {
                                targetUrl = `https://${targetUrl}`;
                            }
                            new URL(targetUrl);
                        } catch (e) {
                            return;
                        }

                        if (sessionConfig.vtAnalyzeUrls && !targetUrl.startsWith('about:')) {
                            const uri = new URL(targetUrl);
                            const hostname = uri.hostname.toLowerCase();
                            
                            // Whitelist/Exclusion List: Search engines and trusted domains
                            const isWhitelisted = 
                                hostname.includes('google.com') || 
                                hostname.includes('startpage.com') || 
                                hostname.includes('brave.com') ||
                                hostname === 'localhost';

                            if (!isWhitelisted) {
                                ws.send(JSON.stringify({ type: 'vt_scanning', url: targetUrl }));
                                const { safe, reportUrl } = await getVTUrlReport(targetUrl, vtKey);
                                
                                if (!safe) {
                                    ws.send(JSON.stringify({ 
                                        type: 'vt_warning', 
                                        url: targetUrl, 
                                        reportUrl 
                                    }));
                                    return; // Stop navigation if not safe
                                } else if (reportUrl) {
                                    ws.send(JSON.stringify({ type: 'vt_info', url: targetUrl, reportUrl }));
                                }
                            }
                        }

                        ws.send(JSON.stringify({ type: 'loading_start', id: activePageId }));
                        page.goto(targetUrl, { waitUntil: 'domcontentloaded' }).catch(() => {
                            ws.send(JSON.stringify({ type: 'loading_stop', id: activePageId }));
                        });
                    }
                    break;
                }
                
                case 'stop_loading': {
                    if (!activePageId) return;
                    const page = sessionPages.get(activePageId);
                    if (page) {
                        try {
                            await page.evaluate(() => window.stop());
                            ws.send(JSON.stringify({ type: 'loading_stop', id: activePageId }));
                        } catch (e) {}
                    }
                    break;
                }

                case 'resize': {
                    if (!activePageId) return;
                    const page = sessionPages.get(activePageId);
                    if (page) {
                         await page.setViewport({ width: data.width, height: data.height });
                    }
                    break;
                }

                case 'navigation_control': {
                    if (!activePageId) return;
                    const page = sessionPages.get(activePageId);
                    if (page) {
                        ws.send(JSON.stringify({ type: 'loading_start', id: activePageId }));
                        if (data.action === 'back') await page.goBack().catch(() => {});
                        else if (data.action === 'forward') await page.goForward().catch(() => {});
                        else if (data.action === 'reload') await page.reload().catch(() => {});
                        ws.send(JSON.stringify({ type: 'url_changed', url: page.url(), id: activePageId }));
                    }
                    break;
                }

                case 'close_tab': {
                    const idToClose = data.id;
                    const pageToClose = sessionPages.get(idToClose);
                    if (pageToClose) {
                        await pageToClose.close().catch(() => {});
                        sessionPages.delete(idToClose);
                    }
                    break;
                }

                case 'manual_file_request': {
                    if (!activePageId) return;
                    const page = sessionPages.get(activePageId);
                    if (page) {
                        console.log(`[Session ${sessionId}] Manual file request triggered for page ${activePageId}`);
                        await page.evaluate(() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.multiple = true;
                            input.style.display = 'none';
                            input.id = 'bastion-manual-upload';
                            document.body.appendChild(input);
                            input.click();
                            document.body.removeChild(input);
                        }).catch(e => console.error("Manual file trigger failed:", e));
                    }
                    break;
                }

                case 'mouse_event': {
                    if (!activePageId) return;
                    const page = sessionPages.get(activePageId);
                    if (page) {
                        try {
                            if (data.event === 'mousemove') {
                                await page.mouse.move(data.x, data.y);
                            } else if (data.event === 'mousedown') {
                                await page.mouse.down({ button: data.button || 'left' });
                            } else if (data.event === 'mouseup') {
                                await page.mouse.up({ button: data.button || 'left' });
                            } else if (data.event === 'wheel') {
                                 await page.mouse.wheel({ deltaY: data.deltaY });
                            }
                        } catch (e) {}
                    }
                    break;
                }

                case 'keyboard_event': {
                    if (!activePageId) return;
                    const page = sessionPages.get(activePageId);
                    if (page) {
                        try {
                            if (data.event === 'keydown') {
                                await page.keyboard.down(data.key);
                            } else if (data.event === 'keyup') {
                                await page.keyboard.up(data.key);
                            }
                        } catch (e) {}
                    }
                    break;
                }

                case 'get_context_info': {
                    if (!activePageId) return;
                    const page = sessionPages.get(activePageId);
                    if (page) {
                        try {
                            const contextInfo = await page.evaluate((x, y) => {
                                const element = document.elementFromPoint(x, y);
                                const selection = window.getSelection()?.toString();
                                if (!element) return { type: 'none', selection };
                                const link = element.closest('a');
                                const img = element.closest('img');
                                return {
                                    type: link ? 'link' : (img ? 'image' : 'page'),
                                    url: link ? link.href : (img ? img.src : document.location.href),
                                    text: link ? link.innerText : '',
                                    selection: selection
                                };
                            }, data.x, data.y);
                            ws.send(JSON.stringify({ 
                                type: 'context_menu_info', 
                                x: data.x, 
                                y: data.y,
                                info: contextInfo 
                            }));
                        } catch (e) {}
                    }
                    break;
                }
            }
        } catch (error) {
            console.error('WS Error:', error);
        }
    });

    ws.on('close', async () => {
        currentSessions--;
        if (screencastInterval) clearInterval(screencastInterval);
        if (watcher) await watcher.close();
        for (const page of sessionPages.values()) {
            await page.close().catch(() => {});
        }
        await context.close().catch(() => {});
        
        // Clean up uploads
        if (fs.existsSync(sessionUploadDir)) {
            fs.rmSync(sessionUploadDir, { recursive: true, force: true });
        }
        
        console.log(`Client disconnected. Total sessions: ${currentSessions}`);
    });

    let screencastInterval: NodeJS.Timeout | null = null;

    async function startScreencast(ws: WebSocket, page: Page) {
        try {
            const client = await page.target().createCDPSession();
            await client.send('Page.startScreencast', {
                format: 'jpeg',
                quality: 70, 
                maxWidth: 1920,
                maxHeight: 1080
            });

            client.on('Page.screencastFrame', async (frame) => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'frame',
                        data: frame.data,
                        metadata: frame.metadata
                    }));
                    try {
                        await client.send('Page.screencastFrameAck', { sessionId: frame.sessionId });
                    } catch(e) {}
                }
            });
        } catch(e) {}
    }
});