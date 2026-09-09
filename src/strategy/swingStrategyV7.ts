import { EnrichedCandle } from "../indicators/indicators";

export type SignalV7 =
  | "BUY"
  | "SELL"
  | "HOLD";

export interface StrategyResultV7 {
  signal: SignalV7;
  score: number;
  bullishScore: number;
  bearishScore: number;
  reasons: string[];
}

/*
 * ==========================================
 * V7 — RESULT OF SYSTEMATIC BACKTEST TUNING
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
 *   (see backtestAllStocksV7.ts / liveSignals),
 *   NOT baked into this signal logic, so it can
 *   be revisited independently as more data
 *   comes in.
 * ==========================================
 */

const ADX_TREND_THRESHOLD = 20;

export function generateSignalV7(
  candle: EnrichedCandle,
  previousCandle?: EnrichedCandle
): StrategyResultV7 {

  const reasons: string[] = [];

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
    };
  }

  const trendIsStrong = candle.adx > ADX_TREND_THRESHOLD;

  if (trendIsStrong) {
    reasons.push(`Strong trend (ADX ${candle.adx.toFixed(1)})`);
  } else {
    reasons.push(`Weak/choppy trend (ADX ${candle.adx.toFixed(1)}) — filtered out`);
  }

  const bullishTrend =
    candle.ema20 > candle.ema50 && candle.ema50 > candle.ema200;

  const bearishTrend =
    candle.ema20 < candle.ema50 && candle.ema50 < candle.ema200;

  if (bullishTrend) {
    bullishScore += 3;
    reasons.push("Bullish EMA alignment");
  } else if (bearishTrend) {
    bearishScore += 3;
    reasons.push("Bearish EMA alignment");
  } else {
    reasons.push("EMA trend not aligned");
  }

  if (candle.close > candle.ema20) {
    bullishScore += 1;
    reasons.push("Price above EMA20");
  } else {
    bearishScore += 1;
    reasons.push("Price below EMA20");
  }

  if (candle.rsi >= 50 && candle.rsi <= 70) {
    bullishScore += 2;
    reasons.push(`RSI bullish (${candle.rsi.toFixed(2)})`);
  } else if (candle.rsi < 45) {
    bearishScore += 2;
    reasons.push(`RSI bearish (${candle.rsi.toFixed(2)})`);
  } else if (candle.rsi > 70) {
    reasons.push(`RSI overbought (${candle.rsi.toFixed(2)})`);
  } else {
    reasons.push(`RSI neutral (${candle.rsi.toFixed(2)})`);
  }

  const bullishMacd =
    candle.macd > candle.macdSignal && candle.macdHistogram > 0;

  const bearishMacd =
    candle.macd < candle.macdSignal && candle.macdHistogram < 0;

  if (bullishMacd) {
    bullishScore += 2;
    reasons.push("MACD bullish confirmation");
  } else if (bearishMacd) {
    bearishScore += 2;
    reasons.push("MACD bearish confirmation");
  } else {
    reasons.push("MACD not confirmed");
  }

  let macdMomentumConfirmed = false;

  if (previousCandle?.macdHistogram !== undefined) {
    if (candle.macdHistogram > previousCandle.macdHistogram) {
      bullishScore += 1;
      macdMomentumConfirmed = true;
      reasons.push("MACD momentum improving");
    } else if (candle.macdHistogram < previousCandle.macdHistogram) {
      bearishScore += 1;
      reasons.push("MACD momentum weakening");
    }
  }

  if (candle.volume > candle.volumeSma * 1.2) {
    bullishScore += 2;
    reasons.push("Strong volume confirmation");
  } else if (candle.volume > candle.volumeSma) {
    bullishScore += 1;
    reasons.push("Volume above average");
  } else {
    reasons.push("Volume below average");
  }

  if (previousCandle !== undefined) {
    if (candle.close > previousCandle.close) {
      bullishScore += 1;
      reasons.push("Price momentum positive");
    } else if (candle.close < previousCandle.close) {
      bearishScore += 1;
      reasons.push("Price momentum negative");
    }
  }

  let signal: SignalV7 = "HOLD";

  if (
    trendIsStrong &&
    bullishTrend &&
    candle.rsi >= 50 &&
    candle.rsi <= 70 &&
    bullishMacd &&
    macdMomentumConfirmed &&
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
  };
}

/*
 * Risk parameters, exported so the backtester
 * and any live-signal generator use the exact
 * same tuned values — single source of truth.
 */
export const V7_RISK_PARAMS = {
  atrStopMultiplier: 3,
  atrTargetMultiplier: 5,
};

/*
 * Stocks that were consistently net-negative
 * across every strategy version tested
 * (V5, V6, and every V7 tuning pass). Kept as
 * a separate, explicit list rather than baked
 * into the signal logic, so it can be revisited
 * independently as more data/stocks are added.
 */
export const V7_EXCLUDED_STOCKS = [
  "YESBANK.csv",
  "NHPC.csv",
  "PNB.csv",
  "IDEA.csv",
];
