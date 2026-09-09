import { V9_EXCLUDED_STOCKS } from "../strategy/swingStrategyV9";

export interface StockConfig {
  name: string;
  file: string; // local CSV filename, used for historical backtest/rating
  symbol: string; // Yahoo Finance symbol for live data (NSE = .NS suffix)
}

export const ALL_STOCKS: StockConfig[] = [
  { name: "Tata Steel", file: "TATASTEEL.csv", symbol: "TATASTEEL.NS" },
  { name: "Suzlon Energy", file: "SUZLON.csv", symbol: "SUZLON.NS" },
  { name: "Vodafone Idea", file: "IDEA.csv", symbol: "IDEA.NS" },
  { name: "Yes Bank", file: "YESBANK.csv", symbol: "YESBANK.NS" },
  { name: "Ujjivan Small Finance Bank", file: "UJJIVANSFB.csv", symbol: "UJJIVANSFB.NS" },
  { name: "South Indian Bank", file: "SOUTHBANK.csv", symbol: "SOUTHBANK.NS" },
  { name: "NHPC", file: "NHPC.csv", symbol: "NHPC.NS" },
  { name: "Indian Railway Finance Corporation", file: "IRFC.csv", symbol: "IRFC.NS" },
  { name: "Union Bank of India", file: "UNIONBANK.csv", symbol: "UNIONBANK.NS" },
  { name: "Bank of Baroda", file: "BANKBARODA.csv", symbol: "BANKBARODA.NS" },
  { name: "Punjab National Bank", file: "PNB.csv", symbol: "PNB.NS" },
  { name: "IDFC First Bank", file: "IDFCFIRSTB.csv", symbol: "IDFCFIRSTB.NS" },
  { name: "Canara Bank", file: "CANBK.csv", symbol: "CANBK.NS" },
  { name: "Chandrima Mercantiles", file: "CHANDRIMA.csv", symbol: "CHANDRIMA.BO" }, // BSE-listed only — note .BO suffix, not .NS
];

// Live/production universe = all stocks minus the ones
// consistently unprofitable across every backtest version.
export const LIVE_STOCKS = ALL_STOCKS.filter(
  s => !V9_EXCLUDED_STOCKS.includes(s.file)
);
