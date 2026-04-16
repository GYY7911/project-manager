#!/bin/bash
set -e

# ==========================================
#  Offline Bundle Builder
#  在联网环境运行，生成离线部署包
# ==========================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_DIR="$PROJECT_DIR/offline-bundle"

echo ""
echo "========================================"
echo "  Project Manager - Offline Bundle Builder"
echo "========================================"
echo ""

# Step 1: Create output directory
echo "[1/6] Creating output directory..."
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR/images"

# Step 2: Pull base images
echo "[2/6] Pulling base images..."
docker pull postgres:16-alpine
docker pull redis:7-alpine
docker pull node:20-alpine

# Step 3: Build application images
echo "[3/6] Building pm-server image..."
docker build -f Dockerfile.server -t pm-server:latest "$PROJECT_DIR"

echo "  Building pm-web image..."
docker build -f Dockerfile.web -t pm-web:latest "$PROJECT_DIR"

# Step 4: Save images to tar files
echo "[4/6] Saving images to tar files..."
echo "  Saving postgres:16-alpine..."
docker save postgres:16-alpine -o "$OUTPUT_DIR/images/postgres.tar"
echo "  Saving redis:7-alpine..."
docker save redis:7-alpine -o "$OUTPUT_DIR/images/redis.tar"
echo "  Saving pm-server:latest..."
docker save pm-server:latest -o "$OUTPUT_DIR/images/pm-server.tar"
echo "  Saving pm-web:latest..."
docker save pm-web:latest -o "$OUTPUT_DIR/images/pm-web.tar"

# Step 5: Copy deployment files
echo "[5/6] Copying deployment files..."
cp "$PROJECT_DIR/docker-compose.prod.yml" "$OUTPUT_DIR/"
cp "$PROJECT_DIR/scripts/load-and-start.sh" "$OUTPUT_DIR/"
chmod +x "$OUTPUT_DIR/load-and-start.sh"

# Step 6: Summary
echo "[6/6] Done!"
TOTAL_SIZE=$(du -sh "$OUTPUT_DIR" | cut -f1)

echo ""
echo "========================================"
echo "  Build complete!"
echo "========================================"
echo ""
echo "  Output:  $OUTPUT_DIR"
echo "  Size:    $TOTAL_SIZE"
echo ""
echo "  Images:"
ls -lh "$OUTPUT_DIR/images/"
echo ""
echo "  To deploy offline:"
echo "    1. Copy offline-bundle/ to target machine"
echo "    2. Run: bash load-and-start.sh"
echo ""
