import sys
import os
from .. import config

# Add the AI folder to the system path before importing src modules
if config.AI_DIR not in sys.path:
    sys.path.insert(0, config.AI_DIR)

try:
    from src.pipeline import LicensePlatePipeline
except ImportError as e:
    print(f"Error importing LicensePlatePipeline from AI path '{config.AI_DIR}': {e}")
    raise e

class AIService:
    _instance = None

    @classmethod
    def get_pipeline(cls) -> LicensePlatePipeline:
        """Singleton instance provider for LicensePlatePipeline to avoid reloading YOLO weights."""
        if cls._instance is None:
            print("--> Initializing YOLOv8 LicensePlatePipeline Engine in backend...")
            cls._instance = LicensePlatePipeline()
        return cls._instance
