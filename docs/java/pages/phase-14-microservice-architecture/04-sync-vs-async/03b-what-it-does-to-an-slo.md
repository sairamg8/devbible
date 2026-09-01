---
title: "An SLO is a budget and every hard synchronous dependency spends the whole of it, so a 99.9% target behind four dependencies was over-committed before anyone wrote a line of code"
sidebar_label: "06 · What it does to an SLO"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the Google SRE book, "Embracing Risk"
> ([sre.google](https://sre.google/sre-book/embracing-risk/)), and Martin Fowler & James
> Lewis, "Microservices"
> ([martinfowler.com](https://martinfowler.com/articles/microservices.html)).
> 🔴 **Every number here is arithmetic from an assumed input.** Nothing was measured.
> Version spine: JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**The availability product is interesting; the error budget is actionable. Turn `pⁿ` into
minutes per month and the argument stops being an architecture opinion and becomes a
scheduling constraint that a product owner can act on. The result is nearly always the same
and nearly always a surprise: the dependencies alone have already spent the budget, so all
the reliability work planned inside the service is being done against the smallest term in
the equation.**

## Budget, not target

The SRE framing is that an availability target implies an amount of failure you have
*chosen to accept*. At a 99.9% monthly objective over a 30-day month (43,200 minutes), the
budget is:

```text
43,200 × 0.001 = 43.2 minutes of unavailability per month
```

That 43.2 minutes has to cover everything: your bad deploys, your OOMs, your slow queries,
your dependency outages, and the platform's maintenance. It is one pot.

Now put a hard synchronous dependency in front of it. If the dependency also runs at 99.9%,
it spends 43.2 minutes of *its own* budget, and every one of those minutes is also an outage
for you. **One dependency at your own target consumes 100% of your budget on its own.**

| Hard dependencies at 99.9% | Ceiling | Modelled monthly downtime | Multiple of a 43.2-minute budget |
|---|---|---|---|
| 1 | 99.9000% | 43.2 min | 1.00× |
| 2 | 99.8001% | 86.4 min | 2.00× |
| 3 | 99.7003% | 129.5 min | 3.00× |
| 4 | 99.6006% | 172.5 min | 3.99× |
| 5 | 99.5010% | 215.6 min | 4.99× |

The last column is the sentence to say in the meeting: *"with four dependencies at our own
target, we are four times over budget before our service does anything at all."*

## Inverting it: what the dependencies would have to be

The more constructive form of the same arithmetic. Fix the target you want for the
operation, fix n, and solve for the availability each dependency needs:

```text
p = A(target) ^ (1/n)
```

For a 99.9% operation:

| Hard dependencies | Each must be | Its own budget, per 30-day month |
|---|---|---|
| 2 | 99.94999% | 21.61 min |
| 3 | 99.96666% | 14.40 min |
| 4 | 99.97499% | 10.80 min |
| 5 | 99.97999% | 8.64 min |
| 10 | 99.99000% | 4.32 min |

And this still assumes your own service is perfect — it allocates the entire budget to
dependencies and none to you.

Read the n = 5 row carefully. To serve a 99.9% endpoint through five hard dependencies, each
dependency needs to be unavailable **less than nine minutes a month, including deploys**.
For an internal service maintained by a small team on a rolling-update platform, that is a
demanding number, and it is demanded of five teams simultaneously. This is the honest reason
the Guardian's rule — *"one synchronous call per user request"* — is a rule rather than a
guideline.

## The dependency-budget conversation

The arithmetic gives you a concrete thing to ask other teams for, which is much more
productive than asking them to "be more reliable". For an operation with n hard
dependencies and a target A, each dependency's implied budget is
`(1 - A^(1/n))` of the period. That is a number you can put in a table with owners' names
against it.

Three outcomes, all useful:

1. **They can commit to it.** Now you have an explicit inter-team agreement and the
   architecture is defensible.
2. **They cannot commit to it.** You have discovered, cheaply, that the design cannot meet
   the target — before you built it. Remove hops or lower the target.
3. **They have never measured it.** By far the most common. The finding is that your target
   rests on an unmeasured assumption, which is itself worth escalating.

## Where the budget should be spent instead

The uncomfortable implication of the table is about *effort allocation*, and it is the
practical payoff of this chunk.

Suppose your service is at 99.95% on its own and has four hard dependencies at 99.9%. The
composite is `0.9995 × 0.999^4 ≈ 99.5508%`. If you spend a quarter making your own service
99.99% — genuinely hard work — the composite becomes `0.9999 × 0.999^4 ≈ 99.5906%`. You
bought about four one-hundredths of a point.

If instead you convert one of the four dependencies into a soft one — define a degraded
response, hold a local copy, move the call off the request path — the composite becomes
`0.9995 × 0.999^3 ≈ 99.6504%`. That is roughly a tenth of a point: **two and a half times
the gain, and usually a smaller piece of work.** **Removing a term from the product beats improving a term in the
product**, essentially always, because the terms are already close to 1.

This is the arithmetic behind the ordering in
[02 · Design-time and runtime coupling](02-design-time-and-runtime-coupling.md): delete the
hop, then move it off the request path, then degrade. Every one of those removes or softens
a term. Retries, tuning and heroic operational effort improve a term.

## Availability is per operation, and so is the SLO

A common and expensive mistake is to declare one SLO for a service. Availability is a
property of an operation, so a service that exposes `POST /orders` (four hard dependencies)
and `GET /orders/{id}` (its own database only) has two completely different availability
ceilings and needs two SLOs. Averaging them produces a target that is unattainable for the
first and trivially met by the second, and the aggregate metric hides the failure of the one
that matters.

The corollary is that **the read path is usually where the achievable target lives.** If the
business needs "the site stays up", that is mostly a statement about reads, and reads can
often be made to depend on nothing but a local replica. Writes are where you spend
dependencies. Splitting the SLO along that line is frequently the difference between a
target you can hit and one you cannot.

## Gotchas

**★ Publishing a service-level SLO instead of per-operation SLOs hides the endpoint that is
actually failing.** A service at 99.7% aggregate might be 99.99% on its reads and 97% on its
one critical write, and the aggregate looks acceptable while checkout is broken for hours a
month. Any SLO you cannot attribute to a single user-visible operation is a metric, not an
objective.

**★ Error budgets are consumed by *your* dependency's incidents even when you did nothing
wrong, and the budget has no "not our fault" column.** That is the point — the user does not
care whose fault it was. Teams that carve out an exemption for dependency outages have
removed the only forcing function that would have made them reduce the dependency count.

**★ The inversion table assumes you contribute zero unavailability, which no service does.**
Allocate explicitly: decide what fraction of the budget is yours (deploys, bugs, capacity)
and solve for the dependencies with the remainder. If you want 99.9% and take half the budget
yourself, the dependencies must collectively deliver 99.95%, and with four of them each needs
99.98749%. The naive table is already demanding; the honest one is more so.

**★ "We'll add a retry" is offered as an answer and does not fit in the budget.** A retry
recovers a transient fault in milliseconds and does nothing for the multi-minute outages that
consume error budgets. Worse, it spends latency budget, which the endpoint also does not
have. It is a fix for a different problem.

**★ An SLO agreed before the dependency graph existed will be enforced after it does.**
Targets are set early, when the service is one process and a database, and dependencies
accrete quietly over a year. Nobody revisits the arithmetic when the fourth client field is
added. The interaction inventory in [10b](10b-the-interaction-inventory.md) exists to make
the accretion visible while it is happening.

## Interview questions

**★ Your operation has a 99.9% monthly SLO and three hard synchronous dependencies. How much
budget is left for your own service?**
None, and then some. Three dependencies at 99.9% each already model to 99.7003%, which is
129.5 minutes of monthly downtime against a 43.2-minute budget — three times over before
your code runs. The only honest answers are to reduce the number of hard dependencies, raise
the dependencies' availability, or change the objective. There is no allocation of engineering
effort inside the service that reaches the target.

**★ How would you turn the availability product into something another team can act on?**
Invert it. Fix the target and the hop count, compute `A^(1/n)` as the required per-dependency
availability, convert it to minutes per month, and put that number in a table with the owning
team's name beside it. "Please be more reliable" is unactionable; "this endpoint's target
requires you to be unavailable for under 10.8 minutes a month including deploys — can you
commit to that?" gets a real answer, and every one of the three possible answers is useful.

**★ You have a quarter of engineering time. Do you spend it hardening your own service or
removing a dependency?**
Removing a dependency, in nearly every case where the terms are already high. Improving your
own service from 99.95% to 99.99% moves a term that is already near 1 and buys a few
hundredths of a point; removing one hard dependency at 99.9% buys a tenth of a point for less
work. The general rule is that when all terms are close to 1, deleting a term dominates
improving a term, and the arithmetic makes that visible in about two minutes.

**★ Why should availability objectives be per operation rather than per service?**
Because the dependency graph is per operation. A read served from a local database and a
write that fans out to four services have different ceilings, sometimes by two orders of
magnitude, and a single service-level number is an average of two things that should never
have been averaged. The practical consequence is that a service-level SLO will report green
while the operation the business cares about is unattainably behind, and no alert will fire.

**★ Is there a case for accepting the multiplication rather than engineering around it?**
Yes, and Fowler's sentence explicitly allows for it: *"You face a choice, making your calls
asynchronous or managing the downtime."* If the dependency is genuinely required — you cannot
authorise a card payment without the payment processor — then the answer is to manage the
downtime: run redundantly, set a target that reflects reality, define what the user sees when
it fails, and stop pretending the endpoint is more available than its hardest dependency. The
failure is not choosing to accept it; the failure is accepting it without noticing.

{/* FOOTER */}
