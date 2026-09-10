import express from "express";
import cors from "cors";
import path from "path";

import {
  getAllLiveSignals,
  getStockHistory,
  getLiveStockList,
} from "../live/liveSignals";

import { getAllLiveMarketSignals, getBestStocks, getWatchlist } from "../live/liveMarketSignals";

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

app.use(cors());
app.use(express.json());

const DATA_DIR = path.join(process.cwd(), "data", "daily");

/*
 * GET /api/signals
 * Returns today's live BUY/SELL/HOLD signal
 * for every approved stock, with rating and
 * support/resistance. Uses the LOCAL CSV data
 * (fast, works offline, but only as current as
 * your last CSV update).
 */
app.get("/api/signals", async (_req, res) => {
  try {
    const signals = await getAllLiveSignals(DATA_DIR);
    res.json({ success: true, data: signals });
  } catch (error) {
    console.error("Error fetching signals:", error);
    res.status(500).json({
      success: false,
      error: "Failed to compute live signals",
    });
  }
});

/*
 * GET /api/live-signals
 * Same idea, but fetches FRESH data from Yahoo
 * Finance for every stock (current price + recent
 * daily history) before running the V8 strategy.
 * Slower (real network calls per stock, run
 * sequentially to be gentle on Yahoo's API) but
 * reflects the actual current market price, not
 * just your last CSV update.
 */
app.get("/api/live-signals", async (_req, res) => {
  try {
    const { signals, errors } = await getAllLiveMarketSignals(DATA_DIR);

    if (signals.length === 0 && errors.length > 0) {
      res.status(502).json({
        success: false,
        error:
          "Could not fetch data for any stock from Yahoo Finance. " +
          "This is usually a network/connectivity issue, not a code bug.",
        details: errors,
      });
      return;
    }

    res.json({ success: true, data: signals, warnings: errors });
  } catch (error) {
    console.error("Error fetching live market signals:", error);
    res.status(500).json({
      success: false,
      error:
        "Failed to fetch live market data. Check your internet connection " +
        "— this endpoint calls Yahoo Finance directly.",
    });
  }
});

/*
 * GET /api/stocks
 * Returns the list of approved stocks (name + file),
 * so the frontend can build a stock picker.
 */
app.get("/api/stocks", (_req, res) => {
  res.json({ success: true, data: getLiveStockList() });
});

/*
 * GET /api/history/:file
 * Returns full enriched historical candle data
 * (with support/resistance at each point) for
 * one stock, identified by its CSV filename
 * (e.g. CANBK.csv).
 */
app.get("/api/history/:file", async (req, res) => {
  try {
    const { file } = req.params;

    const stock = getLiveStockList().find(s => s.file === file);

    if (!stock) {
      res.status(404).json({
        success: false,
        error: `Unknown stock file: ${file}`,
      });
      return;
    }

    const filePath = path.join(DATA_DIR, file);
    const history = await getStockHistory(stock.name, filePath);

    if (!history) {
      res.status(404).json({
        success: false,
        error: `No data found for ${file}`,
      });
      return;
    }

    res.json({ success: true, data: history });
  } catch (error) {
    console.error("Error fetching history:", error);
    res.status(500).json({
      success: false,
      error: "Failed to load stock history",
    });
  }
});

/*
 * GET /api/best-stocks
 * Runs the strategy on every approved stock and
 * returns them RANKED from best opportunity to
 * worst — a BUY signal always ranks above a HOLD,
 * and higher historical grade breaks ties. Use
 * this when you just want "which stock should I
 * look at right now" instead of scanning a table.
 */
app.get("/api/best-stocks", async (_req, res) => {
  try {
    const { ranked, errors } = await getBestStocks(DATA_DIR);

    if (ranked.length === 0 && errors.length > 0) {
      res.status(502).json({
        success: false,
        error:
          "Could not fetch data for any stock from Yahoo Finance. " +
          "This is usually a network/connectivity issue, not a code bug.",
        details: errors,
      });
      return;
    }

    res.json({ success: true, data: ranked, warnings: errors });
  } catch (error) {
    console.error("Error ranking stocks:", error);
    res.status(500).json({
      success: false,
      error: "Failed to rank stocks",
    });
  }
});

/*
 * GET /api/watchlist
 * Returns EVERY approved stock (not just ones with a
 * BUY/SELL signal) with its FULL checklist breakdown,
 * pass count, and calculated trade potential (target %,
 * risk %, R:R) at the current price — regardless of
 * what the automated signal says. Sorted by how many
 * checks each stock currently passes, so you can scan
 * from "closest to a real setup" to "furthest" and
 * apply your own judgment using the actual numbers.
 *
 * Important: passCount/ranking here is NOT a validated
 * trading rule — we tested loosening the signal logic
 * this way and it lost money in backtesting. This
 * endpoint is for YOUR manual review, not an alternate
 * automated signal.
 */
app.get("/api/watchlist", async (_req, res) => {
  try {
    const { watchlist, errors } = await getWatchlist(DATA_DIR);

    if (watchlist.length === 0 && errors.length > 0) {
      res.status(502).json({
        success: false,
        error:
          "Could not fetch data for any stock from Yahoo Finance. " +
          "This is usually a network/connectivity issue, not a code bug.",
        details: errors,
      });
      return;
    }

    res.json({ success: true, data: watchlist, warnings: errors });
  } catch (error) {
    console.error("Error building watchlist:", error);
    res.status(500).json({
      success: false,
      error: "Failed to build watchlist",
    });
  }
});

app.get("/api/health", (_req, res) => {  res.json({ success: true, status: "ok" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Swing trading API running on http://localhost:${PORT}`);
  console.log(`  GET /api/signals         — CSV-based signals (fast, offline)`);
  console.log(`  GET /api/live-signals    — LIVE Yahoo Finance data (slower, real-time)`);
  console.log(`  GET /api/stocks          — approved stock list`);
  console.log(`  GET /api/history/:file   — historical data for one stock`);
});
