# 05 — Concierge MVP Runbook

**Phase 1 · Version 0.1 · 2026-11-13**
**Purpose:** test the full loop — voice note → worker's language → one comprehension question → supervisor proof — with one real crew, no product code, in two weeks.
**Time budget:** 30–45 minutes per instruction, 3 instructions per week, 2 weeks. Cap: 6 instructions.

---

## 1. What this test proves (and doesn't)

**Proves:**

- A supervisor will hand over a real instruction and forward a link to the existing WhatsApp group.
- Workers will open/answer on their own phones, in their language, within 24 hours.
- A 3-option comprehension question is understandable and acceptable.
- The supervisor values seeing who answered correctly — and asks for it again.
- A real crew, real languages, and a real instruction can produce the first case-study numbers.

**Does not prove:**

- That the software is scalable, secure, or fast.
- That audio quality is good enough at scale (manual TTS is not the product).
- That the price is right (only the pilot tests payment).
- That the worker UX is final (the form is clunkier than the product, so results are a lower bound).

---

## 2. Guardrails (non-negotiable)

| Guardrail | Rule |
|---|---|
| **No safety-critical instructions** | Do not use fire safety, working at height, electrical, chemical, confined space, or emergency content. Use operational, non-safety instructions in the concierge test. |
| **Supervisor consent** | The supervisor agrees in writing (WhatsApp is fine) to the test, the data use, and the worker notice. |
| **Worker notice** | The form's first screen says: "This is a communication test. Your name and answer are visible to your supervisor. It supports, and does not replace, your company's training and safety procedures." |
| **Minimum data** | First name + language only. No phone numbers, no photos, no ID, no location, no performance rating. |
| **No recording of workers** | Do not record audio/video of workers. The supervisor's instruction audio is used only for the test. |
| **No employment decisions** | Explicitly agree: answers are not used for discipline or performance reviews. |
| **Deletion** | Delete the form responses and audio files within 30 days of the test, or when the org asks. |
| **One crew** | 10–25 workers, two or more languages, one supervisor. Do not scale the manual process. |

If the supervisor wants to test a safety instruction, decline and explain: the product is a communication aid, not a certified training tool, and the concierge test deliberately avoids safety-critical content.

---

## 3. Crew selection

| Criterion | Target |
|---|---|
| Workers | 10–25 |
| Languages | 2–4 (e.g., Hindi, Malayalam, Urdu, Arabic) |
| Site | One site, one shift, stable roster for two weeks |
| Supervisor | Willing to send 3 instructions/week and forward a link |
| Phones | Workers have access to a smartphone with WhatsApp and data; at least one shared phone is acceptable if workers use it one at a time |
| Literacy | Mix of reading levels; audio-first is the point |
| Relationship | Friendly but honest; not a friend who will fake enthusiasm |

If no crew is available, do not simulate one. The test waits for a real crew.

---

## 4. Tools (free)

| Need | Tool | Notes |
|---|---|---|
| Instruction capture | WhatsApp voice note to the founder | The supervisor's existing habit |
| Transcription | Whisper via a free tool, or manual typing | Keep the transcript short; confirm with the supervisor |
| Translation | DeepL free / Google Translate | Native-speaker check for any ambiguous phrase; no safety content |
| Audio | Azure Speech free tier (or another TTS with the target language) | One MP3 per language; 20–30 seconds |
| Delivery | The existing WhatsApp group | Send the audio files + one form link |
| Question/response | Google Forms (or Tally) | One form, language sections, name dropdown, 3 options |
| Tracking | [concierge-tracker.csv](./concierge-tracker.csv) | One row per instruction |
| Summary | WhatsApp message + a one-page PDF/Google Doc | Sent to the supervisor by 18:00 |

**Do not buy tools for this test.** If a free tier runs out, reduce the number of languages or instructions.

---

## 5. Form design

Keep it under 60 seconds.

**Screen 1 — Notice**

> This is a communication test for {company}. Your supervisor will see your name and answer. It is not a test of you, and it will not be used for discipline. It supports, and does not replace, your company's training and safety procedures.

**Screen 2 — Name**

> Select your name: {dropdown of first names only}

**Screen 3 — Language**

> Choose your language: हिन्दी · മലയാളം · اردو · العربية · English

Use branch logic to show the question in the chosen language. If branching is too complex, create one form per language and post all links with a clear label.

**Screen 4 — Question**

> Listen to the audio, then answer:
> What should you do first?
> A) {option}
> B) {option}
> C) {option}

One question. Three options. Exactly one correct. The question tests the **action**, not trivia. No "why" or free text.

**Screen 5 — Done**

> Thank you. Press "Submit" when you are finished.

**Important:** audio is sent as an MP3 in the WhatsApp group (or linked at the top of the form). The form itself should not require listening to a long file before the question; keep the audio 20–30 seconds.

---

## 6. The daily workflow

| Time | Step | Owner |
|---|---|---|
| 06:15 | Supervisor sends a 20–30 second voice note to the founder on WhatsApp | Supervisor |
| 06:20 | Founder transcribes (or uses Whisper), confirms the transcript with the supervisor in one message | Founder |
| 06:30 | Founder translates into each language; generates one MP3 per language; creates/updates the form | Founder |
| 06:45 | Founder sends the audio files and form link back to the supervisor with a ready-to-forward message | Founder |
| 07:00 | Supervisor forwards audio + form link to the crew WhatsApp group | Supervisor |
| 07:00–18:00 | Founder monitors responses; no chasing of workers | Founder |
| 18:00 | Founder sends a one-message summary to the supervisor: sent, answered, correct, help/confusion, one insight | Founder |
| Next morning | Supervisor decides whether to follow up with anyone who didn't answer | Supervisor |

