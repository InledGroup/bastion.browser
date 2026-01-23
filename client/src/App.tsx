import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    X,
    Plus,
    ArrowLeft,
    ArrowRight,
    RotateCw,
    Home,
    Lock,
    Search,
    ExternalLink,
    Copy,
    Download,
    Trash2,
    FileText,
    Settings,
    Languages,
    Key,
    LogOut,
    Eye,
    EyeOff,
    Upload,
    FileUp
} from 'lucide-react';
import WelcomePage from './WelcomePage';
import './App.css';

const translations: any = {
    'es-ES': {
        restricted: 'Acceso Restringido',
        config_key: 'Configura tu API Key en los ajustes para iniciar una sesión segura.',
        open_settings: 'Abrir Ajustes',
        downloads: 'Descargas',
        no_downloads: 'No hay descargas',
        settings: 'Configuración',
        lang_label: 'Idioma del Navegador',
        lang_hint: 'Se aplica a todas las pestañas abiertas y nuevas.',
        key_label: 'API Key de Interacción',
        key_placeholder: 'Introduce tu API Key',
        logout: 'Cerrar Sesión',
        connecting: 'Conectando...',
        login: 'Iniciar Sesión',
        search_placeholder: 'Busca o escribe una dirección web',
        new_tab: 'Nueva Pestaña',
        copy_selection: 'Copiar Selección',
        search_google: 'Buscar en Google',
        back: 'Atrás',
        forward: 'Adelante',
        reload: 'Recargar',
        open_new_tab: 'Abrir en nueva pestaña',
        download_item: 'Descargar',
        upload_title: 'Subida Segura de Archivos',
        upload_desc: 'Una página solicita un archivo. Selecciona un documento para enviarlo al Bastión de forma aislada.',
        upload_btn: 'Seleccionar del Equipo',
        cancel: 'Cancelar',
        drop_files: 'Suelte el archivo aquí'
    },
    'en-US': {
        restricted: 'Restricted Access',
        config_key: 'Configure your API Key in settings to start a secure session.',
        open_settings: 'Open Settings',
        downloads: 'Downloads',
        no_downloads: 'No downloads yet',
        settings: 'Settings',
        lang_label: 'Browser Language',
        lang_hint: 'Applies to all open and new tabs.',
        key_label: 'Interaction API Key',
        key_placeholder: 'Enter your API Key',
        logout: 'Log Out',
        connecting: 'Connecting...',
        login: 'Log In',
        search_placeholder: 'Search or enter web address',
        new_tab: 'New Tab',
        copy_selection: 'Copy Selection',
        search_google: 'Search Google',
        back: 'Back',
        forward: 'Forward',
        reload: 'Reload',
        open_new_tab: 'Open in new tab',
        download_item: 'Download',
        upload_title: 'Secure File Upload',
        upload_desc: 'A webpage is requesting a file. Select a document to send it to the Bastion in an isolated way.',
        upload_btn: 'Select from Computer',
        cancel: 'Cancel',
        drop_files: 'Drop file here'
    }
};

interface Tab {
    id: string;
    title: string;
    url: string;
    isLoading: boolean;
}

interface DownloadFile {
    name: string;
    size: number;
    mtime: string;
}

