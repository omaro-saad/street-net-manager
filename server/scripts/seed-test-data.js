#!/usr/bin/env node
/**
 * Seed test data: 200 items per entity for the test account (test / test).
 * Requires: test user created with pro plan (e.g. create-user.js test test 123456 pro yearly).
 * Run: npm run seed (from project root) or node scripts/seed-test-data.js (from server/).
 *
 * Usage: API_URL=http://localhost:3000 node scripts/seed-test-data.js
 *   Or:  node scripts/seed-test-data.js http://localhost:3000
 * Env: SEED_USER=test SEED_PASSWORD=test (defaults)
 */
const API_BASE = process.env.API_URL || process.argv[2] || "http://localhost:3000";
const USER = process.env.SEED_USER || "test";
const PASS = process.env.SEED_PASSWORD || "test";
const COUNT = 200;

function log(msg) {
  console.log(`[seed] ${msg}`);
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
  const res = await fetch(`${API_BASE}${path}`, opts);
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

async function seedLines(token) {
  log(`Creating ${COUNT} lines...`);
  for (let i = 1; i <= COUNT; i++) {
    await request("POST", "/api/lines", token, {
      name: `خط تجريبي ${i}`,
      address: `عنوان الخط ${i}`,
      active: true,
    });
    if (i % 50 === 0) log(`  lines ${i}/${COUNT}`);
  }
  log(`  lines ${COUNT}/${COUNT} done`);
}

async function seedPackages(token) {
  log(`Creating ${COUNT} packages (${COUNT / 2} subscriber + ${COUNT / 2} distributor)...`);
  for (let i = 1; i <= COUNT / 2; i++) {
    await request("POST", "/api/packages", token, {
      target: "subscriber",
      name: `باقة مشترك ${i}`,
      speed: "50 Mbps",
      price: 50 + i,
      validityMode: "days",
      timeValidityDays: 30,
    });
    await request("POST", "/api/packages", token, {
      target: "distributor",
      name: `باقة موزع ${i}`,
      cardPrice: 40 + i,
      cardSpeed: "100 Mbps",
      cardValidity: "30 يوم",
    });
    if (i % 50 === 0) log(`  packages ${i * 2}/${COUNT}`);
  }
  log(`  packages ${COUNT}/${COUNT} done`);
}

async function seedSubscribers(token, lines, packages) {
  const subPkgs = packages.filter((p) => p.target !== "distributor");
  if (!lines.length || !subPkgs.length) {
    log("Skip subscribers: need lines and subscriber packages");
    return;
  }
  log(`Creating ${COUNT} subscribers...`);
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const ts = Date.now();
  for (let i = 1; i <= COUNT; i++) {
    const line = lines[i % lines.length];
    const pkg = subPkgs[i % subPkgs.length];
    await request("POST", "/api/subscribers", token, {
      id: `seed-sub-${i}-${ts}`,
      name: `مشترك تجريبي ${i}`,
      phone: `0599${String(i).padStart(6, "0")}`,
      address1: `عنوان ${i}`,
      lineId: String(line.id),
      lineName: line.name || "",
      serviceId: String(pkg.id),
      serviceName: pkg.name || "",
      serviceValidityMode: "days",
      serviceDaysOption: "30 يوم",
      startAt: now - 10 * day,
      expiresAt: now + 20 * day,
      createdAt: now,
      updatedAt: now,
      status: "active",
    });
    if (i % 50 === 0) log(`  subscribers ${i}/${COUNT}`);
  }
  log(`  subscribers ${COUNT}/${COUNT} done`);
}

async function seedDistributors(token, lines) {
  log(`Creating ${COUNT} distributors...`);
  const lineIds = lines.length ? lines : [{ id: "none", name: "" }];
  const dts = Date.now();
  for (let i = 1; i <= COUNT; i++) {
    const line = lineIds[i % lineIds.length];
    await request("POST", "/api/distributors", token, {
      id: `seed-dist-${i}-${dts}`,
      name: `موزع تجريبي ${i}`,
      phone: `0598${String(i).padStart(6, "0")}`,
      address: `منطقة ${i}`,
      area: `منطقة ${i}`,
      lineId: line.id === "none" ? "" : String(line.id),
      lineName: line.name || "",
    });
    if (i % 50 === 0) log(`  distributors ${i}/${COUNT}`);
  }
  log(`  distributors ${COUNT}/${COUNT} done`);
}

async function seedEmployees(token) {
  log(`Creating ${COUNT} employees...`);
  const today = new Date().toISOString().slice(0, 10);
  const ets = Date.now();
  for (let i = 1; i <= COUNT; i++) {
    await request("POST", "/api/employees", token, {
      id: `seed-emp-${i}-${ets}`,
      name: `موظف تجريبي ${i}`,
      nationalId: String(1000000000 + i),
      phone: `0597${String(i).padStart(6, "0")}`,
      jobTitle: `وظيفة ${(i % 5) + 1}`,
      hireDate: today,
      employmentType: "دوام",
    });
    if (i % 50 === 0) log(`  employees ${i}/${COUNT}`);
  }
  log(`  employees ${COUNT}/${COUNT} done`);
}

async function seedInventory(token) {
  log("Creating inventory: 2 warehouses, 10 sections, 200 items...");
  const invRes = await request("GET", "/api/inventory", token);
  const existing = invRes.data || {};
  const warehouses = Array.isArray(existing.warehouses) ? [...existing.warehouses] : [];
  const sections = Array.isArray(existing.sections) ? [...existing.sections] : [];
  const items = Array.isArray(existing.items) ? [...existing.items] : [];

  const whIds = [];
  for (let i = 1; i <= 2; i++) {
    const id = `wh-seed-${i}-${Date.now()}`;
    whIds.push(id);
    warehouses.push({ id, name: `مخزن تجريبي ${i}`, location: `موقع ${i}` });
  }
  const secIds = [];
  for (let i = 1; i <= 10; i++) {
    const id = `sec-seed-${i}-${Date.now()}`;
    secIds.push(id);
    sections.push({
      id,
      warehouseId: whIds[i % 2],
      name: `قسم ${i}`,
    });
  }
  for (let i = 1; i <= COUNT; i++) {
    items.push({
      id: `item-seed-${i}-${Date.now()}`,
      warehouseId: whIds[i % 2],
      sectionId: secIds[i % 10],
      itemName: `صنف تجريبي ${i}`,
      typeName: "معدات",
      qty: (i % 20) + 1,
      price: 10 + (i % 50),
      note: `ملاحظة ${i}`,
    });
  }

  await request("PUT", "/api/inventory", token, {
    warehouses,
    sections,
    items,
  });
  log("  inventory done");
}

async function seedFinance(token) {
  log("Creating 200 manual invoices...");
  const finRes = await request("GET", "/api/finance", token);
  const kv = finRes.data && typeof finRes.data === "object" ? { ...finRes.data } : {};
  const manualInvoices = Array.isArray(kv.manualInvoices) ? [...kv.manualInvoices] : [];
  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);

  for (let i = 1; i <= COUNT; i++) {
    manualInvoices.push({
      id: `manual-seed-${i}-${now}`,
      type: i % 2 === 0 ? "دخل" : "مصروف",
      title: `فاتورة تجريبية ${i}`,
      amount: 100 + (i % 500),
      date: today,
      note: `ملاحظة ${i}`,
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

async function seedMaps(token, lines) {
  const lineList = lines.slice(0, 10);
  if (!lineList.length) {
    log("Skip maps: no lines");
    return;
  }
  log(`Creating map nodes for ${lineList.length} lines (20 nodes each = 200 total)...`);
  for (const line of lineList) {
    const lineId = String(line.id);
    let mapData = {};
    try {
      const res = await request("GET", `/api/maps/${encodeURIComponent(lineId)}`, token);
      if (res.data && typeof res.data === "object") mapData = { ...res.data };
    } catch {}

    const nodes = Array.isArray(mapData.nodes) ? [...mapData.nodes] : [];
    const edges = Array.isArray(mapData.edges) ? [...mapData.edges] : [];
    const base = nodes.length;
    for (let i = 1; i <= 20; i++) {
      const nid = `node-seed-${lineId}-${i}-${Date.now()}`;
      nodes.push(makeNode(nid, 100 + i * 80, 50 + (i % 5) * 60, `جهاز ${i}`));
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
  log(`API: ${API_BASE} | User: ${USER}`);
  const token = await login();

  await seedLines(token);
  const linesRes = await request("GET", "/api/lines", token);
  const lines = Array.isArray(linesRes.data) ? linesRes.data : [];

  await seedPackages(token);
  const pkgRes = await request("GET", "/api/packages", token);
  const packages = Array.isArray(pkgRes.data) ? pkgRes.data : [];

  await seedSubscribers(token, lines, packages);
  await seedDistributors(token, lines);
  await seedEmployees(token);
  await seedInventory(token);
  await seedFinance(token);
  await seedMaps(token, lines);

  log("Done. You can log in with: username = test, password = test, secret code = 123456");
}

main().catch((e) => {
  console.error("[seed] Error:", e.message);
  process.exit(1);
});
