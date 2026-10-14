---
title: "Link map · DSA · Part 1 (phases 0-2), file 1"
sidebar_label: "01 · foundations (1)"
sidebar_position: 1
---

# Link map · DSA · Part 1, file 1 (phase 0)

Covers the 14 topic rows of phase 0 (T00-01 to T00-14). *read* = I read the passage; *headings only* = fetched at 200 and headings checked. All fetched 2026-10-14 and re-verified (status 200, passage read) on the same date.

### T00-01 · What the coding rounds grade — Master · ✅ written `docs/dsa/pages/phase-0-the-interview-and-practice/01-what-the-coding-rounds-grade.md`
- **Read this:** [How candidates are evaluated in coding interviews at top tech companies](https://www.techinterviewhandbook.org/coding-signals/) · Tech Interview Handbook · one page that names the graded signals (communication, problem solving, technical competency, testing) and how they combine into a hire decision · covers our angle: **partial** - code quality appears only as a bullet under technical competency; nothing on the senior follow-up that changes constraints (the page only lists follow-up discussion as an advanced signal) · fetched 2026-10-14 (*read*)
- **Our delta:** the senior twist (a follow-up that changes the constraints) and how to take a hint are ours alone.

### T00-02 · The 45-minute shape — Master · ✅ written `docs/dsa/pages/phase-0-the-interview-and-practice/02-the-45-minute-shape.md`
- **Read this:** [Time Management in Coding Interviews](https://algomaster.io/learn/dsa/time-management-in-coding-interviews) · AlgoMaster · a minute-by-minute breakdown (understand 0-5, approach 5-10, code 10-35, test 35-45) with pitfalls such as the five-minute trap in the understand phase · covers our angle: full · fetched 2026-10-14 (*read*)
- **Also good:** [Top techniques to approach and solve coding interview questions](https://www.techinterviewhandbook.org/coding-interview-techniques/) · Tech Interview Handbook · draw it out, solve it by hand, break it into smaller parts · fetched 2026-10-14

### T00-03 · The method: understand, match, plan, implement, review, evaluate — Master · ✅ written `docs/dsa/pages/phase-0-the-interview-and-practice/03-the-method.md`
- **Read this:** [UMPIRE Interview Strategy](https://guides.codepath.com/compsci/UMPIRE-Interview-Strategy) · CodePath · the six-step method under exactly our letters, with Match as the pattern-recognition step, a worked linked-list example, and Review framed as debugging by hand · covers our angle: full · fetched 2026-10-14 (*read*)

### T00-04 · Language choice and runtime traps — Master · ✅ written `docs/dsa/pages/phase-0-the-interview-and-practice/04-language-choice-and-runtime-traps.md`
- **Read this:** [Array.prototype.sort()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort) · MDN · the sort page states the stability guarantee since ES2019 and the comparator rules that cause most JS interview bugs · covers our angle: **partial** - sort and comparator only · fetched 2026-10-14 (*read*)
- **Also good:** [BigInt](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt) · MDN · what BigInt can and cannot mix with · fetched 2026-10-14
- **Our delta:** Node recursion depth, the missing heap and sorted map, and the Java side (`Comparator`, boxing) have no single good page.

### T00-05 · Reading the constraints — Master · ✅ written `docs/dsa/pages/phase-0-the-interview-and-practice/05-reading-the-constraints.md`
- **Read this:** [Complexity calculations](https://usaco.guide/bronze/time-comp) · USACO Guide · includes the table from the bound on n to the intended complexity class · covers our angle: full · fetched 2026-10-14 (*read*)

### T00-06 · Spaced repetition and the mistake log — Master · ✅ written `docs/dsa/pages/phase-0-the-interview-and-practice/06-spaced-repetition-and-the-mistake-log.md`
- **Read this:** [LeetCode Tip 9: Spaced Repetition](https://www.redgreencode.com/leetcode-tip-9-spaced-repetition/) · Red-Green-Code · why spaced repetition is needed after studying a model solution (a problem practised daily becomes hard again after 30 days off) · covers our angle: **partial** - no failure-reason log · fetched 2026-10-14 (*read*)
- **Also good:** [LeetCode Tip 10: Planning a Spaced Repetition Schedule](https://www.redgreencode.com/leetcode-tip-10-planning-a-spaced-repetition-schedule/) · Red-Green-Code · a concrete schedule: start at one-day intervals, then double after each successful repetition · fetched 2026-10-14
- **Our delta:** logging why a problem was missed (the mistake taxonomy) is ours.

### T00-07 · The "when stuck" protocol — Master · ✅ written `docs/dsa/pages/phase-0-the-interview-and-practice/07-the-when-stuck-protocol.md`
- **Read this:** [Tricks For Getting Unstuck During a Coding Interview](https://www.interviewcake.com/tricks-for-getting-unstuck-programming-interview) · Interview Cake · a checklist of moves (hand-solve a sample input, solve a simpler version, start with brute force, look for repeat work, state where you are, pay attention to the interviewer) · covers our angle: **partial** - no explicit step for asking for a hint or naming the bottleneck aloud · fetched 2026-10-14 (*read*)
- **Also good:** [What To Do If You Get Stuck In A Technical Interview](https://anthonydmays.com/blog/2018/01/13/what-to-do-if-you-get-stuck-in-a-technical-interview) · Anthony D. Mays · candidate-side tips: tell the interviewer where you are stuck, ask more questions, simplify the problem · fetched 2026-10-14

### T00-08 · Testing your own code live — Master · ✅ written `docs/dsa/pages/phase-0-the-interview-and-practice/08-testing-your-own-code-live.md`
- **Read this:** [How candidates are evaluated in coding interviews (section 4, Testing)](https://www.techinterviewhandbook.org/coding-signals/) · Tech Interview Handbook · lists testing signals (typical and corner cases, self-corrected bugs, acting like a debugger) as a scored dimension · covers our angle: **partial** - nothing on off-by-one hunting · fetched 2026-10-14 (*read*)
- **Also good:** [Time Management in Coding Interviews](https://algomaster.io/learn/dsa/time-management-in-coding-interviews) · AlgoMaster · the "Phase 4: Test (Minutes 35-45)" budget, which argues skipping tests costs more than it saves · fetched 2026-10-14
- **Our delta:** the boundary-by-boundary off-by-one hunt and the edge-case list are ours.

### T00-09 · The ladders — Understand · ✅ written `docs/dsa/pages/phase-0-the-interview-and-practice/09-the-ladders.md`
- **Read this:** [Grind 75](https://www.techinterviewhandbook.org/grind75/) · Tech Interview Handbook · an interactive tool by the author of Blind 75 that goes beyond 75 questions and lets you set available time, difficulty and topics (the page itself is app UI, with little prose; the handbook's prep guide below describes the algorithm) · covers our angle: **partial** - no 150-problem or long-sheet comparison, no mapping to our phases · fetched 2026-10-14 (*read*)
- **Also good:** [Coding interview preparation guide](https://www.techinterviewhandbook.org/coding-interview-prep/) · Tech Interview Handbook · where the ladder sits in a whole plan, and how the Grind 75 tool ranks questions by priority and balances breadth with depth · fetched 2026-10-14
- **Our delta:** the mapping of each ladder onto our phases and the order-over-count argument.

### T00-10 · Mock interviews — Understand · ✅ written `docs/dsa/pages/phase-0-the-interview-and-practice/10-mock-interviews.md`
- **Read this:** [How to Think Out Loud in a Coding Interview](https://ad.intervue.io/blog/how-to-think-out-loud-coding-interview) · Intervue · three practice methods: record yourself narrating a timed problem, peer practice with turns as interviewer, expert mocks · covers our angle: **partial** - no rubric to grade a peer mock against · fetched 2026-10-14 (*read*)
- **Our delta:** grading a mock against our rubric.

### T00-11 · Communication mechanics — Understand · ✅ written `docs/dsa/pages/phase-0-the-interview-and-practice/11-communication-mechanics.md`
- **Read this:** [How candidates are evaluated in coding interviews (section 1, Communication)](https://www.techinterviewhandbook.org/coding-signals/) · Tech Interview Handbook · lists the communication signals (clarifying questions, approach and tradeoffs, constant narration while coding) · covers our angle: **partial** - no scripts for naming the invariant or stating complexity unprompted · fetched 2026-10-14 (*read*)
- **Also good:** [The Jedi Way to Talk Through Code in Interviews](https://dev.to/timevolt/the-jedi-way-to-talk-through-code-in-interviews-5ap0) · DEV Community · a State, Plan, Execute script with sample wording, plus advice to state test cases and complexity aloud · fetched 2026-10-14
- **Our delta:** unprompted complexity statement and "what I would do with more time".

### T00-12 · Java's collections for interviews — Understand · ✅ written `docs/dsa/pages/phase-0-the-interview-and-practice/12-javas-collections-for-interviews.md`
- **Read this:** [PriorityQueue (Java SE 21)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/PriorityQueue.html) · Oracle · the implementation note gives log time for `offer`/`poll` and linear for `remove(Object)`/`contains` · covers our angle: **partial** - one class of the handful · fetched 2026-10-14 (*read*)
- **Also good:** [TreeMap (Java SE 21)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/TreeMap.html) · Oracle · guaranteed log(n) time for containsKey, get, put, remove · fetched 2026-10-14
- **Also good:** [ArrayDeque (Java SE 21)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/ArrayDeque.html) · Oracle · most operations amortised constant, with the linear-time exceptions (remove, contains, bulk operations) listed · fetched 2026-10-14
- **Our delta:** an interview-framed one-page cheat sheet with the traps.

### T00-13 · How this track relates to the JavaScript track — Know · ✅ written `docs/dsa/pages/phase-0-the-interview-and-practice/13-how-this-track-relates-to-javascript.md`
- **Read this:** none found - tried: "DSA interview prep vs JavaScript data structures implementations study guide"; it is a statement about our own two tracks, so no external page applies.

### T00-14 · Competitive programming vs interviews — Know · ✅ written `docs/dsa/pages/phase-0-the-interview-and-practice/14-competitive-programming-vs-interviews.md`
- **Read this:** [CPFAQ: How Do Coding Interviews Differ from Coding Contests?](https://www.redgreencode.com/cpfaq-how-do-coding-interviews-differ-from-coding-contests/) · Red-Green-Code · direct comparison of format, topics and difficulty, plus the case for contests as long-term practice · covers our angle: **partial** - little on which specific skills transfer · fetched 2026-10-14 (*read*)
