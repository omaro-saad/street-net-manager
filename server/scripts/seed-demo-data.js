#!/usr/bin/env node
/**
 * Seed demo data for one org:
 * - Login as Oadmin
 * - (Optional) delete all org data (keeps accounts)
 * - Create 5 Ousers
 * - Create 200 records for each entity (lines, packages, subscribers, distributors, employees)
 * - Inventory: 2 warehouses, 10 sections, 200 items
 * - Finance: 200 manual invoices
 * - Maps: 10 lines, 20 nodes each (200 total)
 *
 * Usage (from server/): npm run seed-demo
 *   Uses server/.env PORT so the seed connects to the same port as the API.
 *   If API fails to start (EADDRINUSE), set PORT=4000 in server/.env and restart the server.
 *
 * Options:
 *   API_URL              override base URL (default: http://localhost:${PORT from .env or 4000})
 *   SEED_COUNT=200       (default 200)
 *   SEED_OUSERS=5        (default 5)
 *   SEED_RESET=1         delete all org data before seeding (admin only)
 *   SEED_PREFIX=demo     usernames prefix for ousers
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const PORT = Number(process.env.PORT) || 4000;
const API_BASE = process.env.API_URL || process.argv[2] || `http://localhost:${PORT}`;
const USER = process.env.SEED_USER || "admin";
const PASS = process.env.SEED_PASSWORD || "admin";
const COUNT = Number(process.env.SEED_COUNT || 200);
const OUSER_COUNT = Number(process.env.SEED_OUSERS || 5);
const RESET = String(process.env.SEED_RESET || "").trim() === "1";
const PREFIX = String(process.env.SEED_PREFIX || "demo").trim() || "demo";

function log(msg) {
  console.log(`[seed-demo] ${msg}`);
}

function randInt(min, max) {
  const a = Math.ceil(min);
  const b = Math.floor(max);
  return Math.floor(a + Math.random() * (b - a + 1));
}

function randPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function makePassword(len = 10) {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[randInt(0, chars.length - 1)];
  return s;
}

async function request(method, path, token, body = null) {
  const opts = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
  if (body != null) opts.body = JSON.stringify(body);
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, opts);
  } catch (e) {
    throw new Error(
      `Cannot connect to API at ${API_BASE}. Is the server running? Start it with: cd server && npm run dev`
    );
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || res.statusText || `HTTP ${res.status}`);
  return data;
}

async function login() {
  const data = await request("POST", "/api/auth/login", null, { username: USER, password: PASS });
  if (!data.token) throw new Error("No token in login response");
  log(`Logged in as ${USER}`);
  return data.token;
}

/** Get plan limits and current usage from /me. Used to cap seed counts per plan. */
async function getLimitsAndUsage(token) {
  const me = await request("GET", "/api/auth/me", token);
  const limits = me.limits || {};
  const usage = me.usage || {};
  const plan = me.subscription?.plan || "basic";
  log(`Plan: ${plan} | limits: lines=${limits.lines ?? "∞"}, subscribers=${limits.subscribers ?? "∞"}, distributors=${limits.distributors ?? "∞"}, employees=${limits.employees ?? "∞"}, packagesSubscriber=${limits.packagesSubscriber ?? "∞"}, packagesDistributor=${limits.packagesDistributor ?? "∞"}, financeManual=${limits.financeManual ?? "∞"}, devicesStores=${limits.devicesStores ?? "∞"}, mapNodesPerLine=${limits.mapNodesPerLine ?? "∞"}`);
  return { limits, usage };
}

/** How many items we can create: min(COUNT, remaining quota). limitKey and usageKey usually match (e.g. "lines"). */
function effectiveCount(limits, usage, limitKey, usageKey, defaultMax = COUNT) {
  const limit = limits[limitKey];
  if (limit == null || limit === -1) return defaultMax;
  const used = Number(usage[usageKey] ?? 0) || 0;
  const remaining = Math.max(0, Number(limit) - used);
  return Math.min(defaultMax, remaining);
}

async function resetOrgData(token) {
  log("Deleting all org data (keeps accounts)...");
  await request("POST", "/api/data/delete-all", token, {});
  log("  delete-all done");
}

