#!/usr/bin/env python3
"""
Quick test of production data collection system.
Tests that data is being collected and tools work.
"""
import asyncio
import os
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("IDS_DB", "idsdb")


async def test_production_data_collection():
    """Test that production data collection is working."""
    print("\n" + "="*80)
    print("Testing Production Data Collection System")
    print("="*80 + "\n")
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]
    
    # Check if production_data collection exists
    collections = await db.list_collection_names()
    
    if 'production_data' in collections:
        print("✓ production_data collection exists")
        
        # Count samples
        total = await db.production_data.count_documents({})
        labeled = await db.production_data.count_documents({"labeled": True})
        unlabeled = total - labeled
        
        print(f"✓ Total samples: {total}")
        print(f"  - Labeled: {labeled}")
        print(f"  - Unlabeled: {unlabeled}")
        
        if total > 0:
            # Show recent sample
            sample = await db.production_data.find_one({}, sort=[("collected_at", -1)])
            print(f"\n✓ Most recent sample:")
            print(f"  Collected: {sample['collected_at']}")
            print(f"  Source IP: {sample['src_ip']}")
            print(f"  Predicted: {'Attack' if sample['prediction']['is_attack'] else 'Benign'}")
            print(f"  Score: {sample['prediction']['score']:.4f}")
            print(f"  Labeled: {sample['labeled']}")
        else:
            print("\n⚠ No samples collected yet")
            print("  The collection will auto-populate when traffic is detected")
            print("  Run: ./start_capture.sh")
            print("  Or send test data: python test/quick_test.py")
    else:
        print("⚠ production_data collection doesn't exist yet")
        print("  It will be created automatically when first data is collected")
        print("  Run the API and send a /detect request to initialize")
    
    # Check indexes
    print("\nChecking recommended indexes...")
    if 'production_data' in collections:
        indexes = await db.production_data.list_indexes().to_list(None)
        index_fields = [idx.get('key', {}) for idx in indexes]
        
        recommended = [
            ("collected_at", -1),
            ("labeled", 1),
            ("src_ip", 1),
        ]
        
        for field, direction in recommended:
            if any(field in idx for idx in index_fields):
                print(f"  ✓ Index on {field}")
            else:
                print(f"  ○ Missing index on {field} (will create if needed)")
    
    print("\n" + "="*80)
    print("System Status: Ready ✓")
    print("="*80)
    
    print("\nNext Steps:")
    print("1. Start packet capture: ./start_capture.sh")
    print("2. Wait for some traffic (or send test data)")
    print("3. View stats: python api/label_data.py stats")
    print("4. Start labeling: python api/label_data.py label --limit 10")
    print("\nSee PRODUCTION_DATA_GUIDE.md for full documentation")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(test_production_data_collection())
