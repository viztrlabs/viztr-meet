import logging
import time
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Request, Response
from fastapi.responses import FileResponse
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
from viztrmeet import __version__
from viztrmeet.routes import audio, health

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("viztrmeet")

REQUEST_COUNT = Counter(
    "viztr_http_requests_total",
    "Total HTTP requests",
    ["method", "endpoint", "status"],
)
REQUEST_LATENCY = Histogram(
    "viztr_http_request_duration_seconds",
    "HTTP request latency",
    ["method", "endpoint"],
)
ACTIVE_SESSIONS = Gauge(
    "viztr_active_sessions",
    "Currently active WebSocket sessions",
)
AUDIO_CHUNKS = Counter(
    "viztr_audio_chunks_total",
    "Total audio chunks processed",
    ["event"],
)
TRANSCRIPTION_DURATION = Histogram(
    "viztr_transcription_duration_seconds",
    "Time spent in transcription",
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0],
)
TRANSLATION_DURATION = Histogram(
    "viztr_translation_duration_seconds",
    "Time spent in translation",
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0],
)
TTS_DURATION = Histogram(
    "viztr_tts_duration_seconds",
    "Time spent in TTS synthesis",
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0],
)
ERRORS = Counter(
    "viztr_errors_total",
    "Total errors",
    ["component", "error_type"],
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting VizTR Meet v%s", __version__)
    yield
    logger.info("Shutting down VizTR Meet")


app = FastAPI(
    title="VizTR Meet",
    description="Real-time speech translation pipeline with VAD, noise filtering, and auth",
    version=__version__,
    lifespan=lifespan,
)


@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration = time.time() - start

    REQUEST_COUNT.labels(
        method=request.method,
        endpoint=request.url.path,
        status=response.status_code,
    ).inc()
    REQUEST_LATENCY.labels(
        method=request.method,
        endpoint=request.url.path,
    ).observe(duration)

    return response


@app.get("/metrics")
async def metrics():
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


app.include_router(audio.router, prefix="/audio")
app.include_router(health.router)


@app.get("/")
async def root():
    return {"status": "VizTR Meet Running", "version": __version__}


@app.get("/app")
async def frontend():
    html = Path(__file__).resolve().parent.parent.parent / "frontend" / "index.html"
    if html.exists():
        return FileResponse(str(html))
    return {"error": "frontend not found"}


def record_audio_event(event: str):
    AUDIO_CHUNKS.labels(event=event).inc()


def record_transcription_time(seconds: float):
    TRANSCRIPTION_DURATION.observe(seconds)


def record_translation_time(seconds: float):
    TRANSLATION_DURATION.observe(seconds)


def record_tts_time(seconds: float):
    TTS_DURATION.observe(seconds)


def record_error(component: str, error_type: str):
    ERRORS.labels(component=component, error_type=error_type).inc()


def set_active_sessions(count: int):
    ACTIVE_SESSIONS.set(count)