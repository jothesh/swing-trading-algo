import { useEffect, useState, useCallback } from "react";
import { Table, Select, Empty, Spin, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  fetchStockList,
  fetchHistory,
} from "../api";
import type { StockListItem, HistoryCandle } from "../api";

function money(value: number | undefined | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) return "—";
  return value.toFixed(2);
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
      {values.slice(0, 2).map((v, i) => (
        <span key={i} className={`level-pill level-${variant}`}>
          {v.toFixed(2)}
        </span>
      ))}
    </span>
  );
}

export default function HistoryView() {
  const [stocks, setStocks] = useState<StockListItem[]>([]);
  const [selected, setSelected] = useState<string | undefined>();
  const [candles, setCandles] = useState<HistoryCandle[]>([]);
  const [loading, setLoading] = useState(false);
  const [stockLoading, setStockLoading] = useState(true);

  useEffect(() => {
    fetchStockList()
      .then((list) => {
        setStocks(list);
        if (list.length > 0) setSelected(list[0].file);
      })
      .catch(() => message.error("Couldn't load stock list from the API."))
      .finally(() => setStockLoading(false));
  }, []);

  const loadHistory = useCallback(async (file: string) => {
    setLoading(true);
    try {
      const history = await fetchHistory(file);
      // Most recent first
      setCandles([...history.candles].reverse());
    } catch (err) {
      console.error(err);
      message.error("Couldn't load historical data for this stock.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selected) loadHistory(selected);
  }, [selected, loadHistory]);

  const columns: ColumnsType<HistoryCandle> = [
    { title: "Date", dataIndex: "date", key: "date", width: 110 },
    {
      title: "Open",
      dataIndex: "open",
      key: "open",
      align: "right",
      width: 90,
      render: (v) => <span className="mono">{money(v)}</span>,
    },
    {
      title: "High",
      dataIndex: "high",
      key: "high",
      align: "right",
      width: 90,
      render: (v) => <span className="mono">{money(v)}</span>,
    },
    {
      title: "Low",
      dataIndex: "low",
      key: "low",
      align: "right",
      width: 90,
      render: (v) => <span className="mono">{money(v)}</span>,
    },
    {
      title: "Close",
      dataIndex: "close",
      key: "close",
      align: "right",
      width: 90,
      render: (v) => <span className="mono" style={{ fontWeight: 600 }}>{money(v)}</span>,
    },
    {
      title: "Volume",
      dataIndex: "volume",
      key: "volume",
      align: "right",
      width: 110,
      render: (v: number) => (
        <span className="mono text-secondary">
          {v ? v.toLocaleString("en-IN") : "—"}
        </span>
      ),
    },
    {
      title: "RSI",
      dataIndex: "rsi",
      key: "rsi",
      align: "right",
      width: 80,
      render: (v) => <span className="mono">{v ? v.toFixed(1) : "—"}</span>,
    },
    {
      title: "ADX",
      dataIndex: "adx",
      key: "adx",
      align: "right",
      width: 80,
      render: (v) => <span className="mono">{v ? v.toFixed(1) : "—"}</span>,
    },
    {
      title: "Support",
      key: "support",
      width: 150,
      render: (_, record) => (
        <Levels values={record.supportResistance.support} variant="support" />
      ),
    },
    {
      title: "Resistance",
      key: "resistance",
      width: 150,
      render: (_, record) => (
        <Levels
          values={record.supportResistance.resistance}
          variant="resistance"
        />
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
        <div style={{ fontWeight: 600, fontSize: 15 }}>Historical Data</div>
        <Select
          style={{ width: 280 }}
          value={selected}
          loading={stockLoading}
          onChange={setSelected}
          options={stocks.map((s) => ({ value: s.file, label: s.name }))}
          placeholder="Select a stock"
        />
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60 }}>
          <Spin />
        </div>
      ) : (
        <Table
          rowKey="date"
          columns={columns}
          dataSource={candles}
          pagination={{ pageSize: 20, showSizeChanger: false }}
          scroll={{ x: 1100 }}
          size="middle"
          locale={{
            emptyText: <Empty description="No historical data available" />,
          }}
        />
      )}
    </div>
  );
}
