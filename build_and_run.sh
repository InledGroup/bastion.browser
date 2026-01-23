#!/bin/bash
set -e

echo "🔍 Realizando comprobaciones de compilación temprana..."

echo "📦 Compilando CLIENTE..."
cd client && npm run build
cd ..

echo "📦 Compilando SERVIDOR..."
cd server && npm run build
cd ..

echo "✅ Compilación local exitosa. Iniciando proceso Docker..."

echo "Stopping and removing old containers..."
docker stop rbi-instance 2>/dev/null || true
docker rm rbi-instance 2>/dev/null || true

echo "Removing old image to force rebuild..."
docker rmi rbi-browser 2>/dev/null || true

echo "Building Docker image (no cache)..."
docker build --no-cache -t rbi-browser .

echo "Starting RBI Browser on port 112..."
docker run --init -p 112:112 --shm-size=1gb --name rbi-instance --rm rbi-browser
