# Suspended, Coastal — M2 cartridge

Single-file `index.html`: scene-runner engine copied verbatim from
`arcade/cabinet/scene-runner.html`, a Windows 98 skin, `CARTRIDGE` inline
(byte-equal to `cartridge.json` — run `node check-cartridge-equal.js`). Open
`index.html`, pick two units, read the brief, spend pings, sort each result,
draft a position, ride the complication, export (Copy/Download). F1/F2/
Back-to-Canvas live in the bottom taskbar.

## The seven pings (budget 3, +1 if you reopen)
Routed through one of two chosen field units — Nomad (docks), Fixer
(people), Infiltrator (records), Influencer (public) — each returning
different evidence text; written for all four units.

1. **"Modern" needs to mean** — real: reliable, no redesign implied.
2. **"Lose a berth" in practice** — real: paid stays booked through a drop.
3. **Which behaviours are essential** — real: confirm, queue, same-day change.
4. **What the council sees about a captain** — real: booking/payment only.
5. **Which ledger technology** — solution-in-disguise: error dialog; spends
   budget; establishes nothing.
6. **Colours and theme** — cosmetic: "Did you know…" tip; spends budget.
7. **Who uses it, from where** — real: boat-side handsets, not a desk.

Every ping is sorted **File as Evidence** / **File as Assumption** onto two
boards. Filing ping 5 or 6 as Evidence routes through an **Office
Assistant** popup ("treating a preference as a requirement!") first.

## Position (after 3 pings)
Free-text Properties dialog: supported evidence, remaining uncertainty,
likely FR, likely NFR, one assumption not confirmed, why defensible — all
required. Confirm dialog ("cannot send more pings") locks it.

## Complication
Yellow-triangle System Alert: intermittent uplink, sessions dropping
mid-transaction, a berth that can be half-booked.

## Revision moves
- **Revise** — no cost; second Properties dialog (what changed, why).
- **Keep** — no cost; logged to Assumptions as risk accepted.
- **Defer** — no cost; logged to Assumptions as open question.
- **Reopen** — 1 Fate point; one more ping, then the same revision form.

## Compel
The Fixer (if chosen) or the harbour-master offers the auditor's vendor
shortcut. Accept: +1 Fate, logged as a shortcut without evidence. Refuse:
−1 Fate (disabled at 0 — reopening forecloses refusing later).

## Windows 98 trope → gate
Wizard → the brief. Confirm → the ping's cost becomes visible. Error dialog
→ a ping that established nothing. Tip box → the cosmetic ping. Assistant →
catches a solution filed as evidence. System Alert → the complication.
Status bar → `PINGS · Fate chips · SHIFTS` (fate now minus starting fate 1).

## What I changed from spec, and why
- **Free-text form.** The shared engine has no prose field. Added one
  additive `scene.form` node (own copy only; `scene-runner.html` untouched)
  that writes a synthetic log entry the stock exporter already renders.
- **Confirm text is non-numeric.** One `confirm-<topic>-<unit>` scene is
  reused across all three waves instead of tripling every scene, so it
  can't print "remaining after: 2" literally; the live PINGS readout does.
- **No dice check** — M2 is investigation, not a skill roll; none is wired.
- **"Compel" heading** lives under the reserved `## Shifts` section, which
  already lists compels; the exporter has no separate slot for it.

## Verified (Playwright, `/opt/pw-browsers` headless_shell)
Full run: wizard → 3 pings (incl. technology: error dialog + budget drop) →
sort both ways → position form → commit → complication → reopen (Fate
drops, 4th ping unlocked) → compel accepted → export. Zero console errors;
record has all four required headings plus a real Original/Revised row.
`javaScriptEnabled:false` run confirms the F2 sentence and Canvas link.
Screenshots: `smoke-wizard.png`, `smoke-confirm.png`, `smoke-complication.png`.

## Three questions for a human playtester
1. Does the technology-ping error dialog read as *the lesson* or a bug?
2. Is a 28-button hub (2 units × 7 topics) too much to scan, even greyed?
3. Does reopening (spend Fate, lose the chance to refuse the compel) feel
   like a trade-off, or an unexplained penalty?

**Lead's fix, 2026-09-10.** The generator routes each "No" through four flag-gated choices, one
per ping wave, because the engine has no dynamic `next`. The runner greys out a choice that
fails its conditions rather than hiding it, so a confirm scene showed one live "No" and three
disabled ones. `renderChoices` in this copy now shows one keycap per label: the first enabled
choice with that text, else the first. `cartridge.json` is unchanged. Test row E-14 in
`arcade/TESTS.md` covers it.
