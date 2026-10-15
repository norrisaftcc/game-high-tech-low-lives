# Test pack (paper kit, ose)

A fixture, not a story to ship. It uses every feature in `stage/SPEC.md` section 2 so the engine, the view and the paper kit can be tested against one small pack.

## Sources and canon

None. The story is invented for the fixture: a lamp, a ford and a keeper. It names no person, place or rule from the campaign or from any published module. Nothing here is canon.

## What it covers

| Feature | Where |
|---------|-------|
| Node kinds: beat, choice, input, roll, ending | all scenes |
| Gates: plan, exec, fate (with a cost) | `lens1`, `cross`, `fire` |
| Conditions: flag, field, meter gte and lte, tally top, all, any, not | `s2` and `s4` beats, `take.a` |
| Effects: flag, set, meter add (up and down), tally add | `lens1`, `cross`, `fire` |
| A lock with a hint | `take.b`, unlocked by calling the ferrymen |
| A route | `s2` (wet goes to the bank), `s4` (open or shut) |
| A roll with each result | `cross` and `knock`, 2d6 (`fail`, `success`) |
| An input | `intro.a` (public fact), `secret.a` (secret fact) |
| A reveal and a screen beat | `s1` beats 3 and 4 |
| Speakers from `cast.json` | Wick and the Keeper |
| Notes of several kinds, and commentary | `rule`, `dm`, `lore` |
| Two endings, both looks | `bright` (paint), `dim` (ink) |
| A set change inside a scene | `s1` beat 2 |
| `to` (leave a scene now) | `cross.b` |

## What it teaches

Nothing about the game. It teaches the tools: `validate` and `sim` must pass on it with every ending reached and nothing unreachable.

## Checks

```
node stage/tools/validate.mjs stage/packs/test
node stage/tools/sim.mjs stage/packs/test
```
