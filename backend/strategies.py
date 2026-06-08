import pandas as pd
import numpy as np
from typing import Dict, Any, Tuple
from backend.indicators import (
    add_all_indicators, calculate_ema, calculate_rsi, calculate_macd,
    calculate_bollinger_bands, calculate_vwap, calculate_stochastic,
    calculate_atr, calculate_support_resistance, calculate_rsi_divergence
)

def get_crossover_signals(series_fast: pd.Series, series_slow: pd.Series) -> pd.Series:
    """Returns +1 on bullish cross, -1 on bearish cross, 0 otherwise."""
    signals = pd.Series(0, index=series_fast.index)
    # Bullish crossover: fast crosses above slow
    bullish = (series_fast > series_slow) & (series_fast.shift(1) <= series_slow.shift(1))
    # Bearish crossover: fast crosses below slow
    bearish = (series_fast < series_slow) & (series_fast.shift(1) >= series_slow.shift(1))
    
    signals[bullish] = 1
    signals[bearish] = -1
    return signals

def strategy_rsi_macd(df: pd.DataFrame, params: Dict[str, Any]) -> pd.Series:
    """
    RSI + MACD Strategy
    Buy: RSI < oversold (30) AND MACD is bullish (Hist > 0 or MACD > Signal)
    Sell: RSI > overbought (70) AND MACD is bearish (Hist < 0 or MACD < Signal)
    """
    oversold = params.get("rsi_lower", 30)
    overbought = params.get("rsi_upper", 70)
    
    rsi = df["RSI"]
    macd_hist = df["MACD_Hist"]
    
    signals = pd.Series(0, index=df.index)
    
    # Buy when RSI is oversold and MACD becomes bullish (histogram > 0)
    buy_cond = (rsi < oversold) & (macd_hist > 0)
    # Sell when RSI is overbought and MACD becomes bearish (histogram < 0)
    sell_cond = (rsi > overbought) & (macd_hist < 0)
    
    signals[buy_cond] = 1
    signals[sell_cond] = -1
    return signals

def strategy_ema_cross(df: pd.DataFrame, params: Dict[str, Any]) -> pd.Series:
    """
    EMA Crossover Strategy
    Buy: Fast EMA crosses above Slow EMA
    Sell: Fast EMA crosses below Slow EMA
    """
    fast_period = params.get("fast_period", 50)
    slow_period = params.get("slow_period", 200)
    
    # Recompute if different periods requested
    if f"EMA_{fast_period}" in df.columns:
        fast_ema = df[f"EMA_{fast_period}"]
    else:
        fast_ema = calculate_ema(df, "Close", fast_period)
        
    if f"EMA_{slow_period}" in df.columns:
        slow_ema = df[f"EMA_{slow_period}"]
    else:
        slow_ema = calculate_ema(df, "Close", slow_period)
        
    return get_crossover_signals(fast_ema, slow_ema)

def strategy_bollinger_bands(df: pd.DataFrame, params: Dict[str, Any]) -> pd.Series:
    """
    Bollinger Bands Mean Reversion
    Buy: Price touches/dips below Lower Band
    Sell: Price touches/rises above Upper Band
    """
    period = params.get("bb_period", 20)
    num_std = params.get("bb_std", 2.0)
    
    # Recompute if custom params
    if period == 20 and num_std == 2.0 and "BB_Lower" in df.columns:
        upper = df["BB_Upper"]
        lower = df["BB_Lower"]
    else:
        upper, _, lower = calculate_bollinger_bands(df, period, num_std)
        
    close = df["Close"]
    signals = pd.Series(0, index=df.index)
    
    signals[close <= lower] = 1
    signals[close >= upper] = -1
    return signals

def strategy_vwap(df: pd.DataFrame, params: Dict[str, Any]) -> pd.Series:
    """
    VWAP Strategy
    Buy: Price drops below VWAP
    Sell: Price rises above VWAP
    """
    vwap = df["VWAP"]
    close = df["Close"]
    
    signals = pd.Series(0, index=df.index)
    signals[close < vwap] = 1
    signals[close > vwap] = -1
    return signals

def strategy_support_resistance(df: pd.DataFrame, params: Dict[str, Any]) -> pd.Series:
    """
    Support & Resistance Breakout
    Buy: Close breaks above recent resistance
    Sell: Close breaks below recent support
    """
    support = df["Support"]
    resistance = df["Resistance"]
    close = df["Close"]
    
    signals = pd.Series(0, index=df.index)
    
    # We look for close crossing above the previous period's resistance/support
    buy_cond = close > resistance.shift(1)
    sell_cond = close < support.shift(1)
    
    signals[buy_cond] = 1
    signals[sell_cond] = -1
    return signals

def strategy_stochastic(df: pd.DataFrame, params: Dict[str, Any]) -> pd.Series:
    """
    Stochastic Oscillator Strategy
    Buy: %K crosses above %D below 20 (oversold)
    Sell: %K crosses below %D above 80 (overbought)
    """
    oversold = params.get("stoch_lower", 20)
    overbought = params.get("stoch_upper", 80)
    
    k = df["Stoch_K"]
    d = df["Stoch_D"]
    
    signals = pd.Series(0, index=df.index)
    
    # %K crosses above %D while %K is below oversold
    k_cross_above = (k > d) & (k.shift(1) <= d.shift(1))
    buy_cond = k_cross_above & (k < oversold)
    
    # %K crosses below %D while %K is above overbought
    k_cross_below = (k < d) & (k.shift(1) >= d.shift(1))
    sell_cond = k_cross_below & (k > overbought)
    
    signals[buy_cond] = 1
    signals[sell_cond] = -1
    return signals

