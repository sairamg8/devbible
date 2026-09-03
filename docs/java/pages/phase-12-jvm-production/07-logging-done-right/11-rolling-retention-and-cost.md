---
title: "Logging is billed per gigabyte ingested by a vendor whose pricing you agreed to once, and the volume is decided by engineers who never see the invoice — so the cost conversation arrives as a mandate to cut logging by half, which is the worst possible way to decide what to stop recording"
sidebar_label: "11 · Rolling, retention and cost"
sidebar_position: 25
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the **Logback** manual's `RollingFileAppender`,
> `SizeAndTimeBasedRollingPolicy` and `TimeBasedRollingPolicy` documentation, including the
> `maxHistory`, `totalSizeCap` and `cleanHistoryOnStart` semantics
> ([logback.qos.ch](https://logback.qos.ch/manual/appenders.html)); the **Spring Boot 4.1**
> logging reference for the `logging.logback.rollingpolicy.*` properties
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/features/logging.html)); and
> **GDPR Article 5(1)(e)** (storage limitation)
> ([eur-lex.europa.eu](https://eur-lex.europa.eu/eli/reg/2016/679/oj)).
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**Log volume is one of the few engineering decisions where the person creating the cost and the
person paying it are reliably different people, and there is no feedback between them until a
budget review. What arrives then is a percentage cut, applied uniformly, which removes the
low-volume high-value lines along with the high-volume worthless ones. This page is the argument
for deciding earlier, on evidence, and the mechanics for doing it.**

## Where the volume actually comes from

Before cutting anything, know the distribution — it is consistently lopsided, and consistently in
the same places:

- **Double-logged exceptions.** One failure, five layers, sixty lines of stack trace each. This is
  routinely the single largest item and it is pure duplication —
  [09 · Exceptions in logs](09-exceptions-in-logs.md).
- **DEBUG left enabled** on a package, usually a framework one, usually by someone who has left.
  An order of magnitude, invisible in the code — [12](12-changing-levels-at-runtime.md).
- **Per-request INFO lines.** "Received request", "returning 200". Multiply by request rate. These
  duplicate the access log, which the platform already has.
- **Health check and probe traffic.** A liveness probe every five seconds is 17,280 requests per
  pod per day, each producing whatever a request produces.
- **Retry storms.** A failing dependency with retries logs per attempt, so the volume multiplies by
  the retry count exactly when volume is already elevated.

Notice that three of the five spike during an incident. **Logging cost is not a constant; it is a
function of how badly things are going**, which is also when the log is least likely to be sampled
away by whatever cost control you added.

## The rolling mechanics, and the one that surprises people

If you are writing files at all — and [10](10-appenders-and-async.md) argues you usually should
not be, in a container — the policy is `RollingFileAppender` with either
`TimeBasedRollingPolicy` or `SizeAndTimeBasedRollingPolicy`, and three settings govern disk:

| Setting | What it bounds |
|---|---|
| `maxFileSize` | When a single file rolls |
| `maxHistory` | How many archived *periods* are kept |
| `totalSizeCap` | The total size of all archives |

🔴 **`maxHistory` counts periods, not files, and without `totalSizeCap` it bounds nothing you
care about.** With a daily policy and `maxHistory=30`, you keep thirty days — and a day that
produces 200 GB is one of them. The combination that actually bounds disk is `maxHistory` *and*
`totalSizeCap` together, and the property that is nearly always missing is the second.

Spring Boot exposes all of these as `logging.logback.rollingpolicy.*` properties, which is the
right place to set them because it survives Boot's default configuration rather than replacing it
— the `logback.xml` versus `logback-spring.xml` distinction from [10](10-appenders-and-async.md).

`cleanHistoryOnStart` is worth knowing for short-lived processes: archives are otherwise removed
only as rolling occurs, so a process that starts, writes a little and exits never cleans up the
previous generation's files.

## Retention has two independent drivers, and they are usually confused

The retention period gets set once, by whoever configured the pipeline, from one consideration —
usually cost, occasionally a compliance rule about how long logs must be *available*. There are
actually three, and they conflict:

1. **Debugging.** Almost all diagnostic value is in the last few days. Beyond that, incidents are
   investigated from metrics and traces, not from log lines.
2. **Compliance minimums.** Audit-relevant records may have to be kept for years — but that is the
   audit log, which [08b](08b-masking-and-the-audit-trail.md) argues is a different artefact and
   should not be sharing this retention.
3. 🔴 **Data-protection maximums.** GDPR's storage limitation principle says personal data is kept
   *"no longer than is necessary"*. If the logs contain personal data, retention is not merely a
   cost decision — a long retention is an exposure and possibly a compliance failure in the
   opposite direction from the one people worry about.

The common configuration — one retention period for everything, set at the pipeline — satisfies
none of them well. It over-retains debugging noise, under-retains audit records, and holds
personal data past its justification. The fix is tiering, which every serious log platform
supports and few teams configure: short and hot for debugging, long and cold for the small subset
that needs it, and personal data preferably in neither.

## Reducing volume without losing the diagnosis

In descending order of value per unit of effort:

1. **Fix double logging.** Free, and often the largest single reduction available.
2. **Audit effective levels.** Not configured levels — effective ones, per
   [12](12-changing-levels-at-runtime.md). A `DEBUG` inherited from a parent logger is invisible
   in the configuration file.
3. **Exclude probe traffic** from request logging. It is high-volume and zero-information.
4. **Sample repetitive events.** Keep the first N per signature per interval, count the rest, and
   log the count. This preserves both the example and the magnitude, which is what an
   investigation needs, and it removes almost all of the bulk of a retry storm.
5. **Move high-cardinality per-request facts to traces and metrics.** A timing belongs in a
   histogram, not in a log line that gets parsed to reconstruct one.
6. **Drop the fields nobody queries.** In a structured log the schema is explicit, so this is a
   reviewable decision rather than a guess — [05c](05c-schema-and-field-naming.md).

**Sampling is the technique most worth understanding**, because it is the only one that scales
with an incident. Uniform sampling — keep 10% of everything — is the wrong shape: it discards
90% of the rare events, which are the informative ones, and keeps 10% of the flood, which is
still a flood. Sampling per signature keeps every distinct thing that happened while collapsing
repetition, which is exactly the trade you want.

## Gotchas

**★ `maxHistory` counts periods, not bytes, so it does not bound disk.**
Thirty daily archives include the day that produced 200 GB. `totalSizeCap` is the property that
actually bounds storage, and it is the one most often omitted.

**★ Logging cost rises during incidents, which is when your cost controls are least helpful.**
Errors, retries and raised levels all spike together. A budget set against steady-state volume is
a budget that fails on the day it matters.

**★ A uniform percentage cut removes the rare high-value lines along with the noise.**
Which is exactly what a mandate to "reduce logging by half" produces when applied without
measuring the distribution first. Measure, then cut the top item.

**★ Double-logged exceptions are usually the single largest line item and cost nothing to fix.**
One failure at five layers with a sixty-line trace is several hundred lines. Four of those copies
carry no information the first does not.

**★ Probe traffic is high-volume and zero-information.**
A five-second liveness probe is over seventeen thousand requests per pod per day. It is the
easiest exclusion available and it is almost never configured.

**★ Retention is set from one consideration and has three.**
Debugging value decays in days, compliance minimums run to years, and data-protection maximums
push the other way. A single global period satisfies none of them.

**★ Long retention of personal data is a compliance risk, not a safe default.**
Storage limitation means data is kept no longer than necessary. "We keep everything for a year"
is a decision that needs a justification, and cost is not one.

**★ Uniform sampling is the wrong shape for logs.**
Keeping 10% of everything discards 90% of the rare events — which are the informative ones — and
retains 10% of the flood, which is still a flood. Sample per signature instead.

**★ A timing in a log line is a metric in the wrong place.**
It is written once, parsed later, and answers one question badly. A histogram answers percentile
questions correctly and costs a fraction as much to store —
**08 · Metrics** *(not written yet)*.

**★ Effective level, not configured level, is what generates volume.**
A package inheriting `DEBUG` from a parent appears nowhere in the configuration. Auditing the
config file will not find it; querying the running application will.

**★ Archives are cleaned on rolling, so a short-lived process never cleans up.**
`cleanHistoryOnStart` exists for exactly this. A job that starts, logs a little and exits leaves
the previous generation's files in place indefinitely.

**★ Index cost and storage cost are different numbers.**
Most platforms charge for ingestion and searchable retention separately, so a field nobody queries
may be cheap to store and expensive to index. Reducing indexed fields is often a bigger saving
than reducing lines.

## Interview questions

**★ You are told to cut logging costs by half. How do you approach it?**
By measuring the distribution before cutting anything, because a uniform reduction removes the
rare high-value lines along with the noise, and the distribution is reliably lopsided. In practice
a handful of sources dominate: double-logged exceptions, where one failure produces a stack trace
at every layer that caught it; a DEBUG level left enabled on some package, often a framework one;
per-request INFO lines that duplicate an access log the platform already has; probe traffic, which
at a five-second interval is over seventeen thousand requests per pod per day; and retry storms,
which multiply volume by the retry count exactly when volume is already high. The first two
usually get you most of the way and cost nothing diagnostically — removing a duplicate is not
removing information. After that, sampling per signature, excluding probes, and moving timings out
of log lines into histograms. The cut I would resist is a blanket level change from INFO to WARN,
because it is the easiest to implement and it removes the context that makes the errors
interpretable.

**★ Why does `maxHistory=30` not bound your disk usage?**
Because `maxHistory` counts archived *periods*, not bytes. With a daily rolling policy it keeps
thirty days of archives, and it says nothing about how large a day is — so a day when an
exception storm produced two hundred gigabytes is simply one of the thirty you are keeping. The
property that actually bounds storage is `totalSizeCap`, which limits the aggregate size of the
archives and causes the oldest to be removed when the cap is reached, and it is the one most
often missing from configurations that believe they are bounded. The two are meant to be used
together: `maxHistory` expresses how far back you want to be able to look, `totalSizeCap`
expresses how much disk you are willing to spend on that wish, and the second wins when they
conflict. There is a related gap for short-lived processes — archives are pruned as part of
rolling, so a process that starts, writes little and exits never prunes anything, which is what
`cleanHistoryOnStart` addresses.

**★ How should retention be decided?**
By recognising that there are three independent drivers pulling in different directions, and that
a single global period cannot serve them. Debugging value decays fast — almost everything useful
is in the last few days, after which incidents are investigated from metrics and traces rather
than log lines. Compliance minimums can require years, but that requirement attaches to audit
records, which are a different artefact from the application log and should have their own store
and their own retention. And data protection pushes the opposite way: if the logs contain personal
data, GDPR's storage limitation principle means keeping them longer than necessary is itself a
problem, so a long retention is an exposure rather than a safe default. The workable answer is
tiering — a short hot period for the debugging use case, a long cold one for the small subset that
genuinely needs it, and personal data ideally in neither. Most platforms support this and most
teams have not configured it, because retention was set once by whoever built the pipeline from a
single consideration.

**★ Explain why uniform sampling is the wrong strategy for logs.**
Because it is blind to how much information a line carries, and log information is inversely
related to frequency. Keeping 10% of everything discards nine out of ten occurrences of the rare
event that appeared three times — which is very likely the thing you needed — while retaining 10%
of the million identical timeout messages, which is still a hundred thousand lines of the same
message and has not solved the volume problem. Sampling per signature inverts that: group events
by their template or by a hash of their shape, keep the first few of each per interval, count the
rest, and emit the count. Every distinct thing that happened is preserved, with an example and a
magnitude, and the repetition is collapsed. That is precisely the information an investigation
needs — what happened, and how much — and it is also the strategy that scales during an incident,
because the incident produces repetition rather than variety. It does require structured logging
or a stable message template to group on, which is another practical argument for
[05](05-structured-json.md).

**★ Why is logging cost a governance problem rather than a technical one?**
Because the person who creates the cost and the person who pays it are different, and there is no
signal between them until a budget review. An engineer adding a log line inside a request handler
is making a decision worth some amount per year at current traffic, and nothing in their tooling
tells them that; the invoice arrives months later, aggregated across hundreds of such decisions,
to someone who cannot attribute it to any of them. So the correction, when it comes, is necessarily
blunt — a percentage target, or a level change — applied by someone without the context to know
which lines matter. The technical mechanisms on this page all work; the reason they are not
applied is that nobody owns the decision at the point it is made. The interventions that actually
change behaviour are the ones that close the loop: per-service volume attribution, a budget that
belongs to the team, and volume as a reviewable number in the same way latency is. It is worth
saying out loud in an interview because it explains why every organisation rediscovers this
problem rather than solving it once.

**★ What should never be sacrificed to cut log volume?**
The ability to reconstruct what happened to a single request, and the errors themselves. Those are
the two things the log is uniquely for — metrics give you rates and distributions, traces give you
latency breakdowns, and neither tells you what a specific failure said. So a correlation id on
every line survives any cut, because without it the remaining lines cannot be assembled into a
narrative and their value drops disproportionately. Errors and warnings survive, including their
stack traces — removing traces to save space is the cut that most reliably converts a diagnosable
incident into an undiagnosable one. What is safe to remove is duplication, repetition, probe
traffic, per-request lines that duplicate the access log, and fields nobody queries. The
distinction that makes it decidable is whether removing something loses a *fact* or loses a
*copy*, and most log volume is copies.

{/* FOOTER */}
