import { EnrichedCandle } from "../indicators/indicators";

export type SignalV5 =
  | "BUY"
  | "SELL"
  | "HOLD";

export interface StrategyResultV5 {
  signal: SignalV5;
  score: number;
  bullishScore: number;
  bearishScore: number;
  reasons: string[];
}

export function generateSignalV5(
  candle: EnrichedCandle,
  previousCandle?: EnrichedCandle
): StrategyResultV5 {

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
   * 1. TREND
   * =========================
   *
   * EMA20 > EMA50 > EMA200
   *
   * This is our strongest
   * long-term confirmation.
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

    reasons.push(
      "Bullish EMA alignment"
    );

  } else if (bearishTrend) {

    bearishScore += 3;

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
   * 2. PRICE vs EMA20
   * =========================
   */

  if (
    candle.close >
    candle.ema20
  ) {

    bullishScore += 1;

    reasons.push(
      "Price above EMA20"
    );

  } else {

    bearishScore += 1;

    reasons.push(
      "Price below EMA20"
    );
  }

  /*
   * =========================
   * 3. RSI
   * =========================
   *
   * Ideal long zone:
   *
   * 50 - 70
   *
   * Avoid buying when RSI
   * is already extremely high.
   */

  if (
    candle.rsi >= 50 &&
    candle.rsi <= 70
  ) {

    bullishScore += 2;

    reasons.push(
      `RSI bullish (${candle.rsi.toFixed(2)})`
    );

  } else if (
    candle.rsi < 45
  ) {

    bearishScore += 2;

    reasons.push(
      `RSI bearish (${candle.rsi.toFixed(2)})`
    );

  } else if (
    candle.rsi > 70
  ) {

    reasons.push(
      `RSI overbought (${candle.rsi.toFixed(2)})`
    );

  } else {

    reasons.push(
      `RSI neutral (${candle.rsi.toFixed(2)})`
    );
  }

  /*
   * =========================
   * 4. MACD
   * =========================
   *
   * Bullish requires:
   *
   * MACD > Signal
   * Histogram > 0
   */

  const bullishMacd =
    candle.macd >
    candle.macdSignal &&
    candle.macdHistogram > 0;

  const bearishMacd =
    candle.macd <
    candle.macdSignal &&
    candle.macdHistogram < 0;

  if (bullishMacd) {

    bullishScore += 2;

    reasons.push(
      "MACD bullish confirmation"
    );

  } else if (bearishMacd) {

    bearishScore += 2;

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
   * 5. MACD MOMENTUM
   * =========================
   *
   * Compare histogram with
   * previous candle.
   */

  if (
    previousCandle?.macdHistogram !== undefined
  ) {

    if (
      candle.macdHistogram >
      previousCandle.macdHistogram
    ) {

      bullishScore += 1;

      reasons.push(
        "MACD momentum improving"
      );

    } else if (
      candle.macdHistogram <
      previousCandle.macdHistogram
    ) {

      bearishScore += 1;

      reasons.push(
        "MACD momentum weakening"
      );
    }
  }

  /*
   * =========================
   * 6. VOLUME
   * =========================
   *
   * Normal confirmation:
   *
   * Volume > SMA
   *
   * Strong confirmation:
   *
   * Volume > 1.2 × SMA
   */

  if (
    candle.volume >
    candle.volumeSma * 1.2
  ) {

    bullishScore += 2;

    reasons.push(
      "Strong volume confirmation"
    );

  } else if (
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
   * 7. PRICE MOMENTUM
   * =========================
   *
   * If previous candle exists,
   * check whether price is
   * moving higher.
   */

  if (
    previousCandle !== undefined
  ) {

    if (
      candle.close >
      previousCandle.close
    ) {

      bullishScore += 1;

      reasons.push(
        "Price momentum positive"
      );

    } else if (
      candle.close <
      previousCandle.close
    ) {

      bearishScore += 1;

      reasons.push(
        "Price momentum negative"
      );
    }
  }

  /*
   * =========================
   * FINAL SIGNAL
   * =========================
   *
   * Maximum bullish score:
   *
   * Trend       3
   * Price       1
   * RSI         2
   * MACD        2
   * MACD mom    1
   * Volume      2
   * Price mom   1
   *
   * Total = 12
   *
   * We require at least 8.
   */

  let signal: SignalV5 = "HOLD";

  /*
   * BUY
   *
   * Require:
   *
   * 1. Strong trend
   * 2. RSI not overbought
   * 3. MACD confirmation
   * 4. Score >= 8
   */

  if (
    bullishTrend &&
    candle.rsi >= 50 &&
    candle.rsi <= 70 &&
    bullishMacd &&
    bullishScore >= 8
  ) {

    signal = "BUY";

  }

  /*
   * SELL
   *
   * For your system SELL means:
   *
   * "Avoid buying / consider exiting"
   *
   * We are NOT using this
   * for short selling.
   */

  else if (
    bearishTrend &&
    bearishMacd &&
    candle.rsi < 45 &&
    bearishScore >= 7
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