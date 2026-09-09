import { EnrichedCandle } from "../indicators/indicators";

export type SignalV6 =
  | "BUY"
  | "SELL"
  | "HOLD";

export interface StrategyResultV6 {
  signal: SignalV6;
  score: number;
  bullishScore: number;
  bearishScore: number;
  reasons: string[];
}

/*
 * ==========================================
 * V6 CHANGES vs V5
 * ==========================================
 *
 * 1. ADX trend-strength filter — only trade
 *    when ADX > 20, meaning the market is
 *    actually trending, not choppy/sideways.
 *    This filters out setups where EMAs
 *    happen to be stacked correctly but
 *    price is just drifting.
 *
 * 2. 2-candle MACD histogram confirmation —
 *    require the histogram to be rising for
 *    2 consecutive candles (not just 1), to
 *    reduce single-day fakeout signals.
 *
 * NOTE: this file only decides WHETHER to
 * signal BUY/SELL on a given candle. Actual
 * trade entry timing (same-candle close vs.
 * next-candle open) is handled in the
 * backtester, since that is an execution
 * concern, not a signal concern.
 * ==========================================
 */

const ADX_TREND_THRESHOLD = 20;

export function generateSignalV6(
  candle: EnrichedCandle,
  previousCandle?: EnrichedCandle,
  twoCandlesAgo?: EnrichedCandle
): StrategyResultV6 {

  const reasons: string[] = [];

  let bullishScore = 0;
  let bearishScore = 0;

  /*
   * =========================
   * INDICATOR VALIDATION
   * =========================
   */

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
      reasons: [
        "Indicators not available",
      ],
    };
  }

  /*
   * =========================
   * 0. ADX TREND STRENGTH (NEW)
   * =========================
   */

  const trendIsStrong =
    candle.adx > ADX_TREND_THRESHOLD;

  if (trendIsStrong) {
    reasons.push(
      `Strong trend (ADX ${candle.adx.toFixed(1)})`
    );
  } else {
    reasons.push(
      `Weak/choppy trend (ADX ${candle.adx.toFixed(1)}) — filtered out`
    );
  }

  /*
   * =========================
   * 1. TREND
   * =========================
   */

  const bullishTrend =
    candle.ema20 >
    candle.ema50 &&
    candle.ema50 >
    candle.ema200;

  const bearishTrend =
    candle.ema20 <
    candle.ema50 &&
    candle.ema50 <
    candle.ema200;

  if (bullishTrend) {
    bullishScore += 3;
    reasons.push("Bullish EMA alignment");
  } else if (bearishTrend) {
    bearishScore += 3;
    reasons.push("Bearish EMA alignment");
  } else {
    reasons.push("EMA trend not aligned");
  }

  /*
   * =========================
   * 2. PRICE vs EMA20
   * =========================
   */

  if (candle.close > candle.ema20) {
    bullishScore += 1;
    reasons.push("Price above EMA20");
  } else {
    bearishScore += 1;
    reasons.push("Price below EMA20");
  }

  /*
   * =========================
   * 3. RSI
   * =========================
   */

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

  /*
   * =========================
   * 4. MACD
   * =========================
   */

  const bullishMacd =
    candle.macd > candle.macdSignal &&
    candle.macdHistogram > 0;

  const bearishMacd =
    candle.macd < candle.macdSignal &&
    candle.macdHistogram < 0;

  if (bullishMacd) {
    bullishScore += 2;
    reasons.push("MACD bullish confirmation");
  } else if (bearishMacd) {
    bearishScore += 2;
    reasons.push("MACD bearish confirmation");
  } else {
    reasons.push("MACD not confirmed");
  }

  /*
   * =========================
   * 5. MACD MOMENTUM — 2-CANDLE (NEW)
   * =========================
   *
   * V5 only checked 1 candle back.
   * V6 requires the histogram to be
   * rising across 2 consecutive candles
   * for full momentum credit, which is
   * a stronger, less noisy confirmation.
   */

  let macdMomentumConfirmed = false;

  if (
    previousCandle?.macdHistogram !== undefined
  ) {
    const risingOnce =
      candle.macdHistogram >
      previousCandle.macdHistogram;

    const risingTwice =
      risingOnce &&
      twoCandlesAgo?.macdHistogram !== undefined &&
      previousCandle.macdHistogram >
        twoCandlesAgo.macdHistogram;

    if (risingTwice) {
      bullishScore += 2;
      macdMomentumConfirmed = true;
      reasons.push("MACD momentum rising 2 candles in a row");
    } else if (risingOnce) {
      bullishScore += 1;
      reasons.push("MACD momentum improving (1 candle)");
    } else if (
      candle.macdHistogram <
      previousCandle.macdHistogram
    ) {
      bearishScore += 1;
      reasons.push("MACD momentum weakening");
    }
  }

  /*
   * =========================
   * 6. VOLUME
   * =========================
   */

  if (candle.volume > candle.volumeSma * 1.2) {
    bullishScore += 2;
    reasons.push("Strong volume confirmation");
  } else if (candle.volume > candle.volumeSma) {
    bullishScore += 1;
    reasons.push("Volume above average");
  } else {
    reasons.push("Volume below average");
  }

  /*
   * =========================
   * 7. PRICE MOMENTUM
   * =========================
   */

  if (previousCandle !== undefined) {
    if (candle.close > previousCandle.close) {
      bullishScore += 1;
      reasons.push("Price momentum positive");
    } else if (candle.close < previousCandle.close) {
      bearishScore += 1;
      reasons.push("Price momentum negative");
    }
  }

  /*
   * =========================
   * FINAL SIGNAL
   * =========================
   *
   * V6 requires everything V5 required,
   * PLUS:
   *  - ADX confirms a real trend
   *  - 2-candle MACD momentum confirmed
   *    (stronger bar than V5's 1-candle check)
   */

  let signal: SignalV6 = "HOLD";

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