**Instruction length:** 20–30 seconds, one action, one condition. Example: "Before 9 a.m., clean the lobby glass with the blue cloth, then tell me when it's done." Avoid multi-step instructions in week 1.

---

## 7. Two-week script

### Week 1 — can the loop work?

| # | Instruction (non-safety) | Languages | Why |
|---|---|---|---|
| 1 | "Clean the lobby glass before 9 a.m. with the blue microfiber cloth; tell the supervisor when done." | Hindi, Malayalam | Simple, observable, one action |
| 2 | "Today, empty the bins on floors 3 and 4 before the 11 a.m. break; report to the supervisor." | Hindi, Urdu, Arabic | Two locations, sequence |
| 3 | "Wear the new uniform shirt tomorrow; collect it from the store before the shift." | Malayalam, Bengali, Arabic | Personal action, different vocabulary |

### Week 2 — can it handle variety?

| # | Instruction | Languages | Why |
|---|---|---|---|
| 4 | "The client is visiting at 2 p.m. Clean the reception and meeting rooms first; then continue your normal route." | All | Priority change |
| 5 | "Put the wet-floor sign in the corridor after mopping; remove it when the floor is dry." | All | A near-safety operational instruction with a physical object — keep it simple and non-critical |
| 6 | "Tomorrow's shift starts at 6:30, not 7:00; confirm you received this." | All | Time change; tests whether the question catches the detail |

If a supervisor wants to use a real instruction from the day, replace the scripted one — as long as it is non-safety.

---

## 8. Measurement

**Response = submitted the form.** The concierge form cannot measure "opened" reliably; the product will. Do not report open rate from this test.

| Metric | Formula | Target |
|---|---|---|
| Response rate | Submitted ÷ targeted | ≥60% in at least one instruction |
| First-attempt correct | Correct answer ÷ submitted | ≥60% |
| Median response time | Median(submit time − share time) | < 4 hours (directional) |
| Help/confusion | Replies or questions to the supervisor ÷ targeted | Record, no target |
| Supervisor repeat | Asks for the next instruction without prompting after day 3 | Yes/No |
| Supervisor value | Would pay for this? Would recommend? | Qualitative |

Use [concierge-tracker.csv](./concierge-tracker.csv); one row per instruction. Add a note for every worker who replies "I don't understand" or asks a colleague.

---

## 9. Daily summary to the supervisor

Send by 18:00, one WhatsApp message:

> Today: {sent} instructions, {answered}/{targeted} answered, {correct} correct first time, {confusion} asked a question. One thing I noticed: {insight}. Tomorrow's instruction? Send it before 6:15 if you can.

No worker names in the summary unless the supervisor needs them for follow-up; the supervisor already sees the form responses.

---

## 10. End-of-test interview (15 minutes)

Ask the supervisor:

1. What worked? What felt like extra work?
2. Which workers answered, and which didn't? Why do you think?
3. Was the comprehension question useful, or did it feel like a test?
4. Did the audio sound natural? Which language was worst?
5. Would you keep using this next week? Why?
6. Would you pay $490 for an 8-week pilot? Who else would need to approve?
7. What would make you stop using it?
8. Can I use the aggregate numbers (no worker names) in a case study?

Record answers within 24 hours. This is the first pilot conversation.

---

## 11. Failure modes and fixes

| Symptom | Likely cause | Fix |
|---|---|---|
| Low response | Link buried; sent after shift; supervisor didn't forward | Re-send at shift start; pin the message; send audio and form separately |
| Workers answer in the wrong language | Language picker confusing; labels unclear | Use native script labels; one form per language; test on a worker's phone |
| Audio won't play | File format/size; WhatsApp compression; data | Use MP3, 20–30s; test on a low-end Android; offer text fallback |
| Form too long | Too many screens/questions | One question, name, submit; no email collection |
| Supervisor forgets | No ritual | Set a 06:00 reminder; create the instruction together the night before |
| Workers ask "is this a test?" | Fear of surveillance | Re-read the notice; emphasize no discipline; supervisor explains in the group |
| Supervisor wants safety content | Habit / urgency | Decline; explain the guardrail; use an operational instruction instead |

---

## 12. Decision rule

| Result | Decision |
|---|---|
| ≥60% response, ≥60% correct, supervisor asks to continue | The loop is real. Use the numbers in the pilot proposal and proceed to build. |
| Response ≥60%, correctness <60% | The channel works; the question/translation does not. Fix question design and audio before build. |
| Response <60% after two fixes | The channel or the crew is wrong. Test SMS/personal links or another crew before building. |
| Supervisor does not ask to continue | The pain is not strong enough, or the manual process is too heavy. Interview more; do not build yet. |
| Workers report confusion or fear | Stop and fix the notice/language; do not proceed until the supervisor confirms comfort. |

---

## 13. Cleanup

- Delete form responses and audio files within 30 days.
- Keep only the aggregate numbers and anonymized quotes (with permission).
- Send the supervisor a one-page result summary and the communication audit.
- Log the pilot interest in [pilot-candidates.csv](./pilot-candidates.csv).
- Write a 5-bullet note in the exit memo: what worked, what broke, what changed in the MVP.

---

**Next:** recruit the crew this week; run instruction #1 by 20 Nov.
