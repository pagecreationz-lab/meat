import React from "react";
import {
  ArrowUpRight,
  ArrowRight,
  ShoppingBag,
  Wallet,
  Package,
  Truck,
  Clock,
  TrendingUp,
  Plus,
  MapPin,
} from "lucide-react";
import { money, label, day, stocks, balances } from "./schema";
import { Badge, Table, Empty } from "./components";
export default function Dashboard({ data, shopId, navigate, act }) {
  const orders = data.orders.filter((o) => o.shopId === shopId),
    bills = data.bills.filter((b) => b.shopId === shopId),
    todayBills = bills.filter((b) => b.date === day()),
    stock = stocks(data, shopId),
    due = balances(data).reduce((s, c) => s + c.outstanding, 0),
    pending = orders.filter((o) => o.status === "Pending"),
    sales = todayBills.reduce((s, b) => s + b.total, 0);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = day(d);
    return {
      label: d.toLocaleDateString("en-IN", { weekday: "short" }),
      retail: bills
        .filter((b) => b.date === key && b.channel === "Retail")
        .reduce((s, b) => s + b.total, 0),
      wholesale: bills
        .filter((b) => b.date === key && b.channel === "Wholesale")
        .reduce((s, b) => s + b.total, 0),
    };
  });
  const max = Math.max(1, ...days.map((d) => d.retail + d.wholesale));
  const ranked = {};
  for (const b of todayBills)
    for (const l of b.items) {
      ranked[l.itemId] ??= { name: l.name, total: 0, qty: 0, unit: l.unit };
      ranked[l.itemId].total += l.total;
      ranked[l.itemId].qty += l.qty;
    }
  const top = Object.values(ranked)
    .sort((a, b) => b.total - a.total)
    .slice(0, 4);
  return (
    <>
      <div className="welcome-strip">
        <div>
          <span className="eyebrow">YOUR BUSINESS AT A GLANCE</span>
          <h2>Fresh start. Clear overview.</h2>
          <p>Everything you need to keep your operations moving.</p>
        </div>
        <div className="welcome-mark">
          <Package size={42} strokeWidth={1.2} />
          <span>
            From shop
            <br />
            to doorstep.
          </span>
        </div>
      </div>
      <div className="stats-grid">
        {[
          {
            title: "Today's sales",
            value: money(sales),
            note: `${todayBills.length} bills generated today`,
            icon: ShoppingBag,
            color: "green",
          },
          {
            title: "Pending orders",
            value: String(pending.length).padStart(2, "0"),
            note: "Ready for your next move",
            icon: Clock,
            color: "amber",
          },
          {
            title: "Outstanding payments",
            value: money(due),
            note: "Across all customer accounts",
            icon: Wallet,
            color: "purple",
          },
          {
            title: "Items in stock",
            value:
              stock.filter((s) => s.closing > 0).length + " / " + stock.length,
            note:
              stock.filter((s) => s.closing < Number(s.lowStock)).length +
              " items below minimum",
            icon: Package,
            color: "blue",
          },
        ].map((s) => (
          <div className="stat-card" key={s.title}>
            <div>
              <span>{s.title}</span>
              <i className={s.color}>
                <s.icon size={19} />
              </i>
            </div>
            <strong>{s.value}</strong>
            <small>{s.note}</small>
          </div>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="panel sales-panel">
          <div className="section-title">
            <div>
              <h3>Sales overview</h3>
              <p>Retail and wholesale performance</p>
            </div>
            <span className="pill">Last 7 days</span>
          </div>
          <div className="chart-summary">
            <strong>
              {money(days.reduce((s, d) => s + d.retail + d.wholesale, 0))}
            </strong>
            <span className="legend">
              <i />
              Wholesale <i />
              Retail
            </span>
          </div>
          <div className="bar-chart">
            {days.map((d, i) => (
              <div
                className="bar-column"
                key={i}
                title={`${d.label}: ${money(d.retail + d.wholesale)}`}
              >
                <div className="bar-track">
                  <div
                    className="bar wholesale"
                    style={{
                      height:
                        Math.max(
                          d.wholesale ? 3 : 0,
                          (d.wholesale / max) * 100,
                        ) + "%",
                    }}
                  />
                  <div
                    className="bar retail"
                    style={{
                      height:
                        Math.max(d.retail ? 3 : 0, (d.retail / max) * 100) +
                        "%",
                    }}
                  />
                </div>
                <span>{d.label}</span>
              </div>
            ))}
          </div>
          {!bills.length && (
            <p className="chart-empty">
              Your sales chart will grow with your first bill.
            </p>
          )}
        </section>
        <section className="panel">
          <div className="section-title">
            <div>
              <h3>Top-selling items</h3>
              <p>Today's customer favorites</p>
            </div>
            <TrendingUp size={18} />
          </div>
          {top.length ? (
            top.map((t, i) => (
              <div className="top-item" key={t.name}>
                <span className="rank">0{i + 1}</span>
                <div>
                  <strong>{t.name}</strong>
                  <small>
                    {t.qty} {t.unit} sold
                  </small>
                </div>
                <b>{money(t.total)}</b>
              </div>
            ))
          ) : (
            <Empty
              title="A fresh slate"
              description="Your top sellers appear after today's first sale."
            />
          )}
          <button
            className="text-button panel-link"
            onClick={() => navigate("reports")}
          >
            View sales reports <ArrowRight size={16} />
          </button>
        </section>
        <section className="panel recent-panel">
          <div className="section-title">
            <div>
              <h3>Recent orders</h3>
              <p>The latest from your shop</p>
            </div>
            <button className="text-button" onClick={() => navigate("orders")}>
              View all <ArrowUpRight size={15} />
            </button>
          </div>
          <Table
            search={false}
            rows={orders.slice(0, 5)}
            columns={[
              { key: "number", label: "Order" },
              {
                key: "customerId",
                label: "Customer",
                render: (r) => label(data, "customers", r.customerId),
              },
              { key: "channel", label: "Type" },
              { key: "total", label: "Amount", render: (r) => money(r.total) },
              {
                key: "status",
                label: "Status",
                render: (r) => <Badge>{r.status}</Badge>,
              },
            ]}
          />
        </section>
        <section className="panel">
          <div className="section-title">
            <div>
              <h3>Stock snapshot</h3>
              <p>Availability at this shop</p>
            </div>
            <Package size={18} />
          </div>
          {stock.map((s) => (
            <div className="stock-item" key={s.id}>
              <div>
                <strong>{s.name}</strong>
                <span>
                  {s.closing} <small>{s.unit}</small>
                </span>
              </div>
              <div className="progress">
                <i
                  className={s.closing < Number(s.lowStock) ? "low" : ""}
                  style={{
                    width:
                      Math.min(100, (s.closing / Math.max(s.inward, 1)) * 100) +
                      "%",
                  }}
                />
              </div>
            </div>
          ))}
          <button
            className="text-button panel-link"
            onClick={() => navigate("inventory")}
          >
            Manage inventory <ArrowRight size={16} />
          </button>
        </section>
      </div>
      <section className="panel driver-performance">
        <div className="section-title">
          <div>
            <h3>Driver performance</h3>
            <p>Delivery progress across your team today</p>
          </div>
          <button className="text-button" onClick={() => navigate("tracking")}>
            Live tracking <MapPin size={15} />
          </button>
        </div>
        <div className="driver-grid">
          {data.users
            .filter((u) => u.role === "driver")
            .map((u) => {
              const assigned = orders.filter(
                  (o) => o.driverId === u.id && o.deliveryDate === day(),
                ),
                delivered = assigned.filter((o) => o.status === "Delivered");
              return (
                <div className="driver-summary" key={u.id}>
                  <span className="avatar">
                    {u.name
                      .split(" ")
                      .map((x) => x[0])
                      .join("")
                      .slice(0, 2)}
                  </span>
                  <div>
                    <strong>{u.name}</strong>
                    <small>
                      {delivered.length} of {assigned.length} deliveries
                      complete
                    </small>
                  </div>
                  <span className="driver-count">
                    {assigned.length
                      ? Math.round((delivered.length / assigned.length) * 100)
                      : 0}
                    %
                  </span>
                </div>
              );
            })}
        </div>
      </section>
    </>
  );
}
