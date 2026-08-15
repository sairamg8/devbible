---
title: "09.1 · The `Map` trick, and the linked list underneath"
sidebar_label: "01 · The `Map` trick"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), [`Map.prototype.keys()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/keys), [`Map.prototype.delete()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/delete). Documentation-validated; **nothing was run**.

"Implement an LRU cache with O(1) `get` and `put`" is the standard answer to "a hash map plus
a doubly-linked list". **In JavaScript there is a shortcut**, and knowing both — plus why the
shortcut works — is the whole topic.

The shortcut is that a `Map` *"iterates its elements in insertion order"*, and re-inserting a
key moves it to the end. So "most recently used" is just "last", and "least recently used" is
`map.keys().next().value`.

## The twenty-line version

```js
class LRUCache {
  #map = new Map();

  constructor(capacity) {
    if (!Number.isInteger(capacity) || capacity <= 0) throw new RangeError("capacity must be > 0");
    this.capacity = capacity;
  }

  get(key) {
    if (!this.#map.has(key)) return undefined;
    const value = this.#map.get(key);
    this.#map.delete(key);            // ← delete + set = move to the most-recent end
    this.#map.set(key, value);
    return value;
  }

  set(key, value) {
    if (this.#map.has(key)) this.#map.delete(key);      // re-insert so it moves to the end
    this.#map.set(key, value);
    if (this.#map.size > this.capacity) {
      const oldest = this.#map.keys().next().value;      // the FIRST key = least recently used
      this.#map.delete(oldest);
    }
    return this;
  }

  has(key) { return this.#map.has(key); }                // ⚠️ does NOT count as a use
  delete(key) { return this.#map.delete(key); }
  get size() { return this.#map.size; }
  clear() { this.#map.clear(); }
}
```

## Why it is O(1)

| Operation | Cost |
|---|---|
| `map.has` / `get` / `set` / `delete` | O(1) average — a hash map |
| `map.keys().next()` | O(1) — an iterator yielding the first key, **not** a scan |

**`keys().next().value` is the line interviewers query**, because it *looks* like it walks the
map. It does not: it creates an iterator and pulls one value
([Phase 6 · 04 · The iteration protocols](../../phase-6-iteration-and-destructuring/04-iteration-protocols/README.md)).
Nothing here is a scan, so both `get` and `set` are O(1).

**`delete` then `set` is the move-to-end.** A `Map` keeps insertion order and re-setting an
*existing* key updates the value **in place**, keeping its original position — which is why
the delete is required and why omitting it is the number-one bug in this implementation. It
turns the cache into FIFO: entries evict by insertion age, ignoring use entirely.

## The three decisions the code makes

**`get` on a miss returns `undefined`** — which is indistinguishable from a cached `undefined`.
If a stored value may legitimately be `undefined`, return a sentinel or expose `has` alongside,
the same problem `Map.get` itself has.

**`has` does not count as a use.** Defensible either way; say which you chose. Node's and most
libraries' `has` is a pure predicate — if a peek should refresh recency, that is a different
method (`peek` for "do not touch", `get` for "this is a use").

**Eviction happens after insert, not before.** Inserting then trimming keeps the code to one
branch and handles the update-an-existing-key case correctly — with a pre-check, an update at
full capacity would evict something needlessly.

## The linked-list version, for when the question wants it

If the interviewer wants the language-agnostic answer, or wants to see pointer work, it is a
hash map from key → node plus a doubly-linked list ordered most-recent-first:

