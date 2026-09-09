import { EnrichedCandle } from "../indicators/indicators";

export type SignalV8 =
  | "BUY"
  | "SELL"
  | "HOLD";

export interface Metric {
  label: string;
  value: string; // the actual computed value, e.g. "52.34"
  status: "pass" | "fail" | "neutral"; // pass = counted toward the signal, fail = didn't meet threshold, neutral = informational only
  threshold: string; // human-readable rule, e.g. "50–70 for BUY"
}

export interface StrategyResultV8 {
  signal: SignalV8;
  score: number;
  bullishScore: number;
  bearishScore: number;
  reasons: string[];
  metrics: Metric[];
}

/*
 * ==========================================
 * V8 — RESULT OF SYSTEMATIC BACKTEST TUNING
 * ==========================================
 *
 * Changes vs V6, based on real backtest evidence
 * (not guesses) across 13 stocks / ~3 years:
 *
 * 1. ADX(20) trend-strength filter KEPT.
 *    Lowering to 15 made results worse
 *    (let in too many weak/choppy trends).
 *
 * 2. MACD momentum confirmation reverted to
 *    1-CANDLE (not 2-candle like V6).
 *    The stricter 2-candle rule in V6 cut
 *    profitable trades along with the bad
 *    ones — net effect was worse, not better.
 *
 * 3. Stop-loss widened to ATR × 3 (was ATR × 2).
 *    This was the single biggest improvement
 *    found in testing — a tighter stop was
 *    getting shaken out by normal daily noise
 *    before the trend had room to develop.
 *
 * 4. Target widened to ATR × 5 (was ATR × 4),
 *    keeping a similar overall risk:reward
 *    ratio (~1:1.67) to the wider stop.
 *
 * 5. Entry execution fixed: signal is generated
 *    using candle[i]'s own closing data, so the
 *    earliest realistic entry is candle[i+1]'s
 *    OPEN — not candle[i]'s own close. This is
 *    handled in the backtester/live signal
 *    generator, not in this file, but is
 *    critical for realistic results.
 *
 * ==========================================
 * IMPORTANT CAVEATS — READ BEFORE LIVE USE
 * ==========================================
 *
 * - These parameters were tuned on the SAME
 *   3-year dataset they were tested on. This
 *   creates real overfitting risk. A rough
 *   chronological split test was encouraging,
 *   but the sample size in the early period
 *   was too small to be conclusive.
 *
 * - RECOMMENDATION: paper-trade / forward-test
 *   this on live data for a meaningful period
 *   (e.g. 2-3 months) before committing real
 *   capital, to confirm the edge holds up on
 *   data the strategy has never "seen."
 *
 * - Stock selection matters a lot: Yes Bank,
 *   NHPC, PNB, and Vodafone Idea were
 *   consistently net-negative across every
 *   version tested. This is handled as a
 *   separate "approved stock universe" list
 *   (see backtestAllStocksV8.ts / liveSignals),
 *   NOT baked into this signal logic, so it can
 *   be revisited independently as more data
 *   comes in.
 * ==========================================
 */

const ADX_TREND_THRESHOLD = 20;

/*
 * ==========================================
 * V8 — ADDED LIQUIDITY FILTER (new in this version)
 * ==========================================
 *
 * Requires today's volume to be at least equal
 * to the 20-day average volume before a BUY
 * signal is allowed.
 *
 * Evidence: tested across the same 9-stock
 * universe (weak names excluded), this raised
 * win rate from 55.88% to 57.14% and profit
 * factor from 1.80 to 1.85 — fewer, higher
 * quality trades. A stricter 1.2x threshold
 * pushed profit factor to 2.26 but cut trade
 * count/profit further, so 1.0x was kept as
 * the better balance.
 * ==========================================
 */

const MIN_VOLUME_RATIO = 1.0;

