#!/usr/bin/env node
// One-time NHTSA vPIC import: populates the Vehicle table for years 1995–present.
// Run from project root: node scripts/import-vpic.js
"use strict";

require("dotenv/config");

const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
});

const START_YEAR = 1995;
const CURRENT_YEAR = new Date().getFullYear();
const CHUNK_SIZE = 500;
const DELAY_MS = 100;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  const json = await res.json();
  return json;
}

async function getAllCarMakes() {
  const data = await fetchJson(
    "https://vpic.nhtsa.dot.gov/api/vehicles/GetMakesForVehicleType/car?format=json"
  );
  return (data.Results || [])
    .map((r) => r.MakeName)
    .filter(Boolean)
    .sort();
}

async function getModelsForMakeYear(make, year) {
  const encoded = encodeURIComponent(make);
  const data = await fetchJson(
    `https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear/make/${encoded}/modelyear/${year}?format=json`
  );
  return (data.Results || []).map((r) => r.Model_Name).filter(Boolean);
}

async function insertChunk(rows) {
  if (!rows.length) return 0;
  const values = [];
  const placeholders = rows.map((v, i) => {
    const b = i * 3;
    values.push(v.year, v.make, v.model);
    return `($${b + 1}, $${b + 2}, $${b + 3}, NULL, NULL)`;
  });
  // ON CONFLICT DO NOTHING covers the rare case of a concurrent re-run.
  // Primary dedup is the in-memory Set pre-loaded at startup.
  const result = await pool.query(
    `INSERT INTO "Vehicle" (year, make, model, trim, engine)
     VALUES ${placeholders.join(", ")}
     ON CONFLICT DO NOTHING`,
    values
  );
  return result.rowCount ?? 0;
}

async function main() {
  console.log(`[vpic] import start — years ${START_YEAR}–${CURRENT_YEAR}`);

  // Pre-load existing rows so re-runs skip already-imported vehicles.
  // PostgreSQL unique index treats NULL != NULL, so we can't rely on
  // ON CONFLICT alone for rows where trim and engine are both NULL.
  const { rows: existing } = await pool.query(
    `SELECT year, make, model FROM "Vehicle"`
  );
  const seen = new Set(existing.map((r) => `${r.year}|${r.make}|${r.model}`));
  console.log(`[vpic] ${seen.size} vehicles already in DB — will skip`);

  const makes = await getAllCarMakes();
  console.log(`[vpic] ${makes.length} makes fetched from NHTSA`);

  let totalInserted = 0;
  let totalNew = 0;
  const pending = [];

  const flush = async (force = false) => {
    while (pending.length >= CHUNK_SIZE || (force && pending.length)) {
      const chunk = pending.splice(0, CHUNK_SIZE);
      const n = await insertChunk(chunk);
      totalInserted += n;
      if (totalInserted % 100 < chunk.length) {
        console.log(`[vpic] inserted ${totalInserted} rows so far`);
      }
    }
  };

  for (let year = START_YEAR; year <= CURRENT_YEAR; year++) {
    let yearNew = 0;
    for (const make of makes) {
      await sleep(DELAY_MS);

      let models;
      try {
        models = await getModelsForMakeYear(make, year);
      } catch (err) {
        console.error(`[vpic] skip ${make} ${year}: ${err.message}`);
        continue;
      }

      for (const model of models) {
        const key = `${year}|${make}|${model}`;
        if (seen.has(key)) continue;
        seen.add(key);
        pending.push({ year, make, model });
        yearNew++;
        totalNew++;
      }

      await flush();
    }

    console.log(`[vpic] year ${year} done — ${yearNew} new vehicles queued`);
  }

  await flush(true);

  console.log(
    `[vpic] done — ${totalNew} new vehicles queued, ${totalInserted} rows inserted`
  );
  await pool.end();
}

main().catch((err) => {
  console.error("[vpic] fatal:", err);
  process.exit(1);
});
