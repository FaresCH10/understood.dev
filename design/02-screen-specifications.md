# 02 — Screen Specifications

**Phase 3, document 2 of 3** · Version 0.1 · Date 2026-11-13
**Owner:** Founder · **Status:** Ready for build handoff · **Related:** [Visual system](./01-visual-system.md) · [Wireframes](../docs/03-user-flows-wireframes.md) · [PRD](../docs/02-prd.md)

This document turns the wireframes in [doc 03](../docs/03-user-flows-wireframes.md) into production-ready screen specifications: hierarchy, components, states, copy, responsive behavior, and prototype routes. It covers the v0.1 surfaces only. The v0.2 surfaces in [doc 03b](../docs/03b-v0.2-surfaces.md) are out of scope and are not built.

Every screen listed here exists in the clickable prototype. Where the prototype deliberately simulates something (audio, AI processing, CSV parsing), the note says so.

---

## How to read a spec

| Field | Meaning |
|---|---|
| **Route / deep link** | How to reach the screen in the prototype |
| **Purpose** | The one job the screen does |
| **Hierarchy** | Content order, top to bottom |
| **States** | Every state the build must implement |
| **Interactions** | What each control does, including failure paths |
| **Copy** | Fixed strings; other strings come from the microcopy deck in doc 03 §10 |
| **Responsive** | Behavior at the specified breakpoints |
| **Prototype note** | Simulation or shortcut, so it is not mistaken for production behavior |

Global rules that apply to every screen are in [01-visual-system.md](./01-visual-system.md): tokens, focus, motion, RTL, contrast, tap sizes, and voice.

---

# Part A — Supervisor

## Shell (all authenticated screens)

**Spec:** 252px sidebar (white, 1px border-inline-end), 60px sticky topbar (translucent `#F8FAFC`, blur), content column max 1180px with 28px/32px padding.

**Sidebar:** brand mark + "Understood"; org switcher "Al Noor Facilities · Dubai · Pilot"; nav Home / Instructions / Crews / Settings with icons and a 2-item count on Instructions; footer with "6 worker languages" and native names; EN/ع switch; user block "Yusuf Saleh · Supervisor".

**Topbar:** breadcrumbs (current view bold), live-sync pulse + "Live", notifications icon button (`aria-label`), primary "New instruction" button. At ≤880px the sidebar becomes an off-canvas drawer; the topbar keeps breadcrumb + primary action.

**RTL:** entire shell mirrors. Sidebar moves to the right; nav icons sit at the inline start; breadcrumbs reverse; the language switch order remains EN · ع.

---

## S-01 · Sign in

**Route:** `#signin` · **Purpose:** get a supervisor into the workspace with one email, no password.

**Hierarchy:** split screen. Left (or start-side) is the brand panel: mark, kicker "Understand your workers, not read receipts", H1 "Every worker understands. Every morning.", one supporting paragraph, three checkmarked promises, and a quote strip "18 of 24 understood by 07:10." Right is a 420px auth box: "Sign in", "One link by email. No password.", email field prefilled `yusuf@alnoor.ae`, primary "Email me a sign-in link", divider "or", ghost "Open the demo account", fine print "Demo build — no email is sent." Footer: "Understood · Pilot" and EN/ع switch.

**States:** idle; invalid email (inline error, focus returns); sending (button "Sending…" disabled); email sent (S-02); demo click (route to `#home`).

**Interactions:** Enter submits; magic link would open a new session in production; demo bypasses auth and is labeled as such. Language switch re-renders the panel and persists.

**Copy:** headline, subhead, and promises are fixed. Arabic mirrors the entire panel.

**Responsive:** ≤980px the brand panel stacks above the auth box; ≤620px only the auth box with a compact brand header. Auth box max-width 420px.

**Prototype note:** the email path shows S-02 but sends nothing. "Open the demo account" completes the flow. There is no password reset, SSO, or invitation path in v0.1.

---

## S-02 · Check your email

**Route:** reached from S-01 "Email me a sign-in link" · **Purpose:** confirm the link was sent and set expectations.

**Hierarchy:** auth box replaces the form with a mail icon, "Check your email", "We sent a sign-in link to {email}. It expires in 15 minutes.", the email in a chip, primary "Open email app" (mailto), ghost "Use a different email".

**States:** sent; resend disabled for 30 seconds (production); expired link returns to S-01 with an explanatory message.

**Interactions:** "Use a different email" returns to the form with the address preserved; "Open email app" is a convenience link only.

**Prototype note:** static state; no email is dispatched.

---

## S-03 · Home

**Route:** `#home` · **Purpose:** answer "what needs me this morning?" in under five seconds and offer the next action.

