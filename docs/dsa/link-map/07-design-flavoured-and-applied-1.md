---
title: "Link map · DSA · Part 7 (phases 17-18), file 1"
sidebar_label: "07 · design-flavoured, applied (1)"
sidebar_position: 7
---

# Link map · Part 7, file 1 (phase 17, rows T17-01 to T17-15)

Covers the design-flavoured problem rows of phase 17. *read* = I read the passage that supports the claim; *headings only* = fetched at HTTP 200 and the headings or topic checked.

### T17-01 · LRU and LFU caches — Master · 🔲 not written
- **Read this:** [Implementing LFU in O(1)](https://arpitbhayani.me/blogs/lfu) · Arpit Bhayani · walks the hash table plus frequency-node lists design step by step, with insert, get and evict · covers our angle: **partial** - no TTL or capacity-change follow-ups, no TypeScript or Java · fetched 2026-10-14 (*read*)
- **Also good:** [Designing an LRU cache that actually runs in O(1)](https://www.techinterview.org/post/3233476035/lru-cache-design-o1/) · techinterview.org · the map plus doubly linked list core of LRU · fetched 2026-10-14
- **Our delta:** TTL expiry, resizing capacity, TypeScript and Java code.

### T17-02 · Min-stack, max-queue and the augmented structure — Master · 🔲 not written
- **Read this:** [Minimum stack / minimum queue](https://cp-algorithms.com/data_structures/stack_queue_modification.html) · cp-algorithms · covers the min stack, the monotonic deque queue and the two-stack queue, then the sliding-window use · covers our angle: **partial** - C++ only, no interview framing · fetched 2026-10-14 (*read*)
- **Also good:** [Stack with constant-time getMin](https://helloacm.com/how-to-design-a-stack-with-constant-time-in-push-pop-top-and-getmin/) · helloacm · the LeetCode 155 version · fetched 2026-10-14
- **Our delta:** TypeScript and Java versions; the max variant stated explicitly.

### T17-03 · Design a feed — Master · 🔲 not written
- **Read this:** [355. Design Twitter](https://walkccc.me/LeetCode/problems/0355/) · walkccc · max-heap seeded with each followee's newest tweet, popped ten times; Java and Python · covers our angle: **partial** - no TypeScript, little on follow and unfollow set cost · fetched 2026-10-14 (*read*)
- **Also good:** [Design Twitter](https://algomaster.io/learn/dsa/design-twitter) · AlgoMaster · frames the feed as merging k sorted lists · fetched 2026-10-14
- **Our delta:** the TypeScript heap, and the link back to merge k sorted lists.

### T17-04 · Hit counter and the time-based key-value store — Master · 🔲 not written
- **Read this:** [Time Based Key-Value Store](https://www.algo.monster/liteproblems/time-based-key-value-store) · AlgoMonster · per-key sorted list plus binary search for the latest timestamp not after the query · covers our angle: **partial** - the hit counter and sliding window half is missing · fetched 2026-10-14 (*headings only*)
- **Also good:** [Design Hit Counter](https://leetcode.doocs.org/en/lc/362/) · doocs · the hit counter problem with solutions · fetched 2026-10-14
- **Our delta:** the sliding window over time (queue or circular buffer) and TypeScript.

### T17-05 · Rate limiter — Master · 🔲 not written
- **Read this:** [Build 5 Rate Limiters with Redis](https://redis.io/tutorials/howtos/ratelimiting/) · Redis · fixed window, sliding window log and counter, token bucket and leaky bucket with a trade-off table, in TypeScript · covers our angle: **partial** - built around Redis, not the in-process coding-round version · fetched 2026-10-14 (*read*)
- **Also good:** [Rate limiting algorithms explained with code](https://blog.algomaster.io/p/rate-limiting-algorithms-explained-with-code) · AlgoMaster · in-process versions of the same algorithms · fetched 2026-10-14
- **Beyond the docs:** [Scaling your API with rate limiters](https://stripe.com/blog/rate-limiters) · Stripe · why a production system layers a token bucket with load shedders · fetched 2026-10-14 (*read*)
- **Our delta:** the single-process class with an injectable clock.

### T17-06 · Randomised set with constant-time insert, delete and random — Master · 🔲 not written
- **Read this:** [381. Insert Delete GetRandom O(1) - Duplicates allowed](https://leetcode.doocs.org/en/lc/381/) · doocs · list plus value-to-index-set map, swap with last on removal · covers our angle: **partial** - Python and Java only, the no-duplicates variant is a separate page · fetched 2026-10-14 (*read*)
- **Also good:** [Insert Delete GetRandom O(1)](https://leetcode.doocs.org/en/lc/380/) · doocs · the plain variant · fetched 2026-10-14
- **Our delta:** TypeScript.

### T17-07 · Concurrency-shaped problems in Node — Master · 🔲 not written
- **Read this:** [Limit Promise Concurrency with pool](https://davidwalsh.name/promise-pool) · David Walsh · caps in-flight promises with a maxConcurrency option · covers our angle: **partial** - uses a library rather than building the pool; no scheduler or debounced queue · fetched 2026-10-14 (*read*)
- **Also good:** [JavaScript promise concurrency limit](https://techearl.com/javascript-promise-concurrency-limit) · TechEarl · a dependency-free worker-loop helper · fetched 2026-10-14 (*headings only*)
- **Our delta:** build the pool by hand, the scheduler and debounced queue, and the event-loop model.

### T17-08 · Iterators — Understand · 🔲 not written
- **Read this:** [284. Peeking Iterator](https://walkccc.me/LeetCode/problems/0284/) · walkccc · caches one element ahead; Java, Python, C++ · covers our angle: **partial** - flatten-nested-list and zigzag are not on this page · fetched 2026-10-14 (*read*)
- **Our delta:** flatten nested list with an explicit stack, zigzag over k lists, TypeScript generators.

### T17-09 · Small APIs over deques and stacks — Understand · 🔲 not written
- **Read this:** [353. Design Snake Game](https://walkccc.me/LeetCode/problems/0353/) · walkccc · a deque for the body and a hash set for O(1) self-collision; C++, Java, Python · covers our angle: **partial** - no browser history or undo editor · fetched 2026-10-14 (*read*)
- **Also good:** [1472. Design Browser History](https://walkccc.me/LeetCode/problems/1472/) · walkccc · back and forward navigation · fetched 2026-10-14 (*headings only*)
- **Our delta:** the undo and redo editor, TypeScript.

### T17-10 · Autocomplete system — Understand · 🔲 not written
- **Read this:** [System Design: Typeahead / Search Autocomplete](https://techinterview.org/system-design-typeahead/) · techinterview.org · top-K stored per trie node, walk cost against update cost · covers our angle: **partial** - system-design level, not the LeetCode 642 coding version · fetched 2026-10-14 (*read*)
- **Also good:** [642. Design Search Autocomplete System](https://leetcode.doocs.org/en/lc/642/) · doocs · the coding-round version · fetched 2026-10-14 (*headings only*)
- **Our delta:** the in-memory TypeScript trie with frequency updates.

### T17-11 · An in-memory file system and a key-value store with transactions — Understand · 🔲 not written
- **Read this:** [588. Design In-Memory File System](https://leetcode.doocs.org/en/lc/588/) · doocs · a trie of path segments with a child map per node; Python, Java, Go · covers our angle: **partial** - nothing on transactions or an undo log · fetched 2026-10-14 (*read*)
- **Our delta:** the key-value store with begin, commit and rollback; searches for a clear write-up found none (tried: key-value store transactions rollback undo log).

### T17-12 · The quick classics — Understand · 🔲 not written
- **Read this:** [348. Design Tic-Tac-Toe](https://helloacm.com/how-to-design-a-tic-tac-toe-game/) · helloacm · row, column and diagonal counters give O(1) per move · covers our angle: **partial** - logger and leaderboard not covered · fetched 2026-10-14 (*headings only*)
- **Also good:** [359. Logger Rate Limiter](https://leetcode.doocs.org/en/lc/359/) · doocs · timestamp map solution · fetched 2026-10-14 (*headings only*)
- **Our delta:** the leaderboard, TypeScript.

### T17-13 · Building the primitives — Understand · 🔲 not written
- **Read this:** [Skip list](https://en.wikipedia.org/wiki/Skip_list) · Wikipedia · levels, coin flips, search and insert · covers our angle: **partial** - no from-scratch hash map · fetched 2026-10-14 (*headings only*)
- **Also good:** [Hashing with separate chaining](https://web.cs.wpi.edu/~heineman/html/teaching_/cs2223/b15/days/day12.html) · WPI CS 2223 · Java chaining with a resize method · fetched 2026-10-14 (*headings only*)
- **Our delta:** a TypeScript hash map and set with resizing, and an interview-sized skip list.

### T17-14 · Concurrency problems in Java — Understand · 🔲 not written
- **Read this:** [1114. Print in Order](https://leetcode.doocs.org/en/lc/1114/) · doocs · chains three semaphores to force order, Java solution · covers our angle: **partial** - bounded buffer and dining philosophers are other pages · fetched 2026-10-14 (*read*)
- **Also good:** [Lock Objects](https://docs.oracle.com/javase/tutorial/essential/concurrency/newlocks.html) · Oracle Java Tutorials · Lock, tryLock and a deadlock-avoidance example · fetched 2026-10-14 (*read*)
- **Also good:** [1188. Design Bounded Blocking Queue](https://leetcode.doocs.org/en/lc/1188/) · doocs · the bounded buffer · fetched 2026-10-14
- **Our delta:** dining philosophers ([1226](https://leetcode.doocs.org/en/lc/1226/)), conditions, atomics.

### T17-15 · The boundary with low-level design — Know · 🔲 not written
- **Read this:** [What to expect in a low-level design interview round](https://www.designgurus.io/answers/detail/what-to-expect-in-a-low-level-design-interview-round) · DesignGurus · how the LLD round differs from a coding round · covers our angle: **partial** - vendor page, no catalogue of when a design coding question is really LLD · fetched 2026-10-14 (*headings only*)
- **Our delta:** the decision rule and the link to the System Design track catalogue.
