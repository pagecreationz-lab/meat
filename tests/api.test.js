import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
process.env.NODE_ENV = "test";
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "meatflow-test-"));
let request, app, db, admin, driver;
before(async () => {
  request = (await import("supertest")).default;
  app = (await import("../server/app.js")).default;
  db = await import("../server/db.js");
  const r = await request(app)
    .post("/api/auth/login")
    .send({ username: "admin", password: "Admin@12345", code: "246810" });
  assert.equal(r.status, 200);
  admin = r.body.token;
  const d = await request(app).post("/api/auth/login").send({
    username: "9000000001",
    password: "Driver@12345",
    lat: 13.08,
    lng: 80.27,
    deviceId: "test-device",
  });
  assert.equal(d.status, 200);
  driver = d.body.token;
});
const post = (url, body, token = admin) =>
  request(app)
    .post("/api" + url)
    .set("Authorization", "Bearer " + token)
    .send(body);
const boot = (token = admin) =>
  request(app)
    .get("/api/bootstrap")
    .set("Authorization", "Bearer " + token);
async function order(qty = 1) {
  const r = await post("/actions/order", {
    shopId: "shop-1",
    customerId: "customer-1",
    driverId: "driver-1",
    channel: "Wholesale",
    items: [{ itemId: "item-1", qty }],
  });
  assert.equal(r.status, 200, r.text);
  return r.body;
}
test("authentication requires admin second factor and driver GPS", async () => {
  assert.equal(
    (
      await request(app)
        .post("/api/auth/login")
        .send({ username: "admin", password: "Admin@12345" })
    ).status,
    401,
  );
  assert.equal(
    (
      await request(app)
        .post("/api/auth/login")
        .send({ username: "arun", password: "Driver@12345", deviceId: "test" })
    ).status,
    400,
  );
  assert.equal((await request(app).get("/api/bootstrap")).status, 401);
});
test("driver cannot access admin actions or private payroll records", async () => {
  assert.equal(
    (await post("/masters/locations", { name: "No", area: "No" }, driver))
      .status,
    403,
  );
  assert.equal(
    (await post("/actions/price", { itemId: "item-1", price: 1 }, driver))
      .status,
    403,
  );
  const r = await boot(driver);
  assert.equal(r.status, 200);
  assert.equal(r.body.payroll, undefined);
  assert.equal(r.body.audit, undefined);
  assert.equal(r.body.shops.length, 1);
});
test("master validation, duplicate codes and hierarchy cycles", async () => {
  assert.equal((await post("/masters/items", { code: "x" })).status, 400);
  const r = await post("/masters/shops", {
    id: "shop-1",
    name: "SPS Main Shop",
    code: "SPS-001",
    locationId: "loc-1",
    parentId: "shop-2",
    status: "Active",
  });
  assert.equal(r.status, 400);
  assert.equal(
    (
      await post("/masters/items", {
        code: "CC-001",
        name: "Duplicate",
        categoryId: "cat-1",
        unit: "kg",
        price: 100,
      })
    ).status,
    400,
  );
});
test("drivers can edit and cancel their unbilled pending pre-orders", async () => {
  const o = await order();
  const edited = await post(
    "/actions/order",
    { ...o, items: [{ itemId: "item-1", qty: 2, price: 1 }] },
    driver,
  );
  assert.equal(edited.status, 200);
  assert.equal(edited.body.id, o.id);
  assert.equal(edited.body.total, 960);
  const cancelled = await post("/actions/cancelOrder", { id: o.id }, driver);
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.body.status, "Cancelled");
  assert.equal(
    (
      await post(
        "/actions/order",
        { ...o, items: [{ itemId: "item-1", qty: 1 }] },
        driver,
      )
    ).status,
    400,
  );
});
test("billing deducts stock once, blocks fourth outstanding bill and logs notification", async () => {
  const initial = (await boot()).body.stock
    .filter((s) => s.itemId === "item-1")
    .reduce((s, m) => s + (m.direction === "In" ? m.qty : -m.qty), 0);
  for (let i = 0; i < 3; i++) {
    const o = await order();
    const billed = await post(
      "/actions/bill",
      { shopId: "shop-1", orderId: o.id },
      driver,
    );
    assert.equal(billed.status, 200, billed.text);
    assert.equal(billed.body.total, 480);
    assert.equal(
      (await post("/actions/bill", { shopId: "shop-1", orderId: o.id })).status,
      400,
    );
  }
  const fourth = await order();
  const blocked = await post("/actions/bill", {
    shopId: "shop-1",
    orderId: fourth.id,
  });
  assert.equal(blocked.body.blocked, true);
  const data = (await boot()).body;
  assert.equal(data.bills.length, 3);
  assert.ok(
    data.notifications.some((n) => n.title === "Excess billing attempt"),
  );
  assert.equal(
    data.stock
      .filter((s) => s.itemId === "item-1")
      .reduce((s, m) => s + (m.direction === "In" ? m.qty : -m.qty), 0),
    initial - 3,
  );
  assert.equal(data.messages.length, 3);
  const p = await post("/actions/payment", {
    partyType: "Customer",
    partyId: "customer-1",
    mode: "Cash",
    amount: 480,
  });
  assert.equal(p.status, 200);
  const allowed = await post("/actions/bill", {
    shopId: "shop-1",
    orderId: fourth.id,
  });
  assert.equal(allowed.status, 200);
  assert.ok(allowed.body.number);
});
test("overpayment, negative stock and invalid item quantities are rejected", async () => {
  assert.equal(
    (
      await post("/actions/payment", {
        partyType: "Customer",
        partyId: "customer-1",
        mode: "Cash",
        amount: 999999,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await post("/actions/stock", {
        shopId: "shop-1",
        itemId: "item-1",
        direction: "Out",
        qty: 99999,
        reason: "Invalid",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await post("/actions/order", {
        shopId: "shop-1",
        customerId: "customer-1",
        channel: "Retail",
        items: [{ itemId: "item-1", qty: -2 }],
      })
    ).status,
    400,
  );
});
test("purchase finalization locks prices for 48 hours and receives stock once", async () => {
  const p = await post("/actions/purchase", {
    shopId: "shop-1",
    supplierId: "supplier-1",
    items: [{ itemId: "item-2", qty: 10, price: 150 }],
  });
  assert.equal(p.status, 200);
  const body = {
    id: p.body.id,
    items: [{ itemId: "item-2", qty: 10, price: 155 }],
  };
  assert.equal((await post("/actions/finalizePurchase", body)).status, 400);
  await db.db.query(
    "UPDATE records SET created_at=now()-interval '49 hours' WHERE id=$1",
    [p.body.id],
  );
  const final = await post("/actions/finalizePurchase", body);
  assert.equal(final.status, 200);
  assert.equal(final.body.total, 1550);
  assert.equal(final.body.initialItems[0].price, 150);
  assert.equal((await post("/actions/finalizePurchase", body)).status, 400);
  const data = (await boot()).body;
  assert.equal(data.stock.filter((s) => s.purchaseId === p.body.id).length, 1);
});
test("delivery requires signature, GPS and assigned driver; captures evidence", async () => {
  const o = await order();
  assert.equal(
    (await post("/actions/deliver", { orderId: o.id, loadedWeight: 1 }, driver))
      .status,
    400,
  );
  const signature = "data:image/png;base64," + "a".repeat(250);
  const r = await post(
    "/actions/deliver",
    { orderId: o.id, loadedWeight: 1, lat: 13.1, lng: 80.2, signature },
    driver,
  );
  assert.equal(r.status, 200, r.text);
  assert.equal(r.body.driverId, "driver-1");
  assert.ok(r.body.timestamp);
  assert.equal(
    (
      await post(
        "/actions/deliver",
        { orderId: o.id, loadedWeight: 1, lat: 13.1, lng: 80.2, signature },
        driver,
      )
    ).status,
    400,
  );
});
test("payroll calculates attendance, settles advances and prevents double pay", async () => {
  const date = "2026-08-01";
  await post("/actions/attendance", {
    employeeId: "emp-1",
    date,
    status: "Present",
  });
  await post("/actions/advance", {
    employeeId: "emp-1",
    date,
    amount: 100,
    remarks: "Weekly advance",
  });
  await post("/actions/deduction", { employeeId: "emp-1", date, amount: 50 });
  const r = await post("/actions/payroll", {
    employeeId: "emp-1",
    from: date,
    to: date,
  });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.body.gross, 774.19);
  assert.equal(r.body.net, 624.19);
  assert.equal(
    (
      await post("/actions/payroll", {
        employeeId: "emp-1",
        from: date,
        to: date,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await post("/actions/attendance", {
        employeeId: "emp-1",
        date,
        status: "Absent",
      })
    ).status,
    400,
  );
});
test("daily price keeps historical price and prior bills remain unchanged", async () => {
  const r = await post("/actions/price", { itemId: "item-1", price: 500 });
  assert.equal(r.status, 200);
  assert.equal(r.body.previousPrice, 480);
  const d = (await boot()).body;
  assert.equal(d.items.find((i) => i.id === "item-1").price, 500);
  assert.ok(d.bills.every((b) => b.items[0].price === 480));
});
test("customer link scopes customer, uses current server price and can be revoked", async () => {
  const link = await post("/actions/link", {
    shopId: "shop-1",
    customerId: "customer-2",
    expiry: "2099-01-01",
    channel: "Retail",
  });
  assert.equal(link.status, 200);
  const r = await request(app)
    .post("/api/preorder/" + link.body.token)
    .send({
      customerId: "customer-1",
      items: [{ itemId: "item-1", qty: 2, price: 1 }],
    });
  assert.equal(r.status, 201);
  const o = (await boot()).body.orders.find((o) => o.number === r.body.number);
  assert.equal(o.customerId, "customer-2");
  assert.equal(o.total, 1000);
  await post("/actions/toggleLink", { id: link.body.id });
  assert.equal(
    (await request(app).get("/api/preorder/" + link.body.token)).status,
    404,
  );
});
test("driver forgot password goes to admin and reset invalidates driver sessions", async () => {
  await request(app).post("/api/auth/forgot").send({ mobile: "9000000001" });
  const req = (await boot()).body.resetRequests[0];
  assert.equal(req.status, "Pending");
  assert.equal(
    (
      await post("/actions/resetDriver", {
        id: req.id,
        password: "NewDriver@123",
      })
    ).status,
    200,
  );
  assert.equal((await boot(driver)).status, 401);
});
test("persistent data is present in PostgreSQL and audit covers transactions", async () => {
  const data = (await boot()).body;
  assert.ok(data.audit.length > 10);
  assert.ok(data.stock.length > 3);
  assert.ok(fs.existsSync(process.env.DATA_DIR));
  const count = await db.db.query(
    "SELECT count(*) FROM records WHERE kind='bills'",
  );
  assert.equal(Number(count.rows[0].count), 4);
});

test("assigned driver roles restrict actions and exports without granting admin access", async () => {
  const role = await post("/masters/roles", {
    name: "Read-only driver",
    permissions: {
      Orders: ["View"],
      Billing: ["View"],
      Inventory: ["View"],
      Payments: ["View"],
    },
    status: "Active",
  });
  assert.equal(role.status, 200);
  const u = await post("/users", {
    username: "limited",
    name: "Limited Driver",
    mobile: "9000000099",
    password: "Limited@12345",
    role: "driver",
    shops: ["shop-1"],
    permission_role_id: role.body.id,
    status: "Active",
  });
  assert.equal(u.status, 200);
  const login = await request(app).post("/api/auth/login").send({
    username: "limited",
    password: "Limited@12345",
    lat: 13,
    lng: 80,
    deviceId: "limited-device",
  });
  const token = login.body.token;
  assert.ok(token);
  assert.equal(
    (
      await post(
        "/actions/order",
        {
          shopId: "shop-1",
          customerId: "customer-1",
          channel: "Retail",
          items: [{ itemId: "item-1", qty: 1 }],
        },
        token,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(app)
        .get("/api/export/bills")
        .set("Authorization", "Bearer " + token)
    ).status,
    403,
  );
  assert.equal(
    (
      await post(
        "/actions/stock",
        {
          shopId: "shop-1",
          itemId: "item-1",
          direction: "In",
          qty: 1,
          reason: "No",
        },
        token,
      )
    ).status,
    403,
  );
  const result = await boot(token);
  assert.equal(result.body.expenses.length, 0);
  assert.ok(result.body.orders.length);
});
test("concurrent billing remains atomic and retains the cost snapshot", async () => {
  const o = (await boot()).body.orders.find(
    (o) => o.customerId === "customer-2",
  );
  const responses = await Promise.all([
    post("/actions/bill", { shopId: "shop-1", orderId: o.id }),
    post("/actions/bill", { shopId: "shop-1", orderId: o.id }),
  ]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 400]);
  const bill = responses.find((r) => r.status === 200).body;
  assert.equal(bill.items[0].cost, 360);
  assert.equal(
    (await boot()).body.stock.filter((s) => s.billId === bill.id).length,
    1,
  );
});
test("mapping the same device to another driver invalidates the previous session", async () => {
  const first = await request(app).post("/api/auth/login").send({
    username: "arun",
    password: "NewDriver@123",
    lat: 13,
    lng: 80,
    deviceId: "shared-handset",
  });
  assert.equal(first.status, 200);
  const second = await request(app).post("/api/auth/login").send({
    username: "limited",
    password: "Limited@12345",
    lat: 13,
    lng: 80,
    deviceId: "shared-handset",
  });
  assert.equal(second.status, 200);
  assert.equal((await boot(first.body.token)).status, 401);
  assert.equal((await boot(second.body.token)).status, 200);
});
