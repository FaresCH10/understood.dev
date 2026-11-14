# 01 — Visual System

**Phase 3, document 1 of 3** · Version 0.1 · Date 2026-11-13
**Owner:** Founder · **Status:** Ready for build handoff · **Related:** [Product definition](../product/01-product-definition.md) · [Wireframes](../docs/03-user-flows-wireframes.md) · [Prototype](./prototype/)

This document specifies the visual language of Understood v0.1. It is the source of truth for color, type, spacing, components, motion, RTL behavior, and accessibility. [`prototype/tokens.css`](./prototype/tokens.css) mirrors every token here; if the two ever disagree, fix both in the same change.

The wireframes in [doc 03](../docs/03-user-flows-wireframes.md) define hierarchy and behavior. This document defines how those surfaces look and feel, and how they must behave in Arabic, Hindi, Urdu, Malayalam, and Bengali.

---

## 1. Design intent

**For the supervisor:** calm operational clarity. The board should read in five seconds: how many understood, who needs help, what to do next. No dashboard decoration, no charts without a decision attached.

**For the worker:** quiet confidence. One task on screen, one large play target, one question, one obvious next step. The page should feel more like a utility than a product.

| # | Principle | What it means in pixels | What it forbids |
|---|---|---|---|
| V1 | **The work is the interface** | Content dominates; chrome recedes. A worker page has org + language + instruction + question + action. Nothing else | Tabs, hamburgers, settings, onboarding tours inside the worker view |
| V2 | **Audio is the hero, text is the anchor** | The player is the largest object on W-02 (68px play, full-width card); text sits directly beside it at 17px, never behind a toggle | Autoplay, collapsed transcripts, audio-only content |
| V3 | **Status is a sentence, not a color** | Every status has icon + label + tinted background. Green never appears alone | Color-only dots, red/green pairs without labels |
| V4 | **One primary action per view** | One filled teal button per screen. Secondary actions are ghost or quiet text links | Two filled buttons competing, floating action buttons |
| V5 | **RTL is a first-class layout, not a flip** | Logical properties throughout; Arabic and Urdu mirror the page but not media controls, numbers, or status icons | `left`/`right` hard-codes, mirrored play buttons, flag icons for languages |
| V6 | **Both thumbs, cheap phones, bright sun** | 48px minimum targets; 16px minimum worker body; AA contrast in daylight; no motion required to understand state | Hover-only affordances, 12px worker text, low-contrast gray-on-gray |
| V7 | **The product is not a test** | The question is a "Quick check", never a quiz. Wrong answers produce guidance, not judgment | Scores, red X tallies, timer pressure, gamification |
| V8 | **Trust is visible** | Preview banner, "supports — does not replace" disclaimer, phone numbers display-only, explicit help path | Hidden AI actions, fake urgency, unclear data use |

The tone is **competent, plain, and warm**. The supervisor is addressed as a colleague ("Good morning, Yusuf"), the worker as an adult doing a job ("Listen", "Done", "I need help"), never as a trainee to be managed.

---

## 2. Brand

| Element | Spec |
|---|---|
| Name | **Understood** — always capitalized as one word. Never "Understand", "UnderStood", or "UT" |
| Mark | Rounded 32×32 teal square containing three white horizontal bars of unequal length — a signal/understood glyph, not a letter |
| Wordmark | Inter 600, 15px, `-0.02em`, ink-900. The mark may appear alone only in the collapsed sidebar |
| Primary color | Deep teal `#0F766E`. Chosen for trust and legibility, distinct from the "success green" used for the understood metric |
| Brand promise | "Every worker understands. Every morning." |
| Voice | Short declarative sentences. Verbs first. Numbers exact. No exclamation marks |

Language labels always use the language's own script — العربية, English, हिन्दी, اردو, മലയാളം, বাংলা — never flags, never ISO codes alone. Flags are national; a language is not.

---

## 3. Color

### 3.1 Core palette

