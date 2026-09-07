---
title: "The JavaScript track's phases 13–17 hold the language-level implementations; this track is the interview layer — patterns, ladders, the method — and the rule between them is link, never duplicate"
sidebar_label: "13 · This track and the JS track"
sidebar_position: 14
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-07 against the bible's own directory tree — every link below was checked
> against a file on disk at the time of writing. The division of labour is the project's standing
> rule for these two tracks (the drafting brief and `instructions.md`). **No sandbox run.**

**Two tracks in the bible teach data structures and algorithms, on purpose, at different
altitudes. The [JavaScript track](../../../javascript/README.md)'s phases 13 to 17 are the
language layer: how a heap, a trie, a graph or a DP table is implemented in JavaScript, with
that language's costs and idioms. This track is the interview layer: which pattern a problem's
signals point to, the ladder of problems per pattern, the method under a clock, and the
follow-ups that separate a recalled pattern from a derived one.** The rule between them is
link, never duplicate: when a page here needs the implementation of a structure, it points at
the JavaScript page that owns it; when the JavaScript page needs the interview angle, it should
point here. For Java the split is the same, with the
[Java collections phase](../../../java/pages/phase-3-generics-collections/README.md) as the
language layer and [12 · Java's collections](12-javas-collections-for-interviews.md) here as the
interview subset.

## The two layers

| Question | Owner |
|---|---|
| *How is it implemented in JavaScript, and what does it cost there?* — a heap, a trie, union-find, a DP table, the built-ins' complexities | JavaScript track, phases 13–17 |
| *How is it implemented in Java, and which built-in does the work?* | Java track, phase 3 |
| *Which pattern is this problem, in what order do I learn the patterns, and how do I perform under a clock?* | **this track** |
| *What are the canonical problems per pattern and their follow-ups?* | **this track**, phase 19 (the ladder) |
| *Which of these algorithms run inside the systems I operate, and where?* | **this track**, phase 18, pointing at the System Design track |

The test for where a paragraph belongs: if it changes when the language changes — the cost of
`shift`, the absence of a heap, `Map` versus object keys — it is the language layer; if it holds
in any language — the signal that points to sliding window, the invariant of a binary search,
the order of the ladder — it is this track.

## Where the JavaScript track's phases map

| JavaScript track phase | What it owns | This track's counterpart |
|---|---|---|
| [Phase 13 — Complexity](../../../javascript/pages/phase-13-complexity/README.md) | Big-O in JavaScript terms; the cost of the built-ins; hidden quadratics | phase 1 here — reading a bound off code, amortised analysis, the constraints table — assumes it and adds the interview framing |
| [Phase 14 — Data structures](../../../javascript/pages/phase-14-data-structures/README.md) | stacks, queues, linked lists, heaps, tries, graphs, union-find *implemented* in JavaScript | phases 6–13 here name the patterns that use them and link back for the implementation |
| [Phase 15 — Algorithm patterns](../../../javascript/pages/phase-15-algorithm-patterns/README.md) | two pointers, sliding window, binary search, BFS/DFS, backtracking, greedy as JavaScript code | phases 3–5, 8, 12–15 here — the signals, the canonical problems, the follow-ups, the ladder |
| [Phase 16 — Dynamic programming](../../../javascript/pages/phase-16-dynamic-programming/README.md) | memoisation and tabulation in JavaScript; `Map` keys and string keys | phase 16 here — the framework, the families, recognising DP from the problem |
| [Phase 17 — Machine coding](../../../javascript/pages/phase-17-machine-coding/README.md) | building small working programs in JavaScript under a clock | phase 17 here (design-flavoured problems) and the System Design track's LLD part |

The JavaScript syllabus part that defines those phases is
[04 · DSA and machine coding](../../../javascript/syllabus/04-dsa-and-machine-coding.md); it is
parked beyond its Master rows, which is one more reason this track does not restate it — the
implementations that exist there are the ones a fullstack reader needs, and the rest is
interview material that lives here.

## What "link, never duplicate" looks like on a page

A page in this track that needs a heap says: "a min-heap of size k — the JavaScript
implementation is in the JavaScript track's phase 14; Java's `PriorityQueue` is documented on
[12](12-javas-collections-for-interviews.md)" — and then spends its lines on the pattern, the
invariant and the follow-ups. It does not re-derive sift-up and sift-down. The one exception in
this phase is [04](04-language-choice-and-runtime-traps.md), which carries a thirty-line heap
because the *absence* of a built-in is itself an interview trap and the rehearsed version is the
fix; that is an interview-layer reason, and the page says so.

Going the other way, a JavaScript-track page that implements a trie can link to this track's
phase 11 for "when interviews actually ask for one and what the follow-ups are", rather than
speculating about interviews inside a language page.

## Why two layers rather than one big track

Because the two audiences read at different times. A fullstack engineer reading the JavaScript
track wants to know what a `Map` costs and how to implement an LRU cache in the language they
ship in; they may never interview. A candidate three months from a loop wants patterns, ladders
and a method, in two languages, and does not need the sift-down re-explained per language. A
single merged track would make the first reader wade through interview method and the second
re-read implementations they already know. Two layers, cross-linked, serve both and cost one
copy of each fact.

## Gotchas

**★ Symptom: a page here re-implements union-find, and the JavaScript track's version differs
in a detail.** Cause: the implementation duplicated across layers, and the two drifted. Fix: the
interview layer links to the implementation and spends its lines on the pattern; if a
duplication is found, the language track is authoritative and the drift is reported.

**Symptom: you read this track's graph phase and cannot write BFS in JavaScript.** Cause:
expecting the implementation from the interview layer. Fix: by design — phase 14 of the
JavaScript track owns the implementation; this track tells you which problems are BFS and what
the follow-ups are.

**Symptom: a JavaScript-track page speculates about what interviewers ask.** Cause: interview
material written into a language page. Fix: the language page links here; interview tendencies
live in one place so they can be kept honest.

**Symptom: the Java and TypeScript solutions to a problem here disagree on the *pattern*.**
Cause: a language idiom mistaken for a pattern. Fix: the pattern is language-neutral by
definition; if the two solutions differ in approach rather than in syntax, one of them has the
wrong pattern.

## Interview questions

**★ How is this track divided from the JavaScript track, and why?**
The JavaScript track's phases 13–17 own the language layer — how a structure or algorithm is
implemented in JavaScript and what it costs there; this track owns the interview layer — the
signals that point to a pattern, the ladder of problems per pattern, the method under a clock,
and the follow-ups. The rule is link, never duplicate, so each fact has one home and cannot
drift. Two layers exist because the readers differ: a shipping engineer wants the language costs
and may never interview; a candidate wants patterns and method in two languages without
re-reading implementations.

**Where do you go when a pattern here needs an implementation?**
To the language layer: the JavaScript track's phase 14 for structures and 15 for the algorithm
patterns in JavaScript, phase 16 for DP; the Java track's phase 3 and this track's page 12 for
Java's built-ins. This track's pages name the structure, state the invariant and the cost, and
link — with one deliberate exception, the rehearsed heap on page 04, which exists because the
missing built-in is itself an interview trap.

**What is the test for whether a paragraph belongs in the language layer or the interview
layer?**
Whether it changes when the language changes. The cost of removing from the front of an array,
the absence of a heap, `Map` versus object keys — language layer. The signal that points to
sliding window, the invariant of a binary search, the order in which patterns are learned —
interview layer, because they hold in TypeScript and Java alike.

---

← Prev: [12 · Java's collections](12-javas-collections-for-interviews.md) · Index: [Phase 0 — The DSA interview and the practice system](README.md) · Next → [14 · Contests vs interviews](14-competitive-programming-vs-interviews.md)
