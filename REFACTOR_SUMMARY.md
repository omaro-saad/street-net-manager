# Refactoring Summary

## Structure Changes

### New Folders & Files

| Path | Purpose |
|------|---------|
| `src/utils/helpers.js` | Shared helpers: safeArray, safeObj, nowMs, genId, pad2, toLocalISODate, todayISO, normId, toNum, clampMoney, fmtMoney, isObj, localDateToMs, addDaysLocal, fmtDurationDays |
| `src/utils/lineShape.js` | Unified line normalizer: normalizeLineRow, ensureLineShape |
| `src/utils/index.js` | Re-exports utils |
| `src/hooks/useResponsive.js` | useResponsive() → { isNarrow, isMobile, width } |
| `src/config/routes.js` | ROUTES + NAV_ITEMS (central navigation) |
| `src/theme.js` | Design tokens: primary, text, border, borderRadius, etc. |
| `src/styles/shared.js` | Shared style objects: pageWrap, input, btnPrimary, btnSecondary, btnDanger, modalOverlay, modalContent |
| `src/components/shared/Modal.jsx` | Reusable modal overlay |
| `src/components/shared/Field.jsx` | Form field with label |
| `src/components/shared/EmptyState.jsx` | Empty state placeholder |
| `src/components/shared/index.js` | Re-exports shared components |

## Central Control

- **Routes**: All paths in `src/config/routes.js`. App.jsx and BottomNav use ROUTES / NAV_ITEMS.
- **Theme**: Colors and radii in `src/theme.js`.
- **Data**: DataContext remains the single source for in-memory data.

## Page Updates

All pages now:
- Import helpers from `../utils/helpers.js` instead of defining them locally
- Use `useResponsive()` instead of local resize listeners
- Use `theme.primary` instead of hardcoded `#8b5cf6` / `#6366f1`
- SubscribersPage, DistributorsPage: Use `normalizeLineRow` from `../utils/lineShape.js`

## Benefits

1. **Single source of truth** for helpers, theme, routes
2. **Easier to add pages** – import from config and shared modules
3. **Consistent styling** – theme and shared styles
4. **Less duplication** – ~400 lines of repeated helpers removed
5. **Easier maintenance** – change in one place
