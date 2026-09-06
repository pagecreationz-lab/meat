import React from "react";
import { MapPin, Navigation, Bell } from "lucide-react";
import { Badge, Empty } from "./components";
import { label, money } from "./schema";
import DeliveryMap from "./DeliveryMap";
export default function DriverDeliveries({ data, user, gpsState, page, act }) {
  const orders = data.orders.filter((o) => o.driverId === user.id);
  const pending = orders.filter((o) => o.status === "Pending");
  return (
    <>
      <div className="driver-hero">
        <span className="eyebrow">YOUR DELIVERY WORKSPACE</span>
        <h2>Hello, {user.name.split(" ")[0]}.</h2>
        <p>
          {pending.length} assigned deliveries ·{" "}
          {orders.filter((o) => o.status === "Delivered").length} completed
        </p>
        <div className="gps-pill">
          <MapPin size={14} />
          {gpsState || "Connecting GPS…"}
        </div>
      </div>
      <p className="info">
        Assigned deliveries are automatically accepted when GPS is available.
        Keep this app open for live tracking. There is no reject option.
      </p>
      {page === "notifications" ? (
        <section className="panel">
          {data.notifications.length ? (
            data.notifications.map((n) => (
              <div className="notification" key={n.id}>
                <Bell size={18} />
                <div>
                  <strong>{n.title}</strong>
                  <p>{n.detail}</p>
                  <small>{new Date(n.createdAt).toLocaleString()}</small>
                </div>
              </div>
            ))
          ) : (
            <Empty title="No assignment notifications yet" />
          )}
        </section>
      ) : (
        <div className="delivery-cards">
          {orders.length ? (
            orders.map((o) => {
              const trail = data.tracking
                .filter((t) => t.orderIds?.includes(o.id))
                .slice()
                .reverse();
              return (
                <article className="delivery-card" key={o.id}>
                  <div className="section-title">
                    <strong>{o.number}</strong>
                    <Badge>{o.status}</Badge>
                  </div>
                  <h3>{label(data, "customers", o.customerId)}</h3>
                  <p>
                    {o.deliveryAddress ||
                      "Admin must add the customer delivery address."}
                  </p>
                  <div className="delivery-meta">
                    <Badge>{o.paymentMethod || "Payment details needed"}</Badge>
                    <strong>{money(o.total)}</strong>
                  </div>
                  <p>
                    {o.paymentMethod === "Prepaid"
                      ? "Prepaid — no cash to collect."
                      : o.paymentMethod === "Cash on delivery"
                        ? `Cash on delivery: ${money(o.total)}`
                        : ""}
                  </p>
                  <p>
                    {o.acceptedAt
                      ? `Auto-accepted ${new Date(o.acceptedAt).toLocaleString()}`
                      : "Waiting for GPS to auto-accept"}
                  </p>
                  <DeliveryMap
                    lat={o.dropLocation?.lat}
                    lng={o.dropLocation?.lng}
                    points={trail}
                    start={o.startLocation}
                    drop={o.actualDropLocation}
                  />
                  {o.dropLocation && (
                    <a
                      className="button secondary"
                      target="_blank"
                      rel="noreferrer"
                      href={`https://www.google.com/maps/dir/?api=1&destination=${o.dropLocation.lat},${o.dropLocation.lng}`}
                    >
                      <Navigation size={16} />
                      Navigate to customer
                    </a>
                  )}
                  {o.status === "Pending" && (
                    <button
                      className="button"
                      style={{ marginLeft: 8 }}
                      disabled={!o.acceptedAt || !o.dropLocation}
                      onClick={() => act("deliver", o)}
                    >
                      Confirm delivery
                    </button>
                  )}
                </article>
              );
            })
          ) : (
            <Empty
              title="No assigned deliveries"
              description="Orders assigned by the admin will appear here automatically."
            />
          )}
        </div>
      )}
    </>
  );
}
