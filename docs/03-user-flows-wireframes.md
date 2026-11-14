# 03 — User Flows & Wireframes

**Document 3 of 8** · Version 0.1.1 · Date 2026-11-12
**Owner:** Founder · **Status:** Ready for build handoff · **Related:** [Product Brief](./01-product-brief.md) · [PRD](./02-prd.md)

Wireframes are structural, not visual. They define hierarchy, behavior, states, and copy. Visual design (color polish, illustration) comes later; the design tokens in §2 are the floor, not the ceiling.

---

## 1. Surfaces, breakpoints, and reading conventions

| Surface | Who | Design target | Breakpoints |
|---|---|---|---|
| Supervisor web app | Owner | Desktop-first, dense but calm | ≥1024px full; 768–1023px usable; <768px degraded but functional |
| Worker web page (PWA) | Worker | Mobile-first, one-thumb, low-end Android | 320–430px canonical; larger tablets centered at 480px max width |
| Transactional email | Owner | Magic links, help alerts | Plain, mobile-safe, bilingual subject lines |

Conventions used in this document:

- Frames are drawn **left-to-right**. Every supervisor screen and the Arabic worker UI mirror horizontally under RTL (§9). Media controls (play, progress) are never mirrored.
- `[ Button ]` primary · `[ Secondary ]` · `⋯` overflow menu · `●` selected state.
- `① ② ③` mark annotated parts under each frame.
- Any frame showing worker content assumes the **worker's language**, not English. One frame is drawn in Arabic to make the mirroring real.
- Timing annotations are promises from the PRD (9-minute setup, 90-second worker flow). They are UX budgets, not decoration.

---

## 2. Design language seeds

| Token | Value | Use |
|---|---|---|
| Ink | `#0F172A` | Primary text |
| Surface / BG | `#FFFFFF` / `#F8FAFC` | Cards / page background |
| Primary | `#0F766E` | Primary buttons, links, focus |
| Understood | `#16A34A` | The brand metric — correct + done |
| Opened | `#2563EB` | Progress states |
| Pending | `#64748B` | Not opened yet |
| Help | `#D97706` | Needs-attention states |
| Error | `#DC2626` | Failures, wrong answers |
| Border | `#E2E8F0` | Dividers, inputs |
| Radius | 12px | Cards, buttons, inputs |
| Spacing | 4px base | 8 · 12 · 16 · 24 · 32 |
| Type | Inter (EN) + Noto Sans Arabic + system script fallbacks | ≥16px worker body, ≥14px supervisor body |
| Tap targets | ≥48px | Worker UI is the constraint |
| Icons | Lucide | Always paired with a label on worker UI — never icon-only status |

**Core components to spec and build once:**

| Component | States | Notes |
|---|---|---|
| `AudioPlayer` | idle · loading · playing · buffering · ended · unavailable | Whole row is the play target on the worker page; 64px play control |
| `NameTile` | idle · hover · remembered | Worker picker tile: first name + last initial; collision rule from WORK-1 |
| `QuestionOption` | idle · selected · correct · wrong · disabled | Full-width, ≥56px tall |
| `StatusPill` | pending · opened · answered · completed · help | Icon + label + color; never color-only |
| `UnderstoodMeter` | — | Small horizontal bar under instruction summaries |
| `Sheet` | — | Mobile bottom sheet (help reasons, language change) |
| `EmptyState` | — | Always exactly one action |
| `Toast` | success · error | Inline confirmations; no toast-only critical info |

---

## 3. The whole product on one page

```
SUPERVISOR (desktop)                                            WORKER (phone, no install)
                                                                
sign in ─► home checklist ─► crew ─► composer ─► processing ─► preview & share ─┐
                                                        (9 min first time)       │
                                                                                │  WhatsApp group
                                                                                ▼
  live board ◄────────────── deliveries + flags ◄────────────────────  worker page
  (exceptions, nudge,                  (poll 15s)                      name ─► listen ─► check ─► done
   export)                                                            └── help ─► supervisor alert
```

Both surfaces share one contract: the **crew link** (PRD SHARE-1). The supervisor never sends anything to a worker directly in v0.1; the WhatsApp group does the delivery.

---

## 4. Supervisor flows

### F1 — Sign in and reach the first instruction (target: 9 minutes)

```
[ S-01 Sign in ] ──email──► [ S-02 Check email ] ──link──► [ S-03 Home checklist ]
                                                                    │
                          ┌─────────────────────────────────────────┤
                          ▼                                         ▼
                 [ S-05 Create crew ] ─► [ S-06 Crew ] ─► manual (S-07) or CSV (S-08/09)
                                                                    │
                                                                    ▼
                                              [ S-10 Content ] ─► [ S-11 Audience ] ─► [ S-12 Processing ]
                                                                                              │
                                                            [ S-13 Preview & share ] ◄────────┘
                                                                      │
                                                    copy link / copy message / QR ──► [ S-14 Board ]
```

Time budget: crew ≈1 min · workers import ≈3 min · record + generate + review ≈4 min · share ≈1 min.

### F2 — Add workers

