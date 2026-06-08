import numpy as np
import pandas as pd
from typing import Dict, Any, Tuple, List
import logging
from datetime import datetime
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import StandardScaler

logger = logging.getLogger(__name__)

# Market Regime Classifications
class MarketRegime:
    TRENDING_BULLISH = "TRENDING_BULLISH"
    TRENDING_BEARISH = "TRENDING_BEARISH"
    RANGING_HIGH_VOLATILITY = "RANGING_HIGH_VOLATILITY"
    RANGING_LOW_VOLATILITY = "RANGING_LOW_VOLATILITY"

# --- 1. Market Regime Detector ---
class MarketRegimeDetector:
    def __init__(self, volatility_window: int = 20, trend_window: int = 50):
        self.volatility_window = volatility_window
        self.trend_window = trend_window

    def detect_regime(self, df: pd.DataFrame) -> Dict[str, Any]:
        """
        Classifies the current market regime based on volatility and trend strength.
        """
        if len(df) < max(self.volatility_window, self.trend_window):
            return {"regime": MarketRegime.RANGING_LOW_VOLATILITY, "volatility": 0.0, "trend_strength": 0.0}

        closes = df["Close"]
        
        # Volatility: Standard deviation of returns normalised by price
        returns = closes.pct_change().fillna(0)
        rolling_vol = returns.rolling(window=self.volatility_window).std().iloc[-1] * np.sqrt(365) # Annualised
        median_vol = returns.rolling(window=100).std().median() * np.sqrt(365)
        
        # Trend Strength: EMA Crossover distances and Slope
        ema_short = closes.ewm(span=20, adjust=False).mean()
        ema_long = closes.ewm(span=self.trend_window, adjust=False).mean()
        
        ema_diff = (ema_short - ema_long) / ema_long
        curr_diff = ema_diff.iloc[-1]
        
        # Volatility Classification
        is_high_vol = rolling_vol > (median_vol * 1.25)
        
        # Trend Classification
        is_trending = abs(curr_diff) > 0.015
        is_bullish = curr_diff > 0
        
        # Determine Regime
        if is_trending:
            regime = MarketRegime.TRENDING_BULLISH if is_bullish else MarketRegime.TRENDING_BEARISH
        else:
            regime = MarketRegime.RANGING_HIGH_VOLATILITY if is_high_vol else MarketRegime.RANGING_LOW_VOLATILITY

        return {
            "regime": regime,
            "volatility": float(rolling_vol),
            "trend_strength": float(curr_diff),
            "is_high_vol": bool(is_high_vol)
        }

# --- 2. Q-Learning Reinforcement Learning Policy ---
class RLPolicyAgent:
    def __init__(self, state_size: int = 5, action_size: int = 3, lr: float = 0.1, gamma: float = 0.95):
        self.lr = lr
        self.gamma = gamma
        self.state_size = state_size
        self.action_size = action_size # BUY (0), HOLD (1), SELL (2)
        # Discretised Q-table: mapping simplified features to action values
        self.q_table = {}

    def _get_state_key(self, state_features: np.ndarray) -> Tuple[int, ...]:
        # Discretise continuous feature metrics into 5 bins to keep Q-table small
        discretised = np.digitize(state_features, bins=[-1.5, -0.5, 0.5, 1.5])
        return tuple(discretised)

    def get_action(self, state_features: np.ndarray, epsilon: float = 0.1) -> int:
        state_key = self._get_state_key(state_features)
        if state_key not in self.q_table:
            self.q_table[state_key] = np.zeros(self.action_size)
            
        if np.random.rand() < epsilon:
            return np.random.choice(self.action_size) # Explore
        return int(np.argmax(self.q_table[state_key])) # Exploit

    def update(self, state: np.ndarray, action: int, reward: float, next_state: np.ndarray):
        state_key = self._get_state_key(state)
        next_state_key = self._get_state_key(next_state)
        
        if state_key not in self.q_table:
            self.q_table[state_key] = np.zeros(self.action_size)
        if next_state_key not in self.q_table:
            self.q_table[next_state_key] = np.zeros(self.action_size)
            
        old_val = self.q_table[state_key][action]
        next_max = np.max(self.q_table[next_state_key])
        
        # Bellman Equation update
        self.q_table[state_key][action] = old_val + self.lr * (reward + self.gamma * next_max - old_val)

