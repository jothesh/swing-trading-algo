export interface TradePotential {
  entry: number;
  stopLoss: number;
  target: number;
  riskAmount: number;
  riskPercent: number;
  rewardAmount: number;
  rewardPercent: number;
  riskRewardRatio: number; // e.g. 1.67 means 1:1.67
}

/*
 * Calculates what a trade WOULD look like at the given
 * entry price, using the stock's current ATR for stop/
 * target distance — regardless of whether the strategy
 * actually signals BUY. This lets you evaluate "if I
 * bought this right now, what's the potential?" for any
 * stock, including ones sitting on HOLD, so you can make
 * your own judgment call rather than only seeing stocks
 * that already passed every automated gate.
 */
export function calculateTradePotential(
  entry: number,
  atr: number,
  stopMultiplier: number,
  targetMultiplier: number
): TradePotential {

  const riskAmount = atr * stopMultiplier;
  const rewardAmount = atr * targetMultiplier;

  const stopLoss = entry - riskAmount;
  const target = entry + rewardAmount;

  const riskPercent = (riskAmount / entry) * 100;
  const rewardPercent = (rewardAmount / entry) * 100;

  const riskRewardRatio = riskAmount > 0 ? rewardAmount / riskAmount : 0;

  return {
    entry,
    stopLoss,
    target,
    riskAmount,
    riskPercent,
    rewardAmount,
    rewardPercent,
    riskRewardRatio,
  };
}
