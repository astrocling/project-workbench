# JAKALA Project Management Tool — Design Spec
> **For use with Cursor + Tailwind CSS v3**  
> Visual direction: Bold & Modern (Vercel/Stripe energy, JAKALA brand identity)  
> Dark mode: ✅ Required  
> Font: Raleway (Google Fonts)

---

## 1. Design Philosophy

This tool should feel like a premium enterprise product — **authoritative, high-density, and kinetic**. The JAKALA palette (deep navy → electric blue → signal red) drives a bold identity that sets it apart from generic SaaS tools. Whitespace is deliberate, not generous. Data is the hero.

**The one thing users should remember:** *blue so deep it feels structural, red that means something.*

---

## 2. Tailwind Configuration (`tailwind.config.js`)

```js
const { fontFamily } = require('tailwindcss/defaultTheme')

module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Raleway', ...fontFamily.sans],
        display: ['Raleway', ...fontFamily.sans],
      },
      colors: {
        // --- JAKALA Brand Blues ---
        jblue: {
          950: '#020033',   // deeper than brand, for dark bg
          900: '#040066',   // JBlue — primary brand navy
          800: '#030055',
          700: '#040AB2',   // Blue 072C
          600: '#0D1FD4',
          500: '#1941FA',   // 285C — electric blue, primary interactive
          400: '#3C82FF',   // 2925C — sky blue, highlights/links
          300: '#6FA8FF',
          200: '#A8CAFF',
          100: '#D9E8FF',
          50:  '#EEF4FF',
        },
        // --- JAKALA Brand Reds ---
        jred: {
          900: '#9B0007',
          800: '#CC0008',
          700: '#F00A0A',   // JRed — signal red, CTA / alerts
          600: '#FF2020',
          500: '#FF3F3F',   // 1785C
          400: '#F16A6A',   // 184C
          300: '#FF8982',   // 197C
          200: '#FFB8B4',
          100: '#FFE0DE',
          50:  '#FFF4F3',
        },
        // --- Neutrals (light mode) ---
        surface: {
          0:   '#FFFFFF',
          50:  '#F7F8FA',
          100: '#EFF1F5',
          200: '#E2E5EC',
          300: '#CDD2DB',
          400: '#9AA3B2',
          500: '#64708A',
          600: '#47526A',
          700: '#2E3A52',
          800: '#1C2638',
          900: '#0F1623',
        },
        // --- Dark mode surfaces ---
        dark: {
          bg:      '#080D1A',   // page background
          surface: '#0E1628',   // card / panel
          raised:  '#152035',   // elevated card
          border:  '#1E2E47',   // subtle border
          muted:   '#263650',   // muted border / divider
        }
      },
      boxShadow: {
        'card-light': '0 1px 3px rgba(4,0,102,0.08), 0 4px 16px rgba(4,0,102,0.06)',
        'card-dark':  '0 1px 3px rgba(0,0,0,0.4), 0 4px 20px rgba(0,0,0,0.3)',
        'card-hover': '0 4px 24px rgba(25,65,250,0.18)',
        'nav':        '1px 0 0 0 rgba(25,65,250,0.1)',
        'focus':      '0 0 0 3px rgba(60,130,255,0.35)',
        'focus-red':  '0 0 0 3px rgba(240,10,10,0.25)',
      },
      borderRadius: {
        'sm':  '4px',
        DEFAULT: '6px',
        'md':  '8px',
        'lg':  '12px',
        'xl':  '16px',
        '2xl': '20px',
      },
      fontSize: {
        'display-xl': ['2.25rem',  { lineHeight: '1.15', letterSpacing: '-0.03em', fontWeight: '800' }],
        'display-lg': ['1.75rem',  { lineHeight: '1.2',  letterSpacing: '-0.025em', fontWeight: '800' }],
        'display-md': ['1.375rem', { lineHeight: '1.3',  letterSpacing: '-0.02em', fontWeight: '700' }],
        'title-lg':   ['1.125rem', { lineHeight: '1.4',  letterSpacing: '-0.01em', fontWeight: '600' }],
        'title-md':   ['1rem',     { lineHeight: '1.5',  letterSpacing: '-0.005em', fontWeight: '600' }],
        'body-md':    ['0.9375rem',{ lineHeight: '1.6',  fontWeight: '400' }],
        'body-sm':    ['0.875rem', { lineHeight: '1.55', fontWeight: '400' }],
        'label-md':   ['0.8125rem',{ lineHeight: '1.4',  letterSpacing: '0.02em', fontWeight: '500' }],
        'label-sm':   ['0.75rem',  { lineHeight: '1.35', letterSpacing: '0.04em', fontWeight: '600' }],
        'mono':       ['0.8125rem',{ lineHeight: '1.5',  fontFamily: 'ui-monospace, monospace' }],
      },
      spacing: {
        '4.5': '1.125rem',
        '13':  '3.25rem',
        '15':  '3.75rem',
        '18':  '4.5rem',
        '22':  '5.5rem',
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      animation: {
        'fade-in':    'fadeIn 150ms ease-out',
        'slide-up':   'slideUp 200ms cubic-bezier(0.34,1.56,0.64,1)',
        'shimmer':    'shimmer 1.8s infinite linear',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        shimmer: { from: { backgroundPosition: '-400px 0' }, to: { backgroundPosition: '400px 0' } },
      },
    },
  },
  plugins: [],
}
```