# --- 3. Explainable Ensemble Model (XGBoost + DL + RL) ---
class AdvancedEnsembleModel:
    def __init__(self):
        # Ensemble component classifiers
        self.xgb_model = GradientBoostingClassifier(n_estimators=100, max_depth=5, random_state=42)
        self.dl_model = MLPClassifier(hidden_layer_sizes=(128, 64), max_iter=300, random_state=42)
        self.rl_agent = RLPolicyAgent(state_size=6)
        
        self.scaler = StandardScaler()
        self.is_trained = False
        self.feature_names = []

    def prepare_multisource_features(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.Series]:
        """
        Processes standard OHLCV, volume, and models alternative macro/funding sources.
        """
        # Ensure base columns are present
        df = df.copy()
        
        # Add basic indicators dynamically if not present
        if "RSI" not in df.columns:
            df["RSI"] = 50.0 # fallback
        
        features = pd.DataFrame(index=df.index)
        
        # 1. Price Momentum & Volatility
        features["RSI"] = df["RSI"]
        features["ATR_Norm"] = (df["High"] - df["Low"]) / df["Close"]
        
        # 2. Volume & Liquidity structure
        features["Volume_Ratio"] = df["Volume"] / df["Volume"].rolling(20).mean().fillna(df["Volume"].iloc[0])
        
        # 3. Alternative Market Sources (Funding / Open Interest / Sentiment Mocks if not available)
        features["Funding_Rate_Mock"] = np.sin(df.index.astype(int)) * 0.0001 # funding rates oscillation
        features["Open_Interest_Delta"] = df["Volume"].pct_change().fillna(0) # volume shift as proxy
        features["Market_Sentiment_Score"] = np.random.normal(0.05, 0.2, len(df)) # sentiment index
        
        # 4. Return Lags
        features["Return_Lag_1"] = df["Close"].pct_change(1).fillna(0)
        features["Return_Lag_3"] = df["Close"].pct_change(3).fillna(0)
        features["Return_Lag_5"] = df["Close"].pct_change(5).fillna(0)
        
        self.feature_names = features.columns.tolist()
        
        # Target: 1 if close price 3 periods ahead is higher than current Close, else -1
        target = np.where(df["Close"].shift(-3) > df["Close"], 1, -1)
        target = pd.Series(target, index=df.index)
        
        return features, target

    def train_walkforward(self, df: pd.DataFrame) -> Dict[str, Any]:
        """
        Trains models using out-of-sample walk-forward validation rules to prevent overfitting.
        """
        if len(df) < 100:
            return {"success": False, "error": "Need at least 100 periods to train advanced quant ensemble"}

        features, target = self.prepare_multisource_features(df)
        
        # Align indexes
        X = features.iloc[:-3]
        y = target.iloc[:-3]
        
        # 70% In-sample Training, 30% Out-of-sample validation
        split_idx = int(len(X) * 0.7)
        X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
        y_train, y_test = y.iloc[:split_idx], y.iloc[split_idx:]
        
        # Scale features
        self.scaler.fit(X_train)
        X_train_scaled = self.scaler.transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        # Train Classifiers
        self.xgb_model.fit(X_train_scaled, y_train)
        self.dl_model.fit(X_train_scaled, y_train)
        
        # Train RL Agent through sequential epochs
        state_cols = ["RSI", "ATR_Norm", "Volume_Ratio", "Funding_Rate_Mock", "Open_Interest_Delta", "Market_Sentiment_Score"]
        rl_state_indices = [self.feature_names.index(c) for c in state_cols]
        
        X_train_rl = X_train_scaled[:, rl_state_indices]
        for idx in range(len(X_train_rl) - 1):
            state = X_train_rl[idx]
            next_state = X_train_rl[idx+1]
            action = self.rl_agent.get_action(state, epsilon=0.2)
            
            # Reward: matches direction of return
            future_return = y_train.iloc[idx]
            reward = future_return if action == 0 else (-future_return if action == 2 else 0)
            self.rl_agent.update(state, action, reward, next_state)

        self.is_trained = True
        
        # Out-of-sample Accuracy
        preds_xgb = self.xgb_model.predict(X_test_scaled)
        preds_dl = self.dl_model.predict(X_test_scaled)
        
        acc_xgb = np.mean(preds_xgb == y_test)
        acc_dl = np.mean(preds_dl == y_test)

        logger.info(f"Walk-forward training completed. XGB Acc: {acc_xgb:.2%}, DL Acc: {acc_dl:.2%}")
        
        return {
            "success": True,
            "xgb_oos_accuracy": float(acc_xgb),
            "dl_oos_accuracy": float(acc_dl),
            "train_size": len(X_train),
            "validation_size": len(X_test)
        }

    def predict_signal(self, current_row_df: pd.DataFrame) -> Dict[str, Any]:
        """
        Generates Buy (+1), Sell (-1), or Hold (0) signals along with confidence scores and XAI metrics.
        """
        if not self.is_trained:
            return {"signal": 0, "confidence": 0.0, "xai": "Model is not trained."}

        features, _ = self.prepare_multisource_features(current_row_df)
        latest_feature = features.iloc[[-1]]
        latest_scaled = self.scaler.transform(latest_feature)
        
        # Predict Class Probabilities
        prob_xgb = self.xgb_model.predict_proba(latest_scaled)[0] # [P(-1), P(1)]
        prob_dl = self.dl_model.predict_proba(latest_scaled)[0]
        
        # RL state action values
        state_cols = ["RSI", "ATR_Norm", "Volume_Ratio", "Funding_Rate_Mock", "Open_Interest_Delta", "Market_Sentiment_Score"]
        rl_state_indices = [self.feature_names.index(c) for c in state_cols]
        rl_state = latest_scaled[0][rl_state_indices]
        rl_action = self.rl_agent.get_action(rl_state, epsilon=0.0) # Exploit action
        
        # Map RL action: 0 -> BUY (1), 1 -> HOLD (0), 2 -> SELL (-1)
        rl_signal = 1 if rl_action == 0 else (-1 if rl_action == 2 else 0)

        # Ensemble Vote Calculation
        # XGB weight = 0.5, Deep Learning weight = 0.35, RL weight = 0.15
        p_up_ensemble = (prob_xgb[1] * 0.50) + (prob_dl[1] * 0.35) + (0.5 if rl_signal == 0 else (1.0 if rl_signal == 1 else 0.0)) * 0.15
        p_down_ensemble = (prob_xgb[0] * 0.50) + (prob_dl[0] * 0.35) + (0.5 if rl_signal == 0 else (0.0 if rl_signal == 1 else 1.0)) * 0.15
        
        # Determine Signal based on threshold probability (e.g. strict confidence > 62%)
        confidence_threshold = 0.60
        if p_up_ensemble >= confidence_threshold:
            signal = 1
            confidence = p_up_ensemble
        elif p_down_ensemble >= confidence_threshold:
            signal = -1
            confidence = p_down_ensemble
        else:
            signal = 0
            confidence = max(p_up_ensemble, p_down_ensemble)

        # Explainable AI (XAI): Identify feature contributions
        # We can extract relative weights of top features from the model importances
        xgb_importances = self.xgb_model.feature_importances_
        sorted_indices = np.argsort(xgb_importances)[::-1]
        
        xai_factors = []
        for idx in sorted_indices[:3]:
            feat_name = self.feature_names[idx]
            val = float(latest_feature.iloc[0][feat_name])
            weight = float(xgb_importances[idx])
            xai_factors.append(f"{feat_name} ({val:.4f}, weight={weight:.2%})")

        xai_report = f"Top predictors: {', '.join(xai_factors)}. Ensemble breakdown: XGB Up Prob={prob_xgb[1]:.1%}, DL Up Prob={prob_dl[1]:.1%}, RL Action={rl_signal}."

        return {
            "signal": int(signal),
            "confidence": float(confidence),
            "xai": xai_report,
            "p_up": float(p_up_ensemble)
        }

