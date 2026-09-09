import { useEffect, useState, useCallback } from "react";
import { Table, Tooltip, Button, Empty, message, Tag, Alert } from "antd";
import { ReloadOutlined, InfoCircleOutlined, CheckCircleFilled, CloseCircleFilled, MinusCircleFilled } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { fetchLiveMarketSignals } from "../api";
import type { LiveMarketSignal } from "../api";

function GradeBadge({ grade }: { grade: LiveMarketSignal["rating"]["grade"] }) {
  const cls = grade === "N/A" ? "grade-NA" : `grade-${grade}`;
  return <span className={`grade-badge ${cls}`}>{grade === "N/A" ? "—" : grade}</span>;
}

function SignalTag({ signal }: { signal: "BUY" | "SELL" | "HOLD" }) {
  return <span className={`signal-cell ${signal}`}>{signal}</span>;
}

function MetricIcon({ status }: { status: "pass" | "fail" | "neutral" }) {
  if (status === "pass") return <CheckCircleFilled style={{ color: "#21c17c" }} />;
  if (status === "fail") return <CloseCircleFilled style={{ color: "#f0506e" }} />;
  return <MinusCircleFilled style={{ color: "#8b92a8" }} />;
}

function money(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `₹${value.toFixed(2)}`;
}

function Levels({
  values,
  variant,
}: {
  values: number[];
  variant: "support" | "resistance";
}) {
  if (!values || values.length === 0) {
    return <span className="dash">—</span>;
  }
  return (
    <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
      {values.map((v, i) => (
        <span key={i} className={`level-pill level-${variant}`}>
          {v.toFixed(2)}
        </span>
      ))}
    </span>
  );
}

function marketStateColor(state: string) {
  if (state === "REGULAR") return "success";
  if (state === "PRE" || state === "POST") return "warning";
  return "default";
}

