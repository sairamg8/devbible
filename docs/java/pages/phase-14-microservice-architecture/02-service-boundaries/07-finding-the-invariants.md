---
title: "Nobody hands you a list of invariants, so you have to extract them — from the operations the system supports, from every lock and unique constraint already in the schema, and from the question of what a user must never be able to observe"
sidebar_label: "07 · Finding the invariants"
sidebar_position: 10
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against Vaughn Vernon, *Effective Aggregate Design, Part I* (2011)
> ([dddcommunity.org](https://www.dddcommunity.org/library/vernon_2011/), CC BY-ND 3.0);
> microservices.io *Assemblage overview: Part 1 — Defining system operations*
> ([microservices.io](https://microservices.io/post/architecture/refactoring/2023/07/27/assemblage-overview-part-1-defining-system-operations.html)),
> which defines a system operation as *"an externally invokable behavior implemented by the
> application. It reads and/or writes one or more business entities, a.k.a. DDD
> aggregates."*
> Version spine: **JDK 25 · Spring Boot 4.1.0 / Framework 7.0.8 · Spring Cloud train
> 2025.1.x "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**.

**The invariant list is the highest-value artefact in a decomposition exercise and almost
nobody produces one, because there is no obvious place to get it from. There are four
places, and all four are available to you today without a workshop: the operations the
system already supports, the concurrency control already in the code, the constraints
already in the schema, and the incidents already in your history. This chunk is the
procedure.**

## Source 1 — the system operations

Start from behaviour, because an invariant is a constraint on what a behaviour may leave
behind. microservices.io's definition of a system operation is the right unit:

> *"an externally invokable behavior implemented by the application. It reads and/or writes
> one or more business entities, a.k.a. DDD aggregates."*

List them. In a Spring Boot 4.1 application you can enumerate most of them mechanically:
every `@GetMapping`/`@PostMapping`/etc. handler, every `@Scheduled` method, every message
listener, every batch job entry point. Then, for each operation, answer three questions:

1. **What state does it write?**
2. **What must be true immediately after it, that was true immediately before?**
3. **What would be a bug if a user could observe it between the write and some later
   repair?**

Question 3 is the one that separates invariants from rules. If a user can observe the
intermediate state and nothing bad happens, it is not transactional.

Worked, for `placeOrder`:

| Question | Answer |
|---|---|
| Writes | A new `Order` with lines; a `Reservation` per line against stock |
| Must remain true | Order total equals the sum of its lines; every line has a reservation; no stock item goes negative |
| Observable intermediate state that would be a bug | An order that exists with no reservations — the customer is told they bought something nobody has set aside |

That third row is the finding. "An order exists without reservations" being a bug means the
order-creation and the reservation are inside one consistency boundary *unless* the business
is willing to have orders that later fail — which many retailers are, and which is exactly
the conversation [08 · Whose job is it](08-whose-job-is-it.md) forces.

## Source 2 — the concurrency control already in your code

Every one of these is a place where somebody, at some point, decided a rule needed
protecting. They are free evidence:

```bash
# Optimistic locking: each @Version field is an aggregate root someone identified.
grep -rn '@Version' src/main/java

# Pessimistic locking: each of these is a rule that could not tolerate a race.
grep -rn 'LockModeType\|@Lock\|FOR UPDATE\|setLockMode' src/main/java

# Explicit serialisation: an invariant that lost an argument with the database.
grep -rn 'Isolation.SERIALIZABLE\|Isolation.REPEATABLE_READ' src/main/java

# Application-level locks: usually an invariant that spans aggregates already.
grep -rn 'ReentrantLock\|RedisLockRegistry\|ShedLock\|distributed.*lock' src/main/java
```

The last one is the most informative. A distributed lock in an application is almost always
protecting a rule that spans two things which should have been one aggregate. If you find
one, you have found either an invariant you did not know about or a boundary that is already
wrong.

## Source 3 — the schema

Database constraints are a partial, cheap, and slightly misleading inventory.

```sql
-- Unique constraints: candidate invariants, often the strongest ones.
SELECT conrelid::regclass AS table_name, conname, pg_get_constraintdef(oid)
FROM   pg_constraint
WHERE  contype IN ('u', 'c')
ORDER  BY 1;
```

**Unique constraints** are frequently real invariants: "one active subscription per
customer", "one primary address per account", "a promotion code is redeemed once per
customer". Each one that spans what you were planning to make two services is a hard stop —
you cannot enforce uniqueness across two databases without either a shared arbiter or
accepting duplicates.

**Check constraints** are invariants written down, and are usually the arithmetic ones.

**Foreign keys** are the misleading part. Referential integrity is not the same claim as a
business invariant; most foreign keys can be replaced by an identifier reference across a
boundary with no harm. Do not treat the FK graph as the aggregate graph — that mistake
produces enormous aggregates and the conclusion that nothing can ever be split.

## Source 4 — the incident history

The highest-signal source and the one people forget. Search your incident tracker for the
words *duplicate*, *oversold*, *double charged*, *out of sync*, *missing*, *orphan*,
*reconcil*. Each incident of that shape is a rule the system failed to keep. If the fix was
a nightly job, a manual correction process, or a support runbook, then there is an invariant
there that is currently unenforced — and any boundary you draw must either restore it or
consciously keep not enforcing it.

An incident that produced a reconciliation job is an invariant with a receipt.

## Writing them down in a form you can use

The list is only useful if each entry names the *state* involved, because state is what
gets partitioned:

| # | Invariant | State involved | Enforced today by |
|---|---|---|---|
| I1 | Order total = Σ line totals + tax − discount | `order`, `order_line` | In-aggregate arithmetic |
| I2 | Order has ≥ 1 line | `order`, `order_line` | Constructor check |
| I3 | `on_hand − Σ reservations ≥ 0` per SKU per warehouse | `stock_item`, `reservation` | `@Version` on `stock_item` |
| I4 | A promo code is redeemed at most `max_uses` times | `promotion`, `redemption` | Unique index + `@Version` |
| I5 | At most one active subscription per customer | `subscription` | Partial unique index |
| I6 | A shipment's lines are a subset of its order's lines | `shipment_line`, `order_line` | **Nothing — repaired by a nightly job** |

Now group the *State involved* column into connected components. Each component is a
consistency boundary. Any proposed service boundary that cuts a component is a boundary that
must be justified against the seven-item cost list in [06 · Invariants are the
criterion](06-invariants-are-the-criterion.md).

For the table above the components are: `{order, order_line}` (I1, I2),
`{stock_item, reservation}` (I3), `{promotion, redemption}` (I4), `{subscription}` (I5),
and `{shipment_line, order_line}` (I6) — which links the first component to fulfilment
state, and is exactly the row that is currently unenforced. That is not a coincidence. **The
invariants nobody enforces are usually the ones that already span an organisational
boundary**, and they are the best available evidence about where the seams already are.

## Turning the finding into code that keeps it

Once you know I3 ties `stock_item` and `reservation`, the enforcement belongs in one place
and it should be impossible to bypass:

```java
package com.retailer.inventory;

import jakarta.persistence.*;
import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(name = "stock_item",
       uniqueConstraints = @UniqueConstraint(columnNames = {"sku", "warehouse_id"}))
public class StockItem {

    @EmbeddedId
    private StockItemId id;

    @Column(nullable = false)
    private int onHand;

    /// Reservations are inside the aggregate, not a separate entity with its own
    /// repository. That is the structural expression of invariant I3: there is no
    /// code path that can add a reservation without going through this object.
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "reservation", joinColumns = {
            @JoinColumn(name = "sku"), @JoinColumn(name = "warehouse_id")})
    private Set<Reservation> reservations = new LinkedHashSet<>();

    /// The version column is what makes the check-then-act safe under concurrency.
    /// Without it, I3 is a hope.
    @Version
    private long version;

    public void reserve(OrderRef order, int quantity) {
        if (available() < quantity) {
            throw new InsufficientStockException(id, quantity, available());
        }
        reservations.add(new Reservation(ReservationId.next(), order, quantity));
    }

    private int available() {
        return onHand - reservations.stream().mapToInt(Reservation::quantity).sum();
    }
}
```

Note there is **no `ReservationRepository`**. That absence is the design. A repository per
entity is the standard way an invariant gets bypassed six months later, because it gives a
future developer a legitimate-looking way to write a reservation without the stock item
present. Repositories belong to aggregate roots only — which is Evans' original rule and is
the tactical half of the boundary story.

## Gotchas

**★ Symptom: the invariant list has forty entries.** Cause: business rules were collected
rather than invariants. Fix: apply the ten-second test to each — if a ten-second delay
before the rule becomes true harms nobody, strike it. Most lists lose two thirds of their
rows and the survivors are the ones that constrain the architecture.

**★ Deriving aggregates from the foreign key graph.** Follow every FK and you will conclude
the whole database is one aggregate, because everything reaches everything within four hops.
Referential integrity is a weaker claim than an invariant; use FKs as prompts and confirm
each one against a business rule.

**★ Symptom: a distributed lock in the codebase.** Cause: a rule spanning two things that
are not in one aggregate. Fix: either bring them into one aggregate, or accept eventual
consistency deliberately — but the lock itself is a signal that somebody hit this and
patched it rather than modelling it.

**★ Missing the invariants that live in the UI.** "You cannot submit this form twice" is
sometimes enforced only by a disabled button. That is not enforcement, and the invariant it
implies is real. Search for idempotency keys, request deduplication, and "submitting…"
states.

**★ Treating a report as an invariant.** "The daily revenue report must tie out to the
ledger" is a reconciliation requirement, not a transactional invariant; it is satisfied at
the end of the day. Reports pull enormous amounts of state into false consistency
boundaries if you let them.

**★ Collecting invariants only from the happy path.** Cancellation, refund, partial
shipment, return and correction paths carry most of the interesting rules, and they are
where the boundary breaks. Walk the reversal of every operation you list.

**★ Symptom: an invariant everyone agrees on that the code does not enforce.** Cause:
usually that it spans an existing organisational boundary and was quietly downgraded. Fix:
do not assume the code is wrong. Ask what actually happens when it is violated — if the
answer is "support fixes it, twice a month, and nobody has complained", the business has
already decided this is not an invariant and your architecture should agree.

## Interview questions

**★ Where do you get the invariants from, in a system nobody documented?**
Four sources, all available without a workshop. System operations: enumerate every endpoint,
scheduled job and message listener, and for each ask what must be true immediately after and
what intermediate state would be a bug if a user saw it. Concurrency control: every
`@Version`, `SELECT … FOR UPDATE` and distributed lock in the codebase is a rule someone
already decided needed protecting. The schema: unique and check constraints are usually real
invariants, though foreign keys are not. And the incident history: every "oversold",
"double charged" or "out of sync" incident is an invariant with a receipt, especially if the
fix was a reconciliation job.

**★ How do you distinguish an invariant from a business rule, in practice, quickly?**
The ten-second test. Would it harm anyone if this rule were false for ten seconds and then
became true? If no, it is eventually consistent and it does not constrain your boundaries.
If yes — name who is harmed and how — it is transactional and the state it touches cannot be
split. Then cross-check with the whose-job-is-it question, because "harm" is often really
"someone would have to fix it", and if that someone is a different user or the system
itself, eventual consistency is the honest answer.

**★ Why is a foreign key not evidence of an aggregate boundary?**
Because a foreign key asserts that a referenced row exists, which is a much weaker claim
than "these two pieces of state must satisfy a rule atomically". An order line referencing a
product is a foreign key and absolutely not an invariant — the product can be deleted,
renamed or repriced and the order line remains correct, because it recorded what was true at
the time. If you treat FKs as aggregate edges you get one aggregate containing the entire
schema, because everything is reachable, and you conclude that nothing can be split.

**★ You find a nightly reconciliation job. What does it tell you about boundaries?**
That there is a rule spanning two pieces of state that the system does not enforce
synchronously, and that somebody already accepted the drift. Architecturally that is a very
strong signal: it usually means the two pieces of state are already on opposite sides of an
organisational or technical boundary, and it tells you either that the boundary is wrong, or
— more often — that the rule was never really an invariant and the business has been living
happily with eventual consistency. Either way it is the highest-information artefact in the
codebase, because it is an invariant with a measured cost attached.

**★ What is the risk of skipping this analysis and just splitting along team lines?**
You will split through an invariant without noticing, and the failure will not appear in
testing. It appears in production under concurrency, as oversell, double-charge or orphaned
records — low-frequency, hard to reproduce, and expensive to fix once both services have
their own databases and their own release schedules. The analysis is half a day. The
recovery is a quarter.

---

← [Invariants are the criterion](06-invariants-are-the-criterion.md) · [Topic index](README.md) · Next → [False invariants](07b-false-invariants.md)
