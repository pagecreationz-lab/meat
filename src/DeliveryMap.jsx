import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
export default function DeliveryMap({
  lat,
  lng,
  onPick,
  points = [],
  start,
  drop,
}) {
  const element = useRef(),
    map = useRef(),
    layers = useRef(),
    pick = useRef(onPick);
  pick.current = onPick;
  useEffect(() => {
    const m = L.map(element.current).setView([13.0827, 80.2707], 12);
    map.current = m;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(m);
    layers.current = L.layerGroup().addTo(m);
    m.on("click", (e) =>
      pick.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }),
    );
    const timer = setTimeout(() => m.invalidateSize(), 150);
    return () => {
      clearTimeout(timer);
      m.remove();
    };
  }, []);
  useEffect(() => {
    const g = layers.current;
    g.clearLayers();
    const coords = [];
    const add = (p, text, color) => {
      if (
        p &&
        p.lat !== "" &&
        p.lng !== "" &&
        Number.isFinite(Number(p.lat)) &&
        Number.isFinite(Number(p.lng))
      ) {
        const a = [Number(p.lat), Number(p.lng)];
        coords.push(a);
        L.circleMarker(a, { radius: 8, color, fillOpacity: 0.8 })
          .bindTooltip(text)
          .addTo(g);
      }
    };
    add({ lat, lng }, "Customer destination", "#c46636");
    add(start, "Driver start", "#215442");
    add(drop, "Actual delivery location", "#753d91");
    const trail = points
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
      .map((p) => [p.lat, p.lng]);
    if (trail.length) {
      L.polyline(trail, { color: "#215442", weight: 4 }).addTo(g);
      coords.push(...trail);
      add(points.at(-1), "Latest driver location", "#247bc2");
    }
    if (coords.length)
      map.current.fitBounds(L.latLngBounds(coords), {
        padding: [30, 30],
        maxZoom: 16,
      });
  }, [lat, lng, start, drop, points]);
  return (
    <div
      ref={element}
      aria-label="Delivery location map"
      style={{ height: 300, borderRadius: 8, zIndex: 0, margin: "16px 0" }}
    />
  );
}