---

## 3. Global CSS (`globals.css`)

```css
@import url('https://fonts.googleapis.com/css2?family=Raleway:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --scrollbar-thumb: #CDD2DB;
    --scrollbar-track: transparent;
  }
  .dark {
    --scrollbar-thumb: #1E2E47;
    --scrollbar-track: transparent;
  }

  html {
    @apply font-sans antialiased;
    font-feature-settings: "kern" 1, "liga" 1, "calt" 1;
  }

  body {
    @apply bg-surface-50 text-surface-700 dark:bg-dark-bg dark:text-surface-200;
  }

  /* Custom scrollbars */
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: var(--scrollbar-track); }
  ::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: 99px;
  }

  /* Selection */
  ::selection {
    @apply bg-jblue-500/20 text-jblue-900 dark:bg-jblue-500/30 dark:text-jblue-100;
  }
}

@layer utilities {
  .text-balance { text-wrap: balance; }
  .no-scrollbar::-webkit-scrollbar { display: none; }
  .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
}
```

---

## 4. Font & Typography Rules

| Role | Class(es) | Spec |
|---|---|---|
| Page title / H1 | `text-display-xl font-extrabold` | 36px, weight 800, tracking -0.03em |
| Section heading / H2 | `text-display-lg font-bold` | 28px, weight 700 |
| Panel heading / H3 | `text-display-md font-bold` | 22px, weight 700 |
| Card title | `text-title-lg` | 18px, weight 600 |
| Sub-label / caption | `text-label-md uppercase tracking-widest` | 13px, weight 500, letter-spacing 0.08em |
| Body text | `text-body-md` | 15px, weight 400 |
| Table cell | `text-body-sm` | 14px, weight 400 |
| Table header | `text-label-sm uppercase` | 12px, weight 600, letter-spacing 0.04em |
| Numeric data | `font-semibold tabular-nums` | Enable tabular nums for column alignment |
| Code / IDs | `font-mono text-mono` | Monospace fallback |

**Color pairings:**
- Primary text: `text-surface-800 dark:text-surface-100`
- Secondary text: `text-surface-500 dark:text-surface-400`
- Muted / disabled: `text-surface-400 dark:text-surface-600`
- Link / interactive: `text-jblue-500 dark:text-jblue-400 hover:text-jblue-700 dark:hover:text-jblue-200`
- Danger / alert: `text-jred-700 dark:text-jred-400`

---

## 5. Navigation

### Sidebar (primary nav)
```
Width: 240px collapsed → 64px icon-only
Background (light): bg-white border-r border-surface-200 shadow-nav
Background (dark):  bg-dark-surface border-r border-dark-border
```

**Structure:**
```
[Logo area]         h-16, px-5, border-b border-surface-200 dark:border-dark-border
[Nav group label]   text-label-sm uppercase text-surface-400 px-4 pt-5 pb-2
[Nav item]          h-10 px-3 rounded-md mx-2 flex items-center gap-3
[Active nav item]   bg-jblue-500/10 text-jblue-600 dark:bg-jblue-500/15 dark:text-jblue-400
                    left border accent: border-l-2 border-jblue-500 (negative margin to bleed)
[Hover nav item]    bg-surface-100 dark:bg-dark-raised
[Icon]              16px, text-surface-400 → active: text-jblue-500
[Label]             text-body-sm font-medium
[Badge count]       ml-auto, bg-jred-700 text-white text-label-sm px-1.5 py-0.5 rounded-full
```

### Top bar
```
Height:          h-14
Background:      bg-white/80 dark:bg-dark-bg/90 backdrop-blur-md
Border-bottom:   border-b border-surface-200 dark:border-dark-border
Sticky:          sticky top-0 z-30
```