| Token | Hex | Role |
|---|---|---|
| `--ink-950` | `#070D18` | Overlay scrims, deepest text |
| `--ink-900` | `#0B1220` | Headings, values, worker device frame |
| `--ink-800` | `#0F172A` | Primary body text (17.9:1 on white) |
| `--ink-700` | `#1E293B` | Emphasized secondary text |
| `--ink-600` | `#334155` | Table body, option text |
| `--ink-500` | `#475569` | Secondary copy (7.6:1 on white) |
| `--ink-400` | `#64748B` | Metadata, captions (4.8:1 on white) |
| `--ink-300` | `#94A3B8` | Placeholder / disabled only — never essential text |
| `--ink-200` | `#CBD5E1` | Strong dividers |
| `--ink-150` | `#DDE4EC` | Disabled fills, sheet handle |
| `--ink-100` | `#E2E8F0` | Borders |
| `--ink-75` | `#EDF1F5` | Table row dividers |
| `--ink-50` | `#F1F5F9` | Subtle fills, letter chips |
| `--bg` | `#F8FAFC` | Supervisor page background |
| `--surface` | `#FFFFFF` | Cards, inputs, sheets |
| `--surface-subtle` | `#FBFCFD` | Table headers, row hover |

### 3.2 Brand palette

| Token | Hex | Role |
|---|---|---|
| `--primary` | `#0F766E` | Primary buttons, links, active states, worker audio card |
| `--primary-hover` | `#0B5F59` | Hover/pressed primary |
| `--primary-active` | `#094F4A` | Pressed |
| `--primary-soft` | `#CCFBF1` | Selected borders, chips |
| `--primary-tint` | `#F0FDFA` | Selected chips, avatar fill, active nav |
| `--primary-ink` | `#115E59` | Text on tinted teal (7.3:1) |

The audio card uses a teal gradient `150deg, #0F766E → #0B5F59 70% → #0A544F`; white text on this range is ≥5.4:1.

### 3.3 Status palette

Status is a closed set. No new status color may be introduced without updating this table, the board, and the CSV vocabulary in the same change.

| Status | Meaning | Fill / border | Ink | Icon |
|---|---|---|---|---|
| **Understood** | First attempt correct + Done | `--green-bg #ECFDF5` / `--green-border` | `--green-ink #15803D` | `checkCircle` |
| **Completed, retried** | Completed after a wrong first attempt | same green tint | same | `check` |
| **Opened** | Link opened, not answered | `--blue-bg #EFF6FF` / `--blue-border` | `--blue-ink #1D4ED8` | `eye` |
| **Pending** | Not opened yet | `--slate-bg #F1F5F9` / `--slate-border` | `--slate-ink #475569` | `clock` |
| **Needs help** | Worker requested help or auto-flag | `--amber-bg #FFFBEB` / `--amber-border` | `--amber-strong #B45309` | `alertCircle` |
| **Wrong answer** | First attempt wrong, completed | `--red-bg #FEF2F2` / `--red-border` | `--red-ink #B91C1C` | `x` |
| **Failed / unavailable** | Generation or delivery failure | red tint | `--red-ink` | `alertTriangle` |

Rules:

- Green is the **understood metric**, not a generic success decoration. Do not use green for "saved" toasts or primary buttons.
- Red is reserved for wrong answers, destructive actions, and recording. It is never used for "needs help" — help is amber, because it is recoverable.
- Blue is progress, not action. Primary actions stay teal in both light and tinted contexts.
- Solid status fills are used only for dots, meters, and icon orbs. Text always sits on the tint with the matching dark ink.
- Status icons are fixed: they do **not** mirror in RTL.

### 3.4 Contrast verification

Measured with the WCAG 2.1 relative-luminance formula. These are the pairs used by the shipped CSS.

| Pair | Ratio | Requirement | Result |
|---|---|---|---|
| Ink-800 `#0F172A` on white | 17.85:1 | AA text | Pass |
| Ink-500 `#475569` on white | 7.58:1 | AA text | Pass |
| Ink-400 `#64748B` on white | 4.76:1 | AA text | Pass |
| Primary `#0F766E` with white text | 5.47:1 | AA text | Pass |
| Primary-ink `#115E59` on primary-tint | 7.27:1 | AA text | Pass |
| Green-ink `#15803D` on green-bg | 4.76:1 | AA text | Pass |
| Red-ink `#B91C1C` on red-bg | 5.91:1 | AA text | Pass |
| Amber-strong `#B45309` on amber-bg | 4.84:1 | AA text | Pass |
| Blue-ink `#1D4ED8` on blue-bg | 6.16:1 | AA text | Pass |
| White on red `#DC2626` | 4.83:1 | AA text / recording | Pass |
| White on green `#16A34A` | 3.30:1 | **Not used for text** | Icons/dots only (≥3:1) |
| Ink-300 `#94A3B8` on white | 2.56:1 | **Not used for essential text** | Placeholder/disabled only |

