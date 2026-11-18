---
name: SIGNUM MOTORVEN (OILSTONE ERP)
colors:
  primary: '#002b7a'
  on-primary: '#ffffff'
  primary-container: '#eef4ff'
  on-primary-container: '#001f5c'
  secondary: '#e60012'
  on-secondary: '#ffffff'
  secondary-container: '#fee2e2'
  on-secondary-container: '#b3000e'
  tertiary: '#0284c7'
  on-tertiary: '#ffffff'
  tertiary-container: '#e0f2fe'
  on-tertiary-container: '#0369a1'
  background: '#f1f5f9'
  on-background: '#090d16'
  surface: '#ffffff'
  surface-dim: '#e2e8f0'
  surface-bright: '#ffffff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f8fafc'
  surface-container: '#f1f5f9'
  surface-container-high: '#e2e8f0'
  surface-container-highest: '#cbd5e1'
  on-surface: '#090d16'
  on-surface-variant: '#334155'
  outline: '#94a3b8'
  outline-variant: '#cbd5e1'
  error: '#ef4444'
  on-error: '#ffffff'
  error-container: '#fee2e2'
  on-error-container: '#dc2626'
  success: '#10b981'
  warning: '#ffb703'
  dark-background: '#060913'
  dark-surface: '#0a1326'
  dark-surface-elevated: '#0c1427'
  dark-accent-cyan: '#38bdf8'
typography:
  display-tech:
    fontFamily: Orbitron
    fontSize: 20px
    fontWeight: '800'
    lineHeight: 26px
    letterSpacing: 0.04em
  headline-md:
    fontFamily: Orbitron
    fontSize: 16px
    fontWeight: '700'
    lineHeight: 22px
    letterSpacing: 0.03em
  body-base:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 21px
    letterSpacing: '0'
  body-bold:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '700'
    lineHeight: 20px
    letterSpacing: '0'
  label-caps:
    fontFamily: Orbitron
    fontSize: 11px
    fontWeight: '800'
    lineHeight: 16px
    letterSpacing: 0.05em
  data-mono:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '700'
    lineHeight: 18px
    letterSpacing: '0'
rounded:
  sm: 8px
  DEFAULT: 10px
  md: 12px
  lg: 20px
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 24px
---

# Design System: SIGNUM MOTORVEN (Grupo Motorven C.A. / OILSTONE)

## 1. Visual Theme & Atmosphere
SIGNUM MOTORVEN is an industrial-grade Venezuelan ERP and commercial operations suite for **Grupo Motorven C.A. (OILSTONE ® por KEYSTONE, C.A.)**, covering Executive BI, POS Invoicing, Pre-sales, Accounts Receivable (CxC), Accounts Payable (CxP), Treasury/Banks, Liabilities, Multi-Warehouse Inventory (Almacén 01 Fiscal / Almacén 02 Bóveda), and Profit Plus 2K8 synchronization.

Its visual personality combines **precision industrial telemetry** with **clean glassmorphic bento cards**. Both themes share high-contrast typography and crisp structural hierarchy: Light Mode (`data-theme="light"`, default in `index.html`) prioritizes daytime office legibility on cool slate canvases (`#f1f5f9`) with crisp white cards, while Dark Mode (`data-theme="dark"`) and the Mobile PWA view use deep midnight navy surfaces (`#060913` / `#0c1427`) with subtle cyan and crimson edge glows.

## 2. Color Palette & Roles
### Primary Foundation
- **Motorven Corporate Navy (`#002b7a`)**: Primary brand anchor for headers, active indicators, secondary highlights, and light-mode headings (`#001f5c`).
- **Cool Slate Canvas (`#f1f5f9` light / `#060913` dark)**: Main application backdrop (`--bg-deep`) paired with subtle grid/radial gradients.
- **Glass Bento Surface (`#ffffff` light / `rgba(10, 19, 38, 0.75)` dark)**: Primary card and panel surfaces (`--bg-card-glass`) with backdrop blur (`24px`) and hairline borders.

### Accent & Interactive
- **Motorven Crimson Red (`#e60012` / `#cc0010` dark hover)**: Primary CTAs (`.btn-primary`), official print/PDF report buttons (`.btn-print-report`), active sidebar borders, and urgent indicators.
- **Electric Telemetry Cyan (`#0284c7` light / `#38bdf8` & `#00f2fe` dark)**: Real-time Profit 2K8 sync dock, interactive focus highlights, and active information badges.
- **Oilstone Amber Gold (`#d97706` light / `#ffb703` dark)**: Brand slogan accents, warning/pending indicators, and credit alerts.

### Typography & Text Hierarchy
- **Primary Text**: `#090d16` (light) / `#f8fafc` (dark)
- **Secondary Text**: `#1e293b` (light) / `#e2e8f0` (dark)
- **Muted Metadata**: `#334155` (light) / `#94a3b8` (dark)

### Functional States (Semáforo)
- **Success / Cobrado / Disponible**: `#059669` light / `#10b981` dark (tinted container `#d1fae5` / `rgba(16, 185, 129, 0.15)`)
- **Warning / Pendiente / Reorden**: `#d97706` light / `#f59e0b` dark (tinted container `#fef3c7` / `rgba(245, 158, 11, 0.15)`)
- **Danger / Vencido / Anulado**: `#dc2626` light / `#ef4444` dark (tinted container `#fee2e2` / `rgba(239, 68, 68, 0.15)`)

