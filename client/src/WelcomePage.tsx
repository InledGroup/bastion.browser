import React, { useMemo, useState } from 'react';
import { Shield, Zap, Lock, Globe, Server, UserCheck, ArrowRight, Cpu } from 'lucide-react';
import './WelcomePage.css';

interface WelcomePageProps {
  onNavigate?: (url: string) => void;
  onShowMCP?: () => void;
  language?: string;
}

const WelcomePage: React.FC<WelcomePageProps> = ({ onNavigate, onShowMCP, language = 'es-ES' }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeEngine, setActiveEngine] = useState('startpage');

  const engines = {
    startpage: {
      name: 'Startpage',
      url: 'https://www.startpage.com/do/dsearch?query=',
      logo: 'https://www.startpage.com/sp/cdn/images/startpage-logo-72.png'
    },
    brave: {
      name: 'Brave',
      url: 'https://search.brave.com/search?q=',
      logo: 'https://cdn.search.brave.com/serp/v2/_app/immutable/assets/brave-search-icon.BThL22Ew.svg'
    },
    google: {
      name: 'Google',
      url: 'https://www.google.com/search?q=',
      logo: 'https://www.google.com/images/branding/googleg/1x/googleg_standard_color_128dp.png'
    }
  };

  const translations: Record<string, any> = {
    'es-ES': {
      subtitle: "Navegación ultra-segura mediante aislamiento remoto y endurecimiento de red.",
      placeholder: "Busca en la red de forma segura...",
      mcp_link: "Configurar Servidor MCP para Agentes de IA",
      cards: [
        {
          id: 'isolation',
          icon: <Shield size={28} />,
          title: "Aislamiento por Sesión (UUID)",
          description: "Cada conexión genera un entorno de ejecución único y totalmente estanco. Tus archivos y datos de navegación nunca se cruzan con otros usuarios.",
          className: "card-large"
        },
        {
          id: 'access',
          icon: <UserCheck size={28} />,
          title: "Acceso Restringido",
          description: "Capa de autenticación mediante API Key obligatoria. Solo usuarios autorizados pueden establecer túneles de control hacia el bastión.",
          className: "card-medium"
        },
        {
          id: 'ssrf',
          icon: <Globe size={28} />,
          title: "Protección Anti-SSRF",
          description: "Filtro dinámico de peticiones que bloquea el acceso a redes internas, metadatos de nube y servicios privados desde el navegador remoto.",
          className: "card-wide"
        },
        {
          id: 'resources',
          icon: <Server size={28} />,
          title: "Control de Recursos",
          description: "Gestión activa de sesiones concurrentes y límites de memoria para garantizar la disponibilidad y prevenir ataques de denegación de servicio.",
          className: "card-wide"
        },
        {
          id: 'encryption',
          icon: <Lock size={28} />,
          title: "Cifrado de Extremo a Extremo",
          description: "Todo el tráfico de control y el screencast viajan a través de túneles HTTPS/WSS cifrados con TLS de última generación.",
          className: "card-wide"
        },
        {
          id: 'downloads',
          icon: <Zap size={28} />,
          title: "Descargas Seguras",
          description: "Los archivos se capturan primero en el servidor en un área de staging aislada antes de ser transferidos de forma segura a tu equipo local.",
          className: "card-wide"
        }
      ],
      status: "BASTIÓN SEGURO Y OPERATIVO"
    },
    'en-US': {
      subtitle: "Ultra-secure browsing via remote isolation and network hardening.",
      placeholder: "Search the web securely...",
      mcp_link: "Configure MCP Server for AI Agents",
      cards: [
        {
          id: 'isolation',
          icon: <Shield size={28} />,
          title: "Session Isolation (UUID)",
          description: "Each connection generates a unique and completely sealed execution environment. Your files and browsing data never cross with other users.",
          className: "card-large"
        },
        {
          id: 'access',
          icon: <UserCheck size={28} />,
          title: "Restricted Access",
          description: "Mandatory API Key authentication layer. Only authorized users can establish control tunnels to the bastion.",
          className: "card-medium"
        },
        {
          id: 'ssrf',
          icon: <Globe size={28} />,
          title: "Anti-SSRF Protection",
          description: "Dynamic request filtering that blocks access to internal networks, cloud metadata, and private services from the remote browser.",
          className: "card-wide"
        },
        {
          id: 'resources',
          icon: <Server size={28} />,
          title: "Resource Control",
          description: "Active management of concurrent sessions and memory limits to ensure availability and prevent denial of service attacks.",
          className: "card-wide"
        },
        {
          id: 'encryption',
          icon: <Lock size={28} />,
          title: "End-to-End Encryption",
          description: "All control traffic and screencast travel through encrypted HTTPS/WSS tunnels with latest generation TLS.",
          className: "card-wide"
        },
        {
          id: 'downloads',
          icon: <Zap size={28} />,
          title: "Secure Downloads",
          description: "Files are first captured on the server in an isolated staging area before being securely transferred to your local machine.",
          className: "card-wide"
        }
      ],
      status: "BASTION SECURE AND OPERATIONAL"
    }
  };

  const t = useMemo(() => {
    return translations[language] || translations['es-ES'];
  }, [language]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim() && onNavigate) {
      const engineUrl = (engines as any)[activeEngine].url;
      onNavigate(engineUrl + encodeURIComponent(searchTerm.trim()));
    }
  };

  const toggleEngine = () => {
    const keys = Object.keys(engines);
    const currentIndex = keys.indexOf(activeEngine);
    const nextIndex = (currentIndex + 1) % keys.length;
    setActiveEngine(keys[nextIndex]);
  };

  return (
    <div className="welcome-container">
      <div className="dot-overlay"></div>
      <div className="welcome-content">
        <header className="hero-section">
          <img src="/bastion.png" className="welcome-hero-logo" alt="Bastion Logo" />
          <h1 className="welcome-logo">Bastion</h1>
          <p className="welcome-subtitle">{t.subtitle}</p>
          
          <div style={{ marginTop: '10px', display: 'flex', gap: '20px', justifyContent: 'center' }}>
            <button 
              onClick={onShowMCP} 
              style={{ 
                background: 'rgba(16, 185, 129, 0.1)', 
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#10b981',
                padding: '8px 16px',
                borderRadius: '20px',
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.2)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)'}
            >
              <Cpu size={16} /> {t.mcp_link}
            </button>
          </div>

          <div className="hero-search-container">
            <form className="hero-search-bar" onSubmit={handleSearch}>
              <button
                type="button"
                className="engine-selector"
                onClick={toggleEngine}
                title={`Switch Search Engine (Current: ${(engines as any)[activeEngine].name})`}
              >
                <img
                  src={(engines as any)[activeEngine].logo}
                  alt={(engines as any)[activeEngine].name}
                  className="engine-logo-img"
                />
              </button>
              <input
                type="text"
                placeholder={t.placeholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
              <button type="submit" className="search-submit">
                <ArrowRight size={20} />
              </button>
            </form>
            <div className="engine-labels">
              {Object.entries(engines).map(([key, engine]) => (
                <span key={key} className={activeEngine === key ? 'active' : ''} onClick={() => setActiveEngine(key)}>
                  {engine.name}
                </span>
              ))}
            </div>
          </div>
        </header>

        <div className="bento-grid">
          {t.cards.map((card: any) => (
            <div key={card.id} className={`bento-card ${card.className}`}>
              <div className="card-icon">
                {card.icon}
              </div>
              {card.id === 'isolation' && <div className="card-visual-glow"></div>}
              <h4>{card.title}</h4>
              <p>{card.description}</p>
            </div>
          ))}
        </div>

        <div className="status-bar">
          <div className="status-dot"></div>
          {t.status}
        </div>
      </div>
    </div>
  );
};

export default WelcomePage;