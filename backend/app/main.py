from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from .db import connect_db, close_db
from .routers import scan
from .services.ai_service import AIService
import time

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup actions
    print("--> Starting Lao License Plate Backend Server...")
    start_time = time.time()
    
    # 1. Connect to MongoDB
    connect_db()
    
    # 2. Warm up YOLO models inside the AI engine (preloads weights into memory/GPU)
    try:
        AIService.get_pipeline()
        print(f"--> YOLO models warmed up successfully in {time.time() - start_time:.2f} seconds.")
    except Exception as e:
        print(f"--> [WARNING] Failed to preload YOLO models on startup: {e}")
        
    yield
    
    # Shutdown actions
    print("--> Stopping Lao License Plate Backend Server...")
    close_db()

app = FastAPI(
    title="Lao License Plate Detection & OCR Unified API",
    description="Asynchronous API for license plate bounding box location, OCR text parsing, and HSV color analysis.",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for ReactJS Frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to specific origins (e.g. ["http://localhost:5173"])
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.staticfiles import StaticFiles
import os

# Create static directory structure for saving plate crops
static_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static")
os.makedirs(os.path.join(static_dir, "plates"), exist_ok=True)

# Mount static folder for fast local image rendering
app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Register routers
app.include_router(scan.router)

@app.get("/")
def home():
    """Health check index endpoint."""
    return {
        "status": "online",
        "service": "Lao License Plate OCR & Color Classification API",
        "docs": "/docs",
        "redoc": "/redoc"
    }
