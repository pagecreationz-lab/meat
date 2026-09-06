import React, { useState, useRef, useEffect } from "react";
import {
  X,
  Search,
  ArrowUpRight,
  Package,
  Plus,
  Trash2,
  Download,
  Check,
  LoaderCircle,
} from "lucide-react";
import QRCode from "qrcode";
import { money, label, day } from "./schema";
export function Badge({ children }) {
  return (
    <span
      className={
        "badge " +
        ([
          "Active",
          "Delivered",
          "Paid",
          "Received",
          "Sent",
          "Present",
        ].includes(children)
          ? "green"
          : ["Cancelled", "Inactive", "Absent", "Failed", "Due"].includes(
                children,
              )
            ? "red"
            : ["Pending", "Partially Paid", "Queued", "Low stock"].includes(
                  children,
                )
              ? "amber"
              : "")
      }
    >
      {children || "—"}
    </span>
  );
}
export function Empty({
  title = "Nothing here yet",
  description = "New records will appear here as your operations get moving.",
}) {
  return (
    <div className="empty">
      <Package size={30} />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
export function Table({ columns, rows, search = true, actions, empty }) {
  const [query, setQuery] = useState("");
  const filtered = rows.filter((r) =>
    JSON.stringify(r).toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="table-panel">
      {search && (
        <div className="table-tools">
          <div className="search">
            <Search size={16} />
            <input
              aria-label="Search records"
              placeholder="Search records…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <span className="muted">{filtered.length} records</span>
        </div>
      )}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
              {actions && <th className="right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={r.id || i}>
                {columns.map((c, j) => (
                  <td key={c.key} className={j === 0 ? "primary-cell" : ""}>
                    {c.render ? c.render(r) : String(r[c.key] ?? "—")}
                  </td>
                ))}
                {actions && (
                  <td>
                    <div className="row-actions">{actions(r)}</div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!filtered.length && <Empty title={empty || "No records found"} />}
    </div>
  );
}
export function Modal({ title, children, onClose, wide = false }) {
  useEffect(() => {
    const listener = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [onClose]);
  return (
    <div
      className="overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={"modal " + (wide ? "wide" : "")}
      >
        <header>
          <div>
            <span className="eyebrow">MEATFLOW OPERATIONS</span>
            <h2>{title}</h2>
          </div>
          <button className="icon-button" aria-label="Close" onClick={onClose}>
            <X size={21} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
export function Fields({ fields, value, setValue, data }) {
  const change = (k, v) => setValue((prev) => ({ ...prev, [k]: v }));
  return (
    <div className="form-grid">
      {fields.map((f) => {
        let options =
          f.type === "ref" || f.type === "multi"
            ? (f.options === "drivers"
                ? data.users?.filter((u) => u.role === "driver")
                : data[f.options]) || []
            : f.type === "party"
              ? data[
                  value.partyType === "Supplier" ? "suppliers" : "customers"
                ] || []
              : f.options;
        return (
          <label
            key={f.key}
            className={
              ["textarea", "multi", "permissions"].includes(f.type)
                ? "full"
                : ""
            }
          >
            {f.label}
            {f.required && (
              <span className="required" aria-hidden="true">
                {" "}
                *
              </span>
            )}
            {f.type === "permissions" ? (
              <div className="permission-grid">
                {[
                  "Orders",
                  "Billing",
                  "Inventory",
                  "Purchases",
                  "Payments",
                  "Reports",
                  "Masters",
                  "Expenses",
                  "Supplier visits",
                ].map((resource) => (
                  <div key={resource}>
                    <strong>{resource}</strong>
                    {["View", "Create", "Edit", "Delete", "Download"].map(
                      (action) => (
                        <label key={action}>
                          <input
                            type="checkbox"
                            checked={
                              !!value.permissions?.[resource]?.includes(action)
                            }
                            onChange={(e) => {
                              const old = value.permissions?.[resource] || [];
                              change("permissions", {
                                ...value.permissions,
                                [resource]: e.target.checked
                                  ? [...old, action]
                                  : old.filter((a) => a !== action),
                              });
                            }}
                          />
                          {action}
                        </label>
                      ),
                    )}
                  </div>
                ))}
              </div>
            ) : f.type === "multi" ? (
              <div className="check-options">
                {options.map((o) => (
                  <label key={o.id}>
                    <input
                      type="checkbox"
                      checked={value[f.key]?.includes(o.id) || false}
                      onChange={(e) =>
                        change(
                          f.key,
                          e.target.checked
                            ? [...(value[f.key] || []), o.id]
                            : (value[f.key] || []).filter((id) => id !== o.id),
                        )
                      }
                    />
                    {o.name}
                  </label>
                ))}
              </div>
            ) : ["select", "ref", "party"].includes(f.type) ? (
              <select
                aria-label={f.label}
                required={f.required}
                value={value[f.key] ?? ""}
                onChange={(e) => {
                  change(f.key, e.target.value);
                  if (f.key === "partyType") change("partyId", "");
                }}
              >
                <option value="">Select {f.label.toLowerCase()}</option>
                {(options || [])
                  .filter(
                    (o) =>
                      typeof o === "string" ||
                      o.status !== "Inactive" ||
                      o.id === value[f.key],
                  )
                  .map((o) => (
                    <option key={o.id || o} value={o.id || o}>
                      {o.name || o.code || o}
                    </option>
                  ))}
              </select>
            ) : f.type === "textarea" ? (
              <textarea
                aria-label={f.label}
                required={f.required}
                value={value[f.key] ?? ""}
                onChange={(e) => change(f.key, e.target.value)}
              />
            ) : (
              <input
                aria-label={f.label}
                type={f.type}
                required={f.required}
                min={f.type === "number" ? 0 : undefined}
                step={f.type === "number" ? "0.01" : undefined}
                value={value[f.key] ?? ""}
                onChange={(e) => change(f.key, e.target.value)}
              />
            )}
          </label>
        );
      })}
    </div>
  );
}
export function FormModal({
  title,
  fields,
  initial = {},
  data,
  onSave,
  onClose,
  children,
}) {
  const [value, setValue] = useState({
    date: day(),
    status: "Active",
    ...initial,
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal title={title} onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await onSave(value);
            onClose();
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Fields fields={fields} value={value} setValue={setValue} data={data} />
        {children}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <footer>
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button" disabled={busy}>
            {busy ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <Check size={16} />
            )}
            Save changes
          </button>
        </footer>
      </form>
    </Modal>
  );
}
export function LineEditor({
  items,
  value,
  onChange,
  prices = true,
  locked = false,
}) {
  const update = (index, key, v) =>
    onChange(
      value.map((l, i) =>
        i === index
          ? {
              ...l,
              [key]: v,
              ...(key === "itemId"
                ? { price: items.find((x) => x.id === v)?.price || 0 }
                : {}),
            }
          : l,
      ),
    );
  return (
    <div className="line-editor">
      <div className="section-title">
        <h3>Items & quantities</h3>
        {!locked && (
          <button
            type="button"
            className="text-button"
            onClick={() =>
              onChange([...value, { itemId: "", qty: 1, price: 0 }])
            }
          >
            <Plus size={15} /> Add item
          </button>
        )}
      </div>
      {value.map((line, i) => (
        <div className="item-line" key={i}>
          <label>
            Item
            <select
              aria-label="Item"
              required
              disabled={locked}
              value={line.itemId}
              onChange={(e) => update(i, "itemId", e.target.value)}
            >
              <option value="">Select item</option>
              {items
                .filter((x) => x.status === "Active")
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name} ({x.unit})
                  </option>
                ))}
            </select>
          </label>
          <label>
            Quantity
            <input
              aria-label="Quantity"
              disabled={locked}
              type="number"
              min="0.01"
              step="0.01"
              required
              value={line.qty}
              onChange={(e) => update(i, "qty", e.target.value)}
            />
          </label>
          {prices && (
            <label>
              Unit price
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={line.price}
                onChange={(e) => update(i, "price", e.target.value)}
              />
            </label>
          )}
          {!locked && (
            <button
              type="button"
              aria-label="Remove item"
              className="icon-button danger"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      ))}
      {!value.length && (
        <p className="muted">Add at least one item to continue.</p>
      )}
      <div className="line-total">
        Estimated total (including tax){" "}
        <strong>
          {money(
            value.reduce(
              (s, l) =>
                s +
                Number(l.qty) *
                  Number(
                    l.price || items.find((i) => i.id === l.itemId)?.price || 0,
                  ) *
                  (1 +
                    Number(items.find((i) => i.id === l.itemId)?.tax || 0) /
                      100),
              0,
            ),
          )}
        </strong>
      </div>
    </div>
  );
}
export function Signature({ onChange }) {
  const ref = useRef(),
    drawing = useRef(false),
    hasInk = useRef(false);
  const point = (e) => {
    const r = ref.current.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * ref.current.width) / r.width,
      y: ((e.clientY - r.top) * ref.current.height) / r.height,
    };
  };
  return (
    <div className="signature">
      <div className="section-title">
        <label>Customer signature *</label>
        <button
          type="button"
          className="text-button"
          onClick={() => {
            ref.current.getContext("2d").clearRect(0, 0, 600, 180);
            hasInk.current = false;
            onChange("");
          }}
        >
          Clear
        </button>
      </div>
      <canvas
        aria-label="Customer signature pad"
        ref={ref}
        width="600"
        height="180"
        onPointerDown={(e) => {
          drawing.current = true;
          ref.current.setPointerCapture(e.pointerId);
          const p = point(e),
            ctx = ref.current.getContext("2d");
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineWidth = 2;
          ctx.strokeStyle = "#173d32";
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const p = point(e),
            ctx = ref.current.getContext("2d");
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          hasInk.current = true;
        }}
        onPointerUp={() => {
          drawing.current = false;
          if (hasInk.current) onChange(ref.current.toDataURL());
        }}
      />
      <small>Ask the customer to sign inside this box.</small>
    </div>
  );
}
export function PaymentQR({ bank }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    if (bank?.upi)
      QRCode.toDataURL(
        `upi://pay?pa=${encodeURIComponent(bank.upi)}&pn=${encodeURIComponent(bank.holder)}`,
        { width: 240, margin: 2 },
      ).then(setSrc);
  }, [bank?.upi, bank?.holder]);
  return bank?.upi ? (
    <div className="qr-card">
      <img src={src} alt={"UPI payment QR for " + bank.holder} />
      <strong>{bank.holder}</strong>
      <span>{bank.upi}</span>
      <Badge>Active</Badge>
    </div>
  ) : (
    <Empty
      title="UPI ID not configured"
      description="Add a UPI ID to the linked bank account to generate this payment QR."
    />
  );
}
