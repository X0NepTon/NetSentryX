#!/usr/bin/env python3
"""
Retrain Model with Production Data
Combines original CIC-IDS2017 dataset with labeled production data to improve model accuracy.

Usage:
    python models/retrain_with_production_data.py
    
    # With custom parameters
    python models/retrain_with_production_data.py --min-confidence high --test-size 0.2
    
Features:
- Merges CIC dataset with production-labeled data
- Maintains class balance using SMOTE if needed
- Compares new model vs old model performance
- Saves new model with version tracking
"""
import os
import sys
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score
from sklearn.preprocessing import StandardScaler
from imblearn.over_sampling import SMOTE
import joblib
import json
from datetime import datetime
import click

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, PROJECT_ROOT)


FEATURE_COLS = [
    "total_packets",
    "total_bytes", 
    "duration",
    "pkts_per_sec",
    "bytes_per_sec",
    "syn_count",
    "unique_dst_ports"
]


def load_cic_dataset():
    """Load and combine CIC-IDS2017 CSV files."""
    cic_dir = os.path.join(PROJECT_ROOT, "data", "cic_raw")
    
    if not os.path.exists(cic_dir):
        click.echo(f"Warning: CIC dataset directory not found: {cic_dir}")
        return None
    
    csv_files = [f for f in os.listdir(cic_dir) if f.endswith('.csv')]
    
    if not csv_files:
        click.echo(f"Warning: No CSV files found in {cic_dir}")
        return None
    
    dfs = []
    for csv_file in csv_files:
        path = os.path.join(cic_dir, csv_file)
        click.echo(f"Loading {csv_file}...")
        df = pd.read_csv(path)
        dfs.append(df)
    
    combined = pd.concat(dfs, ignore_index=True)
    click.echo(f"Loaded {len(combined)} samples from CIC-IDS2017 dataset")
    
    return combined


def prepare_cic_data(df):
    """Prepare CIC dataset to match our feature format."""
    # Map CIC columns to our feature columns
    # This is a simplified mapping - adjust based on actual CIC column names
    
    # Common CIC column mappings (may vary by dataset version)
    cic_mapping = {
        'Total Fwd Packets': 'total_packets',
        'Total Length of Fwd Packets': 'total_bytes',
        'Flow Duration': 'duration',
        'Flow Packets/s': 'pkts_per_sec',
        'Flow Bytes/s': 'bytes_per_sec',
        'SYN Flag Count': 'syn_count',
        'Destination Port': 'unique_dst_ports'
    }
    
    # Try to find matching columns
    available_cols = df.columns.tolist()
    
    # Create feature DataFrame
    feature_df = pd.DataFrame()
    
    for cic_col, our_col in cic_mapping.items():
        if cic_col in available_cols:
            feature_df[our_col] = df[cic_col]
        else:
            # Try to find similar column
            similar = [c for c in available_cols if our_col.replace('_', '').lower() in c.lower()]
            if similar:
                feature_df[our_col] = df[similar[0]]
            else:
                click.echo(f"Warning: Could not find column for {our_col}")
                feature_df[our_col] = 0
    
    # Extract label
    label_col = 'Label' if 'Label' in available_cols else ' Label'
    if label_col in available_cols:
        labels = df[label_col].apply(lambda x: 0 if str(x).upper() == 'BENIGN' else 1)
    else:
        click.echo("Warning: No label column found, using all as benign")
        labels = pd.Series([0] * len(df))
    
    return feature_df, labels


def load_production_data(csv_path, min_confidence='low'):
    """Load labeled production data from CSV."""
    if not os.path.exists(csv_path):
        click.echo(f"Warning: Production data file not found: {csv_path}")
        return None, None
    
    df = pd.read_csv(csv_path)
    
    # Filter by confidence
    confidence_levels = {'high': 3, 'medium': 2, 'low': 1}
    min_conf_value = confidence_levels[min_confidence]
    
    df = df[df['confidence'].map(lambda x: confidence_levels.get(x, 0) >= min_conf_value)]
    
    click.echo(f"Loaded {len(df)} labeled production samples (min confidence: {min_confidence})")
    
    # Extract features
    feature_df = df[FEATURE_COLS]
    
    # Convert labels to binary
    labels = df['label'].apply(lambda x: 1 if x == 'attack' else 0)
    
    return feature_df, labels


