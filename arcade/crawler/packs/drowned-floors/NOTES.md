# The Drowned Floors: pack notes

One dungeon in two costumes. This pack rhymes *The Drowned Tower* (Module 2 of The Fort on the Lake) in the High Tech, Low Lives world: the same 25 areas in three tiers, the same lesson in each area, the same clock. Every word is new. Resolver `fate4df`. Built to `crawler/SPEC.md`.

Check it: `node crawler/tools/validate.mjs arcade/crawler/packs/drowned-floors` prints `OK drowned-floors`.

## The world rhyme

| Fort (Module 2) | The Drowned Floors |
|---|---|
| Lamp Station Nine, the Drowned Tower | A condemned pre-Rise Meridian tower on the Shoals. Sub-level Nine is under the sea. |
| The hook | Juno Pell, a Meridian diver, found at the waterline. Chrome locked, eyes open. Marcus has a buyer for what she dived for: four cold cores. |
| Maren sends a boat | Marcus advances 60 credits. Reyes runs the Mirasol. |
| The crossing, day or dusk | `gate`: by day (costs a turn), under the dusk patrol gap, or Nobody Stops Me. |
| The Saltmen, Ketter Vosk | The Kelp Line, Oriel Rook. Mate Dov Pike and hands Tess and Jory at the post (named in text only). Mate Kell Amadi at the dock. Bodyguard Hobb. |
| The Readers, eggs, the Old Road | The Desk (a faceless buyer), cold cores, "third pier past the humming buoy". |
| Oil flask and torch | Battery cell (24 turns, needs the dive lamp) and flare (6 turns). Same numbers. |
| Giant rats, flee at 2 dead | Wreck rats, break at 2 dead. |
| Vane, the Lampwright | Odele Brandt, chief engineer. Her logs change the fight. |
| The Warden, a catfish in a bronze collar | The Moray, a security eel-drone on a leash band with a dark seal. |
| The Warden's Lamp | The Green Lamp. Needs a battery cell to show green. |
| Eight lamp-stones | Eight leash posts round the shore. |
| Eye-wards, the Door Beneath the Lake | Twelve shut cameras round a sealed Meridian vault door. Nobody opens it. The Algorithm speaks through it once. |
| Fort Hall, Harrow's cart, shrine, docks | The Dock: Marcus's Booth (roster, debrief), the Fence (shop), the Clinic (rest, 20 cr), the Mirasol (leave). |
| gp | cr (credits). The `gold` item id is shown as "cr". |

## Area by area

Fort key and the same key here. The lessons are the Fort's. The scenes do not print them: the player learns them by doing.

| Key | Fort name | Here | Map |
|---|---|---|---|
| S1 | The Broken Jetty | The Wreck Pier | waterline |
| S2 | The Tower Shell | The Atrium Shell | waterline |
| S3 | The Keeper's Cottage | The Watch Booth | waterline |
| S4 | The Lamp-Stones | The Leash Posts | waterline |
| S5 | The North Cliff | The North Seawall | waterline |
| C1 | The Cellar Stair | The Service Stair | floors |
| C2 | The Oil Store | The Battery Store | floors |
| C3 | The Flooded Stair | Stairwell Eight | floors |
| C4 | The Lamp Hall | The Concourse | floors |
| C5 | The Keepers' Dormitory | The Crew Bunks | floors |
| C6 | The Ward Room | The Camera Hall | floors |
| C7 | The Lampwright's Study | The Engineer's Office | floors |
| C8 | The Lens Workshop | The Optics Lab | floors |
| C9 | The Blind Stair | The Choked Stair | floors |
| C10 | The Cistern | The Pump Room | floors |
| C11 | The Station Shrine | The Alcove | floors |
| C12 | The Saltmen Post | The Kelp Line Post | floors |
| G1 | The Water Gate | The Water Gate | sump |
| G2 | The Saltmen's Dock | The Kelp Line Dock | sump |
| G3 | The Cache | The Cache | sump |
| G4 | Vosk's Room | Rook's Berth | sump |
| G5 | The Shaft Foot | The Shaft Foot | sump |
| G6 | The Drowned Landing | The Drowned Landing | sump |
| G7 | The Warden's Pool | The Moray's Pool | sump |
| G8 | The Door Beneath the Lake | The Vault Door | sump |

Maps: `waterline` (the island tier, 13 x 9), `floors` (the cellars, 31 x 22), `sump` (the grotto, 34 x 21). Links: S2 hatch (behind a secret door) to C1; S5 rope to G1; C3 stair to G6; C12 shaft to G5. The loop C4, C5, C10, C8, C4 and the secret passage C1 to C7 are kept.

## How the Fort's tricks became Fate rolls

