---
title: "Versioning strategy and lifecycle"
sidebar_label: "13 · Versioning strategy"
sidebar_position: 13
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Framework 7.0.8 reference,
> *Web MVC → MVC Config → API Versioning* (docs.spring.io — the four resolution
> strategies `useRequestHeader`, `useQueryParam`, `usePathSegment` and
> `useMediaTypeParameter`; `usePathSegment` requiring the segment to be declared
> as a URI variable; the default semantic version parser with `ApiVersionParser`
> as the extension point; `ApiVersionDeprecationHandler` and its standard
> implementation setting RFC 9745 `Deprecation`, RFC 8594 `Sunset` and `Link`
> headers; and `InvalidApiVersionException` producing HTTP 400), RFC 9745
> (the `Deprecation` header field) and RFC 8594 (the `Sunset` header field).
> Spring Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**Choosing where the version lives is the decision on this page that you cannot
walk back, because it is encoded in every client integration ever written
against the API. Choosing when to *create* a version is the decision that
determines how expensive the API is to maintain for the rest of its life — and
it is the one almost everybody gets wrong in the same direction, by versioning
changes that were already backwards-compatible.**

## Which resolution strategy

The four strategies are not equivalent, and none is universally right.

**Header — `API-Version: 1.2`**
Keeps the URL identifying the *resource* rather than the resource-plus-version,
which is the position REST purists argue for and which keeps caches keyed on the
thing itself. The costs are practical: invisible in a browser address bar,
awkward in a `curl` typed from memory, and easy for an intermediary to strip.
This is the strategy the reference uses in its own example.

**Query parameter — `?version=1.2`**
Visible, trivially testable in a browser, and the hardest for a client to get
wrong. It muddies the URL and gives one resource many URLs, which matters to
caches and to anything treating the URL as identity.

**Path segment — `/v1/orders`**
By far the most common in the wild, because it is impossible to misconfigure and
obvious in a log line. It is also the least theoretically clean: the version is
not part of the resource's identity, and routing, documentation and generated
clients all end up duplicated per version. Mechanically it requires the segment
to be declared as a URI variable — `usePathSegment(0)` against a mapping like
`/{version}/orders` — not written as a literal.

**Media type parameter — `Accept: application/json;version=1.2`**
The most correct by the letter of HTTP, since it is genuinely content
negotiation, and the most likely to be mangled by a client library or a proxy
that rewrites `Accept`.

The defensible summary: **path segments when your consumers are many and
unsophisticated; a header when they are few and you control them.** What matters
far more than the choice is that there is exactly one — an API where some
endpoints version by path and others by header is worse than either option,
because no client can hold a single rule in mind.

## Version format and parsing

Versions are parsed **semantically** by default, so `"1.10"` correctly sorts
above `"1.9"` rather than lexicographically below it. `ApiVersionParser` is the
extension point when your scheme is something else.

**Date-based versioning** is worth knowing because several large public APIs use
it: the version is the date the contract was fixed, which removes all argument
about whether a change counts as major or minor, and makes "pin to the date you
integrated" the client's natural behaviour. It needs a custom parser; the
comparison and precedence semantics are otherwise identical.

**Integer versioning** — `1`, `2`, `3` — is the other common alternative, and it
is an honest fit for path-segment strategies where `/v2/` is the whole version.
It also removes the temptation to publish a minor version for a change that
needed no version at all.

## Deprecating a version properly

```java
configurer.useRequestHeader("API-Version")
          .setDeprecationHandler(deprecationHandler);
```

`ApiVersionDeprecationHandler` sends deprecation information to clients, and the
standard implementation sets the headers the RFCs define:

| Header | RFC | Says |
|---|---|---|
| `Deprecation` | RFC 9745 | this version is deprecated, and optionally since when |
| `Sunset` | RFC 8594 | the date after which it stops working |
| `Link` | — | where to read about the replacement |

This matters more than it appears. The usual way an API version gets retired is
an announcement emailed to an address that bounced, followed months later by an
outage. Headers on **every response** reach the machine that is actually calling
you, which is the only place the information can act — and they make "we told
you" a verifiable property of the traffic rather than a claim about a mailing
list.

