#!/usr/bin/env node
/**
 * CLI: Renew plan with Oadmin username + password + secret code.
 * Validates credentials and secret code, then renews/reactivates subscription.
 *
 * Usage: node renew-plan.js <OadminUsername> <OadminPassword> <secretCode> <plan> <duration>
 *
 * plan: basic | plus | pro
 * duration: monthly (30 days) | 3months (90 days) | yearly (365 days) | or number of days
 * Uses exact 24h days: 30 days = 30 full days remaining at start.
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
const PLANS = ["basic", "plus", "pro"];
const DURATION_PRESETS = ["monthly", "3months", "yearly"];

function parseArgs() {
  const argv = process.argv.slice(2);
  if (argv.length < 5) {
    console.error("Usage: renew-plan.js <OadminUsername> <OadminPassword> <secretCode> <plan> <duration>");
    console.error("  Validates Oadmin password + secret code, then renews subscription.");
    console.error("  plan: basic | plus | pro");
    console.error("  duration: monthly (30) | 3months (90) | yearly (365) | or number of days");
    process.exit(1);
  }
  const [username, password, secretCode, plan, duration] = argv;
  if (!username?.trim()) {
    console.error("Oadmin username is required.");
    process.exit(1);
  }
  if (!password || String(password).length < 4) {
    console.error("Oadmin password must be at least 4 characters.");
    process.exit(1);
  }
  if (!SIX_DIGIT.test(String(secretCode ?? ""))) {
    console.error("Secret code must be exactly 6 digits.");
    process.exit(1);
  }
  const p = (plan ?? "").toLowerCase();
  const dRaw = String(duration ?? "").trim().toLowerCase();
  if (!PLANS.includes(p)) {
    console.error("Plan must be one of: " + PLANS.join(", "));
    process.exit(1);
  }
  const isPreset = DURATION_PRESETS.includes(dRaw);
  const isNumericDays = /^[0-9]{1,5}$/.test(dRaw);
  if (!isPreset && !isNumericDays) {
    console.error("Duration must be: monthly | 3months | yearly | or a number (days).");
    process.exit(1);
  }
  return {
    username: username.trim(),
    password: String(password),
    secretCode: String(secretCode).trim(),
    plan: p,
    durationRaw: dRaw,
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
    .select("id, org_id, username, password_hash, reset_code_hash, role")
    .ilike("username", args.username)
    .eq("role", "oadmin")
    .maybeSingle();

  if (accErr || !account) {
    console.error("Oadmin account not found or error:", accErr?.message || "not found");
    process.exit(1);
  }

  const validPassword = await bcrypt.compare(args.password, account.password_hash || "");
  if (!validPassword) {
    console.error("Invalid password.");
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

  const nowISO = new Date().toISOString();
  const days = durationToDays(args.durationRaw);
  const newEndsAt = days > 0 ? addDurationDays(nowISO, days) : nowISO;
  const durationForDb = args.isNumericDays ? "monthly" : args.durationRaw;

  const { error: updateErr } = await supabase
    .from("subscriptions")
    .update({
      plan: args.plan,
      duration: durationForDb,
      status: "active",
      started_at: nowISO,
      ends_at: newEndsAt,
      updated_at: nowISO,
    })
    .eq("id", sub.id);

  if (updateErr) {
    console.error("Failed to renew subscription:", updateErr.message);
    process.exit(1);
  }

  const durationLabel = args.isNumericDays ? `${days} يوم` : { monthly: "30 يوم", "3months": "90 يوم", yearly: "365 يوم" }[args.durationRaw];
  const planLabel = { basic: "أساسي", plus: "بلس", pro: "برو" }[args.plan];
  console.log("\nتم تجديد الاشتراك بنجاح.");
  console.log("  المستخدم:", account.username);
  console.log("  الخطة:", planLabel, "(" + args.plan + ") —", durationLabel);
  console.log("  انتهاء الاشتراك:", new Date(newEndsAt).toLocaleDateString("ar-EG", { dateStyle: "long" }));
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