| Fort | Here |
|---|---|
| Listen 1-in-6 (elf 2-in-6) | `listen`: Cool, difficulty +4. Best Cool 3 (Marcus) passes about 38%. Without Marcus, about 19%. The contact mic in C4 gives +2 to the next roll. |
| Search 1-in-6 | `search`: Tech, difficulty +4. Reyes and Reiko have Tech 3: about 38%. |
| Force a stuck door 2-in-6 | `forceDoor`: Body, difficulty +2. Reyes has Body 2: about 62%. Each try is still noise (wander check). |
| Flee | `combat.flee`: Reflexes, difficulty +1. |
| The 2d6 reaction at C12 and G2 | A Cool check per approach. Eager = style, Willing = success, Uncertain = tie (pay 20 cr), Unfriendly = fail (fight). The Fort's modifiers become the difficulty: sign shown +2 (difficulty 0), name drop +1 (1), food and 10 cr +1 (1), plain talk 2. Intruders at G2 are 4. |
| Skeleton turning, the rite | The rite is one phrase, read at C7 (`read-last`), spoken (`rite-said`). C5 stands down. |
| The Warden lamp | `Hold up the Green Lamp`: needs the log read, the lamp, and one battery cell. |

The engine counts a tie as a pass on skill checks, so the real odds are a little above these (+20 points on each).

## The Moray: what the party learned changes the fight

| Learned | Scene choice at G7 |
|---|---|
| Lamp log (C7) | Hold up the Green Lamp. No fight. Spends a battery cell. |
| Leash log (C7), or Marcus's contact | Break the leash seal. `g7-exposed`: rating 3, stress 3. |
| Feeding roster (C7), plus a crate of salt fish (G2) | Ring the bell. It feeds. |
| Hum log (C7) | Hold still on dry deck. Cool +2 check. A tie costs one Systems mark. |
| Posts log (C7), or a lit post (S4) | Cross while the pool is empty. The flag is spent. |
| Watched the circuit at S1 | Cross in the gap. Reflexes +1. |
| Nothing | Fight `g7-guardian`: rating 4, stress 14, attack 4 on Systems, with an aura. |

The aura is the only one in the pack: `shocked` on a failed Body +1 check each round, unless the member guards. Simulated with `crawler/tools/sim.mjs` (1,000 seeds, default party, nobody runs): the guardian without the clue wins 65% and wipes 35%. The Moray bites Meat, not Systems: the party has 5 to 8 Systems boxes and the bite never put anyone down. With the clue (`g7-exposed`) it is 100% and 0%.

## The party

Default order **reyes, shodann, undertow, marcus**. Kept. Front rank is hit in melee and defends with Reflexes. Reyes (Reflexes 3, Body 2) and Ann Sho (Reflexes 2) are the two best defenders who can also hit. Reiko has a speargun (Tech 3, ranged) and Marcus a briefcase pistol (ranged), so both can fight from the back. Marcus could swap with Ann for Reflexes 2, but then Ann's Code 3 sits at the back doing nothing, and the Infiltrator is the party's door-opener.

Roster extra: **kaida**.

Stats are the v2 playbook lines, not the pregens: Nomad 2/3/0/3/1, Infiltrator 1/2/3/2/1, Influencer 1/1/2/3/2, Fixer 1/2/1/2/3 (Body, Reflexes, Code, Tech, Cool). The pregens differ (Ann 0/1/3/2/1, Reyes Tech 2 Cool 2, Marcus Reflexes 1). The brief said "rated as in the playbooks".

Tracks are 3/3/3 plus the chrome shifts the character actually carries, per the playbooks. Each shift is written in `chromeLine` on the card.

| Who | Chrome | Meat | Nerves | Systems |
|---|---|---|---|---|
| Reyes | Pressure Adaptation Mods (+1 Sys, -1 Meat); Neural Link (+1 Sys) | 2 | 3 | 5 |
| Ann Sho | Neural Deck Port (+2 Sys, -1 Meat); Pattern Recognition Suite (+1 Sys, -1 Nerves) | 2 | 2 | 6 |
| Reiko (UNDERTOW) | Streaming Suite (+2, -1 Nerves); Enhanced Dexterity (+2, -1 Meat); Social Analysis (+1, -1 Nerves) | 2 | 1 | 8 |
| Marcus | Analysis Overlay (+1 Sys); Encrypted Comm Suite (+1 Sys) | 3 | 3 | 5 |
| Kaida | Apex Optics (+2 Sys, -1 Meat); Neural Interface Pro (+2 Sys, -1 Nerves); Display Mesh (+1 Sys) | 2 | 2 | 8 |

The pregens' own "final tracks" do not match their chrome arithmetic (Ann 3/4/5 with +3 Systems), so I did not use them. Reiko's pregen matches the arithmetic and the table agrees with it. Reiko's Nerves 1 means any Nerves hit puts her at the door; no foe in this pack attacks Nerves.

