import React from 'react';
import { Cpu, Terminal, Shield, CheckCircle, Copy, Globe, MessageSquare } from 'lucide-react';
import './WelcomePage.css'; // Reuse some styles

interface MCPDocsProps {
    language?: string;
}

const MCPDocs: React.FC<MCPDocsProps> = ({ language = 'es-ES' }) => {
    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert(language === 'es-ES' ? 'Copiado al portapapeles' : 'Copied to clipboard');
    };

    const isSpanish = language === 'es-ES';

    return (
        <>
        <div className="welcome-container docs-container" style={{ overflowY: 'auto', height: '100%', padding: '40px 20px', color: '#ffffff' }}>
            <div className="dot-overlay"></div>
            <div className="welcome-content" style={{ maxWidth: '1000px', margin: '0 auto', textAlign: 'left', color: '#ffffff' }}>
                <header style={{ marginBottom: '60px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', marginBottom: '20px' }}>
                        <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '15px', borderRadius: '15px', color: '#10b981' }}>
                            <Cpu size={40} />
                        </div>
                    </div>
                    <h1 className="welcome-logo" style={{ fontSize: '4rem', marginBottom: '10px' }}>
                        MCP SERVER
                    </h1>
                    <p style={{ fontSize: '1.2rem', color: 'rgba(255,255,255,0.7)', maxWidth: '700px', margin: '0 auto' }}>
                        {isSpanish 
                            ? 'Permite que tus agentes de IA naveguen por la red usando la infraestructura segura de Bastion.' 
                            : 'Let your AI agents browse the web using Bastion\'s secure infrastructure.'}
                    </p>
                </header>

                <section style={{ marginBottom: '40px' }}>
                    <h2 style={{ color: '#ffffff', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1.8rem', marginBottom: '20px' }}>
                        <Terminal size={24} /> {isSpanish ? 'Instalación Principal' : 'Main Installation'}
                    </h2>
                    <div className="code-block-container" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', overflow: 'hidden' }}>
                        <div className="code-header" style={{ padding: '12px 20px', background: 'rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>{isSpanish ? 'Endpoint de Conexión (SSE)' : 'Connection Endpoint (SSE)'}</span>
                            <button className="docs-copy-btn" onClick={() => copyToClipboard(`http://${window.location.hostname}:3001/sse`)}>
                                <Copy size={16} />
                            </button>
                        </div>
                        <pre style={{ margin: 0, padding: '20px', fontSize: '1.1rem', color: '#10b981' }}><code>{`http://${window.location.hostname}:3001/sse`}</code></pre>
                    </div>
                </section>

                <div className="docs-grid">
                    <div className="bento-card">
                        <div className="card-header-row">
                            <h3><Globe size={20} /> Gemini CLI</h3>
                            <button className="docs-copy-btn" onClick={() => copyToClipboard(`{
  "mcpServers": {
    "bastion": {
      "url": "http://${window.location.hostname}:3001/sse"
    }
  }
}`)}><Copy size={16} /></button>
                        </div>
                        <p>{isSpanish ? 'Añade esto a tu configuración de Gemini CLI:' : 'Add this to your Gemini CLI config:'}</p>
                        <pre className="inline-code-block">
{`{
  "mcpServers": {
    "bastion": {
      "url": "http://${window.location.hostname}:3001/sse"
    }
  }
}`}
                        </pre>
                    </div>

                    <div className="bento-card">
                        <div className="card-header-row">
                            <h3><MessageSquare size={20} /> Claude Code</h3>
                            <button className="docs-copy-btn" onClick={() => copyToClipboard(`claude mcp add bastion http://${window.location.hostname}:3001/sse`)}><Copy size={16} /></button>
                        </div>
                        <p>{isSpanish ? 'Ejecuta el siguiente comando:' : 'Run the following command:'}</p>
                        <pre className="inline-code-block">
{`claude mcp add bastion http://${window.location.hostname}:3001/sse`}
                        </pre>
                    </div>

                    <div className="bento-card">
                        <div className="card-header-row">
                            <h3><Shield size={20} /> Editors (Cursor/VSCode)</h3>
                        </div>
                        <p>{isSpanish ? 'Añade un nuevo servidor SSE con estos datos:' : 'Add a new SSE server with these details:'}</p>
                        <ul className="docs-list">
                            <li><strong>Name:</strong> Bastion</li>
                            <li><strong>Type:</strong> SSE</li>
                            <li><strong>URL:</strong> <code style={{ color: '#10b981' }}>http://{window.location.hostname}:3001/sse</code></li>
                        </ul>
                    </div>

                    <div className="bento-card">
                        <div className="card-header-row">
                            <h3><CheckCircle size={20} /> {isSpanish ? 'Herramientas IA' : 'AI Tools'}</h3>
                        </div>
                        <p>{isSpanish ? 'Más de 30 capacidades profesionales:' : 'Over 30 professional capabilities:'}</p>
                        <div className="tools-mini-grid">
                            <span>• browser_navigate</span>
                            <span>• browser_click</span>
                            <span>• browser_type</span>
                            <span>• browser_tabs</span>
                            <span>• browser_snapshot</span>
                            <span>• browser_screenshot</span>
                        </div>
                    </div>
                </div>

                <footer style={{ marginTop: '80px', textAlign: 'center', opacity: 0.3, color: '#ffffff' }}>
                    <p>Bastion Browser & MCP Server • 2026</p>
                </footer>
            </div>
            
            <style dangerouslySetInnerHTML={{ __html: `
                .docs-container {
                    background-color: #000000 !important;
                    color: #ffffff !important;
                }
                .docs-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 20px;
                    width: 100%;
                }
                .card-header-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 15px;
                    width: 100%;
                }
                .card-header-row h3 {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin: 0;
                    font-size: 1.3rem;
                    color: #fff;
                }
                .inline-code-block {
                    background: rgba(0, 0, 0, 0.4);
                    padding: 15px;
                    border-radius: 12px;
                    font-size: 0.85rem;
                    color: #10b981;
                    margin-top: 15px;
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    overflow-x: auto;
                }
                .docs-list {
                    padding-left: 20px;
                    color: rgba(255, 255, 255, 0.7);
                    margin-top: 15px;
                    line-height: 1.8;
                }
                .tools-mini-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 8px;
                    font-size: 0.85rem;
                    color: rgba(255, 255, 255, 0.5);
                    margin-top: 15px;
                }
                .docs-copy-btn {
                    background: rgba(16, 185, 129, 0.1);
                    border: 1px solid rgba(16, 185, 129, 0.3);
                    color: #10b981;
                    width: 36px;
                    height: 36px;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .docs-copy-btn:hover {
                    background: rgba(16, 185, 129, 0.25);
                    transform: translateY(-2px);
                    border-color: rgba(16, 185, 129, 0.5);
                    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
                }
                .docs-copy-btn:active {
                    transform: translateY(0);
                }
                @media (max-width: 800px) {
                    .docs-grid {
                        grid-template-columns: 1fr;
                    }
                }
            `}} />
        </div>
        </>
    );
};

export default MCPDocs;