**Top bar elements:**
- Breadcrumb: `text-label-md text-surface-400` with `/` separator, current page `text-surface-700 dark:text-surface-200 font-semibold`
- Search: `h-9 w-64 rounded-md bg-surface-100 dark:bg-dark-raised border border-surface-200 dark:border-dark-border px-3 text-body-sm` — focus: `ring-2 ring-jblue-500/30 border-jblue-400`
- Avatar: `h-8 w-8 rounded-full bg-jblue-900 text-white text-label-sm font-bold`

---

## 6. Buttons

### Primary (CTA)
```
bg-jblue-500 hover:bg-jblue-700 active:bg-jblue-900
text-white font-semibold text-body-sm
h-9 px-4 rounded-md
transition-all duration-150
shadow-sm hover:shadow-card-hover
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jblue-400 focus-visible:ring-offset-2
```

### Danger
```
bg-jred-700 hover:bg-jred-800
text-white font-semibold
[same sizing as primary]
focus-visible:ring-jred-500
```

### Secondary (outline)
```
border border-surface-300 dark:border-dark-muted
bg-transparent hover:bg-surface-100 dark:hover:bg-dark-raised
text-surface-700 dark:text-surface-200
font-medium text-body-sm h-9 px-4 rounded-md
```

### Ghost
```
bg-transparent hover:bg-surface-100 dark:hover:bg-dark-raised
text-surface-600 dark:text-surface-300
h-9 px-3 rounded-md
```

### Icon button
```
h-8 w-8 rounded-md flex items-center justify-center
hover:bg-surface-100 dark:hover:bg-dark-raised
text-surface-500 dark:text-surface-400
```

### Sizing scale
| Size | Classes |
|---|---|
| xs | `h-7 px-2.5 text-label-md rounded` |
| sm | `h-8 px-3 text-body-sm rounded-md` |
| md | `h-9 px-4 text-body-sm rounded-md` (default) |
| lg | `h-10 px-5 text-body-md rounded-md` |

---

## 7. Tables

Tables are the heart of this tool. Every detail matters.

### Container
```
bg-white dark:bg-dark-surface
rounded-lg border border-surface-200 dark:border-dark-border
overflow-hidden shadow-card-light dark:shadow-card-dark
```

### Table element
```html
<table class="w-full border-collapse text-body-sm">
```

### Header row
```
bg-surface-50 dark:bg-dark-raised
border-b border-surface-200 dark:border-dark-border
```

### Header cell (`<th>`)
```
px-4 py-3
text-label-sm uppercase tracking-wider
text-surface-500 dark:text-surface-400
font-semibold
text-left
whitespace-nowrap
[sortable]: cursor-pointer hover:text-surface-700 dark:hover:text-surface-200
[sort icon]: ml-1.5 inline-block opacity-40 → active: opacity-100 text-jblue-500
```

### Body row (`<tr>`)
```
border-b border-surface-100 dark:border-dark-border/60
last:border-0
hover:bg-jblue-500/[0.03] dark:hover:bg-jblue-500/[0.06]
transition-colors duration-100
[selected]: bg-jblue-500/[0.06] dark:bg-jblue-500/[0.1]
```

### Body cell (`<td>`)
```
px-4 py-3
text-surface-700 dark:text-surface-200
[first column]: font-medium text-surface-800 dark:text-white
[numeric]:      tabular-nums font-semibold text-right
[muted]:        text-surface-400 dark:text-surface-500
```

### Density variants (implement via CSS class on `<table>`)
```
.table-compact  th, td → py-2
.table-default  th, td → py-3     (default)
.table-relaxed  th, td → py-4
```

### Status badges in cells
```
Inline pill: text-label-sm font-semibold px-2 py-0.5 rounded-full
Active:      bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400
In Progress: bg-jblue-100 text-jblue-700 dark:bg-jblue-500/15 dark:text-jblue-400
Blocked:     bg-jred-100 text-jred-700 dark:bg-jred-900/20 dark:text-jred-400
Draft:       bg-surface-100 text-surface-500 dark:bg-dark-raised dark:text-surface-400
```

### Pagination bar
```
px-4 py-3 border-t border-surface-100 dark:border-dark-border
flex items-center justify-between
text-label-md text-surface-400
[page buttons]: h-8 w-8 rounded text-body-sm font-medium
                active: bg-jblue-500 text-white
                hover:  bg-surface-100 dark:bg-dark-raised
```

### Row checkbox
```
accent-jblue-500
h-4 w-4 rounded border-surface-300 dark:border-dark-muted
```

---

## 8. Cards

