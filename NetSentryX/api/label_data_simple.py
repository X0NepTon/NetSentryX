#!/usr/bin/env python3
"""
Simple API-based production data tools.
Works around MongoDB SSL connection issues by using the API.
"""
import os
import requests
import click
import json
from datetime import datetime

API_URL = os.getenv("API_URL", "http://127.0.0.1:8000")


@click.group()
def cli():
    """Production Data Management (API-based)"""
    pass


@cli.command()
def stats():
    """Show production data statistics."""
    try:
        response = requests.get(f"{API_URL}/production_data/stats")
        response.raise_for_status()
        data = response.json()

        print("\n" + "=" * 80)
        print("Production Data Collection Statistics")
        print("=" * 80 + "\n")

        print(f"Total Samples: {data['total']}")
        print(
            f"  Labeled: {data['labeled']} ({data['labeled'] / data['total'] * 100:.1f}%)"
            if data["total"] > 0
            else "  Labeled: 0"
        )
        print(
            f"  Unlabeled: {data['unlabeled']} ({data['unlabeled'] / data['total'] * 100:.1f}%)"
            if data["total"] > 0
            else "  Unlabeled: 0"
        )

        print("\nModel Predictions:")
        print(f"  Predicted Attacks: {data['predicted_attacks']}")
        print(f"  Predicted Benign: {data['predicted_benign']}")

        if data["labeled"] > 0:
            print("\nAnalyst Labels:")
            print(f"  True Attacks: {data['true_attacks']}")
            print(f"  True Benign: {data['true_benign']}")
            print("\n  Agreement: (use full tool for detailed metrics)")

        if data["recent_samples"]:
            print("\nRecent Samples:")
            for sample in data["recent_samples"][:5]:
                status = "✓" if sample["labeled"] else "○"
                prediction = "Attack" if sample["prediction"]["is_attack"] else "Benign"
                collected = sample["collected_at"][:19]
                print(f"  {status} {collected} | {sample['src_ip']:15} | {prediction}")

        print("\n" + "=" * 80 + "\n")

    except Exception as e:
        print(f"Error: {e}")
        print("Make sure API is running: uvicorn api.app:app --reload")


@cli.command()
@click.option("--output", default="data/labeled_production.csv", help="Output file")
@click.option(
    "--min-confidence",
    default="medium",
    type=click.Choice(["high", "medium", "low"]),
)
def export(output, min_confidence):
    """Export labeled data to CSV."""
    try:
        response = requests.get(
            f"{API_URL}/production_data/export",
            params={"min_confidence": min_confidence},
        )
        response.raise_for_status()

        os.makedirs(os.path.dirname(output), exist_ok=True)
        with open(output, "w") as f:
            f.write(response.text)

        lines = response.text.count("\n") - 1

        print(f"\n✓ Exported {lines} labeled samples to {output}")
        print(f"  Min confidence: {min_confidence}")
        print("\nNext step: Retrain model")
        print(f"  python models/retrain_with_production_data.py --production-data {output}")

    except Exception as e:
        print(f"Error: {e}")


@cli.command()
def web():
    """Open web labeling interface."""
    print(f"\n📊 Production Data Statistics: {API_URL}/production_data/stats")
    print(f"📥 Export CSV: {API_URL}/production_data/export?min_confidence=medium")
    print("\n💡 Use the dashboard Analytics page for web-based interface")
    print("   Or use CLI: python api/label_data_simple.py stats")


if __name__ == "__main__":
    cli()