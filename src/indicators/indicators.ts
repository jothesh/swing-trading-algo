import {
  EMA,
  RSI,
  MACD,
  ATR,
  SMA,
  ADX,
} from "technicalindicators";

export interface Candle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface EnrichedCandle extends Candle {
  ema20?: number;
  ema50?: number;
  ema200?: number;

  rsi?: number;

  macd?: number;
  macdSignal?: number;
  macdHistogram?: number;

  atr?: number;

  volumeSma?: number;

  /*
   * ADX: trend strength (0-100).
   * >25 is generally considered a
   * "trending" market; below that
   * is choppy/sideways.
   */
  adx?: number;
}

export function calculateIndicators(
  candles: Candle[]
): EnrichedCandle[] {

  if (candles.length === 0) {
    return [];
  }

  /*
   * Extract raw values
   */
  const closes = candles.map(
    candle => candle.close
  );

  const highs = candles.map(
    candle => candle.high
  );

  const lows = candles.map(
    candle => candle.low
  );

  const volumes = candles.map(
    candle => candle.volume
  );

  /*
   * Calculate EMA
   */
  const ema20 = EMA.calculate({
    period: 20,
    values: closes,
  });

  const ema50 = EMA.calculate({
    period: 50,
    values: closes,
  });

  const ema200 = EMA.calculate({
    period: 200,
    values: closes,
  });

  /*
   * Calculate RSI
   */
  const rsi = RSI.calculate({
    period: 14,
    values: closes,
  });

  /*
   * Calculate MACD
   */
  const macd = MACD.calculate({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });

  /*
   * Calculate ATR
   */
  const atr = ATR.calculate({
    period: 14,
    high: highs,
    low: lows,
    close: closes,
  });

  /*
   * Calculate Volume SMA
   */
  const volumeSma = SMA.calculate({
    period: 20,
    values: volumes,
  });

  /*
   * Calculate ADX (trend strength)
   */
  const adxResult = ADX.calculate({
    period: 14,
    high: highs,
    low: lows,
    close: closes,
  });

  /*
   * The technicalindicators library returns
   * shorter arrays because each indicator
   * needs a warm-up period.
   *
   * We therefore align every indicator
   * with the original candle index.
   */

  const ema20Start = 20 - 1;
  const ema50Start = 50 - 1;
  const ema200Start = 200 - 1;
  const rsiStart = 14;
  const macdStart = 26;
  const atrStart = 14;
  const volumeSmaStart = 20 - 1;

  /*
   * ADX warms up over roughly 2x period
   * because it is built on smoothed
   * directional movement + a further
   * smoothing pass. We derive the exact
   * offset from the returned array length
   * rather than hardcoding it, so this
   * stays correct even if the library
   * implementation changes.
   */
  const adxStart =
    candles.length - adxResult.length;

  /*
   * Create enriched candles.
   */
  const enriched: EnrichedCandle[] =
    candles.map((candle, index) => {

      const result: EnrichedCandle = {
        ...candle,
      };

      /*
       * EMA 20
       */
      if (index >= ema20Start) {
        result.ema20 =
          ema20[index - ema20Start];
      }

      /*
       * EMA 50
       */
      if (index >= ema50Start) {
        result.ema50 =
          ema50[index - ema50Start];
      }

      /*
       * EMA 200
       */
      if (index >= ema200Start) {
        result.ema200 =
          ema200[index - ema200Start];
      }

      /*
       * RSI
       */
      if (index >= rsiStart) {
        result.rsi =
          rsi[index - rsiStart];
      }

      /*
       * MACD
       */
      if (index >= macdStart) {

        const macdIndex =
          index - macdStart;

        const macdValue =
          macd[macdIndex];

        if (macdValue) {

          result.macd =
            macdValue.MACD;

          result.macdSignal =
            macdValue.signal;

          result.macdHistogram =
            macdValue.histogram;
        }
      }

      /*
       * ATR
       */
      if (index >= atrStart) {
        result.atr =
          atr[index - atrStart];
      }

      /*
       * Volume SMA
       */
      if (index >= volumeSmaStart) {
        result.volumeSma =
          volumeSma[index - volumeSmaStart];
      }

      /*
       * ADX
       */
      if (index >= adxStart) {
        const adxValue =
          adxResult[index - adxStart];

        if (adxValue) {
          result.adx = adxValue.adx;
        }
      }

      return result;
    });

  return enriched;
}