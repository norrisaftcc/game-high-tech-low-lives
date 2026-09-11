# The Nomad + The Fixer

Default Lead: Nomad. Default Handler: Fixer.

## Crossing

*Berths Booked in Advance*

The Nomad's boat runs routes nobody schedules in advance — that's the point. But routes need
berths, and every berth on the coast answers to someone who wants a fee, a favor, or a name
for the manifest. The Fixer solved that months ago: a standing arrangement with three
harbormasters, one understanding. The Nomad radios ahead, gives a code word instead of a
cargo manifest, and a berth opens that was never officially reserved. Nobody asks whose boat
it is. The Fixer made sure of that, and made sure everyone involved remembers who arranged
it.

**The Cost**: Every berth the Fixer opened is a harbormaster who now expects to be
remembered — and remembered debts, unlike unremembered ones, come due.

**Aspect**: *"The Fixer Keeps My Berths Open and My Business Nobody's"*
Invoke: when you need a dock, a quiet harbor, or a berth that was never officially booked.
Compel: when a harbormaster calls in what they're owed, or when the Fixer needs the Nomad's
boat for a run that isn't the Nomad's idea.

## Opening exchange

- **Fixer (Handler)**: "Berth's open, harbormaster's paid. Don't make me explain this run."
- **Nomad (Lead)**: "Wasn't planning on it."
- **Fixer**: "Nobody plans on it. Go."

## Handler lines

Default Handler: **Fixer** — transactional and warm, favours as currency. Three lines per
event: run going well, run going badly, neutral.

| Event | Going well | Going badly | Neutral |
|---|---|---|---|
| begin | You're covered. I called in the good favor for this. | You're covered, barely. I spent what I had left. | Line's open. Consider this one on the house. |
| stageClear | Clear. That's a favor I don't have to spend. | Clear, but I'll owe someone for the mess. | Sector's clear. Nobody's asked for anything yet. |
| node1 | One node gone. My contact will be pleased. | Node's still there. I may need to call someone in. | First node down. Keep counting. |
| shield | Shield's down. Nobody's owed a thing for that. | Shield's up. I'm burning goodwill just watching. | Shield's weakening. Hold steady, I'm working the angles. |
| hull40 | Forty percent hull. Cheap price for what we're getting. | Forty percent. That's a favor I'll have to call in fast. | Hull's at forty. I've seen worse deals. |
| core50 | Core's at half. This is paying off nicely. | Core's at half and the tab's getting long. | Core reads half. Everyone's still square. |
| win | Clean win. I'll tell my contact it was worth it. | A win's a win. I'll smooth over the rest. | Run's done. I'll settle the accounts. |
| lose | We lost it, but I kept the favor in reserve. | We lost it, and now I owe for the cleanup. | Run's over. I'll see what it costs to try again. |

Swapped Handler: **Nomad** (Lead becomes Fixer) — laconic and maritime. One line per event.

| Event | Line |
|---|---|
| begin | Underway. Eyes on the water. |
| stageClear | Stretch cleared. Next leg. |
| node1 | One node down. Three to go. |
| shield | Shield's failing. Hold your line. |
| hull40 | Hull's at forty. Mind the gauges. |
| core50 | Core reads half. Steady on. |
| win | Run's done. Good water ahead. |
| lose | Run's over. Back to dock, we regroup. |

## Compel

**Trouble** (default Lead, Nomad): *"My Boat Is Falling Apart and Repairs Cost More Than I
Make"*

**Offer**: Mid-run, the exact system that needs the expensive parts gives out — and the Fixer
has a buyer who'll cover the whole bill for one more run the Nomad doesn't want to take.

**Accept**: The Nomad takes the money and the job, promising themself it's the last favor of
its kind — knowing it never is.

**Refuse**: The Nomad turns the offer down and spends a point, patching the boat with
whatever's already on board instead.

## Notes

- The three-line default Handler set (Fixer, transactional/warm) is **generic**, reused
  verbatim across all three Fixer-default pair sheets.
- The swapped one-line Handler set (Nomad, laconic/maritime) is likewise generic, reused
  wherever the Nomad ends up as Handler (`fixer-nomad`, `infiltrator-nomad`, both swapped).
- Only the **Opening exchange**, the **Crossing**, and the **Compel** are pair-specific.
- **Fixer palette proposal**: brass/gold `#C89B3C` against deep green `#0B3D2E`. See
  `arcade/personas/README.md` for the two-sentence rationale.