```
Manual: [S-06 Crew] → [S-07 Add worker] → Save → [Save & add next] loop → done
CSV:    [S-06 Crew] → [S-08 Upload] → [S-09 Review]
                                          ├─ errors → fix file → re-upload (nothing imported)
                                          └─ clean  → import all → success → [S-06]
```

### F3 — Compose, generate, handle failure

```
[S-10 Content] ─► [S-11 Audience] ─► [S-12 Processing]
                                          ├─ all ready ─────────────► [S-13 Preview]
                                          └─ some languages failed ─► retry per language
                                                                      ├─ success → [S-13]
                                                                      └─ accept text-only → [S-13] with warning
```

### F4 — Preview and share

```
[S-13 Preview]
   ├─ listen to each variant, read native text
   ├─ edit a translation (regenerates that language's audio + check)
   ├─ edit the check question/options
   ├─ regenerate one language
   └─ all good → [Copy link] or [QR] → status flips to Shared → toast "Link is live"
                                          └─► [S-14 Board] "View live progress"
```

### F5 — Watch, chase, resolve

```
[S-14 Board]  poll 15s
   ├─ Needs-attention cards (help → not opened 2h+ → wrong first attempt)
   │     ├─ [Mark resolved] → records resolver + time → toast
   │     └─ [Copy reminder message] → paste in WhatsApp group
   ├─ filter workers → per-row detail
   └─ actions: Copy link · Regenerate link (confirm) · Export CSV (S-15) · Archive (confirm)
```

### F6 — Audit export

`[S-14] → Export CSV → S-15 scope dialog → download → (Excel-safe Arabic, UTC + org timezone columns)`

### F7 — Settings, usage, data

`Rail → S-16 Settings → Org / Usage / Data / Support · delete org requires typed confirmation + email confirmation`

---

## 5. Supervisor wireframes

### S-01 · Sign in

```
┌──────────────────────────────────────────────────────────────┐
│ Understood                                        EN · العربية │
│                                                              │
│                   Understood                                 │
│        Say it once. Everyone understands.                    │
│                                                              │
│   Email                                                      │
│   ┌────────────────────────────────────────────────────┐    │
│   │ you@company.com                                    │    │
│   └────────────────────────────────────────────────────┘    │
│   ┌────────────────────────────────────────────────────┐    │
│   │            Send me a sign-in link                  │    │
│   └────────────────────────────────────────────────────┘    │
│                                                              │
│   No password. We email you a link.                          │
│                                                              │
│   Terms · Privacy                                            │
└──────────────────────────────────────────────────────────────┘
```

Annotations:
① Language toggle switches the whole app and mirrors layout in Arabic.
② One field, one action. Validation is inline, never a modal.
③ The email contains: subject in the user's chosen language, one button, "expires in 15 minutes", and "if this wasn't you, ignore".

States: invalid email (inline, field-level) · rate-limited (try again in 60s) · expired link page (S-01 variant with an explanation, resend option).

### S-02 · Check your email

```
                    ┌────────────────────────────────┐
                    │              ✉                 │
                    │        Check your email        │
                    │                                │
                    │  We sent a sign-in link to     │
                    │  you@company.com               │
                    │                                │
                    │  [ Resend link (58s) ]         │
                    │  Use a different email         │
                    └────────────────────────────────┘
```

States: resend timer counts down from 60 · after resend, toast "Sent again" · wrong address loops back to S-01.

### S-03 · Home — first run (the 9-minute promise)

```
┌────────┬───────────────────────────────────────────────────────────┐
│ Home ● │ Al Noor Cleaning Services               EN · العربية   ⋯  │
│ Crews  │                                                           │
│ Sett.  │   Get to your first instruction          ≈ 9 minutes       │
│        │   ▓▓░░░░░░░░   1 of 4                                    │
│        │                                                           │
│        │   ┌───────────────────────────────────────────────────┐   │
│        │   │ ✓  Create your account                    done   │   │
│        │   │ ○  Create a crew                          ≈1 min │   │
│        │   │ ○  Add your workers                       ≈3 min │   │
│        │   │ ○  Record & share an instruction          ≈5 min │   │
│        │   └───────────────────────────────────────────────────┘   │
│        │   [ Continue: create a crew ]                             │
│        │                                                           │
│        │   No crew to import yet?  Try the demo crew →             │
└────────┴───────────────────────────────────────────────────────────┘
```

Annotations:
① Progress bar is the activation metric made visible; each step maps to a PRD requirement.
② Only one primary action — the next incomplete step.
③ Demo crew (PRD ACT-1) opens a pre-made instruction so a prospect can experience the worker flow in 60 seconds.

### S-04 · Home — instructions list

