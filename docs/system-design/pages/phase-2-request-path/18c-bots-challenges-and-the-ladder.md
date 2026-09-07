---
title: "Bot handling is never a verdict because the signal is never certain, so the response is a ladder — observe, slow, degrade, challenge, block, drop — climbed only as far as the confidence justifies, since a challenge is reversible in seconds while a block is a customer lost silently, and the automation you depend on is the reason a verified allowlist exists at all"
sidebar_label: "18c · Bots, challenges and the ladder"
sidebar_position: 18.4
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-07. Bot scoring, challenge mechanics, allowlist verification and per-request
> edge pricing are **method and common practice** — bot-management, CDN and challenge-provider
> documentation was **not fetched**, so this page names no vendor, no product, no scoring scheme
> and no figure. The one normative sentence is
> [RFC 6585](https://www.rfc-editor.org/rfc/rfc6585.html) §7.3, quoted verbatim below; the status
> codes are quoted in [18](18-abuse-at-the-edge.md). Forward-confirmed reverse DNS is described as
> the mechanism it is, without citing a specification. **No sandbox run; no measurement.**

**You cannot reliably tell an automated client from a person, so stop trying to produce a verdict
and produce a response proportional to your confidence instead.** That is the ladder: observe,
slow, degrade, challenge, block, drop — each rung cheaper for you and more expensive for a
mistaken customer than the one above it. The design instinct it replaces is the binary one, "is
this a bot, yes or no", which forces every uncertain case into a decision that cannot be walked
back. And the ladder has a second half that candidates forget entirely: much of the automation
hitting your site is automation you *depend on* — search crawlers, uptime monitors, your own
health checks, the payment provider's webhook — so the allowlist, and how you verify entries on
it, is part of the design rather than an afterthought.
[18b](18b-the-waf-and-its-false-positives.md) is the rule layer that produces the signal; this
page is what you do with it, and what the whole apparatus costs.

## The ladder

| Rung | Response | Reversible? | A false positive costs | Fits |
|---|---|---|---|---|
| observe | serve normally, score and log | yes | nothing | always — the baseline |
| slow | rate-limit, queue, add delay ([07](07-rate-limiting.md)) | yes | a slower page | expensive but plausibly real traffic |
| degrade | serve the cached or reduced version — no search, no personalisation | yes | a smaller product | reads that are cheap to serve stale ([05](05-cdns.md)) |
| challenge | an interstitial that must be passed | yes, in seconds | seconds — plus the users who cannot pass it at all | anonymous HTML routes with real abuse |
| block | 403 and a generic page | no | the customer is gone, silently | high confidence *and* high harm |
| drop | no response at all | no | the same, but cheaper for you | a flood, where answering is itself the cost |

**Match the cost of being wrong to the confidence of the signal.** A challenge is preferred to a
block because it degrades rather than denies and it corrects itself: a real person pays a few
seconds and continues, whereas a block has no path back and produces a support ticket you cannot
debug, because the request never reached your logs. The bottom rung is the one with an RFC behind
it:

> *"Servers are not required to use the 431 status code; when under attack, it may be more
> appropriate to just drop connections, or take other steps."* — RFC 6585, §7.3

Read as policy: a status code is a contract with a client that intends to obey it, so it is worth
rendering for traffic you believe is real. For volume you have already decided is abusive, the
cheapest correct action is no answer at all.

## What a challenge costs

- **Accessibility** — some people cannot complete some challenges. On a required path that is a
  barrier, and in some jurisdictions an exposure. This is the reason a challenge is never the
  only route through a critical flow.
- **Conversion** — an interstitial on a checkout costs orders, and the loss appears in a business
  metric rather than an error rate. Challenges belong early in the funnel, never on the payment
  step.
- **Non-browser clients** — your mobile app, a partner's server-to-server integration and every
  API client cannot render an interstitial. Challenging `/api/*` breaks integrations instead of
  stopping abuse; API routes get authentication, schema rules and per-user limits
  ([07](07-rate-limiting.md)) instead.
- **A third party and a privacy review** — a challenge usually means a third-party script and a
  data flow somebody has to sign off, which is a design constraint in some jurisdictions rather
  than a formality.
- **A dependency on the request path** — the challenge provider is now serial with your site.
  Decide its failure mode before you need it: fail open.
- **A metric you must actually watch** — challenge *pass rate*, per route and per client type.
  A rung that silently stops passing is a block with extra steps.

## Good bots are why the allowlist exists

Search crawlers, uptime monitors, your own synthetic checks and health probes, the payment
provider's webhook, link previewers and partner integrations are all automated, all legitimate,
and all look exactly like what you are trying to stop. Blocking the crawlers is an outage
discovered weeks later in your search traffic, not minutes later on a dashboard, which makes it
one of the few failures on these pages with no alarm unless you build one.

They are identified by something better than a user agent — a user agent is self-declared and
worth nothing as a control — which in practice means **published address ranges** plus
**forward-confirmed reverse DNS**: resolve the connecting address to a name, resolve that name
back to addresses, and require the original address to be among them, so that a claimed identity
has to be backed by records the claimed owner controls. And note the liability the allowlist
creates: an entry that matches too broadly is a hole punched through every rule beneath it, so
entries stay narrow, are scoped to the rules they actually need to bypass, and are reviewed on a
schedule. `robots.txt` is not in this section at all — it is a request to crawlers that choose to
read it, with no enforcement behind it.

## What the whole apparatus costs

- **Latency** — one more inspection stage on every request, and body inspection means buffering
  the body before forwarding, which turns a streamed upload into a buffered one
  ([01](01-from-the-tap-to-the-first-byte.md)).
- **Money, and it scales with the attack** — inspection and challenges are typically priced per
  request, so the bill rises exactly when the traffic does. Unbounded spend under load is its own
  failure mode: the answer is a budget cap and an alarm alongside the scaling policy, plus a cheap
  drop rule for the highest-volume signature, because dropping is cheaper than answering.
- **A false-positive rate, paid in revenue, silently** ([18b](18b-the-waf-and-its-false-positives.md)).
- **A configuration surface** with no type checker that can take the site down in one click.
- **A dependency on the request path** — the decision layer and the challenge provider are now
  boxes on [phase 1's failure walk](../phase-1-the-method/11-bottlenecks-and-single-points-of-failure.md),
  and a serial component's availability multiplies into yours
  ([phase 1](../phase-1-the-method/02-non-functional-requirements.md)).

**So choose fail-open or fail-closed per control, before the outage.** Abuse controls fail open —
admit and log — with the global shed as the backstop ([07](07-rate-limiting.md),
[18e](18e-degrading-instead-of-falling-over.md)), because a control that fails closed converts its own
dependency's outage into yours: the abuse is a risk, the outage is a certainty. Only a control
standing in front of a correctness invariant or a legal boundary fails closed, and those are named
individually rather than adopted as a default.

## The storefront's ladder

```text
anonymous HTML   /products, /search: observe → rate-limit (per IP 1,000/min, burst 200, from 07)
                 → challenge above that. Degrade before challenging: cached page, no facets.
/api/*           observe → rate-limit per user → 403. No challenges: the mobile app and the
                 partner integrations cannot render one, so a challenge here is an outage.
checkout         observe and rate-limit only. Nothing on the payment path is allowed to deny;
                 sale-day pressure is handled by admission on the resource, not by a challenge.
allowlist        verified crawlers (published ranges + forward-confirmed reverse DNS), our own
                 synthetic checks, the payment provider's webhook source. Narrow, scoped to the
                 rules they need to bypass, reviewed quarterly.
shared addresses an office, a carrier NAT or a campus is many customers behind one address, so
                 blocks and bans there are short-lived and low-confidence only (07's NAT problem)
alarms           challenge pass rate per route · crawl rate · block rate per rule · orders/min
fail mode        rule engine and challenge provider both fail open; the global shed is the backstop
```

The `/api/*` row and the `checkout` row are the two that answer "where do challenges belong": on
anonymous HTML, and nowhere else. The `shared addresses` row is the one that keeps a blunt rung
from turning a whole building into a support ticket.

## Gotchas

**★ Symptom: search traffic collapsed a month after the bot rules went live.** Cause: crawlers
were challenged or blocked, and nothing alarms on crawl rate, so the failure surfaced in a
business report weeks later. Fix: a verified good-bot allowlist by published range and
forward-confirmed reverse DNS, never by user-agent string, plus a crawl-rate panel beside the
block-rate panel.

**★ Symptom: the mobile app broke when challenges were enabled.** Cause: a challenge on API
routes, which no non-browser client can render — the app receives an interstitial where it
expected JSON. Fix: challenges on anonymous HTML routes only; API routes get authentication,
schema rules and per-user limits.

**★ Symptom: the challenge provider was unreachable and the site stopped serving.** Cause: a
fail-closed dependency on the request path. Fix: the challenge fails open — serve the page,
score and log — with the rate limiter and the global shed as the backstop; decide this before the
outage, not during it.

**Symptom: an allowlist entry became the way in.** Cause: an entry that matched too broadly — a
user-agent string, or a whole network — bypassing every rule beneath it. Fix: narrow, verified
entries; verify by published range and forward-confirmed reverse DNS; scope the bypass to the
rules it actually needs; review on a schedule.

**Symptom: bot thresholds were tuned once and never revisited.** Cause: a static cut-off against
a traffic mix that changes with every release, campaign and new client version. Fix: review the
score distribution per route on a schedule, and keep the ladder rather than a single cut-off, so
a drifting score degrades traffic before it denies it.

**Symptom: real users stopped passing the challenge and nobody noticed.** Cause: no metric on
challenge outcomes — only on how many were issued. Fix: alarm on challenge pass rate per route
and per client type; a rung that stops passing has quietly become a block.

**Symptom: a block on one address locked out an entire office.** Cause: a blunt key at the top of
the ladder, where many customers share one address behind a NAT ([07](07-rate-limiting.md)). Fix:
short expiries and high confidence for blocks on shared addresses; prefer the lower rungs there,
and key on the account once the caller is authenticated.

**Symptom: the month's bill exceeded the outage it prevented.** Cause: per-request inspection and
challenge pricing scaling with the flood, on top of autoscaling. Fix: a spend cap and a budget
alarm as part of the design, plus a cheap drop rule for the highest-volume signature — §7.3's
point that dropping is cheaper than answering, applied to the invoice.

**Symptom: a "block the country" rule stopped the abuse and also the customers.** Cause: a coarse
proxy — geography, an autonomous system, a whole network — standing in for a behaviour you did not
measure. Fix: climb the ladder on behaviour and cost instead; geography only as a temporary,
reviewed measure with an expiry on it and a named owner, because the customers it removes are
permanent and the abuse it removes is not.

**Symptom: the ladder had two rungs, allow and block.** Cause: treating an uncertain signal as a
verdict. Fix: add the middle — rate-limit, degrade to a cached or reduced response, challenge —
so that an uncertain case gets a reversible answer and only a confident, harmful one gets a
terminal answer.

## Interview questions

**★ Why is a challenge better than a block, and when is it the wrong tool?**
Because the response should cost what the confidence justifies. A challenge degrades rather than
denies and is self-correcting: a real person pays a few seconds and continues, whereas a block has
no path back and produces a support ticket you cannot debug, since the request never reached your
logs. It is the wrong tool on any non-browser client — a mobile app or a server-to-server
integration cannot render an interstitial, so challenging API routes breaks integrations instead
of stopping abuse — and it is the wrong tool on a checkout, where it costs orders and the damage
shows up in conversion rather than in an error rate. It also carries an accessibility cost, a
third-party dependency and a privacy review, and it needs its own metric: challenge pass rate,
because a rung that stops passing has silently become a block.

**★ What does the edge's abuse apparatus cost, and how do you justify it?**
Latency, from an extra inspection stage and from buffering bodies that would otherwise stream.
Money, priced per request, so the bill rises with the attack — which needs a spend cap and an
alarm, not just an autoscaling policy. A false-positive rate paid in revenue, invisible unless a
business metric is wired to an alarm. A configuration surface with no type checker that can take
the site down in one click. And one more serial dependency on the request path, whose availability
multiplies into yours. Justify it by the class of traffic it actually removes — repeat reads,
shaped attacks, blunt volume — and be explicit about what it does not remove, which is everything
in [18d](18d-abuse-that-is-business-logic.md).

**★ Should abuse controls fail open or fail closed?**
Open, for almost all of them, and say why: a rule engine, a bot scorer or a challenge provider
that fails closed turns its own dependency's outage into yours, and the traffic it was protecting
against is a risk while the outage is a certainty. The backstop when they fail open is the global
load shed — 503 with `Retry-After` above a concurrency threshold — which needs no external state
to work, plus per-user limits at the gateway if its store is reachable. The exception is any
control standing in front of a correctness invariant or a legal boundary, where serving the
request wrongly is worse than not serving it; those fail closed and are named individually.

**How do you tell a good bot from a bad one?**
Not by the user-agent string, which is self-declared and therefore a hint rather than a control.
The automation you depend on — search crawlers, uptime monitors, your own synthetic checks, the
payment provider's webhooks, partner integrations — is verified either by published address ranges
or by forward-confirmed reverse DNS: resolve the connecting address to a name, resolve that name
back, and require the original address to be among the results, so the claim is backed by records
the claimed owner controls. The allowlist entry is then scoped narrowly, to the rules it needs to
bypass, and reviewed on a schedule, because an over-broad entry is a hole through everything
beneath it. The failure that makes this worth doing properly is blocking the crawlers: an outage
you discover weeks later in your search traffic.

**Someone says "block the bots". What do you say back?**
Three questions, then a ladder. Which automation — because some of it is search crawlers and your
own health checks, and blocking those is an outage with a long detection time. What is the harm —
scraping a cached catalogue costs an edge hit and nothing else, whereas the same client on
uncached search costs a database, so the response should follow the cost rather than the label.
And how confident is the signal — because if it is a score rather than a certainty, the answer is
observe, rate-limit or degrade, all of which are reversible, and a block only where confidence and
harm are both high. Then say the ladder, name the allowlist, and put the whole thing on anonymous
HTML routes rather than on the API or the checkout.

**Where does the ladder sit relative to rate limiting?**
Rate limiting is one rung of it, and [07](07-rate-limiting.md) owns the algorithms — token bucket,
sliding counter, the shared store, the 429 contract. This page is the layer above: what to do when
the limit is not the right answer, either because the traffic is below every limit and still
abusive, or because it is above the limit and you want something gentler or harsher than a 429.
The rungs below rate limiting are observation and degradation, the rungs above are challenge,
block and drop, and the whole ladder is chosen per route rather than globally.

← Prev: [18b · The WAF and its false positives](18b-the-waf-and-its-false-positives.md) · Index: [Phase 2 — The request path](README.md) · Next → [18d · Abuse that is business logic](18d-abuse-that-is-business-logic.md)
