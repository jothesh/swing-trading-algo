import {
  calculateIndicators,
  EnrichedCandle,
} from "../indicators/indicators";

import {
  calculateSupportResistance,
  SupportResistance,
} from "../indicators/supportResistance";

import {
  generateSignalV9,
  V9_RISK_PARAMS,
  Metric,
} from "../strategy/swingStrategyV9";

import { calculateTradePotential, TradePotential } from "../strategy/tradePotential";

import { runBacktest, calculateStats, rateStock } from "../backtest/engine";
import { loadCsv } from "../data/csvLoader";
import { fetchDailyHistory, fetchLiveQuote } from "../data/yahooProvider";
import { LIVE_STOCKS, StockConfig } from "../config/stocks";
import path from "path";
import fs from "fs";

export interface LiveMarketSignal {
  stock: string;
  symbol: string;

  currentPrice: number;
  marketState: string; // "REGULAR" (market open), "CLOSED", "PRE", "POST"
  priceAsOf: string; // ISO timestamp of the live quote

  // THE signal — computed using TODAY's live price
  // (open/high/low so far, current price as the
  // running close) together with all prior days'
  // trend/momentum context (EMA, RSI, MACD, ADX,
  // volume, and yesterday's candle for momentum
  // comparison). This is what you asked for:
  // today's data + previous data, run through the
  // full V8 strategy logic, as ONE answer.
  signal: "BUY" | "SELL" | "HOLD";
  reasons: string[];
  metrics: Metric[];

  // How many of the metrics above are currently
  // "pass" — a quick-glance sense of how close a
  // stock is to a real signal, for your own review.
  // This is NOT itself a validated trading rule (we
  // tested that approach and it lost money — see
  // strategy notes) — it's just a sorting aid.
  passCount: number;
  totalChecks: number;

  entry: number | null;
  stopLoss: number | null;
  target: number | null;

  // What a trade would look like RIGHT NOW at the
  // current price, using this stock's live ATR —
  // calculated regardless of signal, so you can
  // judge the potential yourself even on a HOLD.
  potential: TradePotential;

  // Honest caveat, not a second signal: while the
  // market is open, today's candle is still forming,
  // so this can change before the close. Once the
  // market closes, this IS the final signal for today.
  isFinal: boolean;

  // For reference only — what the strategy said using
  // YESTERDAY's fully closed candle (i.e. before
  // today's price action). Useful to see if today
  // changed anything, not the primary answer.
  previousDaySignal: {
    asOfDate: string;
    signal: "BUY" | "SELL" | "HOLD";
  };

  supportResistance: SupportResistance;

  rating: {
    grade: "A" | "B" | "C" | "D" | "N/A";
    score: number;
    historicalTrades: number;
    historicalWinRate: number;
    historicalProfitFactor: number;
  };
}

/*
 * Evaluate one stock using LIVE Yahoo Finance
 * data instead of the static local CSV.
 *
 * The historical CSV is still used for the
 * "rating" (win rate/profit factor), since
 * that's the validated 3-year backtest dataset —
 * only the SIGNAL itself uses fresh live data.
 */
