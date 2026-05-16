# Dependency cleanup plan

> **Purpose:** Record the `package.json` dependency audit (unused / redundant / optional consolidation) so it can be executed as engineering work without re-deriving analysis.

---

## 1. Context

- Stack: Next.js + React + Electron; UI built with Radix/shadcn-style primitives.
- Goal: Remove **dead dependencies** and fix **ambiguous** declarations; optionally **consolidate** icons/fonts later.
- **Verify before merge:** After removals, run `pnpm install`, `pnpm lint`, `pnpm build`, and Electron smoke path.

---

## 2. Strong candidates — likely unused in `src/` today

These showed **no usage outside their own `ui/*` wrapper** (or no usage at all). Remove **both** the dependency and the unused component file(s) unless you intend to use them soon.

| Package | Notes / paired files |
|--------|----------------------|
| `@tanstack/react-query` | No `QueryClient` / `useQuery` / imports in `src/`. |
| `date-fns` | No imports in `src/`. |
| `@hookform/resolvers` | No `zodResolver` or other resolvers in `src/`. |
| `react-hook-form` | Only `src/components/ui/form.tsx`; **no** feature imports `@/components/ui/form`. |
| `recharts` | Only `src/components/ui/chart.tsx`; no app imports of chart exports. |
| `embla-carousel-react` | Only `src/components/ui/carousel.tsx`; no app imports. |
| `react-day-picker` | Only `src/components/ui/calendar.tsx`; no app imports. |
| `input-otp` | Only `src/components/ui/input-otp.tsx`; no app imports. |

### Tasks

- [ ] Confirm zero imports: search for `chart`, `carousel`, `calendar`, `input-otp`, `form` from `@/components/ui/...`.
- [ ] Delete unused primitives: `src/components/ui/chart.tsx`, `carousel.tsx`, `calendar.tsx`, `input-otp.tsx`, `form.tsx` (if confirmed unused).
- [ ] Remove the corresponding lines from `package.json` dependencies.
- [ ] `pnpm install` and fix any transitive assumptions.

---

## 3. `corner-smoothing` vs `figma-squircle`

- `package.json` lists **`corner-smoothing`**, but **`src/` does not import** `corner-smoothing`.
- `src/components/SmoothCornersRuntime.tsx` imports **`figma-squircle`** (today via transitive install).

### Tasks

- [ ] Remove direct dependency **`corner-smoothing`** if nothing should use it.
- [ ] Add **`figma-squircle`** as an **explicit** `dependencies` entry (pnpm-friendly, clear intent).
- [ ] **Alternative:** Remove squircle behavior entirely and delete `SmoothCornersRuntime` + layout hookup — only if product is OK losing the effect.

---

## 4. Optional consolidation (larger refactors — not “free”)

| Area | Idea | Risk |
|------|------|------|
| `framer-motion` | Replace with CSS transitions / minimal motion | High touch: `MainArea`, `SettingsSidebar`, `OnboardingModal`, `TopBar`, etc. |
| Icon libraries | Standardize on one of `@heroicons/react`, `@phosphor-icons/react`, `iconoir-react`; keep `@ridemountainpig/svgl-react` only where brand SVGs need it | Many files; design consistency |
| `@fontsource-variable/*` | Reduce families in `src/app/fonts.css` to 2–3 | Product/typography decision |
| `cmdk`, `vaul`, `react-resizable-panels`, `react-markdown` + `remark-gfm` | Keep unless there is a strong bundle-size mandate; reimplementing is expensive | Feature parity / a11y / markdown safety |

Defer these to a **separate initiative** unless bundle size or supply-chain scope is a priority.

---

## 5. Do not remove without replacement (core product)

- `next`, `react`, `react-dom`, `typescript` toolchain, `electron` + builder, `ssh2`, `ws`, `@xterm/*`, `better-sqlite3`, `ai` + `@ai-sdk/*`, `zod`, Tailwind + PostCSS, Radix primitives used by active UI, `posthog-js` (if telemetry shipped), `sonner`, etc.

---

## 6. Acceptance criteria

- [ ] `pnpm lint` and `pnpm build` pass.
- [ ] `pnpm dev:electron` or packaged app opens and core SSH flow works.
- [ ] No imports left pointing at deleted `ui/*` files.
- [ ] `pnpm why <removed-package>` shows it is gone from direct deps (optional sanity check).

---

## 7. Related

- SBOM / audit: `pnpm sbom`, `pnpm audit` (existing scripts in `package.json`).
