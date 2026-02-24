#!/usr/bin/env node
/**
 * CLI: Create new organization with Oadmin + optional multiple Ousers.
 *
 * Usage (required): Oadmin only
 *   node create-user.js <OadminUsername> <OadminPassword> <secretCode> <plan> <duration>
 *
 * Usage (with one or more Ousers; each Ouser = 3 args: username, password, secretCode):
 *   node create-user.js <OadminUsername> <OadminPassword> <secretCode> <plan> <duration> [OuserUsername1 OuserPassword1 OuserSecretCode1] [OuserUsername2 OuserPassword2 OuserSecretCode2] ...
 *
 * Requirements: Oadmin username, Oadmin password, Oadmin secretCode (6 digits).
 * plan: basic | plus | pro
 * duration: monthly (30 days) | 3months (90 days) | yearly (365 days) | number = exact days | 0 = plan finished (renew required)
 * Oadmin can have more than one Ouser.
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

const SALT_ROUNDS = 10;
const PLANS = ["basic", "plus", "pro"];
const DURATION_PRESETS = ["monthly", "3months", "yearly"];
const SIX_DIGIT = /^[0-9]{6}$/;
const NUMERIC_DAYS = /^[1-9][0-9]{0,4}$/;

function parseArgs() {
  const argv = process.argv.slice(2);
  if (argv.length < 5) {
    console.error("Usage: create-user.js <OadminUsername> <OadminPassword> <secretCode> <plan> <duration> [OuserUser OuserPass OuserCode] ...");
    console.error("  secretCode: 6 digits");
    console.error("  plan: basic | plus | pro");
    console.error("  duration: monthly (30) | 3months (90) | yearly (365) | number of days | 0 = finished (renew required)");
    process.exit(1);
  }

  const oadminUsername = argv[0]?.trim();
  const oadminPassword = argv[1];
  const adminSecretCode = String(argv[2] ?? "").trim();
  const plan = (argv[3] ?? "").toLowerCase();
  const durationRaw = String(argv[4] ?? "").trim().toLowerCase();

  if (!oadminUsername) {
    console.error("Oadmin username is required.");
    process.exit(1);
  }
  if (!oadminPassword || oadminPassword.length < 4) {
    console.error("Oadmin password must be at least 4 characters.");
    process.exit(1);
  }
  if (!SIX_DIGIT.test(adminSecretCode)) {
    console.error("Oadmin secret code must be exactly 6 digits.");
    process.exit(1);
  }

  if (!PLANS.includes(plan)) {
    console.error("Plan must be one of: " + PLANS.join(", "));
    process.exit(1);
  }
  const isPreset = DURATION_PRESETS.includes(durationRaw);
  const isNumericDays = /^[0-9]{1,5}$/.test(durationRaw); // 0 = finished
  if (!isPreset && !isNumericDays) {
    console.error("Duration must be: monthly | 3months | yearly | or a number (0 = finished, 1-99999 = days).");
    process.exit(1);
  }

  const ousers = [];
  for (let i = 5; i + 2 < argv.length; i += 3) {
    const u = argv[i]?.trim();
    const p = argv[i + 1];
    const c = String(argv[i + 2] ?? "").trim();
    if (!u) break;
    if (!p || p.length < 4) {
      console.error("Ouser password must be at least 4 characters for Ouser:", u);
      process.exit(1);
    }
    if (!SIX_DIGIT.test(c)) {
      console.error("Ouser secret code must be exactly 6 digits for Ouser:", u);
      process.exit(1);
    }
    ousers.push({ username: u, password: p, secretCode: c });
  }

  return {
    oadminUsername,
    oadminPassword,
    adminSecretCode,
    plan,
    duration: durationRaw,
    durationRaw,
    isNumericDays,
    ousers,
  };
}

/** Add duration to start date. monthly=30, 3months=90, yearly=365. 0 = plan finished (ends_at = start). */
function addDuration(startDate, duration) {
  const d = new Date(startDate);
  const days =
    duration === "monthly"
      ? 30
      : duration === "3months"
        ? 90
        : duration === "yearly"
          ? 365
          : Number(duration);
  if (Number.isFinite(days) && days > 0) {
    d.setDate(d.getDate() + days);
    return d.toISOString();
  }
  return d.toISOString();
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

  const orgSlug = `org-${args.oadminUsername.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;
  const orgName = `منظمة ${args.oadminUsername}`;

  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .insert({ name: orgName, slug: orgSlug })
    .select("id")
    .single();

  if (orgErr) {
    console.error("Failed to create organization:", orgErr.message);
    process.exit(1);
  }

  const orgId = org.id;
  const startedAt = new Date().toISOString();
  const durationForEndsAt = args.isNumericDays ? args.durationRaw : args.duration;
  const endsAt = addDuration(startedAt, durationForEndsAt);
  const durationForDb = args.isNumericDays ? (args.durationRaw === "0" ? "monthly" : "monthly") : args.duration;
  const status = args.durationRaw === "0" ? "expired" : "active";

  const { error: subErr } = await supabase.from("subscriptions").insert({
    org_id: orgId,
    plan: args.plan,
    duration: durationForDb,
    status,
    started_at: startedAt,
    ends_at: endsAt,
  });

  if (subErr) {
    console.error("Failed to create subscription:", subErr.message);
    process.exit(1);
  }

  const adminPasswordHash = await bcrypt.hash(args.oadminPassword, SALT_ROUNDS);
  const adminResetCodeHash = await bcrypt.hash(args.adminSecretCode, SALT_ROUNDS);

  const { error: accErr } = await supabase.from("accounts").insert({
    org_id: orgId,
    username: args.oadminUsername,
    password_hash: adminPasswordHash,
    reset_code_hash: adminResetCodeHash,
    role: "oadmin",
    display_name: args.oadminUsername,
  });

  if (accErr) {
    console.error("Failed to create Oadmin account:", accErr.message);
    process.exit(1);
  }

  const ouserOutputs = [];
  for (const o of args.ousers) {
    const ouserPasswordHash = await bcrypt.hash(o.password, SALT_ROUNDS);
    const ouserResetCodeHash = await bcrypt.hash(o.secretCode, SALT_ROUNDS);
    const { error: ouserErr } = await supabase.from("accounts").insert({
      org_id: orgId,
      username: o.username,
      password_hash: ouserPasswordHash,
      reset_code_hash: ouserResetCodeHash,
      role: "ouser",
      display_name: o.username,
    });
    if (ouserErr) {
      console.error("Failed to create Ouser account:", o.username, ouserErr.message);
      process.exit(1);
    }
    ouserOutputs.push({ username: o.username, secretCode: o.secretCode });
  }
  if (args.ousers.length > 0) {
    const { error: addonErr } = await supabase.from("org_addons").insert({
      org_id: orgId,
      addon_key: "ouser",
    });
    if (addonErr) {
      console.warn("Note: org_addons insert failed (may already exist):", addonErr.message);
    }
  }

  // ——— Message to send to customer ———
  const durationLabel =
    args.durationRaw === "0"
      ? "منتهي — يلزم التجديد"
      : args.isNumericDays
        ? `${args.durationRaw} يوم`
        : { monthly: "شهري (٣٠ يوم)", "3months": "٣ أشهر (٩٠ يوم)", yearly: "سنوي (٣٦٥ يوم)" }[args.duration];
  const planLabel = { basic: "أساسي", plus: "بلس", pro: "برو" }[args.plan];

  console.log("\n" + "=".repeat(60));
  console.log("  تم إنشاء الحساب بنجاح. انسخ النص التالي لإرساله للمستخدم:");
  console.log("=".repeat(60));
  console.log(`
بيانات الدخول — مدير شبكتك

• المنظمة: ${orgName}
• الخطة: ${planLabel} (${args.plan}) — ${durationLabel}
• انتهاء الاشتراك: ${args.durationRaw === "0" ? "منتهي — تواصل مع الدعم للتجديد" : new Date(endsAt).toLocaleDateString("ar-EG", { dateStyle: "long" })}

—— مدير الحساب (Oadmin) ——
  اسم المستخدم: ${args.oadminUsername}
  كلمة المرور: (كما أدخلتها)
  رمز إعادة التعيين السري (٦ أرقام): ${args.adminSecretCode}
  احتفظ بهذا الرمز؛ يُستخدم مرة واحدة لإعادة تعيين كلمة المرور من الإعدادات.
`);

  for (const o of ouserOutputs) {
    console.log(`—— مستخدم إضافي (Ouser) ——
  اسم المستخدم: ${o.username}
  كلمة المرور: (كما أدخلتها)
  رمز إعادة التعيين السري (٦ أرقام): ${o.secretCode}
  مدير الحساب: ${args.oadminUsername}
`);
  }

  console.log("=".repeat(60));
  console.log("انتهى. احفظ الرموز السرية؛ لا يمكن استرجاعها من النظام.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
