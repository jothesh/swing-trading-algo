import { EnrichedCandle } from "./indicators";

export interface SupportResistance {
  support: number[]; // nearest levels below current price, closest first
  resistance: number[]; // nearest levels above current price, closest first
  nearestSupport: number | null;
  nearestResistance: number | null;
}

/*
 * ==========================================
 * SWING HIGH / LOW BASED SUPPORT & RESISTANCE
 * ==========================================
 *
 * A candle is a "swing high" if its high is
 * greater than the high of `strength` candles
 * on both sides of it — i.e. it's a local peak.
 * A "swing low" is the mirror case for lows.
 *
 * These swing points are treated as resistance
 * (swing highs) and support (swing lows) levels,
 * since price has historically reversed there.
 *
 * We look back over `lookback` candles from the
 * current one, collect all swing highs/lows in
 * that window, then return the closest few above
 * and below the current price.
 */

const DEFAULT_STRENGTH = 3;
const DEFAULT_LOOKBACK = 90;
const MAX_LEVELS = 3;

export function calculateSupportResistance(
  candles: EnrichedCandle[],
  currentIndex: number,
  strength: number = DEFAULT_STRENGTH,
  lookback: number = DEFAULT_LOOKBACK
): SupportResistance {

  const currentPrice = candles[currentIndex]?.close;

  if (currentPrice === undefined) {
    return {
      support: [],
      resistance: [],
      nearestSupport: null,
      nearestResistance: null,
    };
  }

  const windowStart = Math.max(
    strength,
    currentIndex - lookback
  );

  const windowEnd = Math.min(
    candles.length - strength - 1,
    currentIndex - strength
  );

  const swingHighs: number[] = [];
  const swingLows: number[] = [];

  for (let i = windowStart; i <= windowEnd; i++) {

    const candle = candles[i];
    if (!candle) continue;

    let isSwingHigh = true;
    let isSwingLow = true;

    for (let offset = 1; offset <= strength; offset++) {

      const left = candles[i - offset];
      const right = candles[i + offset];

      if (!left || !right) {
        isSwingHigh = false;
        isSwingLow = false;
        break;
      }

      if (
        left.high >= candle.high ||
        right.high >= candle.high
      ) {
        isSwingHigh = false;
      }

      if (
        left.low <= candle.low ||
        right.low <= candle.low
      ) {
        isSwingLow = false;
      }
    }

    if (isSwingHigh) swingHighs.push(candle.high);
    if (isSwingLow) swingLows.push(candle.low);
  }

  // Resistance = swing highs ABOVE current price, closest first
  const resistance = swingHighs
    .filter(level => level > currentPrice)
    .sort((a, b) => a - b)
    .slice(0, MAX_LEVELS);

  // Support = swing lows BELOW current price, closest first
  const support = swingLows
    .filter(level => level < currentPrice)
    .sort((a, b) => b - a)
    .slice(0, MAX_LEVELS);

  return {
    support,
    resistance,
    nearestSupport: support[0] ?? null,
    nearestResistance: resistance[0] ?? null,
  };
}
