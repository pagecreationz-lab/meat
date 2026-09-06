import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  LayoutDashboard,
  ShoppingBag,
  Receipt,
  Package,
  Truck,
  Users,
  Wallet,
  BarChart3,
  Settings,
  MapPin,
  Bell,
  ChevronDown,
  Plus,
  LogOut,
  ArrowRight,
  ArrowUpRight,
  Search,
  Menu,
  X,
  Download,
  Pencil,
  Trash2,
  Check,
  Copy,
  Link,
  CalendarDays,
  ShieldCheck,
  ScanLine,
  Navigation,
  LoaderCircle,
  Building2,
  SlidersHorizontal,
  ArrowDownLeft,
} from "lucide-react";
import { api, location, exportCsv } from "./api";
import {
  schemas,
  actionSchemas,
  field as f,
  money,
  label,
  day,
  stocks,
  allocatedBills,
  balances,
} from "./schema";
import {
  Badge,
  Empty,
  Table,
  Modal,
  FormModal,
  Fields,
  PaymentQR,
} from "./components";
import { OrderModal, DeliveryModal, BillModal, Scanner } from "./workflows";
import Dashboard from "./dashboard";
import DriverDeliveries from "./DriverDeliveries";
import DeliveryMap from "./DeliveryMap";
import Reports from "./reports";
import "./style.css";

