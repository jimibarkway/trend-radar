# Trend Radar - Design Tokens v0.1

> Extracted from the 4 design repos Jimi pinned. **For Jimi's sign-off before any component code lands.** Reply with: "go with A / B / C" or paste edits.

## What's in the 4 design repos (the survey)

| Repo | Aesthetic | Best part for us |
|---|---|---|
| **pbakaus/impeccable** | Warm-paper editorial sanctuary. Cormorant Garamond serif display, single editorial-magenta accent, OKLCH colour system, anti-pattern detection rules. | Anti-slop validation rules. Token system structure. |
| **nextlevelbuilder/ui-ux-pro-max-skill** | Design-system *generator* - 161 reasoning rules + 67 UI styles, picks an aesthetic given a niche. | Style decision rubric. |
| **Leonxlnx/taste-skill** | "Anti-slop frontend framework for AI agents." Premium-frontend taste rules. | Layout / motion / spacing principles. |
| **VoltAgent/awesome-design-md** | 73 hand-curated DESIGN.md files in the Google Stitch format, lifted from Linear, Vercel, Resend, Raycast, Cursor, Clay, Framer, Posthog, Supabase, Stripe, etc. | **The gold mine.** Pixel-accurate reference tokens for launch-page brands. |

The launch-page-vibe brands Jimi mentioned (Linear, Vercel, Resend) all have full DESIGN.md files in there. We can lift tokens cleanly.

---

## Three aesthetic options (pick one)

### Option A - "Linear core, Trend Radar accent" 🔷 RECOMMENDED

