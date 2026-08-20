---
title: "Locking it down: heapdump, access and the management port"
sidebar_label: "18 · Locking it down"
sidebar_position: 18
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-20 against the Spring Boot 4.1.0 reference — *Actuator ·
> Endpoints* (docs.spring.io/spring-boot/reference/actuator/endpoints.html:
> *"By default, access to all endpoints except for `shutdown` and `heapdump` is
> unrestricted"*; the `NONE` / `READ_ONLY` / `UNRESTRICTED` access values;
> `management.endpoint.<id>.access`, `management.endpoints.access.default` and
> `management.endpoints.access.max-permitted`, of which the reference says
> *"This property takes precedence over the default access or an individual
> endpoint's access level"*; *"Inaccessible endpoints are removed entirely from
> the application context"*; `management.endpoints.web.exposure.include`
> defaulting to `health`, with `exclude` taking precedence over `include`; the
> `/actuator` discovery page and `management.endpoints.web.discovery.enabled`;
> and `heapdump` returning an HPROF file on HotSpot) and the Spring Boot 3.5
> release notes (github.com/spring-projects/spring-boot/wiki, *"The `heapdump`
> actuator endpoint now defaults to `access=NONE`"*). The exposure figures cited
> below are from Wiz's published survey of internet-exposed Spring Boot Actuator
> deployments (wiz.io/blog/spring-boot-actuator-misconfigurations) — vendor
> research, named as such, not primary documentation. Spring Boot 4.1.0, Spring
> Framework 7.0.x, JDK 25.

**🔴 `GET /actuator/heapdump` returns a file containing everything in the
process's memory. Not a summary of it — the objects themselves. Every database
password the connection pool is holding, every API key read from the environment,
every JWT and session token from every request in flight, every row of personal
data currently loaded. It is one unauthenticated HTTP GET and a `strings` command
away from being a complete credential dump, and it needs no exploit, no
vulnerability and no privilege, because the endpoint is working exactly as
designed. Everything else in this chunk follows from taking that seriously.**

## The endpoint that ends the argument

The attack has no clever part. Fetch the file, run `strings` over it, grep for
the shapes secrets come in — `AKIA` for AWS access keys, `eyJ` for JWTs, cookie
names, connection-string prefixes. Wiz's published survey of internet-exposed
Spring Boot Actuator deployments reported the heap dump endpoint publicly
reachable on **2.3%** of them, and `/env` on **4%**. Those are small percentages
of a very large number.

The framework has treated this as serious enough to change a default: the Spring
Boot 3.5 release notes state that *"the `heapdump` actuator endpoint now defaults
to `access=NONE`"*, and give the reason as reducing *"the likelihood of a
misconfiguration application leaking sensitive information"*. On 4.1 the
reference still says plainly that access to every endpoint **except `shutdown`
and `heapdump`** is unrestricted by default, which tells you both which two the
framework considers dangerous and that the other twenty are only protected by
your exposure list.

Two things follow, and they are the reason this chunk is not just a list of
properties.

**Every control here is defence in depth, because the failure is always a
configuration mistake rather than an exploit.** Nobody breaks into `/heapdump`.
Somebody adds `include: "*"` to get metrics working, and a year later a different
person moves the service behind a public ingress. Each step was reasonable. The
controls that survive that are the ones nobody has to remember at the moment it
matters.

**And the exposure is not limited to secrets you own.** A heap dump of a service
that proxies requests contains other services' tokens; one from a service
handling personal data contains that data. The blast radius is not your
application, it is whatever your application has touched recently.

## Four gates, and only two of them are yours to forget

[Chunk 02](02-exposure-access-and-ports.md) covered the mechanics. Restated as
policy, an actuator call has to pass four independent gates:

| Gate | Controlled by | Fails how |
|---|---|---|
| Does the endpoint exist | the starter and auto-configuration | Silently — added by a transitive starter |
| May it be called at all | `management.endpoint.<id>.access` | Endpoint removed from the context entirely |
| Is it routed over HTTP | `management.endpoints.web.exposure.*` | 404 |
| Is the caller authorised | your `SecurityFilterChain` | 401 / 403 |

The first gate is not yours: an endpoint can appear because somebody added an
unrelated dependency. The fourth is a decision you make once and can get wrong in
a way that looks fine — see [chunk 19](19-securing-the-endpoints.md). The middle
two are where most real protection lives, and they are properties, which means
they are reviewable, greppable and consistent across a fleet in a way a filter
chain is not.

## `max-permitted` is the property worth knowing

The access model has three values — `none`, `read-only`, `unrestricted` — and
three places to set them. The interesting one is the ceiling:

```properties
management.endpoints.access.default=none
management.endpoint.health.access=read-only
management.endpoint.info.access=read-only
management.endpoints.access.max-permitted=read-only
```

Read the last line carefully. The reference says of `max-permitted` that *"this
property takes precedence over the default access or an individual endpoint's
access level"* — so it is not a default, it is a cap. With it set to
`read-only`, an `unrestricted` on any individual endpoint, added by anyone, in any
profile, at any point in the future, **cannot take effect**. That is a rare shape
in configuration: a setting whose value is that it makes other people's future
mistakes inert.

It is worth pairing with the other thing the reference states: *"inaccessible
endpoints are removed entirely from the application context."* An endpoint set to
`none` is not a route that returns 403 — it is not there. There is no handler to
find, nothing to misconfigure a security rule around, and nothing for a path
traversal or a proxy quirk to reach.

⚠️ `enabled` was replaced by `access` (3.4 onward). Inherited configuration using
`management.endpoint.<id>.enabled` may be doing nothing at all, which is a
dangerous way for a control to fail — the line is present, it reads correctly in
review, and it is inert. [Chunk 02](02-exposure-access-and-ports.md) covers the
migration.

## Routing beats authorisation

```properties
management.server.port=9001
```

This is the strongest single control available, and the reason is structural
rather than cryptographic: **an endpoint on a port your ingress does not route is
not protected by a rule anyone can misconfigure — it is unreachable.** No
credential to leak, no filter chain ordering to get wrong, no CORS interaction,
no path that a misbehaving proxy can normalise its way past. It also survives the
scenario that produces most of these incidents, which is someone changing the
public routing of a service months later without reading its actuator
configuration.

Bind it deliberately as well when the only legitimate caller is local:

```properties
management.server.address=127.0.0.1
```

Two operational consequences worth planning for rather than discovering:

- **Whatever scrapes or probes you must be able to reach port 9001.** In
  Kubernetes the kubelet probes the pod IP directly, so a probe pointed at 9001
  works; an ingress or an external uptime check does not, and moving `health` off
  the application port breaks it. Decide which callers are inside and which are
  outside before you move the port, not after.
- **The management server does not inherit `server.*` configuration** — TLS,
  context path, filters. That is set out in
  [chunk 02](02-exposure-access-and-ports.md), and the practical upshot is that
  moving to a management port is a small migration rather than one line.

## Base path, path mapping and the discovery page

```properties
management.endpoints.web.base-path=/manage
management.endpoints.web.path-mapping.health=healthz
management.endpoints.web.discovery.enabled=false
```

Be honest about what these buy. Moving off `/actuator` is not security — anyone
who can enumerate paths will find `/manage` — and it is not nothing either,
because a large share of the traffic that finds exposed actuators is automated,
and automation looks for `/actuator/heapdump` and `/actuator/env` by name. It
raises the cost from "constant background scanning" to "someone deliberately
looking at you", which is a real change in who your adversary is even though it
changes nothing about what they could do.

The discovery page is a straightforward subtraction: `/actuator` returns links to
everything you have exposed. That is a convenience in development and a complete
inventory of your management surface anywhere else.

**None of these three is a substitute for the access model or the port**, and the
failure mode of treating them as one is a service that feels secured because the
paths are unusual. Do them in addition, never instead.

## Gotchas

**Symptom:** `heapdump` is reachable in production and nobody configured it deliberately
**Cause:** an `include: "*"` added to get one endpoint working, combined with an upgrade path or an explicit access setting that re-enabled it
**Fix:** an allowlist, plus a ceiling so a future `unrestricted` cannot take effect:
```properties
management.endpoints.web.exposure.include=health,info,prometheus
management.endpoints.access.default=none
management.endpoints.access.max-permitted=read-only
```

**Symptom:** an `exclude` list is used to keep dangerous endpoints off, and a new one appears after an upgrade
**Cause:** `include: "*"` with `exclude` is a denylist, and a denylist does not cover endpoints that did not exist when it was written
**Fix:** invert it. An allowlist fails closed — a new endpoint is simply not exposed — while a denylist fails open, and the whole difference shows up only on the day the catalogue grows

**Symptom:** `management.endpoint.env.enabled=false` is in the configuration and `/env` is still reachable
**Cause:** endpoint-level `enabled` was replaced by `access`; the inherited line is inert
**Fix:** `management.endpoint.env.access=none`. Grep the whole configuration for `.enabled` on endpoint ids during any Boot 3.x → 4 upgrade, because these lines read as correct and do nothing

**Symptom:** moving actuator to `management.server.port=9001` breaks the Kubernetes readiness probe
**Cause:** the probe was pointed at the application port and the endpoint is no longer there
**Fix:** repoint the probe at 9001 — the kubelet reaches the pod IP directly, so this works — and check anything else that was calling `health`, such as an external uptime monitor, which cannot

**Symptom:** the management port is bound to `0.0.0.0` inside a cluster and every other pod can reach it
**Cause:** a different port is not a different network; it is unreachable from the internet and entirely reachable from the cluster
**Fix:** `management.server.address=127.0.0.1` where the only legitimate caller is a sidecar, or a network policy where it is a scraper. The port removes external routing, not lateral movement

**Symptom:** `base-path` was changed and the team now treats actuator as secured
**Cause:** obscurity was mistaken for a control
**Fix:** keep the change — it does defeat undirected scanning — and set the access model and the port as well. The failure here is not the property, it is the conclusion drawn from it

**Symptom:** a security review passes and a heap dump is still obtainable through a staging instance
**Cause:** the controls were applied to the production profile only, and staging shares a network, a database replica or a set of credentials
**Fix:** apply the baseline in the default profile and relax it deliberately in a local one — the safe direction for configuration to be forgotten in is closed, and profile-specific hardening gets the direction backwards

## Interview questions

**★ Why is `heapdump` singled out as the worst endpoint to expose?**
Because it returns the process's memory itself, not a report about it. Everything
the application is holding is in there — connection-pool passwords, API keys read
from the environment, tokens and cookies from in-flight requests, personal data
currently loaded — and extracting it needs nothing more sophisticated than
`strings` and `grep`. There is no exploit involved; the endpoint is behaving
correctly. Spring Boot found this serious enough to change the default in 3.5 so
that `heapdump` now defaults to `access=NONE`, which is a strong signal for a
framework that is otherwise conservative about changing defaults.

**★ What are the independent controls, and which do you set first?**
Four: whether the endpoint exists at all, its `access` level, whether it is
exposed over the web, and whether the caller is authorised. I would set the
exposure allowlist and the access ceiling first, because they are properties —
reviewable, greppable, uniform across a fleet, and they fail closed. Then the
management port, because routing removes a whole class of mistake. Authorisation
comes last not because it matters least but because it is the control most easily
undone by a later change to a filter chain.

**★ What does `management.endpoints.access.max-permitted` do that the default access level does not?**
It is a ceiling rather than a default, and the reference is explicit that it
takes precedence over both the default and any individual endpoint's setting. So
`max-permitted=read-only` makes an `unrestricted` on any endpoint — added by
anyone, in any profile, at any future date — inert. That is unusually valuable
because the realistic threat here is not an attacker but a well-meaning change six
months from now, and this is one of the few settings that constrains changes you
will not be present for.

**★ Why does `access=none` differ from returning 403?**
Because inaccessible endpoints are removed entirely from the application context.
There is no handler, no route and no code path — so there is nothing for a
misordered security rule, a permissive matcher, a proxy that normalises paths
oddly, or a future refactor to expose. A 403 is a decision made at request time by
machinery that can be misconfigured; a missing endpoint is not a decision at all.

**★ Include-all-and-exclude-some, or include-only-what-you-need? Argue it.**
Allowlist, because the two shapes fail in opposite directions when the catalogue
changes. A denylist covers exactly the endpoints known when it was written, so
the next version of Boot — or the next starter someone adds — introduces an
endpoint the list never heard of, and it is exposed. An allowlist meets the same
event by not exposing it. Neither is more work on the day you write it; they
differ entirely on a day nobody is thinking about actuator configuration.

**★ You move actuator to port 9001. What breaks, and what have you actually gained?**
What breaks is anything that was calling the old port: Kubernetes probes, uptime
monitors, dashboards, scrapers. Also anything relying on `server.*`
configuration, because the management server does not inherit TLS, context path
or filters. What you gain is the strongest control on offer — an endpoint your
ingress does not route is not defended by a rule that can be misconfigured, it is
unreachable. That protection also survives someone changing the service's public
routing later without reading its actuator configuration, which is how these
incidents usually start.

**★ Is changing the base path worth doing?**
Yes, with the reasoning stated honestly. It is not security: anyone enumerating
paths will find `/manage`, and it protects nothing against a person who is
looking at you specifically. It does defeat undirected automation, which searches
for `/actuator/env` and `/actuator/heapdump` by name and constitutes most of the
traffic that finds exposed actuators. So it changes who your adversary is without
changing what they could do — worth having, dangerous to count on, and the real
failure is a team concluding they are finished.

---

← Prev: [The endpoint catalogue](17-the-endpoint-catalogue.md) · Index: [Actuator](README.md) · Next → [Securing the endpoints](19-securing-the-endpoints.md)
