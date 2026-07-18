#!/usr/bin/env python3
"""
Data Labeling API and CLI Tool
Allows security analysts to review and label production data for model improvement.

Usage:
    # Start web interface
    python api/label_data.py serve
    
    # CLI labeling
    python api/label_data.py label --limit 10
    
    # Export labeled data
    python api/label_data.py export --output data/labeled_production.csv
    
    # Get statistics
    python api/label_data.py stats
"""
import os
import sys
import asyncio
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import click
from bson import ObjectId
from typing import Optional

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("IDS_DB", "idsdb")


def make_jsonable(doc):
    """Convert MongoDB doc to JSON-serializable format."""
    if isinstance(doc, dict):
        return {k: make_jsonable(v) for k, v in doc.items()}
    elif isinstance(doc, list):
        return [make_jsonable(i) for i in doc]
    elif isinstance(doc, ObjectId):
        return str(doc)
    elif isinstance(doc, datetime):
        return doc.isoformat()
    return doc


async def get_db():
    """Get database connection."""
    client = AsyncIOMotorClient(MONGO_URI)
    return client[DB_NAME]


@click.group()
def cli():
    """IDS Production Data Labeling Tool"""
    pass


@cli.command()
@click.option('--limit', default=10, help='Number of samples to label')
@click.option('--filter', default='unlabeled', type=click.Choice(['unlabeled', 'attacks', 'benign', 'all']), 
              help='Filter samples to label')
def label(limit, filter):
    """Interactive CLI labeling tool."""
    asyncio.run(label_interactive(limit, filter))


async def label_interactive(limit: int, filter_type: str):
    """Interactive labeling session."""
    db = await get_db()
    
    # Build query based on filter
    query = {}
    if filter_type == 'unlabeled':
        query['labeled'] = False
    elif filter_type == 'attacks':
        query['prediction.is_attack'] = True
        query['labeled'] = False
    elif filter_type == 'benign':
        query['prediction.is_attack'] = False
        query['labeled'] = False
    
    cursor = db.production_data.find(query).sort("collected_at", -1).limit(limit)
    samples = await cursor.to_list(length=limit)
    
    if not samples:
        click.echo(f"No {filter_type} samples found to label.")
        return
    
    click.echo(f"\n{'='*80}")
    click.echo(f"Starting labeling session: {len(samples)} samples")
    click.echo(f"{'='*80}\n")
    
    labeled_count = 0
    
    for idx, sample in enumerate(samples, 1):
        click.echo(f"\n--- Sample {idx}/{len(samples)} ---")
        click.echo(f"ID: {sample['_id']}")
        click.echo(f"Collected: {sample['collected_at']}")
        click.echo(f"Source IP: {sample['src_ip']}")
        click.echo(f"\nFeatures:")
        for k, v in sample['features'].items():
            click.echo(f"  {k}: {v}")
        
        click.echo(f"\nModel Prediction:")
        click.echo(f"  Attack: {sample['prediction']['is_attack']}")
        click.echo(f"  Score: {sample['prediction']['score']:.4f}")
        click.echo(f"  Attack Type: {sample['prediction'].get('attack_type', 'N/A')}")
        
        click.echo(f"\n{'='*80}")
        
        # Get analyst label
        while True:
            label_input = click.prompt(
                "\nTrue label? [a=attack, b=benign, s=skip, q=quit]",
                type=str,
                default='s'
            ).lower()
            
            if label_input == 'q':
                click.echo(f"\nLabeled {labeled_count} samples in this session.")
                return
            elif label_input == 's':
                break
            elif label_input in ['a', 'b']:
                true_label = 'attack' if label_input == 'a' else 'benign'
                
                # If attack, get attack type
                true_attack_type = None
                if true_label == 'attack':
                    click.echo("\nAttack Types:")
                    click.echo("  1. Port Scan")
                    click.echo("  2. DDoS")
                    click.echo("  3. Brute Force")
                    click.echo("  4. Bot")
                    click.echo("  5. Suspicious Activity")
                    click.echo("  6. Other")
                    
                    attack_type_map = {
                        '1': 'Port Scan',
                        '2': 'DDoS',
                        '3': 'Brute Force',
                        '4': 'Bot',
                        '5': 'Suspicious Activity',
                        '6': 'Other'
                    }
                    
                    attack_choice = click.prompt("Select attack type [1-6]", type=str, default='5')
                    true_attack_type = attack_type_map.get(attack_choice, 'Suspicious Activity')
                
                # Get confidence
                confidence_input = click.prompt(
                    "Confidence? [h=high, m=medium, l=low]",
                    type=str,
                    default='h'
                ).lower()
                confidence = {'h': 'high', 'm': 'medium', 'l': 'low'}.get(confidence_input, 'high')
                
                # Get notes (optional)
                notes = click.prompt("Notes (optional)", type=str, default='', show_default=False)
                
                # Update database
                update_doc = {
                    "labeled": True,
                    "true_label": true_label,
                    "true_attack_type": true_attack_type,
                    "labeled_by": os.getenv("USER", "analyst"),
                    "labeled_at": datetime.utcnow(),
                    "confidence": confidence,
                    "notes": notes if notes else None,
                }
                
                await db.production_data.update_one(
                    {"_id": sample["_id"]},
                    {"$set": update_doc}
                )
                
                labeled_count += 1
                click.echo(f"✓ Labeled as {true_label.upper()}")
                break
            else:
                click.echo("Invalid input. Use a/b/s/q")
    
    click.echo(f"\n{'='*80}")
    click.echo(f"Session complete! Labeled {labeled_count} samples.")
    click.echo(f"{'='*80}\n")