Linear's developer-tools aesthetic with a single non-Linear accent so it doesn't feel like a clone. Picks **radar green `#59d499`** (lifted from Raycast's category palette) as the single chromatic accent. Reads as "signal detected, trend locked".

| Token | Value | Source |
|---|---|---|
| `canvas` | `#010102` | Linear |
| `surface-1` | `#0f1011` | Linear |
| `surface-2` | `#141516` | Linear |
| `ink` | `#f7f8f8` | Linear |
| `ink-muted` | `#d0d6e0` | Linear |
| `ink-subtle` | `#8a8f98` | Linear |
| `hairline` | `#23252a` | Linear |
| `accent` (the only chromatic accent) | `#59d499` | Raycast green |
| `accent-soft` | `rgba(89,212,153,0.15)` | derived |
| `semantic-rising` | `#ffc533` | amber (Raycast yellow) - for "heating up" badges |
| `semantic-alert` | `#ff6161` | red (Raycast red) - for "viral now" badges |
| `display-font` | Geist or Inter Display | Vercel/Linear |
| `body-font` | Inter | Vercel/Linear |
| `mono-font` | Geist Mono / JetBrains Mono | Vercel |

Source-icon palette (Raycast pattern - saturated accent reserved for icons only, never decoratively):
- GitHub: `#59d499` (green)
- Reddit: `#ff801f` (orange, Resend)
- YouTube: `#ff2047` (red, Resend)
- X: `#3b9eff` (blue, Resend)
- RSS: `#ffc533` (amber, Raycast)
- Search: `#a855f7` (violet) - only used if it's the source badge, NOT as a UI accent

**Vibe:** Bloomberg terminal × Linear product launch. Dense, technical, quietly luxurious. The dashboard reads as software-craft documentation.

### Option B - "Resend serif + glow"

Resend's editorial-tech aesthetic: pure black canvas, Domaine Display headline serif (gives a print-magazine confidence Linear lacks), 6-9% opacity glow gradients for atmospheric depth, 12px rounded containers.

| Token | Value | Source |
|---|---|---|
| `canvas` | `#000000` | Resend |
| `surface-card` | `#0a0a0c` | Resend |
| `ink` | `#fcfdff` | Resend |
| `accent-orange` | `#ff801f` | Resend |
| `accent-blue` | `#3b9eff` | Resend |
| `accent-green` | `#11ff99` | Resend |
| `accent-red` | `#ff2047` | Resend |
| `display-font` | Domaine Display (serif) | Resend |
| `body-font` | ABC Favorit / Inter | Resend |

**Vibe:** print-magazine confidence on a developer tool. Slightly riskier than Option A - serif display can read pretentious if the data underneath isn't strong. Our data is strong, so it could work.

### Option C - "Raycast product-as-marketing"

The marketing page literally looks like extended product chrome. Hairline borders, command-palette-style cards, Inter ss03, white CTA pill on dark, saturated category accents.

| Token | Value |
|---|---|
| `canvas` | `#07080a` |
| `surface` | `#0d0d0d` |
| `surface-elevated` | `#101111` |
| `hairline` | `#242728` |
| `accent-blue` | `#57c1ff` |
| `accent-red` | `#ff6161` |
| `accent-green` | `#59d499` |
| `accent-yellow` | `#ffc533` |
| `hero-stripe-start` | `#ff5757` |
| `hero-stripe-end` | `#a1131a` |

**Vibe:** "the marketing page is the product UI scaled up." Cool but harder to build the angle-gen panel as a separate "creative" beat - Raycast doesn't have an explanatory long-form section.

---

## Why I recommend Option A

1. **Closest match to the prompt's mood** - "Bloomberg terminal for AI content creators" lands in Linear's lane, not Resend's editorial lane.
2. **Single chromatic accent** is the cleanest move - Resend uses four. Four accents means decisions on every UI element. One accent means the green pop draws the eye to the convergence ticker every time.
3. **Radar green is non-cliché** - not blue (every dev tool), not Claude-orange (Cursor), not purple (you specifically vetoed). Green = signal-locked, fits the radar metaphor.
4. **Geist/Inter is free, ships well** - no Domaine Display licence issue.
5. **Raycast saturated accents for source icons** gives us the "6 sources lit up" convergence ticker without needing to invent a colour system from scratch.

---

## Typography scale (Option A, locked)

| Role | Font | Size | Weight | Tracking |
|---|---|---|---|---|
| display-xl (hero) | Inter Display | 80px | 600 | -3px |
| display-lg (section heads) | Inter Display | 56px | 600 | -1.8px |
| display-md | Inter Display | 40px | 600 | -1px |
| headline | Inter | 28px | 600 | -0.5px |
| body-lead | Inter | 17px | 400 | 0 |
| body | Inter | 16px | 400 | 0 |
| supporting | Inter | 14px | 400 | 0 |
| micro-label | Inter | 11px | 500 | 0.1em (all caps) |
| mono (data) | Geist Mono | 12-14px | 400 | 0 |

Line-height: 1.0 on display, 1.2 on headlines, 1.6 on body.

---

## Spacing scale

| Token | Value |
|---|---|
| `space-xs` | 8px |
| `space-sm` | 16px |
| `space-md` | 24px |
| `space-lg` | 32px |
| `space-xl` | 48px |
| `space-2xl` | 80px |
| `space-3xl` | 120px |

Section vertical rhythm: 96px on desktop (Raycast standard), 64px on mobile.

---

## Rounded scale

| Token | Value |
|---|---|
| `rounded-none` | 0 |
| `rounded-sm` | 4px |
| `rounded-md` | 8px |
| `rounded-lg` | 12px (Resend container default) |
| `rounded-xl` | 16px |

Default card: `rounded-lg` (12px).

---

## Motion patterns (from taste-skill survey)

- Page enters: 200ms fade-in + 8px y-translate (subtle, not dramatic)
- Card hovers: 150ms scale 1.0 → 1.01 + hairline brightens from `#23252a` → `#34343a`
- Number tickers: ease-out, ~400ms when count changes
- No bouncy springs. No emoji confetti. No glow pulses.

---

## Anti-slop rules (from impeccable + taste-skill)

These get baked into the build so the result doesn't smell like a generic Tailwind admin:

- No oversized hero icons. No "rocket emoji on the hero card" energy.
- No symmetric three-column "Feature 1 / Feature 2 / Feature 3" tile rows.
- No "Welcome to Trend Radar" generic intro. Start with the contrarian one-liner.
- No em dashes (per Jimi's CLAUDE.md). Code comments included.
- No bullets in body prose. Lists are reserved for genuine lists.
- No gradient backgrounds on cards. Use solid surface tones; reserve gradients for atmospheric depth panels only (Resend pattern).
- No drop shadows. Use hairlines.
- No CTA buttons with rounded-full corners. Use `rounded-md`.

---

## What I need from you

1. **Pick A, B, or C** (default: A)
2. **If A:** approve the radar-green accent `#59d499` OR name a different single accent
3. **Source-icon palette:** approve the 6 colours above OR override any
4. **Anything missing** - flag motion / spacing / type you want different

Reply with letters + any edits. Then PLAN.md drops + day-1 code starts.