The practical sequence: set `Deprecation` as soon as the replacement is
available, add `Sunset` with a real date once you have decided one, and leave
both in place for the whole notice period. A `Sunset` date that arrives without
having been served for months is not notice.

## Failure modes

A request carrying an unsupported version is rejected with
**`InvalidApiVersionException`**, which maps to **HTTP 400**.

That is a meaningfully better outcome than what it replaces. A `params`
condition on an unsupported version degrades to 404 — indistinguishable from a
mistyped URL — and an unknown path prefix does the same. A 400 naming the
version tells the client precisely what to change, which is the difference
between a five-minute fix and a support ticket.

⚠️ Verify the *missing* version case against your own configuration rather than
assuming it. Whether an absent version is an error at all depends on how
`setVersionRequired` and `setDefaultVersion` interact, and the reference
documents the 400 explicitly for the **invalid** case. A default version makes
unversioned requests legal by definition; requiring a version makes them a
failure. Decide which you want deliberately, because it determines what happens
to every client written before you introduced versioning.

## The trade-off: versioning is a cost you pay forever

Every version you publish is a contract you support until you retire it, and
retiring it requires other people to act. Two consequences are consistently
underestimated:

- **The handlers are the cheap part.** The expensive part is the branching that
  spreads *behind* them — services and repositories acquiring version-conditional
  behaviour, test matrices multiplying, and every subsequent bug fix requiring a
  decision about which versions receive it. That decision is made by whoever is
  fixing the bug, usually without full context, and it is where versioned
  systems quietly diverge.
- **Baseline (`"1.2+"`) mappings are the main defence**, because one handler
  keeps serving every later version until something supersedes it, which
  confines divergence to the edge where you can see it.

**The cheapest version is the one you did not create.** Additive changes — a new
optional field, a new endpoint, a newly-accepted optional parameter, a widened
input — break no conforming client and need no version at all. A surprising
proportion of versioning effort goes into versioning changes that were already
backwards-compatible, usually because "we changed the API" got treated as
synonymous with "we broke the API".

The test worth applying before creating a version: *would an existing client,
written correctly against the current contract, still work?* If yes, ship it
without a version and save everyone the decade of maintenance.

## Gotchas

**Symptom:** `usePathSegment(0)` never resolves a version
**Cause:** the mapping does not declare the segment as a URI variable, so there is no `/{version}` template variable for the strategy to read — it was written as a literal `/v1`
**Fix:** include the variable in the pattern, typically as a class-level `@RequestMapping("/{version}/orders")`, so the segment exists as something the resolver can extract

**Symptom:** clients pinned to an old version are surprised by its removal despite having been "told"
**Cause:** deprecation was communicated out of band — an email, a changelog entry, a blog post — rather than on the responses their software was receiving
**Fix:** configure an `ApiVersionDeprecationHandler` so every response carries `Deprecation`, `Sunset` and `Link`. It reaches the machine making the calls, and it turns the notice into a verifiable property of the traffic

**Symptom:** a `Sunset` date arrives and clients break, having had the header for two days
**Cause:** the deprecation headers were added at the end of the notice period rather than the start, so the mechanism was present but the notice was not
**Fix:** set `Deprecation` as soon as a replacement exists, add `Sunset` once a date is decided, and serve both for the whole period. The header is only notice for as long as it has been served

**Symptom:** `"1.10"` is treated as older than `"1.9"`
**Cause:** a custom `ApiVersionParser` comparing lexicographically; the default parser is semantic and orders these correctly
**Fix:** use the default parser unless the scheme genuinely is not semantic. If it is date- or integer-based, implement the parser so comparison is numeric rather than string-based — this is the single most common bug in a hand-written version parser

**Symptom:** clients that predate versioning start failing after it is switched on
**Cause:** `setVersionRequired(true)` with no default version makes an absent version an error, and every pre-existing client sends no version
**Fix:** set a `setDefaultVersion` naming the contract those clients were written against, so unversioned requests keep resolving to the behaviour they already depend on. Requiring a version is a reasonable end state, but it is a migration, not a switch

