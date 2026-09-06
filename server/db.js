import "dotenv/config";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import fs from "node:fs";
const pool = process.env.DATABASE_URL
  ? new pg.Pool({ connectionString: process.env.DATABASE_URL })
  : null;
if (!pool) fs.mkdirSync(process.env.DATA_DIR || ".data", { recursive: true });
const local = pool
  ? null
  : new PGlite(process.env.DATA_DIR || ".data/postgres");
export const db = {
  query: (sql, params = []) =>
    pool ? pool.query(sql, params) : local.query(sql, params),
  close: async () => {
    await queue;
    if (pool) await pool.end();
    else await local.close();
  },
};
let queue = Promise.resolve();
export function transaction(fn) {
  const run = queue.then(async () => {
    if (local) return local.transaction((tx) => fn(tx));
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(842129)");
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  });
  queue = run.catch(() => {});
  return run;
}
export async function initialize() {
  await db.query(
    `CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, kind TEXT NOT NULL, data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());`,
  );
  await db.query(`CREATE INDEX IF NOT EXISTS records_kind ON records(kind)`);
  await db.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS records_unique_code ON records(kind,(data->>'code')) WHERE data ? 'code' AND data->>'code' <> ''`,
  );
  await db.query(
    `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, mobile TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('superadmin','driver')), name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Active', shops JSONB NOT NULL DEFAULT '[]', email TEXT NOT NULL DEFAULT '', session_version INTEGER NOT NULL DEFAULT 0)`,
  );
  await db.query(
    `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value JSONB NOT NULL)`,
  );
  await db.query(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS permission_role_id TEXT NOT NULL DEFAULT ''`,
  );
}
export async function all(kind, client = db) {
  return (
    await client.query(
      "SELECT id, data, created_at, updated_at FROM records WHERE kind=$1 ORDER BY created_at DESC",
      [kind],
    )
  ).rows.map((r) => ({
    id: r.id,
    ...r.data,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}
export async function get(kind, id, client = db) {
  const names = {
    shops: "shop",
    customers: "customer",
    items: "item",
    suppliers: "supplier",
    orders: "order",
    roles: "permission role",
    locations: "location",
  };
  const recordName = names[kind] || "record";
  if (typeof id !== "string" || !id.trim())
    throw Object.assign(
      new Error(`Select a ${recordName} before continuing.`),
      { status: 400 },
    );
  const r = (
    await client.query(
      "SELECT id,data,created_at FROM records WHERE kind=$1 AND id=$2",
      [kind, id],
    )
  ).rows[0];
  if (!r)
    throw Object.assign(
      new Error(
        `The selected ${recordName} was not found. Refresh the page and select it again.`,
      ),
      { status: 404 },
    );
  return { id: r.id, ...r.data, createdAt: r.created_at };
}
export async function put(kind, data, client = db, id = crypto.randomUUID()) {
  await client.query(
    "INSERT INTO records (id,kind,data) VALUES ($1,$2,$3) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data,updated_at=now()",
    [id, kind, JSON.stringify(data)],
  );
  return { id, ...data };
}
export async function remove(kind, id, client = db) {
  await client.query("DELETE FROM records WHERE kind=$1 AND id=$2", [kind, id]);
}
