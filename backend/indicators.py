import pandas as pd
import numpy as np

def calculate_ema(df: pd.DataFrame, column: str, period: int) -> pd.Series:
    return df[column].ewm(span=period, adjust=False).mean()

def calculate_rsi(df: pd.DataFrame, period: int = 14) -> pd.Series:
    delta = df['Close'].diff()
    gain = delta.clip(lower=0)
    loss = -1 * delta.clip(upper=0)
    
    # Use exponential moving average for Wilder's smoothing
    avg_gain = gain.ewm(alpha=1/period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1/period, adjust=False).mean()
    
    rs = avg_gain / avg_loss.replace(0, np.nan)
    rsi = 100 - (100 / (1 + rs))
    return rsi.fillna(50)

def calculate_macd(df: pd.DataFrame, fast_period: int = 12, slow_period: int = 26, signal_period: int = 9):
    fast_ema = df['Close'].ewm(span=fast_period, adjust=False).mean()
    slow_ema = df['Close'].ewm(span=slow_period, adjust=False).mean()
    macd_line = fast_ema - slow_ema
    signal_line = macd_line.ewm(span=signal_period, adjust=False).mean()
    histogram = macd_line - signal_line
    return macd_line, signal_line, histogram

def calculate_bollinger_bands(df: pd.DataFrame, period: int = 20, num_std: float = 2.0):
    sma = df['Close'].rolling(window=period).mean()
    std = df['Close'].rolling(window=period).std()
    upper_band = sma + (std * num_std)
    lower_band = sma - (std * num_std)
    return upper_band, sma, lower_band

def calculate_vwap(df: pd.DataFrame, period: int = 14) -> pd.Series:
    typical_price = (df['High'] + df['Low'] + df['Close']) / 3.0
    tp_vol = typical_price * df['Volume']
    
    # Check if we have standard datetime index and can group by day for intraday
    if isinstance(df.index, pd.DatetimeIndex) and len(df) > 1 and (df.index[1] - df.index[0]).total_seconds() < 86400:
        # Group by day and compute cumulative sum
        group = df.groupby(df.index.date)
        cum_tp_vol = group.apply(lambda x: (x['High'] + x['Low'] + x['Close']) / 3.0 * x['Volume']).groupby(df.index.date).cumsum()
        cum_vol = df['Volume'].groupby(df.index.date).cumsum()
        vwap = cum_tp_vol / cum_vol.replace(0, np.nan)
        return vwap.fillna(typical_price)
    else:
        # Rolling VWAP for daily/weekly charts
        rolling_tp_vol = tp_vol.rolling(window=period, min_periods=1).sum()
        rolling_vol = df['Volume'].rolling(window=period, min_periods=1).sum()
        vwap = rolling_tp_vol / rolling_vol.replace(0, np.nan)
        return vwap.fillna(typical_price)

def calculate_stochastic(df: pd.DataFrame, k_period: int = 14, d_period: int = 3):
    low_min = df['Low'].rolling(window=k_period).min()
    high_max = df['High'].rolling(window=k_period).max()
    
    k = 100 * ((df['Close'] - low_min) / (high_max - low_min).replace(0, np.nan))
    d = k.rolling(window=d_period).mean()
    return k.fillna(50), d.fillna(50)

def calculate_atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    high_low = df['High'] - df['Low']
    high_close_prev = (df['High'] - df['Close'].shift(1)).abs()
    low_close_prev = (df['Low'] - df['Close'].shift(1)).abs()
    
    tr = pd.concat([high_low, high_close_prev, low_close_prev], axis=1).max(axis=1)
    atr = tr.ewm(alpha=1/period, adjust=False).mean()
    return atr.fillna(tr.rolling(window=period).mean()).fillna(0)

def calculate_support_resistance(df: pd.DataFrame, period: int = 20):
    # Support: local minimum over rolling window
    # Resistance: local maximum over rolling window
    support = df['Low'].rolling(window=period, min_periods=5).min()
    resistance = df['High'].rolling(window=period, min_periods=5).max()
    return support, resistance

def calculate_rsi_divergence(df: pd.DataFrame, rsi_period: int = 14, lookback: int = 15):
    """
    Identifies RSI Divergence:
    - Bullish Divergence: Price lower low, RSI higher low. Signal: +1 (Buy)
    - Bearish Divergence: Price higher high, RSI lower high. Signal: -1 (Sell)
    """
    rsi = calculate_rsi(df, rsi_period)
    close = df['Close']
    
    bullish_div = pd.Series(0.0, index=df.index)
    bearish_div = pd.Series(0.0, index=df.index)
    
    for i in range(lookback, len(df)):
        window_close = close.iloc[i-lookback:i+1]
        
        # Check if current bar is a local low in price
        if close.iloc[i] == window_close.min():
            prev_close_window = window_close.iloc[:-5]
            if len(prev_close_window) > 0:
                prev_low_idx = prev_close_window.idxmin()
                # Check if current close is lower than previous low
                if close.iloc[i] < close.loc[prev_low_idx]:
                    # Check if RSI at current bar is higher than RSI at previous price low
                    if rsi.iloc[i] > rsi.loc[prev_low_idx] and rsi.iloc[i] < 40:
                        bullish_div.iloc[i] = 1.0
                        
        # Bearish divergence search
        if close.iloc[i] == window_close.max():
            prev_close_window = window_close.iloc[:-5]
            if len(prev_close_window) > 0:
                prev_high_idx = prev_close_window.idxmax()
                # Check if current close is higher than previous high
                if close.iloc[i] > close.loc[prev_high_idx]:
                    # Check if RSI at current bar is lower than RSI at previous price high
                    if rsi.iloc[i] < rsi.loc[prev_high_idx] and rsi.iloc[i] > 60:
                        bearish_div.iloc[i] = -1.0
                        
    return bullish_div, bearish_div

def add_all_indicators(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    for col in ['Open', 'High', 'Low', 'Close', 'Volume']:
        if col not in df.columns:
            raise ValueError(f"DataFrame must contain column {col}")
            
    df['RSI'] = calculate_rsi(df)
    macd_line, signal_line, histogram = calculate_macd(df)
    df['MACD'] = macd_line
    df['MACD_Signal'] = signal_line
    df['MACD_Hist'] = histogram
    
    df['EMA_50'] = calculate_ema(df, 'Close', 50)
    df['EMA_200'] = calculate_ema(df, 'Close', 200)
    
    upper, middle, lower = calculate_bollinger_bands(df)
    df['BB_Upper'] = upper
    df['BB_Middle'] = middle
    df['BB_Lower'] = lower
    
    df['VWAP'] = calculate_vwap(df)
    
    support, resistance = calculate_support_resistance(df)
    df['Support'] = support
    df['Resistance'] = resistance
    
    stoch_k, stoch_d = calculate_stochastic(df)
    df['Stoch_K'] = stoch_k
    df['Stoch_D'] = stoch_d
    
    df['ATR'] = calculate_atr(df)
    
    bull_div, bear_div = calculate_rsi_divergence(df)
    df['RSI_Bull_Div'] = bull_div
    df['RSI_Bear_Div'] = bear_div
    
    return df
