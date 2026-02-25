#!/usr/bin/env node
/**
 * CLI: Extend an Oadmin's subscription by a duration.
 *
 * Usage: node extend-subscription.js <OadminUsername> <secretCode> <newDuration>
 *
 * newDuration: monthly (30 days) | 3months (90 days) | yearly (365 days) | or a number = exact days (e.g. 30, 90)
 *
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in server/.env
 */
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { addDurationDays, durationToDays } from "../lib/subscription.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const SIX_DIGIT = /^[0-9]{6}$/;
const DURATION_PRESETS = ["monthly", "3months", "yearly"];
const NUMERIC_DAYS = /^[1-9][0-9]{0,4}$/;

function parseArgs() {
  const argv = process.argv.slice(2);
  if (argv.length < 3) {
    console.error("Usage: extend-subscription.js <OadminUsername> <secretCode> <newDuration>");
    console.error("  newDuration: monthly | 3months | yearly | or number of days (e.g. 30, 90)");
    process.exit(1);
  }
  const [username, secretCode, newDuration] = argv;
  if (!username?.trim()) {
    console.error("Oadmin username is required.");
    process.exit(1);
  }
  if (!SIX_DIGIT.test(String(secretCode ?? ""))) {
    console.error("Secret code must be exactly 6 digits.");
    process.exit(1);
  }
  const dRaw = String(newDuration ?? "").trim().toLowerCase();
  const isPreset = DURATION_PRESETS.includes(dRaw);
  const isNumericDays = NUMERIC_DAYS.test(dRaw);
  if (!isPreset && !isNumericDays) {
    console.error("newDuration must be: monthly | 3months | yearly | or a number (1-99999) for days.");
    process.exit(1);
  }
  return {
    username: username.trim(),
    secretCode: String(secretCode).trim(),
    newDurationRaw: dRaw,
    isNumericDays,
  };
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
    .select("id, org_id, plan, duration, status, started_at, ends_at")
    .eq("org_id", account.org_id)
    .maybeSingle();

  if (subErr || !sub) {
    console.error("Subscription not found:", subErr?.message || "no subscription");
    process.exit(1);
  }

  const fromDate = sub.ends_at && new Date(sub.ends_at) > new Date() ? sub.ends_at : new Date().toISOString();
  const days = durationToDays(args.newDurationRaw);
  const newEndsAt = days > 0 ? addDurationDays(fromDate, days) : fromDate;

  const { error: updateErr } = await supabase
    .from("subscriptions")
    .update({ ends_at: newEndsAt, updated_at: new Date().toISOString() })
    .eq("id", sub.id);

  if (updateErr) {
    console.error("Failed to extend subscription:", updateErr.message);
    process.exit(1);
  }

  const durationLabel = args.isNumericDays
    ? `${args.newDurationRaw} يوم`
    : { monthly: "30 يوم", "3months": "90 يوم", yearly: "365 يوم" }[args.newDurationRaw];
  console.log("\nتم تمديد الاشتراك بنجاح.");
  console.log("  المستخدم:", account.username);
  console.log("  المدة المضافة:", durationLabel);
  console.log("  انتهاء الاشتراك الجديد:", new Date(newEndsAt).toLocaleDateString("ar-EG", { dateStyle: "long" }));
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
