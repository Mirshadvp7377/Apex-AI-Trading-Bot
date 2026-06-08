import os
import json
import time
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional
import pandas as pd
import numpy as np

from backend.data_manager import fetch_historical_data
from backend.strategies import run_strategy
from backend.ml_model import train_ml_model
from backend.advanced_quant_engine import (
    MarketRegimeDetector, RLPolicyAgent, AdvancedEnsembleModel,
    QuantitativeRiskManager, MarketRegime
)

logger = logging.getLogger(__name__)

DEFAULT_STRATEGIES = {
    "rsi_macd": {
        "id": "rsi_macd",
        "name": "RSI + MACD",
        "enabled": True,
        "description": "Buy when RSI < 30 & MACD bullish — Sell when RSI > 70 & MACD bearish",
        "timeframe": "1d",
        "risk": "medium",
        "params": {"rsi_lower": 30, "rsi_upper": 70, "macd_fast": 12, "macd_slow": 26, "macd_signal": 9}
    },
    "ema_cross": {
        "id": "ema_cross",
        "name": "Moving average crossover (EMA)",
        "enabled": False,
        "description": "Buy when 50 EMA crosses above 200 EMA — Sell on reverse cross",
        "timeframe": "1d",
        "risk": "low",
        "params": {"fast_period": 50, "slow_period": 200}
    },
    "bb_reversion": {
        "id": "bb_reversion",
        "name": "Bollinger bands mean reversion",
        "enabled": False,
        "description": "Buy when price touches lower band — Sell when it touches upper band",
        "timeframe": "1d",
        "risk": "medium",
        "params": {"bb_period": 20, "bb_std": 2.0}
    },
    "vwap": {
        "id": "vwap",
        "name": "VWAP (volume weighted avg price)",
        "enabled": False,
        "description": "Buy when price dips below VWAP — Sell when price rises above VWAP",
        "timeframe": "15m",
        "risk": "medium",
        "params": {"period": 14}
    },
    "sup_res": {
        "id": "sup_res",
        "name": "Support / resistance breakout",
        "enabled": False,
        "description": "Buy when price breaks above resistance — Sell below support",
        "timeframe": "1d",
        "risk": "medium-high",
        "params": {"period": 20}
    },
    "stochastic": {
        "id": "stochastic",
        "name": "Stochastic oscillator",
        "enabled": False,
        "description": "Buy when %K crosses above %D below 20 — Sell when above 80",
        "timeframe": "1d",
        "risk": "medium",
        "params": {"k_period": 14, "d_period": 3, "stoch_lower": 20, "stoch_upper": 80}
    },
    "atr_stop": {
        "id": "atr_stop",
        "name": "ATR trailing stop",
        "enabled": False,
        "description": "Enter on trend — Trail stop by ATR multiplier — Exit when stop hit",
        "timeframe": "1d",
        "risk": "low-medium",
        "params": {"atr_period": 14, "atr_multiplier": 3.0, "atr_trend_period": 50}
    },
    "rsi_div": {
        "id": "rsi_div",
        "name": "RSI divergence",
        "enabled": False,
        "description": "Buy on bullish divergence (price down, RSI up) — Sell on bearish",
        "timeframe": "1d",
        "risk": "medium",
        "params": {"rsi_period": 14, "lookback": 15}
    },
    "pairs_trade": {
        "id": "pairs_trade",
        "name": "Pairs trading / stat arb",
        "enabled": False,
        "description": "Long underperformer, short outperformer of a correlated pair",
        "timeframe": "1d",
        "risk": "low",
        "params": {"pair_symbol": "ETH-USD", "pairs_zscore": 2.0, "pairs_window": 20}
    },
    "ml_predict": {
        "id": "ml_predict",
        "name": "ML prediction (RandomForest)",
        "enabled": False,
        "description": "Train model on OHLCV + indicators — Trade on predicted price direction",
        "timeframe": "1d",
        "risk": "variable",
        "params": {}
    },
    "advanced_ensemble": {
        "id": "advanced_ensemble",
        "name": "Advanced Ensemble (XGB+DL+RL)",
        "enabled": False,
        "description": "Walk-forward trained ensemble combining Gradient Boosting, MLP Neural Network, and Q-learning Policy. Features Explainable AI (XAI) feature importances and confidence filtering.",
        "timeframe": "1d",
        "risk": "dynamic",
        "params": {"confidence_threshold": 0.60}
    }
}

