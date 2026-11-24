#!/usr/bin/env node
// Home Assistant smoke test — requires HOME_ASSISTANT_URL and HOME_ASSISTANT_TOKEN
const url = process.env.HOME_ASSISTANT_URL;
const token = process.env.HOME_ASSISTANT_TOKEN;
if (!url || !token) { console.log("Set HOME_ASSISTANT_URL and HOME_ASSISTANT_TOKEN"); process.exit(0); }
async function main() {
  console.log("HA health", url);
  let res = await fetch(`${url.replace(/\/$/, "")}/api/`, { headers: { Authorization: `Bearer ${token}` } });
  console.log("api/", res.status, (await res.text()).slice(0, 800));
  res = await fetch(`${url.replace(/\/$/, "")}/api/states`, { headers: { Authorization: `Bearer ${token}` } });
  const text = await res.text();
  console.log("states", res.status, text.slice(0, 2000));
  try { const arr = JSON.parse(text); console.log(`Found ${arr.length} entities, sample:`, arr.slice(0, 2).map((e) => `${e.entity_id}:${e.state}`).join(", ")); } catch {}
}
main().catch((e) => { console.error(e); process.exit(1); });
