---
name: research-dsa-phase1
description: Banked primary-source quotes for docs/dsa/pages/phase-1-complexity/ (11 pages) — MDN Map/Set sublinear-access sentence, Set.has vs Array.includes, includes SameValueZero, shift semantics; JDK 25 javadoc for LinkedList, List.sort (stable TimSort, the n² log n note), StringBuilder capacity, HashMap load factor and rehash. Reuse research_dsa_phase0.md for sort, MAX_SAFE_INTEGER, too-much-recursion, PriorityQueue, TreeMap, Arrays.sort, ArrayDeque, HashMap basics, ArrayList. Fetched once on 2026-09-07 by session cac93078. Do not re-derive.
metadata:
  type: reference
---

# Research bank — DSA phase 1, complexity (fetched 2026-09-07, session `cac93078`)

**Do not re-fetch.** Big-O definitions, the master theorem, amortised analysis, the comparison-sort
lower bound and union-find bounds are **textbook** (CLRS: ch. 3 growth of functions, ch. 4
recurrences, ch. 8 sorting lower bound, ch. 16/17 amortised analysis, ch. 19 disjoint sets in the
4th ed.) — cite the book by chapter subject, quote nothing, and say "textbook" on the Verified
line. Everything runtime-specific below is verbatim with its URL. The DSA phase-0 bank
([research_dsa_phase0.md](research_dsa_phase0.md)) already holds `Array.prototype.sort` (stable
since ES2019, default string order, comparator contract, *"time and space complexity of the sort
cannot be guaranteed"*), `MAX_SAFE_INTEGER`, the *too much recursion* error strings (⚠️ no stack
depth number — never state one), `PriorityQueue` (O(log n) offer/poll, linear remove(Object)/contains),
`TreeMap` (guaranteed log(n)), `Arrays.sort` (dual-pivot quicksort for primitives; stable for objects),
`ArrayDeque` (amortised constant, faster than Stack/LinkedList), `HashMap` basics (constant-time get/put
assuming dispersion; iteration ∝ capacity + size), `ArrayList` (constant get/set/size; amortised
constant add; *"All of the other operations run in linear time (roughly speaking)"*).

## MDN — `Map`
URL: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map
- *"The specification requires maps to be implemented "that, on average, provide access times that are sublinear on the number of elements in the collection". Therefore, it could be represented internally as a hash table (with O(1) lookup), a search tree (with O(log(N)) lookup), or any other data structure, as long as the complexity is better than O(N)."*
- Map vs Object table: Map *"Performs better in scenarios involving frequent additions and removals of key-value pairs."* · Object *"Not optimized for frequent additions and removals of key-value pairs."*
- *"Value equality is based on the SameValueZero algorithm."* — *"This means `NaN` is considered the same as `NaN` (even though `NaN !== NaN`) and all other values are considered equal according to the semantics of the `===` operator."*
- ⚠️ The spec guarantees **sublinear**, not O(1). Say "hash-table in every major engine, sublinear by spec".

## MDN — `Set`
URL: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set
- Same sublinear sentence as Map (*"The specification requires sets to be implemented "that, on average, provide access times that are sublinear on the number of elements in the collection"…"*).
- *"The `has` method checks if a value is in the set, using an approach that is, on average, quicker than testing most of the elements that have previously been added to the set. In particular, it is, on average, faster than the `Array.prototype.includes` method when an array has a `length` equal to a set's `size`."*

## MDN — `Array.prototype.includes()`
URL: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/includes
- *"The `includes()` method compares `searchElement` to elements of the array using the SameValueZero algorithm. This algorithm works like strict equality `===` (where `-0` and `+0` are considered equal), with the exception that `NaN` is considered equal to itself."*
- *"When used on sparse arrays, the `includes()` method iterates empty slots as if they have the value `undefined`."*
- ⚠️ MDN states **no complexity** for `includes`/`indexOf`. Linear scan is the mechanism (it compares element by element); say so as mechanism, and use the Set sentence above as the primary-source contrast.

## MDN — `Array.prototype.shift()`
URL: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/shift
- *"The `shift()` method shifts all values to the left by 1 and decrements the length by 1, resulting in the first element being removed."*
- ⚠️ No performance sentence. The O(n) claim follows from "shifts all values to the left by 1" — state it as the mechanism the doc describes, not as a quoted bound. (Engines may optimise small arrays; do not claim either way.)