Known exceptions, deliberate:

- Disabled primary buttons use `--ink-400` on `--ink-150`; disabled controls are exempt from WCAG contrast but remain legible.
- The 4px progress track is a graphical object at 3:1 against the teal card; the numeric time is always shown as the accessible equivalent.
- Placeholder text at ink-300 is supplementary; every input has a persistent visible label.

---

## 4. Typography

### 4.1 Families

| Script | Family | Fallbacks |
|---|---|---|
| Latin / UI | **Inter** | `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial` |
| Arabic + Urdu | **Noto Sans Arabic** | `Segoe UI, Tahoma` |
| Hindi | **Noto Sans Devanagari** | `Nirmala UI, Mangal` |
| Malayalam | **Noto Sans Malayalam** | `Nirmala UI, Kartika` |
| Bengali | **Noto Sans Bengali** | `Nirmala UI, Vrinda` |
| Numerals / code | **SFMono / Roboto Mono** | `Consolas` |

Weights loaded: 400, 500, 600, 700. No italics. No script font for headings — hierarchy comes from size and weight, not typeface changes.

### 4.2 Supervisor scale (desktop)

| Role | Size / line | Weight | Tracking | Color |
|---|---|---|---|---|
| Page title | 25 / 30 | 650 | −0.015em | ink-900 |
| Section title | 14.5 / 20 | 650 | −0.01em | ink-800 |
| Card title | 13–14 / 19 | 650 | −0.01em | ink-900 |
| Body | 13 / 19.5 | 400 | 0 | ink-600 |
| Table body | 12 / 17 | 400–500 | 0 | ink-600 |
| Table header | 9.5 / 13 | 650 | 0.07em, uppercase | ink-400 |
| Eyebrow | 10.5 / 14 | 650 | 0.08em, uppercase | ink-400 |
| Metric value | 24 / 24 | 650 | −0.03em, tabular | ink-900 |
| Caption / help | 11–12 / 16 | 400 | 0 | ink-400 |
| Button | 12.5 / 16 | 600 | −0.005em | contextual |

The supervisor UI is information-dense by design but never below 12px for body copy, 11px for captions, or 9.5px for uppercase labels.

### 4.3 Worker scale (phone)

| Role | Size / line | Weight | Notes |
|---|---|---|---|
| Instruction title | 26 / 32 (24 at ≤360px) | 650 | Wraps to 2–3 lines; no truncation |
| Audio label | 13 | 650 | White on teal |
| Instruction body | 17 / 1.85 (16 at ≤360px) | 400 | Arabic/Urdu line-height 2.0 |
| Question title | 19 / 26 | 650 | Same size as body emphasis, never smaller |
| Option text | 16 / 1.45 | 500 | ≥15.5 at 320px; full answer visible |
| Primary action | 16 | 650 | 54px tall |
| Help link | 14 | 600 | Underlined, 46px tall |
| Metadata | 10.5–12 | 400–500 | Language names, times |
| Sheet title | 19 | 650 | |
| Disclaimer | 10.5 / 1.5 | 400 | ink-400, with shield icon |

Worker body copy must never be smaller than 16px. Language-specific rules:

- **Arabic / Urdu:** line-height ≥1.9; no letter-spacing; no uppercase; weight 600 for titles (Noto Sans Arabic 700 clogs at small sizes).
- **Hindi / Malayalam / Bengali:** line-height 1.8; avoid `text-transform`; test matras at 320px.
- **Latin:** standard scale; `-0.015em` on titles only.

### 4.4 Numbers and mixed direction

