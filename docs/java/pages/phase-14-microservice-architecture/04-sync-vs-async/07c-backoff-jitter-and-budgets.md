---
title: "Backoff spreads retries out in time, jitter stops every client from backing off to the same instant, and a token bucket stops the whole thing when it is no longer helping — all three are needed, and the third one is the one nobody implements"
sidebar_label: "33 · Backoff, jitter and budgets"
sidebar_position: 33
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against Marc Brooker, "Timeouts, retries, and backoff with jitter",
> Amazon Builders' Library
> ([aws.amazon.com](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)),
> and the Google SRE book, "Addressing Cascading Failures"
> ([sre.google](https://sre.google/sre-book/addressing-cascading-failures/)).
> 🔴 **No sandbox.** No timing or load figure here was measured; the sources' own examples are
> attributed. Version spine: JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.
> 🔴 **Phase 16 owns Resilience4j.** This chunk covers the *mechanisms and why they exist*; the
> library that implements them is [Phase 16 ·
> Resilience and operations](../../phase-16-resilience-operations/README.md).

**[32](07b-retries-and-amplification.md) established that retries amplify load. This chunk is the
three controls that make them survivable, and the argument for each. Backoff limits the rate at
which one client retries. Jitter stops many clients from retrying in synchrony. A budget stops
retrying entirely when it has stopped helping. Teams routinely implement the first, sometimes the
second, and almost never the third — and the third is the one that determines whether your system
can recover from an overload rather than sustaining it.**

## 1 · Backoff

Brooker states it plainly:

> *"The preferred solution that we use in Amazon is a backoff. Instead of retrying immediately and
> aggressively, the client waits some amount of time between tries. The most common pattern is an
> exponential backoff, where the wait time is increased exponentially after every attempt.
> Exponential backoff can lead to very long backoff times, because exponential functions grow
> quickly. To avoid retrying for too long, implementations typically cap their backoff to a
> maximum value. This is called, predictably, capped exponential backoff."*

and then the problem the cap creates, which is the part usually left out:

> *"However, this introduces another problem. Now all of the clients are retrying constantly at
> the capped rate. In almost all cases, our solution is to limit the number of times that the
> client retries, and handle the resulting failure earlier in the service-oriented architecture.
> In most cases, the client is going to give up on the call anyway, because it has its own
> timeouts."*

**Capped exponential backoff without an attempt limit converts a burst into a permanent elevated
load floor.** Every client parks at the cap and retries at that fixed rate for as long as the
outage lasts. The remedy is an attempt limit, and the justification for the limit is that the
caller's own timeout was going to end the operation anyway.

## 2 · Jitter

> *"When failures are caused by overload or contention, backing off often doesn't help as much as
> it seems like it should. This is because of correlation. If all the failed calls back off to the
> same time, they cause contention or overload again when they are retried. Our solution is
> jitter. Jitter adds some amount of randomness to the backoff to spread the retries around in
> time."*

The SRE book agrees and adds the mechanism by which the correlation forms in the first place:

> *"Always use randomized exponential backoff when scheduling retries. ... If retries aren't
> randomly distributed over the retry window, a small perturbation (e.g., a network blip) can
> cause retry ripples to schedule at the same time, which can then amplify themselves"*

**Deterministic backoff preserves the synchronisation that the fault created.** Every client that
failed at time T retries at T+1s, all together, causing the same overload; then at T+3s, together;
and so on. The system rings. Jitter destroys the correlation, and it costs one line.

Brooker also extends the idea past retries, which is the part worth stealing:

> *"Jitter isn't only for retries. ... When building systems, we consider adding some jitter to
> all timers, periodic jobs, and other delayed work. This helps spread out spikes of work, and
> makes it easier for downstream services to scale for a workload."*

with a specific, non-obvious refinement for scheduled work:

> *"When adding jitter to scheduled work, we do not select the jitter on each host randomly.
> Instead, we use a consistent method that produces the same number every time on the same host.
> This way, if there is a service being overloaded, or a race condition, it happens the same way
> in a pattern. We humans are good at identifying patterns, and we're more likely to determine the
> root cause."*

**Random jitter for retries, host-stable jitter for schedules.** The reason is debuggability: a
randomly jittered cron makes an intermittent overload irreproducible, whereas a host-stable one
makes it a pattern you can recognise.

## 3 · The budget — the control nobody builds

Two independent formulations of the same idea.

Brooker, preferring it over circuit breaking:

> *"Even with a single layer of retries, traffic still significantly increases when errors start.
> Circuit breakers, where calls to a downstream service are stopped entirely when an error
> threshold is exceeded, are widely promoted to solve this problem. Unfortunately, circuit
> breakers introduce modal behavior into systems that can be difficult to test, and can introduce
> significant addition time to recovery. We have found that we can mitigate this risk by limiting
> retries locally using a token bucket. This allows all calls to retry as long as there are
> tokens, and then retry at a fixed rate when the tokens are exhausted. AWS added this behavior to
> the AWS SDK in 2016. So customers using the SDK have this throttling behavior built in."*

The SRE book:

> *"Consider having a server-wide retry budget. For example, only allow 60 retries per minute in a
> process, and if the retry budget is exceeded, don't retry; just fail the request. This strategy
> can contain the retry effect and be the difference between a capacity planning failure that
> leads to some dropped queries and a global cascading failure."*

**Note that Brooker explicitly prefers a token bucket to a circuit breaker**, and gives reasons:
circuit breakers introduce modal behaviour that is hard to test and can lengthen recovery. That is
a genuinely contrarian position relative to most microservice writing, it comes from the
organisation with the most experience of the failure mode, and it is worth carrying into
**37 · Circuit breaking as a consequence** *(not written yet)*.

The property that makes a token bucket better behaved than a breaker: **it degrades continuously
rather than switching state.** As failures rise, the retry rate falls smoothly to a trickle; there
is no open/closed transition to tune, no half-open probing, and no cliff.

## The three together

```java
final class RetryPolicy {

    private static final int MAX_ATTEMPTS = 3;
    private static final Duration BASE = Duration.ofMillis(50);
    private static final Duration CAP  = Duration.ofMillis(800);

    private final TokenBucket budget;          // e.g. 60 tokens/min, refilled steadily
    private final RandomGenerator random;

    RetryPolicy(TokenBucket budget, RandomGenerator random) {
        this.budget = budget;
        this.random = random;
    }

    boolean shouldRetry(int attempt, Duration budgetRemaining) {
        if (attempt >= MAX_ATTEMPTS)            return false;   // 1 — attempt limit
        if (budgetRemaining.compareTo(BASE) < 0) return false;   // latency budget (chunk 32)
        return budget.tryAcquire();                             // 3 — retry budget
    }

    Duration backoff(int attempt) {                             // 2 — capped exponential + full jitter
        long exp = Math.min(CAP.toMillis(), BASE.toMillis() * (1L << (attempt - 1)));
        return Duration.ofMillis(random.nextLong(exp + 1));
    }
}
```

Four controls in twenty lines: an attempt limit, a latency-budget check, a token bucket, and
capped exponential backoff with **full jitter** — the wait is uniform over `[0, exp]` rather than
`exp ± something`, which spreads retries maximally.

🔴 **You should not hand-roll this in production.** Resilience4j provides retry with configurable
backoff and jitter, bulkheads and circuit breakers, and **phase 16 owns it**. The code above exists
to show what the three controls *are*, because a reader who configures a library without knowing
what the parameters mean will pick defaults, and defaults are how the amplification in
[32](07b-retries-and-amplification.md) happens.

⚠️ Note from `_PHASE-NOTES.md` fact 8 that `spring-cloud-circuitbreaker-spring-retry` is
maintenance-only on the current train; Resilience4j is the live implementation.

## Knowing when to stop

Brooker's conclusion is the most actionable sentence in the article:

> *"We avoid this amplification by retrying only when we observe that the dependency is healthy.
> We stop retrying when the retries are not helping to improve availability."*

That is a *measurement-driven* policy, not a static configuration: track the success rate of
retried requests specifically. **If retried requests are succeeding at a similar rate to first
attempts, retries are helping. If retried requests are failing at close to 100%, they are pure
load** and should stop. That metric — retry success rate — is trivially cheap and almost never
collected.

## Gotchas

**★ Capped exponential backoff without an attempt limit is a permanent load floor.** All clients
converge to the cap and retry at that fixed rate for the duration of the outage. Brooker names this
explicitly. Limit attempts and let the failure propagate — the caller's own timeout would have
ended it anyway.

**★ Backoff without jitter preserves the synchronisation that caused the problem.** Every client
that failed together retries together, re-creating the contention at each step. The SRE book calls
these retry ripples and notes they can amplify themselves. Full jitter — a uniform wait over
`[0, exp]` — is one line and is strictly better than a deterministic schedule.

**★ Randomly jittering scheduled jobs makes incidents irreproducible.** For periodic work, use a
jitter derived deterministically from the host identity, so an overload caused by a scheduling
collision recurs as a recognisable pattern instead of at random. This is Brooker's specific
guidance and it is counter-intuitive enough to be worth remembering.

**★ Almost nobody implements a retry budget, and it is the control that decides recovery.**
Backoff and jitter shape *when* retries happen; only a budget bounds *how many*. Without one, a
long outage means sustained amplified load for its entire duration and a thundering recovery at the
end.

**★ Amazon's guidance prefers a token bucket to a circuit breaker, and gives reasons.** Breakers
introduce modal behaviour that is hard to test and can extend recovery time. This contradicts most
microservice writing. It does not mean breakers are wrong; it means the trade is real and the
default choice deserves a moment's thought — **37** *(not written yet)*.

**★ A per-call retry budget is not a budget.** The bucket must be shared across all calls to a
dependency in the process — that is what bounds total amplification. A budget scoped to a single
request permits every request to retry the maximum, which is exactly the situation you were trying
to prevent.

**★ Nobody measures whether the retries are working.** Track the success rate of retried attempts
separately from first attempts. If retries are succeeding, the policy is earning its cost; if they
are failing at nearly 100%, they are pure load on a dependency that is already down, and the
correct action is to stop.

## Interview questions

**★ Why is exponential backoff insufficient on its own?**
Two reasons. Without jitter, all the clients that failed at the same moment back off to the same
moment and retry together, recreating the contention at each step — the SRE book calls these retry
ripples and notes they can amplify themselves. And with a cap but no attempt limit, every client
converges on the maximum backoff and retries at that fixed rate for the whole outage, which is a
permanent elevated load floor rather than a decaying one. You need backoff, jitter and an attempt
limit before the policy is even safe.

**★ What is a retry budget and why does it matter more than backoff?**
A bounded allowance of retries shared across all calls to a dependency within a process — the SRE
book's example is 60 retries per minute, and Amazon's implementation is a token bucket that lets
calls retry while tokens remain and then throttles to a fixed rate. It matters more because backoff
and jitter only shape *when* retries occur; a budget bounds *how many*, which is the quantity that
determines whether an overloaded dependency can recover. It also degrades continuously rather than
switching modes, which makes it easier to reason about than a circuit breaker.

**★ Amazon's guidance prefers a token bucket to a circuit breaker. Why?**
Because breakers introduce modal behaviour that is difficult to test and can add significant time
to recovery — a breaker that opens keeps rejecting until its probe succeeds, and tuning the
thresholds and half-open behaviour is genuinely hard. A token bucket has no modes: as errors rise,
the retry rate falls smoothly to a trickle, with no state transition to get wrong. It is a
contrarian position relative to most microservice writing and it comes from the organisation with
the most experience of the failure mode, so it deserves weight even if you end up choosing a
breaker.

**★ Should you jitter scheduled jobs the same way you jitter retries?**
No. Retries want random jitter, to break the correlation that the fault created. Scheduled work
wants jitter derived deterministically from the host, so that the same host always offsets by the
same amount — because if a scheduling collision causes an overload, a deterministic offset makes it
recur as a recognisable pattern you can debug, whereas random jitter makes it an intermittent
mystery. Brooker's reasoning is explicitly about human pattern recognition during incident
investigation.

**★ How do you know whether your retry policy is helping?**
Measure the success rate of retried attempts separately from first attempts. If retried requests
succeed at a rate comparable to first attempts, the retries are converting transient failures into
successes and are earning their load. If retried requests fail at close to 100%, they are pure
additional load on something that is down, and the policy should stop — which is precisely
Brooker's stated practice of retrying only when the dependency appears healthy and stopping when
retries are not improving availability. The metric costs one counter and is almost never collected.

{/* FOOTER */}
