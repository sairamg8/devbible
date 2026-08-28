---
title: "Twelve concrete scenarios with an answer for each — because the useful form of this question is never abstract"
sidebar_label: "9 · Choosing, in scenarios"
sidebar_position: 13
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 — this chunk applies the facts established and sourced in chunks 1–8;
> its claims about the runtimes are the ones verified there against
> [docs.python.org/3.14](https://docs.python.org/3.14/) and
> [nodejs.org/api](https://nodejs.org/api/).
> Targets: **Python 3.14.7** · **Node.js 24 LTS**.

**Nobody in a design review asks "Python or Node". They ask "what do we build the
recommendation service in", and the honest answer changes with the service. This chunk is
the topic's payoff: a set of concrete situations, the answer for each, and — more
usefully — the one fact that decides it, so you can recognise the shape of a new situation
rather than memorising a table. The recurring pattern is that the deciding fact is almost
never speed and almost always a library, a team boundary, or a concurrency requirement.**

## The scenarios

### 1. A CRUD API over Postgres for an internal tool
**Either.** The decider: what the team already ships. There is no technical distinction
worth the meeting — both are an event loop, a connection pool and a proxy. Pick the
language your on-call rotation can debug at 3am.

### 2. A service that scores a scikit-learn model per request
**Python, and it is not a discussion.** The decider: the model artefact is a pickled
Python object and the library that loads it is Python. Even a Node-first organisation
should stand this up as a Python service behind HTTP.

### 3. Server-side rendering for a React application
**Node.** The decider: SSR executes the component code, and the component code is
JavaScript. There is no Python answer; a Python "solution" ends up shelling out to Node.

### 4. A CLI that engineers install and run hundreds of times a day
**Slight edge to Node, or neither — write it in Go or Rust.** The decider: startup cost.
Python's import graph is paid on every invocation
([11 · Startup and import cost](../11-startup-and-import-cost/README.md)), and PEP 810's
lazy imports land in 3.15. If it must be Python, keep imports lazy and measure with
`python -X importtime`.

### 5. A WebSocket service holding 50,000 concurrent connections
**Either, with care.** The decider: both are one event loop per process, so both handle it
and both die to one blocking call. Node has slightly more mature socket-library ergonomics;
Python has `asyncio` plus the option of `uvloop`. What actually decides it is whether your
message handlers do CPU work — if they do, plan the offload
([chunk 2b](02b-node-parallelism.md), [chunk 3](03-python-model.md)) before you choose.

### 6. An ETL job transforming 50 GB of CSV nightly
**Python.** The decider: Polars, DuckDB and pandas. This is the dataframe case, and the
JavaScript alternatives are not in the same category. Bonus: the transformation stays in
the same language as whatever analysis consumes it.

### 7. A BFF (backend-for-frontend) for a React app, owned by the frontend team
**Node.** The decider: team boundary. Shared types, one package manager, one toolchain, and
a layer whose job is reshaping data for a JavaScript client. This is the strongest genuine
case for Node in this list after SSR.

### 8. A serverless function on a strict cold-start budget
**Node, probably — but measure.** The decider: import cost again, and it depends entirely
on your dependency graph. A Python function importing `boto3` and `pandas` starts slowly;
one importing `json` and `httpx` may be fine. Measure with `-X importtime` rather than
assuming.

### 9. A long-running worker doing CPU-heavy pure-Python computation
**Python, with the right model.** The decider: the work is already written in Python, and
the answer is `ProcessPoolExecutor`, a C or Rust-backed library, or a free-threaded 3.14
build — not a language change. See [chunk 3](03-python-model.md). If it were being written
from scratch and the computation were the whole product, Go or Rust would beat both.

### 10. A team of two shipping an MVP with a browser UI
**Node.** The decider: one language across the stack is a genuine, measurable win at that
size. It stops being decisive once the backend team is separate or a mobile client appears.

### 11. Migrating a Django monolith that is "too slow"
**Neither — profile it.** The decider: it is almost certainly the database. See
[chunk 7](07-performance.md). A rewrite that appears to fix performance has usually fixed
an N+1 query, and would have done so in any language. Extracting the genuinely hot
endpoint into its own service is the intermediate step nobody takes and everyone should.

### 12. A data pipeline whose consumers are analysts
**Python.** The decider: the analysts already write Python. Handing them a pipeline in a
language they cannot read makes you the permanent maintainer of it.

## The pattern underneath

Reading the twelve back, four deciders account for all of them:

| Decider | Scenarios | How it resolves |
|---|---|---|
| **A library that exists in one ecosystem only** | 2, 3, 6, 12 | Decisive. No negotiation. |
| **Team and ownership boundary** | 7, 10, 12 | Usually decisive for small teams. |
| **A runtime property — startup, concurrency shape** | 4, 5, 8, 9 | Real, but usually measurable — go measure. |
| **Neither; the premise is wrong** | 1, 11 | The most valuable answer in a design review. |

Note what is absent: **raw execution speed decides none of them.** It appears inside
scenario 9 and it loses even there, to "use the right model within Python". That is not
Python advocacy — it is what falls out of the fact that backends wait on networks.

## The answer to give in an interview

Compressed to the length of an actual answer:

> "It depends on three things, in order. First, does the domain have a library that only
> exists in one of them — anything ML, data or scientific is Python, anything that renders
> a React tree is Node, and those are decisions rather than preferences. Second, does the
> same team own the frontend, because one language across the stack is a real win at small
> scale. Third, the concurrency shape: both are single-threaded event loops, but Python
> also offers threads, processes and, since 3.14, free-threaded builds, which is more
> headroom and more ways to get it wrong. What I would not decide it on is speed —
> for an I/O-bound backend the database dominates, and Python's hot paths are C anyway."

That answer names a mechanism, concedes the other side, and does not pretend the question
has one answer. If they push on any clause, chunks 3, 5 and 7 have the depth.

## Gotchas

### Making it a company decision instead of a service decision
**Symptom.** A long architecture debate about "our language", followed by a policy nobody
can follow when the ML team arrives.
**Cause.** Framing at the wrong level.
**Fix.** Decide per service; let services talk over HTTP or a queue. Budget for the
pluralism honestly — two CI pipelines, two dependency-audit stories, two on-call runbooks —
and note that it is still cheaper than writing a dataframe pipeline in JavaScript.

### Choosing on a benchmark
**Symptom.** A decision document whose central exhibit is a requests-per-second chart.
**Cause.** The chart is measurable and the real deciders are not.
**Fix.** Ask what the chart measured. If there was no database in it, it measured a program
you will never ship ([chunk 7](07-performance.md)).

### Ignoring who maintains it in two years
**Symptom.** A service written in the language one departed engineer preferred.
**Cause.** Optimising for the build, not the decade after it.
**Fix.** Weight the hiring pool and the existing team's fluency as heavily as any technical
factor. It is the single best predictor of whether the service is still healthy later.

### Letting "we might need ML later" pick the language now
**Symptom.** A CRUD service in Python, staffed by a JavaScript team, on the strength of a
model that never arrives.
**Cause.** Speculative generality.
**Fix.** Build the CRUD service in whatever the team knows. When the model arrives, it gets
its own Python service — which is the correct architecture regardless of what the rest is
written in.

### Treating polyglot as free
**Symptom.** Two languages, and a small platform team maintaining two of everything —
base images, CI templates, dependency scanning, tracing setup, release tooling.
**Cause.** Counting only the service-level cost.
**Fix.** Count it honestly and then decide. It is often worth paying, but it is not zero,
and the team that pretends it is ends up with one language's tooling well-maintained and
the other's neglected.

## Interview questions

**Q. Walk me through choosing between Python and Node for a new service.**
A. Three questions in order: does the domain have a library that exists in only one
ecosystem — ML, data and science are Python, React SSR is Node, and both are decisions
rather than preferences. Does the same team own the frontend, because one language is a
real win at small scale. And can we live with the concurrency model — both are event loops,
but Python also gives threads, processes and free-threaded builds. I would not decide on
speed, because an I/O-bound backend is dominated by the database.

**Q. Your company standardised on Node and a team needs to serve an ML model. What do you
say?**
A. That the standard should be "one language per service, chosen from a short list", not
"one language". The model service is Python, deployed behind HTTP or gRPC like any other
service, and the standardisation benefit — shared CI, shared observability, shared base
images — is preserved by standardising the *platform*, not the language.

**Q. When is "it depends" a bad answer to this question?**
A. When it is not followed by what it depends on. The good version names the deciders —
library availability, team boundary, concurrency shape — and then commits to an answer for
the case at hand. The bad version stops at "it depends" and never lands.

**Q. Give me a case where you would pick Node over Python even though the backend team
prefers Python.**
A. A backend-for-frontend layer owned by the frontend team, or anything requiring
server-side rendering. In both, the JavaScript boundary is structural: SSR needs a JS
runtime, and a BFF's whole value is shared types with the client. Overriding that on
backend-team preference costs more than it saves.

**Q. And the reverse — Node team, Python answer?**
A. Anything touching a dataframe, a model or a scientific computation. The library gap is
decades of C, Fortran and CUDA with no JavaScript equivalent, and the correct move is a
separate Python service rather than a JavaScript reimplementation.

**Q. How would you handle a team that wants to rewrite a slow Python service in Node?**
A. Ask for the profile first. In my experience the time is in the database — an N+1, a
missing index, a synchronous driver on an async handler — and all three are fixable in
place, in days. If the profile genuinely shows pure-Python CPU on the critical path, the
next steps are a C or Rust-backed library, a process pool, or a free-threaded build. A
rewrite is the last option, and it should be justified against a profile rather than a
benchmark blog post.

**Q. What is the cost of running both languages in one organisation?**
A. Two of everything at the platform layer: base images, CI templates, dependency
scanning, tracing instrumentation, release tooling, and two sets of idioms for on-call.
That is real and worth budgeting. It is usually much smaller than the cost of forcing one
of the two structural cases — ML in JavaScript, or SSR in Python — into the wrong
ecosystem.

---

← Prev: [Alternative implementations](08-alternatives.md) · Index: [Python vs Node](README.md) · Next → [Startup and import cost](../11-startup-and-import-cost/README.md)

{/* FOOTER */}
