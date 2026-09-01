---
title: "Two checklists: one for the log line in front of you in a review, which takes ten seconds, and one for a service's whole logging configuration, which is the thing nobody ever reviews because it was inherited from a template and has never failed loudly enough to be looked at"
sidebar_label: "14 · The checklist"
sidebar_position: 28
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 — this page assembles conclusions established and sourced in the preceding
> chunks of this topic rather than introducing new claims; each item links to the page carrying
> its evidence. The underlying sources are the **SLF4J** and **Logback** documentation and
> sources, the **Spring Boot 4.1** logging and Actuator references, the **OWASP Logging Cheat
> Sheet**, **PCI DSS v4.0** and **GDPR** Articles 5 and 32.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**A Master-tier topic earns its tier by being usable under pressure. These are the two artefacts
worth keeping: a review checklist short enough to actually apply to a single line, and a
configuration audit for the settings that were inherited rather than chosen — which is where the
expensive defects live, because nothing about them ever fails visibly.**

## Checklist A — the log line in a review

Ten seconds, in this order. The first three catch most of what matters.

1. **Is a whole object being logged?** `log.debug("...", request)` calls `toString()`, and a
   record's generated `toString()` includes every component, password fields included.
   → [08](08-what-never-to-log.md)
2. **If it logs an exception, is the `Throwable` the last argument with *no* `{}` for it?**
   A placeholder makes it an ordinary parameter and the stack trace is not printed at all.
   → [09](09-exceptions-in-logs.md)
3. **Does this block both log and rethrow?** Then the failure will be logged again above.
   → [09](09-exceptions-in-logs.md)
4. **Is the message parameterised rather than concatenated?**
   → [04](04-parameterised-messages.md)
5. **Is the level right?** WARN means somebody should act. If nobody will, it is INFO.
   → [03b](03b-the-warn-that-nobody-acts-on.md)
6. **Is it inside a loop or on a hot path?** Then it is a volume decision, not a logging decision.
   → [11](11-rolling-retention-and-cost.md)
7. **Does an exception message quote its input?** That is the second most common disclosure route
   and it looks like good error reporting. → [08](08-what-never-to-log.md)
8. **Is it a new structured field?** Then it is a schema change with downstream consumers.
   → [05c](05c-schema-and-field-naming.md)
9. **Does an alert depend on this message?** Then it is an interface, and it needs a test.
   → [13](13-testing-your-logging.md)

## Checklist B — the service's configuration

Nobody runs this, which is why it is worth having. Every item is something that fails silently.

**The facade and the backend**
- One backend on the classpath, bridges for everything else, no competing bindings.
  → [02b](02b-the-classpath-problem.md)
- The version you are running is the one you think. → [02c](02c-the-version-you-are-actually-running.md)

**Where output goes**
- Console in a container; a file only if there is a stated reason. → [10](10-appenders-and-async.md)
- `logback-spring.xml`, not `logback.xml`, so Boot's defaults are extended rather than replaced.
- If files: `maxHistory` **and** `totalSizeCap`. `maxHistory` alone bounds nothing.
  → [11](11-rolling-retention-and-cost.md)
- `immediateFlush` left `true`, unless losing the lines before a crash has been accepted
  explicitly.

**If an async appender is configured** — every one of these is a default, and every one surprises
someone → [10b](10b-async-appender.md), [10b2](10b2-what-it-costs-you.md)
- `queueSize` — 256 events by default.
- `discardingThreshold` — discarding starts at **80% full**, and drops everything at INFO and
  below, silently.
- `neverBlock` — `false` by default, so a full queue **blocks application threads**.
- `maxFlushTime` — 1000 ms, then the queue is abandoned at shutdown.
- The pattern does not reference `%line`, `%method`, `%class` or `%file`, which render nothing.

**Structure and correlation**
- JSON in any environment whose logs are queried. → [05](05-structured-json.md)
- Field names follow a documented convention. → [05c](05c-schema-and-field-naming.md)
- A correlation id on every line, including across async boundaries and virtual threads.
  → [07](07-correlation-ids.md), [06c](06c-mdc-across-async-and-virtual-threads.md)
- The MDC is cleared at the end of every request on a pooled thread.
  → [06b](06b-mdc-and-thread-pools.md)

