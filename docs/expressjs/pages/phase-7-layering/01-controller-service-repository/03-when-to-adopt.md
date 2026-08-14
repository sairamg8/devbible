---
title: "When to adopt it"
sidebar_label: "03 · When to adopt it"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

**Three layers mean three files and an indirection for every feature. For a
five-endpoint service that is pure overhead — and saying so is more useful than
pretending otherwise.**

> Verified: 2026-08-14 — **no sandbox run and no console block.** Everything on
> this page is **this bible's judgement**, stated as such: Express prescribes no
> architecture, there is no upstream guidance to cite, and the thresholds below
> are experience rather than measurement. The Express facts referenced —
> a router as a mountable mini-app, dependency injection by argument, error
> mapping in middleware — are established in
> [chunk 02](02-wiring-it-in-express.md) from the source in
> `sandbox/express-verify/node_modules/`.

## What the layers actually buy

Two things, and it is worth being precise, because most arguments for layering
list benefits it does not deliver:

**1 · Testability without a server.** Business rules get unit tests that run in
milliseconds with no I/O. That is the benefit that compounds — a rule with a fast
test gets extended confidently; a rule that needs a running server and a seeded
database gets extended nervously.

**2 · Change isolation.** A database swap, or a second transport — a CLI, a queue
consumer, a scheduled job, a gRPC endpoint — reuses the service untouched.

**What they do not buy**, despite frequent claims:

- **Not performance.** Three function calls instead of one is noise.
- **Not correctness by itself.** Nothing about a folder named `services/` prevents
  a missing ownership check.
- **Not "clean code" as an end.** If nobody ever writes the second transport and
  nobody ever swaps the database, the indirection was paid for nothing.
- **Not protection from bad domain modelling.** Layers organise where code lives,
  not whether it is right.

## The signals to adopt

Concrete triggers, rather than a team size:

| Signal | Why it is the moment |
|---|---|
| **A second consumer of the business logic appears** | a job, a CLI, a webhook handler, an admin path. The rule now has two callers and one of them is not HTTP |
| **A test needs an HTTP server to check a rule** | the rule is trapped behind the transport |
| **The same rule is implemented in two handlers** | and they have already drifted, or will |
| **A handler passes 60–80 lines** | not a rule, a smell. It is usually doing four jobs |
| **Someone asks "where does this go?"** and there is no answer | the structure has stopped guiding |
| **You are about to change the database or the ORM** | do the boundary first, then the swap |

🔴 **The strongest signal is the second consumer**, because it converts an
aesthetic argument into a mechanical one: either the logic is callable without
`req`, or it is copy-pasted.

## When not to

Being explicit, because the honest answer is not always "layer it":

- **A five-endpoint internal service** with one consumer and no roadmap. Handlers
  calling the database directly are cheaper and perfectly readable.
- **A prototype.** The structure encodes decisions you have not made yet.
- **A pure CRUD proxy** over one table, where the "business rules" are a schema
  and a foreign key.
- **A lambda-per-endpoint deployment**, where the module boundary is already the
  deployment boundary.

In all four, the ceremony costs more than the coupling. **The failure mode of
premature layering is real**: three files per feature, each two lines long, and a
service layer that only forwards calls. That is not a boundary — it is a longer
route to the same query, and it teaches a team that layering is bureaucracy.

## Adopting it incrementally

You do not have to do this in one commit, and doing it feature-by-feature is
usually better because each step is independently valuable:

1. **Extract the repository first.** It is the most mechanical, has the clearest
   boundary, and immediately stops driver types spreading. It also gives you the
   rollback-per-test story
   ([Node Phase 6](../../../../nodejs/pages/phase-6-data-access/README.md)).
2. **Then extract the rule that has two callers.** Not everything — the one with
   the actual duplication. It pays for itself immediately.
3. **Then the composition root.** Once two or three things need constructing,
   move the construction out of module scope, which also fixes the
   connection-on-import problem
   ([chunk 02](02-wiring-it-in-express.md)).
4. **Leave genuinely trivial endpoints alone.** A health check does not need a
   service. Neither does a lookup that is one query with no rules.

Point 4 is the one people skip, and it matters: **a codebase where the trivial
endpoints are trivial and the complex ones are layered is easier to read** than
one where everything is uniformly three files deep.

## The alternative shapes

Horizontal layers are not the only structure, and for some codebases they are not
the best:

