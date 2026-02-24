/**
 * Design tokens — values come from CSS variables (index.css) so light/dark theme applies app-wide.
 * :root = light, html.theme-dark = dark (gradient purple mode).
 */
export const theme = {
  primary: "var(--app-primary)",
  primaryGradient: "var(--app-primary-gradient)",
  primaryAlt: "var(--app-primary-alt)",
  text: "var(--app-text)",
  textMuted: "var(--app-text-muted)",
  textLight: "var(--app-text-light)",
  bg: "var(--app-bg)",
  surface: "var(--app-surface)",
  surfaceAlt: "var(--app-surface-alt)",
  border: "var(--app-border)",
  success: "var(--app-success)",
  warning: "var(--app-warning)",
  error: "var(--app-error)",
  shadow: "var(--app-shadow)",
  shadowMd: "var(--app-shadow-md)",
  borderRadius: 18,
  borderRadiusSm: 12,
};