## JDK 25 — `java.util.LinkedList`
URL: https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/LinkedList.html
- *"Doubly-linked list implementation of the `List` and `Deque` interfaces. Implements all optional list operations, and permits all elements (including `null`)."*
- *"Operations that index into the list will traverse the list from the beginning or the end, whichever is closer to the specified index."* — i.e. `get(i)` is O(n); the javadoc does not say "O(n)" in those words.
- *"Note that this implementation is not synchronized."*

## JDK 25 — `java.util.List.sort(Comparator)`
URL: https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/List.html#sort(java.util.Comparator)
- *"The sort is stable: this method must not reorder equal elements."*
- Implementation requirements: *"The default implementation obtains an array containing all elements in this list, sorts the array, and iterates over this list resetting each element from the corresponding position in the array. (This avoids the n² log(n) performance that would result from attempting to sort a linked list in place.)"*
- Implementation note: *"This implementation is a stable, adaptive, iterative mergesort that requires far fewer than n lg(n) comparisons when the input array is partially sorted, while offering the performance of a traditional mergesort when the input array is randomly ordered. If the input array is nearly sorted, the implementation requires approximately n comparisons. Temporary storage requirements vary from a small constant for nearly sorted input arrays to n/2 object references for randomly ordered input arrays."*
- *"The implementation was adapted from Tim Peters's list sort for Python (TimSort)."*

## JDK 25 — `java.lang.StringBuilder`
URL: https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/StringBuilder.html
- *"A mutable sequence of characters."* · *"Every string builder has a capacity. As long as the length of the character sequence contained in the string builder does not exceed the capacity, it is not necessary to allocate a new internal buffer. If the internal buffer overflows, it is automatically made larger."*
- *"Where possible, it is recommended that this class be used in preference to `StringBuffer` as it will be faster under most implementations."*
- ⚠️ `String` immutability: the `String` javadoc's first lines say strings are constant and cannot be changed — **not fetched this session**; cite the class by name, quote nothing. The quadratic `s += x` loop is mechanism (each `+=` copies), not a quoted bound.

## JDK 25 — `java.util.HashMap` (load factor; adds to the phase-0 bank)
URL: https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/HashMap.html
- *"As a general rule, the default load factor (.75) offers a good tradeoff between time and space costs. Higher values decrease the space overhead but increase the lookup cost (reflected in most of the operations of the `HashMap` class, including `get` and `put`)."*
- *"When the number of entries in the hash table exceeds the product of the load factor and the current capacity, the hash table is rehashed (that is, internal data structures are rebuilt) so that the hash table has approximately twice the number of buckets."*
- ⚠️ The **API** page says nothing about treeified bins (that is in the source's implementation notes, not the javadoc). Say "the OpenJDK implementation converts a long bucket chain to a tree; the API documentation does not promise it" — or leave it out.

## ECMAScript — tail position calls
- First fetch of https://tc39.es/ecma262/#sec-tail-position-calls returned the table of contents only. See the addendum below for the retry result. If absent: state that ES2015 specifies proper tail calls and that V8 (Node) does not implement them, attributing the second half to the MDN *too much recursion* page's behaviour (Node throws `RangeError: Maximum call stack size exceeded` on deep recursion) rather than to any V8 document. Never claim a V8 blog post that was not fetched.

## Not fetched / textbook
- CLRS (Cormen, Leiserson, Rivest, Stein), 4th ed. — Big-O/Θ/Ω definitions, master theorem, amortised (aggregate, accounting, potential), decision-tree lower bound Ω(n log n) for comparison sorts, disjoint-set α(n). Cite by chapter subject.
- Benchmarking: no primary source; `performance.now()` (MDN) and JMH are named as tools only.

## Addendum 2026-09-07 — space page (session `cac93078`)
**`StackOverflowError`** — https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/StackOverflowError.html
- *"Thrown when a stack overflow occurs because an application recurses too deeply."* (extends `VirtualMachineError`)
**`Thread(ThreadGroup, Runnable, String, long stackSize)`** — https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Thread.html
- *"The stack size is the approximate number of bytes of address space that the virtual machine is to allocate for this thread's stack. The effect of the `stackSize` parameter, if any, is highly platform dependent."*
- *"On some platforms, specifying a higher value for the `stackSize` parameter may allow a thread to achieve greater recursion depth before throwing a `StackOverflowError`."*
- *"The virtual machine is free to treat the `stackSize` parameter as a suggestion."*
**ECMA-262 tail position calls** — second fetch (multipage URL) also returned only the TOC. ⚠️ **Not verified this session.** Write: "ES2015 specifies proper tail calls; V8 does not implement them, so Node's deep recursion throws `RangeError: Maximum call stack size exceeded` (MDN, *too much recursion*)" — attribute the V8 claim as widely reported engine behaviour, not to a fetched document.
