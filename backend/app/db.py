from motor.motor_asyncio import AsyncIOMotorClient
from . import config

class MongoDB:
    client: AsyncIOMotorClient = None
    db = None

db_instance = MongoDB()

def get_database():
    """Return the database client instance."""
    return db_instance.db

def connect_db():
    """Connect to MongoDB."""
    db_instance.client = AsyncIOMotorClient(config.MONGODB_URL)
    db_instance.db = db_instance.client[config.DATABASE_NAME]
    print(f"Connected to MongoDB at {config.MONGODB_URL}, using database '{config.DATABASE_NAME}'")

def close_db():
    """Close MongoDB connection."""
    if db_instance.client:
        db_instance.client.close()
        print("MongoDB connection closed.")
