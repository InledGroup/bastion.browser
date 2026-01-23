FROM node:20-slim

# Install dependencies for Chromium (Puppeteer)
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
    openssl \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set env to use installed chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Add a non-privileged user
RUN groupadd -r pptruser && useradd -r -g pptruser -G audio,video pptruser \
    && mkdir -p /home/pptruser/Downloads /home/pptruser/Uploads \
    && chown -R pptruser:pptruser /home/pptruser

WORKDIR /app

# Copy package files first for caching
COPY package.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/

# Install root dependencies
# RUN npm install

# Install Client Deps
WORKDIR /app/client
RUN npm install

# Install Server Deps
WORKDIR /app/server
RUN npm install

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

# Ensure pptruser owns the app directory
RUN chown -R pptruser:pptruser /app

# Run as non-privileged user
USER pptruser

# Expose Port
EXPOSE 112

# Explicitly set workdir for the start command
WORKDIR /app/server

# Start Server
CMD ["npm", "start"]