**Hierarchy:**
1. Page head: date eyebrow ("FRIDAY 13 NOVEMBER"), H1 "Good morning, Yusuf", sub "Here is what your crews need this morning.", primary "New instruction".
2. Four KPI cards: Understood 75% (18 of 24, green meter), Opened 23 (96%, teal meter), Needs help 2 ("waiting for you", amber icon), Pending 1 ("not opened yet", slate icon).
3. "Needs attention" + "View board" link. Up to three exception cards: help requests (amber, reason + time + "Mark resolved"), pending (slate, "Reminder"), wrong answers (red, "View"). Empty state: "Nothing needs attention. Every delivery is resolved."
4. "Recent instructions" + "See all". Rows: title, crew, time, language count, understood percentage/status pill. Clicking the seeded live instruction opens the board; the draft opens the composer; other sample rows show a "sample" toast.
5. "Quick actions": Review today's exceptions, Share the next briefing, Export the week. Each is a full-width row with icon, title, and a one-line explanation.

**States:** populated; no exceptions; loading (skeleton KPIs and cards); error (inline retry, never a blank page).

**Interactions:** "Mark resolved" updates the card and KPI counts in place, stays on Home, and toasts. "Reminder" opens the copy-reminder modal. Exception cards are not links; their action buttons are.

**Copy:** greeting is time-aware in production (morning/afternoon); the prototype fixes "Good morning". Dates use the org timezone.

**Responsive:** KPI grid 4 → 2 (≤1180) → 1 (≤620). Exception grid 3 → 2 → 1. Quick actions 3 → 1. Page actions wrap.

**Prototype note:** data is seeded; resolving persists only for the session.

---

## S-04 · Instructions list

**Route:** `#instructions` · **Purpose:** find, resume, or inspect any instruction.

**Hierarchy:** page head "Instructions", sub "Every briefing you have shared, in one place.", primary "New instruction"; tabs All / Shared / Drafts / Archived with counts; instruction rows (same component as Home) with status pills, understood meter, language count, and a chevron.

**States:** each tab populated; empty tab ("No instructions here yet." + "New instruction"); archived rows are read-only; draft row leads to composer step 1 with content restored (prototype session only).

**Interactions:** row click routes to board (shared) or composer (draft); archived sample rows toast "sample only" in the prototype. Tabs are keyboard operable and preserve scroll position.

**Responsive:** rows collapse from 6 columns to a stacked title + meta; tabs scroll horizontally rather than wrap at ≤620px.

**Prototype note:** four seeded rows; new instructions are not appended in v0.1 prototype.

---

## S-05 · Create crew (modal)

**Route:** `#crews` → "New crew" · **Purpose:** create a crew before adding workers.

**Hierarchy:** modal 520px: title "Create a crew", sub "A crew is the group that receives one link.", fields Crew name (required) and Site (optional, placeholder "Tower A · Business Bay"), footer Cancel / "Create crew".

**States:** idle; validation (empty name → red border, focus, no error toast); saving; created (modal closes, toast "«name» created", crew card appears).

**Interactions:** Enter submits; Escape/scrim closes without saving; creating does not navigate away from the crew list.

**Copy:** "Crew" not "Team" or "Group".

**Prototype note:** new crews have no workers and are not selectable in the composer (only Tower B is enabled in this prototype).

---

## S-06 · Crew detail

**Route:** `#crew/tb` · **Purpose:** manage the roster and see its language mix.

**Hierarchy:** breadcrumb Crews / Tower B; eyebrow "CREWS · TOWER B · BUSINESS BAY"; H1 crew name; sub "24 workers · 6 languages"; actions "Import CSV" (ghost) and "Add worker" (primary). Table card: search ("Search workers"), language filter (native names), count; columns Worker (avatar + name), Language (native + code chip), Phone (display-only), Added. Footer reinforces "Phone · Display-only in v0.1. Understood never messages workers directly."

**States:** populated; filtered to zero ("No workers match" in the table, count 0); read-only language column; phone empty → "—"; newly added workers appear at the end with today's date.

**Interactions:** search matches name, English language name, and native language name; filter combines with search; add/import update the roster immediately and toast; the table scrolls horizontally below 900px with the first column sticky in production (prototype scrolls without sticky).

**Responsive:** actions stack below the title at ≤620; toolbar wraps; count moves under the search.

**Prototype note:** additions mutate the session roster; the board remains a snapshot of the 24 seeded deliveries (documented behavior, not a bug).

---

## S-07 · Add worker (modal)

**Route:** S-06 → "Add worker" · **Purpose:** add one worker with a language the product can actually serve.

**Hierarchy:** modal 520px: title "Add a worker", sub "They will see instructions in their language." Fields: Name (required), Language (select, native + English), Phone (optional, help "Display-only for now. Understood never messages workers directly."), snapshot note ("Roster changes apply to future instructions; today's board is a snapshot."), footer Cancel / "Add worker".