export async function evaluateStockLive(
  stock: StockConfig,
  dataDir: string
): Promise<LiveMarketSignal | null> {

  // 1. Fetch fresh daily history + live quote from Yahoo Finance.
  const [history, quote] = await Promise.all([
    fetchDailyHistory(stock.symbol, 400),
    fetchLiveQuote(stock.symbol),
  ]);

  if (history.length < 210) {
    console.warn(
      `⚠️  ${stock.name}: only ${history.length} candles returned by ` +
      `Yahoo Finance, need 210+ for reliable indicators. Skipping.`
    );
    return null;
  }

  if (!quote) {
    console.warn(`⚠️  ${stock.name}: could not fetch live quote. Skipping.`);
    return null;
  }

  // 2. Does the history already include today's (possibly
  // still-forming) candle, or do we need to append one
  // using the live quote?
  const todayStr = new Date().toISOString().slice(0, 10);
  const lastHistoryDate = history[history.length - 1]?.date;

  let workingCandles = [...history];

  if (lastHistoryDate !== todayStr) {
    workingCandles.push({
      date: todayStr,
      open: quote.dayOpen,
      high: quote.dayHigh,
      low: quote.dayLow,
      close: quote.currentPrice, // "close so far" — will change until market closes
      volume: 0, // not meaningful mid-day; strategy volume checks are tolerant of low readings here
    });
  } else {
    // Yahoo already gave us today's row — patch it with
    // the freshest live price rather than trusting a
    // possibly-stale intraday close from the chart endpoint.
    const last = workingCandles[workingCandles.length - 1];
    if (last) {
      last.close = quote.currentPrice;
      last.high = Math.max(last.high, quote.dayHigh);
      last.low = Math.min(last.low, quote.dayLow);
    }
  }

  const enriched = calculateIndicators(workingCandles);

  // TODAY's candle (live-patched) plus YESTERDAY's
  // fully closed candle for momentum comparison —
  // this is "today's data + previous data" run
  // through the full V8 strategy logic, as one signal.
  const todayCandle = enriched[enriched.length - 1];
  const yesterdayCandle = enriched[enriched.length - 2];
  const dayBeforeYesterday = enriched[enriched.length - 3];

  if (!todayCandle) {
    return null;
  }

  const isMarketOpen =
    quote.marketState === "REGULAR" || quote.marketState === "PRE";

  const result = generateSignalV9(todayCandle, yesterdayCandle);

  const passCount = result.metrics.filter(m => m.status === "pass").length;

  let entry: number | null = null;
  let stopLoss: number | null = null;
  let target: number | null = null;

  if (result.signal === "BUY" && todayCandle.atr) {
    entry = todayCandle.close; // current live price
    stopLoss = entry - todayCandle.atr * V9_RISK_PARAMS.atrStopMultiplier;
    target = entry + todayCandle.atr * V9_RISK_PARAMS.atrTargetMultiplier;
  }

  // Calculated regardless of signal — "if I bought
  // this right now at the current price, here's what
  // the risk/reward would look like" — so you can
  // review potential yourself even on a HOLD/SELL day.
  const potential = calculateTradePotential(
    todayCandle.close,
    todayCandle.atr ?? 0,
    V9_RISK_PARAMS.atrStopMultiplier,
    V9_RISK_PARAMS.atrTargetMultiplier
  );

  // Reference only: what the strategy said using
  // yesterday's fully closed candle, BEFORE today's
  // price action. Lets you see if today changed anything.
  let previousDaySignal: LiveMarketSignal["previousDaySignal"] = {
    asOfDate: "",
    signal: "HOLD",
  };

  if (yesterdayCandle) {
    const prevResult = generateSignalV9(yesterdayCandle, dayBeforeYesterday);
    previousDaySignal = {
      asOfDate: yesterdayCandle.date,
      signal: prevResult.signal,
    };
  }

  // 5. Support/resistance using today's live-patched data.
  const supportResistance = calculateSupportResistance(
    enriched,
    enriched.length - 1
  );

  // 6. Rating from the LOCAL historical CSV (the
  // validated 3-year backtest), not the live data.
  const csvPath = path.join(dataDir, stock.file);
  let rating: LiveMarketSignal["rating"] = {
    grade: "N/A",
    score: 0,
    historicalTrades: 0,
    historicalWinRate: 0,
    historicalProfitFactor: 0,
  };

  if (!fs.existsSync(csvPath)) {
    // Not an error — just means this stock hasn't had
    // its historical data fetched yet. Log once, briefly,
    // instead of a full stack trace on every request.
    console.log(
      `ℹ️  No historical data for ${stock.name} yet (rating will show N/A). ` +
      `Run: npx tsx src/scripts/addStock.ts "${stock.name}" ${stock.symbol}`
    );
  } else {
    try {
      const csvCandles = await loadCsv(csvPath);
      const csvEnriched = calculateIndicators(csvCandles);
      const backtestResult = runBacktest(csvEnriched);
      const stats = calculateStats(
        backtestResult.trades,
        backtestResult.profit,
        backtestResult.charges
      );
      const ratingResult = rateStock(stats);
      rating = {
        grade: ratingResult.grade,
        score: ratingResult.score,
        historicalTrades: stats.trades,
        historicalWinRate: stats.winRate,
        historicalProfitFactor: stats.profitFactor,
      };
    } catch (error) {
      // Genuinely unexpected (e.g. malformed CSV) — worth
      // the full detail here, since the file DOES exist.
      console.warn(`Could not compute historical rating for ${stock.name}:`, error);
    }
  }

  return {
    stock: stock.name,
    symbol: stock.symbol,
    currentPrice: quote.currentPrice,
    marketState: quote.marketState,
    priceAsOf: quote.timestamp.toISOString(),
    signal: result.signal,
    reasons: result.reasons,
    metrics: result.metrics,
    passCount,
    totalChecks: result.metrics.length,
    entry,
    stopLoss,
    target,
    potential,
    isFinal: !isMarketOpen,
    previousDaySignal,
    supportResistance,
    rating,
  };
}

