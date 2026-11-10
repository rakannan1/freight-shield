#!/usr/bin/env node
// Live check of the FMCSA data this app depends on. Run with your own key:
//   FMCSA_WEB_KEY=xxxx node scripts/check-fmcsa.mjs <DOT> [<DOT>...]
// Optional: SOCRATA_APP_TOKEN, MOTUS_INSUR_DATASET (default c5y8-a4uz)
const key = process.env.FMCSA_WEB_KEY;
const dots = process.argv.slice(2);
if (!key || !dots.length) {
  console.error("Usage: FMCSA_WEB_KEY=... node scripts/check-fmcsa.mjs <DOT> [<DOT>...]");
  process.exit(1);
}
const BASE = "https://mobile.fmcsa.dot.gov/qc/services";
const get = async (path) => {
  const res = await fetch(`${BASE}${path}?webKey=${encodeURIComponent(key)}`, { headers: { Accept: "application/json" } });
  const text = await res.text();
  let body; try { body = JSON.parse(text); } catch { body = text.slice(0, 200); }
  return { status: res.status, body };
};
const CARRIER_FIELDS = ["legalName","phyStreet","phyCity","phyState","phyZipcode","phyZip","telephone","allowedToOperate","allowToOperate",
  "commonAuthorityStatus","contractAuthorityStatus","brokerAuthorityStatus","bipdInsuranceOnFile","bipdRequiredAmount",
  "cargoInsuranceOnFile","oosDate","totalPowerUnits","totalDrivers"];

for (const dot of dots) {
  console.log(`\n=== DOT ${dot} ===`);
  const c = await get(`/carriers/${dot}`);
  const carrier = c.body?.content?.carrier;
  console.log(`/carriers/${dot}: HTTP ${c.status}`);
  if (carrier) {
    console.log("  fields present:", CARRIER_FIELDS.filter((f) => carrier[f] !== undefined && carrier[f] !== null).join(", ") || "(none)");
    console.log("  fields missing:", CARRIER_FIELDS.filter((f) => carrier[f] === undefined || carrier[f] === null).join(", ") || "(none)");
    console.log("  insurance in carrier record:", JSON.stringify({ bipd: carrier.bipdInsuranceOnFile, required: carrier.bipdRequiredAmount, cargo: carrier.cargoInsuranceOnFile }));
  }
  const a = await get(`/carriers/${dot}/authority`);
  console.log(`/carriers/${dot}/authority: HTTP ${a.status}`);
  console.log("  ", JSON.stringify(a.body).slice(0, 600));
  const d = await get(`/carriers/${dot}/docket-numbers`);
  console.log(`/carriers/${dot}/docket-numbers: HTTP ${d.status}`);
  console.log("  ", JSON.stringify(d.body).slice(0, 300));

  const m = JSON.stringify(d.body).match(/"docketNumber"\s*:\s*"?(\d+)/);
  const prefix = (JSON.stringify(d.body).match(/"prefix"\s*:\s*"(\w+)"/) || [, "MC"])[1];
  if (m) {
    const id = process.env.MOTUS_INSUR_DATASET || "c5y8-a4uz";
    const url = `https://data.transportation.gov/resource/${id}.json?$where=${encodeURIComponent(`docket_number='${prefix}${Number(m[1])}'`)}&$limit=5`;
    const r = await fetch(url, { headers: process.env.SOCRATA_APP_TOKEN ? { "X-App-Token": process.env.SOCRATA_APP_TOKEN } : {} });
    console.log(`Motus insurance ${id}: HTTP ${r.status}`);
    const rows = r.ok ? await r.json() : [];
    if (rows[0]) {
      console.log("  REAL COLUMNS:", Object.keys(rows[0]).join(", "));
      console.log("  sample row:", JSON.stringify(rows[0]));
      console.log("  -> compare with src/lib/fmcsa/motus-columns.json and fix any names that don't match.");
    } else console.log("  no rows (or column 'docket_number' is wrong; open the dataset page and check the column list)");
  }
}