## 3. Typography Rules
### Hierarchy & Weights
- **Section & Card Headers (`Orbitron`)**: Uppercase geometric display headers (`0.85rem`–`1.25rem`, weights `700`–`800`, letter-spacing `0.5px`) used in `.bento-card-header-title` and badge counters.
- **Core UI & Forms (`Inter`)**: Humanist sans-serif (`13px`–`15px`, weights `400`–`700`) for tables, buttons, navigation labels, and modal forms.
- **Monetary Values, RIF, Correlatives & Account Codes (`JetBrains Mono`)**: Monospace figures (`12px`–`14px`, weight `700`) ensuring tabular alignment across USD (`$`), Bolívares (`Bs.`), and BA VEN-NIF accounting codes (`1.01.03`, `2.02.01.001`).

### Spacing Principles
- 4px base rhythm with `1rem` (`16px`) grid gaps and `1.5rem` (`24px`) bento card padding.
- Generous touch targets (`min-height: 44px` on sidebar buttons, `52px` header / `58px` bottom navigation on mobile PWA).

## 4. Component Stylings
### Buttons
- **Standard `.btn`**: `12px` radius, `0.65rem 1.3rem` padding, `Inter` `700` weight, `0.25s` transition.
- **Primary `.btn-primary`**: Crimson red gradient (`#e60012` → `#b3000e`), white bold text, subtle lift on hover.
- **Secondary `.btn-secondary`**: Tinted neutral surface (`--bg-btn-secondary`) with hairline border (`--border-glass`).
- **Official Report `.btn-print-report`**: Compact `8px` radius, crimson gradient, white icon & text.

### Cards & Bento Containers
- **`.card` / `.bento-card`**: `20px` radius (`--radius-bento`), `1.5rem` padding, `1px` border, `backdrop-filter: blur(24px) saturate(180%)`.
- **`.bento-card-header`**: Edge-to-edge header strip with subtle navy tint gradient and bottom hairline separator.

### Navigation
- **Desktop Sidebar**: `260px` wide (`72px` when collapsed via `.sidebar-collapsed`), grouped by BA VEN-NIF accounting sections (`DIRECCIÓN & SÍNTESIS FINANCIERA`, `CUENTAS REALES • BALANCE GENERAL`, etc.) with `codeTag` pills and active crimson highlight border.
- **Top Header**: Two-tier bar containing global search, live BCV/Keystone rates, and the pill-shaped Profit 2K8 sync sub-dock (`.profit-subbar-dock`).
- **Mobile PWA (`MobileAppLayout`)**: Fixed `100dvh` zero-scroll shell with `52px` top bar, `58px` bottom tab bar (`Inicio`, `Pedidos`, `CxC`, `Inventario`, `Menú`), and safe-area insets.

### Inputs & Forms
- Clean `10px` radius inputs (`--bg-input`) with high-contrast labels, tabular numeric alignment for exchange rates/amounts, and clear focus rings.

### Domain-Specific Components
- **Semáforo KPI Cards (`.inventory-kpi-grid` / `.kpi-card-modern`)**: 3-column desktop grid (`2` columns `<= 1200px`, `1` column `<= 640px`) pairing USD + Bs equivalents and warehouse split badges (`Alm 01 Fiscal` vs `Alm 02 No Fiscal`).
- **VEN-NIF Accounting & Audit Tables**: Sticky headers, monospace correlatives (`FAC-` / `NE-`), and status pills.

## 5. Layout Principles
### Grid & Structure
- Full-viewport flex shell (`100vw` × `100dvh`) with collapsible left sidebar and independently scrollable `.content-body`.
- Breakpoints: `1400px` (wide), `1200px` (2-col KPIs), `992px`/`960px`/`900px` (tablet/drawer transition), `768px`/`640px` (single-column stacked cards & mobile PWA mode).

### Whitespace & Alignment
- Fluid edge padding (`clamp(0.75rem, 1.5vw, 1.5rem)` desktop; `clamp(16px, 4.8vw, 24px)` mobile).
- Left-aligned text labels, right-aligned monetary figures in financial tables.

## 6. Design System Notes for Stitch Generation
### Language to Use
- Describe screens as **"industrial executive ERP telemetry dashboards"**, **"high-contrast glassmorphic bento cards"**, **"tabular monospace financial ledgers"**, and **"clean automotive lubricants distribution interfaces"**.
- Keep prompts focused on **layout, information hierarchy, bilingual-ready Spanish labels (Venezuela fiscal/ERP terminology), and interactive controls** — do not repeat hex codes inside generation prompts once the Stitch design system is linked.

### Color References (for manual edits only)
- Brand Navy `#002b7a`, Action Crimson `#e60012`, Telemetry Cyan `#0284c7` / `#38bdf8`, Success Emerald `#10b981`, Warning Gold `#ffb703` / `#d97706`.

### Component Prompts
- **Executive Dashboard**: "Design a desktop ERP executive dashboard for an automotive lubricants distributor with a collapsible left sidebar grouped by accounting sections, a top header displaying live USD/Bs exchange rate pills and a sync status dock, a 3-column KPI bento grid showing USD and Bolívares totals, and a recent invoices data table with status badges."
- **Mobile PWA Screen**: "Design a compact smartphone PWA screen with a 52px top status bar, a 2x2 high-contrast KPI grid, quick-action cards without vertical page overflow, and a fixed 5-item bottom navigation bar."
