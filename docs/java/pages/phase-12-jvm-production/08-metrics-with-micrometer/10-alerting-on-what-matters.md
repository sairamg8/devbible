---
title: "An alert is a claim that a human should stop what they are doing right now, and almost every alert in almost every service fails that test — because it was written about a cause rather than a symptom, and because nobody ever deleted it"
sidebar_label: "10 · Alerting on what matters"
sidebar_position: 28
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Google SRE book** — *Monitoring Distributed Systems*
> (Symptoms Versus Causes, Black-Box Versus White-Box, As Simple as Possible No Simpler, Tying
> These Principles Together, Monitoring for the Long Term)
> ([sre.google](https://sre.google/sre-book/monitoring-distributed-systems/)) and *Service Level
> Objectives* ([sre.google](https://sre.google/sre-book/service-level-objectives/)).
> The burn-rate mechanics from the **SRE Workbook** are
> not covered here. No JVM was run for this page and no alert has been fired to
> produce any figure below. JDK 25 · Spring Boot 4.1.0 · Micrometer 1.17.0.

**Everything earlier in this topic was about producing numbers. This page is about the small
minority of them that are allowed to wake somebody. The governing constraint is not technical: a
page costs a human's attention, that attention is finite per day, and an alerting system that spends
it on non-events has destroyed its own ability to be believed.**

## The cost, stated plainly

> *"Paging a human is a quite expensive use of an employee's time. If an employee is at work, a page
> interrupts their workflow. If the employee is at home, a page interrupts their personal time, and
> perhaps even their sleep. When pages occur too frequently, employees second-guess, skim, or even
> ignore incoming alerts, sometimes even ignoring a 'real' page that's masked by the noise. Outages
> can be prolonged because other noise interferes with a rapid diagnosis and fix. **Effective
> alerting systems have good signal and very low noise.**"*

and the rule that follows:

> *"Unless you're performing security auditing on very narrowly scoped components of a system, **you
> should never trigger an alert simply because 'something seems a bit weird.'**"*

That sentence deletes most of the alerts in most services. "CPU above 80%", "GC pause above 200 ms",
"heap above 70%", "thread count above 400" — every one of them is "something seems a bit weird".

## Symptoms, not causes

> *"Your monitoring system should address two questions: what's broken, and why? The 'what's broken'
> indicates the symptom; the 'why' indicates a (possibly intermediate) cause."*

The book's own table, quoted:

| Symptom | Cause |
|---|---|
| *"I'm serving HTTP 500s or 404s"* | *"Database servers are refusing connections"* |
| *"My responses are slow"* | *"CPUs are overloaded by a bogosort, or an Ethernet cable is crimped under a rack, visible as partial packet loss"* |
| *"Private content is world-readable"* | *"A new software push caused ACLs to be forgotten and allowed all requests"* |

> *"'What' versus 'why' is one of the most important distinctions in writing good monitoring with
> maximum signal and minimum noise."*

🔴 **Alert on the left column. Dashboard the right one.** The reason is arithmetic: there are a few
symptoms and unboundedly many causes. A service can be slow because of GC, a pool, a downstream, a
noisy neighbour, a bad index, a leaking cache, a rate limiter, a DNS timeout. If you page on each
cause you get eight alerts that each fire on their own schedule, most of which are non-events, and
you still miss the ninth cause nobody predicted. If you page on "responses are slow" you get one
alert that fires exactly when it matters and never fires when it does not.

And the corollary that people resist:

> *"One person's symptom is another person's cause. For example, suppose that a database's
> performance is slow. Slow database reads are a symptom for the database SRE who detects them.
> However, for the frontend SRE observing a slow website, the same slow database reads are a
> cause."*

So "symptom" is not a property of a metric. It is a property of a metric *relative to the team on
call*. `hikaricp_connections_pending` is a cause for the API team and a symptom for nobody.

## The five questions to ask before an alert exists

Quoted, because the list is better than any paraphrase:

> *"Does this rule detect an otherwise undetected condition that is urgent, actionable, and actively
> or imminently user-visible?"*
>
> *"Will I ever be able to ignore this alert, knowing it's benign? When and why will I be able to
> ignore this alert, and how can I avoid this scenario?"*
>
> *"Does this alert definitely indicate that users are being negatively affected? Are there
> detectable cases in which users aren't being negatively impacted, such as drained traffic or test
> deployments, that should be filtered out?"*
>
> *"Can I take action in response to this alert? Is that action urgent, or could it wait until
> morning? Could the action be safely automated? Will that action be a long-term fix, or just a
> short-term workaround?"*
>
> *"Are other people getting paged for this issue, therefore rendering at least one of the pages
> unnecessary?"*

And the four-line philosophy underneath them:

> *"Every time the pager goes off, I should be able to react with a sense of urgency. I can only
> react with a sense of urgency a few times a day before I become fatigued.*
> *Every page should be actionable.*
> *Every page response should require intelligence. **If a page merely merits a robotic response, it
> shouldn't be a page.***
> *Pages should be about a novel problem or an event that hasn't been seen before."*

The third line is the one that changes behaviour. A page whose runbook is "restart the pod" is not
an alert; it is a manual `restartPolicy`.

## What this means for a Spring Boot service, concretely

**Page on** (symptoms, user-visible, from `http.server.requests`):

```promql
# Availability: the error ratio over a short window, per service.
sum(rate(http_server_requests_seconds_count{outcome="SERVER_ERROR"}[5m]))
  /
sum(rate(http_server_requests_seconds_count[5m]))

# Latency: the proportion of requests breaching the SLO boundary (08c).
1 - (
  sum(rate(http_server_requests_seconds_bucket{le="0.5",outcome="SUCCESS"}[5m]))
    /
  sum(rate(http_server_requests_seconds_count[5m]))
)
```

Both are ratios of good events to total events, which is the form the SRE material recommends and
the form burn-rate alerting requires.

**Do not page on, but do dashboard**: `jvm.gc.pause`, `jvm.memory.used`, `system.cpu.usage`,
`hikaricp.connections.pending`, `executor.queued`, `logback.events{level="error"}`. Every one of
these is a *cause*, and each is exactly what you want on the screen ten seconds after the symptom
alert fires ([05b · USE for a JVM service](05b-use-for-a-jvm-service.md)).

**The two honourable exceptions**, both of which the book allows as "very definite, very imminent
causes":

- **Disk or certificate expiry.** `disk.free` heading to zero, or `ssl.chain.expiry` heading to
  zero, is a cause that will *certainly* become a symptom, at a knowable time, and the action is
  unambiguous. Page — but as a ticket, not at 3am, because the lead time is days.
- **The saturation signal for a resource with no graceful degradation.** A connection pool at 100%
  with a growing queue will become a symptom within minutes and the action is real. This is the
  one place a `pending > 0 for 5m` alert earns its keep.

## The dashboard nobody looks at

> *"Signals that are collected, but not exposed in any prebaked dashboard nor used by any alert, are
> candidates for removal."*

> *"Data collection, aggregation, and alerting configuration that is rarely exercised (e.g., less
> than once a quarter for some SRE teams) should be up for removal."*

> *"The rules that catch real incidents most often should be as simple, predictable, and reliable as
> possible."*

These three sentences are a metrics-cost policy as well as an alerting policy. A percentile histogram
nobody has queried is 73 series per tag combination bought for nothing
([08d](08d-the-bucket-budget.md)). The deletion criterion is the same in both directions: if no
alert and no dashboard reads it, it should not exist.

## The failure mode has a name and a case study

The book's Bigtable story is worth reading in full; the shape is that the team alerted on an SLO
based on a mean, the mean was driven by a heavy tail, alerts fired constantly, and:

> *"the team spent significant amounts of time triaging the alerts to find the few that were really
> actionable, and we often missed the problems that actually affected users, because so few of them
> did."*

The fix included temporarily *loosening* the objective and *disabling* the email alerts, which is
the counter-intuitive move that made real repair possible. And:

> *"Every page that happens today distracts a human from improving the system for tomorrow, so there
> is often a case for taking a short-term hit to availability or performance in order to improve the
> long-term outlook for the system."*

with the diagnostic:

> *"Pages with rote, algorithmic responses should be a red flag."*

## Gotchas

**★ "Something seems a bit weird" is explicitly not an alert.** The SRE book says so in those words.
Threshold alerts on CPU, heap, GC pause and thread count are all instances of it, and collectively
they are most of the pager volume in most organisations.

**★ Alerting on a cause means alerting on one of unboundedly many causes.** You will get the eight
you thought of and miss the ninth. The symptom alert catches all nine, including the ones that have
not been invented yet.

**★ "Symptom" is relative to who is on call.** A slow database read is a symptom to the database
team and a cause to the API team. An alert that is correct for one team is noise for the other, and
both of them owning it produces the duplicate paging the five questions ask you to eliminate.

**★ A page with a rote response should be automated, not delivered.** If the runbook is "restart
it", the runbook is a health probe and a `restartPolicy`. Delivering it to a human trains the human
to skim.

**★ An error-*count* alert fires on traffic growth; an error-*ratio* alert does not.**
`errors > 100/min` is a threshold on your success, not on your failure. Ratios are the only stable
form.

**★ Averaged-over-five-minutes causes hide the bursts that produced the symptom.** Gregg's CPU case
in [05b](05b-use-for-a-jvm-service.md) applies to alerting too: resolution is part of the alert
definition, not an implementation detail.

**★ Low-traffic services make ratio alerts hypersensitive.** One failed request out of three is a
33% error rate. Any ratio alert needs a minimum-volume guard, and services below that volume need a
different strategy entirely.

**★ Alerts have no owner and never expire, which is why services accumulate them.** The book's
criterion — anything exercised less than about once a quarter is a removal candidate — is the only
practice that reverses the accumulation, and it needs to be somebody's recurring job.

**★ An alert that fires during deploys or drains trains people to ignore it.** The third question
exists for this: identify the detectable cases where users are *not* affected and filter them out,
or the alert becomes noise on a schedule everyone knows.

**★ A metric with no alert and no dashboard is a cost with no benefit.** This is the strongest
argument available for deleting a percentile histogram, and it comes from the alerting chapter
rather than from a cost chapter.

**★ Both signals in the same alert produce ambiguity.** "Latency or errors are bad" fires and the
responder does not know which. Two rules, two runbooks; combine them only when the response is
genuinely identical.

## Interview questions

**★ Why should you alert on symptoms rather than causes?**
Because there are few symptoms and unboundedly many causes. A user-visible symptom — elevated errors,
elevated latency — covers every cause including the ones nobody predicted, and fires exactly when
users are affected. A cause alert fires when a particular internal quantity crosses a line, which is
frequently a non-event, and it misses every cause you did not enumerate. The SRE book calls the
"what versus why" distinction one of the most important in writing monitoring with maximum signal
and minimum noise, and its practical form is: alert on the left column of the symptom/cause table,
dashboard the right one.

**★ Is there ever a good reason to page on a cause?**
Yes, when the cause is definite, imminent, and its consequence is knowable — the SRE book's phrasing
is to worry only about "very definite, very imminent causes". Disk filling and a certificate
approaching expiry qualify: the symptom is certain to arrive, the arrival time is computable, and
the action is unambiguous. Note that both of those have days of lead time, so they should be tickets
rather than pages. The other defensible case is the saturation metric of a resource with no
graceful degradation, such as a connection pool with a growing wait queue, where the symptom follows
within minutes.

**★ What is wrong with "alert when the error count exceeds 100 per minute"?**
It is a threshold on traffic as much as on failure. As the service grows, a constant absolute count
represents an ever-smaller failure rate, so the alert becomes less sensitive precisely as the
service becomes more important; and during a traffic spike it fires without the failure rate having
moved at all. The stable form is a ratio of bad events to total events, which is also the form
error budgets and burn-rate alerts require. The ratio's own weakness is low traffic, where small
absolute numbers produce large ratios, and that is handled with a minimum-volume guard rather than by
going back to counts.

**★ Your team has forty alerts and pages six times a night. Where do you start?**
Not by tuning thresholds. Classify every alert as symptom or cause and delete or downgrade the cause
alerts — that alone usually removes most of the volume. Then apply the book's removal criterion to
what is left: anything not exercised in about a quarter, and anything with a rote runbook, goes. Then
rebuild from two symptom alerts, availability and latency, expressed as ratios over your SLIs. The
Bigtable case study is the precedent for the uncomfortable part: they temporarily loosened the
objective and turned off the email alerts, because the noise was actively preventing the repair.

**★ How do you decide whether something belongs on a dashboard or in an alert?**
By whether a human must act now. Alerts answer "what is broken", dashboards answer "why". Everything
in the USE table — GC pause fraction, pool saturation, executor queues, CPU — belongs on a dashboard
because it is what you read in the ten seconds after the symptom alert fires. The complementary
rule runs the other way and is a cost control: a signal that appears in no dashboard and no alert is
a removal candidate, which is the cleanest justification you will find for deleting an expensive
percentile histogram.

**★ Why is a page with a rote response a problem, rather than a convenience?**
Because it consumes the finite resource the alerting system depends on. Pages work only while people
respond to them with urgency, and the book's own estimate is that a human can do that a few times a
day before fatigue sets in. A page answered by a scripted action spends that budget on something a
machine could do, and it trains the responder to skim — which is how a real page gets missed. The
book calls rote-response pages a red flag and notes that unwillingness to automate them usually
signals a team that does not believe it can clear its technical debt.

{/* FOOTER */}
