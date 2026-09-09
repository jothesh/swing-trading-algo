import { EnrichedCandle } from "../indicators/indicators";
import { generateSignal } from "../strategy/swingStrategy";

export interface Trade {
  entryDate: string;
  entryPrice: number;

  exitDate?: string;
  exitPrice?: number;

  quantity: number;

  stopLoss: number;
  target: number;

  grossProfit?: number;
  charges?: number;
  profit?: number;

  profitPercent?: number;

  result?: "WIN" | "LOSS";

  exitReason?:
    | "TARGET"
    | "STOP_LOSS"
    | "SIGNAL";
}

export interface BacktestResult {
  totalTrades: number;

  winningTrades: number;
  losingTrades: number;

  winRate: number;

  grossProfit: number;
  totalCharges: number;
  totalProfit: number;

  totalProfitPercent: number;

  averageProfit: number;
  averageLoss: number;

  profitFactor: number;

  expectancy: number;

  maxDrawdown: number;
  maxDrawdownPercent: number;

  maxConsecutiveLosses: number;

  trades: Trade[];
}

/*
 * ==========================================
 * TRANSACTION COST MODEL
 * ==========================================
 *
 * These are approximate costs for backtesting.
 *
 * They are NOT a replacement for the exact
 * charges shown by your broker.
 */

function calculateCharges(
  entryPrice: number,
  exitPrice: number,
  quantity: number
): number {

  const buyValue =
    entryPrice * quantity;

  const sellValue =
    exitPrice * quantity;

  /*
   * Example assumptions:
   *
   * Brokerage:
   * ₹20 or 0.03%, whichever is lower,
   * per executed order.
   */

  const buyBrokerage =
    Math.min(
      20,
      buyValue * 0.0003
    );

  const sellBrokerage =
    Math.min(
      20,
      sellValue * 0.0003
    );

  /*
   * STT on delivery sell.
   */

  const stt =
    sellValue * 0.001;

  /*
   * Exchange transaction charges.
   */

  const exchangeCharges =
    (buyValue + sellValue) *
    0.0000297;

  /*
   * SEBI charges.
   */

  const sebiCharges =
    (buyValue + sellValue) *
    0.000001;

  /*
   * Stamp duty on buy.
   */

  const stampDuty =
    buyValue * 0.00015;

  /*
   * GST.
   */

  const gst =
    (
      buyBrokerage +
      sellBrokerage +
      exchangeCharges +
      sebiCharges
    ) * 0.18;

  return (
    buyBrokerage +
    sellBrokerage +
    stt +
    exchangeCharges +
    sebiCharges +
    stampDuty +
    gst
  );
}

/*
 * ==========================================
 * BACKTEST
 * ==========================================
 */