export default function LiveMarketTable() {
  const [signals, setSignals] = useState<LiveMarketSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { signals: data, warnings } = await fetchLiveMarketSignals();
      setSignals(data);
      setLastFetched(new Date());
      if (data.length === 0 && warnings.length > 0) {
        setError(
          `Couldn't fetch any live data. First error: ${warnings[0]}`
        );
      } else if (warnings.length > 0) {
        message.warning(
          `${warnings.length} stock(s) failed to update — showing the rest.`
        );
      }
    } catch (err: any) {
      console.error(err);
      const apiError = err?.response?.data;
      const details = apiError?.details as string[] | undefined;
      setError(
        apiError?.error
          ? `${apiError.error}${details?.[0] ? ` (${details[0]})` : ""}`
          : "Couldn't fetch live market data. Check your internet connection " +
            "and that the backend server is running."
      );
      message.error("Live data fetch failed.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const columns: ColumnsType<LiveMarketSignal> = [
    {
      title: "Stock",
      dataIndex: "stock",
      key: "stock",
      fixed: "left",
      width: 220,
      render: (value: string, record) => (
        <div>
          <div style={{ fontWeight: 600 }}>{value}</div>
          <div className="mono text-secondary" style={{ fontSize: 11 }}>
            {record.symbol}
          </div>
        </div>
      ),
    },
    {
      title: "Market",
      dataIndex: "marketState",
      key: "marketState",
      width: 100,
      render: (state: string) => (
        <Tag color={marketStateColor(state)} style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
          {state}
        </Tag>
      ),
    },
    {
      title: "Current Price",
      dataIndex: "currentPrice",
      key: "currentPrice",
      width: 130,
      align: "right",
      render: (value: number) => (
        <span className="mono" style={{ fontWeight: 600 }}>{money(value)}</span>
      ),
      sorter: (a, b) => a.currentPrice - b.currentPrice,
    },
    {
      title: "Signal",
      key: "signal",
      width: 140,
      render: (_, record) => (
        <div>
          <SignalTag signal={record.signal} />
          {!record.isFinal && (
            <div className="text-secondary" style={{ fontSize: 11, marginTop: 3 }}>
              live · may change
            </div>
          )}
        </div>
      ),
      filters: [
        { text: "BUY", value: "BUY" },
        { text: "SELL", value: "SELL" },
        { text: "HOLD", value: "HOLD" },
      ],
      onFilter: (value, record) => record.signal === value,
    },
    {
      title: (
        <Tooltip title="What the strategy said using yesterday's fully closed candle, before today's price action. Shown for comparison only.">
          Prev. Day <InfoCircleOutlined style={{ fontSize: 11 }} />
        </Tooltip>
      ),
      key: "previousDaySignal",
      width: 110,
      render: (_, record) => (
        <SignalTag signal={record.previousDaySignal.signal} />
      ),
    },
    {
      title: "Rating",
      key: "rating",
      width: 90,
      render: (_, record) => <GradeBadge grade={record.rating.grade} />,
      sorter: (a, b) => a.rating.score - b.rating.score,
    },
    {
      title: "Entry",
      key: "entry",
      width: 100,
      align: "right",
      render: (_, record) => (
        <span className="mono">{money(record.entry)}</span>
      ),
    },
    {
      title: "Stop Loss",
      key: "stopLoss",
      width: 100,
      align: "right",
      render: (_, record) => (
        <span className="mono" style={{ color: record.stopLoss ? "#f0506e" : undefined }}>
          {money(record.stopLoss)}
        </span>
      ),
    },
    {
      title: "Target",
      key: "target",
      width: 100,
      align: "right",
      render: (_, record) => (
        <span className="mono" style={{ color: record.target ? "#21c17c" : undefined }}>
          {money(record.target)}
        </span>
      ),
    },
    {
      title: "Support",
      key: "support",
      width: 160,
      render: (_, record) => (
        <Levels values={record.supportResistance.support} variant="support" />
      ),
    },
    {
      title: "Resistance",
      key: "resistance",
      width: 160,
      render: (_, record) => (
        <Levels
          values={record.supportResistance.resistance}
          variant="resistance"
        />
      ),
    },
    {
      title: "Historical",
      key: "historical",
      width: 170,
      render: (_, record) => (
        <div>
          <span className="mono">
            {record.rating.historicalWinRate.toFixed(1)}%
          </span>{" "}
          <span className="text-secondary" style={{ fontSize: 12 }}>
            win rate ({record.rating.historicalTrades} trades)
          </span>
        </div>
      ),
    },
    {
      title: "",
      key: "reasons",
      width: 70,
      render: (_, record) => (
        <Tooltip
          placement="topRight"
          title={
            <div style={{ width: 300 }}>
              {record.metrics.map((m, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    fontSize: 12,
                    marginBottom: 5,
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <MetricIcon status={m.status} /> {m.label}
                  </span>
                  <span className="mono" style={{ textAlign: "right" }}>{m.value}</span>
                </div>
              ))}
            </div>
          }
        >
          <Button size="small" icon={<InfoCircleOutlined />}>
            Why?
          </Button>
        </Tooltip>
      ),
    },
  ];

  return (
    <div className="panel" style={{ padding: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>
            Live Market Signals — V9 Strategy
          </div>
          <div className="text-secondary" style={{ fontSize: 12 }}>
            {lastFetched
              ? `Last fetched from Yahoo Finance at ${lastFetched.toLocaleTimeString()}`
              : "Loading…"}
            {" · "}"Confirmed" uses the last fully closed candle (what the
            backtest validated) · "Preview" reflects today's price so far
          </div>
        </div>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
          Refresh from market
        </Button>
      </div>

      {error && (
        <Alert
          type="error"
          message={error}
          style={{ marginBottom: 14 }}
          showIcon
          closable
          onClose={() => setError(null)}
        />
      )}

      <Table
        rowKey="symbol"
        columns={columns}
        dataSource={signals}
        loading={loading}
        pagination={false}
        scroll={{ x: 1500 }}
        size="middle"
        locale={{
          emptyText: (
            <Empty description="No live data — click Refresh, or check the backend/internet connection" />
          ),
        }}
      />
    </div>
  );
}