### Base card
```
bg-white dark:bg-dark-surface
rounded-lg border border-surface-200 dark:border-dark-border
shadow-card-light dark:shadow-card-dark
p-5
hover:shadow-card-hover hover:border-jblue-200 dark:hover:border-jblue-500/30
transition-all duration-200
```

### Metric / KPI card
```
[accent top border]: border-t-2 border-t-jblue-500
[value]:             text-display-md font-extrabold text-surface-900 dark:text-white tabular-nums
[label]:             text-label-md uppercase text-surface-400 tracking-wider mt-1
[delta positive]:    text-emerald-600 dark:text-emerald-400 text-label-md font-semibold
[delta negative]:    text-jred-700 dark:text-jred-400 text-label-md font-semibold
[delta icon]:        12px arrow inline
```

### Kanban card
```
bg-white dark:bg-dark-surface
border border-surface-200 dark:border-dark-border
rounded-md p-3.5 mb-2
shadow-sm
cursor-grab active:cursor-grabbing
hover:shadow-card-hover hover:border-jblue-300 dark:hover:border-jblue-500/40
transition-all duration-150
[dragging]: opacity-60 rotate-1 shadow-xl
[priority dot]: h-2 w-2 rounded-full
  high:   bg-jred-700
  medium: bg-amber-400
  low:    bg-surface-300
```

### Kanban column
```
bg-surface-50 dark:bg-dark-raised
rounded-lg border border-surface-200 dark:border-dark-border
w-72 flex-shrink-0 p-3
[header]: text-label-sm font-semibold uppercase text-surface-500 flex items-center justify-between mb-3
[count badge]: bg-surface-200 dark:bg-dark-muted text-surface-600 dark:text-surface-300 
               text-label-sm px-2 py-0.5 rounded-full font-semibold
```

---

## 9. Charts & Graphs

Use these classes on chart wrapper containers. Pass these color values to your charting library (Recharts, Chart.js, etc.).

### Chart container
```
bg-white dark:bg-dark-surface
rounded-lg border border-surface-200 dark:border-dark-border
shadow-card-light dark:shadow-card-dark
p-5
[header]: flex items-center justify-between mb-5
[title]: text-title-md text-surface-800 dark:text-surface-100
[subtitle]: text-label-md text-surface-400 mt-0.5
```

### Chart color palette (ordered by priority)
```js
const chartColors = {
  // Primary sequence — use in this order for multi-series
  1: '#1941FA',  // electric blue
  2: '#F00A0A',  // signal red
  3: '#3C82FF',  // sky blue
  4: '#040066',  // deep navy
  5: '#FF3F3F',  // light red

  // For positive/negative contexts
  positive: '#10B981',  // emerald
  negative: '#F00A0A',  // JRed
  neutral:  '#9AA3B2',  // surface-400

  // Dark mode adjusted (same hex — your chart library handles opacity)
  // Use opacity 0.85 on all series in dark mode for visual softness
}
```

### Grid & axis styling
```
Grid lines:    stroke="#E2E5EC"  dark: stroke="#1E2E47"   strokeDasharray="4 3"
Axis labels:   fill="#64708A"   dark: fill="#64708A"      fontSize=12  fontFamily="Raleway"
Axis line:     stroke="#E2E5EC" dark: stroke="#1E2E47"
Tick marks:    none (suppress)
```

### Tooltip
```
bg-white dark:bg-dark-raised
border border-surface-200 dark:border-dark-border
rounded-lg shadow-xl px-3.5 py-2.5
[label]: text-label-md font-semibold text-surface-800 dark:text-surface-100 mb-1.5
[row]:   text-body-sm text-surface-600 dark:text-surface-300 tabular-nums
[dot]:   h-2 w-2 rounded-full inline-block mr-2
```

### Legend
```
text-label-md text-surface-500 dark:text-surface-400
[dot]: h-2.5 w-2.5 rounded-full
gap-x-5 gap-y-1 flex flex-wrap justify-center mt-4
```

---

## 10. Settings Panels

### Page layout
```
max-w-3xl mx-auto px-6 py-8
```

### Section
```
[section title]: text-display-md font-bold text-surface-900 dark:text-white mb-1
[section desc]:  text-body-md text-surface-500 dark:text-surface-400 mb-6
[divider]:       border-t border-surface-200 dark:border-dark-border my-8
```

### Setting row
```
flex items-start justify-between gap-6 py-4
border-b border-surface-100 dark:border-dark-border/60 last:border-0
[label]:   text-body-sm font-semibold text-surface-800 dark:text-surface-100
[desc]:    text-body-sm text-surface-400 dark:text-surface-500 mt-0.5
[control]: flex-shrink-0
```

