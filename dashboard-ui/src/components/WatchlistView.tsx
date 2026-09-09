import { useEffect, useState, useCallback } from "react";
import { Table, Tooltip, Button, Empty, message, Alert, Progress } from "antd";
import { ReloadOutlined, InfoCircleOutlined, CheckCircleFilled, CloseCircleFilled, MinusCircleFilled } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { fetchWatchlist } from "../api";
import type { LiveMarketSignal } from "../api";

function SignalTag({ signal }: { signal: "BUY" | "SELL" | "HOLD" }) {
  return <span className={`signal-cell ${signal}`}>{signal}</span>;
}

function GradeBadge({ grade }: { grade: LiveMarketSignal["rating"]["grade"] }) {
  const cls = grade === "N/A" ? "grade-NA" : `grade-${grade}`;
  return <span className={`grade-badge ${cls}`}>{grade === "N/A" ? "—" : grade}</span>;
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

export default function WatchlistView() {
  const [watchlist, setWatchlist] = useState<LiveMarketSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { watchlist: data, warnings } = await fetchWatchlist();
      setWatchlist(data);
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
      message.error("Failed to load watchlist.");
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
      width: 200,
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
      title: "Checklist",
      key: "passCount",
      width: 150,
      render: (_, record) => (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Progress
              percent={(record.passCount / record.totalChecks) * 100}
              size="small"
              showInfo={false}
              strokeColor={
                record.passCount >= 7 ? "#21c17c" : record.passCount >= 4 ? "#e8b339" : "#f0506e"
              }
              style={{ width: 70 }}
            />
            <span className="mono" style={{ fontSize: 12 }}>
              {record.passCount}/{record.totalChecks}
            </span>
          </div>
        </div>
      ),
      sorter: (a, b) => a.passCount - b.passCount,
      defaultSortOrder: "descend",
    },
    {
      title: "Signal",
      dataIndex: "signal",
      key: "signal",
      width: 100,
      render: (signal: LiveMarketSignal["signal"]) => <SignalTag signal={signal} />,
      filters: [
        { text: "BUY", value: "BUY" },
        { text: "SELL", value: "SELL" },
        { text: "HOLD", value: "HOLD" },
      ],
      onFilter: (value, record) => record.signal === value,
    },
    {
      title: "Rating",
      key: "rating",
      width: 90,
      render: (_, record) => <GradeBadge grade={record.rating.grade} />,
    },
    {
      title: "Price",
      dataIndex: "currentPrice",
      key: "currentPrice",
      width: 100,
      align: "right",
      render: (v: number) => <span className="mono">{money(v)}</span>,
    },
    {
      title: (
        <Tooltip title="What a trade would look like RIGHT NOW at the current price, using this stock's ATR — calculated for every stock, not just BUY signals.">
          Hypothetical Trade <InfoCircleOutlined style={{ fontSize: 11 }} />
        </Tooltip>
      ),
      key: "potential",
      width: 260,
      render: (_, record) => (
        <div style={{ fontSize: 12 }}>
          <span className="mono">Entry {money(record.potential.entry)}</span>
          {" · "}
          <span className="mono" style={{ color: "#f0506e" }}>
            SL {money(record.potential.stopLoss)} (-{record.potential.riskPercent.toFixed(1)}%)
          </span>
          {" · "}
          <span className="mono" style={{ color: "#21c17c" }}>
            TG {money(record.potential.target)} (+{record.potential.rewardPercent.toFixed(1)}%)
          </span>
          <div className="text-secondary" style={{ marginTop: 2 }}>
            R:R 1:{record.potential.riskRewardRatio.toFixed(2)}
          </div>
        </div>
      ),
    },
    {
      title: "Support",
      key: "support",
      width: 150,
      render: (_, record) =>
        record.supportResistance.support.length ? (
          <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {record.supportResistance.support.map((v, i) => (
              <span key={i} className="level-pill level-support">{v.toFixed(2)}</span>
            ))}
          </span>
        ) : <span className="dash">—</span>,
    },
    {
      title: "Resistance",
      key: "resistance",
      width: 150,
      render: (_, record) =>
        record.supportResistance.resistance.length ? (
          <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {record.supportResistance.resistance.map((v, i) => (
              <span key={i} className="level-pill level-resistance">{v.toFixed(2)}</span>
            ))}
          </span>
        ) : <span className="dash">—</span>,
    },
    {
      title: "",
      key: "checklist-detail",
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
                  <span style={{ display: "flex", alignItems: "center", gap: 5, flex: 1 }}>
                    <MetricIcon status={m.status} /> {m.label}
                  </span>
                  <span className="mono" style={{ textAlign: "right", whiteSpace: "nowrap" }}>{m.value}</span>
                </div>
              ))}
            </div>
          }
        >
          <Button size="small" icon={<InfoCircleOutlined />}>
            Details
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
            Watchlist — Full Checklist, Your Call
          </div>
          <div className="text-secondary" style={{ fontSize: 12, maxWidth: 800 }}>
            {lastFetched
              ? `Last fetched at ${lastFetched.toLocaleTimeString()}`
              : "Loading…"}
            {" · "}Shows EVERY stock, sorted by how many of the 9 checks currently
            pass — not just ones with an automated signal. This ranking is for
            your own review; we tested using it as an automated rule and it lost
            money in backtesting, so treat "closer to 9/9" as informational, not
            a recommendation.
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
          style={{ marginBottom: 14 }}
          showIcon
          closable
          onClose={() => setError(null)}
        />
      )}

      <Table
        rowKey="symbol"
        columns={columns}
        dataSource={watchlist}
        loading={loading}
        pagination={false}
        scroll={{ x: 1400 }}
        size="middle"
        locale={{
          emptyText: (
            <Empty description="No data — click Refresh, or check the backend/internet connection" />
          ),
        }}
      />
    </div>
  );
}
