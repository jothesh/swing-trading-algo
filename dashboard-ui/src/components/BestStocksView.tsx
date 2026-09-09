import { useEffect, useState, useCallback } from "react";
import { Button, Empty, message, Alert, Spin, Tooltip } from "antd";
import { ReloadOutlined, CheckCircleFilled, CloseCircleFilled, MinusCircleFilled } from "@ant-design/icons";
import { fetchBestStocks } from "../api";
import type { RankedStock } from "../api";

function SignalTag({ signal }: { signal: "BUY" | "SELL" | "HOLD" }) {
  return <span className={`signal-cell ${signal}`}>{signal}</span>;
}

function GradeBadge({ grade }: { grade: RankedStock["rating"]["grade"] }) {
  const cls = grade === "N/A" ? "grade-NA" : `grade-${grade}`;
  return <span className={`grade-badge ${cls}`}>{grade === "N/A" ? "—" : grade}</span>;
}

function money(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "—";
  return `₹${value.toFixed(2)}`;
}

function MetricIcon({ status }: { status: "pass" | "fail" | "neutral" }) {
  if (status === "pass") return <CheckCircleFilled style={{ color: "#21c17c" }} />;
  if (status === "fail") return <CloseCircleFilled style={{ color: "#f0506e" }} />;
  return <MinusCircleFilled style={{ color: "#8b92a8" }} />;
}

function RankRow({ stock }: { stock: RankedStock }) {
  const isBuy = stock.signal === "BUY";

  return (
    <div
      className="panel"
      style={{
        padding: "14px 18px",
        marginBottom: 10,
        display: "flex",
        alignItems: "center",
        gap: 16,
        border: isBuy ? "1px solid rgba(33, 193, 124, 0.35)" : undefined,
      }}
    >
      <div
        className="mono"
        style={{
          width: 28,
          textAlign: "center",
          fontSize: 16,
          fontWeight: 700,
          color: stock.rank === 1 ? "#e8b339" : "var(--text-secondary)",
        }}
      >
        #{stock.rank}
      </div>

      <div style={{ flex: "0 0 220px" }}>
        <div style={{ fontWeight: 600 }}>{stock.stock}</div>
        <div className="mono text-secondary" style={{ fontSize: 11 }}>
          {stock.symbol}
        </div>
      </div>

      <div style={{ width: 90 }}>
        <SignalTag signal={stock.signal} />
      </div>

      <div style={{ width: 70, textAlign: "center" }}>
        <GradeBadge grade={stock.rating.grade} />
      </div>

      <div className="mono" style={{ width: 100, textAlign: "right", fontWeight: 600 }}>
        {money(stock.currentPrice)}
      </div>

      <div style={{ width: 130 }}>
        {stock.signal === "BUY" ? (
          <div style={{ fontSize: 12 }}>
            <span className="text-secondary">Entry </span>
            <span className="mono">{money(stock.entry)}</span>
          </div>
        ) : (
          <span className="dash">—</span>
        )}
      </div>

      <div className="text-secondary" style={{ fontSize: 12, flex: 1 }}>
        {stock.rating.historicalWinRate.toFixed(1)}% win rate ({stock.rating.historicalTrades} trades historically)
      </div>

      <Tooltip
        placement="topRight"
        title={
          <div style={{ width: 300 }}>
            {stock.metrics.map((m, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  fontSize: 12,
                  marginBottom: 4,
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <MetricIcon status={m.status} /> {m.label}
                </span>
                <span className="mono">{m.value}</span>
              </div>
            ))}
          </div>
        }
      >
        <Button size="small">Why?</Button>
      </Tooltip>
    </div>
  );
}

export default function BestStocksView() {
  const [ranked, setRanked] = useState<RankedStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { ranked: data, warnings } = await fetchBestStocks();
      setRanked(data);
      setLastFetched(new Date());
      if (data.length === 0 && warnings.length > 0) {
        setError(`Couldn't fetch any live data. First error: ${warnings[0]}`);
      }
    } catch (err: any) {
      console.error(err);
      const apiError = err?.response?.data;
      const details = apiError?.details as string[] | undefined;
      setError(
        apiError?.error
          ? `${apiError.error}${details?.[0] ? ` (${details[0]})` : ""}`
          : "Couldn't fetch live data. Check your internet connection and that the backend is running."
      );
      message.error("Failed to rank stocks.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const topPick = ranked.find(s => s.signal === "BUY");

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>
            Best Stocks Right Now
          </div>
          <div className="text-secondary" style={{ fontSize: 12 }}>
            {lastFetched
              ? `Ranked as of ${lastFetched.toLocaleTimeString()}`
              : "Loading…"}
            {" · "}BUY signals always rank above HOLD · click "Why?" for the
            full indicator breakdown
          </div>
        </div>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
          Refresh
        </Button>
      </div>

      {error && (
        <Alert
          type="error"
          message={error}
          style={{ marginBottom: 16 }}
          showIcon
          closable
          onClose={() => setError(null)}
        />
      )}

      {loading && ranked.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60 }}>
          <Spin />
        </div>
      ) : ranked.length === 0 ? (
        <Empty description="No data — click Refresh, or check the backend/internet connection" />
      ) : (
        <>
          {topPick ? (
            <div
              className="panel"
              style={{
                padding: 18,
                marginBottom: 20,
                border: "1px solid rgba(33, 193, 124, 0.4)",
                background:
                  "linear-gradient(135deg, rgba(33,193,124,0.08), transparent)",
              }}
            >
              <div className="text-secondary" style={{ fontSize: 12, marginBottom: 6 }}>
                TOP PICK RIGHT NOW
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                <span style={{ fontSize: 20, fontWeight: 700 }}>{topPick.stock}</span>
                <SignalTag signal={topPick.signal} />
                <GradeBadge grade={topPick.rating.grade} />
              </div>
              <div className="mono" style={{ marginTop: 8, fontSize: 14 }}>
                Entry {money(topPick.entry)} · Stop {money(topPick.stopLoss)} · Target {money(topPick.target)}
              </div>
              <div className="text-secondary" style={{ fontSize: 12, marginTop: 6 }}>
                {topPick.rating.historicalWinRate.toFixed(1)}% historical win rate over {topPick.rating.historicalTrades} trades
              </div>
            </div>
          ) : (
            <Alert
              type="info"
              showIcon
              message="No BUY signal right now — every stock is on HOLD or SELL. Check back after the next close, or review the ranked list below for the strongest HOLD candidates."
              style={{ marginBottom: 20 }}
            />
          )}

          {ranked.map(stock => (
            <RankRow key={stock.symbol} stock={stock} />
          ))}
        </>
      )}
    </div>
  );
}
