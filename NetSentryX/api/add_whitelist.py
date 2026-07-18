# api/add_whitelist.py
import os
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("IDS_DB", "idsdb")

async def run(ip, note=""):
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]
    res = await db.whitelist.update_one({"ip": ip}, {"$set": {"note": note, "created_at": datetime.utcnow()}}, upsert=True)
    print("Done. upserted_id:", res.upserted_id)
    client.close()

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python api/add_whitelist.py <ip> [note]")
        sys.exit(1)
    ip = sys.argv[1]
    note = sys.argv[2] if len(sys.argv) > 2 else ""
    asyncio.run(run(ip, note))
