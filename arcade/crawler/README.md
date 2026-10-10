# The Crawler, in the arcade

A first-person, grid-based party crawler for phones, with one pack from this world: **The Drowned Floors**. You lead four characters down a condemned Meridian tower on the Shoals, a step at a time, through three maps and 25 areas. The party fights in ranks. The Dock between delves heals you at the Clinic, sells you light at the Fence, and brings the party home.

It is one engine and any number of packs. A pack is data: the theme, the rules, the party, the monsters, the maps and the scenes. The engine knows nothing about eels or corporations. The contract is [`SPEC.md`](SPEC.md).

**The engine, the view and the tools are vendored.** `engine/`, `ui/`, `tools/`, `test.mjs`, `SPEC.md` and the two fixture packs (`packs/test`, `packs/test-fate`) are copied, byte for byte, from the Fort repository (`games-osr-fort-on-lake`, directory `crawler/`). That repository is the source. Do not edit them here: change them there, then copy them over (see *Update the vendored copy*). The pack in this repository, `packs/drowned-floors/`, is ours.

## Play

Build the pack, then open the file. It is one page with no network, and it opens from disk.

```
node arcade/crawler/tools/build.mjs arcade/crawler/packs/drowned-floors --out arcade/crawler/dist/drowned-floors.html
```

The built page is [`dist/drowned-floors.html`](dist/drowned-floors.html). The build looks for `engine/` and `ui/` next to `tools/`, so run it from anywhere.

| Do | Tap | Key | Swipe |
|----|-----|-----|-------|
| Move forward, back | Up, down arrows | Up or W, Down or S | Up, down |
| Turn | Turn arrows | Left or A, Right or D | Left, right |
| Move sideways | Side arrows | Q, E | |
| Open or force a door, use stairs | Act | Space, Enter | |
| Search the area for a hidden hatch | Search | F | |
| Listen at the door ahead | Listen | L | |
| Rest one turn | Rest | R | |
| Map and route | Map | M, Esc to close | |
| Pick a choice, an order, a Dock action | The button | 1 to 9 | |
| Help | F1 How to play | F1 | |

The game saves in the browser after every step, under the key `crawl.drowned-floors`. `?seed=N` on the address picks the dice. The same seed and the same commands give the same game. *New run* clears the save (tap it twice).

Planning is free. Acting costs time. A dashed choice is a plan. A solid choice is an act: it costs turns and may roll. A double choice spends a Fate use: a move or a Trouble from the playbooks.

## The pack

[`packs/drowned-floors/`](packs/drowned-floors/) is the resolver `fate4df`: four Fate dice and a stat against the ladder (3 shifts style, 1 success, 0 tie, below that a fail), stress marked and never subtracted. Tracks are Meat, Nerves and Systems, three boxes each plus what the chrome shifts. The party is Reyes, Shodann, Undertow and Marcus, with Kaida on the roster. It rhymes Module 2 of the Fort campaign area for area, with every word new. [`NOTES.md`](packs/drowned-floors/NOTES.md) holds the rhyme table, the stat arithmetic, what was invented, and what the engine could not do.

## Make a pack

See the Fort's [`crawler/README.md`](https://github.com/norrisaftcc/games-osr-fort-on-lake/blob/main/crawler/README.md) for the file list and the steps. In short:

1. Copy `packs/test-fate` to `packs/<your-id>/` and write the files described in `SPEC.md`, sections 1 to 8. Read `.claude/conventions/writing-style.md` and `design-principles.md` first: stress is marked, palettes are the playbooks' own, the pregens' facts come from their files.
2. Check it: `node arcade/crawler/tools/validate.mjs arcade/crawler/packs/<your-id>` prints `OK <your-id>`.
3. Build it, and walk it: `node arcade/crawler/test.mjs arcade/crawler/dist/<your-id>.html`.

## The checks

| Check | Run | Expect |
|-------|-----|--------|
| The pack is valid | `node arcade/crawler/tools/validate.mjs arcade/crawler/packs/drowned-floors` | `OK drowned-floors` |
| The engine (vendored tests) | `node --test arcade/crawler/engine/test.mjs` | `# fail 0` |
| The whole game | build the pack, then `node arcade/crawler/test.mjs` | `PASS` |
| The vendored copy is the Fort's | `node arcade/crawler/check-vendor.mjs` | `vendor matches <commit>` |

`test.mjs` loads each page in `dist/` at 360 × 780 and plays four seeds (1, 7, 42, 2026) with an explorer that sends only the commands a tap sends. Across the seeds it must visit all 25 areas. It also replays one recorded path with real key presses, reloads the page, and plays with storage blocked. The explorer is not a good player: a seed that ends with the party down is a normal outcome. See the Fort's README for the switches (`SEEDS`, `VERBOSE`, `TRACE`).

`check-vendor.mjs` finds the Fort checkout at `../../../games-osr-fort-on-lake/crawler` (next to this repository), or at the path in the environment variable `FORT_CRAWLER`. It prints `vendor matches <commit>` or lists the files that differ and exits 1. With no Fort checkout it prints `skip: no Fort checkout` and exits 0.

## Update the vendored copy

When the Fort's crawler changes:

```
FORT=../games-osr-fort-on-lake/crawler        # the Fort checkout, next to this repository
rm -rf arcade/crawler/engine arcade/crawler/ui arcade/crawler/tools arcade/crawler/packs/test arcade/crawler/packs/test-fate
cp -r $FORT/engine $FORT/ui $FORT/tools arcade/crawler/
cp $FORT/SPEC.md $FORT/test.mjs arcade/crawler/
cp -r $FORT/packs/test $FORT/packs/test-fate arcade/crawler/packs/
node arcade/crawler/check-vendor.mjs                        # vendor matches <commit>
node arcade/crawler/tools/validate.mjs arcade/crawler/packs/drowned-floors
node arcade/crawler/tools/build.mjs arcade/crawler/packs/drowned-floors --out arcade/crawler/dist/drowned-floors.html
node arcade/crawler/test.mjs                                # PASS
```

Commit the copy, the rebuilt `dist/drowned-floors.html` and any pack change together, and name the Fort commit in the message.

## Known gaps

- The Fort's clock (four nights, "the last run") and the restock table are not built, because the engine counts turns, not days.
- A scene cannot mark an encounter done, so fights do not come back after a retreat anywhere except the Battery Store (C2). Backing off from a fight leaves the monsters where they are.
- The `shocked` aura condition has no mechanical effect in the engine yet.
- Neural Link (Reyes, boat only) is in the card text and the track arithmetic, but it has no ability.
- The page saves under `crawl.<pack id>`, not under the `htll.` prefix that `arcade/TESTS.md` (row A-13) asks of the cabinet's pages.
