FROM node:20

# Install dependencies for Playwright and Puppeteer, plus Chromium browser
RUN apt-get update && apt-get install -y \
    chromium \
    libgbm-dev \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    libwayland-client0 \
    libwayland-cursor0 \
    libwayland-egl1 \
    libxshmfence1 \
    openssl \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set env for Puppeteer to use the system Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Playwright browsers path
ENV PLAYWRIGHT_BROWSERS_PATH=/app/pw-browsers

WORKDIR /app

# Copy package files first for caching
COPY package.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/

# Install Client Deps
WORKDIR /app/client
RUN npm install

# Install Server Deps
WORKDIR /app/server
RUN npm install
# Install Playwright's own Chromium
RUN npx playwright install chromium

# Copy Source Code
WORKDIR /app
COPY client ./client
COPY server ./server

# Build Client
WORKDIR /app/client
RUN npm run build

# Build Server
WORKDIR /app/server
RUN npm run build

# Expose Ports
EXPOSE 112
EXPOSE 3001

# Start Server
CMD ["npm", "run", "start:combined"]
