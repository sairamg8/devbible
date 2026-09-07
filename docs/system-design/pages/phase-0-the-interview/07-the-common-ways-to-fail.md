---
title: "Most failed design rounds fail the same dozen ways — designing before scoping, microservices by reflex, \"we'll use Kafka\" with no reason, a missing write path, no mention of failure, and answering the question that was not asked"
sidebar_label: "07 · The common ways to fail"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07. The failure modes are a **synthesis of how design rounds tend to go wrong**
> — no company's feedback is quoted and no frequency is claimed. Where a mode has a technical fix,
> the fix is the one taught in [03 · The rubric](03-the-rubric.md),
> [05 · The latency ladder](05-the-latency-ladder.md) and [06 · Reading the question](06-reading-the-question.md).
> **No sandbox run.**

**The failures are not exotic, and they are not about missing knowledge. They are a dozen habits
that produce a blank line on the rubric, and each one has a sentence that repairs it.** Designing
before scoping leaves the requirements line empty. Microservices by reflex, and "we'll use Kafka"
with no reason, leave the trade-off line empty and invite a follow-up you cannot answer. Forgetting
the write path leaves a diagram that cannot explain what happens when the user taps Buy. Never
mentioning failure leaves the scale-and-failure line empty. Answering the question that was not
asked wastes the deep dive. The value of naming them is that every one of them is *visible from
the inside* while it is happening — at the summaries — and repairable in one sentence if you know
what to say.

## The catalogue

Each entry: what it looks like from the interviewer's chair, why it happens, and the sentence that
repairs it mid-round.

**1 · Designing before scoping.** *Looks like:* boxes at minute two; the interviewer supplies the
scale later, unasked. *Why:* the question sounded familiar and a remembered design was available.
*Repair:* "Let me step back and confirm the scope: the feed and posting, ten million daily users,
one region — is that the slice you want?" (See [06](06-reading-the-question.md).)

**2 · Microservices by reflex.** *Looks like:* a service per noun on the first diagram, with no
number that required it. *Why:* it is what production diagrams look like, so it is what a design
is assumed to look like. *Repair:* "At this scale a modular monolith behind one deployment is
enough; I'd split out the two paths with different scaling — search and media processing — and keep
the rest together. Each split is a network hop and an operational cost, so I want a reason per
split."

**3 · "We'll use Kafka" with no reason.** *Looks like:* a queue or a log on the board because the
question said "at scale". *Why:* the technology's name substitutes for the requirement it serves.
*Repair:* "I put a log here because two consumers need the same order events; if it were one
consumer I'd use a queue and save the offset management." A named technology owes a named
requirement.

**4 · Forgetting the write path.** *Looks like:* caches, replicas and a CDN for reads, and no
account of what happens when the user *changes* something. *Why:* reads are where the scale
numbers are, so the design follows the numbers. *Repair:* "Let me trace the write: the user taps
Buy, the order service opens a transaction, reserves stock, writes the order and the outbox row,
commits, and then the payment call happens outside the transaction." Reads scale; writes are where
correctness lives.

**5 · Never mentioning failure.** *Looks like:* a diagram in which nothing ever goes down.
*Why:* failure does not come up on its own; it has to be walked. *Repair:* "Before the deep dive,
let me walk the diagram for single points of failure: the balancer, the primary, the queue, the
provider, the one region."

**6 · Answering the question that was not asked.** *Looks like:* a deep dive on uploads when the
interviewer said "I care most about the feed". *Why:* the candidate deep-dives on what they know
best. *Repair:* "You mentioned the feed is what matters — I'll go deep there; shall I leave uploads
at the high level?" The interviewer's hint is the agenda.

**7 · Numbers on demand only.** *Looks like:* the interviewer asks "how many writes a second?" and
the candidate computes it then. *Why:* estimation feels like a detour from the design. *Repair:*
do the arithmetic before the first box, out loud, rounded: "a million orders a day is about
twelve a second on average; I'll design the checkout path for ten times that at a sale."

**8 · Names instead of mechanisms.** *Looks like:* "we'd use consistent hashing", "we'd make it
idempotent", and no explanation of how. *Why:* the vocabulary was learned faster than the
mechanism. *Repair:* for the deep dive, describe the row, the key, the state and the failure
between two steps — the level below the name.

