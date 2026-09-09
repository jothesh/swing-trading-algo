import { generateAccessToken } from "./growwAuth";

export interface GrowwCandle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export async function getHistoricalCandles(
  growwSymbol: string,
  startTime: string,
  endTime: string,
  candleInterval: string
): Promise<GrowwCandle[]> {

  console.log("Generating Groww access token...");

  const accessToken = await generateAccessToken();

  console.log("Access token generated.");

  const params = new URLSearchParams({
    exchange: "NSE",
    segment: "CASH",
    groww_symbol: growwSymbol,
    start_time: startTime,
    end_time: endTime,
    candle_interval: candleInterval,
  });

  const url =
    `https://api.groww.in/v1/historical/candles?${params.toString()}`;

  console.log("Calling:");
  console.log(url);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "X-API-VERSION": "1.0",
    },
  });

  const data = await response.json();

  console.log("HTTP Status:", response.status);

  if (!response.ok) {
    throw new Error(
      `Groww historical data failed: ${JSON.stringify(data)}`
    );
  }

  if (data.status !== "SUCCESS") {
    throw new Error(
      `Groww returned failure: ${JSON.stringify(data)}`
    );
  }

  return data.payload?.candles ?? [];
}