### Toggle switch
```
[track off]: bg-surface-300 dark:bg-dark-muted w-11 h-6 rounded-full
[track on]:  bg-jblue-500
[thumb]:     bg-white h-5 w-5 rounded-full shadow-sm translate-x-0.5 → on: translate-x-5.5
transition: duration-200 ease-spring
```

### Form inputs
```
h-9 w-full px-3 rounded-md text-body-sm
bg-white dark:bg-dark-raised
border border-surface-300 dark:border-dark-muted
text-surface-800 dark:text-surface-100
placeholder:text-surface-400
focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400
transition-shadow duration-150
```

### Select
```
[same as input above]
appearance-none pr-8
[chevron icon]: absolute right-2.5 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none
```

---

## 11. Modals & Overlays

### Backdrop
```
fixed inset-0 z-40
bg-surface-900/50 dark:bg-black/70
backdrop-blur-sm
animate-fade-in
```

### Modal panel
```
fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50
w-full max-w-lg
bg-white dark:bg-dark-surface
rounded-xl border border-surface-200 dark:border-dark-border
shadow-2xl
p-6
animate-slide-up
```

### Modal header
```
flex items-center justify-between mb-5
[title]: text-title-lg font-bold text-surface-900 dark:text-white
[close]: icon button (see §6)
```

### Modal footer
```
flex items-center justify-end gap-3 mt-6 pt-5
border-t border-surface-100 dark:border-dark-border
```

---

## 12. Empty States

```
flex flex-col items-center justify-center py-16 text-center
[icon]:    h-12 w-12 text-surface-300 dark:text-dark-muted mb-4
[title]:   text-title-md font-semibold text-surface-700 dark:text-surface-300
[desc]:    text-body-sm text-surface-400 dark:text-surface-500 mt-1.5 max-w-xs
[action]:  mt-5 (primary button, size sm)
```

---

## 13. Loading / Skeleton States

```
Skeleton bar:
animate-shimmer
bg-gradient-to-r from-surface-200 via-surface-100 to-surface-200
dark:from-dark-raised dark:via-dark-muted dark:to-dark-raised
background-size: 800px 100%
rounded-md
```

Table skeleton: 8 rows, alternating widths (w-32, w-48, w-24, w-40)

---

## 14. Dark Mode Implementation

Apply `class="dark"` to `<html>`. All tokens above include dark variants.

**Key dark mode surface hierarchy:**
```
Page bg:      dark-bg      (#080D1A)
Cards/panels: dark-surface (#0E1628)   +6 lightness
Raised el:    dark-raised  (#152035)   +12 lightness
Borders:      dark-border  (#1E2E47)
Muted:        dark-muted   (#263650)
```

**Dark mode brand color adjustments:**
- Blues shift from `jblue-500` → `jblue-400` for interactive elements (maintain WCAG AA contrast)
- Reds shift from `jred-700` → `jred-400` for non-alert contexts
- Keep `jblue-500` for solid backgrounds (active nav, primary buttons) — contrast is fine on dark

---

## 15. Focus & Accessibility

- All interactive elements: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jblue-400/70 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-dark-bg`
- Minimum touch target: `h-9 w-9` (36px)
- All icon-only buttons: `aria-label` required
- Color is never the sole indicator — always pair with icon or text
- Table row hover doesn't remove readable contrast

---

## 16. Spacing & Layout System

```
Page padding (desktop):   px-8 py-6
Page padding (mobile):    px-4 py-4
Section gap:              space-y-8
Card grid (KPIs):         grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4
Panel inner padding:      p-5 (cards), p-6 (modals/settings)
Table cell padding:       px-4 py-3
Nav item height:          h-10
Top bar height:           h-14
Sidebar width:            w-60 → collapsed: w-16
Content max-width:        max-w-[1440px] mx-auto
```

---

## 17. Quick-Reference Class Cheatsheet

```
Page bg:           bg-surface-50 dark:bg-dark-bg
Card bg:           bg-white dark:bg-dark-surface
Card border:       border-surface-200 dark:border-dark-border
Divider:           divide-surface-100 dark:divide-dark-border
Primary text:      text-surface-800 dark:text-surface-100
Secondary text:    text-surface-500 dark:text-surface-400
Primary action:    bg-jblue-500 hover:bg-jblue-700 text-white
Danger action:     bg-jred-700 hover:bg-jred-800 text-white
Active/selected:   bg-jblue-500/10 dark:bg-jblue-500/15 text-jblue-600 dark:text-jblue-400
Focus ring:        ring-2 ring-jblue-400/70 ring-offset-2
```