- UI numbers (times, counts, percentages, CSV columns) use Western Arabic digits (`0–9`) with `font-variant-numeric: tabular-nums` in both English and Arabic UIs. GCC operators read dashboard metrics in Western digits.
- Translated body copy may use native digits because it is content, not chrome (e.g. Bengali "৯:০০"). Do not normalize it.
- Times in worker UI are bidi-isolated (`direction: ltr; unicode-bidi: isolate`) so `0:12 / 0:38` never reorders in RTL.
- Names, phone numbers, links, and Latin acronyms inside Arabic text are wrapped in `<bdi>` or equivalent isolation.
- Never append a Latin unit directly to an Arabic number without a space and isolation.

---

## 5. Spacing, radius, elevation

### 5.1 Spacing scale

4px base: **4 · 8 · 12 · 16 · 20 · 24 · 28 · 32 · 40 · 48 · 64 · 96**.

| Context | Value |
|---|---|
| Inline icon gap | 6–8px |
| Button padding | 14px horizontal (10px small) |
| Card padding | 18–22px |
| Section rhythm | 28px above, 12px below headings |
| Page padding | 28px top / 32px sides / 96px bottom (supervisor) |
| Worker content padding | 18px sides, 20px between blocks (14px at ≤360px) |
| Table cell | 10px × 16px |
| KPI grid gap | 12px |

### 5.2 Layout constants

| Token | Value | Use |
|---|---|---|
| `--sidebar` | 252px | Supervisor nav; collapses to 72px at ≤1180px and hides at ≤880px |
| `--topbar` | 60px | Sticky supervisor header |
| `--content-max` | 1180px | Main content column |
| Worker content max | 480px | Centered on tablets; full-bleed ≤620px |
| Worker device frame | 412 × min(880px, 100dvh−48px) | Prototype presentation only; not a product constraint |
| Worker sticky action bar | 128px | Done 54 + help 46 + padding |
| Sheet max height | 88% of phone | Scrolls internally |

### 5.3 Radius

| Token | Value | Use |
|---|---|---|
| `--r-xs` | 6px | Micro chips, letter tiles |
| `--r-sm` | 8px | Icon buttons, small inputs |
| `--r-md` | 12px | Cards, buttons, inputs (default) |
| `--r-lg` | 16px | Large cards, audio card on desktop |
| `--r-xl` | 22px | Sheets, modals, phone content radius |
| `--r-full` | 999px | Pills, avatars, play button |

The worker audio card is 18px; name tiles and options are 13px; sheets are 22px top corners only.

### 5.4 Elevation

| Token | Use |
|---|---|
| `--shadow-xs` | Inputs, ghost buttons |
| `--shadow-sm` | Cards at rest, dropdowns |
| `--shadow-md` | Modals, drawers, prototype panel |
| `--shadow-lg` | Command overlays |
| `--shadow-phone` | Device frame in the prototype only |

Borders carry most separation. Shadows are soft, low-opacity, and never used to fake depth inside the worker page.

---

## 6. Iconography

- 24×24 viewBox, 1.8 stroke, round caps/joins, no fills except explicit solid glyphs (play/pause).
- Sizes: 13px (inline metadata), 16px (buttons), 18px (default), 22px (emphasis), 28px (worker play).
- Icon set is Lucide-compatible: `check`, `checkCircle`, `x`, `clock`, `eye`, `alertCircle`, `alertTriangle`, `globe`, `users`, `search`, `play`, `pause`, `volume`, `headphones`, `message`, `help`, `helpCircle`, `shield`, `lock`, `userX`, `wifiOff`, `refresh`, `download`, `copy`, `external`, `chevronRight`, `chevronLeft`, `arrowRight`, `arrowLeft`, `dots`, `plus`, `mic`, `doc`, `file`, `edit`, `mail`, `sparkles`, `calendar`, `settings`.
- On worker screens every icon is paired with a visible label. Icon-only controls are permitted only on supervisor chrome and always carry `aria-label`.
- **Directional icons mirror in RTL:** chevrons, arrows, back, next, external-link. **Status and object icons do not:** check, x, clock, alert, globe, shield, play, pause, microphone.
- Emoji are never part of the UI. They may appear in user-authored content only.

---

## 7. Motion