```
┌────────┬───────────────────────────────────────────────────────────┐
│ Home ● │ Instructions                       [ + New instruction ] │
│ Crews  │ [ Active ● ] [ Archived ]          search…               │
│ Sett.  │                                                           │
│        │ ┌───────────────────────────────────────────────────────┐ │
│        │ │ Roof safety checks   [Info]                           │ │
│        │ │ Tower B — Morning crew · Today 08:12                  │ │
│        │ │ 24 sent · 18 opened · 50% understood                  │ │
│        │ │ ▓▓▓▓▓░░░░░          ● 2 need help · 12s ago           │ │
│        │ └───────────────────────────────────────────────────────┘ │
│        │ ┌───────────────────────────────────────────────────────┐ │
│        │ │ Deliver uniforms   [Task]                             │ │
│        │ │ All crews · Yesterday                                 │ │
│        │ │ 62 sent · 59 opened · 81% understood                  │ │
│        │ │ ▓▓▓▓▓▓▓▓░░                                            │ │
│        │ └───────────────────────────────────────────────────────┘ │
└────────┴───────────────────────────────────────────────────────────┘
```

Annotations:
① Cards answer three questions in one glance: what was sent, to whom, who understood. Help flags pin attention.
② "Understood %" always has a tooltip: first attempt correct + Done within 24h.
③ Archived tab is read-only history and remains exportable.

States: empty (zero instructions since setup completed) → single EmptyState with "New instruction"; loading → 3 skeleton cards; error → inline retry.

### S-05 · Create crew (modal)

```
                    ┌───────────────────────────────────┐
                    │ New crew                          │
                    │                                   │
                    │ Name                              │
                    │ [ Tower B — Morning crew        ] │
                    │                                   │
                    │ [ Cancel ]        [ Create crew ] │
                    └───────────────────────────────────┘
```

One field on purpose. Anything else (site, notes) is v0.2 scope creep.

### S-06 · Crew detail — workers

```
Crews / Tower B — Morning crew             [ Add worker ] [ Import CSV ]
24 workers · 4 languages

[ Search workers… ]       [ All languages ▾ ]   [ All statuses ▾ ]

┌─────────────────────────────────────────────────────────────────────┐
│ Name                  Language          Phone           ⋯           │
│ Ramesh Kumar          മലയാളം            —               ⋯           │
│ أحمد علي              العربية           +971 5…         ⋯           │
│ Sunil Das             বাংলা             —               ⋯           │
│ Priya Nair            മലയാളം            —               ⋯           │
│ … 20 more                                                           │
└─────────────────────────────────────────────────────────────────────┘
```

Row menu `⋯`: Edit language · Archive worker. Archived workers disappear from future audiences but stay in history (PRD CREW-7).
Native script chips everywhere — never transliterations, never flags.

### S-07 · Add worker (modal)

```
              ┌──────────────────────────────────────────────┐
              │ Add worker                                   │
              │                                              │
              │ Name      [ Ramesh Kumar                   ] │
              │ Language  [ മലയാളം  ▾ ]  native labels only │
              │ Phone     [ +971… ]  optional, display-only  │
              │                                              │
              │ [ Cancel ]  [ Save ]  [ Save & add another ] │
              └──────────────────────────────────────────────┘
```

### S-08 · CSV import — upload

```
              ┌────────────────────────────────────────────────┐
              │ Import workers                                 │
              │ ① Upload  ─  ② Review  ─  ③ Done               │
              │                                                │
              │  ┌──────────────────────────────────────────┐  │
              │  │        Drop your CSV here                │  │
              │  │        or browse files                   │  │
              │  └──────────────────────────────────────────┘  │
              │                                                │
              │  Download template · Format guide              │
              │  Columns: name, language, phone, crew          │
              │  Languages: ar · en · hi · ur · ml · bn        │
              └────────────────────────────────────────────────┘
```

### S-09 · CSV import — review

```
              ┌──────────────────────────────────────────────────────┐
              │ Review import — 150 workers, 3 need fixing           │
              │                                                      │
              │ ⚠ Fix these rows before importing:                   │
              │   Row 14  · language "malaylam" → use ml             │
              │   Row 52  · name is empty                            │
              │   Row 131 · language "bangla" → use bn               │
              │                                                      │
              │ ⓘ 2 names already in this crew — imported anyway     │
              │                                                      │
              │ ┌──────────────────────────────────────────────────┐ │
              │ │ 1   Ramesh Kumar     ml    —      Morning        │ │
              │ │ 2   أحمد علي         ar    +971…  Morning        │ │
              │ │ …                                                │ │
              │ └──────────────────────────────────────────────────┘ │
              │                                                      │
              │ [ Fix file & re-upload ]       [ Import 150 ]  (off) │
              └──────────────────────────────────────────────────────┘
```

All-or-nothing import (PRD CREW-3). Friendly language aliases are suggested but never silently guessed.

### S-10 · Composer — step 1, the content

```
New instruction                              Step ① Content ─ ② Audience

Type:   [ Task ] [ Info ● ]

[ Speak ● ] [ Type ] [ Photo ]

┌───────────────────────────────────────────────────────────────┐
│                                                               │
│                        (   ◉   )                              │
│                   Tap to record · 0:40 / 3:00                 │
│                                                               │
│     Speak like you always do. We translate and voice it       │
│     in every worker's language.                               │
│                                                               │
└───────────────────────────────────────────────────────────────┘

Recorded: ▶ 0:40   [ Re-record ]      Language detected: हिन्दी ▾

Transcript  [ आज छत पर काम करने से पहले हार्नेस पहनें …           ]
            ✓ Transcript ready   [ Edit ]   [ Confirm ]

Optional title  [ Roof safety checks                        ]

                                        [ Next: choose crew → ]
```

