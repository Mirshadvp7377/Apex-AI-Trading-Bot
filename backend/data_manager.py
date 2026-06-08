import pandas as pd
import yfinance as yf
import numpy as np
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

def fetch_historical_data(symbol: str, timeframe: str = "1d", limit: int = 500) -> pd.DataFrame:
    """
    Fetches historical OHLCV data for a symbol.
    Timeframe options: '5m', '15m', '1h', '1d', '1wk'
    """
    tf_mapping = {
        "5m": ("7d", "5m"),
        "15m": ("30d", "15m"),
        "1h": ("60d", "1h"),
        "1d": ("2y", "1d"),
        "1wk": ("5y", "1wk")
    }
    
    period, interval = tf_mapping.get(timeframe, ("2y", "1d"))
    
    yf_symbol = symbol.upper()
    # Normalize crypto naming for yfinance (e.g. BTC to BTC-USD)
    if yf_symbol in ["BTC", "ETH", "LTC", "SOL", "ADA", "DOGE"]:
        yf_symbol = f"{yf_symbol}-USD"
        
    try:
        logger.info(f"Fetching {yf_symbol} ({timeframe}) from yfinance")
        ticker = yf.Ticker(yf_symbol)
        df = ticker.history(period=period, interval=interval)
        if df.empty:
            raise ValueError(f"No data returned for symbol {yf_symbol}")
            
        df = df.reset_index()
        # Rename columns to normalize
        if "Date" in df.columns:
            df = df.rename(columns={"Date": "Timestamp"})
        elif "Datetime" in df.columns:
            df = df.rename(columns={"Datetime": "Timestamp"})
            
        df["Timestamp"] = pd.to_datetime(df["Timestamp"])
        
        df = df.rename(columns={
            "Open": "Open",
            "High": "High",
            "Low": "Low",
            "Close": "Close",
            "Volume": "Volume"
        })
        
        required_cols = ["Timestamp", "Open", "High", "Low", "Close", "Volume"]
        df = df[required_cols]
        df = df.sort_values("Timestamp").reset_index(drop=True)
        
        if len(df) > limit:
            df = df.iloc[-limit:].reset_index(drop=True)
            
        return df
    except Exception as e:
        logger.error(f"Error fetching data from yfinance for {symbol}: {str(e)}")
        # Try Binance fallback for crypto
        clean_symbol = symbol.replace("-", "").upper()
        if any(crypto in clean_symbol for crypto in ["BTC", "ETH", "LTC", "SOL", "ADA", "DOGE"]):
            base_symbol = clean_symbol
            if not base_symbol.endswith("USDT") and not base_symbol.endswith("USD"):
                base_symbol = f"{base_symbol}USDT"
            elif base_symbol.endswith("USD"):
                base_symbol = f"{base_symbol}T" # convert USD to USDT
                
            try:
                logger.info(f"Binance fallback active. Fetching {base_symbol} ({timeframe})")
                import requests
                interval_map = {
                    "5m": "5m",
                    "15m": "15m",
                    "1h": "1h",
                    "1d": "1d",
                    "1wk": "1w"
                }
                binance_interval = interval_map.get(timeframe, "1d")
                url = f"https://api.binance.com/api/v3/klines?symbol={base_symbol}&interval={binance_interval}&limit={limit}"
                r = requests.get(url, timeout=5)
                r.raise_for_status()
                data = r.json()
                
                rows = []
                for item in data:
                    rows.append({
                        "Timestamp": pd.to_datetime(item[0], unit='ms'),
                        "Open": float(item[1]),
                        "High": float(item[2]),
                        "Low": float(item[3]),
                        "Close": float(item[4]),
                        "Volume": float(item[5])
                    })
                return pd.DataFrame(rows)
            except Exception as binance_err:
                logger.error(f"Binance fallback failed: {str(binance_err)}")
                
        # Generate mock data
        logger.warning(f"Generating mock data for {symbol} due to fetching failures.")
        return generate_mock_data(symbol, timeframe, limit)

def generate_mock_data(symbol: str, timeframe: str = "1d", limit: int = 200) -> pd.DataFrame:
    """Generates a random-walk mock asset dataset."""
    np.random.seed(42)
    start_price = 100.0
    symbol_upper = symbol.upper()
    if "BTC" in symbol_upper:
        start_price = 68000.0
    elif "ETH" in symbol_upper:
        start_price = 3700.0
    elif "TSLA" in symbol_upper:
        start_price = 175.0
    elif "AAPL" in symbol_upper:
        start_price = 190.0
    elif "SOL" in symbol_upper:
        start_price = 150.0
        
    prices = [start_price]
    for _ in range(limit - 1):
        change = np.random.normal(0.0003, 0.015)
        prices.append(prices[-1] * (1.0 + change))
        
    time_delta = timedelta(days=1)
    if timeframe == "5m":
        time_delta = timedelta(minutes=5)
    elif timeframe == "15m":
        time_delta = timedelta(minutes=15)
    elif timeframe == "1h":
        time_delta = timedelta(hours=1)
    elif timeframe == "1wk":
        time_delta = timedelta(weeks=1)
        
    end_time = datetime.now()
    timestamps = [end_time - (limit - 1 - i) * time_delta for i in range(limit)]
    
    df = pd.DataFrame({
        "Timestamp": timestamps,
        "Close": prices
    })
    
    df["Open"] = df["Close"].shift(1).fillna(start_price) * (1.0 + np.random.normal(0, 0.002, len(df)))
    df["High"] = df[["Open", "Close"]].max(axis=1) * (1.0 + np.abs(np.random.normal(0.004, 0.004, len(df))))
    df["Low"] = df[["Open", "Close"]].min(axis=1) * (1.0 - np.abs(np.random.normal(0.004, 0.004, len(df))))
    df["Volume"] = np.random.randint(1000, 100000, len(df)) * 10.0
    
    return df[["Timestamp", "Open", "High", "Low", "Close", "Volume"]]