**Security and compliance**
- Masking exists as a net, and is not treated as a control. → [08b](08b-masking-and-the-audit-trail.md)
- Audit events are in a store, not in the log pipeline — and specifically not behind an appender
  that discards.
- Retention is tiered, and reflects data protection as well as cost.
  → [11](11-rolling-retention-and-cost.md)

**Operability**
- Actuator's `loggers` endpoint exposed, authenticated, and the team knows `{}` clears a level.
  → [12](12-changing-levels-at-runtime.md)
- 🔴 **Effective levels audited** — not configured levels. An inherited DEBUG appears in no file.
- The four property tests exist. → [13](13-testing-your-logging.md)

## The five failures that produce most incidents

If the checklists are too long to keep, keep this:

1. **A secret in the log**, arriving via a `toString()` or an exception message. Not recoverable —
   the line is in a file, a buffer, an index and a backup. → [08](08-what-never-to-log.md)
2. **A stack trace that was never printed**, because of a `{}` where the throwable went. Discovered
   during the incident it would have solved. → [09](09-exceptions-in-logs.md)
3. **Silently discarded INFO**, because the async queue passed 80% full. The log looks complete
   and is not, and the gaps are concentrated exactly in the busy periods.
   → [10b](10b-async-appender.md)
4. **Logging as the bottleneck**, one lock, flat throughput, spare CPU, healthy dependencies, and
   an afternoon spent looking at the database. → [10c](10c-the-log-that-became-the-bottleneck.md)
5. **A DEBUG level nobody reverted**, an order of magnitude of volume with no deploy to correlate
   against, invisible in the config because it is inherited.
   → [12](12-changing-levels-at-runtime.md)

## The topic in one paragraph

Log for one reader at 03:00 who did not write the code. Use the facade, one backend, and
structure the output so it can be queried rather than grepped. Put the correlation id on every
line and nothing on any line that you would not put in a public search index. Log an exception
once, where you handle it, with the throwable last. Know that the async appender discards and
blocks, that the appender lock serialises your application, and that the level you are running is
not necessarily the level in the file. Test the four things that fail silently, and leave the rest
alone.

## Gotchas

**★ Checklist B is the one that never gets run, and it is where the expensive defects are.**
Every item on it fails silently — no exception, no alert, no test. That is exactly why it needs to
be an explicit periodic audit rather than something anyone notices.

**★ The configuration was inherited, not chosen.**
Most logging configuration arrives from a template written for a different deployment model years
earlier. "Why is this here" is a question with an answer for almost none of it.

**★ Three of the five common failures involve losing log data, not producing too much.**
Discarded INFO, an unprinted stack trace, and a queue abandoned at shutdown. The instinct that
logging problems are volume problems is half wrong.

**★ Effective level is the one that matters and configured level is the one you can see.**
Auditing the configuration file cannot detect an inherited DEBUG. Only the running application
can answer it — [12](12-changing-levels-at-runtime.md).

**★ Every async appender default is a decision somebody did not make.**
256 events, discard at 80%, block when full, one second at shutdown, no caller data. All five are
defaults, and all five are consequential.

**★ The review checklist's first three items catch most of what matters.**
Whole object logged, throwable with a placeholder, log-and-rethrow. If a team only ever remembers
three things, those are the three.

**★ A log line inside a loop is a cost decision, not a logging decision.**
It should be evaluated against request rate, not against whether the information is useful. Almost
nothing multiplied by a hot path stays cheap.

**★ "It has never caused a problem" is not evidence for a logging configuration.**
The failures on this page are silent by construction — a discarded event, an unprinted trace, a
leaked secret nobody has looked for. Absence of noticed problems is the expected state right up
until the incident.

## Interview questions

**★ What do you look for when reviewing a line of logging?**
Three things first, because they catch most of what matters. Is a whole object being passed — that
is a `toString()` call, and a record's generated `toString()` includes every component including
credentials, with nothing at the call site that looks wrong. If an exception is involved, is the
throwable the last argument with no `{}` for it — a placeholder turns it into an ordinary
parameter and no stack trace is printed at all, which fails silently and is discovered during the
incident it would have solved. And does this block both log and rethrow, because then the same
failure will be recorded again by every layer above. After those: parameterised rather than
concatenated; a level that means something, where WARN implies somebody should act; whether it is
on a hot path, which makes it a volume decision; whether an exception message quotes its input,
which is disclosure disguised as good error reporting; and whether anything downstream — an alert,
a dashboard — consumes it, because then it is an interface and it needs a test.

