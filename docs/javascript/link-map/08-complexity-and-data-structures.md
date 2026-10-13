---
title: "Link map · JavaScript · Part 8 (phases 13–14)"
sidebar_label: "08 · complexity and data structures"
sidebar_position: 8
---

# Link map · JavaScript · Part 8 (phases 13–14)

Covers every topic row of `docs/javascript/syllabus/04-dsa-and-machine-coding.md` in phase 13 (T13-01 to T13-10, complexity and JavaScript's real costs) and phase 14 (T14-01 to T14-17, core data structures). That is 27 rows. Written pages exist for T13-01 to T13-03 and T14-01 to T14-05 (✅, eight rows, all Master tier); the other 19 rows are parked in the corpus (🔲). A ✅ block names the first chunk file of the topic.
*read* = the passage that supports the claim came back from the fetch; *headings only* = the page loaded and its scope was checked, not the passage. Third-party links carry a date only where the page shows one. No `#anchors` are given.

🔴 **Version note.** Our syllabus targets **Node 24 LTS** (`docs/javascript/README.md`). MDN and Wikipedia track current engines. The V8-internals pieces are **older than Node 24** and describe one V8 version each: the V8 blog post on elements kinds is dated 2017-09-12 (it carries a 2025-02-28 update note), Andrei Pechkurov's array article tested V8 8.9 and his Map article V8 8.4, and Gleb Bahmutov's stack-size post measured Node 0.11.10 in 2014. Treat every number from them (growth formula, load factor, stack depth) as a lead to re-measure on Node 24, not a current fact.

🔴 **What is not confirmed here.** No page fetched for this file states that V8 lacks proper tail calls; the WebKit post only says its own engine implements them and that "most browsers" without them overflow on a 100,000-element list. The V8 position came from secondary search results only, so T13-08 must be measured on Node 24 before our page says it. Likewise the claim that `+=` on strings is fast in V8 (ropes) and that array spread in a loop is O(n squared) (the Phase 13 gate) was **not** supported by a page I could read; it needs a measurement, not a citation.

---

## Phase 13 — Complexity and JavaScript's real costs

### T13-01 · Big-O notation — Master · ✅ written `docs/javascript/pages/phase-13-complexity/01-big-o/01-what-the-notation-says.md`
- **Read this:** [Big O Notation: Time and Space Complexity](https://www.interviewcake.com/article/javascript/big-o-notation-time-and-space-complexity) · Interview Cake · constant, linear and quadratic work with JavaScript examples; constants and lower-order terms dropped; Big O usually means the worst case; space counted as extra memory (*read*) · covers our angle: **partial** — no step-by-step reading of a bound off a loop nest · fetched 2026-10-13
- **Also good:** [Big O notation](https://en.wikipedia.org/wiki/Big_O_notation) · Wikipedia · the formal side: "any constants can be omitted" and the multiplication-by-a-constant rule (*read*, first 100000 characters) · fetched 2026-10-13
- **Beyond the docs:** [A beginner's guide to Big O notation](https://robbell.io/2009/06/a-beginners-guide-to-big-o-notation/) · Rob Bell, June 2009 · one code example per class (O(1), O(N), O(N squared) from nested loops, O(2 to the N) from recursive Fibonacci); says Big O describes the worst case; C# code, and it does not cover dropping constants; the old rob-bell.net address redirects here · fetched 2026-10-13 (*read*)
- **Our delta:** reading a bound straight off a loop nest, and best versus average versus worst. There is no MDN or ECMAScript page for Big-O; the notation is not part of the language.

### T13-02 · The complexity classes you actually meet — Master · ✅ written `docs/javascript/pages/phase-13-complexity/02-complexity-classes/01-constant-to-linearithmic.md`
- **Read this:** [Data Structures and Algorithms in JavaScript, Big O examples](https://github.com/amejiarosario/dsa.js/blob/master/book/content/part01/big-o-examples.asc) · Adrian Mejia (dsa.js, 7.8k stars) · one named example per class from O(1) to O(n!): array-is-empty, recursive binary search, merge sort ("halves about log n times, merging costs about n each level"), all subsets for O(2 to the n) ("every time the input grows by one, the number of operations doubles"), all permutations (*read*) · covers our angle: **partial** — the code sits in linked files, not on the page; only 3Sum is inline · fetched 2026-10-13
- **Also good:** [Know Thy Complexities!](https://www.bigocheatsheet.com/) · Eric Rowell · the growth chart from O(1) to O(n!) plus operation tables for arrays, hash tables, trees and sorts; a reference, not an explanation (*read*) · fetched 2026-10-13
- **Beyond the docs:** [A beginner's guide to Big O notation](https://robbell.io/2009/06/a-beginners-guide-to-big-o-notation/) · Rob Bell, June 2009 · the O(N squared) and O(2 to the N) cases with a duplicate check and recursive Fibonacci; no O(log n) or O(n log n) (*read*) · fetched 2026-10-13
- **Our delta:** all seven classes in JavaScript with the O(n log n) and O(2 to the n) cases run, not asserted.

### T13-03 · Choosing a structure from the operations you need — Master · ✅ written `docs/javascript/pages/phase-13-complexity/03-choosing-a-structure/01-the-decision-table.md`
- **Read this:** [Keyed collections](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Keyed_collections) · MDN · "use maps over objects when keys are unknown until run time" and objects when the shape is known; `Set` removes by value and tracks uniqueness; deleting array elements by value with `splice(indexOf)` is "very slow" (*read*) · covers our angle: **partial** — no table keyed on ordering and iteration, and no complexity figures · fetched 2026-10-13
- **Also good:** [Know Thy Complexities!](https://www.bigocheatsheet.com/) · Eric Rowell · "Common Data Structure Operations" table: access, search, insertion, deletion, average and worst, for arrays, stacks, queues, linked lists, hash tables and trees (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Should you use JavaScript Maps and Sets?](https://dev.to/mostlyfocusedmike/should-you-use-javascript-maps-and-sets-6o7) · Mike Cronin, 2021-07-19 · times Map and Set against object and array: `set.has` is O(1) against O(N) for `includes`, but `set.add` is slower than `push`; his advice is to benchmark your own app; limited tests, not a spec (*read*) · fetched 2026-10-13
- **Our delta:** one decision table keyed on lookup, insert, delete, ordering and iteration.

### T13-04 · Space complexity and the call stack — Understand · 🔲 not written
- **Read this:** [The Call Stack](https://www.interviewcake.com/concept/javascript/call-stack) · Interview Cake · each call is a stack frame; recursion costs space even when no data structure is built; the recursive version of a product loop grows with n while the loop is constant space (*read*; the dice example is in Python, the space example in JavaScript) · covers our angle: **partial** — no number for the stack limit · fetched 2026-10-13
- **Also good:** [Call stack](https://developer.mozilla.org/en-US/docs/Glossary/Call_stack) · MDN glossary · the definition, and "if the stack takes up more space than it was assigned, a stack overflow error is thrown"; no recursion example (*read*) · fetched 2026-10-13
- **Beyond the docs:** [JavaScript stack size](https://glebbahmutov.com/blog/javascript-stack-size/) · Gleb Bahmutov, 2014-05-16 · measures calls before `RangeError` (20,961 with no locals, 17,967 with one local) and derives about 48 bytes a frame and a stack under 1 MB; **Node 0.11.10 only**, so the figures are history, the method is reusable (*read*) · fetched 2026-10-13
- **Our delta:** the limit measured on Node 24 and in a browser, and recursion depth stated as space.

### T13-05 · What a JavaScript array really is — Understand · 🔲 not written
- **Read this:** [Elements kinds in V8](https://v8.dev/blog/elements-kinds) · V8 blog, 2017-09-12 · packed versus holey kinds, transitions go from specific to general only, "once a hole is created … it's marked as holey forever", and the advice to build arrays with literals or `push` (*read*) · covers our angle: **partial** — says nothing about dictionary mode or `delete` · fetched 2026-10-13
- **Also good:** [delete operator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/delete) · MDN · deleting an element leaves `length` unchanged and creates a sparse array with an empty slot; use `splice` to remove (*read*) · fetched 2026-10-13
- **Beyond the docs:** [V8 Deep Dives: Understanding Array Internals](https://dev.to/puzpuzpuz/v8-deep-dives-understanding-array-internals-3jdf) · Andrei Pechkurov, 2021-03-16 · benchmarks packed against holey (about 23 percent slower to iterate) and says V8 switches to dictionary elements past a large size threshold, with iteration orders of magnitude slower; **V8 8.9**, thresholds may have changed; the itnext.io copy returned 403, this DEV copy is the one fetched (*read*) · fetched 2026-10-13
- **Our delta:** the point an array degrades, shown with `%DebugPrint` or equivalent on Node 24, and why `delete arr[i]` is a mistake.

### T13-06 · Object versus Map performance — Understand · 🔲 not written
- **Read this:** [Map: Objects vs. Maps](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map) · MDN · a table: object keys are strings or symbols, Map keys any value; Map "performs better in scenarios involving frequent additions and removals" (*read*) · covers our angle: **partial** — states the claim, shows no measurement · fetched 2026-10-13
- **Also good:** [Fast properties in V8](https://v8.dev/blog/fast-properties) · V8 blog, 2017-08-30 · fast versus dictionary properties; heavy add and delete churn pushes an object to a slow dictionary (*read*) · fetched 2026-10-13
- **Beyond the docs:** [V8 Deep Dives: Understanding Map Internals](https://dev.to/puzpuzpuz/v8-deep-dives-understanding-map-internals-fc6) · Andrei Pechkurov, 2020-10-06 · how V8 builds a Map: bucket array plus an insertion-ordered data array, load factor fixed at 2, capacity a power of two, rehash O(N) inside `set` or `delete`; **V8 8.4** (*read*) · fetched 2026-10-13
- **Our delta:** key coercion and insertion order shown side by side, and a measured crossover instead of "Map is faster".

### T13-07 · Amortised analysis — Understand · 🔲 not written
- **Read this:** [Amortized analysis](https://en.wikipedia.org/wiki/Amortized_analysis) · Wikipedia · names the aggregate, accounting and potential methods, and its dynamic-array section concludes the average cost per push is O(1) (*read*) · covers our angle: **partial** — no JavaScript, no V8 specifics · fetched 2026-10-13
- **Also good:** [CS 3110 Recitation 21](https://www.cs.cornell.edu/courses/cs3110/2009sp/recitations/rec21.html) · Cornell · the potential method on a doubling array: potential 2(n minus m/2), amortised cost 3 both when there is room and when the array resizes; the aggregate and banker's methods for the array are in the previous lecture, not here (*read*) · fetched 2026-10-13
- **Beyond the docs:** [V8 Deep Dives: Understanding Array Internals](https://dev.to/puzpuzpuz/v8-deep-dives-understanding-array-internals-3jdf) · Andrei Pechkurov, 2021-03-16 · the real growth rule in V8: new capacity is old plus 50 percent plus 16, which is what makes `push` constant amortised; **V8 8.9** (*read*) · fetched 2026-10-13
- **Our delta:** counting the actual resizes for n pushes in Node 24. Wikipedia's Dynamic array page (growth factor a gives about a/(a minus 1) per insert) is a second source for the doubling argument.

### T13-08 · Recursion versus iteration in V8 — Understand · 🔲 not written
- **Read this:** [InternalError: too much recursion](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Too_much_recursion) · MDN · a missing base case overflows the stack; Firefox throws `InternalError`, Chrome and Safari `RangeError: Maximum call stack size exceeded` (*read*) · covers our angle: **partial** — no tail calls, no conversion advice · fetched 2026-10-13
- **Also good:** [ECMAScript 6 Proper Tail Calls in WebKit](https://webkit.org/blog/6240/ecmascript-6-proper-tail-calls-in-webkit/) · Michael Saboff, 2016-05-23 · what a proper tail call is and the conditions (strict mode, plain function, returns the call's result directly); WebKit implements it, and the post says it does not name other engines (*read*) · fetched 2026-10-13
- **Beyond the docs:** [How to convert recursion to iteration](https://blog.theincredibleholk.org/blog/2018/03/16/how-to-convert-recursion-to-iteration/) · Eric Holk, 2018-03-16 · a mechanical recipe in JavaScript: continuation-passing style, return thunks, drive them from a loop (*read*) · covers our angle: **partial** — a trampoline, not the explicit-stack rewrite our row names · fetched 2026-10-13
- **Our delta:** the explicit-stack rewrite, plus a Node 24 measurement that settles whether V8 does tail calls. Not confirmed from any page fetched here.

### T13-09 · Measuring honestly — Understand · 🔲 not written
- **Read this:** [Performance.now()](https://developer.mozilla.org/en-US/docs/Web/API/Performance/now) · MDN · relative to a monotonic `timeOrigin`, unlike `Date.now()`; coarsened to 5 microseconds when cross-origin isolated and 100 microseconds otherwise (*read*) · covers our angle: **partial** — the clock, not warm-up or JIT effects · fetched 2026-10-13
- **Also good:** [Bulletproof JavaScript benchmarks](https://mathiasbynens.be/notes/javascript-benchmarking) · Mathias Bynens and John-David Dalton, 2010-12-23 · fixed iteration counts, "best of 3", timer resolution and developer tools that disable the JIT; wants a statistically significant run; written for 2010 browsers and Benchmark.js (*read*) · fetched 2026-10-13
- **Beyond the docs:** [microbenchmarks fairy tale](https://mrale.ph/blog/2012/12/15/microbenchmarks-fairy-tale.html) · mraleph (Vyacheslav Egorov, a V8 engineer; the page itself shows only the handle), 2012-12-15 · loop-invariant code motion hoists `str.length` out of the timed loop, dead code elimination deletes unused results, warm-up is needed; about Chrome of that year (*read*) · fetched 2026-10-13
- **Our delta:** a harness that warms up, uses the result and reports spread, run on Node 24.

### T13-10 · Stating a bound in an interview — Know · 🔲 not written
- **Read this:** [Big O Notation: Time and Space Complexity](https://www.interviewcake.com/article/javascript/big-o-notation-time-and-space-complexity) · Interview Cake · worst case by default, space as extra memory, "Big O ignores constants, but sometimes the constants matter" (*read*) · covers our angle: **partial** — vocabulary, not how to justify a bound or answer "can you do better?" · fetched 2026-10-13
- **Our delta:** the justify-then-improve script. Searched twice and fetched the best hit; the pages found (Educative lessons, techinterview.org) state "say the bound before you are asked" but are course sales or SEO pages with no real argument, so none is linked.

---

## Phase 14 — Core data structures in JavaScript

### T14-01 · Dynamic arrays — Master · ✅ written `docs/javascript/pages/phase-14-data-structures/01-dynamic-arrays/01-the-real-cost-table.md`
- **Read this:** [Dynamic array](https://en.wikipedia.org/wiki/Dynamic_array) · Wikipedia · geometric expansion makes append amortised constant; index access Θ(1); inserting at the start Θ(n) (*read*) · covers our angle: **partial** — language-neutral; says nothing about why `shift` is slow in V8 · fetched 2026-10-13
- **Also good:** [Array.prototype.shift](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/shift) · MDN · "shifts all values to the left by 1"; no complexity stated, the cost follows from that description (*read*) · fetched 2026-10-13
- **Beyond the docs:** [V8 Deep Dives: Understanding Array Internals](https://dev.to/puzpuzpuz/v8-deep-dives-understanding-array-internals-3jdf) · Andrei Pechkurov, 2021-03-16 · growth rule, packed versus holey, dictionary mode, with benchmarks; does not cover `unshift`; **V8 8.9** (*read*) · fetched 2026-10-13
- **Our delta:** the real cost of each method in one table, and why `shift` and `unshift` disqualify an array as a queue.

### T14-02 · Hash maps and hash sets — Master · ✅ written `docs/javascript/pages/phase-14-data-structures/02-hash-maps-and-sets/01-using-the-built-ins.md`
- **Read this:** [Keyed collections](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Keyed_collections) · MDN · Map keys any value, object keys strings or symbols; Map iterates in insertion order; an object has a prototype and default keys; Set removes by value (*read*) · covers our angle: **partial** — usage, no hashing, collisions or load factor · fetched 2026-10-13
- **Also good:** [Hash table](https://en.wikipedia.org/wiki/Hash_table) · Wikipedia · load factor (number of pairs over buckets); separate chaining against open addressing; open addressing wants a maximum of about 0.6 to 0.75; rehash on resize (*read*, first 100000 characters) · fetched 2026-10-13
- **Beyond the docs:** [V8 Deep Dives: Understanding Map Internals](https://dev.to/puzpuzpuz/v8-deep-dives-understanding-map-internals-fc6) · Andrei Pechkurov, 2020-10-06 · a real engine's hash table: buckets with chains, load factor 2, power-of-two capacity, deletion leaves a hole until rehash; **V8 8.4** (*read*) · fetched 2026-10-13
- **Our delta:** hashing and collisions in principle, with the built-ins first and a toy table to show the mechanism.

### T14-03 · Frequency maps and grouping — Master · ✅ written `docs/javascript/pages/phase-14-data-structures/03-frequency-and-grouping/01-the-frequency-map.md`
- **Read this:** [Object.groupBy()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/groupBy) · MDN · returns a null-prototype object of arrays, one per string key; use `Map.groupBy()` when keys are arbitrary values (*read*) · covers our angle: **partial** — grouping only, not the counting map · fetched 2026-10-13
- **Beyond the docs:** [Array Grouping in JavaScript: Object.groupBy()](https://dmitripavlutin.com/javascript-array-group/) · Dmitri Pavlutin, updated 2023-01-28 · `reduce` grouping against `Object.groupBy` and `Map.groupBy`, written while the proposal was at stage 3 (so the support notes are dated); never counts items (*read*) · fetched 2026-10-13
- **Our delta:** the frequency map itself, the most useful pattern in interview problems. One search turned up grouping tutorials only; no page explains the counting pattern in JavaScript.

### T14-04 · Stack — Master · ✅ written `docs/javascript/pages/phase-14-data-structures/04-stack/01-the-structure.md`
- **Read this:** [Stack (abstract data type)](https://en.wikipedia.org/wiki/Stack_(abstract_data_type)) · Wikipedia · LIFO with push, pop and peek; uses named: expression evaluation, backtracking (depth-first search), the call stack (*read*) · covers our angle: **partial** — no array-backed JavaScript, no bracket matching or monotonic stacks · fetched 2026-10-13
- **Beyond the docs:** [Monotonic stack](https://labuladong.gitbook.io/algo-en/data-structures/monotonic-stack) · labuladong · next greater element from a line-of-people picture, O(n) because each element is pushed and popped once; extended to LeetCode 496, 739 and the circular 503; **Java code** (*read*) · fetched 2026-10-13
- **Our delta:** undo and expression evaluation in JavaScript, and monotonic stacks translated from Java.

### T14-05 · Queue and deque — Master · ✅ written `docs/javascript/pages/phase-14-data-structures/05-queue-and-deque/01-making-dequeue-o1.md`
- **Read this:** [Circular buffer](https://en.wikipedia.org/wiki/Circular_buffer) · Wikipedia · a fixed buffer used as if joined end to end; indexes wrap by modulo capacity; equal indexes are ambiguous between full and empty, fixed by keeping a count or leaving one slot free (*read*) · covers our angle: **partial** — C++ sample, no two-stack or linked-list queue · fetched 2026-10-13
- **Also good:** [Array.prototype.shift](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/shift) · MDN · why `shift` is a poor dequeue: every remaining element moves (*read*) · fetched 2026-10-13
- **Beyond the docs:** [double-ended-queue (deque)](https://github.com/petkaantonov/deque) · Petka Antonov · a circular-buffer deque with O(1) at both ends; its README says arrays take linear time for `shift`, that V8 has a shortcut for small arrays yet the deque is still about 4x faster, and shows 19.23 ops/sec for an array against about 14.4 million for the deque at 2 million items. Maintainer's own benchmark, run on an old V8; 617 stars, no recent-commit date on the page (*read*) · fetched 2026-10-13
- **Our delta:** the O(1) requirement made explicit, with the two-stack, ring-buffer and linked-list versions compared on Node 24.

### T14-06 · Binary trees — Understand · 🔲 not written
- **Read this:** [Tree traversal](https://en.wikipedia.org/wiki/Tree_traversal) · Wikipedia · pre-order, in-order, post-order, with pseudocode, and level-order under breadth-first search; iterative versions with an explicit stack in the depth-first section (*read*) · covers our angle: **partial** — no JavaScript, no depth versus height · fetched 2026-10-13
- **Also good:** [Binary Search Tree and AVL Tree (VisuAlgo)](https://visualgo.net/en/bst) · Steven Halim and Felix Halim, NUS · animated in-order, pre-order and post-order walks on a tree you can build or skew (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Iterative Binary Tree Traversals using Stack](https://www.enjoyalgorithms.com/blog/iterative-binary-tree-traversals-using-stack/) · Enjoy Algorithms · builds preorder, inorder and postorder with an explicit stack, postorder in three variants (two stacks, one stack with a previous-node marker, hash set); pseudocode, not JavaScript (*read*) · fetched 2026-10-13
- **Our delta:** all four traversals recursive and iterative in JavaScript, and depth versus height.

### T14-07 · Singly linked list — Understand · 🔲 not written
- **Read this:** [Linked List (javascript-algorithms)](https://github.com/trekhleb/javascript-algorithms/tree/master/src/data-structures/linked-list) · Oleksii Trekhleb (196.7k stars) · pseudocode for add, prepend, contains, remove and traversal, with an Access O(n), Insertion O(1) table; the JavaScript files are in the folder but their contents were not read (*read* README only) · covers our angle: **partial** — no reverse, no middle, no cycle detection · fetched 2026-10-13
- **Also good:** [Cycle detection](https://en.wikipedia.org/wiki/Cycle_detection) · Wikipedia · Floyd's tortoise and hare: one pointer one step, one two steps, O(1) space; the linked-list case appears only under applications (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Leetcode: Reverse Linked List (with JavaScript)](https://dev.to/urfan/leetcode-reverse-linked-list-with-javascript-1nn8) · Urfan Guliyev, 2020-08-10 · iterative with `prev`, `curr` and a saved next pointer, then recursive with `head.next.next = head`; JavaScript (*read*) · fetched 2026-10-13
- **Our delta:** find-the-middle and Floyd on a list, in one place.

### T14-08 · Doubly linked list and the LRU cache — Understand · 🔲 not written
- **Read this:** [LRU Cache (javascript-algorithms)](https://github.com/trekhleb/javascript-algorithms/tree/master/src/data-structures/lru-cache) · Oleksii Trekhleb · two JavaScript versions, a hash map plus doubly linked list and a `Map` that re-inserts to move a key to the end; O(1) average get and set (*read* README) · covers our angle: **partial** — explains the design briefly, no pointer-by-pointer walkthrough · fetched 2026-10-13
- **Also good:** [LRU Cache using JavaScript](https://www.geeksforgeeks.org/lru-cache-using-javascript) · GeeksforGeeks · `Map` plus doubly linked list with dummy head and tail nodes, evicts `tail.prev`; the explanation is brief (*read*) · fetched 2026-10-13
- **Our delta:** the sentinel-node pointer moves drawn step by step, and why the `Map`-only version is shorter. The LeetCode statement returned 403, so the problem text was not read.

### T14-09 · Binary search trees — Understand · 🔲 not written
- **Read this:** [Binary Search Tree and AVL Tree (VisuAlgo)](https://visualgo.net/en/bst) · Steven Halim and Felix Halim, NUS · animated search, insert, successor and remove (leaf, one child, two children); a skewed tree option shows the worst case and the page says sorted inserts push height to O(N) (*read*) · covers our angle: **partial** — no JavaScript · fetched 2026-10-13
- **Also good:** [Binary search tree](https://en.wikipedia.org/wiki/Binary_search_tree) · Wikipedia · the deletion cases, in-order traversal giving non-decreasing keys, and a degraded tree having "the same worst-case complexity as a linked list" (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Binary Search Tree (javascript-algorithms)](https://github.com/trekhleb/javascript-algorithms/tree/master/src/data-structures/tree/binary-search-tree) · Oleksii Trekhleb · pseudocode whose `remove` branches are the three deletion cases; the table lists O(log n) for everything with no worst case (*read* README) · fetched 2026-10-13
- **Our delta:** the degeneration shown by inserting sorted keys, and the two-children case with a successor.

### T14-10 · Heaps and priority queues — Understand · 🔲 not written
- **Read this:** [Binary Heap (VisuAlgo)](https://visualgo.net/en/heap) · Steven Halim and Felix Halim, NUS · insert shifts up and extract-max shifts down, both O(log N); `Create(A)` in O(N) credited to Floyd, 1964; a complete tree stored in an array with shifts for parent and child (*read*) · covers our angle: **partial** — no JavaScript, no top-K · fetched 2026-10-13
- **Also good:** [Binary heap](https://en.wikipedia.org/wiki/Binary_heap) · Wikipedia · array representation, up-heap and down-heap, and why building bottom-up is O(n) while inserting one at a time is O(n log n) (*read*) · fetched 2026-10-13
- **Our delta:** a min-heap with a comparator in JavaScript, `heapify` in O(n), and top-K. The JavaScript heap README in trekhleb's repo was read but only states the complexity table, so it is not linked.

### T14-11 · Graphs — Understand · 🔲 not written
- **Read this:** [Graph Data Structures (VisuAlgo)](https://visualgo.net/en/graphds) · Steven Halim and Felix Halim, NUS · adjacency matrix O(V squared) space, adjacency list O(V plus E), edge list O(E); does not describe converting between them (*read*) · covers our angle: **partial** — no JavaScript, no weighted or directed construction from an edge list · fetched 2026-10-13
- **Beyond the docs:** [Implementation of A-star](https://www.redblobgames.com/pathfinding/a-star/implementation.html) · Amit Patel, Red Blob Games · a graph as a dict of neighbour lists, directed edges, locations as plain integers, strings or tuples, and a grid whose `neighbors` function is computed on demand; Python, C++ and C# only, no JavaScript code (*read*, first 100000 characters) · fetched 2026-10-13
- **Our delta:** building an adjacency list from an edge list in JavaScript, directed and weighted.

### T14-12 · Union-Find (disjoint set) — Understand · 🔲 not written
- **Read this:** [Disjoint Set Union](https://cp-algorithms.com/data_structures/disjoint_set_union.html) · cp-algorithms · `make_set`, `find_set` with path compression, `union_sets` by size; both together give amortised O(alpha of n), inverse Ackermann; **C++ code**, proof omitted (*read*) · covers our angle: **partial** — no worked problems · fetched 2026-10-13
- **Also good:** [Union-Find](https://algs4.cs.princeton.edu/15uf/) · Sedgewick and Wayne, Princeton · quick-find, quick-union, weighted quick-union (depth at most lg n), then path compression; **Java code** (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Union-Find Disjoint Sets (VisuAlgo)](https://visualgo.net/en/ufds) · Steven Halim and Felix Halim, NUS · animated `FindSet` with path compression and `UnionSet` by rank; O(alpha of N) with both, O(log n) with rank alone, "alpha of 1M is about 1" (*read*) · fetched 2026-10-13
- **Our delta:** the problems it turns from hard into trivial (connected components, redundant edge), in JavaScript.

### T14-13 · Tries — Understand · 🔲 not written
- **Read this:** [Trie](https://en.wikipedia.org/wiki/Trie) · Wikipedia · string-indexed lookup that follows a key a character at a time; no hash function and no collisions; "basic trie implementations can be memory-intensive"; uses: autocomplete, spell checking, IP routing (*read*) · covers our angle: **partial** — no code, and the `Set` comparison is only implied · fetched 2026-10-13
- **Beyond the docs:** [Using Tries to Autocomplete MongoDB Queries in Node.js](https://thecodebarbarian.com/using-tries-to-autocomplete-mongodb-queries-in-nodejs.html) · Valeri Karpov, 2025-11-18 · a JavaScript `TrieNode` and `Trie` with an end-of-word flag and a frequency count, prefix walk, collect everything below, rank by frequency; the second half is MongoDB-specific (*read*) · fetched 2026-10-13
- **Our delta:** the memory trade-off against a `Set` of words, measured.

### T14-14 · Matrices and grids — Understand · 🔲 not written
- **Read this:** [Implementation of A-star](https://www.redblobgames.com/pathfinding/a-star/implementation.html) · Amit Patel, Red Blob Games · a `SquareGrid` that computes neighbours on demand from a direction array and filters them through `in_bounds` and `passable`; Python, C++ and C# only (*read*, first 100000 characters) · covers our angle: **partial** — traversal and the grid-as-graph step; nothing on in-place rotation · fetched 2026-10-13
- **Our delta:** direction vectors in JavaScript, in-place rotation (transpose, then reverse each row) and spiral order. Searched for rotation and spiral explanations: the hits were LeetCode solution write-ups and none was fetched, so none is linked.

### T14-15 · Balanced trees in one page — Know · 🔲 not written
- **Read this:** [AVL tree](https://en.wikipedia.org/wiki/AVL_tree) · Wikipedia · balance factor of -1, 0 or 1 at every node; single and double rotations; height at most about 1.44 log2(n plus 2) against about 2 log2(n plus 1) for red-black (*read*) · covers our angle: **partial** — no JavaScript, nothing on "why you rarely implement one" · fetched 2026-10-13
- **Also good:** [Red-black tree](https://en.wikipedia.org/wiki/Red%E2%80%93black_tree) · Wikipedia · one colour bit per node, worst-case O(log n) insert, delete and search, rebalancing with at most three rotations; used in the Linux scheduler and Java 8 `HashMap` buckets (*read*, first 100000 characters) · fetched 2026-10-13
- **Beyond the docs:** [Binary Search Tree and AVL Tree (VisuAlgo)](https://visualgo.net/en/bst) · Steven Halim and Felix Halim, NUS · the four rebalancing cases (LL, LR, RR, RL) animated, with a proof that AVL height is below 2 log N (*read*) · fetched 2026-10-13
- **Our delta:** the discuss-not-implement angle, and the sorted-insert degeneration it prevents.

### T14-16 · Bitsets, sparse structures and circular buffers — Know · 🔲 not written
- **Read this:** [Typed arrays](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Typed_arrays) · MDN · `ArrayBuffer` plus views such as `Uint8Array` and `Uint32Array`; fixed length, so `push`, `pop` and `splice` are not available (*read*) · covers our angle: **partial** — the storage a bitset sits on, not the bit operations · fetched 2026-10-13
- **Also good:** [Bit array](https://en.wikipedia.org/wiki/Bit_array) · Wikipedia · OR, AND and XOR give union, intersection and difference in about n over w word operations; uncompressed bit arrays suit dense sets, and for sparse sets it suggests compressed arrays, Judy arrays, tries or Bloom filters (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Bit Sets: An introduction to bit manipulation](https://alexharri.com/blog/bit-sets) · Alex Harri, 2024-01-06 · builds a JavaScript `BitSet`: bitwise operators, a bit mask as many booleans in one number, an index split into word and bit, then `add`, `remove`, `has`; part 1 of 2, iteration is in part 2 (*read*) · fetched 2026-10-13
- **Our delta:** sparse structures (a sparse set pairing a dense and a sparse array) and the circular buffer, whose best page is linked at T14-05. No page on sparse sets in JavaScript turned up.

### T14-17 · Persistent and immutable structures — Know · 🔲 not written
- **Read this:** [Immer](https://immerjs.github.io/immer/) · Immer docs · writes go to a draft proxy; "unchanged parts of a data tree don't need to be copied and are shared in memory with older versions"; an unchanged reference means unchanged data (*read*) · covers our angle: **partial** — usage and the sharing guarantee, not how a persistent tree is built · fetched 2026-10-13
- **Also good:** [Updating Objects in State](https://react.dev/learn/updating-objects-in-state) · React docs · treat state as read-only, replace rather than mutate, spread is shallow and "copies all the way up" the path; the idea of reuse is implied, the term structural sharing is not used (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Understanding Clojure's Persistent Vectors, pt. 1](https://hypirion.com/musings/understanding-persistent-vector-pt-1) · Jean Niklas L'orange, 2013-09-25 · copy only the nodes on the path to the changed leaf and share the rest; a 32-way tree is "effectively" constant time (theoretically log base 32); Clojure, not JavaScript, but the mechanism is the same (*read*) · fetched 2026-10-13
- **Our delta:** a persistent list or array-backed trie in JavaScript, and why a UI framework's change check wants it.
