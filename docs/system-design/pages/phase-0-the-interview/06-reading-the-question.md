---
title: "The ambiguity is deliberate — \"design Instagram\" is a test of whether you ask which part, for how many users, with what freshness, before you draw a box"
sidebar_label: "06 · Reading the question"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07. The reading protocol is method, not a quoted standard; where it leans on a
> definition the source is the Google SRE book,
> [*Service Level Objectives*](https://sre.google/sre-book/service-level-objectives/), and the
> vocabulary on [04 · The vocabulary contract](04-the-vocabulary-contract.md). Interview-format
> observations are tendencies, never statistics. **No sandbox run.**

**A design question is underspecified on purpose. The interviewer has a scope in mind, and the
first thing they grade is whether you go and find it or start drawing against a scope you
invented.** "Design Instagram" is not a request for Instagram; it is a request to discover which
slice — the feed, uploads, the social graph, stories, search — for how many users, with what
freshness and what failure tolerance, and then to design *that*. The reading takes about five
minutes and produces the requirements line of the rubric, the numbers the estimation needs, and
the out-of-scope list that stops you designing three systems in one. Skipping it is the single
most common way a technically strong candidate fails: the design was good, and it was for a
different question.

## What the question is hiding

Every design prompt hides at least these decisions, and each one changes the diagram:

| Hidden decision | The question that surfaces it | What changes in the design |
|---|---|---|
| **Which part** | "Which journeys matter most — posting, the feed, following, search?" | which boxes exist at all |
| **For whom** | "Who are the actors — guests, users, creators, admins, partners?" | the auth model, the write paths, the admin surface |
| **How many** | "Roughly how many daily users, and what is the read-to-write ratio?" | replicas, caches, sharding, whether a single store survives |
| **How fresh** | "When I post, how soon must my followers see it — seconds, a minute?" | synchronous vs asynchronous fan-out, cache TTLs, consistency model per journey |
| **How available, how durable** | "What may fail, and what must never be lost?" | which paths are synchronous to replicated storage, what degrades |
| **Where** | "One region, or global?" | replication topology, the latency floor, data residency |
| **What is out** | "Can I leave stories and DMs out of scope?" | the size of the problem, and the evidence for line 1 |
| **What done looks like** | "Do you want the high-level design and one deep dive, or breadth?" | how the 45 minutes are spent |

The order is not arbitrary. *Which part* and *for whom* set the functional requirements; *how
many, how fresh, how available, where* set the non-functional ones; *what is out* bounds them;
*what done looks like* sets the agenda. Asked in that order, the answers fall into the shape of
the method that [phase 1](../../syllabus/01-the-interview-and-the-method.md) teaches.

## The five-minute reading, on "design Instagram"

A worked reading, with the interviewer's answers as one plausible set — the point is the shape of
the questions, not these particular numbers.

- **Restate.** "So: a photo-sharing product where users post images, follow each other, and see a
  feed of what they follow. I'll confirm the slice." *The restatement is cheap and catches the
  case where the interviewer meant something else — a media pipeline, or the social graph.*
- **Which part.** "The feed and posting are the core; I'd treat follow/unfollow as in scope
  because the feed depends on it, and leave stories, DMs and search out. Agreed?" *The
  interviewer says yes, and adds that they care most about the feed.* That sentence is the agenda.
- **For whom.** "Registered users only; no anonymous browsing; creators and ordinary users are the
  same actor for this design." *No admin surface, no partner API.*
- **How many.** "Suppose ten million daily users, each reading the feed a handful of times and
  posting rarely — reads a couple of orders of magnitude above writes. Some accounts have millions
  of followers." *The read-heavy ratio licenses caching; the celebrity accounts are the fan-out
  problem that the deep dive will be about.*
- **How fresh.** "When I post, my followers should see it within a few seconds to a minute; it
  need not be instant. My own post must appear in my own view immediately." *Asynchronous fan-out
  with read-your-writes for the author — a consistency model per journey, chosen from the answer.*
- **How available, how durable.** "A posted image must never be lost; the feed may be a little
  stale or briefly unavailable." *The upload path is synchronous to durable object storage; the
  feed is a cache that can be rebuilt.*
- **Where.** "One region to start; I'll note what multi-region would change." *No cross-region
  replication on the write path; a CDN for images regardless.*
- **What done looks like.** "I'll do the high-level design in about fifteen minutes and go deep
  on feed fan-out — the celebrity case — unless you'd rather I went deep on uploads." *The
  interviewer confirms fan-out.*

Five minutes, and the design is now for one question. Every later box can be traced to one of
these answers, which is what the requirements line of the rubric records.

## The same reading, on the storefront

"Design search for the storefront" hides the same decisions in different clothes:

- **Which part** — keyword search, autocomplete-as-you-type, faceted filtering, or all three? They
  are different systems: autocomplete is a prefix structure with a tiny latency budget, keyword
  search is an inverted index with relevance, facets are aggregations over the result set.
- **For whom** — shoppers only, or also the admin looking up orders? The second is a different
  index with different freshness.
- **How many** — searches per second at the sale peak, and the catalogue size. A catalogue of a
  hundred thousand products fits in one node's memory; a marketplace catalogue of a hundred
  million does not.
- **How fresh** — a new product visible within minutes is easy; a price change visible within a
  second across every search result is a synchronisation problem between the primary and the
  index, and is where the deep dive lives.
- **What is out** — personalised ranking, spell correction, image search.

The answer to "how fresh" is the one most candidates never ask, and it is the one that decides
whether the index is fed by a nightly job, by an outbox, or by change-data-capture from
PostgreSQL. A search design without a stated freshness requirement is a design for a question
nobody asked.

## Reading the words

Some words in a prompt carry a technical meaning the interviewer expects you to unpack, and
using them back without unpacking is graded as not having read the question:

- **"Real-time"** means nothing until you ask: sub-second, a few seconds, or "not batch"? Each is
  a different architecture. Say which you are designing for.
- **"At scale"** means the interviewer wants numbers. Ask for them or state assumptions.
- **"Global"** means multi-region, and therefore the latency floor and data residency; do not
  design one region and call it global.
- **"Consistent"** means one of Jepsen's models, or it means *correct*; ask which invariant they
  care about (see [04](04-the-vocabulary-contract.md)).
- **"Simple" / "for a startup"** means the team is small and the interviewer will penalise a
  design the team cannot run; it is a constraint, not a compliment.
- **"Highly available"** is an adjective until it is a target; translate it — "three nines,
  request-based" — and say the number out loud so it can be corrected.
- **"Exactly once"** is a claim that needs a mechanism; ask whether at-least-once with
  idempotent consumers satisfies them, because it usually does.

## When the interviewer will not answer

Some interviewers reply "you decide" to every scoping question. That is not obstruction; it is a
different test — whether you can make and state assumptions. The response is to decide, say it,
write it on the board, and move: "I'll assume ten million daily users, read-heavy, one region,
feed freshness within a minute; tell me if any of those is wrong." The assumptions are now
requirements the interviewer can redirect, which is all the reading was for. What fails is asking
a fourth question after three "you decide"s, or designing against unstated assumptions the
interviewer never got the chance to correct.

## The time box

The reading takes five minutes and should not take ten. Three questions per hidden decision is
too many; one good one is enough. When the answers are in, say the scope back in two sentences —
functional, non-functional, out — and start estimating. A reading that runs long reads as
stalling, and it steals the minutes the deep dive needs. Phase 1 gives the full budget for the
45 minutes; the reading is its first slice.

## Gotchas

**★ Symptom: a strong design, and the feedback says "solved a different problem."** Cause: no
reading; the scope was assumed from a remembered version of the question. Fix: restate, ask which
part, and get the interviewer's yes before the first box. Thirty seconds of "so the feed is the
core, stories are out — agreed?" is what prevents forty minutes on the wrong system.

**★ Symptom: three systems on the board and none of them deep.** Cause: nothing was put out of
scope, so the design tried to cover posting, feed, search and messaging. Fix: name the
out-of-scope list explicitly and write it down; the interviewer will either accept it — evidence
for the requirements line — or pull something back in, which is information.

**Symptom: "real-time" designed as sub-second when the interviewer meant "within a minute."**
Cause: the word taken at its strongest meaning without asking. Fix: unpack it — "by real-time do
you mean sub-second, a few seconds, or just not batch?" — and design for the answer; the
asynchronous version is cheaper and usually what was meant.

**Symptom: the deep dive is on uploads and the interviewer wanted fan-out.** Cause: "what done
looks like" never asked; the agenda was guessed. Fix: after scoping, name the deep dive you
intend and offer the alternative — "I'll go deep on feed fan-out unless you'd rather uploads."

**Symptom: assumptions in your head, a design that contradicts them on the board.** Cause:
assumptions were made silently, so they could not be corrected or held to. Fix: write assumptions
on the board as you make them; a written "one region" stops you drawing cross-region replication
ten minutes later.

**Symptom: an interviewer's "you decide" answered with another question.** Cause: the scoping
protocol run as a script rather than as a means to requirements. Fix: decide, state, write, move.
Two "you decide"s in a row is the signal to switch from asking to assuming.

**Symptom: the freshness question never asked, and the search index design has no feed
mechanism.** Cause: freshness treated as a detail rather than the decision that picks the
architecture. Fix: ask "how soon must a change be visible?" for every read journey; the answer
chooses between a nightly rebuild, an outbox and change-data-capture.

**Symptom: ten minutes of questions, and the deep dive was cut short.** Cause: thoroughness in
the reading at the cost of the part the loop weights most. Fix: one question per hidden decision,
five minutes, then the scope said back in two sentences and on to estimation.

**Symptom: "global" in the prompt, one region on the board.** Cause: the word read as flavour.
Fix: treat "global" as a requirement — multi-region, a latency floor from the ladder, data
residency — or explicitly scope it out with the interviewer's agreement.

## Interview questions

**★ Why are design questions deliberately ambiguous?**
Because the first thing the round grades is whether the candidate finds the intended scope or
designs against an invented one. The interviewer has a slice in mind — which journeys, for how
many users, with what freshness — and the five minutes of reading are where the candidate shows
they scope before they build. A precisely specified question would test only the design; the
ambiguous one tests the judgement that comes before it, which is the judgement a senior engineer
exercises at work with no interviewer present.

**★ What are the questions you ask before drawing anything, and what does each one change?**
Which part — decides which boxes exist. For whom — the actors, and therefore auth and admin
surfaces. How many — replicas, caches, sharding. How fresh — synchronous versus asynchronous
paths and the consistency model per journey. How available and how durable — which paths are
synchronous to replicated storage and what may degrade. Where — replication topology and the
latency floor. What is out — the size of the problem. What done looks like — how the time is
spent. One question each, five minutes, then the scope said back.

**★ Read "design Instagram" out loud.**
"A photo product: post, follow, feed. Feed and posting are the core; stories, DMs and search are
out. Registered users only. Assume ten million daily users, read-heavy by a couple of orders of
magnitude, with some accounts having millions of followers. A post should reach followers within
a minute and must appear to its author immediately. An uploaded image is never lost; the feed may
be stale or briefly down. One region to start. I'll design the high level in fifteen minutes and go
deep on fan-out for the celebrity case." Every later box traces to one of those sentences.

**What does "how fresh" decide in the storefront's search design?**
The mechanism that feeds the index. Minutes of staleness allows a periodic rebuild or a batch job;
seconds requires the primary to publish changes — an outbox written in the same transaction as the
product update, or change-data-capture from PostgreSQL's log — and a consumer that applies them to
the index. It also decides the deep dive, because the price-change-visible-everywhere case is the
synchronisation problem between two stores, and that is where the interesting failure modes live.

**How do you handle an interviewer who answers "you decide" to every scoping question?**
Recognise it as a different test — of making and stating assumptions — and switch modes after the
second one: decide, say the assumption, write it on the board, and move on. "I'll assume ten
million daily users, one region, freshness within a minute; correct me if any of those is wrong."
Written assumptions are requirements the interviewer can redirect, and they hold you to your own
scope for the rest of the round.

**Which words in a prompt should you never use back without unpacking them?**
"Real-time" (sub-second, seconds, or not-batch), "at scale" (numbers wanted), "global"
(multi-region and its latency floor), "consistent" (which model, or which invariant), "highly
available" (which target, which formula), "exactly once" (which mechanism — usually at-least-once
plus idempotency), and "simple" or "for a startup" (a team-size constraint). Each is either a
question to ask or an assumption to state; echoing the word is graded as not having read it.

**How long should the reading take, and what does running long cost?**
About five minutes: one good question per hidden decision, then the scope said back in two
sentences — functional, non-functional, out. Running to ten minutes reads as stalling and steals
the time the deep dive needs, and the deep dive is where senior loops put the most weight. The
reading's job is to produce the requirements line and the numbers; once it has, estimation starts.

---

← Prev: [05 · The latency ladder](05-the-latency-ladder.md) · Index: [Phase 0 — What system design interviews test](README.md) · Next → [07 · The common ways to fail](07-the-common-ways-to-fail.md)