| Token | Duration | Use |
|---|---|---|
| `--dur-1` | 120ms | Hover, focus, small state changes |
| `--dur-2` | 180ms | Toggles, chips, tab underline |
| `--dur-3` | 280ms | View enter, sheets, modals |
| `--dur-4` | 480ms | Processing stage transitions |

Easing: `--ease: cubic-bezier(0.2, 0.8, 0.2, 1)` for state; `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)` for entrances.

Rules:

- No autoplay of audio, ever. Audio starts only on a tap.
- Looping motion is limited to two places: the live audio waveform and the recording pulse. Both stop when the state stops.
- Worker screen entrance: 380ms rise, staggered ≤140ms across four blocks. Content is readable during the animation; nothing waits for it.
- Wrong-option shake: 320ms, 3px amplitude, once.
- Processing rows step through translate → question → audio at 440ms per stage; the final CTA appears after all languages finish.
- `prefers-reduced-motion: reduce` disables transforms, animations, and smooth scrolling globally; state changes remain instant and complete.
- Never animate layout-critical dimensions (button height, table row height) or use parallax.

---

## 8. Components

Each component below exists in the prototype. States are enumerated because the build must implement all of them, not only the happy path.

### 8.1 Buttons

| Variant | Fill | Border | Text | Use |
|---|---|---|---|---|
| Primary | `--primary` | none | white | The one main action per view |
| Ghost | white | `--border` | ink-700 | Secondary actions |
| Subtle | ink-50 | transparent | ink-600 | Tertiary, cancel |
| Danger | red-bg | red-border | red-ink | Destructive confirmation only |
| Link button | none | none | primary-ink, underlined | Quiet actions ("regenerate link") |

Sizes: 38px default, 40px large, 31px small; radius 9px; icon 16px. Worker buttons are 50–54px tall with 16px text; help link 46px. Disabled: ink-150 fill, ink-400 text, no shadow. Focus: 2px `--focus` ring, 2px offset. Loading: label replaced by "Working…" with a spinner; width is preserved.

### 8.2 Inputs, selects, textareas

Height 42px (inputs/selects), radius 10px, 1px `--border`, white. Focus: teal border + 3px `rgba(13,148,136,0.14)` ring. Labels are persistent and above the field at 12px/600; help text below at 11px. Error: red border + message below, never color alone. Textareas auto-grow to a minimum of 120px on supervisor, 90px on worker (none on worker v0.1).

### 8.3 Segmented control

A 4px-padded track (`ink-50`, radius 9px) with 32px buttons. Active segment: white surface, 1px border, `shadow-xs`, ink-900. Inactive: transparent, ink-500. Used for compose type (Task/Info), message mode (Voice/Text/Photo), audience (Everyone/Selected), share-message language (EN/AR).

### 8.4 Chips, pills, status

- **Pill:** 22–24px tall, 999px radius, 11px/600, icon 12px, tinted fill + border + dark ink. The canonical status component.
- **Chip:** 26px tall, 8px radius, 11.5px, neutral or tinted. Used for metadata (languages, counts).
- **Filter chip:** 30px, white, border; active is teal-tint with teal ink and a count badge of 9.5px.
- **Language dot:** 6px colored dot + native name. The dot is decorative; the name is the label.
- **Avatar:** initials only, 24–32px, teal tint, 1px teal-soft border, radius 8–9px. No photos in v0.1.

### 8.5 Cards

White, 1px `--border`, 12–16px radius, `--shadow-sm` at rest or no shadow when bordered. Header + body + optional footer. Cards never nest more than one level. Interactive cards (crew cards, instruction rows) use a border-color shift on hover, not a lift.

### 8.6 Tables

Supervisor tables: sticky-free, 760px min-width with horizontal scroll on narrow screens; 9.5px uppercase headers on `surface-subtle`; 12px rows; 1px `ink-75` row dividers; hover `#FAFCFC`. Numeric columns use tabular numerals and `text-align: start` (mirrors correctly in RTL). Empty state is one row spanning all columns with a single action.

### 8.7 Audio player

**Worker (W-02/W-07):**

