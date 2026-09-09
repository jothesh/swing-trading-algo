import { EnrichedCandle } from "../indicators/indicators";

export type SignalV4 =
  | "BUY"
  | "SELL"
  | "HOLD";

export interface StrategyResultV4 {
  signal: SignalV4;
  score: number;
  bullishScore: number;
  bearishScore: number;
  reasons: string[];
}

export function generateSignalV4(
  candle: EnrichedCandle
): StrategyResultV4 {

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
    candle.volumeSma === undefined
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
   * 1. EMA TREND
   * =========================
   *
   * Strong bullish:
   *
   * EMA20 > EMA50 > EMA200
   *
   * Strong bearish:
   *
   * EMA20 < EMA50 < EMA200
   */

  if (
    candle.ema20 >
      candle.ema50 &&
    candle.ema50 >
      candle.ema200
  ) {

    bullishScore += 2;

    reasons.push(
      "Bullish EMA alignment"
    );

  } else if (
    candle.ema20 <
      candle.ema50 &&
    candle.ema50 <
      candle.ema200
  ) {

    bearishScore += 2;

    reasons.push(
      "Bearish EMA alignment"
    );

  } else {

    reasons.push(
      "EMA trend not aligned"
    );
  }

  /*
   * =========================
   * 2. RSI
   * =========================
   *
   * We use zones instead of
   * simply RSI > 50.
   *
   * > 55  = bullish
   * < 45  = bearish
   * 45-55 = neutral
   */

  if (candle.rsi > 55) {

    bullishScore += 1;

    reasons.push(
      "RSI strongly bullish (>55)"
    );

  } else if (candle.rsi < 45) {

    bearishScore += 1;

    reasons.push(
      "RSI strongly bearish (<45)"
    );

  } else {

    reasons.push(
      "RSI neutral (45-55)"
    );
  }

  /*
   * =========================
   * 3. MACD
   * =========================
   *
   * We require both:
   *
   * MACD > Signal
   * AND
   * Histogram > 0
   *
   * for bullish confirmation.
   */

  if (
    candle.macd >
      candle.macdSignal &&
    candle.macdHistogram > 0
  ) {

    bullishScore += 1;

    reasons.push(
      "MACD bullish confirmation"
    );

  } else if (
    candle.macd <
      candle.macdSignal &&
    candle.macdHistogram < 0
  ) {

    bearishScore += 1;

    reasons.push(
      "MACD bearish confirmation"
    );

  } else {

    reasons.push(
      "MACD not confirmed"
    );
  }

  /*
   * =========================
   * 4. VOLUME
   * =========================
   *
   * Volume above SMA confirms
   * participation.
   *
   * Volume below average is
   * NOT automatically bearish.
   */

  if (
    candle.volume >
    candle.volumeSma
  ) {

    bullishScore += 1;

    reasons.push(
      "Volume above average"
    );

  } else {

    reasons.push(
      "Volume below average"
    );
  }

  /*
   * =========================
   * FINAL SIGNAL
   * =========================
   *
   * BUY:
   * bullish score >= 4
   *
   * SELL:
   * bearish score >= 4
   *
   * Otherwise HOLD.
   */

  let signal: SignalV4 = "HOLD";

  if (
    bullishScore >= 4
  ) {

    signal = "BUY";

  } else if (
    bearishScore >= 4
  ) {

    signal = "SELL";
  }

  return {
    signal,
    score:
      bullishScore -
      bearishScore,
    bullishScore,
    bearishScore,
    reasons,
  };
}