```js
class Node {
  constructor(key, value) { this.key = key; this.value = value; this.prev = this.next = null; }
}

class LRUCache {
  #map = new Map();
  #head = new Node(null, null);        // sentinel: head.next = most recent
  #tail = new Node(null, null);        // sentinel: tail.prev = least recent

  constructor(capacity) { this.capacity = capacity; this.#head.next = this.#tail; this.#tail.prev = this.#head; }

  #remove(node) { node.prev.next = node.next; node.next.prev = node.prev; }
  #addFirst(node) {
    node.next = this.#head.next; node.prev = this.#head;
    this.#head.next.prev = node; this.#head.next = node;
  }

  get(key) {
    const node = this.#map.get(key);
    if (!node) return undefined;
    this.#remove(node); this.#addFirst(node);          // move to front
    return node.value;
  }

  set(key, value) {
    const existing = this.#map.get(key);
    if (existing) { existing.value = value; this.#remove(existing); this.#addFirst(existing); return; }
    const node = new Node(key, value);
    this.#map.set(key, node); this.#addFirst(node);
    if (this.#map.size > this.capacity) {
      const lru = this.#tail.prev;
      this.#remove(lru); this.#map.delete(lru.key);     // ← delete by the node's KEY
    }
  }
}
```

**The two sentinel nodes are what make it short.** Without them every insert and remove needs
null checks for "is this the head/tail"; with them, `#remove` and `#addFirst` are two lines
each and always correct.

**The classic bug is the eviction line.** The node must carry its own `key`, or you cannot
remove it from the map when you evict it from the list — you would be holding a value with no
way back to its key.

## Which to write

**Write the `Map` version.** It is shorter, harder to get wrong, and demonstrates you know how
`Map` behaves. Then say: *"the language-agnostic answer is a hash map plus a doubly-linked
list — `Map`'s insertion order gives me the list for free."* If they want the list, write it.

The one real reason to prefer the explicit list: you need to move nodes for reasons other than
access — segmented LRU, a pinned region, an LFU hybrid — which `Map` ordering cannot express.

## Gotchas

**Symptom:** The cache evicted the wrong entry — the oldest by insertion, not by use
**Cause:** No `delete` before `set` on a hit, so re-setting an existing key kept its original
position.
**Fix:** `delete` then `set` on every `get` **and** on every update.

**Symptom:** `get` refreshed recency for keys that were only being checked
**Cause:** `has` implemented in terms of `get`.
**Fix:** Keep `has` a pure predicate on the underlying `Map`; add `peek` if a non-touching read
is needed.

**Symptom:** A cached `undefined` looked like a miss
**Cause:** `get` returns `undefined` for both.
**Fix:** `has` first, or store `{ value }` wrappers, or use a sentinel.

**Symptom:** The size grew past the capacity
**Cause:** Eviction checked `size >= capacity` before inserting, or was skipped on the update
path.
**Fix:** Insert, then trim while `size > capacity`.

**Symptom:** The linked-list version leaked entries in the map
**Cause:** Evicting the tail node without deleting its key from the map.
**Fix:** Store the key on the node and delete by it.

**Symptom:** Object keys never hit
**Cause:** `Map` keys compare by SameValueZero — two structurally equal objects are different
keys.
**Fix:** Derive a string key, or key on an identity you control
([09.2](./02-making-it-real.md)).

## Interview questions

**★ Implement an LRU cache with O(1) `get` and `put`.**
A `Map`: on `get`, delete and re-set the key so it moves to the most-recent end; on `set`,
delete any existing entry, set, then evict `keys().next().value` if over capacity. Every
operation is O(1) — `keys().next()` pulls one value from an iterator, it does not scan.

**★ Why does `Map` make this easy?**
It iterates in insertion order and re-inserting moves a key to the end, so the map *is* the
recency list: first key = least recently used, last = most recently used.

**★ Why must you `delete` before `set` on an existing key?**
Because `set` on an existing key updates the value **in place** and keeps its position. Without
the delete the cache degrades to FIFO — it evicts by insertion age and ignores use.

**★ Is `keys().next().value` O(1)?**
Yes. It creates an iterator and takes the first value; it does not traverse the map.

**How would you write it without relying on `Map` ordering?**
A hash map from key → node plus a doubly-linked list with head/tail sentinels: `get` moves the
node to the front, `set` inserts at the front, eviction removes `tail.prev` and deletes that
node's key from the map. The node must store its key for exactly that last step.

**Should `has` count as a use?**
That is a design decision to state. Usually not — `has` is a predicate, `get` is a use. If a
caller needs a non-refreshing read, give it `peek`.

---

[Topic index](./README.md) · Next → [Making it real](./02-making-it-real.md)
