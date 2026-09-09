import { useEffect, useState, useCallback } from "react";
import { Table, Tooltip, Button, Empty, message } from "antd";
import { ReloadOutlined, InfoCircleOutlined, CheckCircleFilled, CloseCircleFilled, MinusCircleFilled } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { fetchSignals } from "../api";
import type { LiveSignal } from "../api";

function MetricIcon({ status }: { status: "pass" | "fail" | "neutral" }) {
  if (status === "pass") return <CheckCircleFilled style={{ color: "#21c17c" }} />;
  if (status === "fail") return <CloseCircleFilled style={{ color: "#f0506e" }} />;
  return <MinusCircleFilled style={{ color: "#8b92a8" }} />;
}

function GradeBadge({ grade }: { grade: LiveSignal["rating"]["grade"] }) {
  const cls = grade === "N/A" ? "grade-NA" : `grade-${grade}`;
  return <span className={`grade-badge ${cls}`}>{grade === "N/A" ? "—" : grade}</span>;
}

function SignalTag({ signal }: { signal: LiveSignal["signal"] }) {
  return <span className={`signal-cell ${signal}`}>{signal}</span>;
}

function money(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "—";
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

export default function SignalsTable() {
  const [signals, setSignals] = useState<LiveSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSignals();
      setSignals(data);
      setLastFetched(new Date());
    } catch (err) {
      console.error(err);
      message.error(
        "Couldn't reach the signals API. Is the backend server running on port 4000?"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const columns: ColumnsType<LiveSignal> = [
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
            {record.asOfDate}
          </div>
        </div>
      ),
    },
    {
      title: "Signal",
      dataIndex: "signal",
      key: "signal",
      width: 100,
      filters: [
        { text: "BUY", value: "BUY" },
        { text: "SELL", value: "SELL" },
        { text: "HOLD", value: "HOLD" },
      ],
      onFilter: (value, record) => record.signal === value,
      render: (signal: LiveSignal["signal"]) => <SignalTag signal={signal} />,
      sorter: (a, b) => {
        const order = { BUY: 0, SELL: 1, HOLD: 2 };
        return order[a.signal] - order[b.signal];
      },
    },
    {
      title: "Rating",
      key: "rating",
      width: 90,
      render: (_, record) => <GradeBadge grade={record.rating.grade} />,
      sorter: (a, b) => a.rating.score - b.rating.score,
    },
    {
      title: "Last Close",
      dataIndex: "lastClose",
      key: "lastClose",
      width: 110,
      align: "right",
      render: (value: number) => <span className="mono">{money(value)}</span>,
      sorter: (a, b) => a.lastClose - b.lastClose,
    },
    {
      title: "Entry",
      dataIndex: "suggestedEntry",
      key: "suggestedEntry",
      width: 100,
      align: "right",
      render: (value: number | null) => (
        <span className="mono">{money(value)}</span>
      ),
    },
    {
      title: "Stop Loss",
      dataIndex: "stopLoss",
      key: "stopLoss",
      width: 100,
      align: "right",
      render: (value: number | null) => (
        <span className="mono" style={{ color: value ? "#f0506e" : undefined }}>
          {money(value)}
        </span>
      ),
    },
    {
      title: "Target",
      dataIndex: "target",
      key: "target",
      width: 100,
      align: "right",
      render: (value: number | null) => (
        <span className="mono" style={{ color: value ? "#21c17c" : undefined }}>
          {money(value)}
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
      sorter: (a, b) =>
        a.rating.historicalWinRate - b.rating.historicalWinRate,
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
            Live Signals — V9 Strategy
          </div>
          <div className="text-secondary" style={{ fontSize: 12 }}>
            {lastFetched
              ? `Last refreshed ${lastFetched.toLocaleTimeString()}`
              : "Loading…"}
            {" · "}Entry/stop/target are estimates from last close — actual
            fill is next session's open
          </div>
        </div>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
          Refresh
        </Button>
      </div>

      <Table
        rowKey="file"
        columns={columns}
        dataSource={signals}
        loading={loading}
        pagination={false}
        scroll={{ x: 1300 }}
        size="middle"
        locale={{
          emptyText: (
            <Empty description="No signal data — check the backend is running" />
          ),
        }}
        rowClassName={(record) =>
          record.signal === "BUY" ? "row-buy" : ""
        }
      />
    </div>
  );
}
