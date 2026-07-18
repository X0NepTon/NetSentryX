# api/query_alerts.py
import os
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from pprint import pprint

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("IDS_DB", "idsdb")

async def run(limit=10):
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]
    cursor = db.alerts.find().sort("detected_at", -1).limit(limit)
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        pprint(doc)
    client.close()

if __name__ == "__main__":
    import sys
    l = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    asyncio.run(run(l))