export async function getWatchlist(
  dataDir: string
): Promise<{ watchlist: LiveMarketSignal[]; errors: string[] }> {

  const { signals, errors } = await getAllLiveMarketSignals(dataDir);

  // Sort by how close each stock is to a real signal
  // (passCount), then BUY/SELL above HOLD as a tiebreak.
  // This is NOT a validated ranking — see the note in
  // LiveMarketSignal.passCount — it's purely so you can
  // scan from "closest to a setup" to "furthest" and
  // apply your own judgment using the full checklist
  // and potential shown for each one.
  const sorted = [...signals].sort((a, b) => {
    if (b.passCount !== a.passCount) return b.passCount - a.passCount;
    const aActionable = a.signal !== "HOLD";
    const bActionable = b.signal !== "HOLD";
    if (aActionable && !bActionable) return -1;
    if (!aActionable && bActionable) return 1;
    return 0;
  });

  return { watchlist: sorted, errors };
}

export async function getAllLiveMarketSignals(
  dataDir: string
): Promise<{ signals: LiveMarketSignal[]; errors: string[] }> {

  const results: LiveMarketSignal[] = [];
  const errors: string[] = [];

  // Sequential, not parallel — deliberately gentle on
  // Yahoo's unofficial API to avoid rate-limit issues.
  for (const stock of LIVE_STOCKS) {
    try {
      const signal = await evaluateStockLive(stock, dataDir);
      if (signal) {
        results.push(signal);
      } else {
        errors.push(`${stock.name}: no data returned`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`Failed to evaluate ${stock.name} live:`, error);
      errors.push(`${stock.name}: ${msg}`);
    }
  }

  results.sort((a, b) => {
    const aBuy = a.signal === "BUY";
    const bBuy = b.signal === "BUY";
    if (aBuy && !bBuy) return -1;
    if (!aBuy && bBuy) return 1;
    return b.rating.score - a.rating.score;
  });

  return { signals: results, errors };
}

/*
 * ==========================================
 * "BEST STOCK RIGHT NOW" RANKING
 * ==========================================
 *
 * Instead of scanning a big table yourself, this
 * combines signal + rating into one opportunity
 * score and ranks every stock from best to worst.
 *
 * Scoring logic (simple and transparent on purpose):
 *   BUY signal:  100 + rating score (0-100)   -> 100-200 range
 *   SELL signal:  rating score halved, as a
 *                 "worth watching to avoid" flag -> low range
 *   HOLD signal:  rating score only (0-100)   -> shows quality
 *                 without an active opportunity
 *
 * This means: a BUY signal always ranks above every
 * HOLD, regardless of grade — because an active
 * opportunity right now matters more than a
 * generally good stock sitting on the sidelines.
 * Among BUYs, higher historical grade ranks first.
 */
export interface RankedStock extends LiveMarketSignal {
  opportunityScore: number;
  rank: number;
}

export async function getBestStocks(
  dataDir: string
): Promise<{ ranked: RankedStock[]; errors: string[] }> {

  const { signals, errors } = await getAllLiveMarketSignals(dataDir);

  const withScore = signals.map(s => {
    let opportunityScore = s.rating.score;

    if (s.signal === "BUY") {
      opportunityScore = 100 + s.rating.score;
    } else if (s.signal === "SELL") {
      opportunityScore = s.rating.score * 0.5;
    }

    return { ...s, opportunityScore, rank: 0 };
  });

  withScore.sort((a, b) => b.opportunityScore - a.opportunityScore);

  const ranked = withScore.map((s, index) => ({ ...s, rank: index + 1 }));

  return { ranked, errors };
}

if (require.main === module) {
  (async () => {
    const dataDir = path.join(process.cwd(), "data", "daily");
    console.log("Fetching live market signals... (this calls Yahoo Finance and may take a moment)");
    const { signals, errors } = await getAllLiveMarketSignals(dataDir);
    console.table(
      signals.map(s => ({
        Stock: s.stock,
        CurrentPrice: s.currentPrice.toFixed(2),
        MarketState: s.marketState,
        Signal: s.signal,
        IsFinal: s.isFinal ? "Yes (market closed)" : "No (market open, may change)",
        PrevDaySignal: s.previousDaySignal.signal,
        Rating: s.rating.grade,
      }))
    );
    if (errors.length > 0) {
      console.log("\nErrors encountered:");
      errors.forEach(e => console.log(`  - ${e}`));
    }
  })().catch(error => {
    console.error("❌ Live market signal fetch failed:", error);
    process.exit(1);
  });
}