@cli.command()
@click.option('--output', default='data/labeled_production.csv', help='Output CSV file path')
@click.option('--min-confidence', type=click.Choice(['high', 'medium', 'low']), default='low',
              help='Minimum confidence level to include')
def export(output, min_confidence):
    """Export labeled data to CSV for model training."""
    asyncio.run(export_labeled_data(output, min_confidence))


async def export_labeled_data(output_path: str, min_confidence: str):
    """Export labeled production data to CSV."""
    import pandas as pd
    
    db = await get_db()
    
    # Confidence hierarchy
    confidence_levels = {'high': 3, 'medium': 2, 'low': 1}
    min_conf_value = confidence_levels[min_confidence]
    
    # Query labeled data with minimum confidence
    query = {
        "labeled": True,
        "confidence": {"$in": [k for k, v in confidence_levels.items() if v >= min_conf_value]}
    }
    
    cursor = db.production_data.find(query)
    samples = await cursor.to_list(length=None)
    
    if not samples:
        click.echo("No labeled data found to export.")
        return
    
    # Convert to DataFrame format
    rows = []
    for sample in samples:
        row = {
            'src_ip': sample['src_ip'],
            'total_packets': sample['features']['total_packets'],
            'total_bytes': sample['features']['total_bytes'],
            'duration': sample['features']['duration'],
            'pkts_per_sec': sample['features']['pkts_per_sec'],
            'bytes_per_sec': sample['features']['bytes_per_sec'],
            'syn_count': sample['features']['syn_count'],
            'unique_dst_ports': sample['features']['unique_dst_ports'],
            'label': sample['true_label'],
            'attack_type': sample.get('true_attack_type', ''),
            'model_prediction': sample['prediction']['is_attack'],
            'model_score': sample['prediction']['score'],
            'confidence': sample['confidence'],
            'labeled_by': sample['labeled_by'],
            'labeled_at': sample['labeled_at'].isoformat() if sample['labeled_at'] else '',
            'notes': sample.get('notes', ''),
        }
        rows.append(row)
    
    df = pd.DataFrame(rows)
    
    # Create output directory if needed
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # Save to CSV
    df.to_csv(output_path, index=False)
    
    click.echo(f"\n✓ Exported {len(df)} labeled samples to {output_path}")
    click.echo(f"\nBreakdown:")
    click.echo(f"  Attacks: {len(df[df['label'] == 'attack'])}")
    click.echo(f"  Benign: {len(df[df['label'] == 'benign'])}")
    click.echo(f"\nConfidence:")
    click.echo(df['confidence'].value_counts().to_string())
    
    # Calculate model accuracy on labeled data
    df['correct'] = ((df['label'] == 'attack') == df['model_prediction'])
    accuracy = df['correct'].mean() * 100
    click.echo(f"\nModel accuracy on labeled data: {accuracy:.2f}%")
    
    # Show confusion matrix
    tp = len(df[(df['label'] == 'attack') & (df['model_prediction'] == True)])
    fp = len(df[(df['label'] == 'benign') & (df['model_prediction'] == True)])
    tn = len(df[(df['label'] == 'benign') & (df['model_prediction'] == False)])
    fn = len(df[(df['label'] == 'attack') & (df['model_prediction'] == False)])
    
    click.echo(f"\nConfusion Matrix:")
    click.echo(f"  True Positives (Attacks correctly detected): {tp}")
    click.echo(f"  False Positives (Benign flagged as attack): {fp}")
    click.echo(f"  True Negatives (Benign correctly identified): {tn}")
    click.echo(f"  False Negatives (Attacks missed): {fn}")
    
    if tp + fp > 0:
        precision = tp / (tp + fp) * 100
        click.echo(f"\n  Precision: {precision:.2f}%")
    if tp + fn > 0:
        recall = tp / (tp + fn) * 100
        click.echo(f"  Recall: {recall:.2f}%")