async function createOusers(token) {
  log(`Creating ${OUSER_COUNT} ousers...`);
  const out = [];
  const ts = Date.now();
  for (let i = 1; i <= OUSER_COUNT; i++) {
    const username = `${PREFIX}_ouser_${i}_${String(ts).slice(-5)}`;
    const password = makePassword(10);
    const displayName = `مستخدم ${i}`;
    const res = await request("POST", "/api/auth/users", token, { username, password, role: "ouser", displayName });
    out.push({
      username,
      password,
      secretCode: res.resetCode,
      userId: res.user?.id,
      publicId: res.user?.publicId ?? null,
    });
    if (i % 5 === 0) log(`  ousers ${i}/${OUSER_COUNT}`);
  }
  log("  ousers done");
  return out;
}

async function seedLines(token, n = COUNT) {
  if (n <= 0) {
    log("Skip lines: limit reached.");
    return;
  }
  log(`Creating ${n} lines...`);
  for (let i = 1; i <= n; i++) {
    await request("POST", "/api/lines", token, {
      name: `خط ${i}`,
      address: `شارع ${randInt(1, 40)} - منطقة ${randInt(1, 20)}`,
      active: i % 17 !== 0,
    });
    if (i % 50 === 0) log(`  lines ${i}/${n}`);
  }
  log("  lines done");
}

async function seedPackages(token, nSub = Math.floor(COUNT / 2), nDist = Math.floor(COUNT / 2)) {
  const total = nSub + nDist;
  if (total <= 0) {
    log("Skip packages: limit reached.");
    return;
  }
  log(`Creating ${total} packages (${nSub} subscriber + ${nDist} distributor)...`);
  const speeds = ["10 Mbps", "20 Mbps", "50 Mbps", "100 Mbps", "200 Mbps"];
  const validityDays = [7, 15, 30, 45, 60, 90];
  for (let i = 1; i <= nSub; i++) {
    await request("POST", "/api/packages", token, {
      target: "subscriber",
      name: `باقة مشترك ${i}`,
      speed: randPick(speeds),
      price: 30 + (i % 120),
      validityMode: "days",
      timeValidityDays: randPick(validityDays),
    });
    if (i % 50 === 0) log(`  packages subscriber ${i}/${nSub}`);
  }
  for (let i = 1; i <= nDist; i++) {
    await request("POST", "/api/packages", token, {
      target: "distributor",
      name: `باقة موزع ${i}`,
      cardPrice: 20 + (i % 100),
      cardSpeed: randPick(speeds),
      cardValidity: `${randPick(validityDays)} يوم`,
    });
    if (i % 50 === 0) log(`  packages distributor ${i}/${nDist}`);
  }
  log("  packages done");
}

async function seedSubscribers(token, lines, packages, n = COUNT) {
  const subPkgs = packages.filter((p) => p.target !== "distributor");
  if (!lines.length || !subPkgs.length) {
    log("Skip subscribers: need lines and subscriber packages");
    return;
  }
  if (n <= 0) {
    log("Skip subscribers: limit reached.");
    return;
  }
  log(`Creating ${n} subscribers...`);
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const ts = Date.now();
  const statuses = ["active", "active", "active", "inactive", "suspended"];
  for (let i = 1; i <= n; i++) {
    const line = lines[i % lines.length];
    const pkg = subPkgs[i % subPkgs.length];
    const startOffset = randInt(1, 60);
    const duration = randInt(7, 90);
    await request("POST", "/api/subscribers", token, {
      id: `seed-sub-${i}-${ts}`,
      name: `مشترك ${i}`,
      phone: `0599${String(randInt(0, 999999)).padStart(6, "0")}`,
      address1: `بيت ${randInt(1, 200)} - شارع ${randInt(1, 80)}`,
      lineId: String(line.id),
      lineName: line.name || "",
      serviceId: String(pkg.id),
      serviceName: pkg.name || "",
      serviceValidityMode: "days",
      serviceDaysOption: "30 يوم",
      startAt: now - startOffset * day,
      expiresAt: now + duration * day,
      createdAt: now - randInt(0, 2000000),
      updatedAt: now,
      status: randPick(statuses),
    });
    if (i % 50 === 0) log(`  subscribers ${i}/${n}`);
  }
  log("  subscribers done");
}

