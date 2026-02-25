#!/usr/bin/env node
/**
 * Full reset of the HOSTED Supabase database (no Docker):
 * Drops public schema and re-runs all migrations from supabase/migrations/.
 *
 * Usage: npm run reset-db-remote   (from server/)
 * Or:    cd server && node scripts/reset-supabase-remote.js
 *
 * Requires: SUPABASE_DB_URL in server/.env (Postgres connection string from
 * Supabase Dashboard → Settings → Database → Connection string, e.g. Session mode).
 */
import pg from "pg";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import readline from "readline";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const { Client } = pg;

function ask(msg) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(msg, (answer) => {
      rl.close();
      resolve((answer || "").trim().toLowerCase());
    });
  });
}

async function main() {
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl || !dbUrl.startsWith("postgres")) {
    console.error("Missing SUPABASE_DB_URL in server/.env");
    console.error("Get it from: Supabase Dashboard → your project → Settings → Database → Connection string (URI).");
    console.error("Use the Session mode URI and replace [YOUR-PASSWORD] with your database password.");
    process.exit(1);
  }

  const answer = await ask("Reset REMOTE Supabase DB (drop schema + re-run all migrations)? Type 'yes' to continue: ");
  if (answer !== "yes") {
    console.log("Aborted.");
    process.exit(0);
  }

  const client = new Client({ connectionString: dbUrl });
  try {
    await client.connect();
    console.log("Connected to remote DB.");

    console.log("Dropping public schema...");
    await client.query(`
      DROP SCHEMA IF EXISTS public CASCADE;
      CREATE SCHEMA public;
      GRANT ALL ON SCHEMA public TO postgres;
      GRANT ALL ON SCHEMA public TO public;
    `);

    const migrationsDir = path.join(__dirname, "../../supabase/migrations");
    if (!fs.existsSync(migrationsDir)) {
      console.log("No supabase/migrations folder found. Schema cleared; run migrations manually if needed.");
      return;
    }

    const files = fs.readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, "utf8").trim();
      if (!sql) continue;
      console.log("  Running:", file);
      await client.query(sql);
    }

    console.log("Granting Supabase API roles access to public schema and tables...");
    await client.query(`
      GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
      GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
      GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    `);

    console.log("Done. Remote Supabase DB has been reset and all migrations applied.");
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
