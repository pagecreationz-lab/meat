export async function api(path, body, method) {
  const token = sessionStorage.getItem("meat-token");
  const res = await fetch("/api" + path, {
    method: method || (body ? "POST" : "GET"),
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const responseText = await res.text();
  let data;
  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(
      res.status >= 500
        ? `The server is unavailable (HTTP ${res.status}). Please contact the administrator.`
        : "The server returned an unexpected response. Please contact the administrator.",
    );
  }
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith("/auth/"))
      window.dispatchEvent(new Event("session-ended"));
    throw new Error(data.error || "Request failed");
  }
  return data;
}
export function location() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation)
      return reject(new Error("GPS is not supported on this device"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () =>
        reject(
          new Error(
            "Location access is required. Enable GPS permission and retry.",
          ),
        ),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}
export function exportCsv(name, rows) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const esc = (v) =>
    '"' +
    String(typeof v === "object" ? JSON.stringify(v) : (v ?? ""))
      .replaceAll('"', '""')
      .replace(/^[=+@-]/, "'$&") +
    '"';
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob(
      [
        "\uFEFF" +
          [
            keys.map(esc).join(","),
            ...rows.map((r) => keys.map((k) => esc(r[k])).join(",")),
          ].join("\r\n"),
      ],
      { type: "text/csv" },
    ),
  );
  a.download = name + ".csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
