---
title: "Choosing the type"
sidebar_label: "03 · Choosing the type"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-17 against the **Redis documentation** —
> [Compare data types](https://redis.io/docs/latest/develop/data-types/compare-data-types/)
> (the three decision trees and the memory-cost orderings are the docs' own),
> [Redis hashes](https://redis.io/docs/latest/develop/data-types/hashes/) and
> [Redis sorted sets](https://redis.io/docs/latest/develop/data-types/sorted-sets/).
> Documentation-validated — **no console blocks**.

The types overlap on purpose. The documentation organises the choice around
**three families — documents, collections and sequences** — and gives a decision
tree for each. This chunk is those trees, plus the part the trees leave out:
what it costs when you pick wrong.

⚠️ The docs are explicit that these are **"rules-of-thumb rather than strict
prescriptions"**. Treat them as the default you must have a reason to depart
from, not as law.

## The memory ordering, first

Two orderings from the docs are worth memorising, because they decide most ties:

| Family | Cheapest → most expensive |
|---|---|
| **Documents** | strings → hashes → **JSON** |
| **Collections** | strings → sets → **sorted sets** |

The docs put it as *"JSON generally has the highest requirements for memory and
processing, followed by hashes, and then strings"* and *"Sorted sets have the
highest memory overhead and processing requirements, followed by sets, and then
strings."*

**So the tie-breaker is: take the cheapest type that answers your actual
questions.** Most over-spending on Redis memory is a sorted set doing a set's job.

## Documents — "I have an object"

The question chain, in the docs' order:

1. **Do you need nested structures, or geospatial index/query with Redis
   Search?** → **JSON.** It is the only document type supporting deeply nested
   structures with Search over them.
2. **Do you need to index/query with Redis Search, but can live without nesting
   and geo?** → **hashes.** Lower memory overhead and faster field access than
   JSON.
3. **Do you need expiration on individual pieces of data inside the document?**
   → **hashes.** Only hashes support field-level access *and* field-level
   expiry. (`HEXPIRE` is Phase 4; it arrived in Redis 7.4.)
4. **Do you need frequent access to individual fields that are simple integers
   or bits addressable by an integer index?** → **strings**, used as bitfields
   or bitmaps. More compact than a hash for that shape.
5. **Do you need frequent access to individual fields with string or binary
   values?** → **hashes.**
6. **Otherwise** → **strings.**

**The practical read for a MERN/PERN application:** step 5 is where most cached
objects land. If your code ever does `JSON.parse(await redis.get(k)).email`, the
tree already told you to use a hash.

⚠️ **Redis Search is out of this bible's brief** — steps 1 and 2 mention it
because the docs' tree does. If you are not running Search, those branches
collapse and the question becomes "is it nested?" for JSON and "do I read fields
individually?" for hashes.

## Collections — "I have a bag of unique things"

1. **Do you need to retrieve the members in an arbitrary or lexicographical
   order?** → **sorted sets.** They are the only collection type supporting
   ordered iteration.
2. **Do you need extra information per member AND no set operations (union,
   intersection, difference)?** → **hashes.** Hashes associate data with each
   key but cannot do set algebra.
3. **Are the keys always simple integer indices in a known range?** → **strings
   as bitmaps.** Minimum memory overhead, efficient random access, and bitwise
   operations that are equivalent to set operations.
4. **Otherwise** → **sets.**

The docs add a genuinely useful escape hatch for step 2: *if you need extra
information for the members of a set or sorted set, you can keep it in an
auxiliary hash or JSON object whose field names match the members.* That is the
standard way out of "I need a set, but also some data per member" — you do not
have to abandon the set.

**Worked example — daily active users.** Membership only, ids are integers in a
known range → step 3 says a bitmap, one bit per user. A set of a million user ids
stores a million strings; a bitmap stores a million bits. That is the difference
between megabytes and ~125 KB, and it is why the bitmap topic exists in Phase 3.

## Sequences — "I have things in an order"

1. **Do you need arbitrary priority order, lexicographical order, or set
   operations?** → **sorted sets.**
2. **Do you need caller-chosen integer indices (including sparse ones),
   server-side aggregation over an index range, or a fixed-size ring buffer?**
   → **arrays.** They map integer indices to values with O(1) access, do not
   allocate the gaps in sparse indices, and provide aggregation and ring-buffer
   operations that lists and streams do not.
3. **Do you need timestamp order, or multiple consumers reading the sequence?**
   → **streams.** The only sequence type with timestamp-based ordering and
   consumer groups giving at-least-once delivery.
4. **Otherwise** → **lists.**

**Step 3 is the one that matters most in a Node application**, and it is the
whole argument of Phase 5. "A list is my job queue" is fine until you need more
than one consumer, redelivery after a crash, or to know what is in flight. Then
it is a stream, and the pending-entries list is how you recover work from a dead
worker.

## The four questions that resolve most real cases

Strip the trees down and this is what is left:

| Ask | If yes |
|---|---|
| Do I need **order**? | sorted set (by score) or stream (by time) |
| Do I need **uniqueness**? | set, or sorted set if also ordered |
| Do I read **individual fields**? | hash |
| Do I need **multiple consumers with redelivery**? | stream |

If all four are no, it is a string.

## The cost of choosing wrong

**There is no `ALTER TABLE`.** Changing a key's type is not a schema migration
you declare; it is a program you write, and it usually looks like: write to both
shapes, backfill the old data under new keys, cut reads over, delete the old
keys. Every service touching that key has to be deployed in the right order.

Three specific traps:

1. **A `SET` on an existing key of another type succeeds.** The docs are explicit
   that `SET` *"sets the string value of a key, ignoring its type"* — it replaces
   whatever was there, even a hash or a list. There is no type error to catch;
   the old value is simply gone.
2. **Other commands do the opposite** — running a hash command against a key
   holding a string is a `WRONGTYPE` error. So a half-migrated keyspace fails
   loudly in one direction and silently in the other.
3. **The shape is a public API.** Once two services read a sorted set of user
   ids, its meaning is frozen without a coordinated deploy.

⚠️ **The mitigation is Phase 1's, not this topic's:** put the shape in the key
name (`user:1:sessions:zset` style conventions, or at minimum a version segment
you can bump) so a new shape can be written under a new key while the old one is
still being read.

## Trade-off

**The decision trees optimise for memory and for the queries you know about
today.** The cheapest type that answers today's questions is often the one that
cannot answer tomorrow's. A set is cheaper than a sorted set right up to the
first time somebody asks for "the ten most recent", at which point you have no
scores and no way to derive them.

There is no clean resolution, and pretending otherwise is how both failure modes
happen. The honest guidance: **let the memory ordering decide ties, but let a
concretely anticipated query beat it.** "We might want ordering someday" is not
a query; "the product spec has a leaderboard in it" is.

**The second trade is that overlap makes wrong choices work.** A serialised JSON
string can do a hash's job, a sorted set can do a set's job, a list can do a
stream's job. None of them fail immediately — they fail at scale, under
concurrency, or in the incident where you need to reclaim a dead worker's jobs.
That delay is exactly why the choice deserves thought at design time.

## Gotchas

**Reaching for a sorted set by default.**
*Symptom:* memory well above the estimate, for no ordering that anyone uses.
*Cause:* sorted sets can do everything, so they feel safe.
*Fix:* the docs' ordering — sorted sets cost most, then sets, then strings.
Use the cheapest type that answers your questions.

**A cached object stored as a JSON string, read one field at a time.**
*Symptom:* whole documents on the wire to read an email address.
*Cause:* the string is the default reach.
*Fix:* the documents tree, step 5 — a hash, and `HGET`.

**A hash used where the data is genuinely nested.**
*Symptom:* field names like `address.city.postcode`, or double-serialised JSON
inside hash fields.
*Cause:* hashes do not nest; their field values are strings.
*Fix:* either the JSON type, or flatten deliberately into the key name — but
choose, rather than growing a convention by accident.

**A list as a multi-consumer job queue.**
*Symptom:* a job vanishes when a worker is killed mid-processing.
*Cause:* a popped list element is gone; there is no in-flight state.
*Fix:* a stream with consumer groups, where unacknowledged entries sit in the
pending entries list and can be reclaimed. Phase 5.

**`SET` on a key that held a hash.**
*Symptom:* a hash silently becomes a string; later hash commands raise
`WRONGTYPE`.
*Cause:* `SET` ignores the existing type by design.
*Fix:* single-purpose key names, and a key-naming convention that makes a
collision obvious (Phase 1).

**Storing per-member metadata by abandoning the set.**
*Symptom:* a set is replaced by a hash, and the set operations are then
reimplemented in application code.
*Cause:* not knowing the auxiliary-hash pattern.
*Fix:* keep the set for membership and algebra, and hold the metadata in a
parallel hash keyed by member — the docs recommend exactly this.

**Using a set of integer ids where a bitmap would do.**
*Symptom:* megabytes for a daily-active-users set.
*Cause:* the collections tree's step 3 is the least-known branch.
*Fix:* if the ids are integers in a known range and you only need membership and
counting, a bitmap is one bit per member.

**Choosing a type from a blog post's benchmark.**
*Symptom:* a shape that is fast for an access pattern you do not have.
*Cause:* benchmarks optimise the query they measured.
*Fix:* run the tree against *your* queries. The docs' own framing —
rules-of-thumb, "many subtle reasons to prefer one over another" — is the right
level of confidence.

## Interview questions

**★ How do you choose between a hash and a serialised JSON string?**
Ask whether you read individual fields. If yes, a hash: `HGET` returns one field
without transferring the object, and hashes support field-level expiry. If the
value is always read and written whole and has no internal structure you care
about, a string is cheaper — the docs rank strings below hashes below JSON on
memory and processing.

**★ When is a sorted set the wrong choice?**
When nothing needs order. Sorted sets carry the highest memory and processing
overhead of the collection types, so if you only test membership and do set
algebra, a plain set is the right answer, and if the members are integers in a
known range, a bitmap is cheaper still.

**★ You need a set, but also some data per member. What do you do?**
Keep the set for membership and set operations, and store the per-member data in
an auxiliary hash or JSON object whose field names match the set members. The
docs recommend this directly. Replacing the set with a hash works only if you
never need union, intersection or difference.

**★ When does a list stop being an acceptable queue?**
When you need more than one consumer, redelivery after a crash, or visibility
into what is in flight. A popped list element is gone, so a worker killed
mid-job takes the job with it. Streams with consumer groups keep unacknowledged
entries in a pending entries list that another consumer can claim.

**How do you pick a sequence type?**
Arbitrary priority, lexicographic order or set operations → sorted set.
Caller-chosen or sparse integer indices, server-side aggregation, or a ring
buffer → array. Timestamp order or multiple consumers → stream. Otherwise a
list.

**Which types can Redis Search index?**
Hashes and JSON. That is why the documents decision tree asks about Search
first — needing Search plus nesting forces JSON, while Search without nesting is
satisfied more cheaply by hashes. Search itself is out of this track's scope.

**What happens if you `SET` a key that currently holds a list?**
It succeeds and the list is replaced by the string — the docs describe `SET` as
setting the value "ignoring its type". This is asymmetric: type-specific commands
against a wrong-typed key raise `WRONGTYPE`, but `SET` silently overwrites, which
makes accidental type collisions hard to notice.

**How do you change a key's type in production?**
By hand, as a migration: write both shapes, backfill under a new key name, move
reads across, then delete the old keys — coordinating every service that touches
the key. There is no `ALTER TABLE`. This is why key-naming conventions with room
for a version segment matter, and it is the strongest argument for spending time
on the choice up front.

**Is it wrong to use strings for everything?**
Not wrong, but the docs point out you would be re-implementing the other types
"with a little creativity" and losing their trade-offs: atomicity of the
type-specific commands, complexity guarantees, partial field access, server-side
computation, and compact per-type encodings. It also tends to be a symptom of the
key-value-cache mental model rather than a decision.

---

← Prev: [02 · Operations happen where the data is](./02-operations-where-the-data-is.md) ·
Next: [04 · What Redis is not](./04-what-redis-is-not.md) →
