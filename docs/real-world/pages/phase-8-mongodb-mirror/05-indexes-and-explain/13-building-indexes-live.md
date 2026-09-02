---
title: "Index builds run simultaneously on every data-bearing member and need a quorum to finish, which makes an unreachable secondary a stalled migration"
sidebar_label: "17 · Building indexes live"
sidebar_position: 17
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-02 against the **MongoDB Manual (8.0)** —
> [Index Builds on Populated Collections](https://www.mongodb.com/docs/manual/core/index-creation/)
> (*"Index builds on a replica set or sharded cluster build simultaneously across
> all data-bearing replica set members"*; the commit-quorum description; *"Index
> builds obtain an exclusive lock on the collection being indexed only at the start
> and end of the build"*; *"if a data-bearing voting node becomes unreachable and
> the commitQuorum is set to the default `votingMembers`, index builds can hang
> until that node comes back online"*; the rolling-build description),
> [Unique Indexes](https://www.mongodb.com/docs/manual/core/index-unique/)
> (*"using a rolling procedure to create a unique index requires that you stop all
> writes to the collection during the procedure. If you cannot stop all writes to
> the collection during the procedure, do not use the rolling procedure"*),
> [Text Indexes](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-text/).
> Counterpart: `create index concurrently`
> ([1·02](../../phase-1-database/02-migrations.md), [1·10](../../phase-1-database/10-indexes.md)).
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**[Chunk 2's migration](02-the-index-list.md) is fifteen `createIndex` calls, and
on an empty database it is instant and uninteresting. Against a populated
production replica set it is a distributed operation with a quorum, and the two
things worth knowing before running it are both about *waiting*. The build happens
on every data-bearing member at once and does not complete until a quorum of them
votes to commit — so **one unreachable secondary hangs the migration**. And the
rolling procedure that avoids the coordinated build has a restriction that rules it
out for most of this app's indexes: **it requires stopping all writes if the index
is unique.**

## What Phase 1 did, and why it does not port

Phase 1 used `create index concurrently`, which needed its own migration file
because a concurrent build cannot run inside a transaction, and which left an
`INVALID` index behind on failure that had to be dropped and rebuilt.

None of that ports. MongoDB has no DDL transaction to break, and a failed build
does not leave a half-index. **The problem it solves — building without blocking
writes — is solved differently**, and the mechanics are worth knowing because they
are the thing that goes wrong.

## The build is coordinated across the replica set

> *"Index builds on a replica set or sharded cluster build simultaneously across
> all data-bearing replica set members. The primary requires a minimum number of
> data-bearing voting members (that is, commit quorum), including itself, that must
> complete the build before marking the index as ready for use."*
> — [Index Builds on Populated Collections](https://www.mongodb.com/docs/manual/core/index-creation/)

The sequence, from the same page:

1. The primary receives `createIndexes` and writes a `startIndexBuild` oplog entry.
2. *"The secondaries start the index build after they replicate the
   `startIndexBuild` oplog entry."*
3. Each member votes to commit once it has finished indexing.
4. Secondaries keep processing new writes into the index while waiting.
5. With a quorum of votes, the primary checks for key constraint violations — *"such
   as duplicate key errors"* — and commits.

Two consequences fall out of this that a Postgres background does not prepare you
for.

**The index is not usable anywhere until it is ready everywhere.** There is no
window in which the primary has it and the secondaries do not. That is a good
property and it means the build's duration is the *slowest* member's duration.

**Duplicate key violations are found at the end.** Step 5 is where a unique index
over data that violates uniqueness fails — after every member has done the full
scan. So the failure arrives at the worst possible moment: maximum work done, zero
result. [Chunk 3's](02b-what-the-list-leaves-out.md) advice to verify uniqueness
with an aggregation *before* building is not fussiness; it is avoiding a long wait
for a failure you could have had in seconds.

## What is locked, and for how long

> *"Index builds obtain an exclusive lock on the collection being indexed only at
> the start and end of the build. The rest of the build process uses the yielding
> behavior of background index builds to maximize read-write access to the
> collection during the build."*

The documented lock sequence:

| Phase | Lock | Effect |
|---|---|---|
| start | exclusive `X` | blocks all operations |
| scan collection, process side writes | intent exclusive `IX`, yielding | reads and writes interleave |
| before finish | shared `S` | blocks **writes** |
| final | exclusive `X` | blocks all operations |
| release | — | |

So it is *"only at the start and end"* — but the end includes an `S` lock that
blocks writes while the build drains the side-writes accumulated during the scan.
**On a write-heavy collection that drain is not instantaneous**, and it is the part
people are surprised by: the build "finished" and the application saw a write
stall.

The practical implication for this app: `products` is read-heavy and writes rarely,
so the catalog indexes are unremarkable. `orders` and `sessions` write constantly,
and a build against either is best scheduled when it is not.

## Commit quorum, and the hang

> *"If a data-bearing voting node becomes unreachable and the commitQuorum is set
> to the default `votingMembers`, index builds can hang until that node comes back
> online."*

This is the failure mode to recognise, because it does not look like a failure.
The `createIndexes` call does not error; it **waits**. A migration runner with no
timeout waits with it, and a deployment pipeline hangs on a step that is doing
nothing wrong.

The default `commitQuorum` is `votingMembers` — every data-bearing voting member.
It can be set lower (`majority`, a number, or `0`) on the `createIndexes` command,
which trades the "ready everywhere simultaneously" guarantee for tolerance of a
member being down. **That is a deployment decision, not an application one**, and
the important part is knowing the knob exists before you are staring at a hung
migration at 2am.

The migration runner should therefore have a timeout and should log *"index build
started"* separately from *"index build committed"*, so a hang is distinguishable
from a slow build.

## Rolling builds, and why this app cannot use one

> *"Rolling index builds take at most one replica set member at a time, starting
> with the secondary members, and build the index on that member as a standalone.
> Rolling index builds require at least one replica set election and should only be
> used if specific requirements are met, as the procedure lowers the resiliency of
> the cluster."*

The appeal is obvious — no coordinated build, no whole-cluster impact. The cost is
that each member leaves the replica set, builds as a standalone, and rejoins, and
that the primary must eventually be stepped down so it can take its turn. *"At
least one replica set election"* is not a footnote; it is a failover, on purpose,
during a maintenance window.

And then the restriction that decides it here:

> *"For replica sets and sharded clusters, using a rolling procedure to create a
> unique index requires that you stop all writes to the collection during the
> procedure. If you cannot stop all writes to the collection during the procedure,
> do not use the rolling procedure."*
> — [Unique Indexes](https://www.mongodb.com/docs/manual/core/index-unique/)

**Eight of the indexes in [chunk 2's list](02-the-index-list.md) are unique.** A
rolling build of `users.email` or `orders.idempotencyKey` while writes continue can
let a duplicate through on a member that is not currently enforcing the
constraint — which is exactly the correctness window
[chunk 3](02b-what-the-list-leaves-out.md) described for drop-and-recreate, spread
across a cluster.

So: **coordinated builds for this app, and the rolling procedure only for the
non-unique indexes on the largest collections, if it is ever needed at all.**

## The one build that deserves a window

The text index. Everything
[chunk 10](07-the-text-index.md) says about its cost applies here at build time —
one index entry per unique stemmed word per indexed field per document,
significant RAM, a build that *"takes longer than building an ordered (scalar)
index on the same data"* — and the Manual adds a practical note about ensuring
sufficient file descriptor limits for large text index builds.

It is the reason
[chunk 3](02b-what-the-list-leaves-out.md) puts it in a separate migration file: so
the slow, memory-hungry step can be scheduled independently of the fifteen cheap
ones, and so a failure in it does not leave you wondering whether the others
landed.

## Gotchas

**★ An unreachable voting member hangs the build, it does not fail it.** With the
default `votingMembers` commit quorum, `createIndexes` waits for a node that is
down. The migration runner sees no error and no progress. Give it a timeout, and
know that `commitQuorum` is adjustable before you need it.

**★ The build is only as fast as the slowest member.** Every data-bearing member
builds simultaneously and the index is not ready until a quorum has finished. A
lagging or under-provisioned secondary sets the pace for the whole cluster.

**★ Duplicate key violations surface at the *end* of a unique build.** The primary
checks constraints after collecting a quorum of votes, so a unique index over
non-unique data fails after every member has done the full scan. Verify uniqueness
with an aggregation first; the check costs seconds and the failure costs the whole
build.

**★ "Locks only at the start and end" includes a write-blocking `S` lock at the
end.** The final phase drains the writes that accumulated during the scan, and on a
write-heavy collection that is a visible stall. The build did not misbehave; the
sentence is more subtle than it reads.

**★ A rolling build requires an election.** It is a deliberate failover in a
maintenance window, plus a period where the cluster is running with one fewer
member and is therefore less resilient. That is the trade, and it is rarely worth
it for a collection this app's size.

**★ You cannot roll a unique index build while writes continue.** The Manual says
so unconditionally: stop all writes, or do not use the rolling procedure. Eight of
this app's indexes are unique, so the rolling procedure is off the table for most
of the migration.

**★ `createIndex` on an existing identical index is a no-op and does not
rebuild.** Which is what makes the migration re-runnable — but it also means
"re-run the migration" is not a way to repair a suspect index. Repair is an
explicit drop and create, with the window that implies
([chunk 3](02b-what-the-list-leaves-out.md)).

**★ Adding an index flushes the collection's plan cache.** So a build that
succeeds perfectly still changes the plans of unrelated queries against the same
collection ([chunk 16](12-hint-and-the-plan-cache.md)). Expect a latency wobble
after a successful index migration and do not attribute it to the new index.

**★ Text index builds want file descriptor headroom.** The Manual raises it
specifically for large text index builds. It is the kind of limit that is fine on a
developer machine and not fine on a container with conservative `ulimit` settings.

**★ There is no `CONCURRENTLY` and no `INVALID` index to clean up.** The Postgres
habits do not transfer: a failed MongoDB build does not leave a partial index that
queries silently ignore. That is one genuine simplification in this chapter.

## Interview questions

**★ How does a MongoDB index build differ from Postgres's `CREATE INDEX
CONCURRENTLY`?**
Postgres's concurrent build is a single-node operation that cannot run in a
transaction and can leave an `INVALID` index behind on failure, which has to be
dropped and rebuilt. MongoDB's build is distributed: it runs simultaneously on
every data-bearing member, and the primary marks the index ready only after a
commit quorum of members has finished and voted. There is no transaction to
conflict with and no partial index to clean up. The trade is that the failure modes
move — instead of a leftover invalid index, you get a build that hangs waiting for
an unreachable member.

**★ Your index migration has been running for forty minutes with no error and no
completion. What is your first hypothesis?**
That a data-bearing voting member is unreachable and the default `votingMembers`
commit quorum is waiting for it. The Manual documents exactly this: index builds
can hang until that node comes back online. It does not error, so a migration
runner without a timeout waits indefinitely. Check replica set health first;
lowering `commitQuorum` is the escape hatch, at the cost of the guarantee that the
index is ready on every member simultaneously.

**★ The documentation says the build locks only at the start and end. Why did
writes stall for thirty seconds at the end?**
Because the "end" is two phases, and the first of them takes a shared `S` lock that
blocks writes while the build drains the side writes accumulated during the
collection scan. On a write-heavy collection that drain is proportional to how many
writes arrived during the build, so a long build on a busy collection has a long
tail. The sentence is accurate and easy to read as "briefly".

**★ Why can't you use a rolling build for `users.email`?**
Because it is unique, and the Manual states unconditionally that a rolling
procedure to create a unique index requires stopping all writes to the collection
for the duration — and that if you cannot stop writes, you must not use the
procedure. A member building as a standalone is not enforcing the cluster-wide
constraint, so a duplicate can be accepted during its window and then block the
build on a later member. Eight of this app's indexes are unique, which puts the
rolling procedure out of reach for most of the migration.

**★ You are about to build a unique index on a large production collection. What
do you do first?**
Verify the data satisfies the constraint, with an aggregation grouping by the key
and matching groups with a count above one. The constraint check happens at the
*end* of the build, after every member has scanned the whole collection, so
discovering a duplicate that way costs the entire build. Doing it first costs
seconds and turns a failed migration into a data-cleanup task you can schedule.

**★ The index migration succeeded and an unrelated endpoint got slower. Is that
plausible?**
Entirely. Creating an index is a DDL event that flushes the plan cache for that
collection, so every query shape against it re-plans on its next execution and any
of them can land on a different winner. The new index may also be *chosen* by a
query it was not built for, correctly or otherwise. Both effects are transient in
the sense that they settle, and both are worth expecting rather than diagnosing
from scratch — the mechanism is
[chunk 16](12-hint-and-the-plan-cache.md)'s subject.

---

← Prev: [`hint()` and the plan cache](12-hint-and-the-plan-cache.md) ·
Index: [Indexes for this app's queries](README.md) ·
Next chapter → **Change streams where `LISTEN`/`NOTIFY` was** *(not written yet)*