async function seedDistributors(token, lines, n = COUNT) {
  if (n <= 0) {
    log("Skip distributors: limit reached.");
    return;
  }
  log(`Creating ${n} distributors...`);
  const lineIds = lines.length ? lines : [{ id: "none", name: "" }];
  const ts = Date.now();
  for (let i = 1; i <= n; i++) {
    const line = lineIds[i % lineIds.length];
    await request("POST", "/api/distributors", token, {
      id: `seed-dist-${i}-${ts}`,
      name: `موزع ${i}`,
      phone: `0598${String(randInt(0, 999999)).padStart(6, "0")}`,
      address: `منطقة ${randInt(1, 30)} - حارة ${randInt(1, 50)}`,
      area: `منطقة ${randInt(1, 30)}`,
      lineId: line.id === "none" ? "" : String(line.id),
      lineName: line.name || "",
    });
    if (i % 50 === 0) log(`  distributors ${i}/${n}`);
  }
  log("  distributors done");
}

async function seedEmployees(token, n = COUNT) {
  if (n <= 0) {
    log("Skip employees: limit reached.");
    return;
  }
  log(`Creating ${n} employees...`);
  const today = new Date().toISOString().slice(0, 10);
  const ts = Date.now();
  const roles = ["فني", "محاسب", "موظف", "مبيعات", "دعم"];
  const types = ["دوام", "جزئي", "عقد"];
  for (let i = 1; i <= n; i++) {
    await request("POST", "/api/employees", token, {
      id: `seed-emp-${i}-${ts}`,
      name: `موظف ${i}`,
      nationalId: String(1000000000 + randInt(1, 999999999)),
      phone: `0597${String(randInt(0, 999999)).padStart(6, "0")}`,
      jobTitle: randPick(roles),
      hireDate: today,
      employmentType: randPick(types),
    });
    if (i % 50 === 0) log(`  employees ${i}/${n}`);
  }
  log("  employees done");
}

async function seedInventory(token, maxWarehouses = 2, maxItems = COUNT) {
  const invRes = await request("GET", "/api/inventory", token);
  const existing = invRes.data || {};
  const warehouses = Array.isArray(existing.warehouses) ? [...existing.warehouses] : [];
  const sections = Array.isArray(existing.sections) ? [...existing.sections] : [];
  const items = Array.isArray(existing.items) ? [...existing.items] : [];

  if (maxWarehouses <= 0) {
    log("Skip inventory: devicesStores limit reached.");
    return;
  }
  log(`Creating inventory: ${maxWarehouses} warehouses, 10 sections, ${maxItems} items...`);
  const whIds = [];
  for (let i = 1; i <= maxWarehouses; i++) {
    const id = `wh-seed-${i}-${Date.now()}`;
    whIds.push(id);
    warehouses.push({ id, name: `مخزن ${i}`, location: `موقع ${randInt(1, 10)}` });
  }
  const secIds = [];
  for (let i = 1; i <= 10; i++) {
    const id = `sec-seed-${i}-${Date.now()}`;
    secIds.push(id);
    sections.push({
      id,
      warehouseId: whIds[(i - 1) % whIds.length],
      name: `قسم ${i}`,
    });
  }

  const types = ["راوتر", "سويتش", "كابل", "أنتينا", "مزود طاقة"];
  for (let i = 1; i <= COUNT; i++) {
    items.push({
      id: `item-seed-${i}-${Date.now()}`,
      warehouseId: whIds[(i - 1) % whIds.length],
      sectionId: secIds[(i - 1) % secIds.length],
      itemName: `صنف ${i}`,
      typeName: randPick(types),
      qty: randInt(1, 25),
      price: randInt(5, 300),
      note: `ملاحظة ${randInt(1, 999)}`,
    });
  }

  await request("PUT", "/api/inventory", token, {
    warehouses,
    sections,
    items,
  });
  log("  inventory done");
}

async function seedFinance(token, n = COUNT) {
  if (n <= 0) {
    log("Skip finance: limit reached.");
    return;
  }
  log(`Creating ${n} manual invoices...`);
  const finRes = await request("GET", "/api/finance", token);
  const kv = finRes.data && typeof finRes.data === "object" ? { ...finRes.data } : {};
  const manualInvoices = Array.isArray(kv.manualInvoices) ? [...kv.manualInvoices] : [];
  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);

  for (let i = 1; i <= n; i++) {
    manualInvoices.push({
      id: `manual-seed-${i}-${now}`,
      type: i % 3 === 0 ? "مصروف" : "دخل",
      title: `فاتورة ${i}`,
      amount: randInt(10, 3000),
      date: today,
      note: `تفاصيل ${randInt(1, 9999)}`,
      createdAt: now - (COUNT - i) * 1000,
    });
  }
  kv.manualInvoices = manualInvoices;
  await request("PUT", "/api/finance", token, kv);
  log("  finance done");
}

