---
title: "One shape where REQUIRES_NEW is unambiguously right, three where it is chosen because it was the smallest change that made an error disappear"
sidebar_label: "10b · When REQUIRES_NEW is right"
sidebar_position: 27
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Transaction
> propagation*
> ([docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-propagation.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-propagation.html)),
> the `Propagation` javadoc
> ([docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/annotation/Propagation.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/annotation/Propagation.html))
> and the PostgreSQL 18 manual *Transaction Isolation*
> ([postgresql.org/docs/18/transaction-iso.html](https://www.postgresql.org/docs/18/transaction-iso.html)).
> JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, HikariCP 7.0.2,
> PostgreSQL 18.

**[Chunk 10](10-requires-new.md) priced `REQUIRES_NEW`: two connections per
thread, an outer transaction held open while a second runs, and a pool-sizing
rule whose violation is a deadlock rather than a slowdown. This chunk is the
decision. There is one shape where that price is clearly worth paying, and three
recurring situations where the annotation was added because it was the smallest
change that made an error go away.**

## The legitimate use

There is one shape where `REQUIRES_NEW` is unambiguously right: **work that must
survive the outer transaction's rollback.**

```java
@Service
class PaymentService {

    private final AuditLog audit;

    @Transactional                                        // outer
    public void charge(Order order) {
        audit.record("charge attempted", order.id());     // must survive a failure
        gateway.charge(order);                            // may throw
        db.sql("UPDATE orders SET paid = true WHERE id = ?").params(order.id()).update();
    }
}

@Component
class AuditLog {
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(String event, long orderId) {
        db.sql("INSERT INTO audit (event, order_id) VALUES (?, ?)")
          .params(event, orderId)
          .update();
    }
}
```

Written inside the outer transaction, the audit row is rolled back along with the
failure it was documenting — the one record of what happened disappears with the
failure. `REQUIRES_NEW` gives it a separate transaction that commits regardless.

**Why this case is safe:** the inner transaction is short. It takes a connection,
inserts one row, commits, and gives it back. The window during which a thread holds
two connections is milliseconds, so the pool pressure is real but small — and the
arithmetic still applies, so the pool must still exceed the thread count.

Two other defensible uses, both with the same shape — short, independent, must
commit:

- **A sequence or counter** that must advance even if the work fails.
- **A "job attempted" marker** that prevents an infinite retry loop.

## Where it is misused

**Silencing `UnexpectedRollbackException`.** This is the big one — see
[chunk 9b](09b-fixing-the-rollback-only-trap.md). Adding `REQUIRES_NEW` to an
inner method makes the exception go away without anybody deciding whether a failed
item should abort the operation, and it is chosen because it is the smallest diff
rather than because it is right.

**Per-item transactions in a loop.** A loop of a thousand rows calling a
`REQUIRES_NEW` method performs a thousand begin/commit round trips while holding
the outer connection throughout. If each row is genuinely its own unit of work,
the outer method should not be transactional at all — then each call needs one
connection, not two.

**"Making sure this really commits."** Under `REQUIRED` an inner method's work is
committed at the outer boundary, which is almost always what you want.
`REQUIRES_NEW` to "be sure" buys a connection and gives up atomicity.

## The decision, in one question

**Does the outer transaction genuinely need to stay open while this inner work
commits?**

| Answer | What that means | What to do |
|---|---|---|
| yes — the outer work is a real unit that must stay atomic | the audit-row shape | **`REQUIRES_NEW`**, and size the pool |
| no — the outer method is just a loop | nothing outside the loop needs rolling back | **remove the outer `@Transactional`** |
| no — but a failed item should abort everything | the outer transaction is doing its job | **stop swallowing the exception** |
| not sure | you have not decided what the unit of work is | decide that first |

🔴 **If the outer method would have nothing to roll back, it should not be a
transaction.** That single observation removes most `REQUIRES_NEW` from most
codebases, and it removes the connection cost with them.

## The trade-off

`REQUIRES_NEW` buys independence, and independence is genuinely useful exactly
once: when two pieces of work in the same call stack must have *different* fates.
The reason it is over-used is that it is also the only fix for several unrelated
symptoms that requires no restructuring — a one-word change that silences
`UnexpectedRollbackException`, that "makes sure" an inner write commits, that
gives a loop per-item durability. Each of those has a cheaper correct fix that
involves moving a boundary. **The rule of thumb: if you are adding
`REQUIRES_NEW` to an inner method, ask what the outer transaction is protecting.
If the answer is "nothing", delete the outer annotation instead.**

## Gotchas

**⚠️ `REQUIRES_NEW` in a loop**
**Symptom:** an import that was slow becomes very slow, and connection-pool
metrics spike.
**Cause:** one begin/commit round trip per item, with the outer connection held
throughout.
**Fix:** if each item is its own unit of work, remove the outer transaction and
use plain `REQUIRED` per item.

**⚠️ Expecting a rollback of the outer transaction to undo the inner one**
**Symptom:** an audit row, or worse a business row, surviving a failure.
**Cause:** that is precisely what `REQUIRES_NEW` is for.
**Fix:** it is correct for an audit row and a bug for anything the outer
transaction was supposed to own.

**⚠️ Using `REQUIRES_NEW` for the *business* write and leaving the audit inside**
**Symptom:** the arrangement is exactly backwards — the audit disappears on
failure and the business row survives.
**Cause:** the annotation was applied to whichever method was convenient rather
than to the one whose fate must differ.
**Fix:** the independent transaction belongs on the work that must survive, which
is almost never the main write.

**⚠️ An audit method that grows**
**Symptom:** a `REQUIRES_NEW` audit call that started as one insert now does a
lookup, a join and a conditional update, holding two connections for hundreds of
milliseconds.
**Cause:** the safety of the pattern depended on the inner transaction being
short, and nothing enforced that.
**Fix:** keep the independent transaction to an append. If it needs to do more,
it is not an audit row and the pool cost has to be re-examined.

**⚠️ Adding `REQUIRES_NEW` to "make sure this commits"**
**Symptom:** a connection cost and a loss of atomicity, for no behavioural gain.
**Cause:** under `REQUIRED` the inner work commits at the outer boundary, which
is almost always what was wanted.
**Fix:** `REQUIRED` already commits. The only reason to force independence is
when the outer transaction might roll back and this work must not.

**⚠️ A retry loop that wraps a `REQUIRES_NEW` call from inside the outer
transaction**
**Symptom:** the retries work, and the outer connection is held for the sum of
every attempt.
**Cause:** the outer transaction is suspended but not released for the whole
retry sequence.
**Fix:** retry outside the outer boundary. A retry inside a transaction extends
the transaction by the retry budget.

**⚠️ Reasoning about the pool as though the inner transaction were the expensive
one**
**Symptom:** effort spent optimising the inner query while the pool stays
saturated.
**Cause:** the cost is the *outer* connection being held, and its hold time is
the whole outer method.
**Fix:** shorten the outer boundary. The inner transaction is usually
milliseconds.

## Interview questions

**★ What is the legitimate use of `REQUIRES_NEW`?**
Work that must survive the outer transaction's rollback. The archetype is an
audit or attempt record: written inside the outer transaction it is rolled back
along with the failure it was documenting, so the one record of what happened
disappears exactly when it is needed. `REQUIRES_NEW` gives it a separate physical
transaction that commits independently. The reason this case is safe as well as
correct is that the inner transaction is *short* — take a connection, insert a
row, commit, release — so the window in which a thread holds two connections is
milliseconds. The pool arithmetic still applies, but the pressure is small. The
same shape covers a sequence that must advance regardless and a "job attempted"
marker that prevents an infinite retry.

**★ Someone uses `REQUIRES_NEW` to make `UnexpectedRollbackException` go away.
What is wrong with that?**
Nothing at the mechanical level — it does work, because the inner scope now owns
its own transaction and marks nothing on the outer one. What is wrong is that it
answers a question nobody asked. The exception was telling you that a `catch`
swallowed a failure the transaction could not ignore, and the real decision is
whether a failed item should abort the whole operation. `REQUIRES_NEW` answers
"no, each item is independent" — which may be right, but it should be chosen for
that reason, and if it *is* right then usually the outer method should not be
transactional at all, in which case each item needs one connection instead of
two. Reaching for `REQUIRES_NEW` because it is the smallest diff converts a
correctness question into a connection-pool liability.

**★ How would you decide between `REQUIRES_NEW` and restructuring the boundary?**
By asking whether the outer transaction genuinely needs to stay open. If the
outer work is a real unit of work that must remain atomic while one small piece
commits independently — the audit row — then `REQUIRES_NEW` is the tool and its
cost is justified. If the outer method is just a loop, and each item is
independently a unit of work, then there is no reason for an outer transaction at
all: remove it, annotate the per-item method with plain `REQUIRED`, and each
iteration uses one connection with no suspension and no round-trip
multiplication. The test is whether anything outside the loop would need to be
rolled back if an item failed. If nothing would, the outer transaction is doing no
work and is only there to create the problem `REQUIRES_NEW` is being used to
solve.

**★ Why does the audit-row use of `REQUIRES_NEW` depend on the inner transaction
being short?**
Because the cost of the pattern is measured in *connection-hold overlap*, not in
the number of annotations. A thread inside an outer transaction that calls a
`REQUIRES_NEW` method holds two connections for exactly as long as the inner
transaction runs. If that is one insert and a commit, the overlap is milliseconds
and the pool sees a brief, small increase in demand. If the inner method grows —
a lookup, a join, a conditional update, a call to something slow — the overlap
grows with it, and the pool now needs to sustain two connections per thread for a
meaningful fraction of every request. Nothing in the code marks that transition;
an audit method that quietly acquires a second query is how a safe pattern becomes
an outage. Keeping the independent transaction to an append is what makes the
arithmetic stay small.

**★ You find `REQUIRES_NEW` on a method in an unfamiliar codebase. What do you
want to know?**
Three things, in order. First, what the outer transaction is protecting — if
nothing outside the annotated inner call would need rolling back, the outer
transaction is probably vestigial and the `REQUIRES_NEW` exists to work around it.
Second, whether the inner work is short and append-only; if it queries or updates
rows the outer transaction has touched, there is a self-deadlock waiting, and if
it is slow, there is pool pressure. Third, whether the pool is sized for it —
`maximumPoolSize` against the sum of every thread pool that can be inside an outer
transaction, plus one. The commit message that introduced it is usually
informative too: "fix UnexpectedRollbackException" is a strong signal that the
propagation was chosen as a symptom fix rather than a design decision.

**★ Is there ever a reason to use `REQUIRES_NEW` when there is no outer
transaction?**
Not for correctness — with no transaction to suspend, `REQUIRES_NEW` and
`REQUIRED` both simply start one, and behave identically. The reason to write it
anyway is as a *statement of intent*: it says "this method must always have its
own transaction, whatever the caller is doing", which `REQUIRED` does not
guarantee. That guarantee is worth something for a method that will later be
called from inside a transaction and must keep its own isolation, timeout and
commit — the settings `REQUIRED` would silently discard. The cost of the
declaration is that the day such a caller appears, the connection arithmetic
changes without anyone editing the method. So it is a real choice, and it should
be accompanied by the pool sizing that makes it safe rather than left as a
latent one.

**★ Your audit table has a foreign key to `orders`. What breaks?**
The insert does, and it breaks the first time the pattern is used the way it was
designed. The `REQUIRES_NEW` transaction runs in its own session with its own
snapshot, so a row the outer transaction has just inserted and not yet committed
is invisible to it — the reference's own framing is that the two "underlying
resource transactions are different", and no isolation level a real database
offers exposes another transaction's uncommitted rows. The referential-integrity
check performed for the audit insert therefore looks for a parent row and finds
none, and the insert is rejected. Nothing is wrong with the foreign key or the
propagation individually; they are simply incompatible, because a constraint is a
statement that two rows must be committed together and `REQUIRES_NEW` exists
precisely to commit them apart. **The general rule this is one instance of: data
written by an independent transaction must be self-contained.** Store the order
id as a plain column with no constraint, or store enough of the payload that the
record still means something when the order it describes never comes into
existence. And be ready for the same asymmetry on the reading side — a consumer
polling the audit table can see an "attempted" record seconds before the order
row it refers to appears, or forever if the outer transaction rolled back, so
anything downstream has to tolerate a reference that resolves late or not at all.

---

← Prev: [10 · REQUIRES_NEW](10-requires-new.md) · Index: [Spring @Transactional](README.md) · Next → [10c · What suspension costs](10c-what-suspension-costs.md)
