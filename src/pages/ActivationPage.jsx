// ActivationPage.jsx
import { useEffect, useMemo, useState } from "react";

function Card({ children }) {
  return (
    <div
      style={{
        width: "min(560px, 92vw)",
        background: "#fff",
        borderRadius: "22px",
        padding: "22px",
        boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
        border: "1px solid #eef2f7",
      }}
    >
      {children}
    </div>
  );
}

/**
 * ✅ يقبل:
 * 1) Activation Code: "SNM1.<payloadB64url>.<sigB64url>"
 * 2) (اختياري) JSON القديم كـ fallback
 */
function parseActivationInput(input) {
  const raw = String(input || "").trim();

  // Try Activation Code first
  if (raw.startsWith("SNM1.")) {
    const parts = raw.split(".");
    if (parts.length !== 3) throw new Error("صيغة الكود غير صحيحة (SNM1.<payload>.<sig>)");

    const payloadB64u = parts[1];
    const sigB64u = parts[2];

    const payloadJson = base64UrlToUtf8(payloadB64u);
    const payload = JSON.parse(payloadJson);

    // we keep sig as base64 (not url) because backend expects base64
    const sigB64 = base64UrlToBase64(sigB64u);

    return { payload, sig: sigB64 };
  }

  // Fallback: JSON
  if (raw.startsWith("{")) {
    const obj = JSON.parse(raw);
    if (!obj?.payload || !obj?.sig) throw new Error("JSON لازم يحتوي payload و sig");
    return obj;
  }

  throw new Error("الصق كود التفعيل (SNM1...) أو JSON كامل");
}

// --- helpers ---
function base64UrlToBase64(b64url) {
  let s = String(b64url).replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return s;
}

function base64UrlToUtf8(b64url) {
  const b64 = base64UrlToBase64(b64url);
  const binStr = atob(b64);
  const bytes = Uint8Array.from(binStr, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export default function ActivationPage({ onActivated }) {
  const [deviceCode, setDeviceCode] = useState("");
  const [activationCode, setActivationCode] = useState("");
  const [status, setStatus] = useState({ type: "idle", msg: "" });

  const canUseApi = useMemo(() => typeof window !== "undefined" && window.api?.license, []);

  useEffect(() => {
    (async () => {
      try {
        if (!canUseApi) {
          setStatus({ type: "err", msg: "License API not available (preload missing)." });
          return;
        }
        const code = await window.api.license.getDeviceCode();
        setDeviceCode(code || "");
      } catch (e) {
        setStatus({ type: "err", msg: String(e?.message || e) });
      }
    })();
  }, [canUseApi]);

  async function handleActivate() {
    setStatus({ type: "loading", msg: "جارٍ التحقق..." });
    try {
      const obj = parseActivationInput(activationCode);
      const res = await window.api.license.activate(obj);

      if (res?.ok) {
        setStatus({ type: "ok", msg: "تم التفعيل بنجاح ✅" });
        setTimeout(() => onActivated?.(), 400);
      } else {
        const extra = res?.details ? `\n${res.details}` : "";
        setStatus({ type: "err", msg: `فشل التفعيل: ${res?.error || "UNKNOWN"}${extra}` });
      }
    } catch (e) {
      setStatus({ type: "err", msg: `كود غير صالح: ${String(e?.message || e)}` });
    }
  }

  function copy() {
    navigator.clipboard?.writeText(deviceCode || "");
    setStatus({ type: "ok", msg: "تم نسخ Device Code ✅" });
    setTimeout(() => setStatus({ type: "idle", msg: "" }), 900);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#0b1220",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "28px",
        direction: "rtl",
        fontFamily: "Tajawal, system-ui, sans-serif",
      }}
    >
      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>تفعيل النسخة</div>
            <div style={{ marginTop: 6, fontSize: 14, color: "#475569" }}>
              انسخ Device Code وأرسله للمطوّر. ثم الصق “كود التفعيل” هنا.
            </div>
          </div>

          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background: "linear-gradient(135deg,#6366f1,#a855f7)",
            }}
          />
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>Device Code</div>

          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 14,
              padding: "12px 12px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                fontSize: 14,
                color: "#0f172a",
                flex: 1,
              }}
            >
              {deviceCode || "..."}
            </div>
            <button
              onClick={copy}
              style={{
                border: "1px solid #cbd5e1",
                background: "#fff",
                borderRadius: 12,
                padding: "10px 12px",
                cursor: "pointer",
                fontWeight: 800,
              }}
            >
              نسخ
            </button>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>
            Activation Code
          </div>

          <input
            value={activationCode}
            onChange={(e) => setActivationCode(e.target.value)}
            placeholder="SNM1.XXXX.YYYY"
            style={{
              width: "100%",
              height: 48,
              borderRadius: 14,
              border: "1px solid #e2e8f0",
              padding: "0 12px",
              background: "#fff",
              outline: "none",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              fontSize: 13,
              direction: "ltr",
            }}
          />

          <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>
            الصيغة: <span style={{ direction: "ltr", unicodeBidi: "plaintext" }}>SNM1.&lt;PAYLOAD&gt;.&lt;SIG&gt;</span>
          </div>
        </div>

        <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            onClick={handleActivate}
            disabled={!activationCode || status.type === "loading"}
            style={{
              border: "none",
              background: "#2563eb",
              color: "#fff",
              borderRadius: 14,
              padding: "12px 16px",
              cursor: "pointer",
              fontWeight: 900,
              opacity: !activationCode || status.type === "loading" ? 0.6 : 1,
            }}
          >
            تفعيل
          </button>
        </div>

        {status.msg ? (
          <div
            style={{
              marginTop: 12,
              padding: "10px 12px",
              borderRadius: 12,
              background: status.type === "err" ? "#fee2e2" : "#dcfce7",
              color: status.type === "err" ? "#991b1b" : "#166534",
              fontWeight: 800,
              fontSize: 13,
              whiteSpace: "pre-wrap",
            }}
          >
            {status.msg}
          </div>
        ) : null}

      </Card>
    </div>
  );
}
