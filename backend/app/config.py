import os

# ---------------------------------------------------------------------------
# MongoDB Settings
# ---------------------------------------------------------------------------
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "lao_plate")
LOGS_COLLECTION = "plate_logs"

# ---------------------------------------------------------------------------
# Paths to AI Module
# ---------------------------------------------------------------------------
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT_DIR = os.path.dirname(BACKEND_DIR)
AI_DIR = os.path.join(ROOT_DIR, "AI")
