import unittest
import pandas as pd
import numpy as np
import os

from backend.indicators import calculate_rsi, calculate_ema, calculate_macd, add_all_indicators
from backend.strategies import run_strategy
from backend.trading_engine import TradingEngine

class TestTradingBotBackend(unittest.TestCase):
    def setUp(self):
        # Generate synthetic price series (random walk)
        np.random.seed(42)
        dates = pd.date_range(start="2026-01-01", periods=100, freq="D")
        close = 100.0 + np.cumsum(np.random.normal(0.1, 1.0, 100))
        high = close + np.random.uniform(0.1, 2.0, 100)
        low = close - np.random.uniform(0.1, 2.0, 100)
        open_val = close + np.random.normal(0, 0.5, 100)
        volume = np.random.randint(1000, 50000, 100)
        
        self.df = pd.DataFrame({
            "Timestamp": dates,
            "Open": open_val,
            "High": high,
            "Low": low,
            "Close": close,
            "Volume": volume
        })

    def test_indicators(self):
        # RSI range check
        rsi = calculate_rsi(self.df, period=14)
        self.assertEqual(len(rsi), 100)
        self.assertTrue((rsi >= 0).all() and (rsi <= 100).all())
        
        # EMA size check
        ema = calculate_ema(self.df, "Close", 50)
        self.assertEqual(len(ema), 100)
        
        # MACD lines check
        macd, signal, hist = calculate_macd(self.df)
        self.assertEqual(len(macd), 100)
        self.assertEqual(len(signal), 100)
        self.assertEqual(len(hist), 100)

    def test_add_all_indicators(self):
        df_with_indicators = add_all_indicators(self.df)
        self.assertIn("RSI", df_with_indicators.columns)
        self.assertIn("MACD_Hist", df_with_indicators.columns)
        self.assertIn("EMA_50", df_with_indicators.columns)
        self.assertIn("EMA_200", df_with_indicators.columns)
        self.assertIn("BB_Upper", df_with_indicators.columns)
        self.assertIn("VWAP", df_with_indicators.columns)
        self.assertIn("Support", df_with_indicators.columns)
        self.assertIn("ATR", df_with_indicators.columns)

    def test_strategies(self):
        # Run rsi_macd strategy signals
        df_ind = add_all_indicators(self.df)
        signals = run_strategy("rsi_macd", df_ind, {"rsi_lower": 30, "rsi_upper": 70}, None)
        self.assertEqual(len(signals), 100)
        self.assertTrue(set(signals.unique()).issubset({-1, 0, 1}))

    def test_trading_engine(self):
        db_path = "test_db.json"
        if os.path.exists(db_path):
            os.remove(db_path)
            
        engine = TradingEngine(db_path=db_path)
        self.assertEqual(engine.balance, 10000.0)
        
        # Test virtual execution
        success = engine.execute_order("BTC-USD", "BUY", 0.1, 50000.0, "test")
        self.assertTrue(success)
        self.assertEqual(engine.balance, 5000.0)
        self.assertIn("BTC-USD", engine.positions)
        self.assertEqual(engine.positions["BTC-USD"]["qty"], 0.1)
        
        # Cleanup
        if os.path.exists(db_path):
            os.remove(db_path)

if __name__ == "__main__":
    unittest.main()