- Full-width teal gradient card, 18px radius, 20/18px padding.
- 68px white circular play button (62px at ≤360px); the **entire card is the play target**, with the button as the keyboard/AT control.
- Label "Listen" under the button; 28-bar waveform; 4px progress track; time `0:12 / 0:38` in LTR isolation; note "Tap to listen".
- States: idle, playing (pause icon, animated waveform), ended (resets to play, time at duration), unavailable (if audio fails, show text-only fallback and a retry; v0.1 UI placeholder).
- No autoplay. Starting playback never scrolls the page or hides text.

**Supervisor preview:** 40px teal play button inside a neutral row, progress track, duration. Audio exists to verify quality, not to be a media player.

### 8.8 Name tile (W-01)

Two-column grid, 9px gap; ≥60px tall (56px at 320px); white, 1.5px border, 13px radius; avatar 32px; name 14.5px/600; language 10.5px/400. Hover: teal border. Active: 0.985 scale. Search is a 50px field above the grid, shown when the crew exceeds 20 workers. Returning worker replaces the grid with a single card: "Continue as [name] · [language]", primary "Yes, that's me", ghost "This isn't me", and a quiet link to the full list.

### 8.9 Question option

Full width, min-height 58px, 13px radius, 1.5px border, 16px/500 text, letter chip 30px at the inline start. States:

| State | Surface | Border | Ink | Mark |
|---|---|---|---|---|
| Idle | white | border | ink-800 | letter chip ink-50 |
| Hover | white | border-strong | ink-800 | — |
| Correct | green-bg | green-border | green-ink | check at inline end |
| Wrong | red-bg | red-border | red-ink | shake once |
| Dimmed | surface-subtle | border | ink-400 | no interaction |

Correct and wrong options are disabled after the final attempt; all options are disabled after a correct answer or second miss.

### 8.10 Banners

Full-width within the phone, 44–48px, 12px icon, 12.5px/500 text, tinted background and bottom border. Blue = preview (eye); amber = offline (wifiOff); green = success/confirmation when needed. Banners stack under the header and scroll with content. No dismiss control for preview or offline.

### 8.11 Sheets

Bottom sheet inside the phone frame, scrim `rgba(7,13,24,0.46)`, sheet white, 22px top radius, 38×4px handle, 88% max height with internal scroll, 260ms slide-up. Sections: title 19px, optional sub 13px, content, actions (2-column grid; cancel ghost / primary 1.4fr). Scrim tap and Escape close. Focus moves into the sheet and returns to the trigger (build requirement; prototype approximates).

### 8.12 Modals and drawer

Supervisor modals: centered, 520–620px, 16px radius, `shadow-lg`, scrim. Header with title/sub and 34px close; body 20px padding; footer right-aligned (in RTL, mirrored). Drawer: right side (inline-end), 440px, full height, header/body/footer with scrollable body. Both close on scrim/Escape, trap focus, and restore it.

### 8.13 Toasts

Bottom center, ink-900 background, white 12.5px text, 10px radius, icon 16px, 3.2s auto-dismiss, one at a time, never for critical information. Success uses a check icon, error uses alert; the color is not the only signal.

### 8.14 Empty states

One icon in a 40px tinted circle, one title, one sentence, exactly one action. Used on board filters, instructions tabs, crew search, and picker search ("No name matches" — no action; the search field is the recovery).

### 8.15 Stepper

Supervisor composer: three steps — Compose → Audience → Generate. Completed steps show a check; active is teal; upcoming is ink-400. 11px labels, 20px circles, 2px connectors. Wraps at ≤980px without clipping.

### 8.16 Meters

4px track (`ink-100` or white/20 on teal), radius 2px; teal fill for progress, green for understood. Always paired with the exact fraction and percentage in text. Meters are decorative reinforcement, never the only representation.

---

## 9. RTL and multilingual rules

### 9.1 Direction

| Surface | English | Arabic | Urdu | Hindi / Malayalam / Bengali |
|---|---|---|---|---|
| Supervisor UI | LTR | **RTL** (full mirror) | RTL if selected as UI language (v0.2) | LTR |
| Worker UI | LTR | **RTL** | **RTL** | LTR |
| Instruction body | Follows variant `dir` | RTL | RTL | LTR |

The supervisor UI has an explicit EN / ع switch. The worker UI has a language sheet with six rows. Language changes re-render in place and persist (except in preview mode).

