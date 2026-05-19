# Design — MeuPlayer

A locked design system for this Electron app. Every page redesign reads this
file before emitting code. Do not regenerate per page — extend or amend this
file when the system needs to grow.

Built by Hallmark v1.0.0 · multi-page redesign · 2026-05-19.

## Genre
atmospheric — Suno/Runway dark-AI-tool school. Permits radial accents,
deep paper bands, soft chromatic glows. Bans pure-white paper and pill
CTAs from the modern-minimal genre.

## Macrostructure family

Three page-type families. Pages within a family share the family's shape;
they vary only in component archetypes.

- **Browse pages** (catálogo de filmes/séries/animes): **Marquee Hero**
  - Hero archetype: **H7 Stage** — backdrop TMDB w1280 of featured item,
    left-bias display title (Fraunces italic), primary + secondary CTA
  - Section heads: italic display, no numeral, no eyebrow tag
  - Body: vertical-stacked grids of `MediaCard`, `minmax(0, 240px)` columns,
    `auto-fill`, gap `--space-md`
- **Detail pages** (filme / série / anime detail): **Long Document**
  - Poster as inline figure, sticky on scroll-Y until reaches Temporadas
  - Sinopse as prose paragraph, max-width 60ch, body type
  - Temporadas as ordered list (NOT card grid) — episode rows with
    thumbnail + number + title + abbreviated overview + runtime
  - Relacionados as a sub-grid at the bottom
- **App-utility pages** (canais + rede-buzz): **Workbench**
  - Two-column: sidebar (channel list + filters) left, player right
  - Sidebar density: compact rows, no card chrome
  - Player area: pure black, iframe full-bleed
  - Floating overlay (channel up/down) stays — utility controls

## Theme — atmospheric Bloom (locked)

OKLCH values, sourced from `tokens.css`. Inline values in page CSS are
forbidden — slop-test gate 58.

- `--color-paper`     oklch(16% 0.02 250)  ← deep cinema-blue
- `--color-paper-2`   oklch(20% 0.02 250)  ← elevated surfaces
- `--color-paper-3`   oklch(25% 0.02 250)  ← cards, modals
- `--color-ink`       oklch(96% 0.01 80)   ← warm-white, not pure
- `--color-ink-2`     oklch(72% 0.02 80)   ← muted text
- `--color-ink-3`     oklch(54% 0.02 80)   ← captions, helper text
- `--color-rule`      oklch(28% 0.015 250) ← hairline borders
- `--color-rule-2`    oklch(36% 0.02 250)  ← interactive hairlines
- `--color-accent`    oklch(78% 0.15 65)   ← amber bloom, primary action
- `--color-accent-2`  oklch(72% 0.18 50)   ← deeper amber, hover/active
- `--color-accent-ink` oklch(18% 0.02 60)  ← text over amber
- `--color-focus`     oklch(80% 0.18 60)   ← focus ring
- `--color-bloom`     oklch(78% 0.15 65 / 0.18) ← hero radial wash

Diversification axes recorded (locked, not for rotation across this app):
- paper-band: **dark**
- display-style: **italic-serif**
- accent-hue: **warm-amber**

## Typography

- **Display** — Fraunces, weight 400, style italic, opsz 144, tracking -0.02em
- **Body** — Inter, weight 400 / 500 / 600
- **Mono** — JetBrains Mono, weight 400 / 500 (metadata: year, runtime, IDs)
- Display tracking: -0.02em
- Body tracking: 0
- Type scale anchor: `--text-display` = clamp(2.4rem, 6vw + 1rem, 5.5rem)

Fonts loaded via Google Fonts `<link>` in each HTML shell (no build step).

## Spacing

4-point rem-based scale. The values are in `tokens.css`. Pages MUST use
named tokens (`var(--space-md)`), never raw values.

- `--space-3xs` 0.25rem  · `--space-2xs` 0.5rem · `--space-xs` 0.75rem
- `--space-sm`  1rem     · `--space-md`  1.5rem · `--space-lg` 2rem
- `--space-xl`  3rem     · `--space-2xl` 4.5rem · `--space-3xl` 7rem

## Motion

- Easings: `--ease-out` cubic-bezier(0.16, 1, 0.3, 1) · `--ease-in`
  cubic-bezier(0.4, 0, 1, 1) · `--ease-in-out` cubic-bezier(0.4, 0, 0.2, 1)
- Durations: `--dur-short` 220ms · `--dur-med` 320ms
- Reveal pattern: **fade-only** on hover. No slide, no rotate, no scale on
  data-bearing imagery (posters). Background motion is forbidden.
- Reduced-motion fallback: opacity-only ≤ 150ms.

## Microinteractions stance

- **Silent success** — no celebratory toasts on channel change, no confetti,
  no shimmer on load
- Hover delay 800ms for tooltips · focus delay 0ms
- Focus ring via `outline: 2px solid var(--color-focus)`, never via border —
  prevents layout shift (slop-test gate 41)
- Card hover: **veil-fade** — translucent paper-3 panel fades over bottom 55%
  of poster, revealing title + meta + CTA. No transforms on the poster image.