| Shape | Directory | Suits |
|---|---|---|
| **Horizontal layers** | `controllers/`, `services/`, `repositories/` | small teams, one deployable, the shape everyone recognises |
| **Vertical slices** | `features/orders/{route,service,repo}.js` | many teams, clear feature ownership — everything for a change is in one folder |
| **Module per feature** | `orders/` exporting a router and a service | the same, with an explicit public surface per module |
| **No layer** | handlers with queries | genuinely small services |

🔴 **Vertical slices are underrated.** The horizontal shape means a single feature
change touches three directories, and a directory listing tells you nothing about
what the application *does*. `features/orders/` next to `features/billing/` names
the domain, keeps a change local, and still enforces the same internal boundaries
— because slices and layers are orthogonal. You can have both, and the useful
combination is **slices at the top level, layers inside each slice**.

The failure mode of slices is duplication across them, and cross-slice imports
that quietly become a dependency graph nobody drew.

## Trade-off

Three layers mean three files and an indirection for every feature. For a
five-endpoint service that is pure overhead, and honest teams say so.

What they buy is testability without a server and change isolation. Those
benefits arrive when the app grows, and **the cost of retrofitting boundaries
later is much higher than the cost of starting with them** — because by then the
rules are entangled with `req`, and the extraction is a rewrite rather than a
move.

**The resolution: adopt the repository boundary early — it is cheap and almost
always pays — and adopt the service boundary at the second consumer.** That
sequencing gets most of the benefit for a fraction of the ceremony, and it never
leaves you with three files that each forward a call.

## Gotchas

**Symptom:** Every feature has a service that only forwards to the repository
**Cause:** Layering applied uniformly, including where there are no rules
**Fix:** Delete the pass-through. A boundary with nothing on either side of it is
not a boundary

**Symptom:** A team treats layering as bureaucracy and works around it
**Cause:** It was imposed before the benefit was visible, so it only ever cost
**Fix:** Adopt at the signals, and be visibly willing to skip it for trivial
endpoints

**Symptom:** Extracting a service turns into a rewrite
**Cause:** The rules are entangled with `req` — they read headers, call `res`, or
depend on middleware having run
**Fix:** This is the retrofit cost the early boundary avoids. Extract the
repository first; it is mechanical and unblocks the rest

**Symptom:** A change to one feature touches three directories every time
**Cause:** Horizontal layers at the top level
**Fix:** Consider vertical slices with layers inside them — the two are
orthogonal

**Symptom:** Slices import each other's internals and the dependency graph is
unreadable
**Cause:** No explicit public surface per slice
**Fix:** One `index.js` per slice exporting exactly what other slices may use, and
a lint rule against deep imports

**Symptom:** The database swap that justified the layering never happened
**Cause:** It usually does not. The layering has to pay for itself on testability
**Fix:** Judge the boundary on whether rules are fast to test, not on a migration
that may never come

## Interview questions

**★ Is this pattern always worth it?**
No. For a small app, handlers calling the database directly are honest and
cheaper. Adopt layers when a second consumer of the business logic appears, or
when testing a rule requires standing up a server. Uniformly applied layering
produces services that only forward calls, which teaches a team that the pattern
is bureaucracy.

**★ What do layers actually buy, and what do they not?**
They buy fast tests for business rules and isolation from a database or transport
change. They do **not** buy performance, correctness, or protection from bad
domain modelling — a folder named `services/` prevents no bugs.

**★ What is the strongest signal that it is time?**
A second consumer of the logic — a job, a CLI, a webhook. It converts an
aesthetic argument into a mechanical one: either the rule is callable without
`req`, or it gets copy-pasted.

**★ Which boundary would you extract first, and why?**
The repository. It is the most mechanical, has the clearest edge, immediately
stops driver types spreading upward, and unlocks rollback-per-test. The service
boundary can wait for the second caller.

**Horizontal layers or vertical slices?**
They are orthogonal. Slices at the top level name the domain and keep a feature
change in one folder; layers inside each slice keep the same internal boundaries.
The combination is usually better than either alone — provided each slice has an
explicit public surface, or the imports become a dependency graph nobody drew.

**Why is retrofitting boundaries so much more expensive than starting with them?**
Because by then the rules are entangled with `req` — reading headers, touching
`res`, assuming middleware ran. The extraction is a rewrite rather than a move,
and it has to happen while the behaviour stays identical.

---

← Prev: [Wiring it in Express](02-wiring-it-in-express.md) · Index: [CSR wiring](README.md) · Next topic → [Domain vs transport](../02-domain-vs-transport.md)
