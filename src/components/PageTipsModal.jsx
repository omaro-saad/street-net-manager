/**
 * One-time tips modal for any page. Slides: title, description, next (or done on last).
 * Optional link on a slide; onLinkClick can navigate and close.
 */
import { useState } from "react";
import { modalOverlay, modalContent } from "../styles/shared.js";

export default function PageTipsModal({ open, slides = [], onDone, onLinkClick }) {
  const [step, setStep] = useState(0);
  if (!open || !slides.length) return null;

  const slide = slides[step];
  const isLast = step === slides.length - 1;

  const handleNext = () => {
    if (isLast) {
      onDone?.();
    } else {
      setStep((s) => s + 1);
    }
  };

  const handleLinkClick = (e) => {
    if (slide?.link?.href && onLinkClick) {
      e.preventDefault();
      onLinkClick(slide.link.href);
      onDone?.();
    }
  };

  const description = slide?.description ?? slide?.paragraph ?? "";

  return (
    <div
      style={modalOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="page-tips-title"
    >
      <div
        style={{
          ...modalContent,
          width: "min(420px, 92vw)",
          padding: "24px 20px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="page-tips-title"
          style={{
            fontSize: 22,
            fontWeight: 800,
            marginBottom: 12,
            color: "var(--app-text)",
            textAlign: "right",
          }}
        >
          {slide?.title}
        </h2>
        <p
          style={{
            fontSize: 15,
            lineHeight: 1.7,
            color: "var(--app-text-muted)",
            marginBottom: 20,
            textAlign: "right",
          }}
        >
          {description}
        </p>

        {slide?.link && (
          <div style={{ marginBottom: 16, textAlign: "right" }}>
            <a
              href={slide.link.href}
              onClick={handleLinkClick}
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "var(--app-primary, #6366f1)",
                textDecoration: "underline",
              }}
            >
              {slide.link.text}
            </a>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-start", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleNext}
            style={{
              border: "none",
              borderRadius: 999,
              padding: "10px 20px",
              background: "var(--app-primary, #6366f1)",
              color: "#fff",
              fontWeight: 800,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            {isLast ? "تم" : "التالي"}
          </button>
        </div>

        {slides.length > 1 && (
          <div style={{ display: "flex", gap: 6, marginTop: 16, justifyContent: "center" }}>
            {slides.map((_, i) => (
              <span
                key={i}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: i === step ? "var(--app-primary, #6366f1)" : "var(--app-border)",
                }}
                aria-hidden
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