@click.command()
@click.option('--production-data', default='data/labeled_production.csv', 
              help='Path to labeled production data CSV')
@click.option('--min-confidence', type=click.Choice(['high', 'medium', 'low']), default='medium',
              help='Minimum confidence level for production data')
@click.option('--test-size', default=0.2, help='Test set proportion')
@click.option('--use-smote', is_flag=True, help='Use SMOTE for class balancing')
@click.option('--n-estimators', default=100, help='Number of trees in random forest')
@click.option('--output-model', default='models/saved_models/rf_model_v2.joblib',
              help='Output path for new model')
def retrain(production_data, min_confidence, test_size, use_smote, n_estimators, output_model):
    """Retrain model with production data."""
    
    click.echo(f"\n{'='*80}")
    click.echo("Model Retraining with Production Data")
    click.echo(f"{'='*80}\n")
    
    # Load datasets
    cic_df = load_cic_dataset()
    prod_features, prod_labels = load_production_data(production_data, min_confidence)
    
    # Combine datasets
    if cic_df is not None:
        cic_features, cic_labels = prepare_cic_data(cic_df)
        
        if prod_features is not None:
            # Combine
            X = pd.concat([cic_features, prod_features], ignore_index=True)
            y = pd.concat([cic_labels, prod_labels], ignore_index=True)
            click.echo(f"\nCombined dataset: {len(X)} samples")
            click.echo(f"  CIC data: {len(cic_features)} samples")
            click.echo(f"  Production data: {len(prod_features)} samples")
        else:
            X, y = cic_features, cic_labels
            click.echo(f"\nUsing only CIC data: {len(X)} samples")
    elif prod_features is not None:
        X, y = prod_features, prod_labels
        click.echo(f"\nUsing only production data: {len(X)} samples")
    else:
        click.echo("Error: No data available for training!")
        return
    
    # Clean data
    X = X.fillna(0)
    X = X.replace([np.inf, -np.inf], 0)
    
    # Class distribution
    click.echo(f"\nClass distribution:")
    click.echo(f"  Benign: {sum(y == 0)} ({sum(y == 0)/len(y)*100:.1f}%)")
    click.echo(f"  Attack: {sum(y == 1)} ({sum(y == 1)/len(y)*100:.1f}%)")
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=42, stratify=y
    )
    
    click.echo(f"\nTrain/Test split:")
    click.echo(f"  Training: {len(X_train)} samples")
    click.echo(f"  Testing: {len(X_test)} samples")
    
    # Apply SMOTE if requested
    if use_smote:
        click.echo("\nApplying SMOTE for class balancing...")
        smote = SMOTE(random_state=42)
        X_train, y_train = smote.fit_resample(X_train, y_train)
        click.echo(f"After SMOTE: {len(X_train)} training samples")
    
    # Train new model
    click.echo(f"\nTraining Random Forest (n_estimators={n_estimators})...")
    
    new_model = RandomForestClassifier(
        n_estimators=n_estimators,
        max_depth=20,
        min_samples_split=10,
        min_samples_leaf=4,
        random_state=42,
        n_jobs=-1,
        class_weight='balanced'
    )
    
    new_model.fit(X_train, y_train)
    
    # Evaluate new model
    click.echo("\n" + "="*80)
    click.echo("NEW MODEL PERFORMANCE")
    click.echo("="*80)
    
    y_pred_new = new_model.predict(X_test)
    y_proba_new = new_model.predict_proba(X_test)[:, 1]
    
    click.echo("\nClassification Report:")
    click.echo(classification_report(y_test, y_pred_new, target_names=['Benign', 'Attack']))
    
    click.echo("\nConfusion Matrix:")
    cm = confusion_matrix(y_test, y_pred_new)
    click.echo(f"  TN: {cm[0,0]:6d}  |  FP: {cm[0,1]:6d}")
    click.echo(f"  FN: {cm[1,0]:6d}  |  TP: {cm[1,1]:6d}")
    
    new_accuracy = accuracy_score(y_test, y_pred_new)
    click.echo(f"\nAccuracy: {new_accuracy*100:.2f}%")
    
    # Compare with old model if exists
    old_model_path = os.path.join(PROJECT_ROOT, "models", "saved_models", "rf_model.joblib")
    if os.path.exists(old_model_path):
        click.echo("\n" + "="*80)
        click.echo("OLD MODEL PERFORMANCE (for comparison)")
        click.echo("="*80)
        
        old_model = joblib.load(old_model_path)
        y_pred_old = old_model.predict(X_test)
        
        click.echo("\nClassification Report:")
        click.echo(classification_report(y_test, y_pred_old, target_names=['Benign', 'Attack']))
        
        click.echo("\nConfusion Matrix:")
        cm_old = confusion_matrix(y_test, y_pred_old)
        click.echo(f"  TN: {cm_old[0,0]:6d}  |  FP: {cm_old[0,1]:6d}")
        click.echo(f"  FN: {cm_old[1,0]:6d}  |  TP: {cm_old[1,1]:6d}")
        
        old_accuracy = accuracy_score(y_test, y_pred_old)
        click.echo(f"\nAccuracy: {old_accuracy*100:.2f}%")
        
        # Show improvement
        improvement = (new_accuracy - old_accuracy) * 100
        click.echo(f"\n{'='*80}")
        if improvement > 0:
            click.echo(f"✓ NEW MODEL IMPROVED by {improvement:.2f} percentage points!")
        elif improvement < 0:
            click.echo(f"⚠ NEW MODEL WORSE by {abs(improvement):.2f} percentage points")
        else:
            click.echo(f"○ No change in accuracy")
        click.echo(f"{'='*80}")
    
    # Feature importance
    click.echo("\nFeature Importance:")
    importance_df = pd.DataFrame({
        'feature': FEATURE_COLS,
        'importance': new_model.feature_importances_
    }).sort_values('importance', ascending=False)
    
    for _, row in importance_df.iterrows():
        click.echo(f"  {row['feature']:20s}: {row['importance']:.4f}")
    
    # Save new model
    output_path = os.path.join(PROJECT_ROOT, output_model)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    joblib.dump(new_model, output_path)
    
    # Save metadata
    metadata = {
        "created_at": datetime.utcnow().isoformat(),
        "version": "2.0",
        "training_samples": len(X_train),
        "test_samples": len(X_test),
        "accuracy": float(new_accuracy),
        "features": FEATURE_COLS,
        "model_type": "RandomForestClassifier",
        "n_estimators": n_estimators,
        "production_data_used": prod_features is not None,
        "production_samples": len(prod_features) if prod_features is not None else 0,
        "cic_data_used": cic_df is not None,
        "smote_applied": use_smote,
        "min_confidence": min_confidence,
    }
    
    metadata_path = output_path + ".meta.json"
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    
    click.echo(f"\n✓ Model saved to: {output_path}")
    click.echo(f"✓ Metadata saved to: {metadata_path}")
    
    click.echo(f"\nTo use the new model, update MODEL_PATH in api/app.py:")
    click.echo(f"  MODEL_PATH = \"{output_model}\"")
    
    click.echo(f"\nOr copy it over the current model:")
    click.echo(f"  cp {output_path} models/saved_models/rf_model.joblib")
    click.echo(f"  cp {metadata_path} models/saved_models/rf_model.joblib.meta.json")


if __name__ == "__main__":
    retrain()
