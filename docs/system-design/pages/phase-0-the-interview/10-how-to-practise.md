---
title: "Practice is timed drills on the canonical questions, mocks graded against the rubric by a peer, recordings of yourself, and a written post-mortem per session — reading designs is not practice"
sidebar_label: "10 · How to practise"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07. Method, not a quoted standard; interview-format observations are
> tendencies. The rubric graded against is [03 · The rubric](03-the-rubric.md); the question bank
> is the [HLD catalogue](../../syllabus/12-the-hld-catalogue.md); the study method for each system
> is [08 · Reasoned beats memorised](08-reasoned-wrong-beats-memorised-right.md). **No sandbox run.**

**Reading system designs feels like preparation and produces almost none of the behaviours the
round grades. The behaviours — scoping under a clock, estimating out loud, walking failure, saying
trade-offs unprompted, taking hints — are motor habits, and motor habits are built by doing the
thing under conditions close to the real one and then reviewing the recording.** Four practices
do it: timed solo drills on the canonical questions, mock interviews with a peer who grades against
the rubric and changes a constraint mid-round, recordings you watch back, and a written post-mortem
after every session that names the rubric line you missed and the sentence that would have filled
it. Two sessions a week for two months builds the habits; the same hours spent reading builds
familiarity, which is what the follow-up exposes.

## The four practices

| Practice | What it builds | Cadence |
|---|---|---|
| **Timed solo drill** | the time box, the reading, estimation out loud, the diagram with numbered flows | 45 minutes, two or three a week |
| **Peer mock, graded** | the follow-up reflex, hint-taking, the trade-off sentence under pressure, communication | one a week, alternating roles |
| **Recording, watched back** | seeing the silences, the rambling, the unasked deep dive, the missing summaries | every mock, and one drill a week |
| **Written post-mortem** | the mistake log — which line was blank and the sentence that would have filled it | after every session, ten minutes |

## The timed solo drill

Pick a question from the catalogue, set 45 minutes, and run the whole method aloud — even alone,
because the point is the speaking. The deliverables at the bell:

- requirements in and out, written
- three numbers with the arithmetic shown
- an API sketch for the main journeys
- a diagram with numbered flows
- a deep dive on one component, with the mechanism a level below the name
- a failure walk
- the trade-off sentence for each choice, said out loud

Then, before looking at any reference design, write the post-mortem (below). Only after that
compare with a canonical design — and compare *chains*, not diagrams: which requirement did they
start from that you did not, and which choice followed from it.

The drill's most important discipline is the clock. A drill that runs to seventy minutes has
practised thoroughness, which is not the skill; the skill is arriving at a deep dive with ten
minutes left. If you consistently run over, the time box is the thing to practise, with a visible
timer and a hard stop at each slice.

## The peer mock, graded against the rubric

A mock with a peer is the highest-value hour in the plan, on two conditions: the peer grades
against the rubric's seven lines with written evidence, and the peer changes a constraint at
least once mid-round. Without the first, the feedback is "seemed fine"; without the second, the
follow-up reflex is never exercised.

The interviewer's brief, for whichever of you is playing it:

1. Give the question with no scale, and answer scoping questions plainly — but say "you decide"
   to at least one, to test assumption-stating.
2. At the high-level design, drop one hint ("what about the write path?") and note whether it
   was taken.
3. After the deep dive begins, change a constraint from the table in
   [08](08-reasoned-wrong-beats-memorised-right.md): the ratio, a celebrity, global, team size,
   a flaky dependency.
4. Ask "why?" once about a choice whose cost was not stated, and note whether the answer came in
   the trade-off form.
5. Write one line of evidence per rubric line, and the level the answer landed at.

Alternate roles. Playing the interviewer is not a lesser use of the hour: it is where you learn
what the blank lines look like from the other chair, and after three or four rounds as
interviewer the habit of generating evidence in your own answers becomes much easier to keep.

## Recording yourself

Watching a recording is uncomfortable and it is the fastest correction available, because the
failures in [07](07-the-common-ways-to-fail.md) are invisible from the inside and obvious from
the outside. What to watch for, with a timestamp for each:

- the first box — how many minutes in, and was the scope said back before it?
- every silence over fifteen seconds — was it announced arithmetic or a stall?
- the summaries — count them; a 45-minute round should have three or four
- the deep dive — was it asked for?
- every choice — was its cost said in the same breath, or only when asked?
- the hint — taken immediately, deferred, or missed?
- the failure walk — did it happen, and where?

One recording a week is enough. The point is not to watch every drill; it is to know what you do
under a clock, which is different from what you think you do.

## The post-mortem

Ten minutes after every session, written, in a fixed shape. Its value compounds: after a month
the log shows which line you *keep* missing, and that is the one to drill.

```text
Date · Question · Format (drill / mock / real)

Blank or weak lines (from the rubric):
  Line 6 — trade-offs: said the cost for the cache, not for the queue or the async fan-out.
  Line 5 — failure: walked the diagram but never said what the USER sees during failover.

The sentence that would have filled each:
  "A log for order events, paid with offset management; with one consumer I'd use a queue."
  "During the minute of failover, checkout shows a retry; browse keeps working from the cache."

Constraint change and how I handled it:
  "Writes 10× reads" — took ~40 s to re-derive; got to "drop the cache, partition by key"
  but did not say the cost (loss of creation-order queries).

The one thing to do differently next session:
  Say the cost in the same breath as every choice — count them on the recording.
```

Illustrative, not a template from any company. The essential fields are the blank lines, the
sentence for each, and the one thing — a post-mortem with five things to fix produces none.

## The question bank and the order

The [HLD catalogue](../../syllabus/12-the-hld-catalogue.md) is the bank. Work it in an order that
builds on itself rather than alphabetically:

1. **The shortener, a rate limiter, a KV store** — small enough that the whole method fits, and
   each has one interesting requirement (ratio, fairness, replication).
2. **The feed, chat, notifications** — fan-out, ordering and delivery guarantees; the questions
   where the celebrity follow-up and the exactly-once follow-up live.
3. **Checkout, payments, ticket booking** — contention, idempotency, money; the storefront's own
   territory and the questions with the richest failure walks.
4. **Video, file sync, maps** — large data and bandwidth; the latency ladder's payload axis.
5. **The India-scale set** — the same systems under burst: flash sales, ticket windows, live
   streams; the questions where designing for the peak versus shedding at it is the point.

Each system gets a drill, a mock, and — per [08](08-reasoned-wrong-beats-memorised-right.md) — a
banked chain and three follow-ups, before the next.

## The plan, in weeks

A cadence that fits beside a job: two 45-minute drills and one mock a week, one recording watched,
every session post-mortemed. Weeks one and two are group 1 above; three and four group 2; five
and six group 3; seven and eight groups 4 and 5 plus repeats of whichever systems the log says
were weakest. The DSA track's [plan](../../../dsa/syllabus/08-the-ladder-and-the-plan.md)
interleaves with this; the senior-loop part gives the combined twelve-week version.

The signal that the plan is working is not that the designs get better — they do, but that is the
smaller effect. It is that the post-mortems get shorter, because the blank lines stop appearing.

## Gotchas

**★ Symptom: months of reading, and the first mock exposed every failure in
[07](07-the-common-ways-to-fail.md).** Cause: reading builds familiarity with designs and none of
the motor habits the round grades. Fix: switch the hours to drills and mocks; keep reading only as
the comparison step after a drill, chains not diagrams.

**★ Symptom: mocks with a friend that always "went fine."** Cause: no rubric, no written
evidence, no constraint change — the mock was a conversation. Fix: give the peer the interviewer's
brief above; insist on one line of evidence per rubric line and at least one mid-round constraint
change.

**Symptom: drills that run to seventy minutes.** Cause: thoroughness practised instead of the
time box. Fix: a visible timer with a hard stop per slice; arriving at the deep dive with ten
minutes left is the skill, and the only way to learn it is to be cut off a few times.

**Symptom: the post-mortem says "be better at trade-offs."** Cause: the fix named as a quality,
not a sentence. Fix: write the exact sentence that would have filled the line — "a log, paid with
offset management" — and the one behaviour for next session; a post-mortem you cannot act on
tomorrow is not one.

**Symptom: the same rubric line blank for a month.** Cause: the log was written and not read.
Fix: read the last four post-mortems before every session and drill the repeated line
specifically — a session where the *only* goal is to say every cost unprompted.

**Symptom: you never play the interviewer.** Cause: it feels like the lesser half of the hour.
Fix: alternate; after a few rounds grading someone else, the blank lines become visible in your
own answers while they are happening.

**Symptom: the recording was too painful to watch and you stopped.** Cause: watching for
overall impression instead of for specific timestamps. Fix: watch with the checklist above and a
pen — first box, silences, summaries, the ask, the costs, the hint, the failure walk — and skip
everything else.

## Interview questions

**★ How should someone prepare for system design rounds, and why does reading designs not
work?**
Timed solo drills on the canonical questions, peer mocks graded against the rubric with a
constraint changed mid-round, recordings watched with a checklist, and a written post-mortem after
every session naming the blank rubric line and the sentence that would have filled it. Reading
does not work because the round grades behaviours — scoping under a clock, estimating aloud,
walking failure, stating costs unprompted, taking hints — and those are motor habits built only by
doing the thing under realistic conditions and reviewing the result.

**★ What makes a mock interview useful rather than a conversation?**
A peer who grades against the seven rubric lines with a written line of evidence each, who says
"you decide" to at least one scoping question, drops a hint and notes whether it was taken,
changes a constraint after the deep dive starts, and asks "why?" about a choice whose cost was not
stated. Alternating roles matters too: grading someone else is how the blank lines become visible
in your own answers.

**What goes in a post-mortem, and what makes one useless?**
The blank or weak rubric lines, the exact sentence that would have filled each, how the
constraint change was handled and how long the re-derivation took, and one thing to do
differently next session. A useless one names qualities ("be better at trade-offs") instead of
sentences, lists five things to fix, and is never read again; the value is in the log showing
which line repeats, and in reading the last few entries before each session.

**In what order should the canonical questions be practised?**
Small systems with one interesting requirement first — the shortener, a rate limiter, a KV store —
so the whole method fits in the time box; then fan-out and delivery — feed, chat, notifications;
then contention and money — checkout, payments, booking; then large data — video, file sync,
maps; then the same systems under burst. Each system gets a drill, a mock, a banked chain and
three follow-ups before the next.

**What should you look for when watching a recording of yourself?**
Timestamps, not impressions: when the first box appeared and whether the scope was said back
before it; every silence over fifteen seconds and whether it was announced; the number of
summaries; whether the deep dive was asked for; whether each choice's cost was said in the same
breath; whether the hint was taken at once; where the failure walk happened. One recording a
week, with the checklist and a pen.

**How do you know the practice is working?**
The post-mortems get shorter. Designs improve too, but the larger effect is that the blank
rubric lines stop appearing, the re-derivation after a constraint change gets faster, and the
recordings show summaries and cost-statements arriving without effort. When the log shows the
same line blank for a month, the practice is not working on that line and a session dedicated to
it alone is the fix.

---

← Prev: [09 · Communication mechanics](09-communication-mechanics.md) · Index: [Phase 0 — What system design interviews test](README.md) · Next → **Whiteboard and remote tooling** *(not written yet)*