Each member brings:

| Who | Move (fate ability) | Trouble (compel) | Chrome ability |
|---|---|---|---|
| Reyes | Nobody Stops Me (gate, C12, G2) | The Mirasol Is Falling Apart (the gate scene) | Pressure Adaptation Mods: flag `pressure-ready`, lets the party walk Stairwell Eight |
| Ann | Familiar Ground (S2, C1, C9, G3-string) | My Former Employer Wants Me Back or Dead (C6) | Deck Port: Spoof (fight, Code +2); Pattern Suite (+2 next) |
| Reiko, Kaida | The Stream, a power: +2 for the fight, flag `on-stream` | The Stream Is Always Running (C12) | Reiko: Enhanced Dexterity. Kaida: Apex Optics |
| Marcus | I Know Someone Who Can Help (S4, C7, G7) | I Owe Favors to Rival Corps (G4) | Analysis Overlay (+2 next) |

The Troubles and moves are the four in `arcade/README.md`. Each compel is two fate-mode choices on one ability (accept: +1 Fate and a cost; refuse: -1 Fate). They share one use, so the other greys out after you pick. That makes `who: "self"` land on the member who holds the Trouble.

## Inventions (everything not in the brief)

- Names: Odele Brandt; Oriel Rook; Dov Pike, Tess, Jory; Kell Amadi; Hobb; Wren (the overdue courier); Detective Lim (from Marcus's file); the Kelp Line; the Desk; the Moray; the Green Lamp; custodian units; cold cores; tick drones; plate crabs; dead suits.
- The `shocked` condition. It has no mechanical effect in the engine today.
- Items: dive line, salt tin, stim patch, crate of salt fish (chum), service key, Green Lamp, seventeen treasure items at the Fort's values. All together, with the boot and the post pay, they come to 6,034 cr: the Fort's 6,534 gp less the 500 gp collar, which has no rhyme here.
- The Algorithm line at G8, in its flat Simplified Technical English voice: three short sentences.
- Four endings: `end-shut` (good), `end-sold` and `end-quiet` (back), `end-dead` (wipe). Chosen at Marcus's booth through `debrief`.
- Wander tables: island (gulls, Kelp Line hands, crab), floors (rats, custodians, ticks, hands), sump (hands x3, crab, hands). Gulls and rats are `nonLethal`.
- Start credits: 60. Starting kit: Reyes has two flares and a line; Reiko has the dive lamp and a battery cell; Marcus has a stim patch; Kaida a battery cell.
- Balance, from `crawler/tools/sim.mjs` (1,000 seeds each, default party, nobody runs, fresh and rested): the unwarned rats win 99.5%; wanderers wipe at most 1.7% (the three-hand wander, no break); keyed fights wipe 0 to 7%; the dock (5 foes) wipes 11%, as the lesson says. After review: wreck rat, kelp hand and custodian attack at rating 1, the dead suit and plate crab at 2, and the plate crab breaks at 3 stress marked. A guard on 4dF adds 2 to the defender's roll (it used to raise the foe's rating).

## Departures and engine limits

1. **The Fort clock (nights 1 to 4, "the last run") is not built.** The engine has no night counter. Marcus says "four nights" in `job`. The Dock has no restock either (Dungeon Notices). Both need an engine feature.
2. **Fights do not come back after a retreat in most areas.** Only C2 has an area encounter. In every other fighting area the scene starts the fight with `goto`, because the peaceful paths (parley, rite, lamp, damper, fish) would otherwise start a fight on the way home. A flee from the post or the dock sets the `alarmed` flag instead.
3. **G7 can be walked through** by backing off to G6 and returning, because the area has no encounter, for the same reason. The scene is `noLeave`: a peaceful pass sets `pool-clear`, which unlocks the shelf dive (900 cr) and "Go on along the rim". A won fight skips both.
4. **The "restless lake" at C3 and the "wandering sign" results** (no monster) are not built. The wander tables hold monsters only.
5. **Kicking the bridge** at G2 is not built: cells cannot change.
6. **Neural Link** (Reyes, boat only) has no ability. It is in the card line and the track arithmetic only.

## specQuestions

1. In a plain (non-fate) scene choice, `who: "self"` is the leader (`ctx.self` is the first living member). I used fate-mode choices for compels so that `self` is the Trouble's holder. Is that the intended pattern?
2. `bonus` has no stat. "+2 Cool for a fight" is +2 to every roll for that member for the fight. Is that intended?
3. A tie counts as a pass on `listen`, `search` and `forceDoor` (engine behaviour). The spec says only "on a success". I tuned the difficulties with ties counted.
4. `first` for a fight can read a flag, but there is no way to mark an encounter done without winning it. Parley paths cannot clear an area encounter.