**9 · Choices as facts.** *Looks like:* "we'll cache this", "this is eventually consistent", with
no alternative named and no cost. *Why:* the candidate believes stating the right choice is the
point. *Repair:* the trade-off sentence, unprompted: "chose X over Y because Z; we pay with W."

**10 · Defending instead of reversing.** *Looks like:* the follow-up changes a constraint and the
candidate argues the original design still holds. *Why:* the follow-up is heard as criticism.
*Repair:* "With writes at ten times reads, the cache stops paying and I'd change this: …"
Reversing when the reason disappears is the signal.

**11 · Silence.** *Looks like:* two minutes of drawing with no narration; the interviewer cannot
tell whether you are thinking or stuck. *Why:* thinking aloud is unnatural until it is trained.
*Repair:* narrate the box as you draw it — what it is for and what it would break if removed — and
summarise at every ten minutes.

**12 · Running out the clock.** *Looks like:* fifteen minutes of scoping, a rushed diagram, no
deep dive. *Why:* thoroughness in the part that is easy. *Repair:* the time box — five for
requirements, ten for estimation and API, fifteen for the diagram, ten for the deep dive, five to
close — and a willingness to say "I'll assume the rest and move on."

**13 · Designing for a company you do not have.** *Looks like:* a platform for a hundred
engineers presented to an interviewer with a team of six. *Why:* the design copied is the one
from a large company's engineering blog. *Repair:* "With a team this size I'd take the managed
queue and the managed database, and accept their ceilings; the ceilings are far above the
estimate."

**14 · Ignoring cost.** *Looks like:* cross-region replication, a data warehouse and three
caches, with no word about what any of it costs. *Why:* cost feels like an operations concern.
*Repair:* one sentence per expensive box — "cross-zone traffic and egress are where this bill
lives; I'd keep the chatty services in one zone and put a CDN in front of the images."

**15 · Coding in the design round.** *Looks like:* a class or a function on the whiteboard in an
HLD round. *Why:* the design got hard and code was the comfortable place. *Repair:* recognise the
pull as the deep-dive signal and go deep in mechanism, not syntax
(see [02](02-the-three-design-rounds.md)).

## The three that cost the most

Of the fifteen, three account for most of the difference between a hire and a no-hire in senior
loops, because each one blanks a line that senior loops weight heavily:

| Failure | Line it blanks | Why it costs more at senior |
|---|---|---|
| Choices as facts (9) | trade-offs | the line senior loops weight most, and the one only volunteered evidence fills |
| Never mentioning failure (5) | scale and failure | a senior is expected to walk the diagram without being asked |
| Names instead of mechanisms (8) | depth | the deep dive is where the level is decided, and a name is not depth |

The other twelve are costly, but they are also the ones that a good reading and a time box
prevent almost mechanically. These three need the habit built.

## Seeing it from the inside

The catalogue is only useful if the failure is caught while it is happening. Three checkpoints:

- **At the first box.** Have I said the scope back and got a yes? Have I said a number?
  If not: failure 1 or 7 is under way.
- **At each summary** (every ten minutes). Does every box on the board have a requirement behind
  it? Has every choice had its cost said? Have I walked failure? If not: 2, 3, 9 or 5.
- **At the follow-up.** Am I explaining why the design still holds, or what I would change? If
  the former: 10.

The [rubric self-check](03-the-rubric.md) is the same idea from the grader's side; this is it
from the candidate's.

## Gotchas

**★ Symptom: you know the list, and the feedback still says "did not discuss trade-offs."**
Cause: knowing the failure is not the same as having the sentence ready under a clock; the
trade-off habit is built in practice, not recalled in the room. Fix: in every practice session,
say the *chose X over Y because Z, pay with W* sentence out loud for every choice until it is
reflexive; grade yourself on count.

**★ Symptom: over-correcting — ten minutes of scoping questions, then a rushed design.** Cause:
failure 1 avoided so hard that failure 12 arrived. Fix: one question per hidden decision, five
minutes, then assume and move; the reading exists to produce requirements, not to be thorough.

**Symptom: the design has no queue and the interviewer asks "how do fulfilment and analytics get
the order?"** Cause: failure 3 avoided by leaving out a component that was actually required.
Fix: the rule is not "no Kafka"; it is "a technology owes a requirement" — when two consumers need
the same events, the log is justified and you say why.