Annotations:
① The microphone is the default tab — P2 ("speak, don't type").
② One recording limit shown up front: 3:00. Over-limit stops automatically with a toast.
③ Detected source language and transcript appear right after recording; both are editable, and a voice draft cannot continue until the transcript is confirmed — Generate blocks without one (PRD COMP-1, PIPE-1).
④ Type tab: 2,000-character textarea with a character count. Photo tab: one image, client-compressed, **required caption**; no OCR in v0.1 — the photo is a visual aid, never the sole content.
⑤ Task vs Info changes the worker's final button (Done vs Got it) — nothing else.

States: recording (live timer, waveform optional) · transcribing (transcript row spinner) · transcript failed → edit manually or re-record · unconfirmed transcript blocks Next · permission denied → plain instructions to allow microphone + fall back to Type tab · audio too short (<1s) → inline "Record at least a second" · same draft reopened → autosave restored.

### S-11 · Composer — step 2, the audience

```
New instruction                              Step ① Content ─ ② Audience ●

Crew  [ Tower B — Morning crew ▾ ]

  [ Select all ]    [ ] Ramesh Kumar · മലയാളം
  [x] Ahmed Ali · العربية      [x] Sunil Das · বাংলা
  [x] Priya Nair · മലയാളം      … 21 more

This instruction will be prepared in:
  العربية   हिन्दी   اردو   മലയാളം   বাংলা     4 languages · 24 workers

[ ← Back ]                              [ Generate instruction ]
```

Annotations:
① No language exclusions (PRD D6). Chips show exactly what will be generated — one language per worker, in native script.
② The count line is the supervisor's last chance to catch a wrong crew before spending AI minutes.
③ Generate is the only forward action; nothing is sent at this point.

### S-12 · Processing

```
Generating your instruction…                 usually under a minute

  ✓  Voice note confirmed     0:40 · हिन्दी
  ✓  Translated                العربية · हिन्दी · اردو · മലയാളം
  ◐  Writing quick checks      3 of 4
  ○  Preparing audio           0 of 4

  Tip: you'll review every language before anything is shared.
```

States: partial failure → per-language rows with [Retry] and an honest explanation; "Share text-only for these languages" appears only after retries exhaust (PRD PIPE-7), with the affected workers named. Leaving the screen does not cancel the job; a banner on S-04 shows progress.

### S-13 · Preview and share (the trust screen)

```
← Back to instruction                                   All languages ready ✓

┌────────────────────────────────────────────┬────────────────────────────────┐
│ العربية   [ Edit text ]  [ ↻ Regenerate ]   │  Share with the crew           │
│ يجب ارتداء حزام الأمان قبل دخول…           │                                │
│ ▶  ▓▓▓▓▓░░░░  0:12 / 0:38                  │  ┌──────────────────────────┐  │
│ Check: ماذا يجب أن تفعل أولاً؟             │  │      Copy link           │  │
│                                            │  └──────────────────────────┘  │
│ हिन्दी     [ Edit text ]  [ ↻ Regenerate ]   │                                │
│ …                                          │  WhatsApp message  EN · AR     │
│ ▶  ▓▓▓▓░░░░░  0:05 / 0:36                  │  ┌──────────────────────────┐  │
│ Check: …                                   │  │ Morning crew — today's   │  │
│                                            │  │ instruction… {link}      │  │
│ اردو      [ Edit text ]  [ ↻ Regenerate ]   │  └──────────────────────────┘  │
│ …                                          │  [ Copy message ]              │
│                                            │                                │
│ മലയാളം    [ Edit text ]  [ ↻ Regenerate ]   │  [ QR code ]                   │
│ …                                          │  [ See what workers see ]      │
│                                            │                                │
│                                            │  ⚠ You haven't reviewed all    │
│                                            │    languages — review first.   │
└────────────────────────────────────────────┴────────────────────────────────┘
```

Annotations:
① Every variant is both readable and playable here. This is where trust is won or lost (P4).
② Editing a translation opens an inline editor; on save, that language's audio and check regenerate — other languages untouched (PRD PIPE-6, J4). The instruction returns to Processing and Share is disabled until every language is ready again, so stale audio can never be shared.
③ The check question and its three options are editable in this same panel; editing them regenerates only the question audio if needed (v0.1: question stays text-only — audio for the check is v0.2).
④ Share = copy link (or show QR). The instruction flips to Shared on first share action, and a toast offers "View live progress".
⑤ The prefilled message exists because the distribution moment is a WhatsApp paste — make it one tap, in EN or AR, with the link already embedded.
⑥ The review reminder is a nudge, not a gate. We never block a supervisor who is confident.

