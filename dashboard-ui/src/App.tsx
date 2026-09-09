import { ConfigProvider, theme, Tabs } from "antd";
import "./theme.css";
import BestStocksView from "./components/BestStocksView";
import WatchlistView from "./components/WatchlistView";
import SignalsTable from "./components/SignalsTable";
import LiveMarketTable from "./components/LiveMarketTable";
import HistoryView from "./components/HistoryView";

export default function App() {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: "#21c17c",
          colorBgBase: "#0b0e14",
          colorBgContainer: "#12151f",
          colorBgElevated: "#171b28",
          colorBorder: "#232838",
          colorText: "#e6e8ef",
          colorTextSecondary: "#8b92a8",
          fontFamily:
            "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          borderRadius: 8,
        },
      }}
    >
      <div className="app-shell">
        <header className="app-header">
          <div className="app-title">
            <span className="status-dot" />
            <span className="name">Swing Trade Signals</span>
            <span className="tag">V9</span>
          </div>
          <div className="text-secondary" style={{ fontSize: 12 }}>
            9-stock approved universe · ADX trend filter · 62% historical
            win rate
          </div>
        </header>

        <main className="app-body">
          <Tabs
            defaultActiveKey="best"
            items={[
              {
                key: "best",
                label: "Best Stocks",
                children: <BestStocksView />,
              },
              {
                key: "watchlist",
                label: "Watchlist (all checks)",
                children: <WatchlistView />,
              },
              {
                key: "live",
                label: "All Live Signals",
                children: <LiveMarketTable />,
              },
              {
                key: "signals",
                label: "Signals (CSV, offline)",
                children: <SignalsTable />,
              },
              {
                key: "history",
                label: "Historical Data",
                children: <HistoryView />,
              },
            ]}
          />
        </main>
      </div>
    </ConfigProvider>
  );
}