**States:** idle; name required error; language defaults to Arabic; phone validation is permissive (display-only); success toast "{name} added to {crew}".

**Interactions:** Enter submits; Escape closes; the new row is visible behind the closing modal; the modal does not reset the table's search/filter.

**Copy:** never promise SMS or WhatsApp in v0.1.

**Prototype note:** no duplicate-name blocking here (CSV import does flag duplicates). Production should warn on exact duplicate within a crew.

---

## S-08 · CSV import — upload

**Route:** S-06 → "Import CSV" · **Purpose:** add a roster in bulk without leaving the crew.

**Hierarchy:** modal 560px: title "Import workers"; dropzone (file icon, "Drop a CSV here", "or choose a file"; accepts .csv/text/csv); secondary buttons "Download template" and "Try a sample"; note "Imports apply to future instructions. Today's board is a snapshot."; footer "Close".

**States:** idle; drag-over (teal border); file selected → S-09; parse error (inline "That file could not be read. Check the template and try again."); oversized file (limit stated in Phase 4); empty file ("This file has no rows.").

**Interactions:** the whole dropzone is a label for a hidden file input; template download produces `name,language,phone`; sample loads eight rows including deliberate errors. Nothing is written until S-09 confirmation.

**Responsive:** modal becomes a full-height sheet below 620px; dropzone remains tappable.

**Prototype note:** parsing is client-side for the sample only; file upload reads the file but the prototype's parser handles the documented template shape.

---

## S-09 · CSV import — review

**Route:** S-08 after file/sample · **Purpose:** show exactly what will be added and what will not, before committing.

**Hierarchy:** title "Review import"; summary "6 ready · 2 need attention" (counts adapt); table rows with name, language in native script, phone, and status: Ready (green check), Duplicate name in this crew (amber), Unknown language (amber). Footer: "Back" (ghost), "Remove invalid rows" (ghost, only when errors exist), primary "Import 6 workers". A note states the snapshot rule again.

**States:** all valid (single primary "Import N workers"); some invalid (as above); all invalid (primary disabled, "Remove invalid rows" disabled, guidance to fix the file); duplicate detection is case-insensitive and scoped to the crew; unknown languages list the six supported names in the helper.

**Interactions:** "Remove invalid rows" filters the table and updates counts; importing writes only valid rows, closes the modal, toasts "{n} workers imported", and updates the roster; back returns to upload without losing the selected file in production (prototype re-opens the sample).

**Copy:** errors must name the row and the fix: "Unknown language: Tagalog. Use Arabic, English, Hindi, Urdu, Malayalam, or Bengali." Prototype shortens to "Unknown language" in the table with the full message in the row tooltip/aria-description.

**Prototype note:** the sample intentionally includes one duplicate (Ramesh K.) and one unsupported language (Tagalog).

---

## S-10 · Composer — step 1 (Compose)

**Route:** `#composer` · **Purpose:** capture one instruction in the supervisor's own words and confirm the transcript.

**Hierarchy:** page head "New instruction" + stepper (1 Compose active / 2 Audience / 3 Generate); prototype tip ("Only Tower B is selectable in this prototype; generation is simulated."); two columns.
- Main card: Type segmented Task / Info with a one-line explanation; Title (optional); Message with mode segmented Voice / Text / Photo.
  - Voice: 58px teal mic button (records), duration readout, waveform, state label "Tap to record" / "Recording…" / "Recorded · tap to re-record"; transcript panel with "Detected English" chip, editable textarea, helper "Edit anything that was misheard.", and a confirm button that changes to "Confirmed".
  - Text: transcript-style panel with a 170px textarea and the same helper.
  - Photo: dropzone, caption field ("Add the instruction text…").
- Side card: Audience summary (Tower B, 24 workers, language dots), tip card ("You will review every translation before sharing.").
- Footer: "Save draft" (subtle) and "Next: audience" (primary).

**States:** empty title is allowed (derived from first sentence); message required (Next disabled until text or confirmed transcript); recording (pulse, timer, stop); transcript confirmed/unconfirmed; photo selected (filename replaces the dropzone label); draft saved (toast, no navigation); generation blocked when audience empty.

**Interactions:** mode and type switches preserve the typed text; re-recording discards the previous simulated audio; "Next" saves the state and moves to S-11; browser back returns to the previous supervisor view, not the previous step (prototype).

**Copy:** "Instruction" object; "Compose" step; never "Campaign" or "Message blast".

**Responsive:** ≤1180 the side card moves below the main card; ≤760 segmented controls stretch full width, the record card wraps, and the page actions become full-width.

**Prototype note:** recording is simulated (no microphone permission); duration is seeded at 0:38; the transcript is pre-filled from `DEMO.instruction.original`.

---

## S-11 · Composer — step 2 (Audience)