States: editing (save/cancel, regenerating indicator on that card only, Share disabled) · regenerate failed → inline retry, previous audio remains playable · link revoked/regenerated elsewhere → banner with "The previous link is now closed."

### S-14 · Instruction board (the daily screen)

```
← Instructions     Roof safety checks [Info] · Tower B — Morning · Today 08:12
                   [ Copy link ] [ Reminder ] [ Export CSV ] [ ⋯ Archive ]

┌ Target 24 ┐   ┌ Opened 18 ┐   ┌ Understood 12 ┐   ┌ Needs help 2 ┐
│    all    │   │    75%    │   │     50%       │   │   ⚠ amber     │
└───────────┘   └───────────┘   └───────────────┘   └──────────────┘

⚠ Needs attention (4)
┌──────────────────────────────────────────────────────────────────────┐
│ Ahmed Salem · العربية — "Missing tools"          [ Mark resolved ]  │
│ Priya Nair  · മലയാളം — "I don't understand"      [ Mark resolved ]  │
│ 2 workers haven't opened it (2h+)     [ Copy reminder message ]     │
└──────────────────────────────────────────────────────────────────────┘

[ All 24 ] [ Not opened 6 ] [ Wrong answer 3 ] [ Needs help 2 ]

Name              Language     Status         First try   Help
Ramesh Kumar      മലയാളം       ✓ Understood   ✓           —
Sunil Das         বাংলা        Opened          —          —
Ahmed Salem       العربية      Completed      ✗          Resolved
…

Updated 12s ago · refreshes automatically
```

Annotations:
① Exception-first, table-second. The supervisor's job is the chase list, not reading every row (P6).
② "Understood" is a status pill with an icon and label — the product's brand vocabulary, repeated everywhere.
③ Resolving help records who resolved it and when — the beginning of an audit trail.
④ Reminder copies a bilingual message with the same link. No new link is generated.
⑤ Regenerate link (in ⋯) requires confirmation and kills the old link immediately.
⑥ Staleness is visible ("12s ago") because auto-refresh is a promise, not a mystery.

States: shared but zero opens → encouraging empty state with "Copy link" and tips for WhatsApp; archived → read-only banner + export still available; network lost → "Showing last data, reconnecting…" banner.

### S-15 · Export dialog

```
              ┌──────────────────────────────────────────────────┐
              │ Export record                                    │
              │                                                  │
              │ (•) This instruction                             │
              │ ( ) All instructions — [ Last 30 days ▾ ]        │
              │                                                  │
              │ Excel-safe Arabic · UTC timestamps + org time    │
              │                                                  │
              │ [ Cancel ]                    [ Download CSV ]   │
              └──────────────────────────────────────────────────┘
```

### S-16 · Settings

```
Settings
[ Organization ● ] [ Usage ] [ Data ] [ Support ]

Display name   [ Al Noor Cleaning Services            ]
Timezone       [ Asia/Dubai ▾ ]     Language [ English ▾ ]

Usage this month
Text-to-speech  ▓▓▓░░░░░░░  32 / 150 min
(soft guardrail — nothing is blocked; we'll contact you before any limit)

Data:    [ Export all data ]   [ Delete organization ]  (typed confirmation)
Support: [ WhatsApp us ]  [ support@… ]
```

---

## 6. Worker flows

### F8 — Open link and identify

```
WhatsApp message ─► link opens
      ├─ invalid/revoked → [W-08 Closed]
      ├─ preview mode    → [W-09 Preview banner] → normal flow, responses not recorded
      ├─ returning device → [W-01] "Continue as Ramesh K. · മലയാളം"  ──► [W-02]
      └─ new device       → [W-01] name tiles → tap name → [W-02] (language from profile)
                               ├─ "Not you?" on remembered state → back to tiles
                               └─ "My name isn't here" → [W-10]
```

### F9 — Understand and confirm

```
[W-02 Instruction page]
   ├─ play audio (tap only — never autoplay) → [W-03] question card
   ├─ answer → correct ──────────────► inline success → Done enabled → tap Done → [W-07 Completed]
   └─ answer → wrong:
        ├─ 1st wrong: correct option highlighted + "Listen again" → retry once
        └─ 2nd wrong: notice "Your supervisor will be notified" (auto help flag, reason = don't understand)
                        → Done still available after viewing the correct answer
```

### F10 — Help

```
[W-02] → "I need help" → [W-05] reason sheet → Send → [W-06] confirmation
                                                        └─► supervisor email (≤10 min, batched) + board card
```

### F11 — Language and edge pages

```
[W-02] language chip → [W-11] change language → confirm → page re-renders + profile updated
Closed link → [W-08] · Offline → inline banner [W-12] · Name missing → [W-10]
```

---

## 7. Worker wireframes

### W-01 · Name picker

Phone width ≈ 360px. Content is shown in the instruction's title language until a worker is identified.