@cli.command()
def stats():
    """Show statistics about production data collection."""
    asyncio.run(show_statistics())


async def show_statistics():
    """Display statistics about collected production data."""
    db = await get_db()
    
    # Total samples
    total = await db.production_data.count_documents({})
    labeled = await db.production_data.count_documents({"labeled": True})
    unlabeled = total - labeled
    
    # Predicted attacks vs benign
    predicted_attacks = await db.production_data.count_documents({"prediction.is_attack": True})
    predicted_benign = total - predicted_attacks
    
    # True labels (from analyst labeling)
    true_attacks = await db.production_data.count_documents({"true_label": "attack"})
    true_benign = await db.production_data.count_documents({"true_label": "benign"})
    
    click.echo(f"\n{'='*80}")
    click.echo("Production Data Collection Statistics")
    click.echo(f"{'='*80}\n")
    
    click.echo(f"Total Samples Collected: {total}")
    click.echo(f"  Labeled: {labeled} ({labeled/total*100:.1f}%)" if total > 0 else "  Labeled: 0")
    click.echo(f"  Unlabeled: {unlabeled} ({unlabeled/total*100:.1f}%)" if total > 0 else "  Unlabeled: 0")
    
    click.echo(f"\nModel Predictions:")
    click.echo(f"  Predicted Attacks: {predicted_attacks}")
    click.echo(f"  Predicted Benign: {predicted_benign}")
    
    if labeled > 0:
        click.echo(f"\nAnalyst Labels:")
        click.echo(f"  True Attacks: {true_attacks}")
        click.echo(f"  True Benign: {true_benign}")
        
        # Calculate agreement
        cursor = db.production_data.find({"labeled": True})
        samples = await cursor.to_list(length=None)
        
        if samples:
            correct = sum(1 for s in samples if 
                         (s['true_label'] == 'attack') == s['prediction']['is_attack'])
            agreement = correct / len(samples) * 100
            click.echo(f"\nModel-Analyst Agreement: {agreement:.2f}%")
            
            # Attack type breakdown
            attack_types = {}
            for s in samples:
                if s.get('true_attack_type'):
                    attack_types[s['true_attack_type']] = attack_types.get(s['true_attack_type'], 0) + 1
            
            if attack_types:
                click.echo(f"\nAttack Type Distribution:")
                for atype, count in sorted(attack_types.items(), key=lambda x: x[1], reverse=True):
                    click.echo(f"  {atype}: {count}")
            
            # Confidence breakdown
            confidence_breakdown = {}
            for s in samples:
                conf = s.get('confidence', 'unknown')
                confidence_breakdown[conf] = confidence_breakdown.get(conf, 0) + 1
            
            click.echo(f"\nConfidence Levels:")
            for conf, count in sorted(confidence_breakdown.items()):
                click.echo(f"  {conf.capitalize()}: {count}")
    
    # Recent activity
    recent_samples = await db.production_data.find().sort("collected_at", -1).limit(5).to_list(5)
    
    if recent_samples:
        click.echo(f"\nRecent Samples:")
        for sample in recent_samples:
            status = "✓ Labeled" if sample['labeled'] else "○ Unlabeled"
            prediction = "Attack" if sample['prediction']['is_attack'] else "Benign"
            click.echo(f"  {sample['collected_at'].strftime('%Y-%m-%d %H:%M:%S')} | "
                      f"{sample['src_ip']:15} | {prediction:10} | {status}")
    
    click.echo(f"\n{'='*80}\n")


@cli.command()
@click.option('--port', default=8001, help='Port to run web interface on')
def serve(port):
    """Start web-based labeling interface."""
    click.echo(f"Starting web labeling interface on http://localhost:{port}")
    click.echo("This will be implemented as a FastAPI web UI...")
    click.echo("\nFor now, use the CLI labeling tool: python api/label_data.py label")
    # TODO: Implement web interface with FastAPI + simple HTML/JS frontend


if __name__ == "__main__":
    cli()