**Symptom:** the codebase has three copies of every handler, and a bug fixed in one reappears from another
**Cause:** each version got its own handler, so divergence spread behind the controller into services and repositories, and nothing indicates which copies a given fix belongs in
**Fix:** use baseline `"1.x+"` mappings so one handler serves every version from that point on, and create a new version only when the *contract* changed rather than when the implementation did

**Symptom:** the API is on v4 after eighteen months and no client has ever had to change
**Cause:** versions are being created for backwards-compatible changes — new optional fields, new endpoints — because any change to the API was treated as a breaking one
**Fix:** apply the test before creating a version: would a correctly-written existing client still work? If yes, ship it unversioned. Each unnecessary version is a contract you have volunteered to support indefinitely

## Interview questions

**★ Which version resolution strategy would you choose, and why?**
Four are available — request header, query parameter, path segment and media
type parameter — and none is universally right. A header keeps the URL
identifying the resource rather than the resource-plus-version, which is
cleanest in principle and keeps caching keyed on the thing itself, but it is
invisible in a browser and easy for an intermediary to strip. A path segment is
by far the most common because it is impossible for a client to get wrong and
obvious in logs, at the cost of duplicating routing, documentation and generated
clients per version. The media type parameter is the most correct by the letter
of HTTP and the most likely to be mangled by a proxy that rewrites `Accept`. My
rule of thumb is path segments when consumers are many and unsophisticated, a
header when they are few and I control them — but what matters far more is
choosing exactly one, because an API that versions some endpoints by path and
others by header gives clients no single rule to follow.

**★ How should a version be deprecated?**
On the responses, not by email. Configuring an `ApiVersionDeprecationHandler`
makes every response to a deprecated version carry the standard headers —
`Deprecation` from RFC 9745 saying it is deprecated, `Sunset` from RFC 8594
giving the date it stops working, and a `Link` to the replacement. That reaches
the machine actually making the calls, which is the only place the information
can act, and it makes the notice a verifiable property of the traffic rather
than a claim about a mailing list that may have bounced. Timing matters as much
as mechanism: the headers have to be served for the whole notice period, because
a `Sunset` header added two days before the date is a mechanism without a
notice.

**★ What happens when a client requests an unsupported version?**
It is rejected with `InvalidApiVersionException`, which maps to HTTP 400. That
is a real improvement over what it replaces: a `params` condition on an
unsupported version degrades to a 404 indistinguishable from a mistyped URL, and
so does an unknown path prefix, whereas a 400 naming the version tells the
client exactly what to change. The case I would verify against my own
configuration is a *missing* version rather than an invalid one, because whether
an absent version is an error at all depends on how `setVersionRequired` and
`setDefaultVersion` are set — and that interaction decides what happens to every
client written before versioning was introduced.

**★ When should you not create a new version?**
Whenever the change is backwards-compatible, which is far more often than people
assume — adding an optional field, adding an endpoint, accepting a new optional
parameter, or widening what you accept all break no conforming client. The test
I apply is simply: would an existing client, written correctly against the
current contract, still work? If yes, ship it unversioned. The reason to be
strict is that the handlers are the cheap part; the expensive part is the
version-conditional branching that spreads behind them into services and
repositories, the multiplying test matrix, and every future bug fix requiring
someone to decide which versions get it — a decision usually made without full
context, which is where versioned systems quietly diverge. The cheapest version
is the one never created; the second cheapest is a baseline mapping that keeps
one handler serving many.

**★ How do you keep a versioned codebase from becoming three copies of everything?**
Baseline mappings, and discipline about what warrants a version. A `"1.2+"`
mapping keeps one handler serving 1.2 and everything above it until something
explicitly supersedes it, so the divergence stays at the edge where it is
visible rather than propagating into services and repositories. Beyond that, the
main lever is not creating versions for changes that did not break anything.
Once version-conditional logic is behind the controller you have lost the
property that made versioning tractable — that the difference between versions
is a small, inspectable set of adapters — and every bug fix becomes a question
about coverage rather than correctness.

---

← Prev: [API versioning: the mechanism](12-api-versioning.md) · Index: [Phase 9 — Spring Boot and the web](../README.md)