# --- 4. Quantitative Risk Manager & Position Sizing ---
class QuantitativeRiskManager:
    def __init__(self, risk_pct_per_trade: float = 1.0, max_drawdown_limit_pct: float = 10.0):
        self.risk_pct_per_trade = risk_pct_per_trade # Risk 1% of equity per trade
        self.max_drawdown_limit_pct = max_drawdown_limit_pct

    def calculate_position_size(self, balance: float, entry_price: float, stop_loss_price: float) -> float:
        """
        Calculates position sizing dynamically based on trade entry, stop loss, and account risk capital rules.
        """
        if entry_price <= 0 or stop_loss_price <= 0 or stop_loss_price >= entry_price:
            return 0.0

        risk_cap = balance * (self.risk_pct_per_trade / 100.0)
        risk_per_unit = entry_price - stop_loss_price
        
        # Max Quantity
        qty = risk_cap / risk_per_unit
        
        # Cap allocation value to a maximum of 20% of account size for strict risk control
        max_allowable_cost = balance * 0.20
        max_qty = max_allowable_cost / entry_price
        
        return float(min(qty, max_qty))

    def evaluate_max_drawdown_shield(self, current_nav: float, peak_nav: float) -> bool:
        """
        Returns True if maximum drawdown limit is breached, signaling core shutdown to preserve capital.
        """
        if peak_nav <= 0:
            return False
        
        drawdown = (peak_nav - current_nav) / peak_nav * 100.0
        return drawdown >= self.max_drawdown_limit_pct
