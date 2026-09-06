import "dotenv/config";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import path from "node:path";
import { db, transaction, all, get, put, remove, initialize } from "./db.js";
import { masters } from "./config.js";
import { seed } from "./seed.js";

if (
  process.env.NODE_ENV === "production" &&
  (!process.env.JWT_SECRET ||
    process.env.JWT_SECRET.length < 32 ||
    !process.env.ADMIN_SECRET_CODE)
)
  throw new Error(
    "Production requires JWT_SECRET (32+ characters) and ADMIN_SECRET_CODE.",
  );
await initialize();
await seed();
const app = express();
const secret = process.env.JWT_SECRET || crypto.randomBytes(48).toString("hex");
const secondCode = process.env.ADMIN_SECRET_CODE || "246810";
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "2mb" }));
const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};
const amount = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) fail("Enter a valid non-negative amount");
  return Math.round(n * 100) / 100;
};
const positive = (v) => {
  const n = amount(v);
  if (n <= 0) fail("Quantity / amount must be greater than zero");
  return n;
};
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const date = (v) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v || "") || isNaN(Date.parse(v)))
    fail("Valid date required");
  return v;
};
const audit = (u, action, detail, c = db) =>
  put(
    "audit",
    {
      user: u.name,
      userId: u.id,
      action,
      detail,
      timestamp: new Date().toISOString(),
    },
    c,
  );
const notice = (title, detail, c = db) =>
  put("notifications", { title, detail, read: false, date: today() }, c);
const clean = (u) => {
  const { password, session_version, ...safe } = u;
  return safe;
};
const gps = (b) => {
  const lat = Number(b.lat),
    lng = Number(b.lng);
  if (
    b.lat == null ||
    b.lng == null ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  )
    fail("GPS permission and a valid location are required");
  return { lat, lng };
};
async function active(kind, id, c = db) {
  const r = await get(kind, id, c);
  if (r.status === "Inactive") fail("Selected " + kind + " record is inactive");
  return r;
}
async function permitted(user, resource, action) {
  if (user.role === "superadmin" || !user.permission_role_id) return true;
  const role = await get("roles", user.permission_role_id);
  return (
    role.status === "Active" &&
    Array.isArray(role.permissions?.[resource]) &&
    role.permissions[resource].includes(action)
  );
}
async function shopAccess(u, shopId) {
  await active("shops", shopId);
  if (u.role === "driver" && !u.shops.includes(shopId))
    fail("This shop is not assigned to you", 403);
}
async function currentStock(shopId, itemId, c = db) {
  return (await all("stock", c))
    .filter((s) => s.shopId === shopId && s.itemId === itemId)
    .reduce((n, s) => n + (s.direction === "In" ? s.qty : -s.qty), 0);
}
async function averageCost(shopId, itemId, c = db) {
  let qty = 0,
    value = 0;
  for (const s of (await all("stock", c))
    .filter((s) => s.shopId === shopId && s.itemId === itemId)
    .reverse()) {
    if (s.direction === "In") {
      qty += s.qty;
      value += s.qty * Number(s.cost || 0);
    } else {
      const cost = qty > 0 ? value / qty : 0;
      qty -= s.qty;
      value -= s.qty * cost;
    }
  }
  return qty > 0 ? Math.round((value / qty) * 10000) / 10000 : 0;
}
async function customerBalance(id, c = db) {
  const customer = await get("customers", id, c);
  const bills = (await all("bills", c)).filter((b) => b.customerId === id);
  const payments = (await all("payments", c)).filter(
    (p) => p.partyType === "Customer" && p.partyId === id,
  );
  return amount(
    Math.max(
      0,
      Number(customer.openingBalance || 0) +
        bills.reduce((s, b) => s + b.total, 0) -
        payments.reduce((s, p) => s + p.amount, 0),
    ),
  );
}
async function lines(input, c = db) {
  if (!Array.isArray(input) || !input.length) fail("Add at least one item");
  const seen = new Set();
  return Promise.all(
    input.map(async (l) => {
      if (seen.has(l.itemId)) fail("Combine duplicate item quantities");
      seen.add(l.itemId);
      const item = await active("items", l.itemId, c);
      const qty = positive(l.qty);
      const price = amount(l.price ?? item.price);
      const tax = amount(item.tax || 0);
      return {
        itemId: item.id,
        name: item.name,
        unit: item.unit,
        qty,
        price,
        tax,
        total: amount(qty * price * (1 + tax / 100)),
      };
    }),
  );
}
async function sms(to, message, c = db) {
  return put(
    "messages",
    { to, message, status: "Queued", attempts: 0, date: today() },
    c,
  );
}

