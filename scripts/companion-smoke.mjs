#!/usr/bin/env node
// Companion Bluetooth + audio smoke test — requires real Linux hardware and companion running.
// Usage: COMPANION_PAIRING_CODE=secret pnpm --prefix companion dev  # in one terminal
//        COMPANION_PAIRING_CODE=secret node scripts/companion-smoke.mjs
const base = "http://127.0.0.1:8787";
const code = process.env.COMPANION_PAIRING_CODE ?? "test-code";
async function main() {
  console.log("Checking companion status...");
  let res = await fetch(`${base}/status`);
  console.log("status", res.status, await res.text().then((t) => t.slice(0, 800)));
  console.log("\nPairing...");
  res = await fetch(`${base}/pair`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, tenantId: "test", userId: "test" }) });
  const pairText = await res.text();
  console.log("pair", res.status, pairText.slice(0, 800));
  let token = "";
  try { token = JSON.parse(pairText).token ?? ""; } catch {}
  if (!token) { console.log("No token — set COMPANION_PAIRING_CODE correctly"); process.exit(1); }
  const auth = { Authorization: `Bearer ${token}` };
  console.log("\nDiscover devices...");
  res = await fetch(`${base}/devices/discover`, { method: "POST", headers: auth });
  console.log("discover", res.status, (await res.text()).slice(0, 2000));
  console.log("\nAudio sinks...");
  res = await fetch(`${base}/audio/sinks`, { headers: auth });
  console.log("sinks", res.status, (await res.text()).slice(0, 3000));
  console.log("\nTest tone (if sink available)...");
  res = await fetch(`${base}/audio/test-tone`, { method: "POST", headers: { "Content-Type": "application/json", ...auth }, body: JSON.stringify({}) });
  console.log("test-tone", res.status, (await res.text()).slice(0, 1000));
  console.log("\nDone — check that sink verification shows ok:true and you heard audio via selected device.");
}
main().catch((e) => { console.error(e); process.exit(1); });