function makeNode(id, x, y, label) {
  return {
    id,
    type: "default",
    position: { x, y },
    data: { label: label || id },
  };
}

function makeEdge(id, source, target) {
  return { id, source, target };
}

async function seedMaps(token, lines, nodesPerLine = 20) {
  const lineList = lines.slice(0, 10);
  if (!lineList.length) {
    log("Skip maps: no lines");
    return;
  }
  if (nodesPerLine <= 0) {
    log("Skip maps: mapNodesPerLine limit is 0.");
    return;
  }
  log(`Creating map nodes for ${lineList.length} lines (${nodesPerLine} nodes each)...`);
  for (const line of lineList) {
    const lineId = String(line.id);
    let mapData = {};
    try {
      const res = await request("GET", `/api/maps/${encodeURIComponent(lineId)}`, token);
      if (res.data && typeof res.data === "object") mapData = { ...res.data };
    } catch {}

    const nodes = Array.isArray(mapData.nodes) ? [...mapData.nodes] : [];
    const edges = Array.isArray(mapData.edges) ? [...mapData.edges] : [];
    for (let i = 1; i <= nodesPerLine; i++) {
      const nid = `node-seed-${lineId}-${i}-${Date.now()}`;
      nodes.push(makeNode(nid, 120 + i * 80, 60 + (i % 5) * 70, `جهاز ${i}`));
      if (i > 1) {
        const prev = nodes[nodes.length - 2].id;
        edges.push(makeEdge(`e-${prev}-${nid}`, prev, nid));
      }
    }
    await request("PUT", `/api/maps/${encodeURIComponent(lineId)}`, token, {
      ...mapData,
      nodes,
      edges,
      viewport: mapData.viewport || { x: 0, y: 0, zoom: 1 },
    });
  }
  log("  maps done");
}

async function main() {
  log(`API: ${API_BASE} | Admin: ${USER} | count=${COUNT} | ousers=${OUSER_COUNT} | reset=${RESET ? "yes" : "no"}`);
  const token = await login();

  if (RESET) await resetOrgData(token);

  const { limits, usage } = await getLimitsAndUsage(token);

  const nLines = effectiveCount(limits, usage, "lines", "lines");
  const nSubPkg = effectiveCount(limits, usage, "packagesSubscriber", "packagesSubscriber");
  const nDistPkg = effectiveCount(limits, usage, "packagesDistributor", "packagesDistributor");
  const nSubscribers = effectiveCount(limits, usage, "subscribers", "subscribers");
  const nDistributors = effectiveCount(limits, usage, "distributors", "distributors");
  const nEmployees = effectiveCount(limits, usage, "employees", "employees");
  const nFinance = effectiveCount(limits, usage, "financeManual", "financeManual");
  const nWarehouses = effectiveCount(limits, usage, "devicesStores", "devicesStores", 2);
  const mapNodesPerLine = limits.mapNodesPerLine != null && limits.mapNodesPerLine !== -1
    ? Math.min(20, Number(limits.mapNodesPerLine) || 0)
    : 20;

  const ousers = await createOusers(token);

  await seedLines(token, nLines);
  const linesRes = await request("GET", "/api/lines", token);
  const lines = Array.isArray(linesRes.data) ? linesRes.data : [];

  await seedPackages(token, nSubPkg, nDistPkg);
  const pkgRes = await request("GET", "/api/packages", token);
  const packages = Array.isArray(pkgRes.data) ? pkgRes.data : [];

  await seedSubscribers(token, lines, packages, nSubscribers);
  await seedDistributors(token, lines, nDistributors);
  await seedEmployees(token, nEmployees);
  await seedInventory(token, nWarehouses, COUNT);
  await seedFinance(token, nFinance);
  await seedMaps(token, lines, mapNodesPerLine);

  log("Done.");
  console.log("\n=== Created Ousers (send to customer / keep private) ===");
  for (const u of ousers) {
    console.log(`- ${u.username} | pass: ${u.password} | secretCode: ${u.secretCode} | publicId: ${u.publicId ?? "—"}`);
  }
  console.log("=======================================================\n");
}

main().catch((e) => {
  console.error("[seed-demo] Error:", e?.message || e);
  process.exit(1);
});

