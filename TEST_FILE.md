# VizTR Meet - Real-time Voice Translation Platform

## Overview
VizTR Meet is a real-time audio translation platform built with FastAPI and WebSocket technology.
It provides provider-agnostic ASR (Automatic Speech Recognition), Translation, and TTS (Text-to-Speech)
with session-scoped state management and real-time streaming capabilities.

## What's Different from VoxTR

1. **No global mutable buffer.** The original design used a module-level `buffer = b""`
   shared across every connection, causing two simultaneous meetings to corrupt each other's audio.
   **Fixed:** `VoxTRSession` in `src/viztrmeet/core/session.py` holds buffer state per-connection.

2. **Model loaded once, not per-request.** Whisper model loaded at module import time,
   shared read-only across sessions. Same pattern applied to silero-vad.

3. **Room/participant identity on the WebSocket.** The original `/audio/stream` endpoint had no way
   to know which meeting a chunk belonged to. Fixed via `room_id` / `participant_id` / `source_lang` / `target_lang` query parameters.

4. **Actual provider failover, not a bare try/except.** `services/registry.py` fails over only
   the specific stage that broke (e.g., ASR), logs why, and keeps the rest of the pipeline on its original provider.

5. **Context-aware translation prompt**, not literal word-for-word — per the "conversation mode"
   suggestion in the review doc.

6. **Interrupt handling implemented**, not just described: `cancel_tts_if_playing()` cancels the
   running TTS `asyncio.Task` when new incoming speech arrives.

## Three Critical Improvements Implemented

1. **VAD-based buffering** — Replaced fixed byte-count window with silero-vad speech/silence detection,
   releases on pause OR safety ceiling.
2. **Noise filtering** — Added `noisereduce`-based audio preprocessing before the buffer.
3. **WebSocket authentication** — JWT token authentication before accepting WebSocket connections.

## Key Features

- **Provider-Agnostic Architecture** — Swap ASR, Translation, TTS providers easily
- **Real-time Processing** — Sub-3s end-to-end latency
- **Session Isolation** — Per-connection state management prevents cross-talk
- **Enterprise Security** — JWT authentication and authorization
- **Audio Quality** — VAD for accurate speech detection, noise reduction
- **Full Test Coverage** — pytest backend, Vitest frontend, GitHub Actions CI
- **Production Ready** — Docker, docker-compose, Prometheus/Grafana monitoring

## Project Structure

```
viztr-meet/
├── src/
│   └── viztrmeet/
│       ├── core/           # Core components
│       │   ├── config.py   # Configuration (Pydantic Settings)
│       │   ├── session.py  # Session management with VAD
│       │   └── pipeline.py # Processing pipeline
│       ├── services/       # Provider interfaces
│       │   ├── audio_preprocessing.py # Noise filtering
│       │   └── registry.py # Failover registry
│       ├── routes/         # HTTP/WS endpoints
│       │   ├── audio.py   # WebSocket + token endpoint
│       │   └── health.py  # Health check
│       └── main.py        # FastAPI entrypoint
├── frontend/               # Vite + React + TypeScript
│   ├── src/
│   │   ├── App.tsx        # Main app with WebSocket client
│   │   ├── main.tsx       # Entry point
│   │   ├── index.css      # TailwindCSS
│   │   └── __tests__/     # Frontend tests
│   ├── Dockerfile         # Multi-stage build
│   ├── nginx.conf         # Reverse proxy for API
│   └── package.json
├── tests/                  # Backend tests (pyt