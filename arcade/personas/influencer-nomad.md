# The Nomad + The Influencer

Default Lead: Nomad. Default Handler: Influencer.

## Crossing

*The Smuggling Partner on Camera*

The Influencer needed a dangerous-looking dive site and a boat that wouldn't ask questions
about the footage. The Nomad needed the sponsor money more than the Nomad wanted to admit.
The deal was simple: run the boat, stay out of frame, get paid in real credits instead of
favors. It worked for six streams. On the seventh, a following drone caught the Nomad's
registration numbers clearly enough to search, and now the Nomad's boat has a following of
its own — viewers who track its movements for fun, with no idea what else it carries.

**The Cost**: The Nomad's boat is recognizable now, on camera and in the algorithm's search
index — the one thing a boat that runs quiet routes cannot afford to be.

**Aspect**: *"My Boat Is Famous and I Never Agreed to That"*
Invoke: when the boat being recognized actually helps — cover, credibility, an audience that
vouches for you.
Compel: when someone tracks the boat from a stream, or when the Influencer needs one more
appearance the Nomad never agreed to.

## Opening exchange

- **Influencer (Handler)**: "We're live, and chat already loves the boat."
- **Nomad (Lead)**: "They can love it from a distance. Keep the drone off the registration."
- **Influencer**: "No promises. It's a good angle."

## Handler lines

Default Handler: **Influencer** — performing to an audience that is always there. Three
lines per event: run going well, run going badly, neutral.

| Event | Going well | Going badly | Neutral |
|---|---|---|---|
| begin | We're live. Look sharp, they're already watching. | We're live, and chat already smells trouble. | Stream's up. Say hello to the people. |
| stageClear | Clip that. Chat's going wild already. | We cleared it, ugly as it was. Don't cut that part. | Sector clear. Keep the feed steady. |
| node1 | First node's out. Chat loves a clean hit. | Node's still up. Chat's asking why. | One node down. Three left in frame. |
| shield | Shield's down. This is the highlight reel. | Shield's holding. Not our best angle. | Shield's cracking. Stay in the light. |
| hull40 | Forty percent hull and still smiling for the camera. | Forty percent. Chat's panicking harder than you. | Hull's at forty. Keep the face calm. |
| core50 | Core's at half. This is the part they'll share. | Core's at half, and so is your composure. | Core reads half. Give them a good line. |
| win | We're trending. Take the bow. | We won. Somehow. Don't explain the somehow. | Run's clean. Chat's already asking for a rerun. |
| lose | We lost it, but that clip is still going viral. | We lost it live. Damage control starts now. | Run's over. I'll write the recap, you smile. |

Swapped Handler: **Nomad** (Lead becomes Influencer) — laconic and maritime. One line per
event.

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

**Offer**: The boat's systems slip below tolerance right as the stream numbers spike — a
sponsor watching live offers full repairs for one thing: the Nomad says the sponsor's name on
camera.

**Accept**: The Nomad says the name. The repairs get paid for. The boat picks up a sponsor
decal it didn't have yesterday.

**Refuse**: The Nomad stays silent and spends a point, nursing the boat through the rest of
the run on nothing but Tech rolls and stubbornness.

## Notes

- The three-line default Handler set (Influencer, performing-to-audience) is **generic**,
  reused verbatim in `infiltrator-influencer` as well.
- The swapped one-line Handler set (Nomad, laconic/maritime) is likewise generic, reused
  wherever the Nomad ends up as Handler (`fixer-nomad`, `infiltrator-nomad`, both swapped).
- Only the **Opening exchange**, the **Crossing**, and the **Compel** are pair-specific.
- No Fixer in this pair; see any Fixer pair sheet or `arcade/personas/README.md` for the
  palette proposal.
