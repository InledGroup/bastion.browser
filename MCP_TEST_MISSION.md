# 🚀 Misión: Validación de Bastion MCP & Comet

Has sido reiniciado tras la instalación del servidor MCP en Bastion Browser. Tu objetivo es probar la integración y asegurar que el sistema de navegación dual funciona.

## 📌 ¿Qué es este proyecto?
Es un navegador ultra-seguro (Bastion) que ahora expone sus capacidades a través del **Model Context Protocol (MCP)**. 
- **Puerto UI Web:** 112 (HTTPS/WSS)
- **Puerto MCP (SSE):** 3001 (`/sse`)
- **Navegador compartido:** La IA y el humano usan el mismo proceso de Chromium.

## 🧪 Tareas de Prueba

### 1. Conexión MCP
Intenta conectar a este servidor usando tu configuración de MCP. El endpoint es:
`http://localhost:3001/sse`

### 2. Prueba de Herramientas
Ejecuta una secuencia de comandos para validar la funcionalidad:
1. `browser_navigate(url: "https://www.google.com")`
2. `browser_snapshot()`
3. `browser_type(ref: "input[name='q']", text: "Bastion Browser MCP", submit: true)`

### 3. Validación de "Comet" (Feedback Visual)
Mientras realizas las pruebas anteriores, si tienes acceso a la interfaz web (o puedes pedirle al usuario que mire), verifica que:
- Aparece un **marco degradado verde** rodeando el viewport.
- El favicon de la pestaña activa es reemplazado por un **punto verde latente**.
- Las pestañas creadas por ti tienen el prefijo `[AI]`.

## 🛠️ Solución de Problemas
Si el navegador no arranca, recuerda que Puppeteer está configurado para usar el Chromium del sistema en `/usr/bin/chromium` dentro del contenedor Docker.

---
**¡Suerte! El Bastión está bajo tu control.**
