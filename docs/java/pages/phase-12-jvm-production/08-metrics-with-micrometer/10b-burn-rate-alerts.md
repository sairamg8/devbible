---
title: "A burn-rate alert asks how fast you are spending an error budget rather than whether an error ratio crossed a line, which is why one rule with three windows catches a total outage in minutes and a slow leak in days without paging for either at the wrong time"
sidebar_label: "10b · Burn-rate alerts"
sidebar_position: 29
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-02 against the **Google SRE Workbook**, chapter 5 *Alerting on SLOs* —
> iterations 1 through 5 and Tables 5-4 and 5-6
> ([sre.google](https://sre.google/workbook/alerting-on-slos/)) — and the **Google SRE book** —
> *Service Level Objectives* ([sre.google](https://sre.google/sre-book/service-level-objectives/)).
> Every burn rate, window and percentage on this page is quoted from the Workbook's own tables and
> the PromQL is the Workbook's. No alert was fired and no JVM was run for this page.
> JDK 25 · Spring Boot 4.1.0 · Micrometer 1.17.0.

**[10](10-alerting-on-what-matters.md) settled *what* to page on: a symptom, expressed as a ratio
of bad events to total events. This page is the *rule*. The Workbook walks through six attempts at
writing it, and each one fails in a way that the next one fixes. The idea that makes the working
version work is a change of units — from "error ratio" to "fraction of the month's error budget
spent per hour". [10c](10c-multiwindow-rules-and-low-traffic.md) then adds the short window that
makes the page clear on time, and points the whole thing at `http.server.requests`.**

## The target and the budget

The Workbook's framing, which every later number depends on:

> *"For the purposes of this discussion, 'error budgets' and 'error rates' apply to all SLIs, not
> just those with 'error' in their name. In the section What to Measure: Using SLIs, we recommend
> using SLIs that capture the ratio of good events to total events. The error budget gives the
> number of allowed bad events, and the error rate is the ratio of bad events to total events."*

So a latency SLI is an error ratio too: a request over the boundary is a bad event. That is
exactly the count [08c](08c-slos-and-the-bucket-budget.md) gave you with `serviceLevelObjectives`,
and it is why the whole of this page applies to latency as much as to HTTP 500s.

The example throughout is a **99.9% SLO over 30 days**. The budget is therefore 0.1% of the
month's requests. Everything below is stated relative to that; substitute your own SLO and the
arithmetic carries.

## Why a plain threshold fails, in the Workbook's own words

The first attempt is the one everybody writes — alert when the error ratio exceeds the SLO:

> *"Precision is low: The alert fires on many events that do not threaten the SLO. A 0.1% error
> rate for 10 minutes would alert, while consuming only 0.02% of the monthly error budget."*

The second attempt widens the window to 36 hours so that only a 5% budget spend fires. Better
precision — and a total outage now takes a very long time to notice:

> *"Poor recall and poor detection time: Because the duration does not scale with the severity of
> the incident, a 100% outage alerts after one hour, the same detection time as a 0.2% outage. The
> 100% outage would consume 140% of the 30-day budget in that hour."*

The third attempt adds a `for:` duration, which is worse than it looks, because a duration clause
resets on every dip below the threshold:

> *"A series of 100% error spikes lasting 5 minutes every 10 minutes never triggers an alert,
> despite consuming 35% of the error budget."*

Every one of those failures is the same failure: a fixed error-ratio threshold cannot express
*severity*, so it is either too twitchy for small incidents or too slow for large ones.

## Burn rate: the change of units

> *"Burn rate is how fast, relative to the SLO, the service consumes the error budget."*

> *"The example service uses a burn rate of 1, which means that it's consuming error budget at a
> rate that leaves you with exactly 0 budget at the end of the SLO's time window. … With an SLO of
> 99.9% over a time window of 30 days, a constant 0.1% error rate uses exactly all of the error
> budget: a burn rate of 1."*

The Workbook's Table 5-4, quoted:

| Burn rate | Error rate for a 99.9% SLO | Time to exhaustion |
|---|---|---|
| 1 | 0.1% | 30 days |
| 2 | 0.2% | 15 days |
| 10 | 1% | 3 days |
| 1,000 | 100% | 43 minutes |

And the two formulas that turn a burn rate into an alert:

> *"For burn rate–based alerts, the time taken for an alert to fire is:
> (1 − SLO) ÷ error ratio × alerting window size × burn rate.
> The error budget consumed by the time the alert fires is:
> burn rate × alerting window size ÷ period."*

So the design question is no longer "what error ratio is bad?" but "**what fraction of the month's
budget, spent in what window, is worth a human?**" — and the burn rate is derived from the answer.
The Workbook's worked example: *"Five percent of a 30-day error budget spend over one hour requires
a burn rate of 36."* Its own verdict on that single-window rule is the reason there is a next
step: *"Low recall: A 35x burn rate never alerts, but consumes all of the 30-day error budget in
20.5 hours."*

## The recommended numbers

> *"We recommend 2% budget consumption in one hour and 5% budget consumption in six hours as
> reasonable starting numbers for paging, and 10% budget consumption in three days as a good
> baseline for ticket alerts."*

Table 5-6, quoted:

| SLO budget consumption | Time window | Burn rate | Notification |
|---|---|---|---|
| 2% | 1 hour | 14.4 | Page |
| 5% | 6 hours | 6 | Page |
| 10% | 3 days | 1 | Ticket |

Check one row against the formula: 2% of a 30-day budget in 1 hour means burn rate × 1 h ÷ 720 h
= 0.02, so burn rate = 14.4. The threshold on the error ratio is then 14.4 × (1 − 0.999) = 1.44%.
The Workbook's rule, verbatim, for the two page rows and the ticket row:

```yaml
expr: (
        job:slo_errors_per_request:ratio_rate1h{job="myjob"} > (14.4*0.001)
      or
        job:slo_errors_per_request:ratio_rate6h{job="myjob"} > (6*0.001)
      )
severity: page

expr: job:slo_errors_per_request:ratio_rate3d{job="myjob"} > 0.001
severity: ticket
```

Three windows, three burn rates, two severities. A 100% outage crosses the 1-hour rule in about
four minutes (1 h × 1.44% ÷ 100%); a 0.2% slow leak never pages and reaches the ticket rule after
a day and a half. The Workbook's summary of why it is worth the extra numbers:

> *"Multiple burn rates allow you to adjust the alert to give appropriate priority based on how
> quickly you have to respond. If an issue will exhaust the error budget within hours or a few
> days, sending an active notification is appropriate. Otherwise, a ticket-based notification to
> address the alert the next working day is more appropriate."*

What this version still gets wrong — a one-hour window keeps paging for most of an hour after the
errors stop — is the subject of [10c](10c-multiwindow-rules-and-low-traffic.md).

## Gotchas

**★ Three windows firing at once is the default outcome of a big outage.** *"10% budget spend in
five minutes also means that 5% of the budget was spent in six hours, and 2% of the budget was
spent in one hour. This scenario will trigger three notifications unless the monitoring system is
smart enough to prevent it from doing so."* Suppression is part of the rule, not an afterthought.

**★ A `for:` duration is the wrong tool and the Workbook says why.** It resets on every dip below
threshold, so periodic spikes that consume a third of the budget never fire. The multi-window
burn-rate rule is the replacement, not an addition.

**★ The three-day window means the ticket alert has a three-day reset time.** The Workbook lists it
as a con of the method. A fixed leak that was repaired yesterday can still have a ticket open
tomorrow; the runbook for the ticket must say so.

**★ The numbers in Table 5-6 are for a 99.9% SLO and scale with `1 − SLO`.** At 99% the threshold
for the same 14.4× burn rate is 14.4%, not 1.44%; at 99.99% it is 0.144%. Copying `0.001` into a
rule for a different SLO produces an alert that is either silent or permanent.

**★ Burn rate is defined against a *period* — 30 days here — and changing the period changes every
threshold.** A 7-day SLO window makes the same 14.4× burn rate spend 2% of the budget in about 14
minutes, not an hour. Re-derive from the two formulas rather than re-using the table.

**★ A single-window burn-rate rule has a recall hole between its threshold and the next.** The
Workbook's example: a 36× rule never fires for a 35× burn, which empties the budget in under a day.
That hole is the reason the recommendation is three windows, not one well-chosen one.

**★ "Error" means any bad event, including a slow one.** The Workbook defines error budgets and
error rates for every SLI, not just those with "error" in the name. A team that runs burn-rate
alerting on HTTP 500s only has left its latency SLO with no alert at all.

## Interview questions

**★ What is a burn rate, and why alert on it instead of on the error ratio directly?**
It is the rate at which the service is consuming its error budget, expressed relative to the SLO:
a burn rate of 1 spends exactly the whole budget over the SLO period, 10 spends it in a tenth of
the time. Alerting on it lets a single rule express *severity* — a total outage and a slow leak
consume budget at rates three orders of magnitude apart, so they cross different burn-rate
thresholds at different times, and each gets the notification appropriate to how much time is
left. A fixed error-ratio threshold cannot do that: it is either too sensitive for small incidents
or too slow for large ones, and the Workbook's first three iterations are that trade-off failing in
both directions.

**★ Where do the numbers 14.4, 6 and 1 come from?**
From the formula "budget consumed = burn rate × window ÷ period" solved for the burn rate, with
the Workbook's recommended budget fractions: 2% in one hour of a 30-day period is 0.02 × 720 ÷ 1 =
14.4; 5% in six hours is 0.05 × 720 ÷ 6 = 6; 10% in three days is 0.10 × 720 ÷ 72 = 1. The
threshold applied to the recorded error ratio is the burn rate multiplied by 1 − SLO, which for
99.9% gives 1.44%, 0.6% and 0.1% respectively. Change the SLO or the period and the numbers must
be recomputed, not copied.

**★ Your burn-rate page fired three times for one incident. What went wrong?**
Nothing in the detection — a large enough incident legitimately satisfies the one-hour, six-hour
and three-day conditions simultaneously, and the Workbook says so explicitly. What is missing is
suppression: the alerting system should inhibit the lower-severity notifications while a
higher-severity one for the same SLI is active. That is configuration in the alert manager, not in
the rule, and it is part of the deliverable.

**★ Someone proposes replacing the whole thing with `for: 10m` on a simple ratio threshold. Why
not?**
Because a duration clause resets the moment the ratio dips below the threshold, so it is blind to
exactly the incident shape that costs the most budget quietly — the Workbook's example is a 100%
error spike for five minutes every ten, which never fires and consumes a third of the budget. It
also scales badly in the other direction: the same ten minutes applies to a 0.2% leak and a 100%
outage. The multi-window burn-rate rule expresses both severity and persistence without either
problem.

**★ Why is the ticket alert on a three-day window rather than a longer page window?**
Because the response it asks for is different. A 1× burn over three days spends 10% of the budget
and, left alone, exhausts it in a month — serious, but with days of lead time, so the Workbook
routes it to a ticket for the next working day rather than a page. The same reasoning is why the
page windows are short: those burn rates would empty the budget in hours, and hours is the scale
on which a human must be interrupted.

{/* FOOTER */}
