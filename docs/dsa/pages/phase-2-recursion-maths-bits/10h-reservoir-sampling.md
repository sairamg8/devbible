---
title: "Reservoir sampling is the answer to sampling a stream whose length you will not know until it ends, and the whole algorithm is one line — accept the i-th item with probability k/i — whose correctness is an induction you should be able to run out loud"
sidebar_label: "10h · Reservoir sampling"
sidebar_position: 10.7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08. Reservoir sampling is **mathematics and common practice, derived on this
> page rather than cited** — the research bank for this phase records it as such, and the induction
> below is the content. The named variants (algorithm L's skip distribution, weighted reservoirs)
> are **named as pointers to the literature and are not derived or quoted here**. The random-integer
> primitive it depends on is [10d](10d-uniform-integers-and-modulo-bias.md). **No sandbox run: no
> distribution below was measured; every probability is arithmetic in the text.**

**Fisher–Yates needs the array; reservoir sampling needs only the next item.** That is the entire
distinction and it is why the two live in the same topic: the shuffle is the offline algorithm and
this is the online one. Given a stream of unknown length — a log file being appended to, a database
cursor you cannot `COUNT`, a queue you are consuming, an API paginating until it stops — you must
choose `k` items uniformly at random from `n`, without ever knowing `n`, holding `Θ(k)` memory, in
one pass. The algorithm that does it is four lines. Its correctness is an induction that ends with
each element having survived with probability exactly `k/n`, and being able to run that induction
aloud is what the question is testing, because the code is too short to be the point.

## The problem, stated so the constraints bite

- The items arrive one at a time and each is seen once.
- `n` is unknown until the stream ends, and may be larger than memory.
- The sample must be uniform over all `k`-subsets: every subset of size `k` equally likely.
- Memory is `Θ(k)`, not `Θ(n)`.

The naive approaches each fail one constraint. Buffering everything and calling the partial shuffle
from [10b](10b-fisher-yates-in-practice.md) needs `Θ(n)` memory. Two passes — count, then pick `k`
indices — needs the stream to be replayable, which a queue consumer's is not. "Take every `m`-th
item" is systematic sampling, not uniform, and it is exquisitely sensitive to periodicity in the
stream.

## Algorithm R for k = 1

Keep one item. When the `i`-th item arrives (counting from 1), replace the held item with it with
probability `1/i`.

```ts
function sampleOne<T>(stream: Iterable<T>, rng = Math.random): T | undefined {
  let held: T | undefined;
  let i = 0;
  for (const item of stream) {
    i++;
    if (rng() < 1 / i) held = item;   // i = 1 -> probability 1, so the first is always taken
  }
  return held;
}
```

**The induction.** Claim: after `i` items, the held item is uniformly distributed over the `i` seen
so far — each has probability `1/i`.

*Base case, `i = 1`:* `1/1 = 1`, so the first item is always taken and the claim holds.

*Step:* assume it holds after `i−1` items. When item `i` arrives, it is taken with probability
`1/i` — so it satisfies the claim. Any earlier item `x` is held afterwards only if it was held
before, probability `1/(i−1)` by hypothesis, **and** item `i` was not taken, probability
`1 − 1/i = (i−1)/i`. The two events are independent, so

`P(x held after i) = 1/(i−1) · (i−1)/i = 1/i`.

Every item, old or new, has probability `1/i`. ∎

That cancellation — the `(i−1)` in the numerator of the survival factor killing the `(i−1)` in the
denominator of the hypothesis — is the whole trick, and it is why the acceptance probability has to
be exactly `1/i` and not anything near it.

## Algorithm R for general k

Fill the reservoir with the first `k` items. For each subsequent item `i` (1-indexed), pick a
uniform integer `j` in `[0, i)`; if `j < k`, overwrite `reservoir[j]` with the new item.

```ts
function reservoir<T>(stream: Iterable<T>, k: number, rng = Math.random): T[] {
  const res: T[] = [];
  let i = 0;
  for (const item of stream) {
    i++;
    if (i <= k) {
      res.push(item);
      continue;
    }
    const j = Math.floor(rng() * i);   // uniform in [0, i)
    if (j < k) res[j] = item;
  }
  return res;
}
```

```java
static <T> List<T> reservoir(Iterator<T> stream, int k, Random rnd) {
    List<T> res = new ArrayList<>(k);
    long i = 0;                                   // long: a stream can outrun an int
    while (stream.hasNext()) {
        T item = stream.next();
        i++;
        if (i <= k) { res.add(item); continue; }
        long j = Math.floorMod(rnd.nextLong(), i);   // see the note below
        if (j < k) res.set((int) j, item);
    }
    return res;
}
```

⚠️ That `floorMod` line is doing two jobs and deserves the comment it has:
`nextLong()` ranges over all `long` values including negatives, and `%` would keep the dividend's
sign ([03k](03k-the-remainder-trap-in-indices-hashes-and-shards.md)), so `floorMod` is what keeps
the index non-negative — and it still carries the modulo bias of
[10d](10d-uniform-integers-and-modulo-bias.md), negligible here because `i` is astronomically
smaller than the `long` range but worth naming rather than hiding. If `i` fits in an `int`,
`rnd.nextInt((int) i)` is the documented-uniform call and the better choice.

**The proof, by the same shape.** Claim: after `i ≥ k` items, every one of them is in the reservoir
with probability `k/i`.

*Base case, `i = k`:* all `k` items are in, probability `k/k = 1`. ✓

*Step:* assume it holds after `i−1`. Item `i` enters if `j < k`, which has probability `k/i` — the
claim holds for the new item directly. An older item `x` remains if it was in the reservoir,
probability `k/(i−1)`, **and** it was not evicted. Eviction of `x` requires item `i` to enter
(probability `k/i`) and then the chosen slot `j` to be `x`'s slot (probability `1/k` given entry),
so `P(x evicted) = k/i · 1/k = 1/i`, and `P(x survives) = 1 − 1/i = (i−1)/i`. Therefore

`P(x in reservoir after i) = k/(i−1) · (i−1)/i = k/i`. ∎

The same cancellation. Setting `k = 1` recovers the previous proof exactly, which is a good check to
do aloud.

**One thing the induction proves and one thing it does not.** It proves each *element* is present
with probability `k/n`, and by a symmetry argument every `k`-subset is equally likely, which is the
property you want. It says nothing about the *order* the items sit in inside the reservoir. If you
need a uniformly random ordering as well as a uniformly random subset, run Fisher–Yates over the
reservoir at the end: `Θ(k)`, and it removes the need to reason about slot assignment at all.

## Where a stream actually forces it

- **Sampling a log.** "Give me 1,000 representative lines from today's log" — the file is being
  appended to while you read, so there is no `n`, and reading it twice gives two different files.
  One pass, `Θ(k)` memory, done.
- **A queue consumer.** Messages are consumed and gone. You cannot revisit item 5,000 to decide
  whether to include it.
- **A database cursor without a count.** `SELECT COUNT(*)` on a large table is a full scan you are
  trying to avoid, and `ORDER BY random() LIMIT k` sorts the whole table. Streaming the cursor
  through a reservoir costs one scan and `Θ(k)` memory.
- **A paginated third-party API.** You discover the length by hitting the end.
- **Sampling for observability.** Keeping `k` traces per minute out of an unknown arrival rate is
  exactly this problem, restarted every minute.

## Variants, named not derived

Three extensions exist and are worth knowing by name; **none is derived here** and each is a
literature topic:

- **Algorithm L** replaces the per-item coin flip with a computed *skip distance* — how many items
  to ignore before the next replacement — reducing the number of random draws from `Θ(n)` to
  `Θ(k log(n/k))`. Same output distribution, far fewer calls to the generator, and the win is real
  when `n` is enormous and the generator is expensive (a cryptographic one, say).
- **Weighted reservoir sampling** selects with probability proportional to a weight, typically by
  assigning each item a key derived from its weight and a uniform draw and keeping the `k` largest
  keys in a heap. This is the one to reach for when "sample 100 requests" should mean "sample in
  proportion to request cost".
- **Distributed reservoirs** are mergeable, but *only if each partial reservoir carries the count of
  items it saw*. Merging by concatenating and re-sampling without the counts over-represents small
  partitions, which is the classic distributed-sampling bug.

## Gotchas

**★ Symptom: the first item is never selected, or the sample is empty for a one-item stream.**
Cause: 0-indexing the counter, so the first item is tested against probability `1/0` or `1/1` in the
wrong direction. Fix: count from 1, and check the base case explicitly — at `i = 1` the acceptance
probability must be exactly 1. Almost every reservoir bug is this off-by-one.

**★ Symptom: the reservoir over-weights the beginning of the stream.** Cause: the acceptance
probability written as `k/(i+1)` or the counter incremented after the test instead of before. Fix:
run the induction on paper for `i = k+1` — the `(i−1)/i` survival factor must cancel the `k/(i−1)`
hypothesis exactly, and any off-by-one breaks the cancellation, which is precisely why the proof is
worth memorising and the code is not.

**★ Symptom: a stream shorter than `k` returns a reservoir with fewer than `k` items.** Cause:
correct behaviour, and usually unhandled by the caller. Fix: decide and document — return what you
have, or throw. There is no way to sample `k` distinct items from fewer than `k`, so the only bug
available here is the caller assuming a full array.

**★ Symptom: the counter overflows on a long-running stream.** Cause: an `int` counter on a stream
that exceeds two billion items — a plausible day's worth of events. Fix: `long` in Java, and in
JavaScript be aware that a number stops being an exact integer past `2^53 − 1`
([05](05-integer-limits-and-overflow.md)); beyond that, `1/i` is still fine as a float but an exact
count is not. The acceptance probability degrades gracefully; the count does not.

**★ Symptom: `Math.random() < k / i` used for the general-`k` case, then a random slot chosen
separately.** Cause: transcribing the `k = 1` form into the general one. Fix: it is actually
correct if the slot is then chosen uniformly from `[0, k)`, and it is one more draw than the
`j = floor(rng() * i); if (j < k)` form, which does both jobs with one number. Prefer the single
draw and know that the two are equivalent — being able to say *why* they are equivalent is a good
answer.

**★ Symptom: the sample is uniform but the results always appear in the same relative order.**
Cause: the reservoir's slot arrangement is not the same thing as a random ordering, and the first
`k` items keep their slots unless evicted. Fix: shuffle the reservoir at the end if order matters.
`Θ(k)` and no further reasoning required.

**★ Symptom: parallel workers each keep a reservoir and the merged sample over-represents the small
partitions.** Cause: merging without the per-worker counts. Fix: each worker returns `(reservoir,
count)`, and the merge draws from each reservoir in proportion to its count. Concatenate-and-resample
treats a worker that saw 10 items as equal to one that saw 10 million.

**★ Symptom: reservoir sampling used where sampling *with* replacement was wanted.** Cause: not
noticing which one the problem asked for. Fix: reservoir sampling gives `k` **distinct** items.
Sampling with replacement from a stream is a different (and easier) problem: keep `k` independent
`k = 1` reservoirs.

**★ Symptom: a cryptographically-sourced reservoir over a huge stream becomes the bottleneck.**
Cause: one secure draw per item. Fix: this is what algorithm L exists for — computing a skip
distance reduces the number of draws to `Θ(k log(n/k))`. Note the fix is fewer draws, not a weaker
generator, when the sampling has to be unpredictable.

## Interview questions

**★ Pick one item uniformly at random from a stream of unknown length. How?**
Hold the first item; when the `i`-th arrives, replace the held item with probability `1/i`. The
proof is a two-line induction: after `i−1` items every one of them is held with probability
`1/(i−1)`; item `i` is taken with probability `1/i`, and an older item survives if it was held and
the new one was not taken, which is `1/(i−1) · (i−1)/i = 1/i`. So the invariant is maintained and at
the end every item has probability `1/n`. Memory is one slot and the pass is single.

**★ Now `k` items, and prove each element is chosen with probability `k/n`.**
Fill the reservoir with the first `k`. For item `i > k`, draw `j` uniform in `[0, i)` and if `j < k`
overwrite slot `j`. Induction: after `i−1` items each is present with probability `k/(i−1)`. Item
`i` enters with probability `k/i`. An older item is evicted only if the new item enters *and* its
slot is chosen, which is `k/i · 1/k = 1/i`, so it survives with probability `(i−1)/i`, giving
`k/(i−1) · (i−1)/i = k/i`. The `k = 1` case is the previous answer.

**★ Why not just buffer the stream and use a partial Fisher–Yates?**
Because that needs `Θ(n)` memory and `n` may exceed memory or be unbounded, and because it needs the
stream to still exist when you finish counting — a queue consumer's does not. If the data *does* fit
and is replayable, buffering and using the partial shuffle from
[10b](10b-fisher-yates-in-practice.md) is simpler and uses `Θ(k)` draws instead of `Θ(n)`, so it is
the better answer whenever it applies. The correct response to the question is to establish which
regime you are in first.

**★ How many random numbers does it consume, and can that be reduced?**
Algorithm R draws once per item after the first `k`, so `Θ(n)` draws for a `Θ(k)` result — the
draws, not the memory, are the cost that scales with the stream. Algorithm L instead samples a skip
distance and jumps, reducing the count to `Θ(k log(n/k))` with the same output distribution. It
matters when the generator is expensive, which is the cryptographic case, and when `n` is very much
larger than `k`. ⚠️ The skip distribution itself is a literature result and not derived here.

**★ Ten workers each sample a reservoir from their shard. How do you combine them?**
Each worker must return its reservoir *and* the number of items it saw. Merging then draws items
from the workers' reservoirs in proportion to those counts — a worker that saw ten million items
must contribute proportionally more than one that saw ten. Concatenating the reservoirs and
re-sampling uniformly is the standard bug: it treats every shard as equally weighty and
over-represents whichever shard was small. This is the sampling analogue of averaging averages
without weights.

**★ Sample proportional to a weight rather than uniformly. What changes?**
The uniform coin becomes a weight-derived key: give each item a key computed from its weight and a
uniform draw, and keep the `k` items with the largest keys in a min-heap. The reservoir is then a
priority queue rather than an array, and the memory is still `Θ(k)`. ⚠️ The exact key transform is
a literature result and is not derived on this page; what should be said in an interview is the
shape — keys plus a heap of size `k` — and the reason: with weights, "keep the largest keys" is what
replaces "replace with probability `k/i`".

**★ The stream never ends. Is the sample still meaningful?**
It is uniform over everything seen *so far*, at every moment, which is exactly what the invariant
says — and that is either precisely what you want or completely wrong for your purpose. For an
unbounded stream it usually means the sample calcifies: after a billion items, a new item enters
with probability `k/10^9`, so the reservoir is effectively frozen and stops reflecting recent data.
The fix is not a better reservoir but a different problem statement — windowed or time-decayed
sampling, restarting the reservoir per interval, which is what observability pipelines do.

{/* FOOTER */}
