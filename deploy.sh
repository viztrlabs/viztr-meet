#!/bin/bash

# VizTR Meet Deployment Script
# Usage: ./deploy.sh [command]
# Commands: setup, pull, up, down, logs, status

REGISTRY="ghcr.io"
BACKEND_IMAGE="${REGISTRY}/viztrlabs/viztr-meet-backend:latest"
FRONTEND_IMAGE="${REGISTRY}/viztrlabs/viztr-meet-frontend:latest"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[deploy]${NC} $1"; }
warn() { echo -e "${YELLOW}[warn]${NC} $1"; }
err() { echo -e "${RED}[error]${NC} $1" >&2; }

cmd_setup() {
    log "Setting up VizTR Meet..."
    
    if ! command -v docker &>/dev/null; then
        err "Docker not found. Install: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    if ! docker compose version &>/dev/null; then
        warn "Using docker compose v1 (fallback)"
    fi

    if [ ! -f .env ]; then
        log "Creating .env from template..."
        cat > .env <<'EOF'
WS_AUTH_SECRET=change-me-in-production
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
DEEPL_API_KEY=
EOF
        warn "Edit .env with your API keys before starting"
    fi
    
    log "Setup complete. Edit .env, then run: ./deploy.sh up"
}

cmd_pull() {
    log "Pulling latest images..."
    docker compose pull 2>/dev/null || docker-compose pull
}

cmd_up() {
    log "Starting services..."
    docker compose up -d 2>/dev/null || docker-compose up -d
    log "Services started"
    cmd_status
}

cmd_down() {
    log "Stopping services..."
    docker compose down 2>/dev/null || docker-compose down
    log "Services stopped"
}

cmd_logs() {
    docker compose logs -f 2>/dev/null || docker-compose logs -f
}

cmd_status() {
    echo ""
    log "Service Status:"
    docker compose ps 2>/dev/null || docker-compose ps
    echo ""
    log "Endpoints:"
    echo "  Frontend:    http://localhost:3000"
    echo "  Backend API: http://localhost:8000"
    echo "  Prometheus:  http://localhost:9090"
    echo "  Grafana:     http://localhost:3001"
}

case "${1:-setup}" in
    setup)  cmd_setup ;;
    pull)   cmd_pull ;;
    up)     cmd_up ;;
    down)   cmd_down ;;
    logs)   cmd_logs ;;
    status) cmd_status ;;
    *)      echo "Usage: $0 {setup|pull|up|down|logs|status}" ;;
esac
