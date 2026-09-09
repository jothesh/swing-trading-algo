import { EnrichedCandle } from "../indicators/indicators";

export type Signal =
  | "BUY"
  | "SELL"
  | "HOLD";

export interface StrategyResult {
  signal: Signal;
  score: number;
  reasons: string[];
}

export function generateSignal(
  candle: EnrichedCandle
): StrategyResult {

  const reasons: string[] = [];

  let bullishScore = 0;
  let bearishScore = 0;

  /*
   * Make sure all indicators exist.
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
      reasons: [
        "Indicators not available",
      ],
    };
  }

  /*
   * =========================
   * TREND
   * =========================
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
  }

  /*
   * =========================
   * RSI
   * =========================
   */

  if (candle.rsi > 50) {

    bullishScore += 1;

    reasons.push(
      "RSI above 50"
    );

  } else {

    bearishScore += 1;

    reasons.push(
      "RSI below 50"
    );
  }

  /*
   * =========================
   * MACD
   * =========================
   */

  if (
    candle.macd >
    candle.macdSignal
  ) {

    bullishScore += 1;

    reasons.push(
      "MACD above signal"
    );

  } else {

    bearishScore += 1;

    reasons.push(
      "MACD below signal"
    );
  }

  /*
   * =========================
   * VOLUME
   * =========================
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

    bearishScore += 1;

    reasons.push(
      "Volume below average"
    );
  }

  /*
   * =========================
   * FINAL SIGNAL
   * =========================
   */

  let signal: Signal = "HOLD";

  /*
   * Require strong confirmation
   */

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
    reasons,
  };
}