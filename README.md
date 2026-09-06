# MeatFlow

A working React + Node.js meat operations system with exactly two authenticated portals: **super admin** and **driver**. Built against `D:\Meat Project\Meat Requirement.pdf`. A token-scoped customer pre-order form is included because the brief explicitly requires customer links; it is not a third account portal.

## Run locally

Requires Node.js 22.12+ (24 recommended).

```powershell
npm install
npm run dev
```

Open **http://127.0.0.1:5173**. The API runs on port 4000. The default database is **PGlite, a persistent embedded PostgreSQL runtime**, stored in `.data/postgres`. No Supabase account or running Docker service is needed for the local app.

Initial development accounts:

| Portal | Username/mobile | Password | Second factor |
|---|---|---|---|
| Super admin | `admin` | `Admin@12345` | `246810` |
| Driver | `9000000001` | `Driver@12345` | GPS permission required |

Development seeding supplies two shops, three item categories, inventory, customers, a supplier, an employee and a driver. Browser verification may also leave sample transactions in this local demo. The seeded accounts are created only when the user table is empty. Changing environment variables does not overwrite an existing password.

Choose **SPS Main Shop / Anna Nagar** for the initial inventory. Use the shop selector in the top bar to switch location and shop. Super admins can access every shop; drivers transact within their assigned shops and see all customer pre-orders as required.

## Production build

```powershell
npm run build
npm start
```

Node serves both `dist` and `/api` at http://127.0.0.1:4000. Copy `.env.example` to `.env`, configure secrets, and set `NODE_ENV=production` for a production deployment. The production startup checks require a 32+ character `JWT_SECRET` and an `ADMIN_SECRET_CODE`. A new production database also requires `ADMIN_PASSWORD`; it is initialized without demo records.

For a standard PostgreSQL server (including a Supabase PostgreSQL connection), set:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/meatflow
JWT_SECRET=REPLACE_WITH_AT_LEAST_32_RANDOM_CHARACTERS
ADMIN_USERNAME=admin
ADMIN_PASSWORD=REPLACE_WITH_A_STRONG_PASSWORD
ADMIN_SECRET_CODE=REPLACE_WITH_A_PRIVATE_SECOND_FACTOR
NODE_ENV=production
```

The server automatically creates its schema and indexes on startup. It uses PostgreSQL transactions and an advisory lock for serialized financial/inventory writes across server instances. The connection string stays on the server, never in the React bundle. Configure TLS using your database provider's connection parameters. For production, use standard PostgreSQL; PGlite is the single-process local runtime.

Place an HTTPS reverse proxy in front of port 4000. HTTPS is required for GPS/camera on phones (localhost is a browser exception). A phone cannot reach another computer through `127.0.0.1`; use the deployment's HTTPS hostname. Do not use development secrets or copy the demo database into production.

## Driver app

The driver app is a responsive web app with a manifest and production service worker. Open the HTTPS site on a phone, sign in under **Driver**, and use the browser's **Add to home screen**. It supports customer pre-orders, signed GPS-stamped delivery confirmation, invoice/DC access, account balances, collections, payment QR codes, supplier visits and daily expenses.

GPS is captured at login and updated while the app is open. Reassigning a device to another driver invalidates the prior driver's session. The browser cannot guarantee GPS in the background or when the phone is locked. Native Android/iOS packaging and background-location services are not included. Offline transactions are intentionally blocked to avoid conflicting stock and balances.

## SMS integration

Billing queues a customer SMS with items, quantities, unit prices, date, total and closing balance. Admin mobile password reset also queues a one-time code. Configure an HTTP gateway using:

```dotenv
SMS_GATEWAY_URL=https://your-sms-adapter.example/send
SMS_GATEWAY_TOKEN=YOUR_GATEWAY_TOKEN
```

The adapter receives `POST { "to": "mobile", "message": "text" }` with a bearer token. A successful 2xx response marks the message sent; failures are retried up to three times. **Settings → SMS outbox** shows Queued / Sent / Failed. Without these credentials, messages remain queued and real admin SMS password recovery cannot complete. A small adapter may be needed for a provider-specific API. No SMS credentials were supplied with this project.

## Main workflows

- **Master settings:** locations, hierarchical shops, employees, users, driver permission roles, assets, expense categories. Items/categories/daily pricing have their own section. Banks and payment QR accounts are in Settings.
- **Orders:** filter by day, driver, customer and status; add pre-orders; view line items; cancel an unbilled pending order; create a bill; confirm delivery with signature, loaded weight and GPS.
- **Billing:** one invoice per order; automatic stock-out; FIFO payment allocation; paid and credit columns; retail/wholesale and driver-group filters; printable invoice and delivery challan.
- **Credit rule:** three outstanding bills are allowed. The fourth attempt is blocked and creates an admin alert. Paying off an oldest bill permits another bill. A positive credit limit is also enforced; zero means unlimited monetary credit, not unlimited unpaid bills.
- **Purchasing:** save initial prices, wait 48 elapsed hours, edit final prices, then receive stock once. The initial values remain in the record. Supplier visits are logs; they do not double-count stock already received through a purchase.
- **Payments:** customer receipts and supplier payments via cash, online or cheque. Online/cheque references are mandatory. Payments cannot exceed the recorded outstanding amount. Recording a payment does not charge a bank account or prove UPI settlement.
- **Payroll:** present/absent/half-day attendance; daily or calendar-day-prorated monthly wages; salary advances, including weekly advances; deductions; arbitrary daily/weekly/monthly settlement periods. Missing attendance earns zero. Paid periods cannot overlap or have attendance rewritten.
- **Reports:** customer/driver sales, retail versus wholesale, item/category sales, purchases, billing, shop stock opening/in/out/closing, payroll/deductions, advances, expenses, and profit/loss with CSV export.
- **Tracking & notifications:** latest GPS positions, external OpenStreetMap location links, route history, on-time/delayed counts, supplier visits, low-stock, unpaid-account overdue alerts, delayed orders and excess billing attempts.

Super admin always has full access. Driver accounts without a permission role use the standard driver capabilities. Assigned permission roles can restrict supported driver View/Create/Edit/Download actions; they never grant access to admin-only actions or introduce a third portal type. Delete operations on referenced records are blocked; deactivate them to preserve history.

## Verification

```powershell
npm test
npm run build
# Start npm run dev first. Browser tests use the installed Google Chrome.
npm run test:e2e
```

API tests create a separate temporary PostgreSQL database and cover authentication, privilege enforcement, stock, billing, payments, purchase timing, delivery evidence, payroll, prices, customer links and password reset. Browser tests run desktop admin and 390px mobile driver workflows. Screenshots and failed traces are written to `test-results/` (git-ignored).

## Requirements and operational details

See [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) for the requirement mapping and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for storage, security and deployment details. The referenced sample bill layout and supplier-visit reference document were not included in the provided PDF. Their implemented layouts use all fields actually listed in the brief; exact matching to those absent samples remains unverified.