```
┌───────────────────────────────────┐
│ Al Noor Cleaning      EN · ع · ⋯  │
│ Roof safety checks                │
│                                   │
│ Select your name                  │
│ [ Search name… ]                  │
│                                   │
│ ┌───────────────┐ ┌─────────────┐ │
│ │ Ramesh K.     │ │ أحمد ع.     │ │
│ └───────────────┘ └─────────────┘ │
│ ┌───────────────┐ ┌─────────────┐ │
│ │ Sunil D.      │ │ Priya N.    │ │
│ └───────────────┘ └─────────────┘ │
│ ┌───────────────┐ ┌─────────────┐ │
│ │ Imran S.      │ │ Fatima A.   │ │
│ └───────────────┘ └─────────────┘ │
│                                   │
│ My name isn't here                │
└───────────────────────────────────┘
```

Returning-worker state replaces the grid with a single card:

```
│ Continue as Ramesh K. · മലയാളം     │
│ [ YES, THAT'S ME ]  This isn't me │
```

Annotations:
① First name + last initial only — privacy mitigation from WORK-2. If two workers would render identically, only those colliding workers show their full last name, then a numeric suffix; never a phone number.
② Two-column tiles with ≥56px height; search appears only above 20 workers.
③ The language menu is explicit ("EN · ع · ⋯") because a worker may open someone else's device.
④ No scroll-jacking, no carousel, no onboarding tour. The picker is the only gate before content.

### W-02 · Instruction page — drawn in Arabic (RTL is the default here)

This is the canonical worker screen. It mirrors exactly for LTR languages.

```
┌───────────────────────────────────┐
│ النور للتنظيف            ع · EN ·  │
│ تعليمات الصباح                    │
│                                   │
│ ┌───────────────────────────────┐ │
│ │        ▶   استمع              │ │
│ │  ▓▓▓▓▓░░░░░░   0:12 / 0:38   │ │
│ └───────────────────────────────┘ │
│                                   │
│ [ صورة المعدات، إن وُجدت ]        │
│                                   │
│ يجب ارتداء حزام الأمان قبل دخول   │
│ البئر والتأكد من إغلاق الباب.     │
│                                   │
│ ── فحص سريع ──                    │
│ ماذا يجب أن تفعل أولاً؟           │
│ ┌───────────────────────────────┐ │
│ │ أ. ارتداء حزام الأمان         │ │
│ ├───────────────────────────────┤ │
│ │ ب. الاتصال بالعميل            │ │
│ ├───────────────────────────────┤ │
│ │ ج. التقاط صورة                │ │
│ └───────────────────────────────┘ │
│                                   │
│ [              تم              ]  │  ← disabled until answered
│                                   │
│        أحتاج إلى مساعدة           │
└───────────────────────────────────┘
```

Annotations:
① The audio player is the hero — full-width, one tap.
② Text is always visible next to audio; neither is hidden behind a toggle.
③ Question title is "Quick check" (فحص سريع), never "Quiz". We are not testing the worker; we are confirming understanding.
④ The Done button is sticky at the bottom once the question is in view.
⑤ "I need help" is quiet but always one tap away.
⑥ Worker UI has no navigation bar, no hamburger, no settings. Org name + language menu + content. Nothing else.

### W-03 · Correct answer state

```
│ ┌───────────────────────────────┐ │
│ │ ✓ أ. ارتداء حزام الأمان       │ │  green, check icon
│ ├───────────────────────────────┤ │
│ │   ب. الاتصال بالعميل          │ │  dimmed
│ └───────────────────────────────┘ │
│ ✓ أحسنت — أنت جاهز.               │
│ [              تم              ]  │  now enabled
```

### W-04 · Wrong answer states

```
First miss:
│ ✗ ليس تمامًا. استمع مرة أخرى ثم  │
│   حاول مرة ثانية.                │
│ [   استمع مرة أخرى   ]            │
│   options remain tappable (1 try) │

Second miss:
│ ✗ الإجابة الصحيحة موضّحة بالأخضر.│
│   سيتواصل معك المشرف لمساعدتك.   │
│   (delivery flagged: needs help — │
│    reason: I don't understand)    │
│ [              تم              ]  │
```

### W-05 · Help reason sheet

```
        ┌────────────────────────────────┐
        │ أحتاج إلى مساعدة / Need help   │
        │                                │
        │ ○ لا أفهم                      │
        │ ○ أدوات أو مواد ناقصة          │
        │ ○ مشكلة سلامة                  │
        │ ○ أخرى                         │
        │                                │
        │ [ إلغاء ]        [ إرسال ]     │
        └────────────────────────────────┘
```

### W-06 · Help sent

```
│ ✓ تم إشعار المشرف.               │
│   سيتم مساعدتك قريبًا.            │
│                                  │
│ [ إغلاق ]                        │
```

### W-07 · Completed (reopen)

```
│ ✓ لقد أكملت هذه التعليمات         │
│   اليوم، 07:12                    │
│                                  │
│ [ استمع مرة أخرى ]               │
```

### W-08 · Closed link

```
│ النور للتنظيف                     │
│                                  │
│ هذه التعليمات مغلقة.              │
│ اطلب من المشرف رابطًا جديدًا.     │
```

### W-09 · Preview banner

Full-width sticky banner above the page:

```
│ معاينة — لن يتم تسجيل الردود     │
│ Preview — responses are not       │
│ recorded                          │
```