**Route:** `#composer` step 2 · **Purpose:** choose who receives the link and show the language workload before generation.

**Hierarchy:** stepper (1 done, 2 active); audience card with crew options (Tower B selected; Villa crew and Office team disabled with a "Pilot" pill), then "Who" segmented Everyone (24) / Selected; "Selected" opens a checkbox modal with count; language panel listing each language present, script initial, and worker count; note "Each worker receives only their language."; generation note ("Six short clips and six quick checks will be generated. You will review them next."); footer Back / primary "Generate 6 languages".

**States:** everyone; subset (count updates, zero selected disables Generate); crew with one language (Generate 1 language); no workers (Generate disabled with guidance); generating → S-12.

**Interactions:** selecting a subset updates the language counts live; the modal applies on confirm and restores focus; Back returns to step 1 with content intact; Generate stores the audience snapshot for this instruction.

**Copy:** "Audience" not "Recipients"; "Everyone" includes the count.

**Responsive:** language panel moves below the audience card; the subset modal scrolls internally.

**Prototype note:** only Tower B can be selected; the other crews are visible but disabled to show the pilot boundary.

---

## S-12 · Processing

**Route:** `#processing` · **Purpose:** show honest progress while six variants are generated, and let the supervisor leave without losing the job.

**Hierarchy:** centered card: sparkles orb, "Preparing 6 languages", sub "Translating, writing a quick check, and recording audio for each language."; overall progress bar; meta "0 / 6 ready" and the instruction title; one row per language with native name, three stages (Translate → Question → Audio) as labeled steps, and a status label (Queued / Translating / Writing question / Recording audio / Ready with check); safety line "Nothing is shared until you review it."; quiet "Skip animation" link; when all complete, primary "Review translations" appears plus "Opening automatically…".

**States:** queued; in progress; one language failed (row turns red with "Couldn't prepare audio" + Retry + "Share without audio" in production); all ready (auto-advance after 2.2s unless the user interacts); skipped (jumps to preview with whatever is ready; production blocks sharing incomplete variants); tab hidden (timers pause/resume in production).

**Interactions:** "Skip animation" navigates immediately; "Review translations" is always available once ready; retry re-runs only the failed language.

**Copy:** stage names mirror the actual pipeline; never claim a stage finished before it has.

**Responsive:** rows stack stages vertically below 760px; the card loses side padding on phones.

**Prototype note:** generation is timed (280ms stagger, 440ms per stage) and always succeeds. No real API calls are made.

---

## S-13 · Preview and share

**Route:** `#preview` · **Purpose:** the trust screen. The supervisor must be able to verify every language before one link goes out.

**Hierarchy:**
1. Page head: eyebrow "Instructions · {title}", H1 "Review before sharing", sub "Check every language. Workers will see exactly this.", meta pills Ready / 24 workers / 6 languages; actions Back, primary "Share".
2. Original card: "What you said" + source chip (mic, "English · voice"), original transcript.
3. Variant grid (2 columns ≥1200, 1 below): each variant card has script initial, native name, "RTL · 0:41" sub, Ready pill; audio row with 40px play and duration; translated text at 15px with correct `dir` and script font; quick-check block with three options and the correct one marked "Correct"; footer actions Edit text / Edit question / Regenerate.
4. Editing a translation opens an inline textarea with Save/Cancel and a note "Audio will be updated to match." Editing a question opens a modal with the question, three options, and a correct-answer radio (production); saving marks the variant edited.
5. Share opens the right drawer (S-13a).

**States:** all ready; edited variant (edited badge, audio regenerating in production); regenerating (per-card progress, actions disabled); one variant failed (red card with retry + "Open advanced" to proceed without that language, gated by a confirmation); zero variants (cannot reach); RTL variants render right-aligned with Arabic font while the card chrome stays in the supervisor language.

**Interactions:** audio preview streams the generated clip (prototype simulates with a timer); edit/regenerate affect only that variant; back returns to audience; share never sends until the drawer's primary is pressed.

**Copy:** "Review before sharing" is mandatory language; never "Looks good?" without the ability to verify.

**Responsive:** variant grid 2 → 1 at ≤1100; sticky page actions at ≤760; audio rows wrap duration below the title.

**Prototype note:** translations are seeded; edits persist for the session; audio is simulated at 4× speed; regenerate shows a toast and restores the card.

### S-13a · Share drawer

**Hierarchy:** 440px right drawer: header "Share this instruction" + sub "One link. Every worker opens it in their language."; link block (short link, Copy) with live/not-shared helper; WhatsApp message preview with EN/العربية toggle and Copy message; QR block (decorative in prototype, functional in production) with "Print this for the site noticeboard."; audience summary (Tower B · 24 workers · 6 languages); footer primary "Share now" (or "View live board" after sharing), ghost "Preview as a worker" (opens the worker prototype in Arabic preview mode), quiet "Regenerate link".

