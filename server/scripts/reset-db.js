#!/usr/bin/env node
/**
 * CLI: Delete all app data (users, orgs, subscriptions, lines, permissions).
 * Keeps schema and plan_limits. Use for dev/testing to free up the DB.
 *
 * Usage: node scripts/reset-db.js
 * Or:    npm run reset-db   (from server/)
 *
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in server/.env
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import readline from "readline";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

async function confirm(rl, msg) {
  return new Promise((resolve) => {
    rl.question(msg, (answer) => {
      resolve((answer || "").trim().toLowerCase() === "y" || (answer || "").trim().toLowerCase() === "yes");
    });
  });
}

/** Delete all rows from table (Supabase: use .neq on id so every row matches). */
async function deleteAll(supabase, table) {
  const { error } = await supabase.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) throw new Error(`${table}: ${error.message}`);
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in server/.env");
    process.exit(1);
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ok = await confirm(rl, "Delete ALL users, organizations, subscriptions, lines, packages, subscribers, distributors and permissions? (y/n): ");
  rl.close();
  if (!ok) {
    console.log("Aborted.");
    process.exit(0);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Order: child tables first (FK), then parents
  const tables = [
    "account_permissions",
    "accounts",
    "lines",
    "packages",
    "subscribers",
    "distributors",
    "maps",
    "org_addons",
    "subscriptions",
    "employee_permissions",
    "org_users",
    "organizations",
  ];

  for (const table of tables) {
    try {
      await deleteAll(supabase, table);
      console.log("  Cleared:", table);
    } catch (e) {
      console.warn("  Warning:", e.message);
    }
  }

  console.log("Done. All users, organizations, subscriptions, lines and permissions have been deleted.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