class TradingEngine:
    def __init__(self, db_path: str = "db.json"):
        self.db_path = db_path
        self.balance = 10000.0
        self.initial_balance = 10000.0
        self.positions = {}  # symbol -> {qty, entry_price, current_price, timestamp}
        self.trades = []     # list of executed/closed trades
        self.strategies = DEFAULT_STRATEGIES.copy()
        self.logs = []
        self.monitored_symbols = ["BTC-USD", "AAPL", "EURUSD=X", "TSLA", "GBPUSD=X"]
        
        # In-memory cached ML models
        self.trained_ml_models = {} # symbol -> ml_results
        self.algo_trading_enabled = True
        
        # Risk Management Settings
        self.global_stop_loss_pct = 2.0  # 2.0% Stop Loss (0 to disable)
        self.global_take_profit_pct = 4.0 # 4.0% Take Profit (0 to disable)
        self.global_trailing_stop_pct = 0.0 # Trailing Stop (0 to disable)
        self.trade_allocation_usd = 100.0 # Trade allocation in USD
        
        # Quant Redesign Components
        self.regime_detector = MarketRegimeDetector()
        self.risk_manager = QuantitativeRiskManager(risk_pct_per_trade=1.0)
        self.ensemble_models = {}  # symbol -> AdvancedEnsembleModel
        
        # Quant State Settings
        self.regime_switching_enabled = True
        self.dynamic_position_sizing_enabled = True
        self.risk_pct_per_trade = 1.0
        self.peak_nav = 10000.0
        self.drawdown_shield_triggered = False
        self.current_regimes = {}
        self.ticks_since_retrain = {}
        
        self.load_state()
        self.add_log("Trading Bot Initialized")

    def load_state(self):
        """Loads state from JSON database if it exists."""
        if os.path.exists(self.db_path):
            try:
                with open(self.db_path, 'r') as f:
                    state = json.load(f)
                    self.balance = state.get("balance", 10000.0)
                    self.initial_balance = state.get("initial_balance", 10000.0)
                    self.trades = state.get("trades", [])
                    self.monitored_symbols = state.get("monitored_symbols", ["BTC-USD", "AAPL", "EURUSD=X", "TSLA", "GBPUSD=X"])
                    self.algo_trading_enabled = state.get("algo_trading_enabled", True)
                    self.global_stop_loss_pct = state.get("global_stop_loss_pct", 2.0)
                    self.global_take_profit_pct = state.get("global_take_profit_pct", 4.0)
                    self.global_trailing_stop_pct = state.get("global_trailing_stop_pct", 0.0)
                    self.trade_allocation_usd = state.get("trade_allocation_usd", 100.0)
                    
                    # Quant state variables
                    self.regime_switching_enabled = state.get("regime_switching_enabled", True)
                    self.dynamic_position_sizing_enabled = state.get("dynamic_position_sizing_enabled", True)
                    self.risk_pct_per_trade = state.get("risk_pct_per_trade", 1.0)
                    self.risk_manager.risk_pct_per_trade = self.risk_pct_per_trade
                    self.peak_nav = state.get("peak_nav", 10000.0)
                    self.drawdown_shield_triggered = state.get("drawdown_shield_triggered", False)
                    
                    # Update strategies, merging saved params with defaults
                    saved_strategies = state.get("strategies", {})
                    for key, val in saved_strategies.items():
                        if key in self.strategies:
                            self.strategies[key]["enabled"] = val.get("enabled", self.strategies[key]["enabled"])
                            self.strategies[key]["params"] = val.get("params", self.strategies[key]["params"])
                            self.strategies[key]["timeframe"] = val.get("timeframe", self.strategies[key]["timeframe"])
                self.add_log("Persistent state loaded successfully")
            except Exception as e:
                logger.error(f"Error loading state: {str(e)}")

    def save_state(self):
        """Saves current state to JSON database."""
        try:
            state = {
                "balance": self.balance,
                "initial_balance": self.initial_balance,
                "positions": self.positions,
                "trades": self.trades,
                "strategies": self.strategies,
                "monitored_symbols": self.monitored_symbols,
                "algo_trading_enabled": self.algo_trading_enabled,
                "global_stop_loss_pct": self.global_stop_loss_pct,
                "global_take_profit_pct": self.global_take_profit_pct,
                "global_trailing_stop_pct": self.global_trailing_stop_pct,
                "trade_allocation_usd": self.trade_allocation_usd,
                
                # Quant state settings
                "regime_switching_enabled": self.regime_switching_enabled,
                "dynamic_position_sizing_enabled": self.dynamic_position_sizing_enabled,
                "risk_pct_per_trade": self.risk_pct_per_trade,
                "peak_nav": self.peak_nav,
                "drawdown_shield_triggered": self.drawdown_shield_triggered
            }
            with open(self.db_path, 'w') as f:
                json.dump(state, f, indent=4)
        except Exception as e:
            logger.error(f"Error saving state: {str(e)}")

    def add_log(self, message: str):
        """Adds a log with a timestamp."""
        t_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_entry = f"[{t_str}] {message}"
        self.logs.append(log_entry)
        if len(self.logs) > 500:
            self.logs = self.logs[-500:]
        logger.info(log_entry)

    def get_portfolio_summary(self) -> Dict[str, Any]:
        """Calculates total portfolio valuation and overall metrics."""
        positions_value = 0.0
        for symbol, pos in self.positions.items():
            positions_value += pos["qty"] * pos["current_price"]
            
        net_asset_val = self.balance + positions_value
        total_pnl = net_asset_val - self.initial_balance
        total_pnl_pct = (total_pnl / self.initial_balance) * 100.0
        
        # Calculate Win Rate
        closed_trades = [t for t in self.trades if t.get("side") == "SELL" or t.get("pnl") is not None]
        winning_trades = [t for t in closed_trades if t.get("pnl", 0) > 0]
        win_rate = (len(winning_trades) / len(closed_trades) * 100) if closed_trades else 0.0
        
        return {
            "balance": self.balance,
            "net_asset_value": net_asset_val,
            "positions_value": positions_value,
            "total_pnl": total_pnl,
            "total_pnl_pct": total_pnl_pct,
            "positions": self.positions,
            "trades": self.trades[-50:],  # last 50 trades
            "win_rate": win_rate,
            "total_trades": len(self.trades),
            "monitored_symbols": self.monitored_symbols,
            "algo_trading_enabled": self.algo_trading_enabled,
            "global_stop_loss_pct": self.global_stop_loss_pct,
            "global_take_profit_pct": self.global_take_profit_pct,
            "global_trailing_stop_pct": self.global_trailing_stop_pct,
            "trade_allocation_usd": self.trade_allocation_usd,
            "regime_switching_enabled": self.regime_switching_enabled,
            "dynamic_position_sizing_enabled": self.dynamic_position_sizing_enabled,
            "risk_pct_per_trade": self.risk_pct_per_trade,
            "peak_nav": self.peak_nav,
            "drawdown_shield_triggered": self.drawdown_shield_triggered,
            "current_regimes": {k: v["regime"] for k, v in self.current_regimes.items()}
        }

    def add_monitored_symbol(self, symbol: str) -> bool:
        symbol = symbol.upper().strip()
        if symbol and symbol not in self.monitored_symbols:
            self.monitored_symbols.append(symbol)
            self.add_log(f"Added {symbol} to automated monitoring list")
            self.save_state()
            return True
        return False

    def remove_monitored_symbol(self, symbol: str) -> bool:
        symbol = symbol.upper().strip()
        if symbol in self.monitored_symbols:
            self.monitored_symbols.remove(symbol)
            self.add_log(f"Removed {symbol} from automated monitoring list")
            self.save_state()
            return True
        return False

    def execute_order(self, symbol: str, side: str, qty: float, price: float, strategy: str = "manual") -> bool:
        """Executes a virtual/paper trade order."""
        side = side.upper()
        if side == "BUY":
            cost = qty * price
            if cost > self.balance:
                # If insufficient, buy maximum possible
                qty = self.balance / price
                cost = qty * price
                
            if qty <= 0:
                self.add_log(f"Order rejected: Insufficient balance to BUY {symbol}")
                return False
                
            self.balance -= cost
            if symbol in self.positions:
                # Average down/up
                old_qty = self.positions[symbol]["qty"]
                old_price = self.positions[symbol]["entry_price"]
                new_qty = old_qty + qty
                avg_price = ((old_qty * old_price) + cost) / new_qty
                
                self.positions[symbol]["qty"] = new_qty
                self.positions[symbol]["entry_price"] = avg_price
                self.positions[symbol]["current_price"] = price
                
                # Recalculate SL/TP/TS based on new average price
                self.positions[symbol]["stop_loss_price"] = avg_price * (1.0 - self.global_stop_loss_pct / 100.0) if self.global_stop_loss_pct > 0 else None
                self.positions[symbol]["take_profit_price"] = avg_price * (1.0 + self.global_take_profit_pct / 100.0) if self.global_take_profit_pct > 0 else None
                self.positions[symbol]["trailing_stop_price"] = avg_price * (1.0 - self.global_trailing_stop_pct / 100.0) if self.global_trailing_stop_pct > 0 else None
                self.positions[symbol]["highest_price"] = max(self.positions[symbol].get("highest_price", avg_price), price)
            else:
                sl_price = price * (1.0 - self.global_stop_loss_pct / 100.0) if self.global_stop_loss_pct > 0 else None
                tp_price = price * (1.0 + self.global_take_profit_pct / 100.0) if self.global_take_profit_pct > 0 else None
                ts_price = price * (1.0 - self.global_trailing_stop_pct / 100.0) if self.global_trailing_stop_pct > 0 else None
                
                self.positions[symbol] = {
                    "qty": qty,
                    "entry_price": price,
                    "current_price": price,
                    "timestamp": datetime.now().isoformat(),
                    "stop_loss_price": sl_price,
                    "take_profit_price": tp_price,
                    "trailing_stop_price": ts_price,
                    "highest_price": price
                }
                
            trade_record = {
                "id": f"t_{int(time.time() * 1000)}",
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "symbol": symbol,
                "side": "BUY",
                "qty": qty,
                "price": price,
                "strategy": strategy,
                "pnl": None,
                "pnl_pct": None
            }
            self.trades.append(trade_record)
            self.add_log(f"BUY order executed: {qty:.4f} {symbol} @ ${price:,.2f} via [{strategy}]")
            self.save_state()
            return True
            
        elif side == "SELL":
            if symbol not in self.positions or self.positions[symbol]["qty"] <= 0:
                self.add_log(f"Order rejected: No position in {symbol} to SELL")
                return False
                
            pos = self.positions[symbol]
            qty_to_sell = min(qty, pos["qty"])
            revenue = qty_to_sell * price
            
            # Calculate PnL
            entry_cost = qty_to_sell * pos["entry_price"]
            pnl = revenue - entry_cost
            pnl_pct = (pnl / entry_cost) * 100.0
            
            self.balance += revenue
            self.positions[symbol]["qty"] -= qty_to_sell
            
            trade_record = {
                "id": f"t_{int(time.time() * 1000)}",
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "symbol": symbol,
                "side": "SELL",
                "qty": qty_to_sell,
                "price": price,
                "strategy": strategy,
                "pnl": pnl,
                "pnl_pct": pnl_pct
            }
            self.trades.append(trade_record)
            self.add_log(f"SELL order executed: {qty_to_sell:.4f} {symbol} @ ${price:,.2f} (PnL: ${pnl:+,.2f}, {pnl_pct:+.2f}%) via [{strategy}]")
            
            # Clear position if fully closed
            if self.positions[symbol]["qty"] <= 0:
                del self.positions[symbol]
                
            self.save_state()
            return True
            
        return False

    def update_asset_price(self, symbol: str, price: float):
        """Update current price of active position and check SL/TP/Trailing limits."""
        if symbol in self.positions:
            pos = self.positions[symbol]
            pos["current_price"] = price
            
            # 1. Check Stop Loss
            sl_price = pos.get("stop_loss_price")
            if sl_price is not None and price <= sl_price:
                self.add_log(f"[STOP LOSS TRIGGERED] {symbol} dipped to ${price:,.2f} below SL level ${sl_price:,.2f}")
                self.execute_order(symbol, "SELL", pos["qty"], price, strategy="stop_loss")
                return
                
            # 2. Check Take Profit
            tp_price = pos.get("take_profit_price")
            if tp_price is not None and price >= tp_price:
                self.add_log(f"[TAKE PROFIT TRIGGERED] {symbol} rallied to ${price:,.2f} above TP level ${tp_price:,.2f}")
                self.execute_order(symbol, "SELL", pos["qty"], price, strategy="take_profit")
                return
                
            # 3. Check Trailing Stop
            ts_pct = self.global_trailing_stop_pct
            if ts_pct > 0:
                highest = pos.get("highest_price", pos["entry_price"])
                if price > highest:
                    pos["highest_price"] = price
                    pos["trailing_stop_price"] = price * (1.0 - ts_pct / 100.0)
                    
                ts_price = pos.get("trailing_stop_price")
                if ts_price is not None and price <= ts_price:
                    self.add_log(f"[TRAILING STOP TRIGGERED] {symbol} dropped to ${price:,.2f} below Trailing Stop ${ts_price:,.2f}")
                    self.execute_order(symbol, "SELL", pos["qty"], price, strategy="trailing_stop")

    def train_ml(self, symbol: str, timeframe: str) -> Dict[str, Any]:
        """Fetches historical data and trains the RandomForest model on it."""
        try:
            self.add_log(f"Starting ML Model Training for {symbol} ({timeframe})")
            df = fetch_historical_data(symbol, timeframe, limit=500)
            res = train_ml_model(df)
            if res.get("success"):
                self.trained_ml_models[symbol] = res
                self.add_log(f"ML Model Trained Successfully. Test Accuracy: {res['metrics']['accuracy']:.2%}")
                return {
                    "success": True,
                    "metrics": res["metrics"],
                    "feature_importances": res["feature_importances"]
                }
            else:
                self.add_log(f"ML Model Training Failed: {res.get('error')}")
                return {"success": False, "error": res.get("error")}
        except Exception as e:
            logger.error(f"Error training ML model: {str(e)}")
            return {"success": False, "error": str(e)}

    def run_backtest(self, symbol: str, strategy_name: str, params: Dict[str, Any], timeframe: str) -> Dict[str, Any]:
        """Runs historical backtest of a strategy and returns detailed metrics."""
        self.add_log(f"Running historical backtest for {strategy_name} on {symbol} ({timeframe})")
        try:
            df = fetch_historical_data(symbol, timeframe, limit=1000)
            if df.empty or len(df) < 50:
                raise ValueError("Insufficient historical data points for backtesting.")
            
            # If strategy is Pairs Trading, we need a correlated asset (e.g., ETH-USD for BTC-USD)
            pair_df = None
            if strategy_name == "pairs_trade":
                pair_symbol = params.get("pair_symbol", "ETH-USD")
                try:
                    pair_df = fetch_historical_data(pair_symbol, timeframe, limit=1000)
                except Exception as e:
                    self.add_log(f"Pairs Trading failed to fetch pair {pair_symbol}. Simulating synthetic pair.")
            
            # If strategy is ML prediction, train or retrieve predictions
            if strategy_name == "ml_predict":
                # Ensure model is trained
                if symbol not in self.trained_ml_models:
                    train_res = train_ml_model(df)
                    if train_res.get("success"):
                        self.trained_ml_models[symbol] = train_res
                    else:
                        raise ValueError(f"ML strategy error: {train_res.get('error')}")
                
                # Assign predictions to df
                df["ML_Prediction"] = self.trained_ml_models[symbol]["predictions"]
            
            # Generate Signals
            if strategy_name == "advanced_ensemble":
                # Out-of-sample walk-forward signal generation
                self.add_log("Running walk-forward out-of-sample simulation for Advanced Ensemble model...")
                model = AdvancedEnsembleModel()
                split_idx = int(len(df) * 0.7)
                in_sample_df = df.iloc[:split_idx]
                
                train_res = model.train_walkforward(in_sample_df)
                if not train_res.get("success"):
                    raise ValueError(f"Advanced Ensemble walk-forward training failed: {train_res.get('error')}")
                
                signals_list = [0] * len(df)
                confidence_threshold = params.get("confidence_threshold", 0.60)
                
                # Predict out-of-sample points sequentially
                for idx in range(split_idx, len(df)):
                    slice_df = df.iloc[:idx+1]
                    pred = model.predict_signal(slice_df)
                    if pred["confidence"] >= confidence_threshold:
                        signals_list[idx] = pred["signal"]
                    else:
                        signals_list[idx] = 0
                
                signals = pd.Series(signals_list, index=df.index)
            else:
                signals = run_strategy(strategy_name, df, params, pair_df)
            
            # Backtest Loop Settings
            commission_pct = 0.10  # 10 bps
            slippage_pct = 0.05    # 5 bps
            
            cash = 10000.0
            position = 0.0
            entry_price = 0.0
            allocated_cost = 0.0
            
            equity_curve = []
            trades_log = []
            
            # Find starting price for normalising asset equity
            start_asset_price = df["Close"].iloc[0]
            
            for i in range(len(df)):
                row = df.iloc[i]
                price = row["Close"]
                sig = signals.iloc[i]
                timestamp_str = row["Timestamp"].strftime("%Y-%m-%d %H:%M")
                
                # Active equity valuation
                port_val = cash + (position * price)
                
                # Normalize asset curve to start at 10000
                asset_val_norm = (price / start_asset_price) * 10000.0
                
                equity_curve.append({
                    "timestamp": timestamp_str,
                    "strategy_val": port_val,
                    "asset_val": asset_val_norm,
                    "price": price
                })
                
                # Execution
                if sig == 1 and position == 0:  # BUY Signal
                    exec_price = price * (1.0 + slippage_pct / 100.0)
                    position_cost = cash / (1.0 + commission_pct / 100.0)
                    buy_fee = cash - position_cost
                    position = position_cost / exec_price
                    allocated_cost = cash
                    cash = 0.0
                    entry_price = exec_price
                    trades_log.append({
                        "type": "BUY",
                        "timestamp": timestamp_str,
                        "price": exec_price,
                        "qty": position,
                        "fee": buy_fee,
                        "pnl": None,
                        "pnl_pct": None
                    })
                elif sig == -1 and position > 0:  # SELL Signal
                    exec_price = price * (1.0 - slippage_pct / 100.0)
                    revenue = position * exec_price
                    sell_fee = revenue * (commission_pct / 100.0)
                    net_revenue = revenue - sell_fee
                    
                    pnl = net_revenue - allocated_cost
                    pnl_pct = (pnl / allocated_cost) * 100.0
                    cash = net_revenue
                    
                    trades_log.append({
                        "type": "SELL",
                        "timestamp": timestamp_str,
                        "price": exec_price,
                        "qty": position,
                        "fee": sell_fee,
                        "pnl": pnl,
                        "pnl_pct": pnl_pct
                    })
                    position = 0.0
                    entry_price = 0.0
                    allocated_cost = 0.0
                    
            # Wrap up final position if open
            final_portfolio_val = cash + (position * df["Close"].iloc[-1])
            
            # Stats calculations
            total_return_pct = ((final_portfolio_val - 10000.0) / 10000.0) * 100.0
            buy_hold_return_pct = ((df["Close"].iloc[-1] - start_asset_price) / start_asset_price) * 100.0
            
            # Max Drawdown
            strategy_vals = np.array([pt["strategy_val"] for pt in equity_curve])
            running_maxs = np.maximum.accumulate(strategy_vals)
            drawdowns = (strategy_vals - running_maxs) / running_maxs * 100.0
            max_drawdown = float(np.min(drawdowns)) if len(drawdowns) > 0 else 0.0
            
            # Win Rate
            sells = [t for t in trades_log if t["type"] == "SELL"]
            winning_sells = [t for t in sells if t["pnl"] > 0]
            win_rate = (len(winning_sells) / len(sells) * 100.0) if len(sells) > 0 else 0.0
            
            # Sharpe & Sortino Ratio
            returns = np.diff(strategy_vals) / strategy_vals[:-1]
            if len(returns) > 1 and np.std(returns) > 0:
                annual_factor = 252 if timeframe == "1d" else (252 * 24 if timeframe == "1h" else 252 * 4)
                sharpe = float((np.mean(returns) / np.std(returns)) * np.sqrt(annual_factor))
                
                # Sortino calculation
                downside_returns = returns[returns < 0]
                if len(downside_returns) > 1 and np.std(downside_returns) > 0:
                    sortino = float((np.mean(returns) / np.std(downside_returns)) * np.sqrt(annual_factor))
                else:
                    sortino = 0.0
            else:
                sharpe = 0.0
                sortino = 0.0
                
            # Profit Factor
            gross_profit = sum([t["pnl"] for t in sells if t["pnl"] > 0])
            gross_loss = sum([abs(t["pnl"]) for t in sells if t["pnl"] < 0])
            profit_factor = float(gross_profit / gross_loss) if gross_loss > 0 else (99.9 if gross_profit > 0 else 0.0)
            
            return {
                "success": True,
                "symbol": symbol,
                "strategy": strategy_name,
                "metrics": {
                    "initial_balance": 10000.0,
                    "final_balance": final_portfolio_val,
                    "total_return_pct": total_return_pct,
                    "buy_hold_return_pct": buy_hold_return_pct,
                    "win_rate": win_rate,
                    "total_trades": len(trades_log),
                    "completed_trades": len(sells),
                    "max_drawdown": max_drawdown,
                    "sharpe_ratio": sharpe,
                    "sortino_ratio": sortino,
                    "profit_factor": profit_factor
                },
                "equity_curve": equity_curve[::max(1, len(equity_curve)//300)], # downsample to 300 points for React efficiency
                "trades": trades_log[-100:] # last 100 trades
            }
        except Exception as e:
            logger.error(f"Backtest execution error: {str(e)}")
            return {"success": False, "error": str(e)}

    def get_regime_based_strategy(self, regime: str) -> str:
        if regime == "TRENDING_BULLISH":
            return "ema_cross"
        elif regime == "TRENDING_BEARISH":
            return "atr_stop"
        elif regime == "RANGING_HIGH_VOLATILITY":
            return "bb_reversion"
        else: # RANGING_LOW_VOLATILITY
            return "rsi_macd"

    def tick_bot(self) -> List[str]:
        """
        Executes active strategies on all monitored symbols in real time.
        Evaluates the latest signals and triggers automated paper trades.
        """
        if not self.algo_trading_enabled:
            return []
            
        # 1. Evaluate Maximum Drawdown Shield
        current_nav = self.get_portfolio_summary()["net_asset_value"]
        if current_nav > self.peak_nav:
            self.peak_nav = current_nav
            
        if self.risk_manager.evaluate_max_drawdown_shield(current_nav, self.peak_nav):
            self.drawdown_shield_triggered = True
            self.algo_trading_enabled = False
            self.add_log(f"[CRITICAL WARNING] Drawdown shield triggered! NAV fell to ${current_nav:,.2f} from peak ${self.peak_nav:,.2f} (>= {self.risk_manager.max_drawdown_limit_pct}%). Liquidating all positions and pausing Autopilot.")
            
            # Liquidation actions
            liquidation_actions = []
            for symbol, pos in list(self.positions.items()):
                if pos["qty"] > 0:
                    latest_price = pos["current_price"]
                    success = self.execute_order(symbol, "SELL", pos["qty"], latest_price, strategy="drawdown_shield")
                    if success:
                        liquidation_actions.append(f"Drawdown Shield Liquidated {symbol} @ ${latest_price:,.2f}")
            self.save_state()
            return liquidation_actions
            
        new_actions = []
        
        for symbol in self.monitored_symbols:
            try:
                # Fetch recent daily data for regime detection and indicators
                df = fetch_historical_data(symbol, "1d", limit=150)
                if df.empty or len(df) < 50:
                    continue
                
                latest_price = float(df["Close"].iloc[-1])
                self.update_asset_price(symbol, latest_price)
                
                # 2. Detect Market Regime
                regime_info = self.regime_detector.detect_regime(df)
                self.current_regimes[symbol] = regime_info
                current_regime = regime_info["regime"]
                
                # 3. Regime-Based Strategy Switching
                if self.regime_switching_enabled:
                    target_strat = self.get_regime_based_strategy(current_regime)
                    for strat_id in self.strategies:
                        # Auto-enable target strategy, disable others (except advanced_ensemble if manually run)
                        if strat_id != "advanced_ensemble":
                            self.strategies[strat_id]["enabled"] = (strat_id == target_strat)
                            
                # Loop through enabled strategies
                for strat_id, config in self.strategies.items():
                    if not config["enabled"]:
                        continue
                        
                    timeframe = config["timeframe"]
                    params = config["params"]
                    
                    # Fetch strategy-specific historical bars
                    strat_df = fetch_historical_data(symbol, timeframe, limit=150)
                    if strat_df.empty or len(strat_df) < 20:
                        continue
                    
                    # 4. Strategy Signal evaluation
                    latest_sig = 0
                    xai_log = ""
                    
                    if strat_id == "advanced_ensemble":
                        # Continuous retraining check
                        if symbol not in self.ensemble_models:
                            self.ensemble_models[symbol] = AdvancedEnsembleModel()
                            self.ticks_since_retrain[symbol] = 0
                            
                        model = self.ensemble_models[symbol]
                        self.ticks_since_retrain[symbol] += 1
                        
                        # Retrain periodically (approx every 30 ticks)
                        if not model.is_trained or self.ticks_since_retrain[symbol] >= 30:
                            self.add_log(f"Training ensemble model for {symbol} ({timeframe})...")
                            train_res = model.train_walkforward(strat_df)
                            self.ticks_since_retrain[symbol] = 0
                            if train_res.get("success"):
                                self.add_log(f"Model trained. XGB OOS Acc: {train_res['xgb_oos_accuracy']:.1%}, DL OOS Acc: {train_res['dl_oos_accuracy']:.1%}")
                            else:
                                self.add_log(f"Model training failed: {train_res.get('error')}")
                                continue
                        
                        # Predict signal
                        pred = model.predict_signal(strat_df)
                        latest_sig = pred["signal"]
                        confidence = pred["confidence"]
                        xai_log = pred["xai"]
                        
                        # Reject low-confidence signals
                        conf_thresh = params.get("confidence_threshold", 0.60)
                        if confidence < conf_thresh:
                            latest_sig = 0 # Reject
                    else:
                        # Standard Strategies
                        pair_df = None
                        if strat_id == "pairs_trade":
                            pair_symbol = params.get("pair_symbol", "ETH-USD")
                            try:
                                pair_df = fetch_historical_data(pair_symbol, timeframe, limit=150)
                            except Exception:
                                pass
                        
                        if strat_id == "ml_predict":
                            if symbol not in self.trained_ml_models:
                                train_res = train_ml_model(strat_df)
                                if train_res.get("success"):
                                    self.trained_ml_models[symbol] = train_res
                                else:
                                    continue
                            strat_df["ML_Prediction"] = self.trained_ml_models[symbol]["predictions"]
                            
                        signals = run_strategy(strat_id, strat_df, params, pair_df)
                        if len(signals) > 0:
                            latest_sig = signals.iloc[-1]
                            
                    # 5. Order execution logic with Dynamic Sizing
                    if latest_sig == 1: # BUY
                        if symbol not in self.positions or self.positions[symbol]["qty"] <= 0:
                            if self.dynamic_position_sizing_enabled:
                                sl_pct = self.global_stop_loss_pct if self.global_stop_loss_pct > 0 else 2.0
                                stop_loss_price = latest_price * (1.0 - sl_pct / 100.0)
                                qty_to_buy = self.risk_manager.calculate_position_size(self.balance, latest_price, stop_loss_price)
                            else:
                                qty_to_buy = self.trade_allocation_usd / latest_price
                                
                            cost = qty_to_buy * latest_price
                            if cost > self.balance:
                                qty_to_buy = self.balance / latest_price
                                
                            if qty_to_buy > 0.0001:
                                success = self.execute_order(symbol, "BUY", qty_to_buy, latest_price, strategy=strat_id)
                                if success:
                                    msg = f"Auto-Buy {symbol} @ ${latest_price:,.2f} via [{config['name']}]"
                                    if xai_log:
                                        msg += f" | XAI: {xai_log}"
                                    new_actions.append(msg)
                                    
                    elif latest_sig == -1: # SELL
                        if symbol in self.positions and self.positions[symbol]["qty"] > 0:
                            qty_to_sell = self.positions[symbol]["qty"]
                            success = self.execute_order(symbol, "SELL", qty_to_sell, latest_price, strategy=strat_id)
                            if success:
                                msg = f"Auto-Sell {symbol} @ ${latest_price:,.2f} via [{config['name']}]"
                                if xai_log:
                                    msg += f" | XAI: {xai_log}"
                                new_actions.append(msg)
            except Exception as e:
                logger.error(f"Error running automated bot tick for {symbol}: {str(e)}")
                self.add_log(f"Bot Tick Error for {symbol}: {str(e)}")
                
        return new_actions