## CTA voice

- **Primary** — pill (border-radius `--radius-pill`), filled `--color-accent`,
  text `--color-accent-ink`, padding `0.75rem 1.5rem`, weight 600. Copy is
  always a verb-first phrase ("Assistir", "Tocar canal", "Voltar")
- **Secondary** — ghost outline 1px `--color-rule-2`, same shape, text
  `--color-ink`. Reserved for cancel / back / dismiss actions
- **Tertiary** — text link with `:hover { color: var(--color-accent) }`,
  underline on hover only

## Per-page allowances

- **Browse pages** MAY use Tier-A enrichment: a single radial bloom on the
  hero, no mockups, no fake browser chrome
- **Detail pages** MUST be typography-only — the TMDB poster IS the imagery
- **App-utility pages** MUST be typography-only — function carries the page

## What pages MUST share

- The MeuPlayer wordmark (italic Fraunces, `--color-ink`)
- The amber accent and its placement (≤ 5% of any viewport)
- The display + body + mono pairing
- The CTA voice (button shape, radius, padding, copy pattern)
- Section heading rhythm (display italic, no eyebrow tag, no numeral)
- The Hallmark stamp at the top of every CSS file

## What pages MAY differ on

- Macrostructure within the page-type family
- Hero presence: browse pages have a hero; detail and app-utility do not
- Enrichment — browse pages only, Tier-A radial bloom only

## Exports

Drop-in formats for re-using this design system in other projects.

### tokens.css

The canonical token file. Loaded via `<link rel="stylesheet" href="/tokens.css">`
BEFORE `styles.css` in every HTML shell. See `public/tokens.css` for the live
values.

### Tailwind v4 `@theme`

```css
@theme {
  --color-paper:        oklch(16% 0.02 250);
  --color-paper-2:      oklch(20% 0.02 250);
  --color-ink:          oklch(96% 0.01 80);
  --color-ink-2:        oklch(72% 0.02 80);
  --color-rule:         oklch(28% 0.015 250);
  --color-accent:       oklch(78% 0.15 65);
  --color-accent-ink:   oklch(18% 0.02 60);
  --color-focus:        oklch(80% 0.18 60);
  --font-display:       "Fraunces", "Times New Roman", serif;
  --font-body:          "Inter", system-ui, -apple-system, sans-serif;
  --font-mono:          "JetBrains Mono", ui-monospace, monospace;
  --spacing-3xs: 0.25rem; --spacing-2xs: 0.5rem;  --spacing-xs: 0.75rem;
  --spacing-sm:  1rem;    --spacing-md:  1.5rem;  --spacing-lg: 2rem;
  --spacing-xl:  3rem;    --spacing-2xl: 4.5rem;  --spacing-3xl: 7rem;
  --text-xs: 0.75rem;  --text-sm: 0.875rem; --text-md: 1.125rem;
  --text-lg: 1.375rem; --text-xl: 1.75rem;  --text-2xl: 2.25rem;
  --text-3xl: 2.75rem;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
}
```

### DTCG `tokens.json`

```json
{
  "color": {
    "paper":      { "$value": "oklch(16% 0.02 250)", "$type": "color" },
    "paper-2":    { "$value": "oklch(20% 0.02 250)", "$type": "color" },
    "ink":        { "$value": "oklch(96% 0.01 80)",  "$type": "color" },
    "ink-2":      { "$value": "oklch(72% 0.02 80)",  "$type": "color" },
    "rule":       { "$value": "oklch(28% 0.015 250)","$type": "color" },
    "accent":     { "$value": "oklch(78% 0.15 65)",  "$type": "color" },
    "accent-ink": { "$value": "oklch(18% 0.02 60)",  "$type": "color" },
    "focus":      { "$value": "oklch(80% 0.18 60)",  "$type": "color" }
  },
  "font": {
    "display": { "$value": "Fraunces",        "$type": "fontFamily" },
    "body":    { "$value": "Inter",           "$type": "fontFamily" },
    "mono":    { "$value": "JetBrains Mono",  "$type": "fontFamily" }
  },
  "space": {
    "sm":  { "$value": "1rem",    "$type": "dimension" },
    "md":  { "$value": "1.5rem",  "$type": "dimension" },
    "lg":  { "$value": "2rem",    "$type": "dimension" },
    "xl":  { "$value": "3rem",    "$type": "dimension" }
  }
}
```

### shadcn/ui CSS variables

```css
:root {
  --background:          16% 0.02 250;
  --foreground:          96% 0.01 80;
  --primary:             78% 0.15 65;
  --primary-foreground:  18% 0.02 60;
  --muted:               20% 0.02 250;
  --muted-foreground:    72% 0.02 80;
  --border:              28% 0.015 250;
  --input:               28% 0.015 250;
  --ring:                80% 0.18 60;
  --radius:              14px;
}
```

## Provenance

This system was produced by `hallmark redesign` on the MeuPlayer Electron
app, multi-page flow. Source brief: personal media catalog for self + family,
atmospheric tone, "go ahead" on the picks. No external design reference
studied. Locked on 2026-05-19.
