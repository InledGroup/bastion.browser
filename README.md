# Bastion Browser: Remote Isolation Engine

<p align="center">
  <img src="client/public/bastion.png" alt="Bastion Browser Logo" width="200">
</p>

[![License: GNU GPLv3.0](https://img.shields.io/badge/License-GNU-yellow.svg)](https://opensource.org/licenses/GPL-3.0)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)
[![React](https://img.shields.io/badge/React-18-61dafb.svg)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-Backend-339933.svg)](https://nodejs.org/)

**Bastion Browser** is an advanced **Remote Browser Isolation (RBI)** solution designed to provide an impenetrable security layer between the user and threats from the public web. By running browsing sessions in an isolated container on the server and streaming only an interactive visual feed, Bastion eliminates the risk of malicious code execution directly on the local machine.

---

## 🚀 Core Functionality

Bastion transforms web browsing into a secure, interactive service:

- **Real-Time Interactive Browsing**: Full keyboard and mouse control over a remote Chromium instance.
- **High-Speed Screencast**: Smooth transmission via optimized WebSockets.
- **Tab Management**: Dynamic multi-tab support within a sealed environment.
- **Search Engine Integration**: Quick access to Startpage, Brave, and Google with enhanced privacy.
- **Secure Downloads**: Staging system that intercepts files on the server before final local transfer.
- **Secure Uploads**: Support for uploading files from the local machine to the remote browser session.

---

## 🛡️ Integrated Security (Iron Bastion)

Security is not an option; it is the architecture upon which Bastion is built:

### 1. Session Isolation (UUID)
Each user connection generates a completely unique and separate browser context (Incognito Context). There is no data persistence between sessions and no information leakage between different users.

### 2. Anti-SSRF Protection (Server-Side Request Forgery)
A dynamic validation engine analyzes every URL before navigation. It proactively blocks access to:
- Internal networks (127.0.0.1, 192.168.x.x, etc.)
- Cloud provider metadata (AWS, Google Cloud, Azure).
- Private ports and services within the server ecosystem.

### 3. API Key Authentication
Mandatory access control layer for all WSS tunnels and API endpoints. Only clients possessing the secret key can interact with the navigation engine.

### 4. End-to-End Encryption
All traffic, from mouse movements to browser frames, travels through **HTTPS/WSS** tunnels protected by TLS certificates.

### 5. Resource and DoS Control
Strict limitation of:
- Total concurrent sessions.
- Maximum number of tabs per session.
- Timeouts for downloads and connections.

---

## 🛠️ Technological Stack

- **Frontend**: React 18, Vite, TypeScript, Lucide Icons.
- **Backend**: Node.js, Express, WebSocket (ws).
- **Browser Control**: Puppeteer Extra with **Stealth Plugin** (to avoid bot detection).
- **Security**: Helmet.js, Crypto Encryption, SSRF URL Validation.
- **Containerization**: Docker & Docker Compose.

---

## 📦 Installation & Deployment

### 🏠 CasaOS Deployment (One-liner)
If you are using CasaOS, you can install Bastion Browser and have it show up in your dashboard with a single command:
```bash
git clone https://github.com/InledGroup/bastion.browser.git && cd bastion.browser && sudo docker compose up -d --build
```

### 🐳 Docker Compose (Standard)
1. **Clone the repository:**
   ```bash
   git clone https://github.com/InledGroup/bastion.browser.git
   cd bastion.browser
   ```
2. **Configure environment (Optional):**
   Edit the `.env` file to set your `API_KEY` and `PORT`.
3. **Start the application:**
   ```bash
   sudo docker compose up -d --build
   ```

The service will be available at `https://localhost:112` (or your configured port).

### 🛠️ Manual Build (Local)
```bash
# Clone the repository
git clone https://github.com/InledGroup/bastion.browser.git
cd bastion.browser

# Build and run using the helper script
chmod +x build_and_run.sh
./build_and_run.sh
```

---

## 🗺️ Project Orientation

Bastion is oriented towards:
- **Threat Research**: Analyzing suspicious URLs without risk to the local machine.
- **Extreme Privacy**: Browsing from a clean server IP with no local traces.
- **Corporate Environments**: Providing a secure gateway for uncategorized websites.

---

## ⚖️ Disclaimer

This software is designed for educational and defensive security purposes. Use of this tool for malicious activities is strictly prohibited. The author is not responsible for any misuse of the technology presented here.
If you decide to use this software for illegal purposes, it is your problem.
Furthermore, the author is not responsible for any data loss that may occur through the use of this tool or security issues that may arise from its use. You are responsible for auditing whether this tool and its code fit your needs and the threat you wish to mitigate.

---
<p align="center">Developed with ❤️ by <a href="https://jaimegh.com">JaimeGH</a>, from <a href="https://inled.es">Inled Group</a></p>
