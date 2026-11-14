# Design Pack

**Phase 3 — UX/UI Design** · Version 0.1 · 2026-11-13

This folder turns the v0.1 product definition into a visual system, a complete screen specification, and a working clickable prototype. It is the bridge between the docs in `docs/` and the Phase 4 build.

> Phase numbering follows the six-phase plan (Discovery → Product Definition → **UX/UI Design** → Architecture → Build → Launch). The product documentation is separate: `docs/03-user-flows-wireframes.md` is the earlier wireframe document, not this folder's doc 03.

---

## Artifacts

| # | Artifact | What it answers |
|---|---|---|
| 01 | [Visual System](./01-visual-system.md) | What does Understood look like, and why? Color, type, spacing, 16 component specs, RTL, accessibility, content design |
| 02 | [Screen Specifications](./02-screen-specifications.md) | What exactly is on every screen, in every state, with what copy and behavior? S-01…S-16, W-01…W-12 |
| 03 | [Prototype Guide](./03-prototype-guide.md) | How do I run, navigate, demo, review, and hand off the prototype? Routes, deep links, scripts, limits |
| — | [Prototype](./prototype/) | The clickable artifact itself: supervisor console + worker page |

The prototype opens with:

```bash
cd design/prototype
node serve.mjs
# → http://127.0.0.1:4321/
```

No build step, no dependencies, no login. It also opens directly from `file://`.

---

## Status at a glance

| Area | State |
|---|---|
| Visual system | Complete — tokens measured for WCAG 2.1 AA, mirrored in `prototype/tokens.css` |
| Supervisor screens (S-01…S-16) | Complete and specified; all routes built and clickable |
| Worker screens (W-01…W-12) | Complete and specified; all states deep-linkable |
| Languages | Supervisor UI EN + AR with full RTL; worker UI all six languages, AR/UR RTL |
| Responsive | Supervisor 1024–1440 verified; worker 320/360/430 verified with no horizontal overflow |
| Accessibility | Contrast measured; focus states, keyboard paths, ≥48px targets, icon + label status |
| Prototype depth | High fidelity, front-end only, seeded data; AI, audio, and email simulated; CSV export runs client-side |

**What is intentionally not designed yet:** dark mode, customer theming, illustration, data charts, supervisor mobile-native layouts, worker accounts or history, per-worker links (v0.2), and any screen listed in [docs/03b-v0.2-surfaces.md](../docs/03b-v0.2-surfaces.md). Those stay out until a pilot pulls them in.

---

## The product in one breath

A supervisor records or types an instruction once. Understood translates it into the crew's languages, generates audio and one comprehension question per language, and produces **one link**. Workers open it on any phone, pick their name, listen, answer, and tap Done — or ask for help. The supervisor watches a live board and exports an audit CSV.

The design's one job: **make a non-native speaker certain they understood, without making them feel tested.** Every visual decision follows from that.

---

## How to review

Budget 30–45 minutes. Review in this order; each step assumes the previous one.

1. **Read 01 §1–§5** (10 min). Judge the intent, color, and type before looking at pixels.
2. **Open the supervisor console** and run the J1 script in doc 03 §7 (10 min). Watch hierarchy and density, not just layout.
3. **Open the worker page at phone width** and run J2 and J3 (10 min). Time the happy path. The target is ≤90 seconds from link to Done.
4. **Switch the supervisor to Arabic**, then the worker to Arabic and Urdu (5 min). Check mirroring, numbers, and media controls.
5. **Open 02 and spot-check three screens** you just used (5 min). If the spec and the prototype disagree, the spec wins — note it as a bug.
6. **Read the known limits** in doc 03 §8 (2 min). Confirm none of them block the pilot.

Feedback format that helps most: screen ID, viewport, what you expected, what happened. Example: "S-14 board, 1024px — expected Export in the page header, found it only in the toolbar."

---

## Design decisions worth knowing

| Decision | Why |
|---|---|
| Audio-first worker page | Many workers read their native script slowly; hearing it is faster and safer than reading |
| One crew link, name picker | Forty personal links cannot go into one WhatsApp group (PRD D1); identity is confirmed before the instruction opens |
| One question, three options, two attempts | Proves comprehension without feeling like an exam; a second wrong answer routes to a human, not a dead end |
| "Quick check," never "quiz" | A quiz has winners and losers; this is a safety confirmation |
| Status = icon + label + color | Never color-only; works for color-vision deficiency and in glare |
| Preview is mandatory | A mistranslated safety term is worse than no instruction |
| Worker page has no navigation | One job, one path; no place to get lost |
| 68px play, 48px targets, ≥16px body | The design constraint is a low-end Android held in one hand |
| Media controls never mirror | Play stays left-to-right even in RTL; the glyph is a physical convention |
| Native-script language names, no flags | Flags are national; languages are not |

---

## Phase 3 exit checklist

- [x] Design tokens defined, measured, and implemented (`tokens.css`)
- [x] Visual system documented: color, type, spacing, elevation, motion, iconography
- [x] 16 core components specified with all states
- [x] RTL rules documented and exercised in EN/AR supervisor and AR/UR worker
- [x] All v0.1 supervisor screens specified and built
- [x] All v0.1 worker screens specified and built, including dead ends
- [x] Answer logic (correct / wrong once / wrong twice / help) implemented
- [x] Preview and offline states implemented
- [x] Responsive behavior verified at 320, 360, 430, 1024, and 1440
- [x] Contrast measured; no unmeasured text pairs
- [x] Prototype runs with no dependencies and no console errors
- [x] Prototype guide with routes, deep links, review scripts, and handoff notes
- [ ] Native review of HI/UR/ML/BN worker copy (content task, not a design blocker)

The one open item is translation review. It needs native speakers, not more design; it must close before the pilot, not before Phase 4.

---

## Related documents

- [Product Brief](../docs/01-product-brief.md) — who this is for and why
- [PRD](../docs/02-prd.md) — requirements, journeys, acceptance criteria
- [User Flows & Wireframes](../docs/03-user-flows-wireframes.md) — structural wireframes this pack makes visual
- [TDD](../docs/04-tdd.md) — stack and architecture constraints
- [Database & API Spec](../docs/05-database-api-spec.md) — the contracts Phase 4 implements
- [Development Backlog](../docs/06-development-backlog.md) — 204h build plan
- [Test Plan](../docs/07-test-plan.md) — acceptance tests the real build must pass
- [Launch & Growth Plan](../docs/08-launch-growth-plan.md) — pilot and go-to-market

**Next phase:** 4 — System Architecture. Not started. Phase 3 stops here for sign-off.
