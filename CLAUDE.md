# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Vite dev server on http://localhost:3000 (host 0.0.0.0)
npm run build      # Production build to dist/
npm run preview    # Preview production build
```

No lint or test tooling is configured. TypeScript checking is `noEmit` via `tsconfig.json` — run `npx tsc --noEmit` to type-check.

**Deploy**: pushing to `main` triggers `.github/workflows/deploy.yml` — builds with yarn and SCPs `dist/` to a VPS, then reloads nginx. `VITE_API_BASE_URL` for production comes from GitHub secrets.

## What this is

Mobile-first PWA sales dashboard for VRsky360 sellers (UI text in Spanish). Talks to an external Rails API (`adminVR`). Also wrapped as a Capacitor iOS app under `ios/` (build web assets first, then open `ios/App/App.xcworkspace`).

## Architecture

- **`App.tsx`** — all routing. No router library: auth state (`sales_token` / `sales_user` in `localStorage`) decides between `LoginForm`, `Dashboard` (sellers), or `AdminDashboard` (when `user.admin`).
- **`services/api.ts`** — single API client. Endpoints: `POST /login`, `GET /sales?start_date=&end_date=`, `POST /request_cancel`, `POST /change_payment_method`, `POST /sales/split`. Throws custom `AuthError` on 401 so callers can force re-login. **Gotcha**: `loginUser` and `fetchSales` silently fall back to mock data when the API is unreachable — a "working" app locally may be showing fake sales.
- **`types.ts`** — source of truth for data shapes (`User`, `Sale`, `Machine`, `Enterprise`, etc.).
- **State**: local component state + `localStorage` only; no global store.

### Payment methods

Enum is integer-coded on the backend and duplicated client-side in `components/SalesTable.tsx` (`PAYMENT_METHODS`, `PAYMENT_METHOD_LABELS`, `PAYMENT_METHOD_COLORS`): `0` cash/Efectivo, `1` transfer/Transferencia, `2` package/Paquete, `3` demo/Demo. `Sale.payment_method` may arrive as either string id (`'cash'`) or number — lookups handle both. `SplitPaymentModal.tsx` reuses the same list. Changing payment methods means updating these maps AND the Rails backend enum together.

### Cancellation flow

`POST /request_cancel` creates a cancellation *request* (status `pending`) — it does not cancel the sale. UI reflects `cancellation_status: 'pending' | 'approved' | 'rejected'`.

### Admin vs non-admin

Non-admin users have date inputs restricted to yesterday + today (`components/Dashboard.tsx`); admins get full range.

## Styling — important

Tailwind is loaded via **CDN script in `index.html`** (not npm/PostCSS), with theme colors defined inline there (`primary: '#0d6efd'`, etc.). There is no `tailwind.config.js`. `index.html` also contains an importmap pointing React/recharts/lucide to a CDN — npm packages in `package.json` are what Vite actually bundles; keep versions in sync if touching either.

## Environment

`.env.local`: `VITE_API_BASE_URL` (defaults to `http://localhost:3001/api/v1`). `GEMINI_API_KEY` is wired in `vite.config.ts` defines but currently unused by app code.
