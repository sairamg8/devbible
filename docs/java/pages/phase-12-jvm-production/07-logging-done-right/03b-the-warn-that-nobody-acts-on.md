---
title: "A WARN that nobody has ever acted on is not a low-priority signal, it is a permanent lie in your log, and the reason services accumulate thousands of them is that raising a level is a private decision while lowering one feels like removing a safety net"
sidebar_label: "03b · The WARN nobody acts on"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the **Logback manual, "Architecture"** for level semantics and the
> basic selection rule ([logback.qos.ch](https://logback.qos.ch/manual/architecture.html)), the
> **SLF4J FAQ** on Markers as an alternative to additional levels
> ([slf4j.org](https://www.slf4j.org/faq.html)), and the **Spring Boot 4.1 reference, "Logging"**
> for `logging.level.*` and log groups
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/features/logging.html)).
> 🔴 **No sandbox.** No counts, rates or volumes on this page are measurements; the arithmetic is
> presented as arithmetic.
> JDK 25 · Spring Boot 4.1.0 · SLF4J 2.0.18 · Logback 1.5.34.

**Every service of a certain age has a set of WARN lines that fire constantly and that everyone has
learned to scroll past. They are not harmless. They are the reason nobody notices the new WARN
that matters, and they got there through a ratchet: raising a line's level is a small local
decision that any developer can make alone, while lowering one requires arguing that a warning is
unnecessary — so the level only ever goes up.**

## Why the ratchet only turns one way

Consider the incentives on a single line of code, one review at a time.

**Raising a level is cheap and defensible.** "I could not see this in production, so I moved it
from DEBUG to WARN." Nobody objects. The change is one word, it is local, and it makes the
author's next investigation easier.

**Lowering a level is expensive and looks reckless.** "I moved this from WARN to DEBUG." Now the
reviewer has to decide whether the warning was protecting against something. The safe answer is
always to leave it. Nobody was ever blamed for a warning that stayed.

🔴 **A ratchet with no release accumulates.** Over two years a service acquires dozens of these,
and because each one arrived alone, no single change ever looked like a mistake. The damage is
entirely emergent and entirely predictable.

## The arithmetic of an ignored warning

Suppose a line fires on 5% of requests. It is a WARN because a retry succeeded and someone wanted
visibility. That is not a rare event — it is one in twenty, which on any real traffic level means
it is the dominant contributor to the WARN stream.

Now a genuinely new WARN appears — a connection pool nearing exhaustion, once a minute. It is
outnumbered by the known-noise line by whatever ratio your traffic implies. **Nobody sees it**, not
because it is hidden, but because the reader has already learned that WARN is a channel they can
skim.

**The important number is not the volume. It is the ratio of actionable to non-actionable lines at
that level.** Once it is far below one, the level has stopped carrying information regardless of
how many lines it contains.

## Alert fatigue is a design failure, not a discipline failure

The usual framing is that people should read their logs more carefully. That is not a fixable
property of people. What is fixable is the *contract* of the level.

If WARN means *"the fact this happened changes what someone would investigate"* — the test from
[03](03-levels.md) — then a line that has never once changed anyone's investigation is
mislabelled. It is not a low-priority warning. It is an INFO or DEBUG that is wearing a WARN's
clothes, and it is spending the WARN level's credibility to do it.

🔴 **The rule that keeps the level honest: every WARN and every ERROR must have a defensible
answer to "what does the reader do about this?"** Not "be aware of it" — an action. Investigate
what? Change what? Escalate to whom? A line with no answer belongs at a lower level.

## The four patterns that produce noise WARNs

**1 · Retry-succeeded logging.** A retry that worked is the resilience layer doing its job. Logged
at WARN it fires proportionally to your dependency's normal flakiness. The right shape is a
*counter* of retries with a tag for the outcome — **08 · Metrics with Micrometer**
*(not written yet)* — plus a WARN only when retries are *exhausted*, which is final and
actionable.

**2 · Expected-absence logging.** "No configuration found for X, using default." True on every
startup and every request where the optional thing is absent. It is INFO once at startup, and
nothing at all per request.

**3 · Third-party chatter promoted wholesale.** A library logs at WARN for conditions that are
normal in your usage — a driver warning about a feature you deliberately do not use, a client
warning about a header you deliberately omit. The fix is a targeted level override on that
logger, not a global one:

```properties
# The driver warns on every connection about a feature we do not use.
logging.level.com.vendor.driver.FeatureNegotiator=ERROR
```

⚠️ **Silencing a third-party logger is a decision with a shelf life.** Write down *why* in the
properties file next to the line. A year later, nobody will remember whether that override is
still justified, and an unexplained silencer is how a real warning gets suppressed for two years.

**4 · Defensive WARN in a branch that is actually normal.** `if (list.isEmpty()) log.warn("empty
result")` — written when empty was surprising, still there after empty became routine. This is the
one that requires reading the code to detect, and the one most likely to be genuinely stale.

## Markers: escalation without inventing levels

When a subset of ERRORs genuinely deserve different handling, the SLF4J answer is not a sixth
level. From the FAQ:

> *"The Marker interface, part of the `org.slf4j` package, renders the FATAL level largely
> redundant. If a given error requires attention beyond that allocated for ordinary errors, simply
> mark the logging statement with a specially designated marker which can be named 'FATAL' or any
> other name to your liking."*

```java
private static final Marker PAGE = MarkerFactory.getMarker("PAGE");

log.error(PAGE, "Ledger write failed for transfer {}; balances may be inconsistent", transferId, ex);
```

**Why this is better than a level.** Levels are a single ordered scale, so every escalation
concept has to be squeezed onto it. Markers are an open set: `PAGE`, `AUDIT`, `SECURITY`,
`BILLING` can each be routed independently by a Logback filter or picked out in the aggregator.
Boot's structured formatters surface markers in the JSON — the ECS formatter emits them under
`tags` ([05b](05b-wiring-json-in-spring-boot.md)) — so a marker is queryable, not just decorative.

## Cleaning up an existing service

The work is boring and mechanical, which is why it never gets scheduled. It is also cheap.

1. **Count by message shape, not by line.** Group the last week's WARN and ERROR output by the
   *parameterised* message template — the `{}` form, not the interpolated result. Structured
   logging makes this trivial because the template can be its own field
   ([05](05-structured-json.md)); with prose it needs normalisation.
2. **Sort descending.** The top five templates are almost always the entire problem.
3. **For each, ask the action question.** What did anyone do about this, ever? If the answer is
   nothing, it moves down a level or becomes a metric.
4. **Convert rate questions to counters.** Anything whose value is "how often" is a metric, and
   converting it removes the volume *and* answers the question better.
5. **Leave a comment where you silence something**, with the reason and the date.

🔴 **Do this before you build alerting on log levels, not after.** An alert on "WARN rate" built on
top of an unexamined WARN stream is an alert on your dependency's baseline flakiness, and it will
be muted within a month — after which it is worse than no alert, because it exists and is trusted
by nobody.

## Gotchas

**★ The level ratchet only turns up.**
Raising a level is a small local decision any developer can make; lowering one requires arguing a
warning is unneeded. Nothing in normal review pushes back, so levels drift upward monotonically
until the top two carry no information.

**★ "Be aware of this" is not an action, and a line whose only purpose is awareness is not a WARN.**
The test is what the reader *does*. Investigate what, change what, escalate to whom. No answer
means the level is wrong.

**★ Logging successful retries at WARN makes your WARN rate a graph of someone else's flakiness.**
It fires proportionally to normal dependency behaviour. Count retries as a metric; warn only when
retries are exhausted, which is final and actionable.

**★ Alerting on WARN rate before cleaning up WARNs produces an alert that gets muted.**
And a muted alert is worse than no alert, because it appears on the runbook and nobody trusts it.
Clean first, then alert.

**★ Silencing a third-party logger without recording why creates a permanent blind spot.**
The override outlives everyone's memory of the reason. A year later nobody can tell whether it is
still justified, and removing it feels risky, so it stays forever.

**★ Grouping by interpolated message hides the pattern.**
`"Retry 3 failed for order 8891"` and `"Retry 3 failed for order 8892"` are the same line. Counting
by the parameterised template is what makes the top-five list meaningful — another argument for
structured logging, where the template can be a field.

**★ Inventing a FATAL level instead of using a Marker.**
Levels are one ordered scale; escalation is not one-dimensional. Markers are an open set, are
routable by filter, and appear in Boot's structured output (as `tags` in ECS), which makes them
queryable rather than cosmetic.

**★ A WARN in a branch that used to be surprising and is now routine.**
The defensive `log.warn` on an empty result, written when empty meant a bug. Nothing signals that
it has gone stale; only reading the code finds it, which is why the periodic top-templates review
is the practical detector.

## Interview questions

**★ Why do log levels drift upward in a long-lived codebase?**
Because the two directions have asymmetric review costs. Raising a level is a one-word change with
an obvious justification — "I could not see this in production" — that no reviewer pushes back on.
Lowering one requires asserting that a warning is unnecessary, which nobody wants to be wrong
about. Each individual change is defensible; the aggregate over two years is a WARN stream nobody
reads. It is a ratchet, and the only release is a deliberate periodic review.

**★ What is the single test that decides whether something belongs at WARN?**
Whether the fact that it happened changes what someone would investigate later. Not whether it is
interesting, not whether it is unusual — whether it has consequences for a future diagnosis. A
concrete version: name the action. If the only honest answer is "be aware of it", the line is an
INFO or a DEBUG, and putting it at WARN spends the credibility of the whole level.

**★ A service emits thousands of WARNs a day and the team ignores them. How do you fix it?**
Group a week of output by parameterised message template rather than by rendered line, sort
descending, and work the top five. For each, ask what anyone has ever done about it. Retry-success
lines become a counter with an exhausted-retries WARN kept. Expected-absence lines drop to INFO at
startup or disappear. Third-party chatter gets a targeted level override with a written reason and
a date. Only after the ratio of actionable to non-actionable lines is sane is it worth building an
alert on the level at all.

**★ Why is alert fatigue a design problem rather than a discipline problem?**
Because you cannot fix it by asking people to read more carefully — attention is a fixed resource
and the ratio of noise to signal is what determines whether anything is noticed. What you can fix
is the contract: define each level by who acts, enforce that every line at WARN or ERROR has a
defensible action, and demote everything else. That changes the ratio, which is the only variable
that actually moves the outcome.

**★ You have errors that need paging and errors that do not, but you only have five levels. What
do you do?**
Use a Marker. SLF4J's position is that Markers make FATAL redundant: log at ERROR and attach a
named marker such as `PAGE`, then route on the marker in the backend or the aggregator. This beats
a sixth level because escalation is not one-dimensional — you can have `PAGE`, `AUDIT` and
`SECURITY` markers filtered independently, whereas a single ordered scale forces every escalation
concept into one axis. Boot's structured formatters emit markers into the JSON, so they are
queryable downstream too.

**★ Is there ever a good reason to keep a WARN that nobody acts on?**
Rarely, and it should be argued explicitly rather than by default. The defensible case is a line
that is silent in healthy operation and only ever fires during an incident, where "nobody has
acted on it" means "it has never fired". That is a completely different situation from a line
firing on 5% of requests, and the top-templates review distinguishes them immediately — one is at
the top of the list, the other is not on it at all.

{/* FOOTER */}
