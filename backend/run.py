import uvicorn
import os

if __name__ == "__main__":
    # Get configuration from environment variables or defaults
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    reload = os.getenv("RELOAD", "True").lower() == "true"
    
    print(f"Launching Lao License Plate Backend Server on {host}:{port}...")
    
    # Run the uvicorn server pointing to app.main:app
    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=reload,
        log_level="info"
    )
