---
title: "Link map · DSA · Part 7 (phases 17-18), file 1"
sidebar_label: "07 · design-flavoured, applied (1)"
sidebar_position: 7
---

# Link map · Part 7, file 1 (phase 17, rows T17-01 to T17-15)

Covers the design-flavoured problem rows of phase 17. *read* = I read the passage that supports the claim; *headings only* = fetched at HTTP 200 and the headings or topic checked.

### T17-01 · LRU and LFU caches — Master · 🔲 not written
- **Read this:** [Implementing LFU in O(1)](https://arpitbhayani.me/blogs/lfu) · Arpit Bhayani · one hash table plus a doubly linked list of frequency nodes, with insert, get and evict (lowest-frequency node first) · covers our angle: **partial** - no TTL or capacity-change follow-ups, no TypeScript or Java · fetched 2026-10-14 (*read*)
- **Also good:** [Designing an LRU cache that actually runs in O(1)](https://www.techinterview.org/post/3233476035/lru-cache-design-o1/) · techinterview.org · map plus doubly linked list with dummy head and tail, then prose on TTL expiry, LFU buckets and sharded locks; the page is ad-heavy and its company-frequency claims are unsourced · fetched 2026-10-14 (*read*)
- **Our delta:** TTL expiry and capacity change as worked code, TypeScript and Java.

### T17-02 · Min-stack, max-queue and the augmented structure — Master · 🔲 not written
- **Read this:** [Minimum stack / minimum queue](https://cp-algorithms.com/data_structures/stack_queue_modification.html) · cp-algorithms · stores each element with the minimum so far; builds a queue from two stacks and also from a monotonic deque; then the fixed-length sliding-window minimum · covers our angle: **partial** - C++ only, minimum only (no max variant), no interview framing · fetched 2026-10-14 (*read*)
- **Also good:** [Stack with constant-time getMin](https://helloacm.com/how-to-design-a-stack-with-constant-time-in-push-pop-top-and-getmin/) · helloacm · the LeetCode 155 version: a second stack carries the running minimum, C++ · fetched 2026-10-14 (*read*)
- **Our delta:** TypeScript and Java versions; the max variant stated explicitly.

### T17-03 · Design a feed — Master · 🔲 not written
- **Read this:** [355. Design Twitter](https://walkccc.me/LeetCode/problems/0355/) · walkccc · max-heap seeded with each followee's newest tweet, popped ten times; C++ and Java use a heap, Python uses heapq.merge over per-user deques; follow and unfollow are set updates with no-op rules · covers our angle: **partial** - no TypeScript, no prose, little on follow and unfollow set cost · fetched 2026-10-14 (*read*)
- **Also good:** [Design Twitter](https://algomaster.io/learn/dsa/design-twitter) · AlgoMaster · states outright that the feed reduces to merging K sorted lists, then compares a heap-based merge against simpler approaches · fetched 2026-10-14 (*read*)
- **Our delta:** the TypeScript heap, and the link back to merge k sorted lists.

### T17-04 · Hit counter and the time-based key-value store — Master · 🔲 not written
- **Read this:** [Time Based Key-Value Store](https://www.algo.monster/liteproblems/time-based-key-value-store) · AlgoMonster · per-key list kept sorted because set calls arrive in increasing time, then binary search for the largest timestamp not after the query · covers our angle: **partial** - Python only; the hit counter and sliding window half is missing · fetched 2026-10-14 (*read*)
- **Also good:** [Design Hit Counter](https://leetcode.doocs.org/en/lc/362/) · doocs · one solution: binary search over an append-only timestamp list, with code in six languages including TypeScript; a queue that drops stale hits is only mentioned in passing · fetched 2026-10-14 (*read*)
- **Our delta:** the sliding window over time as a queue or circular buffer, and TypeScript for the key-value store.

### T17-05 · Rate limiter — Master · 🔲 not written
- **Read this:** [Build 5 Rate Limiters with Redis](https://redis.io/tutorials/howtos/ratelimiting/) · Redis · fixed window, sliding window log and counter, token bucket and leaky bucket with a trade-off table, TypeScript plus Lua · covers our angle: **partial** - built around Redis, not the in-process coding-round version · fetched 2026-10-14 (*read*)
- **Also good:** [Rate limiting algorithms explained with code](https://blog.algomaster.io/p/rate-limiting-algorithms-explained-with-code) · AlgoMaster · the same five algorithms explained; the code sits in linked GitHub repos (Python and Java), and I did not check whether it is in-process · fetched 2026-10-14 (*headings only*)
- **Beyond the docs:** [Scaling your API with rate limiters](https://stripe.com/blog/rate-limiters) · Stripe · a token bucket on Redis for the request rate limiter, plus a concurrent-requests limiter and two load shedders that act on whole-system state · fetched 2026-10-14 (*read*)
- **Our delta:** the single-process class with an injectable clock.

### T17-06 · Randomised set with constant-time insert, delete and random — Master · 🔲 not written
- **Read this:** [381. Insert Delete GetRandom O(1) - Duplicates allowed](https://leetcode.doocs.org/en/lc/381/) · doocs · list plus value-to-index-set map, swap with last on removal · covers our angle: **partial** - Python and Java only, the no-duplicates variant is a separate page · fetched 2026-10-14 (*read*)
- **Also good:** [Insert Delete GetRandom O(1)](https://leetcode.doocs.org/en/lc/380/) · doocs · the plain variant: hash table of value to index plus a dynamic list; code includes TypeScript · fetched 2026-10-14 (*read*)
- **Our delta:** a TypeScript walkthrough of the duplicates variant (the plain variant already has TypeScript code).

### T17-07 · Concurrency-shaped problems in Node — Master · 🔲 not written
- **Read this:** [JavaScript promise concurrency limit](https://techearl.com/javascript-promise-concurrency-limit) · TechEarl · a 15-line dependency-free pool: several workers share one cursor, results stored by index, first failure rejects, with allSettled or p-map as the alternatives · covers our angle: **partial** - no scheduler or debounced queue · fetched 2026-10-14 (*read*)
- **Also good:** [Limit Promise Concurrency with pool](https://davidwalsh.name/promise-pool) · David Walsh · caps in-flight promises with a maxConcurrency option of a library; does not build the pool · fetched 2026-10-14 (*read*)
- **Our delta:** the scheduler and debounced queue, and the event-loop model.

### T17-08 · Iterators — Understand · 🔲 not written
- **Read this:** [284. Peeking Iterator](https://walkccc.me/LeetCode/problems/0284/) · walkccc · caches one element ahead; Java, Python, C++ · covers our angle: **partial** - flatten-nested-list and zigzag are not on this page · fetched 2026-10-14 (*read*)
- **Our delta:** flatten nested list with an explicit stack, zigzag over k lists, TypeScript generators.

### T17-09 · Small APIs over deques and stacks — Understand · 🔲 not written
- **Read this:** [353. Design Snake Game](https://walkccc.me/LeetCode/problems/0353/) · walkccc · a deque for the body and a hash set of cell ids for O(1) self-collision, with the old-tail-first subtlety; C++, Java, Python · covers our angle: **partial** - no browser history or undo editor · fetched 2026-10-14 (*read*)
- **Also good:** [1472. Design Browser History](https://walkccc.me/LeetCode/problems/1472/) · walkccc · three approaches in code only: array with a last index, two stacks, doubly linked list; no prose · fetched 2026-10-14 (*read*)
- **Our delta:** the undo and redo editor, TypeScript.

### T17-10 · Autocomplete system — Understand · 🔲 not written
- **Read this:** [System Design: Typeahead / Search Autocomplete](https://techinterview.org/system-design-typeahead/) · techinterview.org · top-K stored per trie node, serving costs O(prefix length), and updates must refresh every ancestor asynchronously · covers our angle: **partial** - system-design level, not the LeetCode 642 coding version · fetched 2026-10-14 (*read*)
- **Also good:** [642. Design Search Autocomplete System](https://leetcode.doocs.org/en/lc/642/) · doocs · the coding-round version: a trie with a heat count per sentence and a walk of the subtree under the prefix per query (not top-K per node); Python and Java · fetched 2026-10-14 (*read*)
- **Our delta:** the in-memory TypeScript trie with frequency updates.

### T17-11 · An in-memory file system and a key-value store with transactions — Understand · 🔲 not written
- **Read this:** [588. Design In-Memory File System](https://leetcode.doocs.org/en/lc/588/) · doocs · a trie keyed by path segments with a child map per node, contrasted with a flat map of full paths; Python, Java, Go · covers our angle: **partial** - nothing on transactions or an undo log · fetched 2026-10-14 (*read*)
- **Also good:** [Design an in-memory database to handle transactions](https://www.hellointerview.com/community/questions/memory-database-transactions/cm6uaoy1y00003b6la4jojd7s) · Hello Interview community answer · a stack of dictionaries, one per open transaction, storing the new and previous value so rollback can restore; nested commit merges into the parent frame; Python; its rollback treats a stored None as absent, which is a bug to avoid with a sentinel · covers the key-value half only · fetched 2026-10-14 (*read*)
- **Our delta:** a vetted begin, commit and rollback store with an absent-key sentinel, in TypeScript. The other hits found (prachub.com) are question prompts with no worked answer, so they are not listed.

### T17-12 · The quick classics — Understand · 🔲 not written
- **Read this:** [348. Design Tic-Tac-Toe](https://helloacm.com/how-to-design-a-tic-tac-toe-game/) · helloacm · a naive O(N squared) board scan against O(N) space of per-row, per-column and diagonal counts for O(1) per move · covers our angle: **partial** - logger and leaderboard not covered · fetched 2026-10-14 (*read*)
- **Also good:** [359. Logger Rate Limiter](https://leetcode.doocs.org/en/lc/359/) · doocs · a hash table of message to next allowed print time, O(1) per call, O(m) space; Python, Java, C++, Go, JavaScript · fetched 2026-10-14 (*read*)
- **Our delta:** the leaderboard, TypeScript.

### T17-13 · Building the primitives — Understand · 🔲 not written
- **Read this:** [Skip list](https://en.wikipedia.org/wiki/Skip_list) · Wikipedia · express-lane levels, an element in layer i joins layer i+1 with probability p, search by moving right then dropping down, insert links a tall element into every level, expected O(log n) · covers our angle: **partial** - no from-scratch hash map · fetched 2026-10-14 (*read*)
- **Also good:** [Hashing with separate chaining](https://web.cs.wpi.edu/~heineman/html/teaching_/cs2223/b15/days/day12.html) · WPI CS 2223 · a Java SeparateChainingHashST that doubles the table when the average chain length reaches 7 and notes the rehash cost · fetched 2026-10-14 (*read*)
- **Our delta:** a TypeScript hash map and set with resizing, and an interview-sized skip list.

### T17-14 · Concurrency problems in Java — Understand · 🔲 not written
- **Read this:** [1114. Print in Order](https://leetcode.doocs.org/en/lc/1114/) · doocs · three semaphores force the order, Java solution (also Python and C++) · covers our angle: **partial** - bounded buffer and dining philosophers are other pages · fetched 2026-10-14 (*read*)
- **Also good:** [Lock Objects](https://docs.oracle.com/javase/tutorial/essential/concurrency/newlocks.html) · Oracle Java Tutorials · Lock, tryLock backing out, and the Safelock example that avoids deadlock by acquiring both locks or neither · fetched 2026-10-14 (*read*)
- **Also good:** [1188. Design Bounded Blocking Queue](https://leetcode.doocs.org/en/lc/1188/) · doocs · the bounded buffer with two semaphores (free slots and items), Java, Python, C++; no locks or conditions · fetched 2026-10-14 (*read*)
- **Our delta:** dining philosophers ([1226](https://leetcode.doocs.org/en/lc/1226/)), conditions, atomics.

### T17-15 · The boundary with low-level design — Know · 🔲 not written
- **Read this:** [What to expect in a low-level design interview round](https://www.designgurus.io/answers/detail/what-to-expect-in-a-low-level-design-interview-round) · DesignGurus · lists what an LLD round evaluates (object-oriented principles, design patterns, class diagrams, database and API design) but does not contrast it with a coding round · covers our angle: **partial** - vendor page, no catalogue of when a design coding question is really LLD · fetched 2026-10-14 (*read*)
- **Our delta:** the decision rule and the link to the System Design track catalogue. A search for a source that draws this line found only interview anecdotes, so none is listed.
