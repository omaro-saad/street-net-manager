#!/usr/bin/env node
/**
 * CLI: Renew (or replace) user plan. If a live plan is running, replaces it with the new plan (with warning).
 *
 * Usage: node renew-subscription.js <OadminUsername> <secretCode> <plan> <duration>
 *
 * plan: basic | plus | pro
 * duration: monthly (30 days) | 3months (90 days) | yearly (365 days) | or number = days (e.g. 30, 90)
 * Days: monthly=30, 3months=90, yearly=365 (count from 30 not 29).
 *
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in server/.env
 */
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import readline from "readline";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const SIX_DIGIT = /^[0-9]{6}$/;
const PLANS = ["basic", "plus", "pro"];
const DURATION_PRESETS = ["monthly", "3months", "yearly"];
const NUMERIC_DAYS = /^[0-9]{1,5}$/;

function parseArgs() {
  const argv = process.argv.slice(2);
  if (argv.length < 4) {
    console.error("Usage: renew-subscription.js <OadminUsername> <secretCode> <plan> <duration>");
    console.error("  plan: basic | plus | pro");
    console.error("  duration: monthly (30) | 3months (90) | yearly (365) | or number of days");
    process.exit(1);
  }
  const [username, secretCode, plan, duration] = argv;
  if (!username?.trim()) {
    console.error("Oadmin username is required.");
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
  const isNumericDays = NUMERIC_DAYS.test(dRaw);
  if (!isPreset && !isNumericDays) {
    console.error("Duration must be: monthly | 3months | yearly | or a number (days).");
    process.exit(1);
  }
  return {
    username: username.trim(),
    secretCode: String(secretCode).trim(),
    plan: p,
    durationRaw: dRaw,
    isNumericDays,
  };
}

function daysFromDuration(durationRaw, isNumericDays) {
  if (isNumericDays) {
    const n = Number(durationRaw);
    return Number.isFinite(n) && n >= 0 ? n : 30;
  }
  return durationRaw === "monthly" ? 30 : durationRaw === "3months" ? 90 : durationRaw === "yearly" ? 365 : 30;
}

function addDays(startDate, days) {
  const d = new Date(startDate);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function confirm(rl, message) {
  return new Promise((resolve) => {
    rl.question(message, (answer) => {
      resolve(/^y|yes|نعم$/i.test(String(answer).trim()));
    });
  });
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
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

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

  const now = new Date();
  const nowISO = now.toISOString();
  const isLive = sub.status === "active" && sub.ends_at && new Date(sub.ends_at) > now;
  if (isLive) {
    console.log("\nتحذير: يوجد اشتراك فعّال حالياً. سيتم استبداله بالخطة الجديدة.");
    const ok = await confirm(rl, "متابعة؟ (y/n): ");
    rl.close();
    if (!ok) {
      console.log("تم الإلغاء.");
      process.exit(0);
    }
  } else {
    rl.close();
  }

  const days = daysFromDuration(args.durationRaw, args.isNumericDays);
  const newEndsAt = addDays(nowISO, days);
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
