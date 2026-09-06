import React, { useState, useEffect, useRef } from "react";
import { Check, MapPin, Printer, ScanLine, LoaderCircle } from "lucide-react";
import {
  Modal,
  Fields,
  LineEditor,
  Signature,
  Badge,
  PaymentQR,
} from "./components";
import { field as f, money, label, day } from "./schema";
import { api, location } from "./api";
import { prepareOrderSubmission } from "./order-validation";
import DeliveryMap from "./DeliveryMap";
export function OrderModal({
  mode = "order",
  record,
  data,
  shopId,
  onClose,
  onSave,
}) {
  const [value, setValue] = useState({
    customerId: "",
    supplierId: "",
    driverId: "",
    channel: "Wholesale",
    deliveryDate: day(),
    shopId,
    deliveryAddress: "",
    dropLat: "",
    dropLng: "",
    paymentMethod: "Cash on delivery",
    prepaidReference: "",
    ...record,
    ...(record?.dropLocation
      ? { dropLat: record.dropLocation.lat, dropLng: record.dropLocation.lng }
      : {}),
  });
  const [items, setItems] = useState(
    record?.items || [{ itemId: "", qty: 1, price: 0 }],
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const supplier = ["purchase", "visit", "finalizePurchase"].includes(mode);
  const updateValue = (update) =>
    setValue((previous) => {
      const next = typeof update === "function" ? update(previous) : update;
      if (
        next.customerId !== previous.customerId ||
        next.shopId !== previous.shopId
      ) {
        const customer = data.customers.find((c) => c.id === next.customerId);
        const eligible = data.users.filter(
          (u) =>
            u.role === "driver" &&
            u.status === "Active" &&
            u.shops?.includes(next.shopId),
        );
        const assigned =
          eligible.find((u) => u.id === customer?.driverId) ||
          eligible.sort(
            (a, b) =>
              data.orders.filter(
                (o) => o.driverId === a.id && o.status === "Pending",
              ).length -
              data.orders.filter(
                (o) => o.driverId === b.id && o.status === "Pending",
              ).length,
          )[0];
        return {
          ...next,
          driverId: assigned?.id || "",
          ...(next.customerId !== previous.customerId
            ? {
                deliveryAddress: customer?.address || "",
                dropLat: customer?.lat ?? "",
                dropLng: customer?.lng ?? "",
              }
            : {}),
        };
      }
      return next;
    });
  return (
    <Modal
      wide
      title={
        {
          order: record?.id ? "Edit pre-order" : "Create pre-order",
          purchase: "Create purchase order",
          visit: "Log supplier visit",
          finalizePurchase: "Finalize purchase & receive stock",
        }[mode]
      }
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const submission = prepareOrderSubmission({
              mode,
              value,
              items,
              data,
            });
            const loc = mode === "visit" ? await location() : {};
            await onSave({ ...submission, ...loc });
            onClose();
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {mode !== "finalizePurchase" && (
          <Fields
            data={data}
            value={value}
            setValue={updateValue}
            fields={[
              f("shopId", "Shop / location", "ref", "shops"),
              ...(supplier
                ? [
                    f("supplierId", "Supplier", "ref", "suppliers"),
                    ...(mode === "visit"
                      ? [f("remarks", "Visit remarks", "text", null, false)]
                      : []),
                  ]
                : [
                    f("customerId", "Customer", "ref", "customers"),
                    f("driverId", "Assigned driver", "ref", "drivers"),
                    f(
                      "deliveryAddress",
                      "Customer delivery address",
                      "textarea",
                    ),
                    f("paymentMethod", "Payment option", "select", [
                      "Prepaid",
                      "Cash on delivery",
                    ]),
                    ...(value.paymentMethod === "Prepaid"
                      ? [f("prepaidReference", "Prepaid payment reference")]
                      : []),
                    f("channel", "Sales type", "select", [
                      "Wholesale",
                      "Retail",
                    ]),
                    f("deliveryDate", "Delivery date", "date"),
                  ]),
            ]}
          />
        )}
        {!supplier && (
          <>
            <p className="info">
              Click the map to pin the exact customer destination, or enter its
              coordinates. This must be the customer's location.
            </p>
            <div className="form-grid">
              <label>
                Destination latitude
                <input
                  aria-label="Destination latitude"
                  required
                  type="number"
                  step="any"
                  min="-90"
                  max="90"
                  value={value.dropLat}
                  onChange={(e) =>
                    setValue((v) => ({ ...v, dropLat: e.target.value }))
                  }
                />
              </label>
              <label>
                Destination longitude
                <input
                  aria-label="Destination longitude"
                  required
                  type="number"
                  step="any"
                  min="-180"
                  max="180"
                  value={value.dropLng}
                  onChange={(e) =>
                    setValue((v) => ({ ...v, dropLng: e.target.value }))
                  }
                />
              </label>
            </div>
            <DeliveryMap
              lat={value.dropLat}
              lng={value.dropLng}
              onPick={(p) =>
                setValue((v) => ({
                  ...v,
                  dropLat: p.lat.toFixed(6),
                  dropLng: p.lng.toFixed(6),
                }))
              }
            />
          </>
        )}
        <LineEditor
          items={data.items}
          value={items}
          onChange={setItems}
          locked={mode === "finalizePurchase"}
        />
        {!data.shops.some((s) => s.status === "Active") && (
          <p className="error">
            No active shop is available. Create a shop in Master settings →
            Shops, or ask the admin to assign one to your driver account.
          </p>
        )}
        {mode === "purchase" && (
          <p className="info">
            Initial prices are saved now. Final prices can be updated and stock
            received after 48 hours.
          </p>
        )}
        {mode === "visit" && (
          <p className="info">
            Your GPS location and timestamp will be captured with this visit.
            Received shop stock is recorded through the purchase workflow.
          </p>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <footer>
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button disabled={busy || !items.length} className="button">
            {busy ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <Check size={16} />
            )}
            Save {mode === "order" ? "pre-order" : "record"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
export function DeliveryModal({ order, onClose, onSave, data }) {
  const [signature, setSignature] = useState(""),
    [weight, setWeight] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal title="Confirm delivery" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await onSave({
              orderId: order.id,
              signature,
              loadedWeight: weight,
              ...(await location()),
            });
            onClose();
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="delivery-summary">
          <strong>{label(data, "customers", order.customerId)}</strong>
          <span>
            {order.number} · {money(order.total)}
          </span>
          <p>{order.deliveryAddress}</p>
          <strong>
            {order.paymentMethod || "Payment option not recorded"}
          </strong>
          <p>
            {order.paymentMethod === "Prepaid"
              ? "No cash to collect."
              : order.paymentMethod === "Cash on delivery"
                ? `Cash on delivery amount: ${money(order.total)}`
                : ""}
          </p>
        </div>
        <label>
          Loaded weight (kg) *
          <input
            required
            type="number"
            min="0.01"
            step="0.01"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </label>
        <Signature onChange={setSignature} />
        <p className="info">
          <MapPin size={16} /> GPS location and delivery time are recorded on
          confirmation.
        </p>
        {error && <p className="error">{error}</p>}
        <footer>
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button" disabled={busy || !signature}>
            {busy ? "Capturing location…" : "Confirm delivery"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
export function BillModal({ bill, data, onClose }) {
  const customer = data.customers.find((c) => c.id === bill.customerId);
  const [dc, setDc] = useState(false);
  return (
    <Modal
      wide
      title={dc ? "Delivery challan" : "Customer invoice"}
      onClose={onClose}
    >
      <div className="print-controls">
        <button className="button secondary" onClick={() => setDc(!dc)}>
          View {dc ? "invoice" : "delivery challan"}
        </button>
        <button className="button" onClick={() => window.print()}>
          <Printer size={16} />
          Print / Save PDF
        </button>
      </div>
      <article className="invoice">
        <div className="invoice-head">
          <div>
            <h1>{data.profile?.businessName || "MeatFlow"}</h1>
            <p>{data.profile?.address}</p>
            <p>
              {data.profile?.contact}
              {data.profile?.gst && " · GST: " + data.profile.gst}
            </p>
          </div>
          <div>
            <span className="eyebrow">
              {dc ? "DELIVERY CHALLAN" : "TAX INVOICE"}
            </span>
            <h3>{dc ? bill.dcNumber : bill.number}</h3>
            <p>
              {bill.date} · {bill.channel}
            </p>
          </div>
        </div>
        <div className="invoice-parties">
          <div>
            <small>BILL TO</small>
            <h3>{customer?.name}</h3>
            <p>{customer?.address}</p>
            <p>{customer?.mobile}</p>
          </div>
          <div>
            <small>FULFILLED BY</small>
            <h3>{label(data, "shops", bill.shopId)}</h3>
            <p>Driver: {label(data, "users", bill.driverId)}</p>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Quantity</th>
              <th>Price</th>
              <th>Tax</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {bill.items.map((l) => (
              <tr key={l.itemId}>
                <td>{l.name}</td>
                <td>
                  {l.qty} {l.unit}
                </td>
                <td>{money(l.price)}</td>
                <td>{l.tax}%</td>
                <td>{money(l.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="invoice-totals">
          <p>
            <span>Total amount</span>
            <strong>{money(bill.total)}</strong>
          </p>
          <p>
            <span>Previous balance</span>
            {money(bill.previousBalance)}
          </p>
          <p>
            <span>Closing balance at issue</span>
            <strong>{money(bill.closingBalance)}</strong>
          </p>
        </div>
        {data.deliveries
          ?.filter((d) => d.orderId === bill.orderId)
          .map((d) => (
            <div key={d.id}>
              <p>
                Delivered: {new Date(d.timestamp).toLocaleString()} · Loaded:{" "}
                {d.loadedWeight} kg
              </p>
              <img
                className="saved-signature"
                src={d.signature}
                alt="Customer delivery signature"
              />
            </div>
          ))}
        <p className="invoice-foot">
          Thank you for your business. This document was generated
          electronically.
        </p>
      </article>
    </Modal>
  );
}
export function Scanner({ onClose, onScan }) {
  const video = useRef(),
    stream = useRef();
  const [error, setError] = useState("");
  useEffect(() => {
    let stopped = false,
      timer;
    async function start() {
      try {
        if (!("BarcodeDetector" in window))
          throw new Error(
            "QR scanning is not supported in this browser. Use a supported Android Chrome browser or enter the reference manually.",
          );
        stream.current = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (stopped) {
          stream.current.getTracks().forEach((t) => t.stop());
          return;
        }
        video.current.srcObject = stream.current;
        await video.current.play();
        const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
        timer = setInterval(async () => {
          try {
            const codes = await detector.detect(video.current);
            if (codes[0] && !stopped) {
              stopped = true;
              onScan(codes[0].rawValue);
              onClose();
            }
          } catch {}
        }, 700);
      } catch (e) {
        setError(e.message);
      }
    }
    start();
    return () => {
      stopped = true;
      clearInterval(timer);
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  return (
    <Modal title="Scan payment QR" onClose={onClose}>
      {error ? (
        <p className="error">{error}</p>
      ) : (
        <video ref={video} className="scanner" muted playsInline />
      )}
      <p className="info">
        Scanning identifies a QR. Record a payment only after verifying the
        successful transaction.
      </p>
    </Modal>
  );
}