### 9.2 What mirrors

- Sidebar moves to the right; nav icons sit on the right of labels.
- Page headers, breadcrumbs, tables, form labels, and action groups mirror.
- Directional icons (chevrons, arrows, back, external) flip.
- Progress through a horizontal stepper flows right-to-left.
- Text alignment becomes start-aligned (right).

### 9.3 What does not mirror

- **Media controls:** play/pause, waveform, progress fill, and time remain left-to-right. The play triangle points right in every language.
- **Status icons:** check, x, clock, alert, shield, globe, lock.
- **Numbers and times:** tabular, LTR-isolated.
- **The brand mark:** the three bars keep their order.
- **Charts and meters:** fill from the left (there are no charts in v0.1; meters fill left-to-right in both directions because they encode magnitude, and the exact value is always adjacent).

### 9.4 Bidi hygiene

- Wrap Latin names, links, phone numbers, and codes in `<bdi>`.
- Use logical CSS properties (`margin-inline-start`, `inset-inline-end`, `padding-inline`) everywhere; no `left`/`right` for layout except intentionally non-mirrored media.
- Test strings that mix scripts: "Ramesh K. · മലയാളം", "2 workers · 6 languages" (Arabic), a link inside Arabic WhatsApp copy.
- Arabic line-height must be set on the text block, not globally, so Latin UI density does not inflate.
- Never apply `letter-spacing` to Arabic or Urdu.
- Use Arabic-Indic digits only if the translated content itself does; UI chrome stays Western.

### 9.5 Language switching

- Supervisor EN/ع switch is always visible in the sidebar footer and on the sign-in panel. It changes all chrome, dates, and seeded content; it does not translate user-authored instruction text (that lives in variants).
- Worker language chip is always visible in the header, even on terminal screens. The sheet shows native name + English name + check; saving confirms with the note that future instructions also change.
- Language choice is stored per worker in product; in the prototype it is `localStorage` and never recorded in preview mode.

---

## 10. Accessibility

Target: **WCAG 2.1 AA**, with worker UI held to the stricter end wherever the two conflict with density.

| Area | Requirement | Implementation |
|---|---|---|
| Contrast | 4.5:1 text, 3:1 large text/graphics | See §3.4; status always tint + dark ink |
| Tap targets | ≥48×48 worker; ≥32 supervisor | Worker buttons 46–54px; options 58px; tiles 56–60px; icon buttons 34px with padding |
| Focus | Visible 2px ring, logical order | `:focus-visible` teal ring; modals/sheets trap and restore focus |
| Keyboard | Everything operable | Native buttons/inputs; Escape closes overlays; no div-only controls except the audio card, which duplicates its inner button |
| Zoom | 200% without loss | Fluid layout; no fixed-height text containers; tables scroll |
| Text size | Worker ≥16px body | 17px canonical, 16px minimum at 320px |
| Motion | Respect reduced motion | Global override; no essential animation |
| Status | Never color alone | Icon + label + tint on every status |
| Language | Correct `lang` and `dir` per node | `<html lang/dir>` plus `lang` on script runs |
| Screen readers | Names for icon controls | `aria-label` on icon buttons; `aria-modal` + labelled sheets; decorative SVGs `aria-hidden` |
| Errors | Identified in text | Inline red message + border; focus moves to first invalid field |
| Time limits | None | No countdown; processing can be skipped |
| Audio | Text equivalent always visible | Full transcript beside the player; no audio-only information |

The prototype is a design artifact, not a certified build. It demonstrates focus styles, labels, semantics, and reduced-motion behavior, but automated and assistive-technology audits are part of the Phase 5 test plan, not this phase.

---

## 11. Content design

### 11.1 Voice rules

