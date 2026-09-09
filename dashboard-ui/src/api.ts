import axios from "axios";

const API_BASE = "http://localhost:4000/api";

export interface SupportResistance {
  support: number[];
  resistance: number[];
  nearestSupport: number | null;
  nearestResistance: number | null;
}

export interface LiveSignal {
  stock: string;
  file: string;
  asOfDate: string;
  lastClose: number;
  signal: "BUY" | "SELL" | "HOLD";
  reasons: string[];
  metrics: Metric[];
  suggestedEntry: number | null;
  stopLoss: number | null;
  target: number | null;
  riskPerShare: number | null;
  rewardPerShare: number | null;
  rating: {
    grade: "A" | "B" | "C" | "D" | "N/A";
    score: number;
    historicalTrades: number;
    historicalWinRate: number;
    historicalProfitFactor: number;
  };
  supportResistance: SupportResistance;
}

export interface StockListItem {
  name: string;
  file: string;
}

export interface HistoryCandle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  ema20?: number;
  ema50?: number;
  ema200?: number;
  rsi?: number;
  adx?: number;
  atr?: number;
  supportResistance: SupportResistance;
}

export interface StockHistory {
  stock: string;
  candles: HistoryCandle[];
}

export interface Metric {
  label: string;
  value: string;
  status: "pass" | "fail" | "neutral";
  threshold: string;
}

export interface TradePotential {
  entry: number;
  stopLoss: number;
  target: number;
  riskAmount: number;
  riskPercent: number;
  rewardAmount: number;
  rewardPercent: number;
  riskRewardRatio: number;
}

export interface LiveMarketSignal {
  stock: string;
  symbol: string;
  currentPrice: number;
  marketState: string;
  priceAsOf: string;
  signal: "BUY" | "SELL" | "HOLD";
  reasons: string[];
  metrics: Metric[];
  passCount: number;
  totalChecks: number;
  entry: number | null;
  stopLoss: number | null;
  target: number | null;
  potential: TradePotential;
  isFinal: boolean;
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

export interface RankedStock extends LiveMarketSignal {
  opportunityScore: number;
  rank: number;
}

const client = axios.create({ baseURL: API_BASE, timeout: 30000 });

export async function fetchSignals(): Promise<LiveSignal[]> {
  const res = await client.get<{ success: boolean; data: LiveSignal[] }>(
    "/signals"
  );
  return res.data.data;
}

export async function fetchLiveMarketSignals(): Promise<{
  signals: LiveMarketSignal[];
  warnings: string[];
}> {
  // Longer timeout — this endpoint makes real network
  // calls to Yahoo Finance for every stock, sequentially.
  const res = await client.get<{
    success: boolean;
    data: LiveMarketSignal[];
    warnings?: string[];
  }>("/live-signals", { timeout: 60000 });
  return { signals: res.data.data, warnings: res.data.warnings ?? [] };
}

export async function fetchBestStocks(): Promise<{
  ranked: RankedStock[];
  warnings: string[];
}> {
  const res = await client.get<{
    success: boolean;
    data: RankedStock[];
    warnings?: string[];
  }>("/best-stocks", { timeout: 60000 });
  return { ranked: res.data.data, warnings: res.data.warnings ?? [] };
}

export async function fetchWatchlist(): Promise<{
  watchlist: LiveMarketSignal[];
  warnings: string[];
}> {
  const res = await client.get<{
    success: boolean;
    data: LiveMarketSignal[];
    warnings?: string[];
  }>("/watchlist", { timeout: 60000 });
  return { watchlist: res.data.data, warnings: res.data.warnings ?? [] };
}

export async function fetchStockList(): Promise<StockListItem[]> {
  const res = await client.get<{ success: boolean; data: StockListItem[] }>(
    "/stocks"
  );
  return res.data.data;
}

export async function fetchHistory(file: string): Promise<StockHistory> {
  const res = await client.get<{ success: boolean; data: StockHistory }>(
    `/history/${file}`
  );
  return res.data.data;
}
