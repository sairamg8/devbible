# Topic 12 · The distributed monolith — chunk plan

Tier: **Understand**. 🔴 Read `../_PHASE-NOTES.md` first — it is binding.

## Boundary
Owns **the phase's closing argument**: the tells that a split went wrong, why each one follows
from a decision made earlier in this phase, and the honest fix. This is the one topic that may
reference every other — **as links back, not as re-explanation.** It owns no new technology.

🔴 **Every tell must name the topic whose advice was skipped.** That is what makes this a
conclusion rather than a rant: lockstep deploys → topic 02's boundaries; the shared database →
topic 03; the chatty sync chain → topic 04; the shared client jar → topic 05.

## Chunks (a PLAN, not a budget)
| # | File | What it argues |
|---|---|---|
| 1 | `01-the-worst-of-both.md` | Distribution's costs with the monolith's coupling, and none of either's benefits |
| 2 | `02-the-tells.md` | The checklist version: nine symptoms, stated plainly |
| 3 | `03-lockstep-deploys.md` | If they must ship together, they are one service wearing three hats |
| 4 | `04-the-shared-database.md` | The coupling that survives every "we split the code" |
| 5 | `05-the-chatty-call-chain.md` | Five sync hops per request; the availability and latency arithmetic |
| 5b | `05b-the-n-plus-one-across-the-network.md` | The loop that was a join, now over HTTP |
| 6 | `06-the-shared-library.md` | The jar that makes every consumer redeploy on the provider's release |
| 6b | `06b-the-shared-dto-module.md` | The specific case that looks harmless and is not |
| 7 | `07-the-change-that-touches-five-repos.md` | Cost of change as the real measure of a boundary |
| 8 | `08-the-team-that-owns-nothing-alone.md` | Conway's law running backwards |
| 9 | `09-distributed-transactions-in-disguise.md` | Orchestration that only works if everything is up |
| 10 | `10-measuring-it.md` | Deploy independence, change coupling from git history, hop counts |
| 11 | `11-the-fix-merge-back.md` | Recombining services is a valid, under-used answer |
| 11b | `11b-the-fix-redraw.md` | Moving the boundary rather than deleting it |
| 11c | `11c-the-fix-go-async.md` | Breaking temporal coupling where the boundary was right |
| 12 | `12-how-not-to-get-here.md` | The decisions, in order, that would have prevented each tell |
| 13 | `13-the-phase-gate.md` | Argue against the split for a two-team shop; argue for it at scale |

## Verify, do not assume
- ⚠️ Every backward reference must point at a chunk that **actually exists** at the time of
  writing. This topic is the last one written and therefore the most likely to accumulate
  dangling links. `grep -rn '](\.\./'` the directory and check every target resolves.
- ⚠️ Cite microservices.io and named writing for the anti-pattern by its established name;
  do not invent terminology.
- ⚠️ Availability arithmetic is **arithmetic** (`0.99^n`), labelled as such. **No sandbox** —
  no deploy frequencies, incident counts or latency figures presented as observed.
- ⚠️ 🔴 Do not write this topic before topics 02, 03, 04 and 05 exist; its whole value is the
  linkage back.
