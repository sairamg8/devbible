---
title: "A web application firewall decides on the shape of a request and never on your data, which makes it a compensating control with a false-positive rate — and because a rule that blocks a legitimate checkout is an outage you caused, invisible in your logs and detectable only in a business metric, every rule starts in log-only mode and is tuned by scope rather than switched off"
sidebar_label: "18b · The WAF and its false positives"
sidebar_position: 18.2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-07. Everything here is **method and common practice** — no primary source
> defines what a managed rule set contains or how it is rolled out, and WAF and CDN vendor
> documentation was **not fetched**, so this page names no vendor, no product, no rule set and no
> figure. The status codes it refers to (413, 429, 431, 503) are quoted verbatim from
> [RFC 6585](https://www.rfc-editor.org/rfc/rfc6585.html) and
> [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) in [18](18-abuse-at-the-edge.md).
> Application-security depth belongs to
> [Part 9](../../syllabus/09-security-and-compliance.md). **No sandbox run; no measurement.**

**A rule layer at the edge decides allow, log, challenge or block on the *shape* of a request
before your code sees it — which makes it fast, makes it blind to everything that depends on your
data, and makes its false positives invisible to you, because a request that was blocked never
arrived to be logged.** That is the whole operational story of a WAF, and it inverts the usual
instinct: the risk you manage is not that the rule misses an attack, it is that the rule stops a
customer while every dashboard you own stays green. So the machinery is built around that
asymmetry — a positive model generated from your own schema wherever the route allows it, a
negative model rolled out in log-only mode and tuned by scope, and an alarm on a business metric
because no technical metric will tell you. [18](18-abuse-at-the-edge.md) is the traffic this layer
sits in, [18c](18c-bots-challenges-and-the-ladder.md) is what to do once a rule has an opinion,
and [18d](18d-abuse-that-is-business-logic.md) is everything this layer cannot see at all.

## The WAF decides on shape, never on state

A web application firewall inspects the parsed request and returns allow / log / challenge /
block. What it can inspect is bounded twice over: it sees only what is decrypted where it sits
([10](10-tls-termination-and-where-it-lives.md)), and only what fits in its buffer — a body larger
than that limit is either forwarded uninspected or rejected, and the honest configuration rejects
it with a size cap rather than pretending to have looked.

| It can decide (shape) | It cannot decide (state) |
|---|---|
| this request matches a known-bad pattern class | whether this caller owns order 1234 |
| this route does not exist, or never uses this method or content type | whether this login is the account's real owner |
| these headers or this body exceed the cap | whether this well-formed search should be allowed to run |
| this source address or network has a reputation | whether these ten valid checkouts are one person |
| this JSON does not match the published schema | whether the price this scraper is reading is worth protecting |

**A WAF is a compensating control.** It buys time against attacks with a recognisable shape, and
against code you have not fixed yet, and it never knows your authorization rules — so "we have a
WAF" is not an answer to an authorization question
([Part 9](../../syllabus/09-security-and-compliance.md)). Everything in the right-hand column is a
decision only your service can make, with your data, which is why it appears in
[18d](18d-abuse-that-is-business-logic.md) rather than here.

## Positive model beats negative model on an API

The strongest rule at the edge of an API is not a pattern list, it is the contract. A **positive
model** derived from your own schema — unknown route, unknown field, wrong type, value out of
range, body over the cap, array longer than the cap, page size over the cap — rejects everything
the API never accepted, before any pattern matching runs. It has almost no false positives,
because it is generated from the spec you already publish, and it removes the entire class of
"input we did not expect" in one step. The **negative model** — pattern blocklists applied to
prose — is where false positives live, because a product review, an address line, a search box and
a support message all legitimately contain text that looks like code. On an HTML site with
free-text fields you need both; on a JSON API the positive model does most of the work, and the
same rules are enforced again at the gateway ([03](03-reverse-proxies-and-api-gateways.md))
because the edge is not the only way in during an incident.

## The false positive is the real operational cost

A rule that blocks a legitimate checkout **is an outage you caused**, and it is invisible: the
request never reached your code, so your error rate does not move, your dashboards stay green, the
customer sees a page you did not write, and the only signal is a business metric. Everything below
follows from that one asymmetry.

```yaml
# the rule set is a reviewed, versioned deploy artifact — the mode field is the entire safety story
rules:
  - id: schema                 # positive model: generated from the OpenAPI contract
    mode: block                # safe to enforce at once; it only rejects what the API never accepted
    scope: "/api/*"
    max_body_bytes: 65536      # over the cap → 413, not "inspected badly"
    max_array_items: 100
    reject_unknown_fields: true
  - id: managed-common
    mode: block                # promoted only after a full business cycle in log mode, sample reviewed
    scope: "/*"
    exclude_fields: [review.body, address.line1, support.message]   # prose false-positives on patterns
  - id: managed-2026-09        # anything the provider added, or we added, in the last two weeks
    mode: log                  # every new rule starts here. always. no exception for "obvious" rules
    scope: "/*"
```

1. **Every rule starts in log-only mode.** Nothing is blocked; the decision is recorded.
2. **Watch a full business cycle** — a week, so weekday, weekend and the monthly batch integration
   all appear — and read a sample of what *would* have been blocked, route by route.
3. **Tune by scoping, never by disabling.** An exception is a route plus a field, not a global off
   switch: the prose fields come out of the pattern rules and everything else stays enforced.
4. **Enforce on the cheapest routes first and on checkout last**, if at all.
5. **Every rule stays individually disableable in seconds**, with a documented one-line change and
   a named person allowed to make it at 3am.
6. **Alarm on two things.** Block rate per rule catches a rule firing too much. Orders per minute
   is the only thing that catches a rule blocking the traffic that pays you.

The shapes that false-positive are worth memorising, because they are the same on every site: a
product description or review containing markup or code-like text; an address line with an
apostrophe or a non-Latin script; an encoded blob in a form field; a file upload; a very long
query string; a locale or currency nobody tested; and a partner integration whose client looks
automated because it *is* automated.

## The rule set is production configuration

It has no type checker, it is frequently edited in a console outside the deploy pipeline, and it
can take the site down in one click — which is a worse change-management story than your
application code has. Treat it as a deploy artifact: in version control, reviewed, deployed by
the same pipeline, with a rollback that has been rehearsed rather than assumed. And keep the edge
decision log flowing into the same store as your application logs with the same request id
([03](03-reverse-proxies-and-api-gateways.md)), because otherwise a blocked request exists in a
system your on-call engineer does not have open at 3am.

## The storefront's rule set

```text
positive       schema rules on /api/*: unknown route, unknown field, wrong type, body over 64 KB
               → 413, array over 100 items, page size over 100. Generated from the API spec, and
               enforced again at the gateway so the edge is not the only thing holding the line.
negative       managed pattern set: block on /*, log-only on anything added in the last two weeks
               prose fields excluded from pattern rules: review.body, address.line1, support.message
checkout       observe and rate-limit only — nothing on that path is allowed to deny
alarms         block rate per rule · orders per minute · a weekly review of the log-mode sample
change         the rule set is in version control, reviewed, deployed, and rollback is one revert
logs           edge decisions shipped to the application log store with the same request id
```

Two rows carry the marks. *"Log-only on anything added in the last two weeks"* is the answer to
"how do you roll out rules without an outage", and *"orders per minute"* is the only line here
that catches a rule blocking exactly the right-looking traffic. The caps are policy choices
matching [07's limits](07-rate-limiting.md) and the gateway's body limit — not measurements.

## Gotchas

**★ Symptom: some customers see an error page you did not write, and your error rate is normal.**
Cause: an edge rule is blocking legitimate requests — the request never reached your code, so it
is in nobody's application log. Fix: ship edge decision logs to the same store with the same
request id; alarm on block rate per rule *and* on orders per minute; start every rule in log-only
mode so it is caught before it blocks anyone.

**★ Symptom: checkout conversion dropped and no technical metric moved.** Cause: a rule on the
payment step failing closed on real customers — a field that legitimately carries an encoded blob,
a locale nobody tested, an address with an apostrophe. Fix: nothing that can deny sits on
checkout; observe and rate-limit only, move the control earlier in the funnel, and treat orders
per minute as a first-class alarm rather than a weekly report.

**★ Symptom: "we have a WAF" and an authorization bug still leaked other customers' orders.**
Cause: expecting a shape-based rule layer to enforce a state-based rule. Fix: object-level
authorization in the service on every read ([18d](18d-abuse-that-is-business-logic.md),
[Part 9](../../syllabus/09-security-and-compliance.md)); the WAF buys time against shaped attacks,
it does not decide ownership and never will.

**Symptom: a false positive was fixed by turning the rule off everywhere.** Cause: an exception
scoped to the site rather than to the route and the field that actually false-positived. Fix:
scope exclusions to route plus field — prose fields out of the pattern rules, everything else
still enforced.

**Symptom: uploads got slower after body inspection was enabled.** Cause: the edge buffers the
body in order to inspect it, so a streamed upload became a buffered one and time to first byte
grew ([01](01-from-the-tap-to-the-first-byte.md)). Fix: exclude the upload route from body
inspection and enforce a size cap instead — 413 is an honest answer, "inspected the first part"
is not.

**Symptom: a managed rule set updated itself and started blocking a working route.** Cause:
provider rule updates apply automatically to rules that are already enforcing. Fix: stage new
managed rules in log mode where the provider allows it, alarm on a change in block rate per rule,
and keep the documented disable path — the promotion is gated on a review, not on a date.

**Symptom: a rule change at 2am took the site down and nobody could roll it back.** Cause: rules
edited in a console, outside version control, by someone who is not on call. Fix: the rule set is
a reviewed, versioned artifact deployed by the pipeline, with a one-line documented rollback and a
named owner.

**Symptom: a rule keyed on a header that clients set themselves.** Cause: self-declared input used
as identity. Fix: identity comes from authentication or from verified network properties;
self-declared headers are signals worth scoring, never controls worth enforcing.

**Symptom: the schema rules were only at the edge, and an incident bypass let malformed requests
into the services.** Cause: one enforcement point for a rule that costs almost nothing to repeat.
Fix: validate against the contract at the gateway as well; the edge is an optimisation, the
gateway is the boundary.

## Interview questions

**★ How do you roll out a WAF rule set without causing an outage?**
Every rule enters in log-only mode and blocks nothing. It stays there for a full business cycle,
so weekday, weekend and monthly batch traffic all appear, and someone reads a sample of what would
have been blocked, route by route. Tuning is done by scoping exceptions to a route and a field —
prose fields like a review body or an address line come out of the pattern rules — never by
disabling a rule globally. Enforcement is enabled on cheap routes first and on checkout last or
not at all. Every rule stays individually disableable in seconds with a documented change and a
named person allowed to make it. And two alarms: block rate per rule, which catches a rule firing
too much, and orders per minute, which is the only signal that catches a rule blocking the traffic
that pays you.

**★ What can a managed rule set decide, and what can it not?**
It decides on shape: this request matches a known-bad pattern, this route does not exist, this
method or content type is never used here, these headers or this body exceed the cap, this source
has a reputation, this JSON does not match the published schema. It cannot decide anything
requiring your data — whether this caller owns order 1234, whether this login is the real account
owner, whether this perfectly-formed search should be permitted, whether ten valid checkouts are
one person. It also sees only what is decrypted where it sits and only what fits in its inspection
buffer, so an oversized body is either passed uninspected or rejected on size. It is therefore a
compensating control that buys time against shaped attacks, while authorization and business
limits stay in the service.

**★ Positive or negative security model — which do you reach for on an API?**
The positive one: generate the rules from the API contract, so unknown routes, unknown fields,
wrong types, out-of-range values, oversized bodies and over-long arrays are rejected at the edge
before anything else runs. It is nearly false-positive free because it is derived from the spec
you already publish, and it removes the whole class of unexpected input in one step. The negative
model — pattern blocklists — is still worth having for shapes a schema cannot express, but it is
where the false positives come from, because free-text fields legitimately contain text that looks
like code; so those fields are excluded and the rules roll out in log mode first. On an HTML site
with prose fields you run both; on a JSON API the schema does most of the work, and it is enforced
again at the gateway.

**How would you know your WAF is blocking real customers?**
Not from your application logs, which is the point: a blocked request never reached the
application, so error rate, latency and even total request count look normal or better. Three
things make it visible. The edge's own decision log, shipped into the same store as application
logs with the same request id, so a support ticket with a reference id can be traced. An alarm on
block rate per rule, which catches a rule that started firing after a provider update or a
release. And an alarm on a business metric — orders per minute, signups per minute — which is the
only signal that fires when a rule blocks precisely the traffic that looks legitimate, because by
definition every technical indicator stays green while that happens.

← Prev: [18 · Abuse at the edge](18-abuse-at-the-edge.md) · Index: [Phase 2 — The request path](README.md) · Next → [18c · Bots, challenges and the ladder](18c-bots-challenges-and-the-ladder.md)
