import YahooFinance from "yahoo-finance2";
import { Candle } from "../indicators/indicators";

/*
 * yahoo-finance2 v4+ requires instantiating the
 * client — calling methods directly on the default
 * import (the old v2/v3 style) is deprecated and
 * intentionally typed as `never` to force this change.
 *
 * suppressNotices silences the one-time "please take
 * our survey" console message the library prints on
 * first use — harmless, just noisy.
 */
const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

/*
 * ==========================================
 * LIVE MARKET DATA PROVIDER (Yahoo Finance)
 * ==========================================
 *
 * IMPORTANT: this was written and type-checked
 * in a sandboxed environment that cannot reach
 * Yahoo Finance's servers to test live calls.
 * Please run this on your own machine (normal
 * internet access) and report back any errors —
 * Yahoo's unofficial API occasionally changes
 * shape, so minor field-name fixes may be needed.
 * ==========================================
 */

export interface LiveQuote {
  symbol: string;
  currentPrice: number;
  dayOpen: number;
  dayHigh: number;
  dayLow: number;
  previousClose: number;
  timestamp: Date;
  marketState: string; // e.g. "REGULAR", "CLOSED", "PRE"
}

/*
 * Fetches daily OHLCV history for a symbol,
 * going back `days` calendar days. We fetch
 * generously (default ~400 calendar days,
 * roughly 270-280 trading days) so there's
 * enough for the EMA200/ADX warm-up period
 * (~210 trading days) even after weekends/
 * holidays are excluded.
 */
export async function fetchDailyHistory(
  symbol: string,
  days: number = 400
): Promise<Candle[]> {

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const result = await yahooFinance.chart(symbol, {
    period1: startDate,
    period2: endDate,
    interval: "1d",
  });

  const quotes = result.quotes ?? [];

  const candles: Candle[] = quotes
    .filter(
      q =>
        q.open !== null &&
        q.open !== undefined &&
        q.high !== null &&
        q.low !== null &&
        q.close !== null
    )
    .map(q => ({
      date: formatDate(new Date(q.date)),
      open: q.open as number,
      high: q.high as number,
      low: q.low as number,
      close: q.close as number,
      volume: (q.volume as number) ?? 0,
    }));

  return candles;
}

/*
 * Fetches the current live quote for a symbol —
 * today's price as of right now (or the last
 * traded price if the market is closed).
 */
export async function fetchLiveQuote(
  symbol: string
): Promise<LiveQuote | null> {

  const quote = await yahooFinance.quote(symbol);

  if (!quote || quote.regularMarketPrice === undefined) {
    return null;
  }

  return {
    symbol,
    currentPrice: quote.regularMarketPrice,
    dayOpen: quote.regularMarketOpen ?? quote.regularMarketPrice,
    dayHigh: quote.regularMarketDayHigh ?? quote.regularMarketPrice,
    dayLow: quote.regularMarketDayLow ?? quote.regularMarketPrice,
    previousClose: quote.regularMarketPreviousClose ?? quote.regularMarketPrice,
    timestamp: quote.regularMarketTime
      ? new Date(quote.regularMarketTime)
      : new Date(),
    marketState: quote.marketState ?? "UNKNOWN",
  };
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