**★ You inherit a service. What do you check about its logging before you trust it?**
The things that fail silently, because anything that fails loudly has already been fixed. Whether
the async appender is configured and what its defaults are doing — a 256-event queue that starts
discarding all INFO at 80% full and blocks application threads when it is completely full is three
consequential behaviours nobody chose. Whether the pattern references `%line` or `%method` behind
that async appender, since those render nothing. Whether effective log levels match configured
ones, which requires asking the running application because an inherited DEBUG appears in no file.
Whether errors are being logged more than once, which I would establish by looking for the same
stack trace at several layers. Whether a correlation id is genuinely on every line, including
across async boundaries. Whether the retention period was chosen or defaulted, and whether the
logs contain personal data that makes it a compliance question as well as a cost one. And whether
anything is asserting that secrets do not reach output, which is almost always nothing.

**★ Which logging failures lose data rather than produce too much of it?**
Three of the five most common, which is worth knowing because the instinct is that logging
problems are volume problems. The async appender discards everything at INFO and below once its
queue is 80% full, silently — no exception, no counter, nothing in the log to indicate a gap — and
that engages under exactly the load conditions that make someone want to read the log. A throwable
passed with a placeholder produces a line that looks populated and contains no stack trace at all.
And the async appender's shutdown waits one second for its queue and then abandons whatever
remains, so the final events before a shutdown — during a shutdown that was probably triggered by
something going wrong — are lost, and on a SIGKILL the entire queue goes. All three produce a log
that appears complete, which is worse than a log that is visibly missing something, because an
investigator will reason from the absence and reach a confident wrong conclusion.

**★ Summarise the topic's argument in a few sentences.**
Log for one reader at three in the morning who did not write the code, and design everything
backwards from that. Use SLF4J with exactly one backend and structure the output as JSON so it can
be queried rather than grepped, because grep is not a query language and a named field is what
makes both aggregation and redaction exact. Put a correlation id on every line, and put nothing on
any line you would not put in a public search index — a log is a copy of your data with none of
its protections. Log an exception once, where you handle it, with the throwable last and no
placeholder. Then know the three mechanical facts that bite in production: the async appender
discards and blocks by default, the appender's single write lock serialises an otherwise parallel
application, and the level you are actually running is not necessarily the level in the file. Test
the four things that fail silently and leave the rest of the logging untested.

**★ Why is a logging configuration audit worth scheduling rather than doing when something
breaks?**
Because every failure it detects is silent by construction, so there is no event that would prompt
it. A discarded INFO event produces no error. An unprinted stack trace produces a line that looks
fine. An inherited DEBUG produces a larger invoice months later, attributed to nothing. A leaked
secret produces nothing at all until somebody goes looking, and by then the line is in a file, a
shipper's buffer, a search index and a backup. So the normal state of a service with several of
these defects is that nothing appears wrong — which means "we have never had a problem with our
logging" is close to uninformative as evidence. The audit is the only mechanism that converts
these from unknown to known, and it is cheap: most of Checklist B is answerable in an hour, and
most of it will not need answering again until the configuration changes.

**★ If a team could only adopt three practices from this topic, which three?**
A correlation id on every line, including across async boundaries — because without it the
remaining lines cannot be assembled into a narrative, and every other improvement is worth less.
Log an exception exactly once, at the boundary, with the throwable as the last argument and no
placeholder — that single rule addresses the largest source of log volume, the most common silent
defect, and the reason error counts cannot be trusted, all at once. And a single sentinel test
asserting that no sensitive value reaches captured output, because it is the only one of the three
that addresses an unrecoverable failure: volume can be reduced later and a missing trace can be
added later, but a disclosed secret is already in a backup somebody will read. Structured JSON
would be fourth and is arguably a precondition for doing the first well, but the three above give
the most value for the least change.

{/* FOOTER */}