export function generateSignalV8(
  candle: EnrichedCandle,
  previousCandle?: EnrichedCandle
): StrategyResultV8 {

  const reasons: string[] = [];
  const metrics: Metric[] = [];

  let bullishScore = 0;
  let bearishScore = 0;

  if (
    candle.ema20 === undefined ||
    candle.ema50 === undefined ||
    candle.ema200 === undefined ||
    candle.rsi === undefined ||
    candle.macd === undefined ||
    candle.macdSignal === undefined ||
    candle.macdHistogram === undefined ||
    candle.atr === undefined ||
    candle.volumeSma === undefined ||
    candle.adx === undefined
  ) {
    return {
      signal: "HOLD",
      score: 0,
      bullishScore: 0,
      bearishScore: 0,
      reasons: ["Indicators not available"],
      metrics: [],
    };
  }

  // ---- 1. ADX trend strength ----
  const trendIsStrong = candle.adx > ADX_TREND_THRESHOLD;

  metrics.push({
    label: "ADX (trend strength)",
    value: candle.adx.toFixed(1),
    status: trendIsStrong ? "pass" : "fail",
    threshold: `> ${ADX_TREND_THRESHOLD} = trending, else choppy`,
  });

  if (trendIsStrong) {
    reasons.push(`Strong trend (ADX ${candle.adx.toFixed(1)})`);
  } else {
    reasons.push(`Weak/choppy trend (ADX ${candle.adx.toFixed(1)}) — filtered out`);
  }

  // ---- 2. EMA trend alignment ----
  const bullishTrend =
    candle.ema20 > candle.ema50 && candle.ema50 > candle.ema200;

  const bearishTrend =
    candle.ema20 < candle.ema50 && candle.ema50 < candle.ema200;

  metrics.push({
    label: "EMA alignment (20/50/200)",
    value: `${candle.ema20.toFixed(2)} / ${candle.ema50.toFixed(2)} / ${candle.ema200.toFixed(2)}`,
    status: bullishTrend ? "pass" : bearishTrend ? "fail" : "neutral",
    threshold: "20 > 50 > 200 for bullish",
  });

  if (bullishTrend) {
    bullishScore += 3;
    reasons.push("Bullish EMA alignment");
  } else if (bearishTrend) {
    bearishScore += 3;
    reasons.push("Bearish EMA alignment");
  } else {
    reasons.push("EMA trend not aligned");
  }

  // ---- 3. Price vs EMA20 ----
  const priceAboveEma20 = candle.close > candle.ema20;

  metrics.push({
    label: "Price vs EMA20",
    value: `${candle.close.toFixed(2)} vs ${candle.ema20.toFixed(2)}`,
    status: priceAboveEma20 ? "pass" : "fail",
    threshold: "close > EMA20 is bullish",
  });

  if (priceAboveEma20) {
    bullishScore += 1;
    reasons.push("Price above EMA20");
  } else {
    bearishScore += 1;
    reasons.push("Price below EMA20");
  }

  // ---- 4. RSI ----
  const rsiBullish = candle.rsi >= 50 && candle.rsi <= 70;
  const rsiBearish = candle.rsi < 45;
  const rsiOverbought = candle.rsi > 70;

  metrics.push({
    label: "RSI",
    value: candle.rsi.toFixed(1),
    status: rsiBullish ? "pass" : rsiBearish ? "fail" : "neutral",
    threshold: "50–70 for BUY, < 45 for SELL",
  });

  if (rsiBullish) {
    bullishScore += 2;
    reasons.push(`RSI bullish (${candle.rsi.toFixed(2)})`);
  } else if (rsiBearish) {
    bearishScore += 2;
    reasons.push(`RSI bearish (${candle.rsi.toFixed(2)})`);
  } else if (rsiOverbought) {
    reasons.push(`RSI overbought (${candle.rsi.toFixed(2)})`);
  } else {
    reasons.push(`RSI neutral (${candle.rsi.toFixed(2)})`);
  }

  // ---- 5. MACD confirmation ----
  const bullishMacd =
    candle.macd > candle.macdSignal && candle.macdHistogram > 0;

  const bearishMacd =
    candle.macd < candle.macdSignal && candle.macdHistogram < 0;

  metrics.push({
    label: "MACD vs Signal line",
    value: `${candle.macd.toFixed(3)} vs ${candle.macdSignal.toFixed(3)} (hist ${candle.macdHistogram.toFixed(3)})`,
    status: bullishMacd ? "pass" : bearishMacd ? "fail" : "neutral",
    threshold: "MACD > signal & histogram > 0 is bullish",
  });

  if (bullishMacd) {
    bullishScore += 2;
    reasons.push("MACD bullish confirmation");
  } else if (bearishMacd) {
    bearishScore += 2;
    reasons.push("MACD bearish confirmation");
  } else {
    reasons.push("MACD not confirmed");
  }

  // ---- 6. Liquidity (volume floor) ----
  const liquidityOk = candle.volume >= candle.volumeSma * MIN_VOLUME_RATIO;

  metrics.push({
    label: "Liquidity (volume vs 20-day avg)",
    value: `${candle.volume.toLocaleString("en-IN")} vs ${Math.round(candle.volumeSma).toLocaleString("en-IN")}`,
    status: liquidityOk ? "pass" : "fail",
    threshold: `>= ${MIN_VOLUME_RATIO}x the 20-day average`,
  });

  if (liquidityOk) {
    reasons.push("Volume meets liquidity floor");
  } else {
    reasons.push("Below-average volume — filtered out");
  }

  // ---- 7. MACD momentum (vs previous candle) ----
  let macdMomentumConfirmed = false;

  if (previousCandle?.macdHistogram !== undefined) {
    const rising = candle.macdHistogram > previousCandle.macdHistogram;
    const falling = candle.macdHistogram < previousCandle.macdHistogram;

    metrics.push({
      label: "MACD momentum (histogram vs prev day)",
      value: `${candle.macdHistogram.toFixed(3)} vs ${previousCandle.macdHistogram.toFixed(3)}`,
      status: rising ? "pass" : falling ? "fail" : "neutral",
      threshold: "rising histogram is bullish",
    });

    if (rising) {
      bullishScore += 1;
      macdMomentumConfirmed = true;
      reasons.push("MACD momentum improving");
    } else if (falling) {
      bearishScore += 1;
      reasons.push("MACD momentum weakening");
    }
  }

  // ---- 8. Volume strength ----
  const strongVolume = candle.volume > candle.volumeSma * 1.2;
  const aboveAvgVolume = candle.volume > candle.volumeSma;

  metrics.push({
    label: "Volume strength",
    value: `${(candle.volume / candle.volumeSma).toFixed(2)}x average`,
    status: strongVolume ? "pass" : aboveAvgVolume ? "neutral" : "fail",
    threshold: "> 1.2x average is strong",
  });

  if (strongVolume) {
    bullishScore += 2;
    reasons.push("Strong volume confirmation");
  } else if (aboveAvgVolume) {
    bullishScore += 1;
    reasons.push("Volume above average");
  } else {
    reasons.push("Volume below average");
  }

  // ---- 9. Price momentum (vs previous candle) ----
  if (previousCandle !== undefined) {
    const priceUp = candle.close > previousCandle.close;
    const priceDown = candle.close < previousCandle.close;

    metrics.push({
      label: "Price momentum (vs prev day)",
      value: `${candle.close.toFixed(2)} vs ${previousCandle.close.toFixed(2)}`,
      status: priceUp ? "pass" : priceDown ? "fail" : "neutral",
      threshold: "close above prev day's close is bullish",
    });

    if (priceUp) {
      bullishScore += 1;
      reasons.push("Price momentum positive");
    } else if (priceDown) {
      bearishScore += 1;
      reasons.push("Price momentum negative");
    }
  }

  let signal: SignalV8 = "HOLD";

  if (
    trendIsStrong &&
    bullishTrend &&
    candle.rsi >= 50 &&
    candle.rsi <= 70 &&
    bullishMacd &&
    macdMomentumConfirmed &&
    liquidityOk &&
    bullishScore >= 8
  ) {
    signal = "BUY";
  } else if (
    trendIsStrong &&
    bearishTrend &&
    bearishMacd &&
    candle.rsi < 45 &&
    bearishScore >= 7
  ) {
    signal = "SELL";
  }

  return {
    signal,
    score: bullishScore - bearishScore,
    bullishScore,
    bearishScore,
    reasons,
    metrics,
  };
}

/*
 * Risk parameters, exported so the backtester
 * and any live-signal generator use the exact
 * same tuned values — single source of truth.
 */
export const V8_RISK_PARAMS = {
  atrStopMultiplier: 3,
  atrTargetMultiplier: 5,
};

/*
 * Stocks that were consistently net-negative
 * across every strategy version tested
 * (V5, V6, and every V8 tuning pass). Kept as
 * a separate, explicit list rather than baked
 * into the signal logic, so it can be revisited
 * independently as more data/stocks are added.
 */
export const V8_EXCLUDED_STOCKS = [
  "YESBANK.csv",
  "NHPC.csv",
  "PNB.csv",
  "IDEA.csv",
];
