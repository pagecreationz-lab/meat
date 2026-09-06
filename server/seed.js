import bcrypt from "bcryptjs";
import { db, put } from "./db.js";
export async function seed() {
  if ((await db.query("SELECT id FROM users LIMIT 1")).rows.length) return;
  const production = process.env.NODE_ENV === "production";
  if (
    production &&
    (!process.env.ADMIN_PASSWORD ||
      !process.env.ADMIN_SECRET_CODE ||
      !process.env.JWT_SECRET)
  )
    throw new Error(
      "Set ADMIN_PASSWORD, ADMIN_SECRET_CODE and JWT_SECRET for production.",
    );
  await db.query(
    "INSERT INTO users(id,username,mobile,password,role,name) VALUES($1,$2,$3,$4,$5,$6)",
    [
      "admin",
      process.env.ADMIN_USERNAME || "admin",
      "9000000000",
      await bcrypt.hash(process.env.ADMIN_PASSWORD || "Admin@12345", 12),
      "superadmin",
      "Super Admin",
    ],
  );
  if (production) return;
  await db.query(
    "INSERT INTO users(id,username,mobile,password,role,name,shops) VALUES($1,$2,$3,$4,$5,$6,$7)",
    [
      "driver-1",
      "arun",
      "9000000001",
      await bcrypt.hash("Driver@12345", 12),
      "driver",
      "Arun Kumar",
      '["shop-1"]',
    ],
  );
  const entries = [
    [
      "locations",
      "loc-1",
      { name: "Chennai", area: "Anna Nagar", status: "Active" },
    ],
    [
      "locations",
      "loc-2",
      { name: "Chennai", area: "T. Nagar", status: "Active" },
    ],
    [
      "shops",
      "shop-1",
      {
        name: "SPS Main Shop",
        code: "SPS-001",
        locationId: "loc-1",
        group: "SPS",
        address: "Anna Nagar, Chennai",
        status: "Active",
      },
    ],
    [
      "shops",
      "shop-2",
      {
        name: "GK Meat Shop",
        code: "GK-002",
        parentId: "shop-1",
        locationId: "loc-2",
        group: "SPS",
        status: "Active",
      },
    ],
    ["categories", "cat-1", { name: "Country Chicken", status: "Active" }],
    ["categories", "cat-2", { name: "Broiler", status: "Active" }],
    ["categories", "cat-3", { name: "Quail", status: "Active" }],
    [
      "items",
      "item-1",
      {
        name: "Country chicken — whole",
        code: "CC-001",
        categoryId: "cat-1",
        unit: "kg",
        price: 480,
        tax: 0,
        lowStock: 10,
        status: "Active",
      },
    ],
    [
      "items",
      "item-2",
      {
        name: "Broiler — curry cut",
        code: "BR-001",
        categoryId: "cat-2",
        unit: "kg",
        price: 240,
        tax: 0,
        lowStock: 20,
        status: "Active",
      },
    ],
    [
      "items",
      "item-3",
      {
        name: "Quail — dressed",
        code: "QL-001",
        categoryId: "cat-3",
        unit: "piece",
        price: 90,
        tax: 0,
        lowStock: 10,
        status: "Active",
      },
    ],
    [
      "customers",
      "customer-1",
      {
        name: "Annapoorna Restaurant",
        mobile: "9000000011",
        address: "12, 2nd Avenue, Anna Nagar, Chennai",
        driverId: "driver-1",
        creditLimit: 25000,
        openingBalance: 0,
        status: "Active",
      },
    ],
    [
      "customers",
      "customer-2",
      {
        name: "Fresh Basket",
        mobile: "9000000012",
        address: "45, Pondy Bazaar, T. Nagar, Chennai",
        driverId: "driver-1",
        creditLimit: 15000,
        openingBalance: 0,
        status: "Active",
      },
    ],
    [
      "suppliers",
      "supplier-1",
      {
        name: "Green Valley Poultry",
        mobile: "9000000021",
        address: "Red Hills, Chennai",
        driverId: "driver-1",
        paymentTerms: "7 days",
        openingBalance: 0,
        status: "Active",
      },
    ],
    [
      "employees",
      "emp-1",
      {
        code: "EMP-001",
        name: "Arun Kumar",
        role: "Driver",
        mobile: "9000000001",
        salaryType: "Monthly",
        salary: 24000,
        shopId: "shop-1",
        status: "Active",
      },
    ],
    [
      "assets",
      "asset-1",
      {
        type: "Vehicle",
        code: "TN-01-AB-2048",
        assignedTo: "driver-1",
        status: "Active",
        serviceDate: "2026-10-01",
      },
    ],
    ["expenseCategories", "exp-cat-1", { name: "Fuel", status: "Active" }],
    [
      "expenseCategories",
      "exp-cat-2",
      { name: "Shop maintenance", status: "Active" },
    ],
  ];
  for (const [kind, id, data] of entries) await put(kind, data, db, id);
  for (const [itemId, qty, cost] of [
    ["item-1", 65, 360],
    ["item-2", 120, 170],
    ["item-3", 80, 55],
  ])
    await put("stock", {
      itemId,
      shopId: "shop-1",
      direction: "In",
      qty,
      cost,
      reason: "Opening stock",
      date: new Date().toISOString().slice(0, 10),
      createdBy: "admin",
    });
  await db.query("INSERT INTO settings(key,value) VALUES($1,$2)", [
    "profile",
    JSON.stringify({
      businessName: "MeatFlow",
      address: "Chennai, Tamil Nadu",
      contact: "9000000000",
      gst: "",
    }),
  ]);
}