export function backtest(
  candles: EnrichedCandle[],
  capitalPerTrade = 10000
): BacktestResult {

  const trades: Trade[] = [];

  let currentTrade:
    | Trade
    | null = null;

  const STOP_ATR_MULTIPLIER = 2;

  const TARGET_ATR_MULTIPLIER = 4;

  /*
   * ========================================
   * MAIN LOOP
   * ========================================
   */

  for (
    let i = 0;
    i < candles.length - 1;
    i++
  ) {

    const candle =
      candles[i];

    const nextCandle =
      candles[i + 1];

    /*
     * ======================================
     * MANAGE EXISTING POSITION
     * ======================================
     */

    if (
      currentTrade !== null
    ) {

      const stopLoss =
        currentTrade.stopLoss;

      const target =
        currentTrade.target;

      const stopHit =
        candle.low <= stopLoss;

      const targetHit =
        candle.high >= target;

      /*
       * If both happen on the same
       * candle, assume STOP LOSS first.
       */

      if (
        stopHit &&
        targetHit
      ) {

        const exitPrice =
          stopLoss;

        const grossProfit =
          (
            exitPrice -
            currentTrade.entryPrice
          ) *
          currentTrade.quantity;

        const charges =
          calculateCharges(
            currentTrade.entryPrice,
            exitPrice,
            currentTrade.quantity
          );

        const profit =
          grossProfit -
          charges;

        const profitPercent =
          (
            profit /
            (
              currentTrade.entryPrice *
              currentTrade.quantity
            )
          ) *
          100;

        trades.push({

          ...currentTrade,

          exitDate:
            candle.date,

          exitPrice,

          grossProfit,

          charges,

          profit,

          profitPercent,

          result: "LOSS",

          exitReason:
            "STOP_LOSS",
        });

        currentTrade = null;

        continue;
      }

      /*
       * TARGET
       */

      if (targetHit) {

        const exitPrice =
          target;

        const grossProfit =
          (
            exitPrice -
            currentTrade.entryPrice
          ) *
          currentTrade.quantity;

        const charges =
          calculateCharges(
            currentTrade.entryPrice,
            exitPrice,
            currentTrade.quantity
          );

        const profit =
          grossProfit -
          charges;

        const profitPercent =
          (
            profit /
            (
              currentTrade.entryPrice *
              currentTrade.quantity
            )
          ) *
          100;

        trades.push({

          ...currentTrade,

          exitDate:
            candle.date,

          exitPrice,

          grossProfit,

          charges,

          profit,

          profitPercent,

          result:
            profit >= 0
              ? "WIN"
              : "LOSS",

          exitReason:
            "TARGET",
        });

        currentTrade = null;

        continue;
      }

      /*
       * STOP LOSS
       */

      if (stopHit) {

        const exitPrice =
          stopLoss;

        const grossProfit =
          (
            exitPrice -
            currentTrade.entryPrice
          ) *
          currentTrade.quantity;

        const charges =
          calculateCharges(
            currentTrade.entryPrice,
            exitPrice,
            currentTrade.quantity
          );

        const profit =
          grossProfit -
          charges;

        const profitPercent =
          (
            profit /
            (
              currentTrade.entryPrice *
              currentTrade.quantity
            )
          ) *
          100;

        trades.push({

          ...currentTrade,

          exitDate:
            candle.date,

          exitPrice,

          grossProfit,

          charges,

          profit,

          profitPercent,

          result: "LOSS",

          exitReason:
            "STOP_LOSS",
        });

        currentTrade = null;

        continue;
      }

      /*
       * STRATEGY SELL
       */

      const strategy =
        generateSignal(
          candle
        );

      if (
        strategy.signal ===
        "SELL"
      ) {

        const exitPrice =
          nextCandle.open;

        const grossProfit =
          (
            exitPrice -
            currentTrade.entryPrice
          ) *
          currentTrade.quantity;

        const charges =
          calculateCharges(
            currentTrade.entryPrice,
            exitPrice,
            currentTrade.quantity
          );

        const profit =
          grossProfit -
          charges;

        const profitPercent =
          (
            profit /
            (
              currentTrade.entryPrice *
              currentTrade.quantity
            )
          ) *
          100;

        trades.push({

          ...currentTrade,

          exitDate:
            nextCandle.date,

          exitPrice,

          grossProfit,

          charges,

          profit,

          profitPercent,

          result:
            profit >= 0
              ? "WIN"
              : "LOSS",

          exitReason:
            "SIGNAL",
        });

        currentTrade = null;

        continue;
      }
    }

    /*
     * ======================================
     * ENTRY
     * ======================================
     */

    if (
      currentTrade === null
    ) {

      const strategy =
        generateSignal(
          candle
        );

      if (
        strategy.signal !==
        "BUY"
      ) {
        continue;
      }

      /*
       * ATR required.
       */

      if (
        candle.atr === undefined ||
        !Number.isFinite(
          candle.atr
        )
      ) {
        continue;
      }

      const entryPrice =
        nextCandle.open;

      if (
        !Number.isFinite(
          entryPrice
        ) ||
        entryPrice <= 0
      ) {
        continue;
      }

      const quantity =
        Math.floor(
          capitalPerTrade /
          entryPrice
        );

      if (
        quantity <= 0
      ) {
        continue;
      }

      const stopLoss =
        entryPrice -
        (
          candle.atr *
          STOP_ATR_MULTIPLIER
        );

      const target =
        entryPrice +
        (
          candle.atr *
          TARGET_ATR_MULTIPLIER
        );

      currentTrade = {

        entryDate:
          nextCandle.date,

        entryPrice,

        quantity,

        stopLoss,

        target,
      };
    }
  }

  /*
   * ==========================================
   * STATISTICS
   * ==========================================
   */

  const winningTrades =
    trades.filter(
      trade =>
        trade.result ===
        "WIN"
    );

  const losingTrades =
    trades.filter(
      trade =>
        trade.result ===
        "LOSS"
    );

  const grossProfit =
    trades.reduce(
      (sum, trade) =>
        sum +
        (
          trade.grossProfit ??
          0
        ),
      0
    );

  const totalCharges =
    trades.reduce(
      (sum, trade) =>
        sum +
        (
          trade.charges ??
          0
        ),
      0
    );

  const totalProfit =
    trades.reduce(
      (sum, trade) =>
        sum +
        (
          trade.profit ??
          0
        ),
      0
    );

  const totalInvested =
    trades.reduce(
      (sum, trade) =>
        sum +
        (
          trade.entryPrice *
          trade.quantity
        ),
      0
    );

  const totalProfitPercent =
    totalInvested > 0
      ? (
          totalProfit /
          totalInvested
        ) *
        100
      : 0;

  const averageProfit =
    winningTrades.length > 0
      ? winningTrades.reduce(
          (sum, trade) =>
            sum +
            (
              trade.profit ??
              0
            ),
          0
        ) /
        winningTrades.length
      : 0;

  const averageLoss =
    losingTrades.length > 0
      ? losingTrades.reduce(
          (sum, trade) =>
            sum +
            (
              trade.profit ??
              0
            ),
          0
        ) /
        losingTrades.length
      : 0;

  const grossWinningAmount =
    winningTrades.reduce(
      (sum, trade) =>
        sum +
        (
          trade.profit ??
          0
        ),
      0
    );

  const grossLosingAmount =
    Math.abs(
      losingTrades.reduce(
        (sum, trade) =>
          sum +
          (
            trade.profit ??
            0
          ),
        0
      )
    );

  const profitFactor =
    grossLosingAmount > 0
      ? grossWinningAmount /
        grossLosingAmount
      : grossWinningAmount > 0
        ? Infinity
        : 0;

  /*
   * ======================================
   * EXPECTANCY
   * ======================================
   */

  const winProbability =
    trades.length > 0
      ? winningTrades.length /
        trades.length
      : 0;

  const lossProbability =
    trades.length > 0
      ? losingTrades.length /
        trades.length
      : 0;

  const expectancy =
    (
      winProbability *
      averageProfit
    ) +
    (
      lossProbability *
      averageLoss
    );

  /*
   * ======================================
   * CONSECUTIVE LOSSES
   * ======================================
   */

  let currentLossStreak = 0;

  let maxConsecutiveLosses = 0;

  for (
    const trade of trades
  ) {

    if (
      trade.result ===
      "LOSS"
    ) {

      currentLossStreak++;

      maxConsecutiveLosses =
        Math.max(
          maxConsecutiveLosses,
          currentLossStreak
        );

    } else {

      currentLossStreak = 0;
    }
  }

  /*
   * ======================================
   * EQUITY / DRAWDOWN
   * ======================================
   */

  let equity = 0;

  let peakEquity = 0;

  let maxDrawdown = 0;

  let maxDrawdownPercent = 0;

  for (
    const trade of trades
  ) {

    equity +=
      trade.profit ?? 0;

    if (
      equity >
      peakEquity
    ) {

      peakEquity =
        equity;
    }

    const drawdown =
      peakEquity -
      equity;

    if (
      drawdown >
      maxDrawdown
    ) {

      maxDrawdown =
        drawdown;
    }

    const drawdownPercent =
      peakEquity > 0
        ? (
            drawdown /
            peakEquity
          ) *
          100
        : 0;

    if (
      drawdownPercent >
      maxDrawdownPercent
    ) {

      maxDrawdownPercent =
        drawdownPercent;
    }
  }

  const winRate =
    trades.length > 0
      ? (
          winningTrades.length /
          trades.length
        ) *
        100
      : 0;

  return {

    totalTrades:
      trades.length,

    winningTrades:
      winningTrades.length,

    losingTrades:
      losingTrades.length,

    winRate,

    grossProfit,

    totalCharges,

    totalProfit,

    totalProfitPercent,

    averageProfit,

    averageLoss,

    profitFactor,

    expectancy,

    maxDrawdown,

    maxDrawdownPercent,

    maxConsecutiveLosses,

    trades,
  };
}