function App() {
    const [socket, setSocket] = useState<WebSocket | null>(null);
    const [tabs, setTabs] = useState<Tab[]>([]);
    const [activeTabId, setActiveTabId] = useState<string | null>(null);
    const [urlInput, setUrlInput] = useState('');
    const [imageSrc, setImageSrc] = useState<string>('');
    const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number; info: any } | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);

    const [downloads, setDownloads] = useState<DownloadFile[]>([]);
    const [showDownloads, setShowDownloads] = useState(false);

    const [showSettings, setShowSettings] = useState(false);
    const [language, setLanguage] = useState(localStorage.getItem('browser-lang') || 'es-ES');
    const t = translations[language] || translations['es-ES'];

    const [apiKey, setApiKey] = useState(localStorage.getItem('browser-api-key') || '');
    const [showApiKey, setShowApiKey] = useState(false);
    const [tempApiKey, setTempApiKey] = useState('');

    const [sessionId, setSessionId] = useState<string | null>(null);
    const [fileRequest, setFileRequest] = useState<{ id: string; multiple: boolean } | null>(null);

    const imgRef = useRef<HTMLImageElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const activeTabIdRef = useRef<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchDownloads = useCallback(async () => {
        const currentKey = localStorage.getItem('browser-api-key') || apiKey;
        if (!currentKey || !sessionId) return;
        try {
            const response = await fetch(`/api/downloads?api_key=${encodeURIComponent(currentKey)}&sessionId=${sessionId}`);
            if (response.ok) {
                const data = await response.json();
                setDownloads(data);
            }
        } catch (e) {
            console.error('Failed to fetch downloads', e);
        }
    }, [apiKey, sessionId]);

    const downloadFile = async (name: string) => {
        const currentKey = localStorage.getItem('browser-api-key') || apiKey;
        if (!sessionId) return;
        try {
            const response = await fetch(`/api/downloads/${encodeURIComponent(name)}?api_key=${encodeURIComponent(currentKey)}&sessionId=${sessionId}`);
            if (!response.ok) throw new Error('Network response was not ok');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = name;
            document.body.appendChild(link);
            link.click();

            setTimeout(() => {
                window.URL.revokeObjectURL(url);
                document.body.removeChild(link);
            }, 100);
        } catch (e) {
            console.error('Download failed', e);
        }
    };

    const handleFileUpload = async (files: FileList | null) => {
        if (!files || files.length === 0 || !fileRequest || !sessionId) return;
        
        const currentKey = localStorage.getItem('browser-api-key') || apiKey;
        const formData = new FormData();
        formData.append('file', files[0]);

        try {
            const response = await fetch(`/api/upload?api_key=${encodeURIComponent(currentKey)}&sessionId=${sessionId}`, {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const { filename } = await response.json();
                sendMsg({ type: 'file_provided', id: fileRequest.id, filename });
                setFileRequest(null);
            }
        } catch (err) {
            console.error('Upload failed', err);
        }
    };

    const cancelFileUpload = () => {
        if (fileRequest) {
            sendMsg({ type: 'cancel_file_request', id: fileRequest.id });
            setFileRequest(null);
        }
    };

    const deleteFile = async (name: string) => {
        const currentKey = localStorage.getItem('browser-api-key') || apiKey;
        if (!sessionId) return;
        await fetch(`/api/downloads/${encodeURIComponent(name)}?api_key=${encodeURIComponent(currentKey)}&sessionId=${sessionId}`, { method: 'DELETE' });
        fetchDownloads();
    };

    const clearAllDownloads = async () => {
        const currentKey = localStorage.getItem('browser-api-key') || apiKey;
        if (!sessionId) return;
        await fetch(`/api/downloads?api_key=${encodeURIComponent(currentKey)}&sessionId=${sessionId}`, { method: 'DELETE' });
        fetchDownloads();
    };

    const downloadAll = async () => {
        for (const file of downloads) {
            await downloadFile(file.name);
            await new Promise(r => setTimeout(r, 200));
        }
    };

    const updateTab = (id: string, updates: Partial<Tab>) => {
        setTabs(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    };

    const sendMsg = useCallback((msg: any) => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(msg));
        }
    }, [socket]);

    const connect = (key: string) => {
        if (!key) return;
        if (socket) socket.close();
        setIsConnecting(true);

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        let host = window.location.hostname + (window.location.port ? `:${window.location.port}` : '');
        if (window.location.port === '5173') host = 'localhost:112';

        const ws = new WebSocket(`${protocol}//${host}/?api_key=${encodeURIComponent(key)}`);

        ws.onopen = () => {
            setIsConnected(true);
            setIsConnecting(false);
            setApiKey(key);
            localStorage.setItem('browser-api-key', key);
            ws.send(JSON.stringify({ type: 'update_config', config: { language } }));
            ws.send(JSON.stringify({ type: 'create_tab' }));
        };

        ws.onclose = (event) => {
            setIsConnected(false);
            setIsConnecting(false);
            setImageSrc('');
            if (event.code === 4001 || event.reason === 'Unauthorized') {
                localStorage.removeItem('browser-api-key');
                setApiKey('');
            }
        };

        ws.onerror = () => setIsConnecting(false);

        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            switch (msg.type) {
                case 'session_ready':
                    setSessionId(msg.sessionId);
                    break;
                case 'file_requested':
                    setFileRequest({ id: msg.id, multiple: msg.multiple });
                    break;
                case 'tab_created':
                    setTabs(prev => {
                        const exists = prev.find(t => t.id === msg.id);
                        if (exists) return prev;
                        const newTabs = [...prev, { id: msg.id, title: t.new_tab, url: 'about:blank', isLoading: false }];
                        if (!activeTabIdRef.current) setActiveTabId(msg.id);
                        return newTabs;
                    });
                    break;
                case 'frame':
                    setImageSrc(`data:image/jpeg;base64,${msg.data}`);
                    break;
                case 'url_changed':
                    updateTab(msg.id, { url: msg.url });
                    if (msg.id === activeTabIdRef.current) setUrlInput(msg.url);
                    break;
                case 'title_changed':
                    updateTab(msg.id, { title: msg.title });
                    break;
                case 'loading_start':
                    updateTab(msg.id, { isLoading: true });
                    break;
                case 'loading_stop':
                    updateTab(msg.id, { isLoading: false });
                    break;
                case 'context_menu_info':
                    setContextMenu({ visible: true, x: msg.x, y: msg.y, info: msg.info });
                    break;
                case 'download_finished':
                    fetchDownloads();
                    break;
            }
        };

        setSocket(ws);
    };

    const disconnect = () => {
        if (socket) socket.close();
        localStorage.removeItem('browser-api-key');
        setApiKey('');
        setTabs([]);
        setActiveTabId(null);
        setImageSrc('');
        setSessionId(null);
    };

    useEffect(() => {
        const savedKey = localStorage.getItem('browser-api-key');
        if (savedKey && !isConnected && !isConnecting) connect(savedKey);
    }, []);

    useEffect(() => {
        if (showDownloads) fetchDownloads();
    }, [showDownloads, fetchDownloads]);

    useEffect(() => {
        activeTabIdRef.current = activeTabId;
    }, [activeTabId]);

    useEffect(() => {
        if (isConnected && activeTabId) {
            sendMsg({ type: 'activate_tab', id: activeTabId });
            const currentTab = tabs.find(t => t.id === activeTabId);
            if (currentTab) setUrlInput(currentTab.url);
            setTimeout(handleResize, 50);
        }
    }, [activeTabId, isConnected, sendMsg]);

    const handleResize = useCallback(() => {
        if (containerRef.current && isConnected && activeTabId) {
            const { clientWidth, clientHeight } = containerRef.current;
            sendMsg({ type: 'resize', width: clientWidth, height: clientHeight });
        }
    }, [isConnected, activeTabId, sendMsg]);

    useEffect(() => {
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [handleResize]);

    useEffect(() => {
        if (imageSrc && isConnected) handleResize();
    }, [imageSrc, isConnected, handleResize]);

    const handleNavigate = (e: React.FormEvent) => {
        e.preventDefault();
        if (activeTabId) {
            let targetUrl = urlInput;
            if (!targetUrl.startsWith('http') && !targetUrl.startsWith('about:')) {
                if (targetUrl.includes('.') && !targetUrl.includes(' ')) {
                    targetUrl = 'https://' + targetUrl;
                } else {
                    targetUrl = 'https://www.google.com/search?q=' + encodeURIComponent(targetUrl);
                }
            }
            sendMsg({ type: 'navigate', url: targetUrl });
        }
    };

    const handleStopLoading = () => sendMsg({ type: 'stop_loading' });

    const getCoords = (e: React.MouseEvent) => {
        if (!imgRef.current) return null;
        const rect = imgRef.current.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const sendMouse = (type: string, e: React.MouseEvent, extra = {}) => {
        const coords = getCoords(e);
        if (coords) sendMsg({ type: 'mouse_event', event: type, x: coords.x, y: coords.y, ...extra });
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        const coords = getCoords(e);
        if (coords) {
            setContextMenu({ visible: true, x: e.clientX, y: e.clientY, info: null });
            sendMsg({ type: 'get_context_info', x: coords.x, y: coords.y });
        }
    };

    useEffect(() => {
        const handleKey = (e: KeyboardEvent, type: string) => {
            if ((e.target as HTMLElement).tagName === 'INPUT') return;
            sendMsg({ type: 'keyboard_event', event: type, key: e.key });
        };
        const onDown = (e: KeyboardEvent) => handleKey(e, 'keydown');
        const onUp = (e: KeyboardEvent) => handleKey(e, 'keyup');
        const onClickOutside = () => setContextMenu(null);
        window.addEventListener('keydown', onDown);
        window.addEventListener('keyup', onUp);
        window.addEventListener('click', onClickOutside);
        return () => {
            window.removeEventListener('keydown', onDown);
            window.removeEventListener('keyup', onUp);
            window.removeEventListener('click', onClickOutside);
        };
    }, [sendMsg]);

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
        } catch (err) {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
        }
        setContextMenu(null);
    };

    const activeTab = tabs.find(t => t.id === activeTabId);

    return (
        <div className="app-container">
            <div className="browser-chrome">
                <div className="tabs-bar">
                    {tabs.map(tab => (
                        <div key={tab.id} className={`tab ${tab.id === activeTabId ? 'active' : ''}`} onClick={() => setActiveTabId(tab.id)}>
                            <div className="tab-content">
                        {tab.isLoading ? <div className="spinner" /> : <img src="/bastion.png" className="tab-logo-icon" alt="B" />}
                        <span className="tab-title">{tab.title}</span>
                    </div>
                            <button className="close-tab-btn" onClick={(e) => {
                                e.stopPropagation();
                                sendMsg({ type: 'close_tab', id: tab.id });
                                setTabs(prev => {
                                    const newTabs = prev.filter(t => t.id !== tab.id);
                                    if (activeTabId === tab.id && newTabs.length > 0) setActiveTabId(newTabs[newTabs.length - 1].id);
                                    else if (newTabs.length === 0) { setActiveTabId(null); setImageSrc(''); setUrlInput(''); }
                                    return newTabs;
                                });
                            }}><X size={14} /></button>
                        </div>
                    ))}
                    <button onClick={() => sendMsg({ type: 'create_tab' })} className="new-tab-btn" title={t.new_tab}><Plus size={20} /></button>
                </div>

                <div className="navigation-bar">
                    <div className="nav-buttons">
                        <button className="icon-btn" title={t.back} onClick={() => sendMsg({ type: 'navigation_control', action: 'back' })}><ArrowLeft size={18} /></button>
                        <button className="icon-btn" title={t.forward} onClick={() => sendMsg({ type: 'navigation_control', action: 'forward' })}><ArrowRight size={18} /></button>
                        {activeTab?.isLoading ? <button className="icon-btn" title="Stop" onClick={handleStopLoading}><X size={18} /></button> : <button className="icon-btn" title={t.reload} onClick={() => sendMsg({ type: 'navigation_control', action: 'reload' })}><RotateCw size={18} /></button>}
                        <button className="icon-btn" title="Home" onClick={() => sendMsg({ type: 'navigate', url: 'about:blank' })}><Home size={18} /></button>
                        <button className={`icon-btn ${showDownloads ? 'active' : ''}`} title={t.downloads} onClick={() => { setShowDownloads(!showDownloads); setShowSettings(false); }}>
                            <Download size={18} />
                            {downloads.length > 0 && <span className="badge">{downloads.length}</span>}
                        </button>
                        <button className={`icon-btn ${showSettings ? 'active' : ''}`} title={t.settings} onClick={() => { setShowSettings(!showSettings); setShowDownloads(false); }}><Settings size={18} /></button>
                    </div>
                    <form onSubmit={handleNavigate} className="url-bar-container">
                        {urlInput.startsWith('https') ? <Lock size={14} color="#10b981" /> : <Search size={14} />}
                        <input type="text" value={urlInput === 'about:blank' ? '' : urlInput} onChange={e => setUrlInput(e.target.value)} onFocus={(e) => e.target.select()} placeholder={t.search_placeholder} className="url-input" disabled={!isConnected} />
                    </form>
                </div>
            </div>

            <div className="viewport-container" ref={containerRef} onWheel={(e) => sendMsg({ type: 'mouse_event', event: 'wheel', deltaY: e.deltaY })}>
                {imageSrc && isConnected && activeTab && activeTab.url !== 'about:blank' ? (
                    <img ref={imgRef} src={imageSrc} alt="Remote Viewport" className="remote-viewport" onMouseMove={(e) => sendMouse('mousemove', e)} onMouseDown={(e) => { if (e.button !== 2) { setContextMenu(null); sendMouse('mousedown', e, { button: e.button === 0 ? 'left' : e.button === 1 ? 'middle' : 'right' }); } }} onMouseUp={(e) => { if (e.button !== 2) sendMouse('mouseup', e, { button: e.button === 0 ? 'left' : e.button === 1 ? 'middle' : 'right' }); }} onContextMenu={handleContextMenu} draggable={false} />
                ) : (
                    <div className="overlay-content">
                        <WelcomePage language={language} onNavigate={(url) => sendMsg({ type: 'navigate', url })} />
                        {!isConnected && (
                            <div className="login-overlay">
                                <div className="login-card">
                                    <Lock size={48} className="login-icon" />
                                    <h2>{t.restricted}</h2>
                                    <p>{t.config_key}</p>
                                    <button className="primary-btn" onClick={() => setShowSettings(true)}>{t.open_settings}</button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* File Upload Request Overlay */}
                {fileRequest && (
                    <div className="login-overlay" style={{ zIndex: 200 }}>
                        <div className="login-card upload-card" 
                             onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
                             onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('drag-over'); }}
                             onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('drag-over'); handleFileUpload(e.dataTransfer.files); }}
                        >
                            <div className="upload-icon-container">
                                <FileUp size={48} className="upload-icon" />
                            </div>
                            <h2>{t.upload_title}</h2>
                            <p>{t.upload_desc}</p>
                            
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                style={{ display: 'none' }} 
                                onChange={(e) => handleFileUpload(e.target.files)}
                                multiple={fileRequest.multiple}
                            />
                            
                            <div className="upload-actions">
                                <button className="primary-btn" onClick={() => fileInputRef.current?.click()}>
                                    <Upload size={18} /> {t.upload_btn}
                                </button>
                                <button className="cancel-btn" onClick={cancelFileUpload}>
                                    {t.cancel}
                                </button>
                            </div>
                            <div className="drop-hint">{t.drop_files}</div>
                        </div>
                    </div>
                )}

                {showDownloads && (
                    <div className="downloads-panel">
                        <div className="downloads-header">
                            <h3>{t.downloads}</h3>
                            <div className="downloads-actions">
                                <button onClick={downloadAll} disabled={downloads.length === 0} title="Download All"><Download size={16} /></button>
                                <button onClick={clearAllDownloads} disabled={downloads.length === 0} title="Clear All" className="delete-btn"><Trash2 size={16} /></button>
                                <button onClick={() => setShowDownloads(false)} title="Close"><X size={16} /></button>
                            </div>
                        </div>
                        <div className="downloads-list">
                            {downloads.length === 0 ? <div className="empty-downloads">{t.no_downloads}</div> : downloads.map(file => (
                                <div key={file.name} className="download-item">
                                    <FileText size={20} className="file-icon" />
                                    <div className="file-info">
                                        <div className="file-name" title={file.name}>{file.name}</div>
                                        <div className="file-meta">{(file.size / 1024).toFixed(1)} KB • {new Date(file.mtime).toLocaleString()}</div>
                                    </div>
                                    <div className="item-actions">
                                        <button onClick={() => downloadFile(file.name)}><Download size={16} /></button>
                                        <button onClick={() => deleteFile(file.name)} className="delete-btn"><Trash2 size={16} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {showSettings && (
                    <div className="downloads-panel settings-panel">
                        <div className="downloads-header">
                            <h3>{t.settings}</h3>
                            <button onClick={() => setShowSettings(false)} className="icon-btn"><X size={16} /></button>
                        </div>
                        <div className="settings-content">
                            <div className="setting-group">
                                <label><Languages size={16} /> {t.lang_label}</label>
                                <select value={language} onChange={(e) => { const newLang = e.target.value; setLanguage(newLang); localStorage.setItem('browser-lang', newLang); if (isConnected) sendMsg({ type: 'update_config', config: { language: newLang } }); }}>
                                    <option value="es-ES">Español (España)</option>
                                    <option value="en-US">English (US)</option>
                                </select>
                                <p className="setting-hint">{t.lang_hint}</p>
                            </div>
                            <div className="setting-group">
                                <label><Key size={16} /> {t.key_label}</label>
                                <div className="api-key-input">
                                    <input type={showApiKey ? 'text' : 'password'} placeholder={apiKey ? '••••••••••••••••' : t.key_placeholder} value={tempApiKey} onChange={(e) => setTempApiKey(e.target.value)} />
                                    <button className="icon-btn" onClick={() => setShowApiKey(!showApiKey)}>{showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                                </div>
                                <div className="settings-footer">
                                    {isConnected ? <button className="logout-btn" onClick={disconnect}><LogOut size={16} /> {t.logout}</button> : <button className="primary-btn" onClick={() => connect(tempApiKey)} disabled={isConnecting || !tempApiKey}>{isConnecting ? t.connecting : t.login}</button>}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {contextMenu && contextMenu.visible && (
                    <div className="context-menu" style={{ top: contextMenu.y, left: contextMenu.x }}>
                        {contextMenu.info?.selection && (
                            <>
                                <div className="context-menu-item" onClick={() => copyToClipboard(contextMenu.info.selection)}><Copy size={14} /> {t.copy_selection}</div>
                                <div className="context-menu-item" onClick={() => { sendMsg({ type: 'create_tab', url: `https://www.google.com/search?q=${encodeURIComponent(contextMenu.info.selection)}` }); setContextMenu(null); }}><Search size={14} /> Search Google</div>
                                <div className="context-menu-separator"></div>
                            </>
                        )}
                        <div className="context-menu-item" onClick={() => sendMsg({ type: 'navigation_control', action: 'back' })}><ArrowLeft size={16} /> {t.back}</div>
                        <div className="context-menu-item" onClick={() => sendMsg({ type: 'navigation_control', action: 'forward' })}><ArrowRight size={16} /> {t.forward}</div>
                        <div className="context-menu-item" onClick={() => sendMsg({ type: 'navigation_control', action: 'reload' })}><RotateCw size={16} /> {t.reload}</div>
                        {contextMenu.info?.url && <div className="context-menu-separator"></div>}
                        {contextMenu.info?.type === 'link' && <div className="context-menu-item" onClick={() => { sendMsg({ type: 'create_tab', url: contextMenu.info.url }); setContextMenu(null); }}><ExternalLink size={14} /> Open in New Tab</div>}
                        {(contextMenu.info?.type === 'image' || contextMenu.info?.type === 'link') && <div className="context-menu-item" onClick={() => { sendMsg({ type: 'download_url', url: contextMenu.info.url }); setContextMenu(null); setShowDownloads(true); }}><Download size={14} /> Download</div>}
                    </div>
                )}
            </div>
        </div>
    );
}

export default App;