function Login({ onLogin }) {
  const [portal, setPortal] = useState("admin"),
    [mode, setMode] = useState("login"),
    [value, setValue] = useState({}),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [demo, setDemo] = useState(false);
  useEffect(() => {
    api("/health")
      .then((h) => setDemo(h.demo))
      .catch(() => setDemo(false));
  }, []);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "forgot") {
        const r = await api("/auth/forgot", { mobile: value.mobile });
        setMessage(r.message);
      } else if (mode === "reset") {
        await api("/auth/reset", value);
        setMessage("Password reset. You can now sign in.");
        setMode("login");
      } else {
        const loc = portal === "driver" ? await location() : {};
        let deviceId = localStorage.getItem("meat-device");
        if (!deviceId) {
          deviceId = crypto.randomUUID();
          localStorage.setItem("meat-device", deviceId);
        }
        const r = await api("/auth/login", { ...value, ...loc, deviceId });
        sessionStorage.setItem("meat-token", r.token);
        onLogin(r.user);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <div className="login-story">
        <div className="brand">
          <span className="brand-icon">
            <Package size={25} />
          </span>
          meatflow<span className="brand-dot">.</span>
        </div>
        <div>
          <span className="eyebrow">FRESH THINKING. BETTER OPERATIONS.</span>
          <h1>
            Every order.
            <br />
            Every delivery.
            <br />
            <em>Under control.</em>
          </h1>
          <p>
            One connected workspace for your meat business — from the first
            order to the last delivery.
          </p>
          <div className="login-features">
            <span>
              <Check size={16} /> Shop operations
            </span>
            <span>
              <Check size={16} /> Driver deliveries
            </span>
            <span>
              <Check size={16} /> Real-time visibility
            </span>
          </div>
        </div>
        <small>MEATFLOW · OPERATIONS, SIMPLIFIED</small>
      </div>
      <div className="login-form">
        <div className="login-card">
          <span className="eyebrow">WELCOME TO MEATFLOW</span>
          <h2>
            {mode === "login"
              ? "Let’s get to work."
              : mode === "forgot"
                ? "Forgot your password?"
                : "Reset your password"}
          </h2>
          <p className="muted">
            {mode === "login"
              ? "Sign in to manage your day."
              : "Use your registered mobile number."}
          </p>
          {mode === "login" && (
            <div className="tabs">
              <button
                className={portal === "admin" ? "active" : ""}
                onClick={() => setPortal("admin")}
              >
                <ShieldCheck size={16} />
                Super admin
              </button>
              <button
                className={portal === "driver" ? "active" : ""}
                onClick={() => setPortal("driver")}
              >
                <Truck size={16} />
                Driver
              </button>
            </div>
          )}
          <form onSubmit={submit}>
            <Fields
              data={{}}
              value={value}
              setValue={setValue}
              fields={
                mode === "login"
                  ? [
                      f(
                        "username",
                        portal === "driver" ? "Mobile number" : "Username",
                      ),
                      f("password", "Password", "password"),
                      ...(portal === "admin"
                        ? [f("code", "Secret verification code", "password")]
                        : []),
                    ]
                  : mode === "forgot"
                    ? [f("mobile", "Registered mobile number", "tel")]
                    : [
                        f("mobile", "Registered mobile number", "tel"),
                        f("code", "SMS reset code"),
                        f("password", "New password", "password"),
                      ]
              }
            />
            {portal === "driver" && mode === "login" && (
              <p className="info">
                <MapPin size={16} /> Location permission is required for driver
                access.
              </p>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            {message && <p className="success">{message}</p>}
            <button className="button login-submit" disabled={busy}>
              {busy ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <>
                  {mode === "login"
                    ? "Sign in"
                    : mode === "forgot"
                      ? "Send reset request"
                      : "Reset password"}
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>
          <div className="login-links">
            <button
              className="text-button"
              onClick={() => {
                setMode(mode === "login" ? "forgot" : "login");
                setError("");
                setMessage("");
              }}
            >
              {mode === "login" ? "Forgot password?" : "Back to sign in"}
            </button>
            {mode === "forgot" && (
              <button className="text-button" onClick={() => setMode("reset")}>
                Enter admin reset code
              </button>
            )}
          </div>
          {demo && (
            <div className="demo-note">
              <strong>Local demo access</strong>
              <span>Admin: admin / Admin@12345 · Code: 246810</span>
              <span>Driver: 9000000001 / Driver@12345</span>
              <small>
                Demo credentials apply only to the initial local seed.
              </small>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
const navigation = [
  {
    label: "WORKSPACE",
    items: [
      ["dashboard", "Overview", LayoutDashboard],
      ["orders", "Orders", ShoppingBag],
      ["billing", "Billing & challans", Receipt],
      ["inventory", "Inventory", Package],
      ["purchases", "Purchase orders", ArrowDownLeft],
      ["payments", "Payments", Wallet],
      ["expenses", "Expenses", Receipt],
    ],
  },
  {
    label: "PEOPLE & INSIGHTS",
    items: [
      ["customers", "Customers", Users],
      ["suppliers", "Suppliers", Building2],
      ["payroll", "Team & payroll", Users],
      ["tracking", "Driver tracking", MapPin],
      ["reports", "Reports", BarChart3],
    ],
  },
  {
    label: "MANAGE",
    items: [
      ["items", "Items & pricing", Package],
      ["masters", "Master settings", SlidersHorizontal],
      ["links", "Pre-order links", Link],
      ["notifications", "Notifications", Bell],
      ["settings", "Settings", Settings],
    ],
  },
];
const titles = {
  dashboard: ["Overview", "A little clarity for a busy day."],
  orders: ["Orders", "Track every pre-order, customer and delivery."],
  billing: [
    "Billing & challans",
    "Retail, wholesale and driver group billing in one place.",
  ],
  inventory: [
    "Inventory",
    "Know what’s in, what’s out and what’s running low.",
  ],
  purchases: [
    "Purchase orders",
    "From supplier order to final pricing and stock receipt.",
  ],
  payments: ["Payments", "Record collections and supplier payments."],
  expenses: ["Expenses", "Every operating expense, accounted for."],
  payroll: [
    "Team & payroll",
    "Attendance, advances, deductions and salary payments.",
  ],
  tracking: [
    "Driver tracking",
    "Latest GPS positions and delivery route history.",
  ],
  reports: ["Reports", "Turn your daily operations into clear insights."],
  masters: ["Master settings", "The foundations of your business, organized."],
  links: [
    "Pre-order links",
    "Let customers book using a secure, expiring link.",
  ],
  notifications: [
    "Notifications",
    "Stay ahead of the things that need your attention.",
  ],
  settings: ["Settings", "Business details, accounts and security."],
};
function App() {
  const [user, setUser] = useState(null),
    [loading, setLoading] = useState(true),
    [data, setData] = useState(null),
    [page, setPage] = useState("dashboard"),
    [shopId, setShopId] = useState(localStorage.getItem("meat-shop") || ""),
    [modal, setModal] = useState(null),
    [toast, setToast] = useState(""),
    [error, setError] = useState(""),
    [mobileMenu, setMobileMenu] = useState(false),
    [sub, setSub] = useState("locations"),
    [filter, setFilter] = useState("All"),
    [driverFilter, setDriverFilter] = useState(""),
    [customerFilter, setCustomerFilter] = useState(""),
    [orderDate, setOrderDate] = useState(""),
    [gpsState, setGpsState] = useState("");
  const notify = (message) => {
    setToast(message);
    setTimeout(() => setToast(""), 4500);
  };
  const refresh = async () => {
    const d = await api("/bootstrap");
    setData(d);
    setShopId((old) =>
      d.shops.some((s) => s.id === old && s.status === "Active")
        ? old
        : d.shops.find((s) => !s.parentId && s.status === "Active")?.id ||
          d.shops.find((s) => s.status === "Active")?.id ||
          "",
    );
  };
  useEffect(() => {
    if (sessionStorage.getItem("meat-token"))
      api("/me")
        .then(setUser)
        .catch(() => sessionStorage.removeItem("meat-token"))
        .finally(() => setLoading(false));
    else setLoading(false);
    const ended = () => {
      setUser(null);
      setData(null);
      sessionStorage.removeItem("meat-token");
    };
    window.addEventListener("session-ended", ended);
    return () => window.removeEventListener("session-ended", ended);
  }, []);
  useEffect(() => {
    if (user) refresh().catch((e) => setError(e.message));
  }, [user]);
  useEffect(() => {
    if (!user) return;
    const timer = setInterval(() => refresh().catch(() => {}), 10000);
    return () => clearInterval(timer);
  }, [user]);
  useEffect(() => {
    localStorage.setItem("meat-shop", shopId);
  }, [shopId]);
  useEffect(() => {
    if (user?.role !== "driver") return;
    let cancelled = false,
      busy = false;
    const track = async () => {
      if (busy) return;
      busy = true;
      try {
        const loc = await location();
        if (cancelled) return;
        const result = await api("/actions/gps", loc);
        if (cancelled) return;
        setGpsState("Live tracking connected");
        if (result.acceptedIds?.length) {
          await refresh();
          notify("New delivery automatically accepted. Start GPS recorded.");
        }
      } catch (e) {
        if (!cancelled) setGpsState(e.message);
      } finally {
        busy = false;
      }
    };
    track();
    const timer = setInterval(track, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [user]);
  const navigate = (p) => {
    setPage(p);
    setFilter("All");
    setDriverFilter("");
    setCustomerFilter("");
    setOrderDate("");
    setMobileMenu(false);
  };
  const run = async (action, body) => {
    const r = await api("/actions/" + action, { shopId, ...body });
    await refresh();
    if (r.blocked) throw new Error(r.error);
    notify("Saved successfully");
    return r;
  };
  const execute = async (action, body) => {
    try {
      await run(action, body);
    } catch (e) {
      setError(e.message);
    }
  };
  const act = (type, record) => setModal({ type, record });
  const logout = async () => {
    try {
      await api("/logout", {});
    } finally {
      sessionStorage.removeItem("meat-token");
      setUser(null);
      setData(null);
      navigate("dashboard");
    }
  };
  if (loading)
    return (
      <div className="loading">
        <LoaderCircle className="spin" />
        Loading your workspace…
      </div>
    );
  if (!user) return <Login onLogin={setUser} />;
  if (!data)
    return (
      <div className="loading">
        {error || "Preparing your workspace…"}
        <button className="button secondary" onClick={logout}>
          Sign out
        </button>
      </div>
    );
  const driver = user.role === "driver";
  const shop = data.shops.find((s) => s.id === shopId);
  const localOrders = data.orders.filter((o) => o.shopId === shopId);
  const localBills = allocatedBills(data).filter((o) => o.shopId === shopId);
  const columns = (entries) =>
    entries.map(([key, title, kind]) => ({
      key,
      label: title,
      ...(kind === "money"
        ? { render: (r) => money(r[key]) }
        : kind === "badge"
          ? { render: (r) => <Badge>{r[key]}</Badge> }
          : kind
            ? { render: (r) => label(data, kind, r[key]) }
            : {}),
    }));
  function masterView(kind) {
    const schema = schemas[kind];
    let cols = schema.fields
      .filter(
        (f) => !["password", "permissions", "shops", "address"].includes(f.key),
      )
      .slice(0, 7)
      .map((f) => ({
        key: f.key,
        label: f.label,
        render: (r) =>
          f.key === "status" ? (
            <Badge>{r[f.key]}</Badge>
          ) : f.type === "ref" ? (
            label(data, f.options === "drivers" ? "users" : f.options, r[f.key])
          ) : ["price", "salary", "creditLimit", "openingBalance"].includes(
              f.key,
            ) ? (
            money(r[f.key])
          ) : (
            String(r[f.key] ?? "—")
          ),
      }));
    let rows = data[kind] || [];
    if (kind === "customers" || kind === "suppliers") {
      rows = balances(data, kind === "customers" ? "Customer" : "Supplier");
      cols = cols.filter((c) => c.key !== "openingBalance");
      cols.push({
        key: "outstanding",
        label: "Outstanding",
        render: (r) => money(r.outstanding),
      });
    }
    return (
      <>
        <div className="section-toolbar">
          <div>
            <h3>{schema.title}</h3>
            <p>{schema.description}</p>
          </div>
          <div className="button-group">
            <button
              className="button secondary"
              onClick={() => exportCsv(kind, rows)}
            >
              <Download size={16} />
              Export
            </button>
            <button className="button" onClick={() => act("master", { kind })}>
              <Plus size={16} />
              Add{" "}
              {kind === "categories"
                ? "category"
                : kind === "qr"
                  ? "QR code"
                  : kind === "expenseCategories"
                    ? "category"
                    : kind.replace(/s$/, "")}
            </button>
          </div>
        </div>
        <Table
          rows={rows}
          columns={cols}
          actions={(r) => (
            <>
              <button
                className="icon-button"
                title="Edit"
                aria-label={"Edit " + (r.name || r.code)}
                onClick={() => act("master", { kind, ...r })}
              >
                <Pencil size={15} />
              </button>
              {r.id !== user.id && (
                <button
                  className="icon-button danger"
                  title="Delete"
                  aria-label={"Delete " + (r.name || r.code)}
                  onClick={() => act("delete", { kind, ...r })}
                >
                  <Trash2 size={15} />
                </button>
              )}
            </>
          )}
        />
      </>
    );
  }
  function ordersView() {
    const rows = (driver ? data.orders : localOrders).filter(
      (o) =>
        (filter === "All" || o.status === filter) &&
        (!driverFilter || o.driverId === driverFilter) &&
        (!customerFilter || o.customerId === customerFilter) &&
        (!orderDate || o.date === orderDate),
    );
    return (
      <>
        <div className="section-toolbar">
          <div className="tabs">
            {["All", "Pending", "Delivered", "Cancelled"].map((t) => (
              <button
                key={t}
                className={filter === t ? "active" : ""}
                onClick={() => setFilter(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <button className="button" onClick={() => act("order")}>
            <Plus size={16} />
            New pre-order
          </button>
        </div>
        <div className="filter-bar compact">
          <select
            aria-label="Filter by driver"
            value={driverFilter}
            onChange={(e) => setDriverFilter(e.target.value)}
          >
            <option value="">All drivers</option>
            {data.users
              .filter((u) => u.role === "driver")
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
          </select>
          <select
            aria-label="Filter by customer"
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
          >
            <option value="">All customers</option>
            {data.customers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <input
            aria-label="Order date"
            type="date"
            value={orderDate}
            onChange={(e) => setOrderDate(e.target.value)}
          />
        </div>
        <Table
          rows={rows}
          columns={columns([
            ["number", "Order"],
            ["customerId", "Customer", "customers"],
            ["driverId", "Driver", "users"],
            ["deliveryDate", "Due date"],
            ["channel", "Type"],
            ["total", "Amount", "money"],
            ["status", "Status", "badge"],
          ])}
          actions={(o) => (
            <>
              <button
                className="text-button"
                onClick={() => act("orderDetail", o)}
              >
                View
              </button>
              {o.status === "Pending" &&
                (!driver || o.driverId === user.id) && (
                  <button
                    className="text-button"
                    onClick={() => act("deliver", o)}
                  >
                    Deliver
                  </button>
                )}
              {o.status !== "Cancelled" &&
                !data.bills.some((b) => b.orderId === o.id) &&
                (!driver || o.driverId === user.id) && (
                  <button
                    className="text-button"
                    onClick={() => act("confirmBill", o)}
                  >
                    Bill
                  </button>
                )}
              {(!driver || o.driverId === user.id) &&
                o.status === "Pending" &&
                !data.bills.some((b) => b.orderId === o.id) && (
                  <button
                    className="text-button"
                    onClick={() => act("order", o)}
                  >
                    Edit
                  </button>
                )}
              {(!driver || o.driverId === user.id) &&
                o.status === "Pending" &&
                !data.bills.some((b) => b.orderId === o.id) && (
                  <button
                    className="text-button danger"
                    onClick={() => act("cancelOrder", o)}
                  >
                    Cancel
                  </button>
                )}
            </>
          )}
        />
      </>
    );
  }
  function billsView() {
    return (
      <>
        <div className="section-toolbar">
          <p>
            Generate a bill from an order. Stock and balances update
            automatically.
          </p>
          <button
            className="button secondary"
            onClick={async () => {
              try {
                await api("/export/bills");
                exportCsv("bills", localBills);
              } catch (e) {
                setError(e.message);
              }
            }}
          >
            <Download size={16} />
            Export
          </button>
        </div>
        <div className="filter-bar compact">
          <select
            aria-label="Billing driver group"
            value={driverFilter}
            onChange={(e) => setDriverFilter(e.target.value)}
          >
            <option value="">All driver groups</option>
            {data.users
              .filter((u) => u.role === "driver")
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
          </select>
          <select
            aria-label="Billing type"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {["All", "Retail", "Wholesale"].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <Table
          rows={localBills.filter(
            (b) =>
              (!driverFilter || b.driverId === driverFilter) &&
              (filter === "All" || b.channel === filter),
          )}
          columns={columns([
            ["number", "Bill number"],
            ["customerId", "Customer", "customers"],
            ["driverId", "Driver", "users"],
            ["channel", "Type"],
            ["total", "Total", "money"],
            ["paid", "Paid amount", "money"],
            ["credit", "Credit amount", "money"],
            ["closingBalance", "Balance at issue", "money"],
            ["date", "Date"],
          ])}
          actions={(b) => (
            <button className="text-button" onClick={() => act("invoice", b)}>
              Invoice / DC <ArrowUpRight size={14} />
            </button>
          )}
        />
      </>
    );
  }
  function paymentView() {
    return (
      <>
        <div className="section-toolbar">
          <div className="tabs">
            {["All", "Customer", "Supplier"].map((t) => (
              <button
                key={t}
                className={filter === t ? "active" : ""}
                onClick={() => setFilter(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="button-group">
            {driver && (
              <button className="button secondary" onClick={() => act("scan")}>
                <ScanLine size={16} />
                Scan QR
              </button>
            )}
            <button
              className="button"
              onClick={() =>
                act("payment", {
                  partyType: filter === "Supplier" ? "Supplier" : "Customer",
                  mode: "Cash",
                })
              }
            >
              <Plus size={16} />
              Record payment
            </button>
          </div>
        </div>
        <Table
          rows={data.payments.filter(
            (p) => filter === "All" || p.partyType === filter,
          )}
          columns={[
            ...columns([
              ["number", "Payment"],
              ["partyType", "Type"],
            ]),
            {
              key: "partyId",
              label: "Party",
              render: (r) =>
                label(
                  data,
                  r.partyType === "Customer" ? "customers" : "suppliers",
                  r.partyId,
                ),
            },
            ...columns([
              ["mode", "Mode"],
              ["amount", "Amount", "money"],
              ["date", "Date"],
              ["reference", "Reference"],
            ]),
          ]}
        />
        {driver && (
          <div className="qr-grid">
            {data.qr
              .filter((q) => q.status === "Active")
              .map((q) => (
                <PaymentQR
                  key={q.id}
                  bank={data.banks.find(
                    (b) => b.id === q.bankId && b.status === "Active",
                  )}
                />
              ))}
          </div>
        )}
      </>
    );
  }
  function expensesView() {
    return (
      <>
        <div className="section-toolbar">
          <p>Daily expenses from the shop and on the road.</p>
          <button className="button" onClick={() => act("expense")}>
            <Plus size={16} />
            Add expense
          </button>
        </div>
        <Table
          rows={data.expenses.filter((e) => !e.shopId || e.shopId === shopId)}
          columns={columns([
            ["categoryId", "Category", "expenseCategories"],
            ["amount", "Amount", "money"],
            ["date", "Date"],
            ["paidBy", "Paid by"],
            ["remarks", "Remarks"],
          ])}
        />
      </>
    );
  }
  function trackingView() {
    const drivers = data.users.filter((u) => u.role === "driver");
    return (
      <>
        <div className="tracking-grid">
          {drivers.map((u) => {
            const points = data.tracking.filter((t) => t.driverId === u.id),
              latest = points[0],
              del = data.deliveries.filter((d) => d.driverId === u.id);
            return (
              <section className="panel" key={u.id}>
                <div className="section-title">
                  <span className="avatar">{u.name[0]}</span>
                  <h3>{u.name}</h3>
                  <Badge>
                    {latest &&
                    Date.now() - Date.parse(latest.timestamp) < 120000
                      ? "Active"
                      : "Offline"}
                  </Badge>
                </div>
                <DeliveryMap points={points.slice().reverse()} />
                <div
                  className="location-illustration"
                  style={{ height: "auto", padding: 8 }}
                >
                  <MapPin size={34} />
                  <span>
                    {latest
                      ? `${latest.lat.toFixed(5)}, ${latest.lng.toFixed(5)}`
                      : "Waiting for GPS"}
                  </span>
                </div>
                <p className="muted">
                  Last update:{" "}
                  {latest
                    ? new Date(latest.timestamp).toLocaleString()
                    : "No driver session yet"}
                </p>
                {latest && (
                  <a
                    className="button secondary"
                    href={`https://www.openstreetmap.org/?mlat=${latest.lat}&mlon=${latest.lng}#map=16/${latest.lat}/${latest.lng}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open location map <ArrowUpRight size={15} />
                  </a>
                )}
                <p>
                  {del.filter((d) => d.onTime).length} on time ·{" "}
                  {del.filter((d) => !d.onTime).length} delayed deliveries
                </p>
                <button
                  className="text-button"
                  onClick={() => act("route", { ...u, points })}
                >
                  View route history <ArrowRight size={15} />
                </button>
              </section>
            );
          })}
        </div>
        <p className="footnote">
          Locations update while the driver app is open and GPS permission is
          enabled. Driver GPS is requested every 5 seconds; the admin view
          refreshes every 10 seconds.
        </p>
        <h3 className="space-top">Supplier visit log</h3>
        <Table
          rows={data.visits}
          columns={[
            ...columns([
              ["supplierId", "Supplier", "suppliers"],
              ["driverId", "Driver", "users"],
              ["timestamp", "Timestamp"],
            ]),
            {
              key: "items",
              label: "Items loaded",
              render: (r) =>
                r.items.map((l) => `${l.name}: ${l.qty} ${l.unit}`).join(", "),
            },
            {
              key: "location",
              label: "GPS",
              render: (r) => `${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}`,
            },
          ]}
        />
      </>
    );
  }
  function notificationView() {
    const generated = [
      ...stocks(data, shopId)
        .filter((s) => s.closing < Number(s.lowStock || 0))
        .map((s) => ({
          id: "low-" + s.id,
          title: "Low stock",
          detail: `${s.name}: ${s.closing} ${s.unit} available at ${shop?.name}. Minimum ${s.lowStock}.`,
          date: day(),
        })),
      ...data.orders
        .filter((o) => o.status === "Pending" && o.deliveryDate < day())
        .map((o) => ({
          id: "delay-" + o.id,
          title: "Order delivery delay",
          detail: `${o.number} was due ${o.deliveryDate}.`,
          date: day(),
        })),
      ...balances(data)
        .filter(
          (c) =>
            c.outstanding > 0 &&
            allocatedBills(data).some(
              (b) =>
                b.customerId === c.id &&
                b.credit > 0 &&
                Date.parse(b.date) < Date.now() - 7 * 86400000,
            ),
        )
        .map((c) => ({
          id: "due-" + c.id,
          title: "Payment overdue",
          detail: `${c.name}: ${money(c.outstanding)} outstanding on an account with bills older than 7 days.`,
          date: day(),
        })),
    ];
    return (
      <div className="panel notification-list">
        {[...generated, ...data.notifications].length ? (
          [...generated, ...data.notifications].map((n) => (
            <div
              className={"notification " + (n.read ? "read" : "")}
              key={n.id}
            >
              <span className="notification-icon">
                <Bell size={18} />
              </span>
              <div>
                <strong>{n.title}</strong>
                <p>{n.detail}</p>
                <small>{n.date}</small>
              </div>
              {!n.read &&
                !n.id.startsWith("low-") &&
                !n.id.startsWith("delay-") &&
                !n.id.startsWith("due-") && (
                  <button
                    className="text-button"
                    onClick={() => execute("readNotification", { id: n.id })}
                  >
                    Mark read
                  </button>
                )}
            </div>
          ))
        ) : (
          <Empty
            title="You're all caught up"
            description="Stock alerts, billing attempts and delivery delays will appear here."
          />
        )}
      </div>
    );
  }
  function driverHome() {
    return (
      <DriverDeliveries
        data={data}
        user={user}
        gpsState={gpsState}
        page={page}
        act={act}
      />
    );
  }
  let content;
  if (driver) {
    content =
      page === "settings" ? (
        <section className="panel">
          <h3>{user.name}</h3>
          <p>{user.mobile}</p>
          <button className="button secondary" onClick={() => act("password")}>
            Change password
          </button>
          <button className="button secondary" onClick={logout}>
            Sign out
          </button>
        </section>
      ) : (
        driverHome()
      );
  } else if (page === "dashboard")
    content = (
      <Dashboard data={data} shopId={shopId} navigate={navigate} act={act} />
    );
  else if (page === "orders") content = ordersView();
  else if (page === "billing") content = billsView();
  else if (page === "payments") content = paymentView();
  else if (page === "expenses") content = expensesView();
  else if (page === "customers" || page === "suppliers")
    content = masterView(page);
  else if (page === "inventory")
    content = (
      <>
        <div className="section-toolbar">
          <p>Billing reduces stock. Received purchases add stock.</p>
          <button
            className="button"
            onClick={() => act("stock", { direction: "In" })}
          >
            <Plus size={16} />
            Stock adjustment
          </button>
        </div>
        <Table
          rows={stocks(data, shopId)}
          columns={[
            ...columns([
              ["name", "Item"],
              ["unit", "Unit"],
              ["inward", "Total inward"],
              ["outward", "Total outward"],
              ["closing", "Closing stock"],
            ]),
            {
              key: "status",
              label: "Stock health",
              render: (r) => (
                <Badge>
                  {r.closing < Number(r.lowStock) ? "Low stock" : "Available"}
                </Badge>
              ),
            },
          ]}
        />
        <h3 className="space-top">Stock movement ledger</h3>
        <Table
          rows={data.stock.filter((s) => s.shopId === shopId)}
          columns={columns([
            ["itemId", "Item", "items"],
            ["direction", "Movement"],
            ["qty", "Quantity"],
            ["cost", "Unit cost", "money"],
            ["reason", "Reference / reason"],
            ["date", "Date"],
          ])}
        />
      </>
    );
  else if (page === "purchases")
    content = (
      <>
        <div className="section-toolbar">
          <p>Final prices unlock after two days.</p>
          <button className="button" onClick={() => act("purchase")}>
            <Plus size={16} />
            Create purchase
          </button>
        </div>
        <Table
          rows={data.purchases.filter((p) => p.shopId === shopId)}
          columns={columns([
            ["number", "PO number"],
            ["supplierId", "Supplier", "suppliers"],
            ["date", "Created"],
            ["total", "Amount", "money"],
            ["status", "Status", "badge"],
          ])}
          actions={(p) =>
            p.status === "Pending" ? (
              <button
                className="text-button"
                onClick={() => act("finalizePurchase", p)}
              >
                Finalize & receive
              </button>
            ) : (
              <button
                className="text-button"
                onClick={() => act("orderDetail", p)}
              >
                View
              </button>
            )
          }
        />
      </>
    );
  else if (page === "items")
    content = (
      <>
        <div className="tabs section-tabs">
          {["items", "categories", "prices"].map((t) => (
            <button
              key={t}
              onClick={() => setSub(t)}
              className={
                (sub === "categories" || sub === "prices" ? sub : "items") === t
                  ? "active"
                  : ""
              }
            >
              {t === "prices" ? "Daily pricing" : schemas[t].title}
            </button>
          ))}
        </div>
        {sub === "prices" ? (
          <>
            <div className="section-toolbar">
              <p>
                Every price change keeps the previous price and updated-by
                history.
              </p>
              <button className="button" onClick={() => act("price")}>
                <Plus size={16} />
                Update price
              </button>
            </div>
            <Table
              rows={data.prices}
              columns={columns([
                ["itemId", "Item", "items"],
                ["date", "Date"],
                ["previousPrice", "Previous price", "money"],
                ["price", "New price", "money"],
                ["updatedBy", "Updated by"],
              ])}
            />
          </>
        ) : (
          masterView(sub === "categories" ? "categories" : "items")
        )}
      </>
    );
  else if (page === "masters")
    content = (
      <>
        <div className="tabs section-tabs wrap">
          {[
            "locations",
            "shops",
            "employees",
            "users",
            "roles",
            "assets",
            "expenseCategories",
          ].map((t) => (
            <button
              key={t}
              className={sub === t ? "active" : ""}
              onClick={() => setSub(t)}
            >
              {schemas[t].title}
            </button>
          ))}
        </div>
        {masterView(
          [
            "locations",
            "shops",
            "employees",
            "users",
            "roles",
            "assets",
            "expenseCategories",
          ].includes(sub)
            ? sub
            : "locations",
        )}
      </>
    );
  else if (page === "payroll")
    content = (
      <>
        <div className="section-toolbar wrap">
          <p>
            Salary is calculated from recorded attendance. Missing attendance
            earns zero.
          </p>
          <div className="button-group wrap">
            {["attendance", "advance", "deduction", "payroll"].map((a) => (
              <button
                key={a}
                className={"button " + (a === "payroll" ? "" : "secondary")}
                onClick={() => act(a)}
              >
                <Plus size={15} />
                {a === "payroll"
                  ? "Pay salary"
                  : a[0].toUpperCase() + a.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="tabs section-tabs">
          {["payroll", "attendance", "advances", "deductions"].map((t) => (
            <button
              key={t}
              className={
                (sub === "attendance" ||
                sub === "advances" ||
                sub === "deductions"
                  ? sub
                  : "payroll") === t
                  ? "active"
                  : ""
              }
              onClick={() => setSub(t)}
            >
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <Table
          rows={data[
            ["attendance", "advances", "deductions"].includes(sub)
              ? sub
              : "payroll"
          ].filter(
            (r) =>
              data.employees.find((e) => e.id === r.employeeId)?.shopId ===
              shopId,
          )}
          columns={columns(
            sub === "attendance"
              ? [
                  ["employeeId", "Employee", "employees"],
                  ["date", "Date"],
                  ["status", "Status", "badge"],
                ]
              : ["advances", "deductions"].includes(sub)
                ? [
                    ["employeeId", "Employee", "employees"],
                    ["date", "Date"],
                    ["amount", "Amount", "money"],
                    ["remarks", "Remarks"],
                    ["settled", "Settled"],
                  ]
                : [
                    ["employeeId", "Employee", "employees"],
                    ["from", "From"],
                    ["to", "To"],
                    ["days", "Paid days"],
                    ["gross", "Gross", "money"],
                    ["advances", "Advances", "money"],
                    ["deductions", "Deductions", "money"],
                    ["net", "Net paid", "money"],
                  ],
          )}
        />
      </>
    );
  else if (page === "reports")
    content = <Reports data={data} shopId={shopId} />;
  else if (page === "tracking") content = trackingView();
  else if (page === "notifications") content = notificationView();
  else if (page === "links")
    content = (
      <>
        <div className="section-toolbar">
          <p>
            Each link is scoped to a customer and expires on the selected date.
          </p>
          <button className="button" onClick={() => act("link")}>
            <Plus size={16} />
            Generate link
          </button>
        </div>
        <Table
          rows={data.links.filter((l) => l.shopId === shopId)}
          columns={columns([
            ["customerId", "Customer", "customers"],
            ["expiry", "Expiry"],
            ["status", "Status", "badge"],
          ])}
          actions={(l) => (
            <>
              <button
                className="text-button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      window.location.origin + "/preorder/" + l.token,
                    );
                    notify("Link copied");
                  } catch {
                    setError("Clipboard access unavailable");
                  }
                }}
              >
                <Copy size={14} />
                Copy
              </button>
              <button
                className="text-button"
                onClick={() => execute("toggleLink", { id: l.id })}
              >
                {l.status === "Active" ? "Disable" : "Enable"}
              </button>
            </>
          )}
        />
      </>
    );
  else if (page === "settings")
    content = (
      <>
        <div className="tabs section-tabs wrap">
          {["profile", "banks", "qr", "resetRequests", "audit", "messages"].map(
            (t) => (
              <button
                key={t}
                className={sub === t ? "active" : ""}
                onClick={() => setSub(t)}
              >
                {
                  {
                    profile: "Business profile",
                    banks: "Banks",
                    qr: "Payment QR",
                    resetRequests: "Driver resets",
                    audit: "Activity log",
                    messages: "SMS outbox",
                  }[t]
                }
              </button>
            ),
          )}
        </div>
        {["banks", "qr"].includes(sub) ? (
          <>
            {masterView(sub)}
            {sub === "qr" && (
              <div className="qr-grid">
                {data.qr.map((q) => (
                  <PaymentQR
                    key={q.id}
                    bank={data.banks.find((b) => b.id === q.bankId)}
                  />
                ))}
              </div>
            )}
          </>
        ) : sub === "resetRequests" ? (
          <Table
            rows={data.resetRequests}
            columns={columns([
              ["name", "Driver"],
              ["mobile", "Mobile"],
              ["date", "Requested"],
              ["status", "Status", "badge"],
            ])}
            actions={(r) =>
              r.status === "Pending" && (
                <button
                  className="text-button"
                  onClick={() => act("resetDriver", r)}
                >
                  Reset password
                </button>
              )
            }
          />
        ) : sub === "audit" ? (
          <Table
            rows={data.audit}
            columns={columns([
              ["user", "User"],
              ["action", "Action"],
              ["detail", "Detail"],
              ["timestamp", "Timestamp"],
            ])}
          />
        ) : sub === "messages" ? (
          <>
            <p className="info">
              SMS delivery requires SMS_GATEWAY_URL and SMS_GATEWAY_TOKEN on the
              server. Queued messages are not yet delivered.
            </p>
            <Table
              rows={data.messages}
              columns={columns([
                ["to", "Mobile"],
                ["message", "Message"],
                ["status", "Status", "badge"],
                ["attempts", "Attempts"],
                ["date", "Date"],
              ])}
            />
          </>
        ) : (
          <section className="panel profile-panel">
            <span className="eyebrow">BUSINESS PROFILE</span>
            <h2>{data.profile.businessName || "Your business"}</h2>
            <p>{data.profile.address}</p>
            <p>Contact: {data.profile.contact || "—"}</p>
            <p>GST: {data.profile.gst || "Not configured"}</p>
            <div className="button-group">
              <button
                className="button"
                onClick={() => act("profile", data.profile)}
              >
                Edit business details
              </button>
              <button
                className="button secondary"
                onClick={() => act("password")}
              >
                Change password
              </button>
            </div>
          </section>
        )}
      </>
    );
  const heading = titles[page] || [schemas[page]?.title || page, ""];
  return (
    <div className={"app " + (driver ? "driver-app" : "")}>
      {!driver && (
        <>
          <aside className={"sidebar " + (mobileMenu ? "open" : "")}>
            <div className="brand">
              <span className="brand-icon">
                <Package size={24} />
              </span>
              meatflow<span className="brand-dot">.</span>
            </div>
            <div className="workspace-label">
              <span className="workspace-icon">
                <Building2 size={18} />
              </span>
              <div>
                <strong>Super admin</strong>
                <small>Full workspace access</small>
              </div>
              <ShieldCheck size={15} />
            </div>
            <nav>
              {navigation.map((group) => (
                <div className="nav-group" key={group.label}>
                  <span>{group.label}</span>
                  {group.items.map(([key, name, Icon]) => (
                    <button
                      key={key}
                      className={page === key ? "active" : ""}
                      onClick={() => navigate(key)}
                    >
                      <Icon size={18} />
                      {name}
                      {key === "orders" &&
                        localOrders.filter((o) => o.status === "Pending")
                          .length > 0 && (
                          <b>
                            {
                              localOrders.filter((o) => o.status === "Pending")
                                .length
                            }
                          </b>
                        )}
                    </button>
                  ))}
                </div>
              ))}
            </nav>
            <button className="sidebar-user" onClick={logout}>
              <span className="avatar">SA</span>
              <span>
                <strong>{user.name}</strong>
                <small>Sign out of workspace</small>
              </span>
              <LogOut size={16} />
            </button>
          </aside>
          {mobileMenu && (
            <div
              className="sidebar-backdrop"
              onClick={() => setMobileMenu(false)}
            />
          )}
        </>
      )}
      <div className="main">
        <header className="topbar">
          {driver ? (
            <div className="brand">
              <span className="brand-icon">
                <Package size={21} />
              </span>
              meatflow<span className="brand-dot">.</span>
              <small>DRIVER</small>
            </div>
          ) : (
            <>
              <button
                className="icon-button menu-toggle"
                aria-label="Open navigation"
                onClick={() => setMobileMenu(!mobileMenu)}
              >
                <Menu size={20} />
              </button>
              <div className="breadcrumb">
                Workspace <span>/</span>
                <strong>{heading[0]}</strong>
              </div>
            </>
          )}
          <div className="topbar-right">
            <div className="shop-selector">
              <MapPin size={16} />
              <select
                aria-label="Select shop and location"
                value={shopId}
                onChange={(e) => setShopId(e.target.value)}
              >
                {data.shops
                  .filter((s) => s.status === "Active")
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ·{" "}
                      {data.locations.find((l) => l.id === s.locationId)?.area}
                    </option>
                  ))}
              </select>
            </div>
            {!driver && (
              <button
                className="icon-button notification-bell"
                aria-label="Notifications"
                onClick={() => navigate("notifications")}
              >
                <Bell size={19} />
                {data.notifications.some((n) => !n.read) && <i />}
              </button>
            )}
            <button
              className="avatar small"
              aria-label="Profile"
              onClick={() => navigate("settings")}
            >
              {driver ? user.name[0] : "SA"}
            </button>
          </div>
        </header>
        <main className="page-content">
          {!driver && (
            <div className="page-heading">
              <div>
                <div className="eyebrow">
                  {new Date().toLocaleDateString("en-IN", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </div>
                <h1>{heading[0]}</h1>
                <p>{heading[1]}</p>
              </div>
              {page === "dashboard" && (
                <div className="button-group">
                  <button
                    className="button secondary"
                    onClick={() => navigate("reports")}
                  >
                    <Download size={16} />
                    Export report
                  </button>
                  <button className="button" onClick={() => act("order")}>
                    <Plus size={17} />
                    New order
                  </button>
                </div>
              )}
            </div>
          )}
          {driver && page !== "dashboard" && (
            <h1>{page === "visits" ? "Supplier visits" : heading[0]}</h1>
          )}
          {!shopId && (
            <p className="info">
              Create a location and shop in Master settings to begin
              transactions.
            </p>
          )}
          {content}
          <div className="page-footer">
            <span>MeatFlow · A clearer view of your business.</span>
            <span>
              <i />
              System connected
            </span>
          </div>
        </main>
        {driver && (
          <nav className="driver-bottom">
            {[
              ["dashboard", "Home", LayoutDashboard],
              ["orders", "Orders", ShoppingBag],
              ["notifications", "Notifications", Bell],
              ["settings", "Profile", Settings],
            ].map(([p, t, I]) => (
              <button
                className={page === p ? "active" : ""}
                key={p}
                onClick={() => navigate(p)}
              >
                <I size={19} />
                <span>{t}</span>
              </button>
            ))}
          </nav>
        )}
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
        </div>
      )}
      {error && (
        <Modal title="Please check" onClose={() => setError("")}>
          <p className="error" role="alert">
            {error}
          </p>
          <footer>
            <button className="button" onClick={() => setError("")}>
              Got it
            </button>
          </footer>
        </Modal>
      )}
      {modal &&
        (() => {
          const { type } = modal,
            record = ["orderDetail", "deliver"].includes(type)
              ? data.orders.find((o) => o.id === modal.record?.id) ||
                modal.record
              : modal.record,
            onClose = () => setModal(null);
          if (type === "master") {
            const { kind, ...initial } = record;
            return (
              <FormModal
                title={(initial.id ? "Edit " : "Add ") + schemas[kind].title}
                data={data}
                fields={schemas[kind].fields}
                initial={initial}
                onClose={onClose}
                onSave={async (v) => {
                  await api(
                    kind === "users" ? "/users" : "/masters/" + kind,
                    v,
                  );
                  await refresh();
                  notify("Record saved");
                }}
              />
            );
          }
          if (actionSchemas[type])
            return (
              <FormModal
                title={actionSchemas[type].title}
                fields={actionSchemas[type].fields}
                initial={record}
                data={data}
                onClose={onClose}
                onSave={(v) => run(type, v)}
              />
            );
          if (["order", "purchase", "visit", "finalizePurchase"].includes(type))
            return (
              <OrderModal
                mode={type}
                record={record}
                data={data}
                shopId={shopId}
                onClose={onClose}
                onSave={(v) => run(type, v)}
              />
            );
          if (type === "deliver")
            return (
              <DeliveryModal
                order={record}
                data={data}
                onClose={onClose}
                onSave={(v) => run("deliver", v)}
              />
            );
          if (type === "invoice")
            return <BillModal bill={record} data={data} onClose={onClose} />;
          if (type === "password")
            return (
              <FormModal
                title="Change password"
                fields={[
                  f("current", "Current password", "password"),
                  f("password", "New password (10+ characters)", "password"),
                ]}
                data={data}
                onClose={onClose}
                onSave={async (v) => {
                  await api("/password", v);
                  await logout();
                  notify("Password changed. Sign in again.");
                }}
              />
            );
          if (type === "scan")
            return (
              <Scanner
                onClose={onClose}
                onScan={(v) => notify("Scanned QR: " + v.slice(0, 100))}
              />
            );
          if (type === "orderDetail")
            return (
              <Modal wide title={record.number} onClose={onClose}>
                {record.deliveryAddress && (
                  <>
                    <h3>{record.deliveryAddress}</h3>
                    <p>
                      {record.paymentMethod}{" "}
                      {record.prepaidReference &&
                        `· Reference: ${record.prepaidReference}`}
                    </p>
                    <p>
                      {record.acceptedAt
                        ? `Automatically accepted: ${new Date(record.acceptedAt).toLocaleString()}`
                        : "Waiting for driver GPS acceptance"}
                    </p>
                    <DeliveryMap
                      lat={record.dropLocation?.lat}
                      lng={record.dropLocation?.lng}
                      start={record.startLocation}
                      drop={record.actualDropLocation}
                      points={data.tracking
                        .filter((t) => t.orderIds?.includes(record.id))
                        .slice()
                        .reverse()}
                    />
                  </>
                )}
                <Table
                  search={false}
                  rows={record.items}
                  columns={columns([
                    ["name", "Item"],
                    ["qty", "Quantity"],
                    ["unit", "Unit"],
                    ["price", "Price", "money"],
                    ["total", "Total", "money"],
                  ])}
                />
                <p className="line-total">
                  Total <strong>{money(record.total)}</strong>
                </p>
                {data.deliveries
                  .filter((d) => d.orderId === record.id)
                  .map((d) => (
                    <div key={d.id}>
                      <p>
                        Delivered {new Date(d.timestamp).toLocaleString()} ·{" "}
                        {d.loadedWeight} kg · GPS {d.lat}, {d.lng}
                      </p>
                      <img
                        className="saved-signature"
                        src={d.signature}
                        alt="Customer signature"
                      />
                    </div>
                  ))}
              </Modal>
            );
          if (type === "route")
            return (
              <Modal
                wide
                title={record.name + " · Route history"}
                onClose={onClose}
              >
                <DeliveryMap
                  points={data.tracking
                    .filter((t) => t.driverId === record.id)
                    .slice()
                    .reverse()}
                />
                <Table
                  rows={record.points}
                  columns={[
                    {
                      key: "timestamp",
                      label: "Time",
                      render: (r) => new Date(r.timestamp).toLocaleString(),
                    },
                    { key: "lat", label: "Latitude" },
                    { key: "lng", label: "Longitude" },
                  ]}
                  actions={(r) => (
                    <a
                      className="text-button"
                      target="_blank"
                      rel="noreferrer"
                      href={`https://www.openstreetmap.org/?mlat=${r.lat}&mlon=${r.lng}#map=16/${r.lat}/${r.lng}`}
                    >
                      Map <ArrowUpRight size={14} />
                    </a>
                  )}
                />
              </Modal>
            );
          return (
            <FormModal
              title={
                type === "delete"
                  ? "Delete record?"
                  : type === "cancelOrder"
                    ? "Cancel order?"
                    : "Create bill & delivery challan?"
              }
              fields={[]}
              data={data}
              onClose={onClose}
              onSave={async () => {
                if (type === "delete") {
                  await api(
                    (record.kind === "users"
                      ? "/users/"
                      : "/masters/" + record.kind + "/") + record.id,
                    null,
                    "DELETE",
                  );
                  await refresh();
                  notify("Record deleted");
                } else
                  await run(
                    type === "confirmBill" ? "bill" : "cancelOrder",
                    type === "confirmBill"
                      ? { orderId: record.id, shopId: record.shopId }
                      : { id: record.id },
                  );
              }}
            >
              <p>
                {type === "delete"
                  ? "This removes the record permanently. Records in use must be marked inactive instead."
                  : type === "cancelOrder"
                    ? `Cancel ${record.number}? This action cannot be undone.`
                    : `Issue ${money(record.total)} for ${label(data, "customers", record.customerId)}? This will deduct inventory, update their balance, and queue an SMS.`}
              </p>
            </FormModal>
          );
        })()}
    </div>
  );
}
function PublicPreorder({ token }) {
  const [data, setData] = useState(null),
    [items, setItems] = useState([{ itemId: "", qty: 1 }]),
    [date, setDate] = useState(day()),
    [error, setError] = useState(""),
    [result, setResult] = useState(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api("/preorder/" + token)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [token]);
  return (
    <div className="public-order">
      <div className="brand">
        <span className="brand-icon">
          <Package />
        </span>
        meatflow.
      </div>
      <section className="panel">
        <span className="eyebrow">CUSTOMER PRE-ORDER</span>
        <h1>{data?.shop.name || "Place your order"}</h1>
        {result ? (
          <div className="success">
            <h2>Your pre-order is received.</h2>
            <p>
              {result.number} · {result.status}
            </p>
          </div>
        ) : (
          data && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                try {
                  setResult(
                    await api("/preorder/" + token, {
                      items,
                      deliveryDate: date,
                    }),
                  );
                } catch (e) {
                  setError(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Delivery date
                <input
                  type="date"
                  min={day()}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </label>
              {items.map((l, i) => (
                <div className="item-line" key={i}>
                  <label>
                    Item
                    <select
                      required
                      value={l.itemId}
                      onChange={(e) =>
                        setItems(
                          items.map((x, j) =>
                            j === i ? { ...x, itemId: e.target.value } : x,
                          ),
                        )
                      }
                    >
                      <option value="">Select item</option>
                      {data.items.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name} · {money(x.price)}/{x.unit}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Quantity
                    <input
                      required
                      min="0.01"
                      step="0.01"
                      type="number"
                      value={l.qty}
                      onChange={(e) =>
                        setItems(
                          items.map((x, j) =>
                            j === i ? { ...x, qty: e.target.value } : x,
                          ),
                        )
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Remove item"
                    onClick={() => setItems(items.filter((_, j) => j !== i))}
                  >
                    <X size={17} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="text-button"
                onClick={() => setItems([...items, { itemId: "", qty: 1 }])}
              >
                <Plus size={16} />
                Add item
              </button>
              <footer>
                <button className="button" disabled={busy || !items.length}>
                  Submit pre-order <ArrowRight size={16} />
                </button>
              </footer>
            </form>
          )
        )}
        {error && <p className="error">{error}</p>}
      </section>
    </div>
  );
}
const token = window.location.pathname.match(/^\/preorder\/([^/]+)$/)?.[1];
if ("serviceWorker" in navigator && import.meta.env.PROD)
  navigator.serviceWorker.register("/sw.js").catch(() => {});
createRoot(document.getElementById("root")).render(
  token ? <PublicPreorder token={token} /> : <App />,
);