| Rule | Example |
|---|---|
| Address the worker directly, plainly | "Listen", "Choose one answer", "Done" |
| Name the next action, not the feature | "Share the instruction", not "Create delivery" |
| Be exact with people and time | "18 of 24 understood · 75%", "Today, 07:12" |
| No blame, no judgment | "Not quite. Listen again, then try once more." |
| No false certainty | "Your supervisor will be notified", never "Someone is coming now" |
| One idea per sentence | "This instruction is closed. Ask your supervisor for a new link." |
| Arabic: formal but human | "أحسنت — أنت جاهز." (Well done — you're ready.) |

### 11.2 Fixed vocabulary

| Use | Never use |
|---|---|
| **Quick check** | Quiz, test, exam, assessment |
| **Understood** (metric) | Compliance rate, pass rate, score |
| **Needs help** | Failed, flagged, at risk |
| **Instruction** | Message, campaign, notification, task (for the object) |
| **Crew** | Group, team (unless quoting a customer) |
| **Share** | Send, blast, broadcast |
| **Completed** | Done (as a status label; "Done" is the button) |
| **Opened** | Viewed, seen |
| **Worker** | Employee, laborer, staff (in UI) |

### 11.3 Microcopy patterns

- **Button labels** are verbs: "Share now", "Add worker", "Export CSV", "Mark resolved". Not "OK", "Submit", "Yes".
- **Titles** are sentence case. Arabic has no case; keep the same brevity.
- **Numbers** always include the denominator where the denominator matters: "18 of 24", "2 help requests".
- **Times** use the org timezone and 24-hour format in the supervisor UI (`08:05`), and a friendly completion time on the worker page (`07:12`).
- **Empty states** say what is true, then the one action: "No workers match. Try another name or language."
- **Errors** say what happened and what to do next, in that order. Never expose stack traces, provider names, or HTTP codes.
- **Disclaimer** is fixed: "This instruction supports — and does not replace — your company's training and safety procedures." Arabic: "هذه التعليمات تدعم إجراءات التدريب والسلامة في شركتك ولا تحل محلها."

### 11.4 Localization notes

- English and Arabic are canonical. Hindi, Urdu, Malayalam, and Bengali in the prototype are working drafts and require native review before the pilot, same as the microcopy deck in doc 03 §10.
- Do not machine-translate the disclaimer, help reasons, or safety copy without native review.
- Buttons that grow in translation must wrap or shorten, never clip. German-style long compounds are not a v0.1 concern; Arabic and Malayalam length is.
- Language names are never translated ("Malayalam" stays "Malayalam" in every UI; the native script is shown beside it).

---

## 12. Data display

- **KPI cards** are the only dashboard primitive in v0.1. Label + value + denominator + meter. No sparklines, no charts.
- The four board KPIs are fixed: Targeted, Opened, Understood, Needs help. The "Understood" value is the hero; it is the only one with a green meter.
- Percentages are rounded to whole numbers; fractions are exact. "75%" is always accompanied by "18 of 24".
- Sort order in tables is stable and predictable: crew roster by added date; board by status severity then opened time (pending last or first per filter, documented in 02).
- Empty, loading, and error states are designed for every data surface. Loading uses skeleton rows with the same height as real rows; no spinners on first paint of the board.

---

## 13. Governance

- Token changes require a visual review against both LTR and RTL screens, and a contrast re-check.
- New statuses or colors require updates to this doc, `tokens.css`, worker strings, board filters, and the CSV vocabulary.
- Components are specified once here and implemented once in CSS. Screen-specific CSS may set layout, not new visual language.
- The prototype is the reference implementation for interaction, not a production codebase. Phase 4 decides the component architecture; Phase 5 builds it.
- If a design decision changes during build, record it in the screen spec and, if it affects the product contract, in the [decision register](../product/04-decision-register.md).

---

## 14. Intentionally not in v0.1

| Not included | Why | Revisit |
|---|---|---|
| Dark mode | Field devices are used in daylight; supervisor usage is office-hours. Doubles QA for no pilot value | Post-pilot if requested |
| Custom brand themes per org | Pilot is one org; token layer makes it possible later | v0.2 |
| Illustration system | Adds weight and download cost; the product is operational | v0.2 |
| Emoji / reaction affordances | Undermines the calm, auditable tone | Never |
| Data charts and trend analytics | The board answers the daily question; charts are a v0.2 surface (doc 03b) | v0.2 |
| Skeleton-heavy motion | Slow connections matter; static skeletons are enough | Review in Phase 5 |
| Density toggle | One density is tuned for the pilot; a toggle is complexity without evidence | Post-pilot |