### W-10 · Name not found

```
│ اسمي ليس هنا / My name isn't here │
│ اطلب من المشرف إضافتك إلى هذه     │
│ التعليمات.                        │
```

### W-11 · Language change

```
        ┌────────────────────────────────┐
        │ تغيير اللغة / Change language  │
        │                                │
        │ [العربية] [English] [हिन्दी]   │
        │ [اردو] [മലയാളം] [বাংলা]        │
        │                                │
        │ This changes your language for │
        │ future instructions too.       │
        │ [ إلغاء ]          [ حفظ ]     │
        └────────────────────────────────┘
```

### W-12 · Offline / weak connection

```
│ ⚠ أنت غير متصل. سيتم إرسال       │
│   إجابتك عند عودة الاتصال.        │
```

Non-blocking banner; the page remains usable with cached text and audio (WORK-8/9).

---

## 8. State matrix (what every screen must tolerate)

| Screen | Loading | Empty | Error | Offline | Notes |
|---|---|---|---|---|---|
| S-03 Home | checklist skeleton | first-run checklist | retry card | banner | Demo crew on empty |
| S-04 List | 3 skeleton cards | one CTA: New instruction | retry card | cached list + banner | Archived empty state separate |
| S-06 Crew | table skeleton | "Add your first worker" | retry | cached | Search with no results ≠ empty crew |
| S-09 CSV | parsing spinner | — | row-level errors block import | — | All-or-nothing |
| S-12 Processing | progressive stages | — | per-language retry | job continues server-side | Never lose the recording |
| S-13 Preview | per-card audio spinner | — | per-language retry keeps old audio | — | Edit inline, not full page |
| S-14 Board | KPI skeletons | "Share it again" helper card | "Showing last data" banner | "Reconnecting…" | Freshness timestamp always visible |
| W-01 Picker | tile skeleton | "Ask your supervisor" | retry | cached names | Search only >20 |
| W-02 Instruction | audio buffering | — | text-only fallback | banner + retry | Question always visible |
| W-07 Completed | — | — | — | — | Preserve first timestamps |

---

## 9. RTL and accessibility checklist

- **Mirroring:** every supervisor and Arabic-worker screen mirrors with `dir="rtl"`: navigation, tables, breadcrumbs, form labels, chevrons. Media controls do not mirror.
- **Bidirectional text:** wrap numbers, phone numbers, links, and Latin brand names in bidi isolation (`<bdi>` or unicode isolation) so "0:38 / رمز 1234" never scrambles.
- **Icons:** directional icons flip; status icons do not. Never icon-only on worker UI.
- **Fonts:** Noto Sans Arabic for Arabic UI; system fallbacks for Devanagari, Bengali, Malayalam. Test all six scripts at 320px.
- **Contrast:** status text pairs pass AA on both surface and tinted backgrounds. Check amber-on-white specifically — it fails often.
- **Targets:** 48px minimum; question options 56px; sticky Done never overlaps content.
- **Keyboard/focus (supervisor):** visible focus ring, logical tab order in both directions, modals trap focus.
- **Screen readers:** name tiles announce "Ramesh K., Malayalam"; status pills announce both icon meaning and label.
- **Reduced motion:** no essential meaning depends on animation; audio player animations respect `prefers-reduced-motion`.

---

## 10. Microcopy deck (core strings)

| Context | English | العربية |
|---|---|---|
| Sign-in CTA | Send me a sign-in link | أرسل لي رابط الدخول |
| Email sent | Check your email | تحقق من بريدك الإلكتروني |
| New instruction | New instruction | تعليمات جديدة |
| Record prompt | Tap to record | اضغط للتسجيل |
| Next step | Next: choose crew | المتابعة: اختر الفريق |
| Generate | Generate instruction | إنشاء التعليمات |
| Preview header | All languages ready | جميع اللغات جاهزة |
| Copy link | Copy link | نسخ الرابط |
| Share success | Link is live | الرابط جاهز |
| Board KPI | Understood | تم فهمها |
| Needs help | Needs help | بحاجة إلى مساعدة |
| Mark resolved | Mark resolved | تمييز كمحلولة |
| Export | Export CSV | تصدير CSV |
| Worker: select name | Select your name | اختر اسمك |
| Worker: listen | Listen | استمع |
| Worker: quick check | Quick check | فحص سريع |
| Worker: correct | Correct — you're ready. | أحسنت — أنت جاهز. |
| Worker: done | Done | تم |
| Worker: got it (Info) | Got it | فهمت |
| Worker: try again | Listen again, then try once more. | استمع مرة أخرى ثم حاول. |
| Worker: help CTA | I need help | أحتاج إلى مساعدة |
| Worker: help sent | Your supervisor has been notified. | تم إشعار المشرف. |
| Worker: closed | This instruction is closed. Ask your supervisor for a new link. | هذه التعليمات مغلقة. اطلب من المشرف رابطًا جديدًا. |
| Worker: preview | Preview — responses are not recorded. | معاينة — لن يتم تسجيل الردود. |
| Disclaimer | This instruction supports — and does not replace — your company's training and safety procedures. | هذه التعليمات تدعم إجراءات التدريب والسلامة في شركتك ولا تحل محلها. |

