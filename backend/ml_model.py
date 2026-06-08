import pandas as pd
import numpy as np
from typing import Dict, Any, Tuple
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
from backend.indicators import add_all_indicators

def prepare_features(df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.Series]:
    """Prepares feature columns and targets from OHLCV data."""
    # Ensure all indicators are added
    df_ind = add_all_indicators(df)
    
    # Feature engineering
    features = pd.DataFrame(index=df_ind.index)
    
    # Technical Indicators
    features['RSI'] = df_ind['RSI']
    features['MACD_Hist'] = df_ind['MACD_Hist']
    features['Stoch_K'] = df_ind['Stoch_K']
    features['Stoch_D'] = df_ind['Stoch_D']
    features['ATR_Norm'] = df_ind['ATR'] / df_ind['Close'].replace(0, np.nan)
    
    # Bollinger Band relative position: 0 at lower band, 1 at upper band
    bb_width = df_ind['BB_Upper'] - df_ind['BB_Lower']
    features['BB_Position'] = (df_ind['Close'] - df_ind['BB_Lower']) / bb_width.replace(0, np.nan)
    features['BB_Position'] = features['BB_Position'].fillna(0.5)
    
    # EMA distance
    features['EMA_50_Dist'] = (df_ind['Close'] - df_ind['EMA_50']) / df_ind['EMA_50'].replace(0, np.nan)
    features['EMA_200_Dist'] = (df_ind['Close'] - df_ind['EMA_200']) / df_ind['EMA_200'].replace(0, np.nan)
    
    # VWAP distance
    features['VWAP_Dist'] = (df_ind['Close'] - df_ind['VWAP']) / df_ind['VWAP'].replace(0, np.nan)
    
    # Lag returns
    for lag in [1, 2, 3, 5, 10]:
        features[f'Return_Lag_{lag}'] = df_ind['Close'].pct_change(lag)
        
    features = features.fillna(0)
    
    # Target: 1 if next Close is higher than current Close, else -1
    target = np.where(df_ind['Close'].shift(-1) > df_ind['Close'], 1, -1)
    target = pd.Series(target, index=df_ind.index)
    
    return features, target

def train_ml_model(df: pd.DataFrame) -> Dict[str, Any]:
    """Trains a Random Forest model on historical data, returns performance metrics and predictions."""
    if len(df) < 50:
        return {
            "success": False,
            "error": "Insufficient data to train ML model. At least 50 historical periods are required."
        }
        
    features, target = prepare_features(df)
    
    # Split: We train on all except the last row (since the last row doesn't have a future target)
    X = features.iloc[:-1]
    y = target.iloc[:-1]
    
    # Time-series split (no shuffling to prevent lookahead bias)
    split_idx = int(len(X) * 0.7)
    
    if split_idx < 10:
        return {
            "success": False,
            "error": "Insufficient data for train-test split."
        }
        
    X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
    y_train, y_test = y.iloc[:split_idx], y.iloc[split_idx:]
    
    # Train RandomForest
    model = RandomForestClassifier(n_estimators=100, max_depth=6, random_state=42)
    model.fit(X_train, y_train)
    
    # Evaluate
    y_pred = model.predict(X_test)
    
    accuracy = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred, zero_division=0)
    recall = recall_score(y_test, y_pred, zero_division=0)
    f1 = f1_score(y_test, y_pred, zero_division=0)
    
    # Feature importances
    importances = model.feature_importances_
    feat_imp = {name: float(imp) for name, imp in zip(X.columns, importances)}
    feat_imp = dict(sorted(feat_imp.items(), key=lambda item: item[1], reverse=True))
    
    # Predict for all data (including the last row for live-trading)
    full_preds = model.predict(features)
    
    return {
        "success": True,
        "metrics": {
            "accuracy": float(accuracy),
            "precision": float(precision),
            "recall": float(recall),
            "f1": float(f1),
            "train_size": len(X_train),
            "test_size": len(X_test)
        },
        "feature_importances": feat_imp,
        "predictions": full_preds.tolist()
    }
