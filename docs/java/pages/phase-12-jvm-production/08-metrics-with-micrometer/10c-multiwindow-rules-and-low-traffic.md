---
title: "The short window is a still-burning test that makes a page clear five minutes after the fix instead of an hour, the recording rule is where the SLI's denominator finally gets written down, and below a few requests a minute none of this works and the Workbook says what to do instead"
sidebar_label: "10c · Multi-window rules and low traffic"
sidebar_position: 30
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-02 against the **Google SRE Workbook**, chapter 5 *Alerting on SLOs* —
> iteration 6 *Multiwindow, Multi-Burn-Rate Alerts*, Table 5-8, and *Low-Traffic Services and
> Error Budget Alerting* ([sre.google](https://sre.google/workbook/alerting-on-slos/)). The alert
> expressions are the Workbook's; the recording rules re-point them at the Micrometer series names
> established in [08c](08c-slos-and-the-bucket-budget.md) and the **Spring Boot 4.1 production-ready
> reference · Metrics** ([docs.spring.io](https://docs.spring.io/spring-boot/4.1.0/reference/actuator/metrics.html)).
> No alert was fired and no JVM was run for this page. JDK 25 · Spring Boot 4.1.0 · Micrometer
> 1.17.0.

**[10b](10b-burn-rate-alerts.md) ended with a rule that pages correctly and then keeps paging for
most of an hour after the incident is over. This page is the Workbook's last iteration, which fixes
that with a second, shorter window; the recording rules that connect it to the meters a Spring Boot
service already has; and the honest section at the end of the chapter about services that do not
get enough traffic for any of it to mean anything.**

## The short window

> *"A good guideline is to make the short window 1/12 the duration of the long window."*

> *"For example, you can send a page-level alert when you exceed the 14.4x burn rate over both the
> previous one hour and the previous five minutes. This alert fires only once you've consumed 2% of
> the budget, but exhibits a better reset time by ceasing to fire five minutes later, rather than
> one hour later."*

Table 5-8, quoted — this is the whole configuration and the thing to bank:

| Severity | Long window | Short window | Burn rate | Error budget consumed |
|---|---|---|---|---|
| Page | 1 hour | 5 minutes | 14.4 | 2% |
| Page | 6 hours | 30 minutes | 6 | 5% |
| Ticket | 3 days | 6 hours | 1 | 10% |

```yaml
expr: (
        job:slo_errors_per_request:ratio_rate1h{job="myjob"} > (14.4*0.001)
      and
        job:slo_errors_per_request:ratio_rate5m{job="myjob"} > (14.4*0.001)
      )
    or
      (
        job:slo_errors_per_request:ratio_rate6h{job="myjob"} > (6*0.001)
      and
        job:slo_errors_per_request:ratio_rate30m{job="myjob"} > (6*0.001)
      )
severity: page

expr: (
        job:slo_errors_per_request:ratio_rate24h{job="myjob"} > (3*0.001)
      and
        job:slo_errors_per_request:ratio_rate2h{job="myjob"} > (3*0.001)
      )
    or
      (
        job:slo_errors_per_request:ratio_rate3d{job="myjob"} > 0.001
      and
        job:slo_errors_per_request:ratio_rate6h{job="myjob"} > 0.001
      )
severity: ticket
```

The `and` with the short window is a **"still burning"** test. The long window says "enough
budget has gone to matter"; the short window says "and it is still going". Both must be true to
page, and the page clears five minutes after the errors do. The Workbook's description of the
behaviour, which is the mental model to keep:

> *"After experiencing 15% errors for 10 minutes, the short window average goes over the alerting
> threshold immediately, and the long window average goes over the threshold after 5 minutes, at
> which point the alert starts firing. The short window average drops below the threshold 5
> minutes after the errors stop, at which point the alert stops firing. The long window average
> drops below the threshold 60 minutes after the errors stop."*

Its own accounting of the trade: *"Lots of parameters to specify, which can make alerting rules
hard to manage."* Seven windows for two SLIs is fourteen recording rules. That is the price, and
it is paid once.

## Pointing it at `http.server.requests`

The Workbook's expressions reference recording rules — `job:slo_errors_per_request:ratio_rate1h`
— and that is the right structure: compute the ratio once per window, then alert on the recorded
series. For a Spring Boot service the recording rules are the two SLIs from
[08c](08c-slos-and-the-bucket-budget.md) with the window as a parameter. Availability:

```yaml
- record: job:slo_errors_per_request:ratio_rate1h
  expr: |
    sum by (job) (rate(http_server_requests_seconds_count{outcome="SERVER_ERROR"}[1h]))
      /
    sum by (job) (rate(http_server_requests_seconds_count[1h]))
```

Latency, using the SLO bucket at exactly your boundary so the "bad event" is a count, not an
interpolation — a request is bad if it was slow **or** failed:

```yaml
- record: job:slo_latency_errors_per_request:ratio_rate1h
  expr: |
    1 - (
      sum by (job) (rate(http_server_requests_seconds_bucket{le="0.5",outcome="SUCCESS"}[1h]))
        /
      sum by (job) (rate(http_server_requests_seconds_count[1h]))
    )
```

One recording rule per window — `5m`, `30m`, `1h`, `2h`, `6h`, `24h`, `3d` — for each SLI, and
the alert expressions above are pasted verbatim with `0.001` replaced by your own `1 − SLO`. Two
things have to be true in the application for the latency rule to compute anything:

```properties
management.metrics.distribution.slo.http.server.requests=500ms
```

so that a `le="0.5"` bucket exists at all ([08c](08c-slos-and-the-bucket-budget.md)), and the
`uri` tag must be templated so that `sum by (job)` is summing the series you think it is
([06b](06b-the-uri-tag.md)). A boundary the histogram does not publish is an empty series, and an
empty numerator is an alert that never fires — silently.

## When there is not enough traffic for any of this

The Workbook is explicit that the whole method assumes signal:

> *"For example, if a system receives 10 requests per hour, then a single failed request results in
> an hourly error rate of 10%. For a 99.9% SLO, this request constitutes a 1,000x burn rate and
> would page immediately, as it consumed 13.9% of the 30-day error budget. This scenario allows for
> only seven failed requests in 30 days."*

Its four remedies, in its order:

1. **Generate artificial traffic** — *"A system can synthesize user activity to check for potential
   errors and high-latency requests. In the absence of real users, your monitoring system can
   detect synthetic errors and requests."* With the caveat that follows two paragraphs later:
   *"if an issue affects real users but doesn't affect artificial traffic, the successful
   artificial requests hide the real user signal, so you aren't notified that users see errors."*
2. **Combine services** — *"If multiple low-traffic services contribute to one overall function,
   combining their requests into a single higher-level group can detect significant events more
   precisely and with fewer false positives."* The downside it names: *"a complete failure of an
   individual service may not count as a significant event."*
3. **Change the service** so a single failure matters less — *"Modify the client to retry, with
   exponential backoff and jitter"* and *"Set up fallback paths that capture the request for
   eventual execution."*
4. **Lower the SLO or lengthen the window** — with the line that stops this being a monitoring
   decision: *"Lowering the SLO does have a downside: it involves a product decision."*

What it does not offer is a threshold that makes seven-requests-a-month meaningful, because there
is none. The Workbook's closing note is that in practice it uses *"some combination"* of the four.

## Gotchas

**★ The short window is a reset-time fix, not a sensitivity fix.** Adding the `5m` clause does not
make the alert fire sooner — the long window still has to accumulate 2% of the budget. What it
buys is that the page stops five minutes after the incident does, instead of an hour later.

**★ A latency burn rate needs the SLO bucket to exist at exactly the boundary.** The recorded ratio
divides a `le="0.5"` series by a count; if nobody configured
`management.metrics.distribution.slo.http.server.requests=500ms`, the numerator is empty and the
rule is silently inert.

**★ The recording rule fixes the denominator, so decide it there.** Whether failed requests count
as "valid events" in the latency SLI is [08c](08c-slos-and-the-bucket-budget.md)'s argument; the
recording rule is the one place it gets written down, and it is the place a reviewer looks.

**★ Averaging across pods before computing the ratio is right; averaging the ratios is wrong.** Sum
the bad-event rate and the total rate fleet-wide, then divide. A mean of per-pod ratios weights an
idle canary the same as a busy replica ([08](08-percentiles.md) makes the same point about
percentiles).

**★ A burn-rate alert is a ratio alert with the threshold expressed in budget-per-window, and the
same traffic-volume guard applies.** At ten requests an hour one failure is a 1,000× burn rate. The
Workbook's answer is not a smarter threshold — it is more traffic, a bigger unit, or a different
SLO.

**★ Artificial traffic can mask a real outage.** The Workbook's own caveat: successful synthetic
requests hide the real-user signal when an issue affects only real users. Synthetic probes should
be tagged and excluded from the SLI, or counted separately.

**★ The short window's `rate()` needs enough scrapes to be a rate at all.** A five-minute window on
a sixty-second scrape interval has five samples; on a two-minute interval it has two or three, and
`rate()` over two points is noise. Choose the short window and the scrape interval together
([03e](03e-rate-aggregation-and-the-step-registry.md)).

**★ Changing the SLO boundary forks the series the recording rule reads.** `le="0.5"` becoming
`le="0.3"` ends one bucket series and starts another, so every window-length recording rule has a
discontinuity of that window's length. [08c](08c-slos-and-the-bucket-budget.md) says to change
boundaries at the start of a budget period; this is the alerting-side reason.

## Interview questions

**★ Why does the recommended rule check two windows with an `and`?**
Because a one-hour window keeps the alert firing for most of an hour after the incident is over.
The short window — one twelfth of the long one — is a "still burning" test: the long window
establishes that enough budget has been spent to matter, the short window establishes that it is
still being spent, and the page clears as soon as the short window drops below the threshold. It
does not change when the alert *starts*; it changes when it *stops*.

**★ How would you implement the latency half of this for a Spring Boot service?**
With an SLO boundary rather than a percentile: publish a bucket at exactly the promised latency
with `management.metrics.distribution.slo.http.server.requests`, then write a recording rule per
window whose value is one minus the fraction of requests that were both successful and at or below
that boundary. That ratio is an error ratio in the Workbook's sense, so the same burn-rate
thresholds apply unchanged. The two decisions that need writing down are the boundary and whether
failed requests are in the denominator.

**★ A service handles a few hundred requests a day. Can you run burn-rate alerting on it?**
Not as-is, and the Workbook is candid about it: at very low volume a single failure can be a
four-figure burn rate that pages immediately and, at 99.9%, only a handful of failures a month are
allowed at all. The options it gives are to generate artificial traffic so there is a continuous
signal, to combine the service with related ones into a larger monitored unit, to change the
product so one failed request has less user impact — retries, fallbacks — or to lower the SLO or
lengthen the window, which is a product decision rather than a monitoring one. What does not work
is tuning the threshold until it is quiet.

**★ Why recording rules rather than putting the whole ratio in the alert expression?**
Three reasons. The ratio is evaluated for seven windows and two SLIs, and a recording rule computes
each once rather than once per alert evaluation. The recorded series is also what a dashboard and
an error-budget report read, so alert and report agree by construction. And the recording rule is
the one artefact where the SLI's definition — the outcome filter, the boundary, the denominator —
is written down in a form that survives the person who wrote it.

**★ What breaks if the short window is much shorter than a twelfth of the long window?**
It starts to behave like the Workbook's third iteration. A very short window is dominated by a few
scrapes, so a brief lull in errors during a real incident drops it below threshold and the `and`
clears the page while the long window is still well over budget; the alert then flaps. A twelfth
is the guideline because it is short enough to reset promptly and long enough to smooth a single
quiet scrape.

{/* FOOTER */}