**Symptom: you walked failure and the interviewer asked "and then what?"** Cause: the walk named
the failures and not the responses. Fix: for each single point, say what happens and what the
user sees — "if the primary dies, the replica is promoted within a minute; writes fail for that
minute and checkout shows a retry; reads keep working from the cache."

**Symptom: the summary sounded like a list of technologies.** Cause: summarising the diagram
rather than the decisions. Fix: summarise in requirements and choices — "so far: three journeys,
read-heavy, one region; chose a log for order events and asynchronous fan-out for the feed; next,
the celebrity case."

**Symptom: you reversed a choice on the follow-up and the interviewer asked why you did not
choose that originally.** Cause: the reversal was not tied to the changed constraint. Fix: say
the trigger explicitly — "at the original ratio the cache paid; at ten times writes it does not,
which is why I'd change it now."

**Symptom: the modular-monolith answer felt junior.** Cause: simplicity presented without the
reasoning that makes it senior. Fix: say the splits you would make first and the trigger for each
— "search and media get their own services because they scale differently; everything else stays
together until a team boundary or a scaling difference forces a split."

## Interview questions

**★ What are the most common ways a system design round fails, and which cost the most?**
Designing before scoping, microservices by reflex, a technology named without a requirement, a
missing write path, failure never mentioned, the deep dive on the wrong component, numbers only on
demand, names instead of mechanisms, choices stated as facts, defending instead of reversing,
silence, running out the clock, designing for a company you do not have, ignoring cost, and
coding in an HLD round. The three that cost most in senior loops are choices as facts, failure
never walked, and names instead of mechanisms, because each blanks a rubric line that senior
loops weight heavily and that only volunteered evidence fills.

**★ Why is "we'll use Kafka" graded badly even when Kafka is the right choice?**
Because the technology's name has substituted for the requirement it serves, so the interviewer
cannot tell whether the choice was reasoned. The repaired form names the requirement and the cost:
"a log, because two consumers need the same order events; we pay with offset management and a
cluster to run — with one consumer I'd use a queue." The same design, reasoned, fills the
trade-off line; unreasoned, it invites a follow-up ("why not a queue?") that the candidate cannot
answer.

**What does forgetting the write path look like, and how do you catch it?**
A diagram full of caches, replicas and a CDN, and no account of what happens when the user changes
something. You catch it by tracing one write end to end, out loud, before the deep dive: the user
taps Buy, the order service opens a transaction, reserves stock, writes the order and its outbox
row, commits, then calls the provider outside the transaction. Reads are where the scale numbers
are, which is why designs drift toward them; writes are where correctness lives, which is why the
interviewer asks.

**Why is microservices-by-reflex a failure rather than a preference?**
Because each service boundary is a network hop on the latency ladder, an operational cost the team
pays, and a place where a transaction can no longer be atomic — and none of that is justified by a
question that gave no number requiring it. The senior answer starts from one deployable, names the
two or three paths with genuinely different scaling or ownership, splits those, and states the
trigger for further splits. That answer is more sophisticated than the reflex, not less.

**How do you recover mid-round when you realise you have been designing the wrong thing?**
Say so, briefly, and re-scope: "I've been designing uploads and you said the feed matters — let me
leave uploads at the high level and go deep on fan-out." Interviewers grade the recovery well,
because noticing and redirecting is exactly the judgement the round is looking for, and a
candidate who ploughs on is graded worse than one who lost five minutes and corrected.

**What is the difference between a summary that helps and one that hurts?**
A helpful summary restates requirements and decisions — journeys, numbers, the choices made and
their costs, and what comes next — so the interviewer hears the reasoning and can redirect. A
harmful one lists the technologies on the board, which restates the diagram and adds nothing.
Summarise in decisions, every ten minutes, in a sentence or two.

**When is a simple design the senior answer, and how do you present it so it does not read as
junior?**
When the numbers do not require more, which is most of the time at the scale interviews state.
Present it with the reasoning that makes it senior: the splits you would make first and why
(different scaling, different ownership), the trigger for each further split, and the managed
services you would take with their ceilings stated. "A modular monolith, with search and media
split out, on managed PostgreSQL and a managed queue, until a team boundary forces the next
split" is a senior sentence; "just a monolith" is not.

---

← Prev: [06 · Reading the question](06-reading-the-question.md) · Index: [Phase 0 — What system design interviews test](README.md) · Next → **Why a reasoned wrong answer beats a memorised right one** *(not written yet)*
