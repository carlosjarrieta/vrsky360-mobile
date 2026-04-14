# QWEN.md — vrsky360-mobile

## Project Overview

**vrsky360-mobile** is a mobile-first React application built with Vite and TypeScript. It serves as a sales dashboard for VRsky360 — a VR gaming/entertainment business — and is designed for sales staff to track their daily sales, view metrics, and manage payment operations. The app connects to a Rails-based backend API.

### Key Features
- **Authentication** — Login form with token-based auth persisted in `localStorage`
- **Sales Dashboard** — View, filter, and manage sales by date range with charts and tables
- **Admin Dashboard** — Separate dashboard view for admin users
- **Payment Operations** — Split payments, change payment methods, request sale cancellations
- **PWA Support** — Installable as a Progressive Web App via `vite-plugin-pwa`
- **iOS Native Wrapper** — Capacitor-based iOS project under `ios/` for native deployment

### Tech Stack
| Category | Technology |
|----------|------------|
| Framework | React 19 + TypeScript |
| Build Tool | Vite 6 |
| Styling | Tailwind CSS (inferred from class names like `bg-gray-50`, `text-primary`, etc.) |
| Charts | Recharts 3 |
| Icons | Lucide React |
| PWA | vite-plugin-pwa |
| Mobile | Capacitor (iOS project present) |
| Backend | Rails API (external) |

---

## Project Structure

```
vrsky360-mobile/
├── App.tsx                  # Root component — auth routing logic
├── index.tsx                # Entry point — mounts App, registers PWA SW
├── index.html               # HTML shell
├── types.ts                 # TypeScript interfaces (User, Sale, Machine, etc.)
├── vite.config.ts           # Vite config + PWA manifest + env defines
├── tsconfig.json            # TypeScript config (ES2022, noEmit, path alias @/*)
├── package.json             # Dependencies & scripts
├── metadata.json            # App metadata (name, description)
├── components/
│   ├── LoginForm.tsx        # Login screen
│   ├── Dashboard.tsx        # Main sales dashboard (sales reps)
│   ├── AdminDashboard.tsx   # Admin-only dashboard
│   ├── SalesTable.tsx       # Sales data table component
│   ├── SalesChart.tsx       # Sales chart component (Recharts)
│   ├── WorkDayModal.tsx     # Work day modal dialog
│   └── SplitPaymentModal.tsx # Split payment modal dialog
├── services/
│   └── api.ts               # API client — fetches sales, login, cancellations, etc.
└── ios/                     # Capacitor iOS project (Xcode workspace)
```

---

## Building and Running

### Prerequisites
- Node.js (latest LTS recommended)
- npm or yarn

### Local Development

```bash
# 1. Install dependencies
npm install

# 2. (Optional) Create .env.local with your API configuration
#    VITE_API_BASE_URL=https://your-api-domain.com/api/v1
#    GEMINI_API_KEY=your-gemini-api-key

# 3. Start the dev server
npm run dev
```

The dev server runs on `http://localhost:3000` by default (configured in `vite.config.ts`).

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

### iOS Deployment

The project includes a Capacitor iOS wrapper under `ios/`. To build for iOS:

1. Build the web assets: `npm run build`
2. Open `ios/App/App.xcworkspace` in Xcode
3. Build and run on a simulator or physical device

---

## Architecture Notes

### Authentication Flow
1. User enters credentials in `LoginForm`
2. `loginUser()` from `services/api.ts` calls the backend `/api/v1/login`
3. On success, token + user are stored in `localStorage`
4. `App.tsx` checks `localStorage` on mount to restore session
5. Based on `user.admin` flag, either `Dashboard` or `AdminDashboard` is rendered

### API Layer (`services/api.ts`)
- **Base URL**: Configured via `VITE_API_BASE_URL` env var, defaults to `http://localhost:3001/api/v1`
- **Endpoints**:
  - `POST /login` — Authentication
  - `GET /sales?start_date=&end_date=` — Fetch sales by date range
  - `POST /request_cancel` — Request sale cancellation
  - `POST /change_payment_method` — Change payment method
  - `POST /sales/split` — Split a sale payment
- **Fallback**: Includes mock data generation when API is unreachable

### Type Definitions (`types.ts`)
Core interfaces: `User`, `AuthResponse`, `Machine`, `Enterprise`, `Sale`, `SalesApiResponse`, `ApiError`

---

## Development Conventions

- **TypeScript**: Strict typing with `types.ts` as the source of truth for data shapes
- **Component Structure**: Functional components with React hooks (`useState`, `useEffect`, `useCallback`, `useRef`)
- **Styling**: Tailwind CSS utility classes (primary color: blue `#2563eb`)
- **State Management**: Local component state + `localStorage` for persistence (no global state library)
- **Error Handling**: Custom `AuthError` class for auth failures; generic error states in components

---

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `VITE_API_BASE_URL` | Backend API base URL | `http://localhost:3001/api/v1` |
| `GEMINI_API_KEY` | Gemini API key (for AI features) | _(unset)_ |

---

## Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `react` / `react-dom` | ^19.2.0 | UI framework |
| `recharts` | ^3.4.1 | Charting library |
| `lucide-react` | ^0.554.0 | Icon library |
| `vite-plugin-pwa` | ^1.2.0 | PWA support |
| `@vitejs/plugin-react` | ^5.0.0 | React + Fast Refresh for Vite |