Working drafts for हिन्दी, اردو, മലയാളം, বাংলা live in the translation sheet and require native review before pilot. Known trap: "Done / I understood" is gendered in Hindi, Urdu, and Bengali — prefer neutral constructions such as "हो गया", and test with real workers (PRD Q3).

---

## 11. Wireframe decisions log

| # | Decision | Why |
|---|---|---|
| D11 | Worker page is a single scroll: instruction → check → Done — not a multi-step wizard | Fewer taps, no lost navigation, matches how people read WhatsApp |
| D12 | Name picker uses tiles, not a dropdown | Dropdowns on 320px phones are error-prone for low-literacy users |
| D13 | Share is a panel inside preview, never a separate page | Sharing should feel one step away from reviewing, not a new context |
| D14 | Board is exception cards over a table, not a kanban | Supervisors manage exceptions, not cards in columns |
| D15 | "Quick check", never "Quiz" | A check confirms; a quiz judges |
| D16 | Tap-to-play only — no autoplay anywhere | Autoplay is blocked or startling; control must be explicit |
| D17 | Worker UI has no global nav | Every element must earn its place on a 320px screen |
| D18 | Supervisor is desktop-first; mobile is functional but not designed for | Ops managers work at desks; crews use phones |
| D19 | Status always = icon + label + color | Color-blind safety; low-literacy safety |
| D20 | Reminder copies a message instead of sending it | The supervisor's WhatsApp is the distribution tool in v0.1 — respect it |

---

## 12. Traceability — wireframes to PRD requirements

| Screen | Serves | PRD IDs |
|---|---|---|
| S-01, S-02 | F1 | AUTH-1, AUTH-5 |
| S-03 | G1, ACT-1/2 | AUTH-2, ACT-1, ACT-2 |
| S-04 | G3 | BOARD-1 |
| S-05, S-06, S-07 | Crew setup | CREW-1, CREW-2, CREW-5, CREW-7 |
| S-08, S-09 | CSV import | CREW-3 |
| S-10 | Compose | COMP-1…COMP-7 |
| S-11 | Audience & languages | COMP-4, D6 |
| S-12 | Pipeline progress | PIPE-1, PIPE-5, PIPE-8 |
| S-13 | Review & share | PIPE-6, PIPE-7, SHARE-1, SHARE-2, SHARE-3, PIPE-3 |
| S-14 | Board & chase | BOARD-2…BOARD-6, NOTIF-1, SHARE-4 |
| S-15 | Export | AUDIT-1, AUDIT-2, AUDIT-3 |
| S-16 | Settings & data | SET-1…SET-5 |
| W-01 | Identify | WORK-1, WORK-2, WORK-6 |
| W-02 | Instruction & check | WORK-3, WORK-4, WORK-10, SHARE-3 |
| W-04 | Incorrect path | WORK-4, J3 |
| W-05, W-06 | Help | WORK-5, NOTIF-1, BOARD-3 |
| W-07–W-10 | Edge pages | WORK-7, SHARE-4, PIPE-7 |
| W-11 | Language change | WORK-6, CREW-4 |
| W-12 | Offline | WORK-8, WORK-9 |

---

## 13. Usability validation (before and during the pilot)

**Supervisors (5 sessions, 30 minutes each, remote screen share):**
1. Time from sign-in to shared instruction (target ≤9 minutes, no help).
2. Watch S-11: do they understand they cannot exclude a language, and why?
3. Watch S-13: do they play at least two languages before sharing? Do they understand what editing a translation regenerates?
4. Watch S-14: can they explain "Understood 50%"? Can they find who needs help in under 10 seconds?
5. What did they try that didn't exist? (This becomes the v0.2 backlog, not v0.1.)

**Workers (5 sessions on their own phones, in their languages, with a bilingual observer):**
1. Can they find their name without help? Time it.
2. Do they tap play without being told? (If not, the audio isn't visually dominant enough.)
3. Do they understand Done vs "I need help" without explanation?
4. After a wrong answer, do they retry or freeze?
5. Note every moment of confusion verbatim — this copy deck will be rewritten from these notes.

**Success bar:** 4 of 5 supervisors activate unaided; 5 of 5 workers complete the flow; zero workers require the observer to touch the phone.

---

## 14. Explicitly not designed yet (v0.2 surfaces)

WhatsApp Business API receipts and message templates · worker personal link inbox and push opt-in · billing screens · analytics charts beyond the board · kiosk mode with badge QR · scheduled sends · PDF compliance pack · team seats and permissions · translation glossary editor · video instructions. Each has a PRD backlog entry; none should leak into v0.1 wireframes.

---

**Next document:** 04 — Technical Design (TDD): architecture, data flow for the pipeline, deployment on the $0 stack, and the API contract skeleton — or 05 — Database & API Specification, if you prefer models before infrastructure. Wireframes here are the contract both documents must satisfy.