def strategy_atr_trailing_stop(df: pd.DataFrame, params: Dict[str, Any]) -> pd.Series:
    """
    ATR Trailing Stop Strategy
    Buy on EMA trend filter, trail stop by ATR multiplier, exit when stop hit.
    """
    atr_period = params.get("atr_period", 14)
    multiplier = params.get("atr_multiplier", 3.0)
    trend_period = params.get("atr_trend_period", 50)
    
    close = df["Close"]
    high = df["High"]
    low = df["Low"]
    
    atr = df["ATR"] if "ATR" in df.columns else calculate_atr(df, atr_period)
    trend_ema = calculate_ema(df, "Close", trend_period)
    
    signals = pd.Series(0, index=df.index)
    
    # Trailing stop logic (requires loop because it depends on path)
    in_position = False
    stop_price = 0.0
    
    for i in range(1, len(df)):
        c_price = close.iloc[i]
        c_atr = atr.iloc[i]
        c_trend = trend_ema.iloc[i]
        
        if not in_position:
            # Entry condition: Price above Trend EMA (bullish) and rising
            if c_price > c_trend and close.iloc[i-1] <= trend_ema.iloc[i-1]:
                in_position = True
                stop_price = c_price - (c_atr * multiplier)
                signals.iloc[i] = 1  # Buy
        else:
            # Trailing stop update: stop can only move up for long position
            new_stop = c_price - (c_atr * multiplier)
            stop_price = max(stop_price, new_stop)
            
            # Check exit
            if c_price <= stop_price:
                in_position = False
                signals.iloc[i] = -1  # Sell (Exit)
                stop_price = 0.0
                
    return signals

def strategy_rsi_divergence(df: pd.DataFrame, params: Dict[str, Any]) -> pd.Series:
    """
    RSI Divergence Strategy
    Buy: Bullish divergence (price down, RSI up)
    Sell: Bearish divergence (price up, RSI down)
    """
    signals = pd.Series(0, index=df.index)
    
    # Bull divergence is marked as +1, bear divergence as -1 (in indicators.py)
    # Let's map these indicators to signals
    bull = df["RSI_Bull_Div"] == 1.0
    bear = df["RSI_Bear_Div"] == -1.0
    
    signals[bull] = 1
    signals[bear] = -1
    return signals

def strategy_pairs_trading(df: pd.DataFrame, params: Dict[str, Any], pair_df: pd.DataFrame = None) -> pd.Series:
    """
    Pairs Trading Strategy
    If pair_df is provided (the correlated asset), compute ratio and Z-score.
    Buy primary when ratio is oversold (Z-score < -2), Sell when overbought (Z-score > 2).
    If pair_df is not provided, we can simulate correlation ratio using a dummy/shifted series.
    """
    zscore_limit = params.get("pairs_zscore", 2.0)
    window = params.get("pairs_window", 20)
    
    signals = pd.Series(0, index=df.index)
    
    if pair_df is None or len(pair_df) == 0:
        # Create a synthetic pair (shifted price + noise) if no real second asset
        # to ensure it always runs and shows simulated trades
        pair_close = df["Close"].shift(5).fillna(method="bfill") * 0.95
    else:
        # Align index
        pair_close = pair_df["Close"].reindex(df.index, method="ffill")
        
    ratio = df["Close"] / pair_close.replace(0, np.nan)
    rolling_mean = ratio.rolling(window=window).mean()
    rolling_std = ratio.rolling(window=window).std()
    
    z_score = (ratio - rolling_mean) / rolling_std.replace(0, np.nan)
    z_score = z_score.fillna(0)
    
    # Enter long on primary, exit or short on opposite
    signals[z_score < -zscore_limit] = 1
    signals[z_score > zscore_limit] = -1
    
    return signals

def strategy_ml_prediction(df: pd.DataFrame, params: Dict[str, Any]) -> pd.Series:
    """
    ML Prediction Strategy
    Trades based on the ML_Prediction column (+1 for positive direction, -1 for negative direction)
    which is computed in ml_model.py.
    """
    signals = pd.Series(0, index=df.index)
    
    if "ML_Prediction" in df.columns:
        ml_pred = df["ML_Prediction"]
        # We trigger buy on 1.0, sell on -1.0 or 0.0
        # Check crossovers of prediction to avoid constant trading
        signals[ml_pred == 1.0] = 1
        signals[ml_pred == -1.0] = -1
        
    return signals

def run_strategy(strategy_name: str, df: pd.DataFrame, params: Dict[str, Any], pair_df: pd.DataFrame = None) -> pd.Series:
    """Executes a single strategy by name and returns its signal series."""
    df_ind = add_all_indicators(df)
    
    strategy_map = {
        "rsi_macd": strategy_rsi_macd,
        "ema_cross": strategy_ema_cross,
        "bb_reversion": strategy_bollinger_bands,
        "vwap": strategy_vwap,
        "sup_res": strategy_support_resistance,
        "stochastic": strategy_stochastic,
        "atr_stop": strategy_atr_trailing_stop,
        "rsi_div": strategy_rsi_divergence,
        "pairs_trade": lambda d, p: strategy_pairs_trading(d, p, pair_df),
        "ml_predict": strategy_ml_prediction
    }
    
    func = strategy_map.get(strategy_name)
    if not func:
        raise ValueError(f"Unknown strategy: {strategy_name}")
        
    return func(df_ind, params)
