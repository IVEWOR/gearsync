import { PgBoss } from "pg-boss";

const g = globalThis;

// Singleton promise: resolves to a started boss instance.
// Using DIRECT_URL (port 5432) — pg-boss needs DDL access for schema management.
if (!g.__pgboss) {
  const boss = new PgBoss(process.env.DIRECT_URL);
  g.__pgboss = boss.start().then(() => {
    boss.on("error", (err) => console.error("[pg-boss] error", err));
    console.log("[pg-boss] started");
    return boss;
  });
}

export function getBoss() {
  return g.__pgboss;
}

export async function enqueue(name, data, options = {}) {
  const boss = await g.__pgboss;
  return boss.send(name, data, options);
}