**States:** not shared (link exists, primary "Share now"); shared (green "Shared" banner, primary becomes "View live board"); copied (toast); regenerated (confirmation modal, old link dies immediately, board unaffected).

**Interactions:** "Share now" marks the instruction shared, closes the drawer, routes to the board, and toasts "Shared with 24 workers"; copy uses the clipboard with a fallback; the worker preview opens in a new tab with `preview=1`, never recording.

**Copy:** "Share" is the act; "Send" is reserved for help requests and messages.

**Prototype note:** QR is generated decorative SVG; "Open worker view" opens `worker.html?state=instruction&preview=1&lang=ar&worker=w4`.

---

## S-14 · Instruction board

**Route:** `#board` · **Purpose:** the daily operational screen: who understood, who needs help, what to do next.

**Hierarchy:**
1. Page head: eyebrow "Shared · Tower B — morning", H1 instruction title, sub "Shared at 06:58 with Tower B · 6 languages", actions Copy link, Copy reminder, Export CSV, overflow (Regenerate link / Archive).
2. Four KPI cards: Targeted 24 (crew name), Opened 23 / 24 (96%, teal meter), Understood 75% (18 of 24, green meter), Needs help 2 ("waiting for you").
3. "Needs attention" strip: up to three exception cards with severity label, worker, reason/time, and action (Mark resolved / Reminder / View). Empty: "No exceptions. Everyone is covered."
4. Workers table card: title "Workers", filter chips All 24 / Not opened 1 / Wrong first 3 / Needs help 2, search, columns Worker / Language / Status / First / Help / Opened / Completed. Status uses icon + label + tint; First shows "Correct" or "Wrong"; Help shows reason or "—"; times tabular. Footer "{shown} / 24 workers" and live-updated note "Updated just now · Auto-refreshes every 15s".
5. Row click opens the worker drawer (production): delivery timeline, first answer, help reason, resolution; not implemented in the prototype beyond row hover.

**States:** default all; each filter; search no-match row; help resolved (card disappears, KPI decrements, chip count updates); archive (confirmation, board becomes read-only, link closes); regenerated link (old link shows W-08); live update (new completions animate once, no layout jump); empty delivery set (defensive only).

**Interactions:** filters and search combine; "Mark resolved" updates counts without leaving the page; "Reminder" opens a copy-ready WhatsApp message (no direct send in v0.1); "Export CSV" opens S-15; overflow archive is destructive and confirmed.

**Copy:** "Understood" is defined in the tooltip/sub as "first attempt correct + Done". "Needs help" includes auto-flags. Never label workers "non-compliant".

**Responsive:** KPI 4 → 2 → 1; exception strip 3 → 2 → 1; table scrolls horizontally below 1100; page actions wrap and Export remains reachable.

**Prototype note:** 24 seeded deliveries with 18 understood, 23 opened, 3 wrong-first, 2 open help requests, 1 pending. Roster changes do not alter this snapshot. Worker interactions in the separate worker prototype do not write back to the board.

---

## S-15 · Export dialog

**Route:** S-14 → "Export CSV" (also Home quick action, Settings) · **Purpose:** produce an audit-ready CSV with an explicit choice about sensitive columns.

**Hierarchy:** modal 560px: title "Export delivery record", sub "One row per worker for this instruction. Arabic and Urdu names stay intact in Excel."; options Include help reasons (checked) and Include open/completion times (checked), each with a one-line explanation; preview table (Worker, Language, Status, First attempt, Opened); footer Cancel / "Download CSV".

**States:** default; options toggled (preview columns update); exporting (button busy); success (modal closes, toast "Exported 24 rows"); no data (primary disabled with "Nothing to export yet.").

**Interactions:** download is a UTF-8 CSV with BOM (Excel-safe), one row per worker, ISO timestamps in the org timezone in production; file name `understood-delivery-record-YYYY-MM-DD.csv`; help reason excluded when unchecked but help flag preserved.

**Copy:** "Audit-ready" is allowed; do not claim legal compliance.

**Prototype note:** generates and downloads a real CSV from the seeded board; file name fixed to 2026-11-13.

---

## S-16 · Settings

**Route:** `#settings` · **Purpose:** org identity, language policy, and data controls.

**Hierarchy:** page head "Settings", sub "Organization, language, and data.", primary "Save"; sections:
1. Organization: name field, timezone select (Asia/Dubai, Asia/Riyadh), supervisor language EN / العربية with note "Arabic mirrors the entire supervisor interface."
2. Worker languages: all six with native name + Active pill; note "All six languages are always available to every crew."
3. Data & audit: record retention statement, export card (24 workers · 13 Nov 2026) with "Export all instructions"; Sign out with user block.
4. Danger zone: Delete organization disabled with "Not available in the pilot."

