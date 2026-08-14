---
title: "02.2 · How hashing works"
sidebar_label: "02 · How hashing works"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 — mechanism described at the standard textbook level; JavaScript-specific claims against MDN ([`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), [`Set`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set)) and the specification requirement MDN quotes. **This page implements a hash map to show the mechanism — the built-in `Map` is what you should use.** Documentation-validated; **no timings**.

**You will not ship this.** You will be asked to explain it, and — more usefully — you need the
mechanism to understand why hash lookup is O(1) *average* and O(n) *worst*, why load factor
matters, and why keys must be stable.

## The idea in three steps

1. **Hash** the key to an integer.
2. **Reduce** that integer to a bucket index — `hash % capacity`.
3. **Store** the key/value pair in that bucket, alongside anything already there.

Lookup repeats the same three steps and then compares keys within the bucket. That comparison is
why the key must be stored, not just its hash: **different keys can land in the same bucket, and
you have to tell them apart.**

## A working implementation

```js
class HashMap {
  #buckets;
  #size = 0;

  constructor(capacity = 8) {
    this.#buckets = Array.from({ length: capacity }, () => []);
  }

  #hash(key) {
    const str = typeof key === "string" ? key : String(key);
    let h = 2166136261;                       // FNV-1a, 32-bit
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) % this.#buckets.length;  // >>> 0 → unsigned
  }

  get(key) {
    const bucket = this.#buckets[this.#hash(key)];
    for (const entry of bucket) if (entry[0] === key) return entry[1];
    return undefined;
  }

  set(key, value) {
    const bucket = this.#buckets[this.#hash(key)];
    for (const entry of bucket) {
      if (entry[0] === key) { entry[1] = value; return this; }   // update in place
    }
    bucket.push([key, value]);
    this.#size++;
    if (this.#size / this.#buckets.length > 0.75) this.#resize();
    return this;
  }

  delete(key) {
    const bucket = this.#buckets[this.#hash(key)];
    const i = bucket.findIndex((e) => e[0] === key);
    if (i === -1) return false;
    bucket.splice(i, 1);
    this.#size--;
    return true;
  }

  #resize() {
    const old = this.#buckets;
    this.#buckets = Array.from({ length: old.length * 2 }, () => []);
    this.#size = 0;
    for (const bucket of old) for (const [k, v] of bucket) this.set(k, v);
  }

  get size() { return this.#size; }
}
```

Three things in that code are the whole interview:

- **`Math.imul`** does 32-bit integer multiplication. Plain `*` produces a float once the value
  exceeds 2⁵³ and the hash stops distributing. This is a JavaScript-specific detail that
  distinguishes someone who has written one from someone who has read about one.
- **`>>> 0`** converts to an unsigned 32-bit integer, because `^` and `imul` yield *signed*
  results and a negative index is not a bucket.
- **The resize rehashes everything.** Bucket assignment depends on `capacity`, so every key moves.
  That is O(n) — and it is why the growth is geometric, so it amortises to O(1) per insert.

## Collisions

Two keys hashing to the same bucket is not an error — it is the normal case, and it happens far
sooner than intuition suggests (the birthday problem: with 23 keys in 365 buckets there is
already a ~50% chance of a collision).

**Separate chaining** — what the code above does — keeps a list per bucket. Simple, degrades
gracefully, costs one indirection per entry.

**Open addressing** — on a collision, probe for the next free slot (linear, quadratic, or double
hashing). Better cache behaviour, no per-entry allocation, but deletion needs tombstones and
performance collapses as the table fills.

🔴 **This is where the O(1) *average* / O(n) *worst* distinction comes from.** If every key lands
in the same bucket, `get` degenerates to a linear scan of a list. A good hash function makes that
astronomically unlikely for ordinary data — and **not** unlikely for data chosen by an attacker,
which is the hash-collision denial-of-service attack, and why runtimes randomise their hash seeds
per process.

## Load factor

**Load factor = entries ÷ buckets.** It is the dial that trades memory for speed:

- **Too high** (say > 1.0) — chains get long, lookups approach linear.
- **Too low** — most buckets are empty; memory is wasted and cache locality suffers.
- **~0.75 is the common threshold** for growing, which is what the code uses.

Growing **doubles** the capacity, so the O(n) rehash happens with geometrically decreasing
frequency and the amortised insert stays O(1) — the same argument as `Array.prototype.push`
([01 · The cost table](../01-dynamic-arrays/01-the-real-cost-table.md)).

## What real engines do differently

The toy above is instructive and wrong in ways worth naming:

- **It only hashes strings well.** A real `Map` accepts any value as a key — MDN: keys *"can be
  any value (including functions, objects, or any primitive)"* — and **objects are hashed by
  identity**, not content. `String(key)` in the toy collapses every object to
  `"[object Object]"`, which is exactly the plain-object bug `Map` exists to avoid.
- **It uses `===`, not SameValueZero.** So `NaN` would never be found — real `Map` keys treat
  `NaN` as equal to itself.
- **It does not preserve insertion order.** A real `Map` guarantees iteration in insertion order,
  which typically means an entries list alongside the bucket index.
- **The spec does not mandate a hash table at all** — only *"access times that are sublinear on
  the number of elements"*, so a search tree would conform.

🔴 **Say this in an interview.** "Here is the mechanism; here are four ways the real thing
differs" is a much stronger answer than the implementation alone, and the object-identity point is
the one that connects back to why `Map` beats an object.

## Building a `Set` from a map

A hash set is a hash map whose values are ignored:

```js
class HashSet {
  #map = new HashMap();
  add(v)    { this.#map.set(v, true); return this; }
  has(v)    { return this.#map.get(v) !== undefined; }
  delete(v) { return this.#map.delete(v); }
  get size(){ return this.#map.size; }
}
```

⚠️ **`has` implemented as `get(v) !== undefined` is subtly wrong for a map** that can store
`undefined` as a value — it reports `false` for a key that exists. For a set the values are always
`true`, so it happens to work; for a map, `has` must be its own lookup. It is a small bug and a
frequent one.

## Gotchas

**Symptom:** A hand-written hash function distributes badly
**Cause:** Plain `*` overflows into floats.
**Fix:** `Math.imul` for 32-bit multiplication, `>>> 0` for an unsigned result.

**Symptom:** A negative bucket index
**Cause:** Bitwise operations produce signed 32-bit results.
**Fix:** `>>> 0` before the modulo.

**Symptom:** Lookups slow down as the table fills
**Cause:** Load factor too high — long chains.
**Fix:** Resize at ~0.75, doubling capacity.

**Symptom:** Entries disappear after a resize
**Cause:** The bucket index depends on capacity, so everything must be rehashed.
**Fix:** Re-insert every entry into the new table.

**Symptom:** Every object key collides
**Cause:** `String(key)` gives `"[object Object]"`.
**Fix:** Real `Map` hashes objects by identity — this is why you use it.

**Symptom:** `NaN` keys are never found
**Cause:** `===` rather than SameValueZero.
**Fix:** Special-case `NaN`, or use the built-in.

**Symptom:** `has` returns `false` for a key whose value is `undefined`
**Cause:** `has` implemented as `get(k) !== undefined`.
**Fix:** A separate existence check.

**Symptom:** Hash lookups degrade under attacker-chosen input
**Cause:** Deliberate collisions push every key into one bucket — O(n).
**Fix:** Randomised hash seeds (what runtimes do); do not key untrusted input into a structure
whose worst case you cannot afford.

## Interview questions

**★ Explain how a hash map works.**
Hash the key to an integer, reduce it to a bucket index modulo capacity, and store the key/value
pair in that bucket. Lookup repeats it and then compares keys within the bucket — which is why the
key itself is stored, not just its hash.

**★ Why is hash lookup O(1) average but O(n) worst?**
Average assumes keys distribute across buckets, so each chain is short. If every key lands in the
same bucket, lookup is a linear scan of that chain. It is astronomically unlikely for ordinary
data and entirely achievable for attacker-chosen data — which is why runtimes randomise hash
seeds.

**★ What is load factor and what does it control?**
Entries divided by buckets. Too high means long chains and lookups approaching linear; too low
wastes memory and cache locality. Around 0.75 is the usual growth threshold, and growth doubles
capacity so the O(n) rehash amortises to O(1) per insert.

**★ Why must a resize rehash everything?**
The bucket index is `hash % capacity`, so changing capacity changes where every key belongs. There
is no way to move only some of them.

**★ Chaining or open addressing?**
Chaining keeps a list per bucket — simple, degrades gracefully, one indirection per entry. Open
addressing probes for a free slot — better cache behaviour and no per-entry allocation, but
deletion needs tombstones and performance collapses as the table fills.

**★ Name three ways your toy implementation differs from a real `Map`.**
It hashes only strings well (a real `Map` hashes objects by **identity**, while `String(key)`
collapses them all to `"[object Object]"`); it uses `===` rather than SameValueZero, so `NaN` keys
are lost; and it does not preserve insertion order, which a real `Map` guarantees. Also, the spec
does not require a hash table at all — only sublinear access.

**Why is `Math.imul` necessary?**
Because JavaScript numbers are doubles: a plain `*` in a hash loop exceeds the exact-integer range
and the low bits stop being meaningful. `Math.imul` performs a true 32-bit integer multiply.

---

← [01 · Using the built-ins](./01-using-the-built-ins.md) · [Topic index](./README.md) ·
Next → [Phase index](../README.md)
