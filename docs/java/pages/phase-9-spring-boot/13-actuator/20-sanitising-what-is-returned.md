---
title: "Sanitising what the endpoints return"
sidebar_label: "20 · Sanitising the responses"
sidebar_position: 20
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-20 against the Spring Boot 4.1.1 reference — *Actuator ·
> Endpoints · Sanitize Sensitive Values*
> (docs.spring.io/spring-boot/reference/actuator/endpoints.html: information from
> `/env`, `/configprops` and `/quartz` being sanitized by default; `show-values`
> taking `never` — values *"always fully sanitized (replaced by `******`)"* —
> `always` and `when-authorized`, each qualified *"as long as no
> `SanitizingFunction` bean applies"*; and `management.endpoint.env.roles`) and
> the Spring Boot 4.1.1 how-to — *Actuator*
> (docs.spring.io/spring-boot/how-to/actuator.html: *"To take control over the
> sanitization, define a `SanitizingFunction` bean. The `SanitizableData` with
> which the function is called provides access to the key and value as well as
> the `PropertySource` from which they came"*, and each function being called in
> order until one changes the value). The removal of key-list sanitisation in
> Boot 3.0 is recorded in the Spring Boot issue tracker
> (spring-projects/spring-boot#33990). Spring Boot 4.1.1, Spring Framework
> 7.0.x, JDK 25.

**"Secured" and "safe to read" are different questions. An authenticated
`/env` still returns your configuration, and the only thing between a reader and
your credentials is a masking rule that one property turns off. Worse, masking
covers values and never keys — so even a fully sanitised response enumerates
every property your application binds, which names your cloud provider, your
broker, your feature flags and your internal services. Sanitisation reduces the
damage of exposure; it never makes an endpoint public.**

## What `show-values` controls

`/env`, `/configprops` and `/quartz` return configuration, so their values are
sanitised by default. One property per endpoint decides:

| `show-values` | Behaviour |
|---|---|
| `never` | values are always fully sanitised, *"replaced by `******`"* |
| `always` | values are shown to all users, *"as long as no `SanitizingFunction` bean applies"* |
| `when-authorized` | values are shown only to authorised users, with the same qualification |

```properties
management.endpoint.env.show-values=when-authorized
management.endpoint.env.roles=ENDPOINT_ADMIN
management.endpoint.configprops.show-values=when-authorized
```

`when-authorized` is the only defensible production setting, and it is only
meaningful if actuator requests are genuinely authenticated — which loops back to
[the chain](19-securing-the-endpoints.md). Setting it without a chain that
authenticates gives you a value that reads as careful and behaves like `never`,
or worse, depending on what your chain does with anonymous requests.

`always` is how credentials end up in a screenshot in a chat channel. It gets set
during an investigation, it is a single line with no obvious blast radius, and
nothing in the application ever complains about it again.

## Masking hides values, not keys

⚠️ This is the part that gets missed. The response still lists every property
name your application binds. Read as an artefact rather than as a debugging tool,
that list tells a reader which cloud provider you use, which message broker,
which payment processor, which feature flags exist and what they are called,
what your internal service names are, and which third parties you integrate
with. None of it is masked, because none of it is a value.

So a fully sanitised `/env` is not public information, and the conclusion is the
same as [chunk 18](18-locking-it-down.md)'s: sanitisation is what limits the
damage when something is reachable that should not be, not a reason to make it
reachable.

## The `keys-to-sanitize` properties are gone

Boot 3.0 replaced the key-list properties — `management.endpoint.env.keys-to-sanitize`
and its `configprops` counterpart — with `SanitizingFunction` beans. Inherited
configuration from a Boot 2 service that lists sensitive key patterns is
**inert**.

That is the same failure shape as `enabled` versus `access` in
[chunk 18](18-locking-it-down.md), and it is worth naming as a pattern rather
than as two facts: **an upgrade that replaces a property leaves a line that reads
as a control and does nothing.** Grep for these during any 2.x → 3.x → 4.x
migration, because a code review will not catch them — the line looks correct,
and the only way to see it is inert is to check it against the current
configuration-properties appendix.

## `SanitizingFunction`, and why it is a bean

```java
@Bean
SanitizingFunction maskInternalHosts() {
    return data -> data.getKey().contains("internal.host")
            ? data.withValue("******")
            : data;
}
```

The how-to gives the contract: *"the `SanitizableData` with which the function is
called provides access to the key and value as well as the `PropertySource` from
which they came"*, and functions are called in order until one changes the value.

The `PropertySource` half is the interesting part, and it is the reason this is a
bean rather than a list of patterns. It lets you sanitise by **origin** instead of
by name:

```java
@Bean
SanitizingFunction maskEverythingFromTheSecretStore() {
    return data -> data.getPropertySource() != null
            && data.getPropertySource().getName().contains("secrets")
            ? data.withValue("******")
            : data;
}
```

That rule keeps working when somebody adds a secret with a name nobody
anticipated, which a key-pattern list never does. A pattern list protects the
names you thought of; an origin rule protects the category. Where you have a
secrets manager, a vault property source or an encrypted config source, matching
on it is strictly better than guessing at names like `password` and `secret`.

## A baseline worth defending

Pulling together this chunk and [chunk 18](18-locking-it-down.md):

```properties
# routing: not reachable from the internet at all
management.server.port=9001

# allowlist, so a new endpoint in a future version is not exposed
management.endpoints.web.exposure.include=health,info,prometheus
management.endpoints.web.discovery.enabled=false

# access: closed by default, with a ceiling that survives future edits
management.endpoints.access.default=none
management.endpoint.health.access=read-only
management.endpoint.info.access=read-only
management.endpoint.prometheus.access=read-only
management.endpoints.access.max-permitted=read-only

# what the responses are allowed to say
management.endpoint.health.show-details=when-authorized
management.endpoint.health.show-components=when-authorized
management.endpoint.env.show-values=when-authorized
management.endpoint.configprops.show-values=when-authorized
```

Every line is a layer that still works when another has been forgotten, and the
two health settings are [chunk 04](04-health-aggregation-and-details.md)'s
argument applied here.

🔴 **Put this in the default profile and relax it locally, never the other way
round.** Configuration gets forgotten in both directions, and the question is
which direction is survivable: a developer who forgets the local relaxation is
inconvenienced for five minutes, while an environment that never received the
production profile is exposed indefinitely. Profile-specific hardening also fails
on the case that causes most real incidents — a staging or preview environment
nobody planned for, sharing a network segment, a database replica or a credential
set with something that matters.

## Gotchas

**Symptom:** `/env` returns `******` everywhere and someone sets `show-values=always` to get through an investigation
**Cause:** it is one property with no visible blast radius, and "temporarily" is not a thing configuration remembers
**Fix:** `when-authorized` plus `management.endpoint.env.roles`, and treat `always` as a value that appears only in a local profile

**Symptom:** `show-values=when-authorized` is set and everyone sees the values
**Cause:** actuator requests are not authenticated, so there is no distinction for the setting to act on
**Fix:** the setting is only meaningful behind a chain that authenticates — see [chunk 19](19-securing-the-endpoints.md). Set both or neither, because one without the other is a control that reads as careful and is not

**Symptom:** a fully sanitised `/env` is treated as safe to expose publicly
**Cause:** masking covers values, not keys, and the key list is itself a description of your architecture
**Fix:** keep it off the public port regardless of masking. If someone needs convincing, read them the property names aloud — the list names the cloud provider, the broker, the integrations and the internal services

**Symptom:** a `keys-to-sanitize` list inherited from an older service does nothing
**Cause:** it was replaced by `SanitizingFunction` beans in Boot 3.0 and the property is inert
**Fix:** implement the rule as a bean, and prefer matching on the `PropertySource` so that secrets added later under unanticipated names are still covered

**Symptom:** a `SanitizingFunction` bean is present and values are still shown
**Cause:** `show-values` is `always`, and the qualification runs the other way — values are shown *unless* a function changes them, so a function that returns the data unchanged for that key has done nothing
**Fix:** decide the default with `show-values` first, and use functions for exceptions rather than expecting a bean to impose a policy the property has already opened up

**Symptom:** two `SanitizingFunction` beans are registered and the second never seems to apply
**Cause:** functions are called in order until one changes the value; a broad earlier function short-circuits the rest
**Fix:** make each function narrow enough that it only claims the data it is actually about, and order them from most specific to most general

**Symptom:** production is hardened and configuration is still readable from staging
**Cause:** the controls live in a production-profile file, and staging shares a network segment, a replica or a credential set
**Fix:** move the baseline to the default profile and relax it in a local one — configuration that is forgotten should be forgotten in the closed direction

## Interview questions

**★ What does `show-values` control, and what does it not?**
It controls whether values in `/env`, `/configprops` and `/quartz` are returned
or replaced by `******`, with `never`, `always` and `when-authorized` as the
options and a `SanitizingFunction` bean able to override the outcome. It does not
control the **keys**, which are always visible. That is the part people miss: a
fully sanitised `/env` still enumerates every property the application binds, and
that list describes your cloud provider, your broker, your feature flags and your
internal service names. Masking limits the damage; it does not make the endpoint
publishable.

**★ Why is `keys-to-sanitize` no longer the answer?**
It was replaced by `SanitizingFunction` beans in Boot 3.0, so an inherited list
of key patterns is inert — the dangerous kind of obsolete, because the line reads
as a control and does nothing. The replacement is also better on the merits: the
function receives the `PropertySource` alongside the key and value, so you can
sanitise by origin rather than by name and cover secrets added later under names
nobody anticipated. A pattern list only ever protects the names you thought of.

**★ How would you sanitise everything coming from a secrets manager?**
With a `SanitizingFunction` that matches on the `PropertySource` rather than on
the key — if the source name identifies the vault or secrets store, mask every
value from it and let the key patterns alone. That is a rule about a category
rather than about names, so it keeps holding as the configuration grows, which is
exactly where key-pattern matching degrades. The functions run in order until one
changes the value, so it should be narrow enough not to shadow more specific
rules registered alongside it.

**★ `show-values=when-authorized` is set. Is that enough?**
Only if actuator requests are actually authenticated. Without a chain that
distinguishes an authorised caller from an anonymous one there is nothing for the
setting to act on, and you are left with a property that reads as careful and
behaves according to whatever your chain does with anonymous requests. The two
halves — authentication and disclosure — have to be set together, and the
`roles` property is the part that says *which* authenticated principals count.

**★ Where should the hardening configuration live — the production profile or the default one?**
The default one, relaxed locally. Configuration gets forgotten in both
directions, so the question is which direction is survivable: a developer who
forgets the local relaxation loses five minutes, while an environment that never
received the production profile is exposed for as long as nobody notices.
Profile-specific hardening also fails exactly on the case that causes real
incidents — a staging or preview environment nobody planned for, sharing a
network, a replica or a credential set with production.

**★ You inherit a service and are asked whether its actuator is safe. What do you check, in order?**
Which endpoints are exposed, and whether the list is an allowlist or `*` with
exclusions. What `management.endpoints.access.*` says, including whether a
ceiling is set and whether any inherited `.enabled` or `keys-to-sanitize` lines
are silently inert. Whether there is a management port and where it is bound.
Whether a `SecurityFilterChain` bean exists, and if so whether anything in it
covers actuator, because the auto-configuration has backed off. Then
`show-details` and `show-values`. And finally whether the same answers hold in
staging, because that is where the version of this that gets exploited usually
lives.

---

← Prev: [Securing the endpoints](19-securing-the-endpoints.md) · Index: [Actuator](README.md)