**States:** clean; dirty (Save enabled, unsaved indicator); saved (toast); language change (instant re-render, persisted); sign out (confirmation → S-01); export (S-15 in all-instructions mode).

**Interactions:** Save persists org name/timezone and toasts; changing supervisor language applies immediately and updates the switch; sign out clears the session (prototype returns to sign-in).

**Responsive:** sections stack; Save stays in the page head and wraps below the title on phones.

**Prototype note:** settings persist for the session only; delete is disabled by design.

---

# Part B — Worker

## Worker shell (all screens)

Phone canvas, max 480px centered on tablets, full-bleed ≤620px. No nav bar, no hamburger, no settings. Header: org name (start), language chip (end) with globe + native name. Header is sticky; banners stack below it. Content padding 18px (14px at ≤360px). Actions live in a sticky bottom bar on W-02; terminal screens center their content.

**RTL:** Arabic and Urdu mirror the shell: org name right, language chip left; text right-aligned; directional back icons flip. Media controls do not mirror.

**Font:** body switches to the selected language's script family. Latin names stay bidi-isolated inside RTL text.

**States that apply everywhere:** preview banner (blue), offline banner (amber), language sheet, text zoom to 200%, reduced motion.

---

## W-01 · Name picker

**Deep link:** `worker.html?state=picker&lang=ar` · **Purpose:** identify the worker with one tap, without accounts.

**Hierarchy:** instruction title (in the current UI language, 26px); "Select your name"; 50px search ("Search your name"); two-column grid of name tiles (avatar initials, first name + last initial, native language); empty search message "No name matches"; footer link "My name isn't here".

**States:** grid (>20 workers shows search; ≤20 hides it per doc 03); returning worker (single card "Continue as Ramesh K. · മലയാളം", primary "Yes, that's me", ghost "This isn't me", link "Select your name"); filtered; no match; preview (grid only, no returning card); language changed.

**Interactions:** tap tile → W-02 in that worker's language (unless a `lang` override is present in the prototype deep link); search filters on every keystroke across name and script; "This isn't me" clears the remembered worker and shows the grid; "My name isn't here" → W-10; language chip → W-11 sheet.

**Copy:** "Select your name", "Continue as", "Yes, that's me", "This isn't me". Never "Login", "Employee ID", or a phone number.

**Privacy:** first name + last initial only; collisions show full last name + numeric suffix (rule from WORK-1; not triggered by seed data). No phone numbers.

**Prototype note:** 24 seeded workers; search is always shown because the crew is 24; the returning card appears only outside preview after a worker has completed or changed language.

---

## W-02 · Instruction page

**Deep link:** `worker.html?state=instruction&lang=ar&worker=w4` · **Purpose:** understand the task and prove it with one question.

**Hierarchy:** instruction title; audio hero (teal card: 68px play, "Listen", waveform, progress, time, "Tap to listen"); instruction text card at 17px with the safety disclaimer (shield icon, 10.5px); "Quick check" section with question (19px), "Choose one answer" hint, three 58px options with script-appropriate letter chips; feedback area; sticky bottom bar with 54px "Done"/"Got it" (disabled until answered correctly or after the second miss) and a quiet underlined "I need help" link.

**States:** unanswered (Done disabled); playing (pause icon, live waveform, progress); ended (time at duration, play resets); correct (W-03); first wrong (W-04a); second wrong (W-04b); help requested (help link disabled, check icon, "Help requested"); offline (banner; answer queued text in production); preview (blue banner); language changed; audio unavailable (text-first fallback + retry, production).

**Interactions:** the entire audio card toggles playback; the inner play button is the AT control; audio never autoplays; options lock after a correct answer or second miss; Done routes to W-07 and records completion; help opens W-05. Scrolling is native; the action bar remains reachable.

**Copy:** "Quick check", never "Quiz". "Choose one answer." Feedback strings are fixed per language (see `data.js`). The disclaimer is mandatory on every instruction.

**Responsive:** 320–430px; type scales down one step at ≤360; the audio button is 62px at ≤360; options never shrink below 15.5px text or 56px height.

**Prototype note:** audio is simulated at 4× speed with no sound; tapping anywhere on the teal card starts/pauses.

---

## W-03 · Correct answer

**State of W-02.** The chosen option turns green with a check at the inline end; other options dim and disable; feedback "Correct — you're ready." in a green panel; Done enables. The correct option is announced to screen readers via a live region in production.

**Prototype:** `?state=instruction&attempt=correct`.

---

## W-04 · Wrong answer states

**First miss:** selected option turns red and shakes once; feedback "Not quite. Listen again, then try once more." with a 40px "Listen again" button that scrolls to the audio card and starts playback. Options remain tappable for one retry. Done stays disabled.

