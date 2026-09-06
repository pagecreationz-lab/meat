import { test, expect } from "@playwright/test";
test("admin workflow: navigate, create order, bill, record payment and print", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password", { exact: true }).fill("Admin@12345");
  await page.getByLabel("Secret verification code").fill("246810");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Select shop and location").selectOption("shop-1");
  await page.screenshot({
    path: "test-results/admin-overview.png",
    fullPage: true,
  });
  for (const name of [
    "Orders",
    "Billing & challans",
    "Inventory",
    "Purchase orders",
    "Payments",
    "Expenses",
    "Customers",
    "Suppliers",
    "Team & payroll",
    "Driver tracking",
    "Reports",
    "Items & pricing",
    "Master settings",
    "Pre-order links",
    "Notifications",
    "Settings",
  ]) {
    await page
      .locator(".sidebar nav")
      .getByRole("button", { name: new RegExp("^" + name) })
      .click();
    await expect(page.locator(".page-content")).toBeVisible();
  }
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: /^Orders/ })
    .click();
  await page.getByRole("button", { name: "New pre-order" }).click();
  const modal = page.getByRole("dialog");
  await modal
    .getByLabel("Customer", { exact: false })
    .selectOption("customer-2");
  await modal.getByLabel("Driver", { exact: false }).selectOption("driver-1");
  await modal.getByLabel("Item", { exact: true }).selectOption("item-2");
  await modal.getByLabel("Quantity").fill("2");
  await modal.getByRole("button", { name: "Save pre-order" }).click();
  await expect(modal).toBeHidden();
  const row = page
    .locator("tbody tr")
    .filter({ hasText: "Fresh Basket" })
    .first();
  await expect(row).toContainText("480");
  await row.getByRole("button", { name: "Bill", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save changes" })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "Billing & challans" })
    .click();
  await page
    .locator("tbody tr")
    .filter({ hasText: "Fresh Basket" })
    .first()
    .getByRole("button", { name: "Invoice / DC" })
    .click();
  await expect(page.locator(".invoice")).toContainText("Broiler");
  await page.screenshot({ path: "test-results/invoice.png", fullPage: true });
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "Payments", exact: true })
    .click();
  await page.getByRole("button", { name: "Record payment" }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Party", { exact: false })
    .last()
    .selectOption("customer-2");
  await page
    .getByRole("dialog")
    .getByLabel("Amount", { exact: false })
    .fill("480");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save changes" })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
  expect(errors).toEqual([]);
});
test("mobile driver: GPS login, signature delivery, balances and supplier visit", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    geolocation: { latitude: 13.0827, longitude: 80.2707 },
    permissions: ["geolocation"],
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:5173");
  await page.getByRole("button", { name: "Driver", exact: true }).click();
  await page.getByLabel("Mobile number").fill("9000000001");
  await page.getByLabel("Password", { exact: true }).fill("Driver@12345");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Hello, Arun." }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/driver-home.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Confirm delivery" }).first().click();
  await page.getByLabel("Loaded weight").fill("2");
  const pad = page.getByLabel("Customer signature pad"),
    box = await pad.boundingBox();
  await page.mouse.move(box.x + 20, box.y + 50);
  await page.mouse.down();
  await page.mouse.move(box.x + 120, box.y + 75, { steps: 12 });
  await page.mouse.move(box.x + 170, box.y + 30, { steps: 12 });
  await page.mouse.up();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm delivery" })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page
    .locator(".driver-bottom")
    .getByRole("button", { name: "Balances" })
    .click();
  await expect(page.getByRole("table")).toContainText("Fresh Basket");
  await page
    .locator(".driver-bottom")
    .getByRole("button", { name: "Visits" })
    .click();
  await page.getByRole("button", { name: "Log visit" }).click();
  await page.getByLabel("Supplier", { exact: true }).selectOption("supplier-1");
  await page.getByLabel("Item", { exact: true }).selectOption("item-1");
  await page.getByRole("button", { name: "Save record" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByRole("table")).toContainText("Green Valley");
  expect(errors).toEqual([]);
  await context.close();
});
