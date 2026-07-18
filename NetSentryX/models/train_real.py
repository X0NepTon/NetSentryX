# models/train_real.py
"""
Train a classifier on exported flows CSV.
Saves model to models/saved_models/rf_model_real.joblib and feature metadata to models/saved_models/feature_order.json
Usage:
  python models/train_real.py --in data/flows_labeled.csv --out models/saved_models/rf_model_real.joblib
"""

import argparse
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score
import joblib, json, os

# Define which columns (features) to use for training. Match what extractor produced.
FEATURE_ORDER = [
    "total_packets",
    "total_bytes",
    "duration",
    "pkts_per_sec",
    "bytes_per_sec",
    "syn_count",
    "unique_dst_ports",
    # add new features as they exist, e.g. "avg_pkt_size", "unique_dst_ips", "tcp_ack", ...
]

def load_and_prepare(csv_path):
    df = pd.read_csv(csv_path)
    print("Loaded", len(df), "rows")
    # drop rows where all features NaN
    df = df.dropna(subset=FEATURE_ORDER, how="all")
    # fill missing numeric with 0
    df[FEATURE_ORDER] = df[FEATURE_ORDER].fillna(0)
    # ensure numeric types
    for c in FEATURE_ORDER:
        df[c] = pd.to_numeric(df[c], errors="coerce").fillna(0)
    # label
    if "label" not in df.columns:
        raise ValueError("CSV must include a label column")
    df["label"] = df["label"].astype(int)
    return df

def train_and_eval(df, out_model_path, random_state=42):
    X = df[FEATURE_ORDER].values
    y = df["label"].values
    # split: use stratified split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, stratify=y if len(np.unique(y))>1 else None, random_state=random_state)
    print("Train:", X_train.shape, "Test:", X_test.shape)

    # baseline RandomForest
    clf = RandomForestClassifier(n_estimators=200, max_depth=12, random_state=random_state, n_jobs=-1)
    clf.fit(X_train, y_train)
    # evaluation
    y_pred = clf.predict(X_test)
    y_proba = clf.predict_proba(X_test)[:,1] if hasattr(clf, "predict_proba") else None
    print("Classification report:")
    print(classification_report(y_test, y_pred))
    if y_proba is not None:
        try:
            print("ROC AUC:", roc_auc_score(y_test, y_proba))
        except Exception:
            pass

    # save model and feature order
    os.makedirs(os.path.dirname(out_model_path), exist_ok=True)
    joblib.dump(clf, out_model_path)
    meta = {"feature_order": FEATURE_ORDER, "model_type": "RandomForest", "n_features": len(FEATURE_ORDER)}
    with open(out_model_path + ".meta.json", "w") as f:
        json.dump(meta, f)
    print("Saved model to", out_model_path)
    return clf

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--in", dest="csv_in", default="data/flows_labeled.csv")
    parser.add_argument("--out", dest="model_out", default="models/saved_models/rf_model_real.joblib")
    args = parser.parse_args()
    df = load_and_prepare(args.csv_in)
    clf = train_and_eval(df, args.model_out)

if __name__ == "__main__":
    main()