**Second miss:** the correct option turns green and all options disable; feedback "The correct answer is highlighted. Your supervisor will be notified to help you."; delivery is flagged `needs help · I don't understand`; Done enables. The worker is never blocked from completing.

**States:** `attempt=1`, `attempt=2`. A second miss on the same wrong option still counts as the second attempt.

**Copy:** no "failed", no score, no "try again later".

**Prototype note:** the auto-help flag is represented only in the feedback copy; the separate board is not mutated.

---

## W-05 · Help reason sheet

**Deep link:** `worker.html?state=instruction&sheet=help` · **Purpose:** let a worker ask for help in one tap with a reason the supervisor can act on.

**Hierarchy:** bottom sheet: handle; "I need help"; "Choose what you need. Your supervisor will be notified."; four 52px radio rows (I don't understand / Missing tools or materials / Safety concern / Other); footer Cancel / Send (disabled until a reason is selected).

**States:** no selection (Send disabled); selected (radio filled, primary enabled); sending (busy); sent → W-06; scrim tap/Escape cancels with no record.

**Interactions:** selecting a reason does not send; Send records the reason and time; Cancel discards.

**Copy:** four reasons exactly; no free-text field in v0.1.

**Prototype note:** sending updates only the worker UI (help sent + disabled help link); no email or board write-back exists across prototype pages.

---

## W-06 · Help sent

**Deep link:** `worker.html?state=help-sent` · **Purpose:** confirm the request without promising a time.

**Hierarchy:** green check orb; "Your supervisor has been notified."; "Help is on the way."; primary "Close".

**States:** default. Close returns to W-02 with the help link disabled and labeled "Help requested".

**Copy:** do not say "Someone will be with you in 5 minutes." The ≤10-minute supervisor email SLA is internal, not a worker promise.

**Prototype note:** static confirmation; no delivery of email.

---

## W-07 · Completed

**Deep link:** `worker.html?state=completed&lang=en&worker=w3` · **Purpose:** close the loop and allow a replay.

**Hierarchy:** green check orb; "You completed this instruction"; "Today · {worker}"; completion time (seeded from delivery, e.g. 07:15); ghost "Listen again". Tapping it expands a recap with the full audio card and text, auto-playing once (user-initiated). If reached from a link after completion, this is the reopen state.

**States:** default; recap open; preview (blue note); offline (amber note); no worker identified (name omitted).

**Interactions:** replay is optional and never re-records completion; back navigation to W-02 would show the completed state in production (the prototype deep link is explicit).

**Copy:** "You completed this instruction", "Listen again". No confetti, no score.

**Prototype note:** completion time comes from the seeded worker record.

---

## W-08 · Closed link

**Deep link:** `worker.html?state=closed&lang=ur` · **Purpose:** explain a dead link without exposing internals.

**Hierarchy:** lock orb (slate); "This instruction is closed."; "Ask your supervisor for a new link."

**States:** default. No retry, no form, no org contact details in v0.1.

**Copy:** never show "404", "expired token", or a stack trace.

**Prototype note:** static.

---

## W-09 · Preview banner

**Deep link:** any worker screen with `preview=1` · **Purpose:** assure the supervisor that test answers are not recorded.

**Spec:** blue banner under the header, eye icon, "Preview — responses are not recorded", 12.5px/500, full-width, no dismiss. The banner persists across W-01, W-02, W-03/04, W-06/07. Preview mode never writes the returning-worker record or language preference.

**Prototype note:** enforced in the worker state logic; toggled from the prototype panel.

---

## W-10 · Name not found

**Deep link:** `worker.html?state=notfound&lang=ur` · **Purpose:** recover gracefully when a worker cannot find their name.

**Hierarchy:** user-x orb (blue); "My name isn't here"; "Ask your supervisor to add you to this instruction."; ghost "Choose another name" (back to W-01).

**States:** default. In production, this event is counted as a roster gap for the supervisor (not in v0.1 UI beyond the link).

**Copy:** never blame the worker or imply they are not employed.

**Prototype note:** reached from W-01 footer link.

---

## W-11 · Language change

**Deep link:** `worker.html?state=instruction&sheet=lang` · **Purpose:** recover from opening someone else's device or a wrong default.

**Hierarchy:** bottom sheet: "Change language"; six rows with native name (in its script), English name, and a check for the current language; note "This changes your language for future instructions too."; footer Cancel / Save.

**States:** current language checked; draft selection (check moves, page does not re-render until Save); saving re-renders the entire worker UI in the selected language and direction, preserving scroll; worker record updated (unless preview).

**Interactions:** selecting a row updates only the sheet; Save commits; Cancel discards; language persists in `localStorage` for the prototype and on the worker record in production.

**Copy:** native names only in the primary line; English as the secondary label.

**Prototype note:** switching changes the instruction variant, question, and action labels instantly. All six languages are drafts except EN/AR.

---

## W-12 · Offline / weak connection

**Deep link:** any worker screen with `offline=1` · **Purpose:** keep the worker moving without lying about delivery.

**Spec:** amber banner under the header, wifiOff icon, "You're offline. Your answer will send when you're back online." The instruction remains fully readable if cached (production); audio streams or falls back to text; answering and Done remain available; help attempts are queued with a visible "will send when online" note. On reconnect, the banner disappears and the queued answer posts once, idempotently.

**States:** offline before load; offline after load; reconnect syncing; sync failed (red inline note + Retry). v0.1 does not guarantee offline caching; this screen specifies the behavior the build must target when caching ships.

**Prototype note:** banner only; network is not actually intercepted.

---

## Part C — Cross-screen rules and states

### State matrix

| Surface | Loading | Empty | Error | Partial | RTL | Reduced motion |
|---|---|---|---|---|---|---|
| Home | KPI/card skeletons | No exceptions / no recent rows | Inline retry | Some KPIs unavailable | Mirrors | No entrance animation |
| Instructions | Row skeletons | Per-tab empty | Inline retry | Archived read-only | Mirrors | No entrance animation |
| Crew detail | Table skeleton | No workers → Add worker | Inline retry | New rows appended | Mirrors | None |
| Composer | — | Message empty → Next disabled | Transcript/parse errors | Photo without caption | Mirrors | No mic pulse |
| Processing | Stage labels | — | Per-language retry | Partial ready blocks share | Mirrors | Stages update instantly |
| Preview | Skeleton cards | — | Per-variant retry | Share gated | Variant text RTL inside LTR chrome | No card hover lift |
| Board | KPI skeleton | No deliveries (defensive) | Inline retry | Filters narrow to zero | Mirrors | Live dot static |
| Settings | — | — | Save error inline | Disabled controls | Mirrors | None |
| Worker | Text + audio skeleton | No names match | Audio unavailable → text fallback | Offline queue | Full mirror except media | All animations off |

### Responsive summary

| Breakpoint | Supervisor | Worker |
|---|---|---|
| ≥1440 | 252px sidebar, 1180px content, 2-col preview | Device frame 412px centered (prototype only) |
| 1180–1439 | Sidebar 252px, content fluid, preview 2→1 at 1100 | Frame unchanged |
| 1024–1179 | Sidebar collapses to 72px icons + tooltips | — |
| 880–1023 | Off-canvas sidebar, topbar retained | — |
| 768–879 | Degraded but functional; tables scroll | — |
| 621–767 | Single column, wrap actions | Full-bleed phone at 480px max? No: ≤620 full-bleed |
| 361–620 | — | Full-bleed, 18px padding |
| ≤360 | — | 14px padding, 56px actions, 16px body, 62px play |

### Prototype traceability

| Screen | Prototype route |
|---|---|
| S-01 / S-02 | `#signin`, then "Email me a sign-in link" |
| S-03 | `#home` |
| S-04 | `#instructions` |
| S-05 | `#crews` → New crew |
| S-06 | `#crew/tb` |
| S-07 | `#crew/tb` → Add worker |
| S-08 / S-09 | `#crew/tb` → Import CSV → Try a sample |
| S-10 / S-11 | `#composer` (steps 1 and 2) |
| S-12 | `#composer` → Generate |
| S-13 / S-13a | `#preview`, then Share |
| S-14 | `#board` |
| S-15 | `#board` → Export CSV |
| S-16 | `#settings` |
| W-01 | `worker.html` or `?state=picker` |
| W-02 | `worker.html?state=instruction&lang=ar&worker=w4` |
| W-03 / W-04 | `?attempt=correct`, `?attempt=1`, `?attempt=2` |
| W-05 / W-06 | `?sheet=help`, `?state=help-sent` |
| W-07 | `?state=completed&lang=en&worker=w3` |
| W-08 | `?state=closed&lang=ur` |
| W-09 / W-12 | `?preview=1`, `?offline=1` (any worker screen) |
| W-10 | `?state=notfound&lang=ur` |
| W-11 | `?sheet=lang` (any worker screen) |

### Build handoff notes

- Every interactive element in these specs exists in the prototype; production must preserve the same state coverage, not just the visuals.
- The board is the operational center; do not let visual polish slow its first paint or reduce its scanability.
- The worker page must remain usable on a 320px screen with one thumb and intermittent connectivity.
- Strings not specified here come from [doc 03 §10](../docs/03-user-flows-wireframes.md#10-microcopy-deck-core-strings) and `prototype/data.js`; EN/AR are canonical, the other four languages need native review.
- Any new state or control must be added to this document and the [visual system](./01-visual-system.md) before implementation.
