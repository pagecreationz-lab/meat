import React, { useState } from "react";
import { Download } from "lucide-react";
import { Table, Badge } from "./components";
import { money, label, day, stocks, balances } from "./schema";
import { exportCsv } from "./api";
const sum = (rows, key) => rows.reduce((s, r) => s + Number(r[key] || 0), 0);
export default function Reports({ data, shopId }) {
  const [type, setType] = useState("Sales"),
    [from, setFrom] = useState(day().slice(0, 7) + "-01"),
    [to, setTo] = useState(day()),
    [group, setGroup] = useState("Customer");
  const inRange = (r) =>
    (r.date || r.timestamp?.slice(0, 10) || "") >= from &&
    (r.date || r.timestamp?.slice(0, 10) || "") <= to;
  const bills = data.bills.filter((b) => b.shopId === shopId && inRange(b)),
    purchases = data.purchases.filter(
      (p) => p.shopId === shopId && inRange(p) && p.status === "Received",
    ),
    expenses = data.expenses.filter(
      (e) => (!e.shopId || e.shopId === shopId) && inRange(e),
    );
  let rows = [],
    columns = [];
  const simple = (keys) =>
    keys.map(([key, title, monetary]) => ({
      key,
      label: title,
      ...(monetary ? { render: (r) => money(r[key]) } : {}),
    }));
  if (type === "Sales") {
    const groups = {};
    for (const b of bills) {
      const key =
        group === "Customer"
          ? label(data, "customers", b.customerId)
          : group === "Driver"
            ? label(data, "users", b.driverId)
            : b.channel;
      groups[key] ??= { name: key, bills: 0, sales: 0 };
      groups[key].bills++;
      groups[key].sales += b.total;
    }
    rows = Object.values(groups);
    columns = simple([
      ["name", group],
      ["bills", "Bills"],
      ["sales", "Sales", true],
    ]);
  } else if (type === "Item categories") {
    const groups = {};
    for (const b of bills)
      for (const l of b.items) {
        const item = data.items.find((i) => i.id === l.itemId),
          cat = label(data, "categories", item?.categoryId);
        const key = cat + " / " + l.name;
        groups[key] ??= {
          name: l.name,
          category: cat,
          unit: l.unit,
          qty: 0,
          sales: 0,
        };
        groups[key].qty += l.qty;
        groups[key].sales += l.total;
      }
    rows = Object.values(groups);
    columns = simple([
      ["name", "Item"],
      ["category", "Category"],
      ["qty", "Quantity"],
      ["unit", "Unit"],
      ["sales", "Sales", true],
    ]);
  } else if (type === "Stock") {
    rows = data.items.map((i) => {
      const moves = data.stock.filter(
        (s) => s.itemId === i.id && s.shopId === shopId,
      );
      const opening = moves
          .filter((s) => s.date < from)
          .reduce((n, s) => n + (s.direction === "In" ? s.qty : -s.qty), 0),
        during = moves.filter(inRange),
        inward = sum(
          during.filter((s) => s.direction === "In"),
          "qty",
        ),
        outward = sum(
          during.filter((s) => s.direction === "Out"),
          "qty",
        );
      return {
        name: i.name,
        unit: i.unit,
        opening,
        inward,
        outward,
        closing: opening + inward - outward,
      };
    });
    columns = simple([
      ["name", "Item"],
      ["unit", "Unit"],
      ["opening", "Opening"],
      ["inward", "Inward"],
      ["outward", "Outward"],
      ["closing", "Closing"],
    ]);
  } else if (type === "Purchases") {
    rows = purchases.map((p) => ({
      ...p,
      supplier: label(data, "suppliers", p.supplierId),
    }));
    columns = simple([
      ["number", "PO number"],
      ["supplier", "Supplier"],
      ["date", "Date"],
      ["total", "Total", true],
    ]);
  } else if (type === "Billing") {
    rows = bills.map((b) => ({
      ...b,
      customer: label(data, "customers", b.customerId),
      driver: label(data, "users", b.driverId),
    }));
    columns = simple([
      ["number", "Bill number"],
      ["customer", "Customer"],
      ["driver", "Driver"],
      ["channel", "Type"],
      ["date", "Date"],
      ["total", "Total", true],
    ]);
  } else if (type === "Salary & deductions") {
    rows = data.payroll
      .filter(inRange)
      .filter(
        (p) =>
          data.employees.find((e) => e.id === p.employeeId)?.shopId === shopId,
      )
      .map((p) => ({ ...p, employee: label(data, "employees", p.employeeId) }));
    columns = simple([
      ["employee", "Employee"],
      ["from", "From"],
      ["to", "To"],
      ["gross", "Earned", true],
      ["advances", "Advances", true],
      ["deductions", "Deductions", true],
      ["net", "Paid", true],
    ]);
  } else if (type === "Advances") {
    rows = data.advances
      .filter(inRange)
      .filter(
        (p) =>
          data.employees.find((e) => e.id === p.employeeId)?.shopId === shopId,
      )
      .map((p) => ({ ...p, employee: label(data, "employees", p.employeeId) }));
    columns = simple([
      ["employee", "Employee"],
      ["date", "Date"],
      ["amount", "Advance", true],
      ["remarks", "Remarks"],
      ["settled", "Settled"],
    ]);
  } else if (type === "Expenses") {
    rows = expenses.map((e) => ({
      ...e,
      category: label(data, "expenseCategories", e.categoryId),
    }));
    columns = simple([
      ["category", "Category"],
      ["date", "Date"],
      ["paidBy", "Paid by"],
      ["amount", "Amount", true],
      ["remarks", "Remarks"],
    ]);
  } else if (type === "Profit / loss") {
    let cost = 0;
    for (const b of bills)
      for (const l of b.items) {
        if (l.cost !== undefined) {
          cost += l.qty * l.cost;
          continue;
        }
        const inbound = data.stock.filter(
          (s) =>
            s.itemId === l.itemId &&
            s.shopId === b.shopId &&
            s.direction === "In" &&
            s.date <= b.date,
        );
        const quantity = sum(inbound, "qty");
        cost +=
          l.qty *
          (quantity
            ? inbound.reduce((s, m) => s + m.qty * Number(m.cost || 0), 0) /
              quantity
            : 0);
      }
    const salary = sum(
      data.payroll
        .filter(inRange)
        .filter(
          (p) =>
            data.employees.find((e) => e.id === p.employeeId)?.shopId ===
            shopId,
        ),
      "gross",
    );
    const sales = bills.reduce(
      (s, b) => s + b.items.reduce((n, l) => n + l.qty * l.price, 0),
      0,
    );
    rows = [
      { name: "Sales (excluding tax)", amount: sales },
      { name: "Cost of goods sold (weighted average)", amount: cost },
      { name: "Operating expenses", amount: sum(expenses, "amount") },
      { name: "Earned salary cost", amount: salary },
      {
        name: "Net operating profit / loss",
        amount: sales - cost - sum(expenses, "amount") - salary,
      },
    ];
    columns = simple([
      ["name", "Account"],
      ["amount", "Amount", true],
    ]);
  }
  const csvRows = rows.map((r) =>
    Object.fromEntries(columns.map((c) => [c.label, r[c.key]])),
  );
  return (
    <>
      <div className="filter-bar">
        <label>
          Report
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {[
              "Sales",
              "Item categories",
              "Stock",
              "Purchases",
              "Billing",
              "Salary & deductions",
              "Advances",
              "Expenses",
              "Profit / loss",
            ].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label>
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        {type === "Sales" && (
          <label>
            Group by
            <select value={group} onChange={(e) => setGroup(e.target.value)}>
              {["Customer", "Driver", "Retail / Wholesale"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
        )}
        <button
          className="button secondary"
          onClick={() => exportCsv(type, csvRows)}
        >
          <Download size={16} />
          Export CSV
        </button>
      </div>
      {from > to ? (
        <p className="error">Start date must be before end date.</p>
      ) : (
        <Table columns={columns} rows={rows} />
      )}
      <p className="footnote">
        Reports use the selected shop and date range. Salary periods and
        advances can be viewed daily, weekly or monthly by adjusting the dates.
        Profit uses recorded inbound costs; enter accurate opening-stock costs.
      </p>
    </>
  );
}
