# Requirement mapping

Source: `D:\Meat Project\Meat Requirement.pdf` (4 pages). The user's explicit scope limits authenticated access to the super admin portal and driver app; references to other staff portals in the PDF are not used to create additional portals.

| Brief section | Implementation |
|---|---|
| Admin login, second step, mobile reset | Username/password plus separate secret code; reset request, hashed mobile OTP with expiry/attempt cap, configurable SMS gateway; logout/password change |
| Shop and location context | Top-bar shop/location selection; super admin all shops, driver assigned shops for transactions |
| Location CRUD | City, area, active status, creator and timestamps; referential delete protection |
| Hierarchical shop CRUD | Code, name, parent shop, group, city/area mapping, status; cycle detection |
| Employee, wages, advances | Employee identity/contact, daily/monthly pay, attendance, advances, deductions, salary settlements and date-range reports |
| User CRUD | Two portal roles, assigned shops, username/email/mobile, status, credentials, deletion or deactivation |
| Roles / permissions | Named permission matrices, driver assignment, server View/Create/Edit/Download checks, immutable admin boundary and activity history; Delete is admin-only for master records |
| Assets | Vehicles/devices, code, assignee, status and service date |
| Pre-order links | Per-customer unguessable link, expiry, enable/disable, clipboard copy and booking source |
| QR settings / banks | Multiple bank-linked QR records, account/IFSC/UPI settings, QR generation and supported-browser scanning |
| Profile | GST, business address/contact, password change and logout |
| Driver password requests | Pending requests visible to super admin; reset invalidates existing sessions |
| Category / item master | Category hierarchy, item code/name/unit/default price/tax/status |
| Daily price | Current-date update with previous price and updated-by history; prior orders/bills retain their price snapshot |
| Customers / suppliers | Driver grouping, contact/address, customer credit limit, payment terms, opening/current outstanding |
| Orders | Daily/customer/driver filters; retail/wholesale; customer-link and driver pre-orders; pending/delivered/cancelled |
| Billing / DC | Customer and driver-group filters, retail/wholesale, invoice/DC print to PDF, total/paid/credit/closing balances |
| Inventory | Shop stock movements; opening/inward/outward/closing date-range report; atomic stock deduction on bills |
| Purchase orders | Initial item prices, 48-hour lock, final-price edits and one-time stock receipt |
| Payments | Customer and supplier cash/online/cheque entries, references, dates, amount validation |
| Expenses | Category, amount, date, payer, remarks, driver daily entries and reports |
| Reports | Customer/driver sales; retail/wholesale; purchases; bills; shop stock; item/category; wages/advances/deductions; profit/loss |
| Notifications | Low stock, unpaid-bill overdue accounts, fourth-bill attempts, delayed orders; mark persisted alerts read |
| Dashboard | Today sales, pending orders, outstanding, stock, top items, 7-day chart and driver performance |
| GPS tracking | Foreground live points, latest timestamp, map links, route-point history, delivery on-time/delayed |
| Driver login | Mobile/password, mandatory GPS, server-captured IP, device mapping and session revocation |
| Driver pre-orders | Customer/items/quantity; view all customer orders across driver groups; driver manages their assigned delivery and billing actions |
| Driver delivery | Signature canvas, loaded weight, confirmation timestamp and coordinates; status is persisted |
| Driver billing rule | Three unpaid bills maximum; fourth attempt blocked and admin notified; customer SMS queued |
| Driver balances | Total, paid, partially paid, outstanding and current state for customers |
| QR payment | UPI payment QR, optional camera scanning, reference-based payment recording after verification |
| Supplier visit | Supplier, loaded item quantities, shop, remarks, timestamp and GPS; admin can inspect all logs |
| Driver expenses | Daily category/amount/date/remarks entries |

## Explicit implementation choices

- The driver deliverable is a mobile web/PWA app, not a compiled Android/iOS binary. GPS works while the web app is open; browser background tracking is not guaranteed.
- Super admin second-step verification uses the brief's allowed **secret code** option. Mobile password reset uses an expiring OTP through the configured SMS adapter.
- An order can be billed before or after delivery. Billing posts stock-out; delivery itself does not post stock a second time. A billed order cannot be cancelled through the pending-order cancellation action.
- Payments allocate oldest-first after the customer's opening balance. The three-unpaid-bills rule is account-wide. A fourth bill is blocked even for the admin, preserving the specified credit control.
- “After 2 days” means 48 elapsed hours from the database creation timestamp, not a client-provided date. Finalizing the PO also receives the stock.
- Overdue notifications use seven days for unpaid customer bills because the brief specifies no customer credit period. Supplier payment terms are stored as entered. Delivery lateness compares the promised delivery date with confirmation date.
- Financial dates and link-expiry day boundaries use Asia/Kolkata. GPS/audit event timestamps are stored in UTC and displayed in the browser's local timezone.
- Monthly payroll uses the number of calendar days in each applicable month; only recorded present/half days earn salary. Advances and deductions cannot produce a negative payout; choose a sufficient settlement period.
- Profit excludes sales tax and subtracts recorded cost of goods, expenses and earned salary. New bills snapshot perpetual weighted-average unit cost. Older demo bills without a snapshot use the inbound weighted-average fallback. This is an operational profit report, not a statutory accounting ledger.
- No real SMS, bank charge, UPI payment confirmation, or map routing provider is represented as completed without a configured service. QR scanning and payment entry do not independently verify settlement.
- The PDF references an invoice sample and a supplier-visit reference. Neither was attached. The supplied invoice/DC and visit fields follow the text of the available brief; an exact match to the absent samples cannot be claimed.

## Before external use

Configure a production PostgreSQL database, strong secrets, HTTPS, your SMS adapter, real bank/UPI details, business/GST details, stock costs, employee schedules and opening balances. Obtain the absent samples if exact printed-format compliance is required. Back up the database and agree the operational date/overdue/payroll conventions with the business.