app.get("/api/health", (req, res) =>
  res.json({
    status: "ok",
    database: process.env.DATABASE_URL ? "PostgreSQL" : "PGlite PostgreSQL",
    demo: process.env.NODE_ENV !== "production",
  }),
);
app.use(
  "/api/auth",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 40,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
app.post(
  "/api/auth/login",
  wrap(async (req, res) => {
    const { username, password, code, deviceId } = req.body;
    const u = (
      await db.query("SELECT * FROM users WHERE username=$1 OR mobile=$1", [
        username || "",
      ])
    ).rows[0];
    if (
      !u ||
      u.status !== "Active" ||
      !(await bcrypt.compare(password || "", u.password))
    )
      fail("Incorrect credentials or inactive account", 401);
    if (u.role === "superadmin" && code !== secondCode)
      fail("Enter the super admin verification code", 401);
    if (u.role === "driver") {
      const loc = gps(req.body);
      if (!deviceId || typeof deviceId !== "string" || deviceId.length > 100)
        fail("Device identifier required");
      await transaction(async (c) => {
        const mappings = (await all("devices", c)).filter(
          (d) => d.deviceId === deviceId,
        );
        for (const m of mappings) {
          await c.query(
            "UPDATE users SET session_version=session_version+1 WHERE id=$1",
            [m.driverId],
          );
          await remove("devices", m.id, c);
        }
        await c.query(
          "UPDATE users SET session_version=session_version+1 WHERE id=$1",
          [u.id],
        );
        await put(
          "devices",
          {
            deviceId,
            driverId: u.id,
            ip: req.ip,
            lastLogin: new Date().toISOString(),
          },
          c,
        );
        await put(
          "tracking",
          { driverId: u.id, ...loc, timestamp: new Date().toISOString() },
          c,
        );
      });
      u.session_version = (
        await db.query("SELECT session_version FROM users WHERE id=$1", [u.id])
      ).rows[0].session_version;
    }
    await audit(u, "Login", `IP ${req.ip}`);
    res.json({
      token: jwt.sign({ id: u.id, v: u.session_version }, secret, {
        expiresIn: "12h",
      }),
      user: clean(u),
    });
  }),
);
app.post(
  "/api/auth/forgot",
  wrap(async (req, res) => {
    const u = (
      await db.query("SELECT * FROM users WHERE mobile=$1", [
        String(req.body.mobile || ""),
      ])
    ).rows[0];
    if (u) {
      if (u.role === "driver")
        await put("resetRequests", {
          userId: u.id,
          name: u.name,
          mobile: u.mobile,
          status: "Pending",
          date: today(),
        });
      else {
        const code = String(crypto.randomInt(100000, 999999));
        await put("otp", {
          userId: u.id,
          hash: await bcrypt.hash(code, 10),
          expires: Date.now() + 600000,
          attempts: 0,
        });
        await sms(
          u.mobile,
          `Your MeatFlow password reset code is ${code}. Expires in 10 minutes.`,
        );
      }
    }
    res.json({
      message:
        "If registered, a driver request has been sent to admin, or an admin reset code has been queued to your mobile.",
    });
  }),
);
app.post(
  "/api/auth/reset",
  wrap(async (req, res) => {
    const u = (
      await db.query(
        "SELECT * FROM users WHERE mobile=$1 AND role='superadmin'",
        [req.body.mobile],
      )
    ).rows[0];
    if (!u) fail("Invalid or expired reset code");
    if ((req.body.password || "").length < 10)
      fail("Password needs at least 10 characters");
    const result = await transaction(async (c) => {
      const r = (await all("otp", c)).find((o) => o.userId === u.id);
      if (!r || r.expires < Date.now() || r.attempts >= 5) return false;
      if (!(await bcrypt.compare(String(req.body.code || ""), r.hash))) {
        await put("otp", { ...r, attempts: r.attempts + 1 }, c, r.id);
        return false;
      }
      await c.query(
        "UPDATE users SET password=$1,session_version=session_version+1 WHERE id=$2",
        [await bcrypt.hash(req.body.password, 12), u.id],
      );
      for (const x of (await all("otp", c)).filter((o) => o.userId === u.id))
        await remove("otp", x.id, c);
      return true;
    });
    if (!result) fail("Invalid or expired reset code");
    res.json({ ok: true });
  }),
);
app.get(
  "/api/preorder/:token",
  wrap(async (req, res) => {
    const link = (await all("links")).find(
      (l) =>
        l.token === req.params.token &&
        l.status === "Active" &&
        l.expiry >= today(),
    );
    if (!link) fail("This pre-order link is unavailable or expired", 404);
    res.json({
      shop: await get("shops", link.shopId),
      items: (await all("items")).filter((i) => i.status === "Active"),
    });
  }),
);
app.post(
  "/api/preorder/:token",
  rateLimit({ windowMs: 60000, limit: 10 }),
  wrap(async (req, res) => {
    const link = (await all("links")).find(
      (l) =>
        l.token === req.params.token &&
        l.status === "Active" &&
        l.expiry >= today(),
    );
    if (!link) fail("Link expired", 404);
    const customer = await active("customers", link.customerId);
    const itemLines = await lines(
      (req.body.items || []).map(({ itemId, qty }) => ({ itemId, qty })),
    );
    const order = await put("orders", {
      number: "ORD-" + Date.now(),
      customerId: customer.id,
      driverId: customer.driverId,
      shopId: link.shopId,
      items: itemLines,
      total: amount(itemLines.reduce((s, l) => s + l.total, 0)),
      status: "Pending",
      channel: link.channel || "Wholesale",
      source: "Customer pre-order",
      date: today(),
      deliveryDate: date(req.body.deliveryDate || today()),
    });
    res.status(201).json({ number: order.number, status: order.status });
  }),
);
app.use(
  "/api",
  wrap(async (req, res, next) => {
    let payload;
    try {
      payload = jwt.verify(
        (req.headers.authorization || "").replace("Bearer ", ""),
        secret,
      );
    } catch {
      fail("Please sign in", 401);
    }
    const u = (await db.query("SELECT * FROM users WHERE id=$1", [payload.id]))
      .rows[0];
    if (!u || u.status !== "Active" || u.session_version !== payload.v)
      fail("Session ended. Please sign in again.", 401);
    req.user = u;
    next();
  }),
);
const admin = (req, res, next) =>
  req.user.role === "superadmin"
    ? next()
    : res.status(403).json({ error: "Super admin access required" });
app.get("/api/me", (req, res) => res.json(clean(req.user)));
app.post(
  "/api/logout",
  wrap(async (req, res) => {
    await db.query(
      "UPDATE users SET session_version=session_version+1 WHERE id=$1",
      [req.user.id],
    );
    res.json({ ok: true });
  }),
);
app.post(
  "/api/password",
  wrap(async (req, res) => {
    if (!(await bcrypt.compare(req.body.current || "", req.user.password)))
      fail("Current password is incorrect");
    if ((req.body.password || "").length < 10)
      fail("Password needs at least 10 characters");
    await db.query(
      "UPDATE users SET password=$1, session_version=session_version+1 WHERE id=$2",
      [await bcrypt.hash(req.body.password, 12), req.user.id],
    );
    res.json({ ok: true });
  }),
);
app.get(
  "/api/bootstrap",
  wrap(async (req, res) => {
    const kinds = [
      ...Object.keys(masters),
      "orders",
      "bills",
      "payments",
      "stock",
      "purchases",
      "expenses",
      "prices",
      "attendance",
      "payroll",
      "advances",
      "deductions",
      "visits",
      "deliveries",
      "links",
      "tracking",
      "notifications",
      "resetRequests",
      "audit",
      "messages",
    ];
    const data = {};
    for (const kind of kinds) data[kind] = await all(kind);
    const users = (await db.query("SELECT * FROM users ORDER BY name")).rows;
    data.users = users.map(clean);
    data.profile =
      (await db.query("SELECT value FROM settings WHERE key='profile'")).rows[0]
        ?.value || {};
    if (req.user.role === "driver") {
      for (const key of [
        "employees",
        "attendance",
        "payroll",
        "advances",
        "deductions",
        "roles",
        "audit",
        "messages",
        "resetRequests",
        "links",
        "purchases",
      ])
        delete data[key];
      data.users = data.users
        .filter((u) => u.role === "driver")
        .map(({ id, name, role }) => ({ id, name, role }));
      data.shops = data.shops.filter((s) => req.user.shops.includes(s.id));
      data.stock = data.stock.filter((s) => req.user.shops.includes(s.shopId));
      data.tracking = data.tracking.filter((t) => t.driverId === req.user.id);
      data.expenses = data.expenses.filter((e) => e.createdBy === req.user.id);
      data.visits = data.visits.filter((e) => e.driverId === req.user.id);
      data.orders = data.orders.filter((o) => o.driverId === req.user.id);
      const orderIds = new Set(data.orders.map((o) => o.id));
      data.deliveries = data.deliveries.filter((d) => orderIds.has(d.orderId));
      data.bills = [];
      data.customers = data.customers.filter((c) =>
        data.orders.some((o) => o.customerId === c.id),
      );
      data.notifications = data.notifications.filter(
        (n) => n.driverId === req.user.id,
      );
      for (const key of [
        "suppliers",
        "payments",
        "banks",
        "qr",
        "expenses",
        "expenseCategories",
        "visits",
        "stock",
        "assets",
      ])
        data[key] = [];
      const viewGroups = {
        Orders: ["orders", "deliveries"],
        Billing: ["bills"],
        Inventory: ["stock"],
        Payments: ["payments", "banks", "qr"],
        Expenses: ["expenses", "expenseCategories"],
        "Supplier visits": ["visits"],
      };
      // Mandatory driver deliveries cannot be hidden by legacy permission templates.
    }
    res.json(data);
  }),
);
app.post(
  "/api/masters/:kind",
  admin,
  wrap(async (req, res) => {
    const { kind } = req.params,
      spec = masters[kind];
    if (!spec) fail("Unknown master");
    const body = req.body;
    const data = {};
    for (const f of spec.fields) if (body[f] !== undefined) data[f] = body[f];
    if (kind === "customers") {
      if (
        (data.lat !== undefined && data.lat !== "") ||
        (data.lng !== undefined && data.lng !== "")
      ) {
        Object.assign(data, gps(data));
      } else {
        delete data.lat;
        delete data.lng;
      }
    }
    for (const f of spec.required)
      if (
        data[f] === undefined ||
        data[f] === null ||
        String(data[f]).trim() === ""
      )
        fail(`${f} is required`);
    data.status = data.status || "Active";
    if (!["Active", "Inactive", "In service", "Retired"].includes(data.status))
      fail("Invalid status");
    for (const f of [
      "price",
      "tax",
      "lowStock",
      "salary",
      "creditLimit",
      "openingBalance",
    ])
      if (data[f] != null) data[f] = amount(data[f]);
    if (data.tax > 100) fail("Tax cannot exceed 100%");
    if (kind === "employees" && !["Daily", "Monthly"].includes(data.salaryType))
      fail("Invalid salary type");
    const refs = {
      locationId: "locations",
      parentId: kind === "shops" ? "shops" : "categories",
      categoryId: "categories",
      bankId: "banks",
      shopId: "shops",
    };
    for (const [f, k] of Object.entries(refs))
      if (data[f]) await active(k, data[f]);
    if (data.driverId || data.assignedTo) {
      const id = data.driverId || data.assignedTo;
      if (
        !(
          await db.query(
            "SELECT id FROM users WHERE id=$1 AND status='Active'",
            [id],
          )
        ).rows.length
      )
        fail("Invalid assigned user");
    }
    if (body.id && data.parentId) {
      let id = data.parentId;
      const seen = new Set([body.id]);
      while (id) {
        if (seen.has(id)) fail("Hierarchy cannot contain a cycle");
        seen.add(id);
        id = (await get(kind, id)).parentId;
      }
    }
    if (
      data.code &&
      (await all(kind)).some((r) => r.code === data.code && r.id !== body.id)
    )
      fail("Code already exists");
    if (body.id) {
      const previous = await get(kind, body.id);
      if (kind === "items" && previous.price !== data.price)
        fail(
          "Change item prices through Daily pricing to preserve price history",
        );
    }
    const saved = await transaction(async (c) => {
      const r = await put(
        kind,
        {
          ...data,
          createdBy: body.id
            ? (await get(kind, body.id, c)).createdBy
            : req.user.name,
        },
        c,
        body.id,
      );
      await audit(
        req.user,
        body.id ? "Update" : "Create",
        kind + ": " + (data.name || data.code),
        c,
      );
      return r;
    });
    res.json(saved);
  }),
);
app.delete(
  "/api/masters/:kind/:id",
  admin,
  wrap(async (req, res) => {
    const { kind, id } = req.params;
    if (!masters[kind]) fail("Unknown master");
    await get(kind, id);
    const records = (
      await db.query("SELECT id,data FROM records WHERE id<>$1", [id])
    ).rows;
    if (records.some((r) => JSON.stringify(r.data).includes('"' + id + '"')))
      fail("This record is in use. Set it inactive to preserve history.");
    if (
      (await db.query("SELECT shops FROM users")).rows.some((u) =>
        u.shops.includes(id),
      )
    )
      fail("Shop is assigned to a user");
    if (
      (await db.query("SELECT id FROM users WHERE permission_role_id=$1", [id]))
        .rows.length
    )
      fail("This permission role is assigned to a user");
    await transaction(async (c) => {
      await remove(kind, id, c);
      await audit(req.user, "Delete", kind + ": " + id, c);
    });
    res.json({ ok: true });
  }),
);
app.delete(
  "/api/users/:id",
  admin,
  wrap(async (req, res) => {
    if (req.params.id === req.user.id)
      fail("You cannot delete your own account");
    const records = (await db.query("SELECT data FROM records")).rows;
    if (
      records.some((r) =>
        JSON.stringify(r.data).includes('"' + req.params.id + '"'),
      )
    )
      fail(
        "User has activity or assignments. Deactivate the account to preserve history.",
      );
    await transaction(async (c) => {
      await c.query("DELETE FROM users WHERE id=$1", [req.params.id]);
      await audit(req.user, "Delete user", req.params.id, c);
    });
    res.json({ ok: true });
  }),
);
app.get(
  "/api/export/:kind",
  wrap(async (req, res) => {
    if (req.user.role === "driver")
      fail("Exports are available in the admin portal only", 403);
    const resources = {
      bills: "Billing",
      orders: "Orders",
      payments: "Payments",
      stock: "Inventory",
      expenses: "Expenses",
      visits: "Supplier visits",
    };
    const resource = resources[req.params.kind];
    if (!resource) fail("Unsupported export", 404);
    if (
      !(await permitted(req.user, resource, "Download")) ||
      !(await permitted(req.user, resource, "View"))
    )
      fail("Download permission required", 403);
    let rows = await all(req.params.kind);
    if (
      req.user.role === "driver" &&
      ["stock", "bills"].includes(req.params.kind)
    )
      rows = rows.filter((r) => req.user.shops.includes(r.shopId));
    if (
      req.user.role === "driver" &&
      ["expenses", "visits"].includes(req.params.kind)
    )
      rows = rows.filter(
        (r) => r.createdBy === req.user.id || r.driverId === req.user.id,
      );
    res.json(rows);
  }),
);
app.post(
  "/api/users",
  admin,
  wrap(async (req, res) => {
    const b = req.body;
    if (
      !b.name ||
      !b.username ||
      !b.mobile ||
      !["driver", "superadmin"].includes(b.role)
    )
      fail("Name, username, mobile and supported role are required");
    if (!["Active", "Inactive"].includes(b.status || "Active"))
      fail("Invalid status");
    const shops = b.shops || [];
    if (b.permission_role_id) await active("roles", b.permission_role_id);
    if (!Array.isArray(shops)) fail("Shops must be an array");
    for (const id of shops) await active("shops", id);
    if (
      b.id === req.user.id &&
      (b.status === "Inactive" || b.role !== "superadmin")
    )
      fail("You cannot deactivate or demote your own account");
    if (!b.id && (b.password || "").length < 10)
      fail("Password needs at least 10 characters");
    if (b.password && b.password.length < 10)
      fail("Password needs at least 10 characters");
    const id = b.id || crypto.randomUUID();
    await transaction(async (c) => {
      if (b.id) {
        const old = (await c.query("SELECT * FROM users WHERE id=$1", [id]))
          .rows[0];
        if (!old) fail("User not found", 404);
        await c.query(
          "UPDATE users SET name=$1,username=$2,mobile=$3,role=$4,status=$5,shops=$6,email=$7,password=$8,session_version=session_version+1 WHERE id=$9",
          [
            b.name,
            b.username,
            b.mobile,
            b.role,
            b.status || "Active",
            JSON.stringify(shops),
            b.email || "",
            b.password ? await bcrypt.hash(b.password, 12) : old.password,
            id,
          ],
        );
      } else
        await c.query(
          "INSERT INTO users(id,name,username,mobile,role,status,shops,email,password) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
          [
            id,
            b.name,
            b.username,
            b.mobile,
            b.role,
            b.status || "Active",
            JSON.stringify(shops),
            b.email || "",
            await bcrypt.hash(b.password, 12),
          ],
        );
      await c.query("UPDATE users SET permission_role_id=$1 WHERE id=$2", [
        b.permission_role_id || "",
        id,
      ]);
      await audit(req.user, "Save user", b.username, c);
    });
    res.json({ ok: true });
  }),
);
app.post(
  "/api/actions/:action",
  wrap(async (req, res) => {
    const b = req.body,
      u = req.user,
      action = req.params.action;
    const driverAllowed = ["deliver", "gps"];
    if (u.role !== "superadmin" && !driverAllowed.includes(action))
      fail("Super admin access required", 403);
    const privileges = {
      order: ["Orders", b.id ? "Edit" : "Create"],
      cancelOrder: ["Orders", "Delete"],
      deliver: ["Orders", "Edit"],
      bill: ["Billing", "Create"],
      payment: ["Payments", "Create"],
      expense: ["Expenses", "Create"],
      visit: ["Supplier visits", "Create"],
    };
    if (
      u.role !== "driver" &&
      privileges[action] &&
      !(await permitted(u, ...privileges[action]))
    )
      fail("Your assigned permission role does not allow this action", 403);
    if (["order", "bill", "stock", "purchase", "visit"].includes(action))
      await shopAccess(u, b.shopId);
    const result = await transaction(async (c) => {
      let r;
      switch (action) {
        case "order": {
          const existing = b.id ? await get("orders", b.id, c) : null;
          if (existing) {
            if (
              existing.status !== "Pending" ||
              (await all("bills", c)).some((x) => x.orderId === existing.id)
            )
              fail("Only unbilled pending orders can be edited");
            if (u.role === "driver" && existing.driverId !== u.id)
              fail("This order is assigned to another driver", 403);
            if (existing.shopId !== b.shopId)
              fail("An existing order cannot move to another shop");
          }
          const customer = await active("customers", b.customerId, c);
          if (!String(b.deliveryAddress || "").trim())
            fail("Enter the customer delivery address");
          if (b.dropLat === "" || b.dropLng === "")
            fail("Pin the exact customer destination");
          const dropLocation = gps({ lat: b.dropLat, lng: b.dropLng });
          if (!["Prepaid", "Cash on delivery"].includes(b.paymentMethod))
            fail("Select Prepaid or Cash on delivery");
          if (
            b.paymentMethod === "Prepaid" &&
            !String(b.prepaidReference || "").trim()
          )
            fail("Enter the prepaid payment reference");
          if (existing?.acceptedAt)
            fail(
              "An accepted delivery cannot be edited. Contact the driver before cancelling it.",
            );
          const itemLines = await lines(
            u.role === "driver"
              ? (b.items || []).map(({ itemId, qty }) => ({ itemId, qty }))
              : b.items,
            c,
          );
          const driverId =
            u.role === "driver" ? u.id : b.driverId || customer.driverId;
          if (!driverId) fail("Assign a driver to this order");
          const assignedDriver = (
            await c.query(
              "SELECT shops FROM users WHERE id=$1 AND role='driver' AND status='Active'",
              [driverId],
            )
          ).rows[0];
          if (!assignedDriver || !assignedDriver.shops.includes(b.shopId))
            fail("Choose an active driver assigned to this shop");
          if (
            driverId &&
            !(
              await c.query(
                "SELECT id FROM users WHERE id=$1 AND role='driver' AND status='Active'",
                [driverId],
              )
            ).rows.length
          )
            fail("Select an active driver");
          if (!["Retail", "Wholesale"].includes(b.channel))
            fail("Select retail or wholesale");
          r = await put(
            "orders",
            {
              number: existing?.number || "ORD-" + Date.now(),
              customerId: customer.id,
              deliveryAddress: String(b.deliveryAddress).trim(),
              dropLocation,
              paymentMethod: b.paymentMethod,
              prepaidReference:
                b.paymentMethod === "Prepaid"
                  ? String(b.prepaidReference).trim()
                  : "",
              assignedAt: new Date().toISOString(),
              acceptedAt: null,
              startLocation: null,
              driverId,
              shopId: b.shopId,
              items: itemLines,
              total: amount(itemLines.reduce((s, l) => s + l.total, 0)),
              status: "Pending",
              channel: b.channel,
              source: existing?.source || "Pre-order",
              date: existing?.date || today(),
              deliveryDate: date(b.deliveryDate || today()),
              createdBy: existing?.createdBy || u.id,
            },
            c,
            existing?.id,
          );
          await put(
            "notifications",
            {
              driverId,
              orderId: r.id,
              title: "Delivery assigned — automatic acceptance required",
              detail: `${r.number} · ${customer.name} · ${b.paymentMethod} · INR ${r.total}`,
              date: today(),
              read: false,
            },
            c,
          );
          break;
        }
        case "cancelOrder": {
          const o = await get("orders", b.id, c);
          if (u.role === "driver" && o.driverId !== u.id)
            fail("This order is assigned to another driver", 403);
          if (
            o.status !== "Pending" ||
            (await all("bills", c)).some((x) => x.orderId === o.id)
          )
            fail("Only unbilled pending orders can be cancelled");
          r = await put("orders", { ...o, status: "Cancelled" }, c, o.id);
          break;
        }
        case "deliver": {
          const o = await get("orders", b.orderId, c);
          if (o.status !== "Pending") fail("Order is no longer pending");
          if (u.role === "driver" && o.driverId !== u.id)
            fail("This delivery is assigned to another driver", 403);
          if (!o.acceptedAt)
            fail(
              "Waiting for driver GPS to automatically accept this delivery",
            );
          if (!o.dropLocation)
            fail(
              "The admin must capture the customer destination before delivery",
            );
          const loc = gps(b);
          if (
            !b.signature ||
            !/^data:image\/png;base64,/.test(b.signature) ||
            b.signature.length < 200 ||
            b.signature.length > 500000
          )
            fail("Capture the customer signature");
          const loadedWeight = positive(b.loadedWeight);
          r = await put(
            "deliveries",
            {
              orderId: o.id,
              driverId: u.role === "driver" ? u.id : o.driverId,
              signature: b.signature,
              loadedWeight,
              ...loc,
              timestamp: new Date().toISOString(),
              onTime: o.deliveryDate >= today(),
            },
            c,
          );
          await put(
            "orders",
            {
              ...o,
              status: "Delivered",
              actualDropLocation: loc,
              deliveredAt: r.timestamp,
            },
            c,
            o.id,
          );
          break;
        }
        case "bill": {
          const o = await get("orders", b.orderId, c);
          if (o.status === "Cancelled")
            fail("Cancelled orders cannot be billed");
          if (o.shopId !== b.shopId) fail("Order shop mismatch");
          if (u.role === "driver" && o.driverId !== u.id)
            fail("You can only bill your assigned orders", 403);
          const bills = await all("bills", c);
          if (bills.some((x) => x.orderId === o.id))
            fail("This order has already been billed");
          const payments = await all("payments", c);
          let credit = payments
            .filter(
              (p) => p.partyType === "Customer" && p.partyId === o.customerId,
            )
            .reduce((s, p) => s + p.amount, 0);
          const customer = await active("customers", o.customerId, c);
          credit = Math.max(0, credit - Number(customer.openingBalance || 0));
          const unpaid = bills
            .filter((x) => x.customerId === o.customerId)
            .reverse()
            .filter((x) => {
              const remaining = Math.max(0, x.total - credit);
              credit = Math.max(0, credit - x.total);
              return remaining > 0.005;
            });
          if (unpaid.length >= 3) {
            await notice(
              "Excess billing attempt",
              `${customer.name}: fourth outstanding bill blocked. Attempted by ${u.name}.`,
              c,
            );
            return {
              blocked: true,
              error:
                "Billing blocked: customer already has 3 unpaid bills. Admin has been notified.",
            };
          }
          const due = await customerBalance(customer.id, c);
          if (
            Number(customer.creditLimit) > 0 &&
            due + o.total > Number(customer.creditLimit)
          )
            fail(
              "Customer credit limit exceeded. Record a payment or update the limit.",
            );
          for (const l of o.items) {
            if ((await currentStock(o.shopId, l.itemId, c)) < l.qty)
              fail("Insufficient stock for " + l.name);
          }
          r = await put(
            "bills",
            {
              number: "BILL-" + Date.now(),
              dcNumber: "DC-" + Date.now(),
              orderId: o.id,
              customerId: o.customerId,
              driverId: o.driverId,
              shopId: o.shopId,
              items: await Promise.all(
                o.items.map(async (l) => ({
                  ...l,
                  cost: await averageCost(o.shopId, l.itemId, c),
                })),
              ),
              total: o.total,
              previousBalance: due,
              closingBalance: amount(due + o.total),
              channel: o.channel,
              date: today(),
              createdBy: u.id,
            },
            c,
          );
          for (const l of o.items) {
            await put(
              "stock",
              {
                shopId: o.shopId,
                itemId: l.itemId,
                direction: "Out",
                qty: l.qty,
                reason: r.number,
                billId: r.id,
                date: today(),
                createdBy: u.id,
              },
              c,
            );
            const item = await get("items", l.itemId, c);
            if (
              (await currentStock(o.shopId, l.itemId, c)) <
              Number(item.lowStock || 0)
            )
              await notice(
                "Low stock",
                `${item.name} is below its minimum at ${(await get("shops", o.shopId, c)).name}.`,
                c,
              );
          }
          await sms(
            customer.mobile,
            `${r.dcNumber} | ${r.date} | ${o.items.map((l) => `${l.name}: ${l.qty} ${l.unit} @ INR ${l.price}`).join("; ")} | Total INR ${r.total} | Balance INR ${r.closingBalance}`,
            c,
          );
          break;
        }
        case "stock": {
          await active("items", b.itemId, c);
          const qty = positive(b.qty);
          if (!["In", "Out"].includes(b.direction)) fail("Select In or Out");
          if (!b.reason) fail("Stock adjustment reason required");
          if (
            b.direction === "Out" &&
            (await currentStock(b.shopId, b.itemId, c)) < qty
          )
            fail("Insufficient stock");
          r = await put(
            "stock",
            {
              shopId: b.shopId,
              itemId: b.itemId,
              direction: b.direction,
              qty,
              cost: amount(b.cost || 0),
              reason: b.reason,
              date: date(b.date || today()),
              createdBy: u.id,
            },
            c,
          );
          break;
        }
        case "purchase": {
          await active("suppliers", b.supplierId, c);
          const itemLines = await lines(b.items, c);
          r = await put(
            "purchases",
            {
              number: "PO-" + Date.now(),
              supplierId: b.supplierId,
              shopId: b.shopId,
              items: itemLines,
              total: amount(itemLines.reduce((s, l) => s + l.total, 0)),
              status: "Pending",
              date: today(),
              createdBy: u.id,
            },
            c,
          );
          break;
        }
        case "finalizePurchase": {
          const po = await get("purchases", b.id, c);
          if (po.status !== "Pending") fail("Purchase is already received");
          if (Date.now() - Date.parse(po.createdAt) < 2 * 86400000)
            fail(
              "Final price becomes editable 48 hours after purchase creation",
            );
          const finalLines = await lines(b.items, c);
          if (
            finalLines.length !== po.items.length ||
            finalLines.some(
              (l) =>
                !po.items.some((p) => p.itemId === l.itemId && p.qty === l.qty),
            )
          )
            fail("Finalization must preserve purchased items and quantities");
          r = await put(
            "purchases",
            {
              ...po,
              initialItems: po.items,
              items: finalLines,
              total: amount(finalLines.reduce((s, l) => s + l.total, 0)),
              status: "Received",
              receivedDate: today(),
            },
            c,
            po.id,
          );
          for (const l of finalLines)
            await put(
              "stock",
              {
                shopId: po.shopId,
                itemId: l.itemId,
                direction: "In",
                qty: l.qty,
                cost: l.price,
                purchaseId: po.id,
                reason: po.number,
                date: today(),
                createdBy: u.id,
              },
              c,
            );
          break;
        }
        case "payment": {
          if (
            !["Customer", "Supplier"].includes(b.partyType) ||
            !["Cash", "Online", "Cheque"].includes(b.mode)
          )
            fail("Invalid payment type or mode");
          const party = await active(
            b.partyType === "Customer" ? "customers" : "suppliers",
            b.partyId,
            c,
          );
          const value = positive(b.amount);
          if (b.mode !== "Cash" && !b.reference)
            fail("Payment reference required");
          let outstanding;
          if (b.partyType === "Customer")
            outstanding = await customerBalance(b.partyId, c);
          else
            outstanding =
              Number(party.openingBalance || 0) +
              (await all("purchases", c))
                .filter(
                  (p) => p.supplierId === b.partyId && p.status === "Received",
                )
                .reduce((s, p) => s + p.total, 0) -
              (await all("payments", c))
                .filter(
                  (p) => p.partyType === "Supplier" && p.partyId === b.partyId,
                )
                .reduce((s, p) => s + p.amount, 0);
          if (value > outstanding + 0.005)
            fail("Payment exceeds outstanding balance");
          r = await put(
            "payments",
            {
              number: "PAY-" + Date.now(),
              partyType: b.partyType,
              partyId: b.partyId,
              mode: b.mode,
              amount: value,
              date: date(b.date || today()),
              reference: b.reference || "",
              createdBy: u.id,
            },
            c,
          );
          break;
        }
        case "expense": {
          await active("expenseCategories", b.categoryId, c);
          r = await put(
            "expenses",
            {
              categoryId: b.categoryId,
              amount: positive(b.amount),
              date: date(b.date || today()),
              paidBy: u.name,
              remarks: String(b.remarks || ""),
              shopId: b.shopId || "",
              createdBy: u.id,
            },
            c,
          );
          break;
        }
        case "price": {
          const item = await active("items", b.itemId, c);
          const value = amount(b.price);
          r = await put(
            "prices",
            {
              itemId: item.id,
              date: today(),
              price: value,
              previousPrice: item.price,
              updatedBy: u.name,
            },
            c,
          );
          await put("items", { ...item, price: value }, c, item.id);
          break;
        }
        case "visit": {
          await active("suppliers", b.supplierId, c);
          const itemLines = await lines(b.items, c);
          r = await put(
            "visits",
            {
              supplierId: b.supplierId,
              driverId: u.id,
              shopId: b.shopId,
              items: itemLines,
              remarks: String(b.remarks || ""),
              ...gps(b),
              timestamp: new Date().toISOString(),
            },
            c,
          );
          break;
        }
        case "gps": {
          const loc = gps(b),
            timestamp = new Date().toISOString();
          const assigned = (await all("orders", c)).filter(
            (o) => o.driverId === u.id && o.status === "Pending",
          );
          const acceptedIds = [];
          for (const o of assigned) {
            if (
              !o.acceptedAt &&
              o.dropLocation &&
              o.deliveryAddress &&
              o.paymentMethod
            ) {
              await put(
                "orders",
                { ...o, acceptedAt: timestamp, startLocation: loc },
                c,
                o.id,
              );
              acceptedIds.push(o.id);
              await audit(u, "Auto-accept delivery", o.number, c);
            }
          }
          r = await put(
            "tracking",
            {
              driverId: u.id,
              ...loc,
              timestamp,
              orderIds: assigned.map((o) => o.id),
            },
            c,
          );
          r.acceptedIds = acceptedIds;
          break;
        }
        case "attendance": {
          await active("employees", b.employeeId, c);
          date(b.date);
          if (!["Present", "Absent", "Half day"].includes(b.status))
            fail("Invalid attendance");
          const old = (await all("attendance", c)).find(
            (a) => a.employeeId === b.employeeId && a.date === b.date,
          );
          if (
            (await all("payroll", c)).some(
              (p) =>
                p.employeeId === b.employeeId &&
                b.date >= p.from &&
                b.date <= p.to,
            )
          )
            fail("Attendance is locked for a paid period");
          r = await put(
            "attendance",
            { employeeId: b.employeeId, date: b.date, status: b.status },
            c,
            old?.id,
          );
          break;
        }
        case "advance":
        case "deduction": {
          await active("employees", b.employeeId, c);
          r = await put(
            action === "advance" ? "advances" : "deductions",
            {
              employeeId: b.employeeId,
              amount: positive(b.amount),
              date: date(b.date || today()),
              remarks: String(b.remarks || ""),
              settled: false,
            },
            c,
          );
          break;
        }
        case "payroll": {
          const e = await active("employees", b.employeeId, c);
          const from = date(b.from),
            to = date(b.to);
          if (from > to) fail("Invalid payroll period");
          if (
            (await all("payroll", c)).some(
              (p) => p.employeeId === e.id && p.from <= to && p.to >= from,
            )
          )
            fail("Payroll overlaps an already paid period");
          const attendance = (await all("attendance", c)).filter(
            (a) => a.employeeId === e.id && a.date >= from && a.date <= to,
          );
          let gross = 0;
          for (
            let d = new Date(from + "T12:00:00Z");
            d <= new Date(to + "T12:00:00Z");
            d.setUTCDate(d.getUTCDate() + 1)
          ) {
            const day = d.toISOString().slice(0, 10),
              a = attendance.find((x) => x.date === day);
            const weight =
              a?.status === "Present" ? 1 : a?.status === "Half day" ? 0.5 : 0;
            gross +=
              weight *
              (e.salaryType === "Daily"
                ? Number(e.salary)
                : Number(e.salary) /
                  new Date(
                    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
                  ).getUTCDate());
          }
          const advances = (await all("advances", c)).filter(
              (a) => a.employeeId === e.id && !a.settled && a.date <= to,
            ),
            deductions = (await all("deductions", c)).filter(
              (a) => a.employeeId === e.id && !a.settled && a.date <= to,
            );
          const adv = advances.reduce((s, a) => s + a.amount, 0),
            ded = deductions.reduce((s, a) => s + a.amount, 0);
          if (adv + ded > gross)
            fail(
              "Deductions and advances exceed earned salary. Extend the pay period.",
            );
          r = await put(
            "payroll",
            {
              employeeId: e.id,
              from,
              to,
              gross: amount(gross),
              advances: adv,
              deductions: ded,
              net: amount(gross - adv - ded),
              days: attendance.reduce(
                (s, a) =>
                  s +
                  (a.status === "Present"
                    ? 1
                    : a.status === "Half day"
                      ? 0.5
                      : 0),
                0,
              ),
              date: today(),
              status: "Paid",
            },
            c,
          );
          for (const a of advances)
            await put(
              "advances",
              { ...a, settled: true, payrollId: r.id },
              c,
              a.id,
            );
          for (const a of deductions)
            await put(
              "deductions",
              { ...a, settled: true, payrollId: r.id },
              c,
              a.id,
            );
          break;
        }
        case "link": {
          await active("customers", b.customerId, c);
          await active("shops", b.shopId, c);
          date(b.expiry);
          if (b.expiry < today()) fail("Expiry must be today or later");
          r = await put(
            "links",
            {
              customerId: b.customerId,
              shopId: b.shopId,
              expiry: b.expiry,
              channel: b.channel || "Wholesale",
              token: crypto.randomBytes(24).toString("hex"),
              status: "Active",
            },
            c,
          );
          break;
        }
        case "toggleLink": {
          const link = await get("links", b.id, c);
          r = await put(
            "links",
            {
              ...link,
              status: link.status === "Active" ? "Inactive" : "Active",
            },
            c,
            link.id,
          );
          break;
        }
        case "resetDriver": {
          const request = await get("resetRequests", b.id, c);
          if (request.status !== "Pending") fail("Request already resolved");
          if ((b.password || "").length < 10)
            fail("Password needs at least 10 characters");
          await c.query(
            "UPDATE users SET password=$1,session_version=session_version+1 WHERE id=$2 AND role='driver'",
            [await bcrypt.hash(b.password, 12), request.userId],
          );
          r = await put(
            "resetRequests",
            { ...request, status: "Resolved" },
            c,
            request.id,
          );
          break;
        }
        case "readNotification": {
          const n = await get("notifications", b.id, c);
          r = await put("notifications", { ...n, read: true }, c, n.id);
          break;
        }
        case "profile": {
          const profile = {
            businessName: String(b.businessName || ""),
            gst: String(b.gst || ""),
            address: String(b.address || ""),
            contact: String(b.contact || ""),
          };
          await c.query(
            "INSERT INTO settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value",
            ["profile", JSON.stringify(profile)],
          );
          r = profile;
          break;
        }
        default:
          fail("Unknown action", 404);
      }
      await audit(u, action, r?.number || r?.id || "", c);
      return r;
    });
    res.json(result || { ok: true });
  }),
);
// A configured gateway is required for real SMS delivery. Failed sends remain visible.
let sending = false;
async function sendMessages() {
  if (sending || !process.env.SMS_GATEWAY_URL) return;
  sending = true;
  try {
    for (const m of (await all("messages")).filter(
      (m) => m.status === "Queued" && m.attempts < 3,
    )) {
      try {
        const response = await fetch(process.env.SMS_GATEWAY_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.SMS_GATEWAY_TOKEN || ""}`,
          },
          body: JSON.stringify({ to: m.to, message: m.message }),
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw new Error("Gateway HTTP " + response.status);
        await put(
          "messages",
          { ...m, status: "Sent", attempts: m.attempts + 1 },
          db,
          m.id,
        );
      } catch (e) {
        await put(
          "messages",
          {
            ...m,
            status: m.attempts >= 2 ? "Failed" : "Queued",
            attempts: m.attempts + 1,
            error: e.message,
          },
          db,
          m.id,
        );
      }
    }
  } finally {
    sending = false;
  }
}
let smsTimer;
if (!process.env.VERCEL) {
  smsTimer = setInterval(() => sendMessages().catch(console.error), 15000);
  smsTimer.unref();
}
app.use(express.static(path.resolve("dist")));
app.get("/{*path}", (req, res) => {
  if (req.path.startsWith("/api/"))
    return res.status(404).json({ error: "Not found" });
  res.sendFile(path.resolve("dist/index.html"));
});
app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(err.status || (err.code === "23505" ? 409 : 500)).json({
    error:
      err.code === "23505"
        ? "This username, mobile or code already exists"
        : err.status
          ? err.message
          : "Server error. Check the server log.",
  });
});
export default app;
if (process.env.NODE_ENV !== "test" && !process.env.VERCEL) {
  const server = app.listen(Number(process.env.PORT) || 4000, "127.0.0.1", () =>
    console.log("MeatFlow API: http://127.0.0.1:" + (process.env.PORT || 4000)),
  );
  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    clearInterval(smsTimer);
    try {
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      await db.close();
      process.exitCode = 0;
    } catch (error) {
      console.error("Database shutdown failed:", error.message);
      process.exitCode = 1;
    }
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
