---
title: "Link map · DSA · Part 8 (phases 19-20), file 2"
sidebar_label: "08 · the ladder and the plan (2)"
sidebar_position: 8
---

# Link map · DSA · Part 8 (phases 19-20), file 2

Rows T19-17 to T20-10 of `08-the-ladder-and-the-plan.md`. *read* = I read the passage that supports the claim; *headings only* = fetched at 200 and headings checked. Verified a second time on 2026-10-14: every URL returns 200.
Pattern pages are chosen for the ladder problems named in each row; a delta says what the page does not cover.

### T19-17 · Advanced graphs — Understand · 🔲 not written
- **Read this:** [Dijkstra - finding shortest paths from given vertex](https://cp-algorithms.com/graph/dijkstra.html) · cp-algorithms · the relaxation loop and proof, array version at O(n squared + m), the shortest-path core of network delay and swim in rising water · covers our angle: **partial** - C++ only, no interview framing, and the heap version lives on a separate page · fetched 2026-10-14 (*read*)
- **Also good:** [Dijkstra on sparse graphs](https://cp-algorithms.com/graph/dijkstra_sparse.html) · cp-algorithms · the set and priority-queue implementations, including the no-decrease-key workaround · fetched 2026-10-14 (*read*)
- **Also good:** [Minimum Spanning Tree - Prim's Algorithm](https://cp-algorithms.com/graph/mst_prim.html) · cp-algorithms · opens with the connect-all-cities-at-minimum-cost framing and gives an O(n squared) dense version, which is the min cost to connect all points case · fetched 2026-10-14 (*read*)
- **Also good:** [Bellman-Ford](https://cp-algorithms.com/graph/bellman_ford.html) · cp-algorithms · its proof says that after phase i every shortest path of at most i edges is correct, the idea behind cheapest flights with k stops; the page never mentions the k-limited variant itself · fetched 2026-10-14 (*read*)
- **Also good:** [Graph cheatsheet](https://www.techinterviewhandbook.org/algorithms/graph/) · Tech Interview Handbook · ranks Dijkstra as uncommon and Bellman-Ford and Prim as almost never asked, which supports the Understand tier · fetched 2026-10-14 (*read*)
- **Our delta:** the k-stops state (city and stops), Eulerian path (itinerary), topological order for alien dictionary, TypeScript and Java heaps.

### T19-18 · Greedy — Understand · 🔲 not written
- **Read this:** [Greedy Algorithms Overview](https://www.hellointerview.com/learn/code/greedy/overview) · Hello Interview · the greedy-choice property and optimal substructure on assigning cookies, then longest increasing subsequence as the counterexample and a rule to hunt for a counterexample first · covers our angle: **partial** - none of jump game, gas station, partition labels or the exchange argument · fetched 2026-10-14 (*read*)
- **Also good:** [Greedy algorithm](https://en.wikipedia.org/wiki/Greedy_algorithm) · Wikipedia · states the exchange argument as a proof technique and gives failure cases such as coin problems where the greedy choice is not optimal · fetched 2026-10-14 (*read*)
- **Our delta:** jump game, gas station, partition labels, hand of straights and a worked exchange argument.

### T19-19 · Math and geometry — Understand · 🔲 not written
- **Read this:** [Matrix cheatsheet for coding interviews](https://www.techinterviewhandbook.org/algorithms/matrix/) · Tech Interview Handbook · 1D and 2D index conversion and transposing; essential questions are set matrix zeroes and spiral matrix, with rotate image recommended · covers our angle: **partial** - names the problems, works none · fetched 2026-10-14 (*read*)
- **Also good:** [Math cheatsheet](https://www.techinterviewhandbook.org/algorithms/math/) · Tech Interview Handbook · corner cases (division by zero, negatives, floats), overflow warning and the doubling or halving rule for fast operators; essential questions are Pow(x, n) and Sqrt(x) · fetched 2026-10-14 (*read*)
- **Our delta:** rotate image as transpose then reverse, spiral by shrinking bounds, multiply strings, detect squares with a hash map. Related pages of ours, partial only: `docs/dsa/pages/phase-2-recursion-maths-bits/11d-integer-pow.md` (power) and `11i-happy-numbers-and-cycle-detection.md` (happy number) in the same folder.

### T19-20 · Bit manipulation — Understand · ✅ written `docs/dsa/pages/phase-2-recursion-maths-bits/04-bit-manipulation.md`
- **Read this:** [Common Bit Manipulation Techniques](https://labuladong.online/algo/en/frequency-interview/bitwise-operation/) · labuladong · the n AND (n minus 1) trick for Hamming weight and power of two, then XOR cancellation (a XOR a is 0) for single number and missing number · covers our angle: **partial** - no reverse bits, sum of two integers or 32-bit overflow in a typed language · fetched 2026-10-14 (*read*)
- **Also good:** [Bit manipulation](https://cp-algorithms.com/algebra/bit-manipulation.html) · cp-algorithms · clearing the right-most set bit with `n & (n - 1)`, Brian Kernighan counting, the power-of-two test and counting set bits up to n; no XOR-cancellation section · fetched 2026-10-14 (*read*)
- **Also good:** [Hamming weight](https://en.wikipedia.org/wiki/Hamming_weight) · Wikipedia · population count definition, the Hamming distance as the weight of an XOR, and mask-and-add implementations · fetched 2026-10-14 (*read*)
- **Our delta:** our pages cover set-bit idioms (`04b`), lowest bit (`04c`), counting bits (`04d`), XOR including single and missing number (`04e`), the 32-bit ceiling (`04g`) and reversing an integer (`11b`); reverse bits and sum of two integers are not worked yet.

### T19-21 · Timing drills — Understand · 🔲 not written
- **Read this:** [LeetCode Tip 32: Minimize the Time You Spend on Each Problem](https://www.redgreencode.com/leetcode-tip-32-minimize-the-time-you-spend-on-each-problem/) · Red-Green-Code · argues neither zero minutes nor never-look is right: use a problem list, read the solution after a reasonable time, then re-try in a day or two via spaced repetition · covers our angle: **partial** - its limit is one to two hours at most for learning, so it is not our 25 and 40 minute interview-pace protocol · fetched 2026-10-14 (*read*)
- **Our delta:** the 25/40 minute limits are our own interview-pace numbers, not sourced; the next-day re-solve matches this page. The previously listed Quora post was a bare link to an answer on Quora, with no argument on the page, and was removed.

### T19-22 · The whiteboard and the editor — Understand · 🔲 not written
- **Read this:** [Coding interview cheatsheet: best practices before, during and after](https://www.techinterviewhandbook.org/coding-interview-cheatsheet/) · Tech Interview Handbook · separate checklists for virtual onsites (shared editor shortcuts, headphones, pen and paper), phone screens and whiteboards (space management), plus talk-while-coding and test steps · covers our angle: **partial** - it advises turning autocompletion on and the webcam off if allowed, the opposite of our no-autocomplete and camera-on drill, so we must say which and why · fetched 2026-10-14 (*read*)
- **Also good:** [zero2sudo's Mock SWE Interview Rubric](https://zero2sudo.substack.com/p/zero2sudos-mock-swe-interview-rubric) · zero2sudo, Substack · suggests practising in an IDE without autocomplete or on a whiteboard or shared doc, with a timer and recordings; written for intern and new-grad interviews · fetched 2026-10-14 (*read*)
- **Our delta:** practising in the interviewer's editor with talking. Related page of ours, partial: `docs/dsa/pages/phase-0-the-interview-and-practice/11-communication-mechanics.md` (shared editor and remote rounds). The HubSpot 2013 post on physical whiteboards was removed as dated and off-topic.

### T20-01 · Interview formats by company type — Master · 🔲 not written
- **Read this:** [Software Engineer interviews: everything you need to prepare](https://www.techinterviewhandbook.org/software-engineering-interview-guide/) · Tech Interview Handbook · lists quiz, online assessment, take-home, phone screen and onsite with a frequency for each; says take-homes are more common at startups and small companies and rare at high-volume large ones, and small private companies prefer your own laptop onsite · covers our angle: **partial** - split by stage with company-size hints, not a table by company type · fetched 2026-10-14 (*read*)
- **Our delta:** the tendencies per company type and the advice to confirm each process. The previously listed Pragmatic Engineer page is only a table of contents of an unfinished book, not chapters, and was removed.

### T20-02 · The twelve-week plan — Master · 🔲 not written
- **Read this:** [Coding interview study plan](https://www.techinterviewhandbook.org/coding-interview-study-plan/) · Tech Interview Handbook · a three-month plan at about 11 hours a week: weeks 1-4 topical study with priorities and hours, weeks 5-12 a 75-question schedule that ends on hards, then self-introduction and mock interviews · covers our angle: **partial** - ranks DP, math and geometry as low priority (we put DP in weeks 5-8) and has no system-design pairing · fetched 2026-10-14 (*read*)
- **Also good:** [Best practice questions](https://www.techinterviewhandbook.org/best-practice-questions/) · Tech Interview Handbook · the older 50-question, 5-week schedule, and a pointer to the 12-week plan · fetched 2026-10-14 (*read*)
- **Our delta:** the week-by-week split here and one HLD plus one LLD per week.

### T20-03 · Daily structure with a full-time job — Master · 🔲 not written
- **Read this:** [Coding interview study plan](https://www.techinterviewhandbook.org/coding-interview-study-plan/) · Tech Interview Handbook · budgets 3 months at 11 hours a week, tells you to break dates left into hours per day, keep the estimate conservative to avoid burnout, and compares breadth-first and depth-first preparation · covers our angle: **partial** - a time budget, not a daily routine, and nothing on what to drop or never drop when a week collapses · fetched 2026-10-14 (*read*)
- **Our delta:** the one-problem-a-day minimum, the fixed review slot, and the drop and never-drop lists. Other pages found (blog posts, forum threads, a coaching vendor) were generic and not listed.

### T20-04 · The last two weeks — Master · 🔲 not written
- **Read this:** [Last-Minute Coding Interview Prep: Senior+ Guide](https://www.tryexponent.com/blog/last-minute-coding-interview-prep) · Aced (formerly Exponent) · final-week checklist: do not learn new algorithms, re-solve old problems, review weak spots, book two to three mocks · covers our angle: **partial** - written as a one-week, senior-level plan, not our per-pattern-per-day sets · fetched 2026-10-14 (*read*)
- **Our delta:** one problem per pattern per day and the when-stuck protocol rehearsed aloud.

### T20-05 · The mock cadence — Understand · ✅ written `docs/dsa/pages/phase-0-the-interview-and-practice/10-mock-interviews.md`
- **Read this:** [zero2sudo's Mock SWE Interview Rubric](https://zero2sudo.substack.com/p/zero2sudos-mock-swe-interview-rubric) · zero2sudo, Substack · eight-dimension rubric with sections on solo, paired and group practice: swap interviewer and candidate roles, time the phases, record sessions, track scores over time · covers our angle: **partial** - calibrated for intern and new-grad rounds, no weekly cadence · fetched 2026-10-14 (*read*)
- **Also good:** [How candidates are evaluated in coding interviews](https://www.techinterviewhandbook.org/coding-interview-rubrics/) · Tech Interview Handbook · four dimensions (communication, problem solving, technical competency, testing) with score bands · fetched 2026-10-14 (*read*)
- **Also good:** [Coding interview study plan](https://www.techinterviewhandbook.org/coding-interview-study-plan/) · Tech Interview Handbook · says to start scheduling mocks about 60 percent of the way through the plan, which is later than our week five · fetched 2026-10-14 (*read*)
- **Our delta:** one mock a week from week five and one feedback item per mock.

### T20-06 · Tracking readiness — Understand · 🔲 not written
- **Read this:** [How many LeetCode problems should I do? Fewer than you think](https://www.educative.io/blog/how-many-leetcode-problems-should-i-do) · Educative blog · a tracking section: a spreadsheet by topic and difficulty, solved alone or with hints, and time per problem · covers our angle: **partial** - the tracking columns match, but there is no readiness threshold; the 75-150 problem range is a vendor claim from a course seller and should not be copied · fetched 2026-10-14 (*read*)
- **Also good:** [zero2sudo's Mock SWE Interview Rubric](https://zero2sudo.substack.com/p/zero2sudos-mock-swe-interview-rubric) · zero2sudo, Substack · suggests documenting scores per dimension over time as a progress measure · fetched 2026-10-14 (*read*)
- **Our delta:** the solve-rate and time-per-medium thresholds that say ready versus feel ready; no source gives a threshold, so state ours as our own.

### T20-07 · The day-of checklist — Understand · 🔲 not written
- **Read this:** [Coding interview cheatsheet: best practices before, during and after](https://www.techinterviewhandbook.org/coding-interview-cheatsheet/) · Tech Interview Handbook · what to do before (introduction, final questions, setup checks for virtual, phone and whiteboard), the six steps during, a closing step with final questions, and a follow-up afterwards · covers our angle: **partial** - no rule on stopping practice the night before · fetched 2026-10-14 (*read*)
- **Also good:** [How candidates are evaluated in coding interviews](https://www.techinterviewhandbook.org/coding-interview-rubrics/) · Tech Interview Handbook · what graders look for, including testing · fetched 2026-10-14 (*read*)
- **Our delta:** the night-before rule and a one-page card. Related page of ours, partial: `docs/dsa/pages/phase-0-the-interview-and-practice/11-communication-mechanics.md` (closing section).

### T20-08 · After a rejection — Understand · 🔲 not written
- **Read this:** [How candidates are evaluated in coding interviews](https://www.techinterviewhandbook.org/coding-interview-rubrics/) · Tech Interview Handbook · one paragraph: interviewers can see earlier feedback, companies want to see growth, so reflect on the reasons and address them before applying again · covers our angle: **partial** - no advice on asking for feedback or on cooling-off periods · fetched 2026-10-14 (*read*)
- **Our delta:** asking for feedback, the cooling-off period and re-entering at the failed pattern. Waiting periods reported online (roughly 6 to 12 months or more) were anecdotes from forums and vendor answer pages, so state them as company-specific and tell the reader to ask the recruiter.

### T20-09 · Contest-style against interview-style — Know · ✅ written `docs/dsa/pages/phase-0-the-interview-and-practice/14-competitive-programming-vs-interviews.md`
- **Read this:** [CPFAQ: How Do Coding Interviews Differ from Coding Contests?](https://www.redgreencode.com/cpfaq-how-do-coding-interviews-differ-from-coding-contests/) · Red-Green-Code · compares format (human collaboration versus verdict), topic range and difficulty · covers our angle: **partial** - it also argues for contests as a long-term habit, whereas our row says contests are for timing practice only · fetched 2026-10-14 (*read*)

### T20-10 · Keeping the edge after the offer — Know · 🔲 not written
- **Read this:** [LeetCode Tip 45: Forgetting and Remembering](https://www.redgreencode.com/leetcode-tip-45-forgetting-and-remembering/) · Red-Green-Code · skills fade through disuse and interference, and thoroughly learned material can be woken up again rather than relearned · covers our angle: **partial** - no weekly maintenance set and no measured decay rate · fetched 2026-10-14 (*read*)
- **Our delta:** the one-problem-a-week maintenance routine; the page does not support the claim that DSA decays measurably in months.
