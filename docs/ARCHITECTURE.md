# Architecture

## Components

- `src/`: React portal, mobile driver interface, public token-scoped pre-order form, schema-driven master forms, reporting, signature capture and QR workflows.
- `server/app.js`: Express API, authentication, authorization, transactions, billing/payroll logic, SMS queue dispatcher and production static hosting.
- `server/db.js`: Shared parameterized SQL adapter for either `pg` or PGlite; schema initialization, record storage and transaction serialization.
- `server/config.js`: Server allowlists for master fields and required attributes.
- `server/seed.js`: Development-only operational examples; production initializes only the configured super admin.

## Data model

`users` has typed authentication fields, a two-value portal-role constraint, unique usernames/mobiles, bcrypt password hashes, shop assignments, permission-role ID and a session version. `settings` stores business configuration. `records` stores a typed `kind`, JSONB data, immutable ID and database-managed timestamps, with kind and unique master-code indexes.

Business records include orders, bills, inventory movements, purchases, payments, expenses, daily prices, attendance, payroll, salary advances/deductions, customer links, deliveries, supplier visits, GPS points, device mappings, password requests, OTP hashes, alerts, SMS outbox and audit events. Relationships are validated by the API. Referenced master/user deletion is blocked. Financial operations and their stock/audit effects commit together.

The flexible JSONB schema is PostgreSQL-native. It favors a compact, extendable application over separate relational tables for every master. A very large deployment should add typed projections, query-side pagination and partitioning/retention for GPS and audit history instead of returning an entire bootstrap dataset.

## Security and consistency

- Passwords use bcrypt; admin secret second factor is checked at login; auth routes are rate-limited.
- JWTs expire after 12 hours and contain only identity and session version. Logout, driver reset, device remapping and account changes invalidate previous sessions.
- JWTs are stored in browser session storage. The API reloads account status/role on every authenticated request.
- Driver mutation allowlist, shop assignments, delivery/billing assignment and optional action permissions are checked on the server. Super admin access cannot be acquired via a custom permission role.
- Driver bootstrap omits salary, audit, reset codes, users' credentials and admin-only records.
- Parameterized SQL, field allowlists, amount/quantity checks, duplicate-bill protection, price history, stock checks and protected deletion are server-side.
- Each financial transaction is serialized within the local process. Standard PostgreSQL additionally uses a transaction-scoped advisory lock so multiple API instances cannot overbill or oversell through concurrent operations.
- Billing snapshots item/price/tax and unit cost; updates the stock ledger; enqueues SMS; audits atomically. Payments never exceed outstanding balances.
- Reset OTPs are hashed, expire after ten minutes, and allow five failed guesses. Driver password reset requires super admin authorization.
- Customer links use 192-bit random tokens, are scoped to one customer/shop, validate expiry/status, and ignore client-supplied customer identity/prices.

## Operations

- The default server binds to loopback. Expose it through an HTTPS reverse proxy. Driver GPS/camera APIs require a secure origin.
- Set production environment secrets before startup. Avoid storing secrets in version control.
- Use `pg_dump` and your managed database backup tools for production. Stop the local app before copying the complete `.data/postgres` directory as a local backup.
- Standard PostgreSQL and PGlite have separate stores. Setting DATABASE_URL selects that server; it does not migrate embedded data automatically. Export/migrate existing records explicitly before switching a live deployment.
- The outbox polls every 15 seconds when a gateway is configured. The generic gateway adapter must translate its request into your SMS provider's API and enforce provider-specific sender/template requirements.
- The GPS stream is foreground-only, and the admin refresh interval is 30 seconds. Route history uses recorded points and map links; it does not provide turn-by-turn optimization.
- Service worker navigation fallback shows an offline message. API responses and offline transactions are not cached.

## Validation

`npm test` uses a fresh temporary PGlite store. Browser tests use the running development server and sample accounts, so run them only against development data. Google Chrome is selected in Playwright configuration; change the browser channel if using another installed supported browser.
