#!/usr/bin/env node
/**
 * CLI: Cancel current plan — set subscription to expired. User data is kept; user cannot login until support renews.
 *
 * Usage: node cancel-plan.js <OadminUsername> <secretCode>
 *
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in server/.env
 */
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const SIX_DIGIT = /^[0-9]{6}$/;

function parseArgs() {
  const argv = process.argv.slice(2);
  if (argv.length < 2) {
    console.error("Usage: cancel-plan.js <OadminUsername> <secretCode>");
    console.error("  secretCode: 6-digit secret code for that Oadmin.");
    process.exit(1);
  }
  const [username, secretCode] = argv;
  if (!username?.trim()) {
    console.error("Oadmin username is required.");
    process.exit(1);
  }
  if (!SIX_DIGIT.test(String(secretCode ?? ""))) {
    console.error("Secret code must be exactly 6 digits.");
    process.exit(1);
  }
  return { username: username.trim(), secretCode: String(secretCode).trim() };
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in server/.env");
    process.exit(1);
  }

  const args = parseArgs();
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: account, error: accErr } = await supabase
    .from("accounts")
    .select("id, org_id, username, reset_code_hash, role")
    .ilike("username", args.username)
    .eq("role", "oadmin")
    .maybeSingle();

  if (accErr || !account) {
    console.error("Oadmin account not found or error:", accErr?.message || "not found");
    process.exit(1);
  }

  const validCode = await bcrypt.compare(args.secretCode, account.reset_code_hash || "");
  if (!validCode) {
    console.error("Invalid secret code.");
    process.exit(1);
  }

  const { data: sub, error: subErr } = await supabase
    .from("subscriptions")
    .select("id, org_id, plan, status, ends_at")
    .eq("org_id", account.org_id)
    .maybeSingle();

  if (subErr || !sub) {
    console.error("Subscription not found:", subErr?.message || "no subscription");
    process.exit(1);
  }

  const now = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from("subscriptions")
    .update({ status: "expired", ends_at: now, updated_at: now })
    .eq("id", sub.id);

  if (updateErr) {
    console.error("Failed to cancel subscription:", updateErr.message);
    process.exit(1);
  }

  console.log("\nتم إلغاء الاشتراك بنجاح.");
  console.log("  المستخدم:", account.username);
  console.log("  الحالة: منتهي — لا يمكن تسجيل الدخول حتى يتم التجديد من الدعم.");
  console.log("  جميع البيانات محفوظة.");
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
