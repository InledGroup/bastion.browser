import { spawn } from 'child_process';
import path from 'path';

const serverProcess = spawn('node', [path.join(__dirname, 'index.js')], { stdio: 'inherit' });
const mcpProcess = spawn('node', [path.join(__dirname, 'mcp-server.js')], { stdio: 'inherit' });

process.on('SIGINT', () => {
    serverProcess.kill();
    mcpProcess.kill();
    process.exit();
});

process.on('SIGTERM', () => {
    serverProcess.kill();
    mcpProcess.kill();
    process.exit();
});
