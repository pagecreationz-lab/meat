export const field = (
  key,
  label,
  type = "text",
  options = null,
  required = true,
) => ({ key, label, type, options, required });
const f = field;
const status = f("status", "Status", "select", ["Active", "Inactive"]);
export const schemas = {
  locations: {
    title: "Locations",
    description: "Cities and areas across your operations.",
    fields: [f("name", "City name"), f("area", "Area name"), status],
  },
  shops: {
    title: "Shops",
    description: "Manage your parent shops, branches and shop groups.",
    fields: [
      f("name", "Shop name"),
      f("code", "Shop code"),
      f("locationId", "Location", "ref", "locations"),
      f("parentId", "Parent shop", "ref", "shops", false),
      f("group", "Group mapping", "text", null, false),
      f("address", "Address", "text", null, false),
      status,
    ],
  },
  employees: {
    title: "Employees",
    description: "Your team, salary details and shop assignments.",
    fields: [
      f("code", "Employee ID"),
      f("name", "Full name"),
      f("role", "Job role"),
      f("mobile", "Contact number", "tel"),
      f("salaryType", "Salary type", "select", ["Daily", "Monthly"]),
      f("salary", "Salary amount", "number"),
      f("shopId", "Shop", "ref", "shops"),
      status,
    ],
  },
  users: {
    title: "Users & access",
    description: "Only super admin and driver accounts can access the system.",
    fields: [
      f("name", "Full name"),
      f("username", "Username"),
      f("email", "Email", "email", null, false),
      f("mobile", "Mobile number", "tel"),
      f("role", "Portal role", "select", ["driver", "superadmin"]),
      f(
        "permission_role_id",
        "Driver permission role (optional)",
        "ref",
        "roles",
        false,
      ),
      f("shops", "Assigned shops", "multi", "shops"),
      f("password", "Password (10+ characters)", "password", null, false),
      status,
    ],
  },
  roles: {
    title: "Roles & permissions",
    description:
      "Assign action permissions to drivers in Users & access. Super admins always retain full access.",
    fields: [
      f("name", "Role name"),
      f("permissions", "Permissions matrix", "permissions"),
      status,
    ],
  },
  assets: {
    title: "Vehicles & devices",
    description: "Keep track of assigned assets and upcoming service dates.",
    fields: [
      f("type", "Asset type", "select", ["Vehicle", "Device"]),
      f("code", "Asset code"),
      f("assignedTo", "Assigned to", "ref", "users", false),
      f("serviceDate", "Service date", "date", null, false),
      f("status", "Status", "select", [
        "Active",
        "Inactive",
        "In service",
        "Retired",
      ]),
    ],
  },
  categories: {
    title: "Categories",
    description: "Organize country chicken, broiler, quail and subcategories.",
    fields: [
      f("name", "Category name"),
      f("parentId", "Parent category", "ref", "categories", false),
      status,
    ],
  },
  items: {
    title: "Items & categories",
    description: "Your product catalog, units, tax and stock thresholds.",
    fields: [
      f("code", "Item code"),
      f("name", "Item name"),
      f("categoryId", "Category", "ref", "categories"),
      f("unit", "Unit", "select", ["kg", "piece", "gram"]),
      f("price", "Default price", "number"),
      f("tax", "Tax (%)", "number", null, false),
      f("lowStock", "Low-stock threshold", "number", null, false),
      status,
    ],
  },
  customers: {
    title: "Customers",
    description: "Customer accounts, driver groups and credit limits.",
    fields: [
      f("name", "Customer name"),
      f("mobile", "Mobile number", "tel"),
      f("address", "Address"),
      f("driverId", "Assigned driver", "ref", "drivers", false),
      f("creditLimit", "Credit limit (0 = unlimited)", "number", null, false),
      f("openingBalance", "Opening balance", "number", null, false),
      status,
    ],
  },
  suppliers: {
    title: "Suppliers",
    description: "Poultry partners, payment terms and driver assignments.",
    fields: [
      f("name", "Supplier name"),
      f("mobile", "Contact number", "tel"),
      f("address", "Address", "text", null, false),
      f("driverId", "Assigned driver", "ref", "drivers", false),
      f("paymentTerms", "Payment terms"),
      f("openingBalance", "Opening amount", "number", null, false),
      status,
    ],
  },
  banks: {
    title: "Bank accounts",
    description: "Payment accounts and UPI details for collections.",
    fields: [
      f("name", "Bank name"),
      f("holder", "Account holder"),
      f("account", "Account number"),
      f("ifsc", "IFSC code"),
      f("upi", "UPI ID", "text", null, false),
      status,
    ],
  },
  qr: {
    title: "QR payment settings",
    description: "Multiple payment QR codes linked to bank accounts.",
    fields: [
      f("code", "QR code ID"),
      f("bankId", "Linked bank account", "ref", "banks"),
      status,
    ],
  },
  expenseCategories: {
    title: "Expense categories",
    description: "Organize operational spending.",
    fields: [f("name", "Category name"), status],
  },
};
export const actionSchemas = {
  price: {
    title: "Update daily price",
    fields: [
      f("itemId", "Item", "ref", "items"),
      f("price", "New price", "number"),
    ],
  },
  stock: {
    title: "Stock adjustment",
    fields: [
      f("itemId", "Item", "ref", "items"),
      f("direction", "Movement", "select", ["In", "Out"]),
      f("qty", "Quantity", "number"),
      f("cost", "Unit cost (inward)", "number", null, false),
      f("reason", "Reason"),
      f("date", "Date", "date"),
    ],
  },
  payment: {
    title: "Record payment",
    fields: [
      f("partyType", "Party type", "select", ["Customer", "Supplier"]),
      f("partyId", "Party", "party"),
      f("mode", "Payment mode", "select", ["Cash", "Online", "Cheque"]),
      f("amount", "Amount", "number"),
      f("date", "Payment date", "date"),
      f("reference", "Reference / cheque number", "text", null, false),
    ],
  },
  expense: {
    title: "Add expense",
    fields: [
      f("categoryId", "Category", "ref", "expenseCategories"),
      f("amount", "Amount", "number"),
      f("date", "Date", "date"),
      f("remarks", "Remarks", "textarea", null, false),
    ],
  },
  attendance: {
    title: "Record attendance",
    fields: [
      f("employeeId", "Employee", "ref", "employees"),
      f("date", "Date", "date"),
      f("status", "Attendance", "select", ["Present", "Absent", "Half day"]),
    ],
  },
  advance: {
    title: "Record salary advance",
    fields: [
      f("employeeId", "Employee", "ref", "employees"),
      f("amount", "Advance amount", "number"),
      f("date", "Date", "date"),
      f("remarks", "Remarks", "text", null, false),
    ],
  },
  deduction: {
    title: "Record deduction",
    fields: [
      f("employeeId", "Employee", "ref", "employees"),
      f("amount", "Deduction amount", "number"),
      f("date", "Date", "date"),
      f("remarks", "Remarks", "text", null, false),
    ],
  },
  payroll: {
    title: "Calculate & pay salary",
    fields: [
      f("employeeId", "Employee", "ref", "employees"),
      f("from", "Period from", "date"),
      f("to", "Period to", "date"),
    ],
  },
  link: {
    title: "Generate customer pre-order link",
    fields: [
      f("customerId", "Customer", "ref", "customers"),
      f("expiry", "Expiry date", "date"),
      f("channel", "Sales type", "select", ["Wholesale", "Retail"]),
    ],
  },
  resetDriver: {
    title: "Reset driver password",
    fields: [f("password", "New password (10+ characters)", "password")],
  },
  profile: {
    title: "Business settings",
    fields: [
      f("businessName", "Business name"),
      f("gst", "GST number", "text", null, false),
      f("address", "Business address", "textarea"),
      f("contact", "Contact number", "tel"),
    ],
  },
};
export const money = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(n) || 0);
export const day = (value = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
export const label = (data, kind, id) =>
  (kind === "drivers" ? data.users : data[kind])?.find((x) => x.id === id)
    ?.name ||
  data[kind]?.find((x) => x.id === id)?.code ||
  "—";
export function balances(data, type = "Customer") {
  return (data[type === "Customer" ? "customers" : "suppliers"] || []).map(
    (p) => {
      const sales =
        type === "Customer"
          ? (data.bills || [])
              .filter((b) => b.customerId === p.id)
              .reduce((s, b) => s + b.total, 0)
          : (data.purchases || [])
              .filter((b) => b.supplierId === p.id && b.status === "Received")
              .reduce((s, b) => s + b.total, 0);
      const paid = (data.payments || [])
        .filter((x) => x.partyType === type && x.partyId === p.id)
        .reduce((s, x) => s + x.amount, 0);
      return {
        ...p,
        total: sales + Number(p.openingBalance || 0),
        paid,
        outstanding: Math.max(0, sales + Number(p.openingBalance || 0) - paid),
        balanceStatus:
          sales + Number(p.openingBalance || 0) - paid <= 0
            ? "Paid"
            : paid > 0
              ? "Partially Paid"
              : "Due",
      };
    },
  );
}
export function stocks(data, shopId) {
  return (data.items || []).map((i) => {
    const movements = (data.stock || []).filter(
      (s) => s.itemId === i.id && (!shopId || s.shopId === shopId),
    );
    const inward = movements
        .filter((s) => s.direction === "In")
        .reduce((s, m) => s + m.qty, 0),
      outward = movements
        .filter((s) => s.direction === "Out")
        .reduce((s, m) => s + m.qty, 0);
    return { ...i, inward, outward, closing: inward - outward };
  });
}

// Allocate collections oldest-first, after any opening balance.
export function allocatedBills(data) {
  const result = [];
  for (const customer of data.customers || []) {
    let credit = Math.max(
      0,
      (data.payments || [])
        .filter((p) => p.partyType === "Customer" && p.partyId === customer.id)
        .reduce((s, p) => s + p.amount, 0) -
        Number(customer.openingBalance || 0),
    );
    for (const bill of [...(data.bills || [])]
      .filter((b) => b.customerId === customer.id)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))) {
      const paid = Math.min(credit, bill.total);
      credit -= paid;
      result.push({
        ...bill,
        paid,
        credit: Math.round((bill.total - paid) * 100) / 100,
      });
    }
  }
  return result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
