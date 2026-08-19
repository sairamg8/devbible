---
title: "The Environment and the precedence order"
sidebar_label: "1 · The Environment and precedence"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Boot reference *Externalized
> Configuration* (docs.spring.io/spring-boot/reference — the complete ordered
> `PropertySource` list, the config-data file sub-order, and the
> `SPRING_APPLICATION_JSON` and `RandomValuePropertySource` entries).
> Spring Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**Spring Boot does not have "a configuration file". It has an `Environment` — an
ordered stack of property sources, fifteen of them in the documented list — and
every property you read is the answer from the highest-priority source that
happens to have that key. `application.yml` is one entry in that stack, and not
a high one: an environment variable beats it, a system property beats that, and
a command-line argument beats them all. Once you can recite roughly where the
boundaries fall, an entire genre of "the value in the file is being ignored"
becomes a lookup rather than a mystery.**

## The model

`Environment` exposes one method that matters — "what is the value of this
key?" — and answers it by walking an ordered list of `PropertySource` objects,
returning the first hit. A `PropertySource` is nothing more than a named
key-value lookup: a `Map`, the OS environment, the parsed contents of a YAML
file, the command line.

Two consequences fall straight out, and both surprise people:

- **There is no merge.** Sources do not combine per-property-tree. The first
  source that has the *exact key* wins outright, and a lower source that has a
  more complete set of neighbouring keys does not get a say.
- **A key that exists nowhere is not an error.** It resolves to `null`, or to
  whatever default the reader supplied. Nothing validates that a key you rely on
  was ever set — which is the entire argument for the typed binding in
  [chunk 5](05-constructor-binding-and-validation.md) and the validation that
  follows it in [chunk 6](06-defaults-and-validation.md).

## The documented order

The reference lists the sources from **lowest to highest** priority — later
entries override earlier ones:

| # | Property source |
|---|---|
| 1 | Default properties (`SpringApplication.setDefaultProperties(Map)`) |
| 2 | `@PropertySource` annotations on `@Configuration` classes |
| 3 | **Config data** — `application.properties` / `application.yml` and their profile variants |
| 4 | `RandomValuePropertySource` (`random.*`) |
| 5 | OS environment variables |
| 6 | Java system properties (`System.getProperties()`) |
| 7 | JNDI attributes from `java:comp/env` |
| 8 | `ServletContext` init parameters |
| 9 | `ServletConfig` init parameters |
| 10 | `SPRING_APPLICATION_JSON` — inline JSON in an environment variable or system property |
| 11 | **Command-line arguments** |
| 12 | `properties` attribute on `@SpringBootTest` |
| 13 | `@DynamicPropertySource` in tests |
| 14 | `@TestPropertySource` on tests |
| 15 | Devtools global settings in `$HOME/.config/spring-boot`, when devtools is active |

## Why it is ordered that way

The list looks arbitrary until you notice it runs along a single axis: **how
late, and how specifically, the value was supplied.**

**1–4 — baked into the artifact.** Defaults set in code, `@PropertySource`, and
the config files packaged in the jar. These travel with the build and are
identical in every environment, which is exactly why they must lose to
everything else — they are the developer's guess about the general case.

**5–9 — supplied by the environment the process is running in.** The OS
environment, system properties, and the servlet-container entries. Whoever
deployed the process gets to override whoever built it, which is the entire
premise of building one artifact and promoting it through environments.

That environment variables sit **below** system properties is the one boundary
worth memorising: `-Dserver.port=9000` beats `SERVER_PORT=8081`, because a
system property is set on the specific launch command while an environment
variable is ambient and may have been inherited from a shell, a base image or a
container platform.

**10–11 — supplied at launch, by hand.** `SPRING_APPLICATION_JSON` and then
command-line arguments. `--server.port=9000` is the most specific, most
deliberate, most local statement anyone can make about this one run, so it
outranks everything an operator or a build put in place.

**12–15 — the test and development overrides.** Test annotations must beat the
production configuration or tests could not isolate anything, and devtools sits
at the very top because it exists solely to override during development and
is never present in a packaged run.

## The config-data sub-order

Entry 3 is itself an ordered group, because "the config files" are four
categories rather than one. Within config data, later wins:

| # | Config data source |
|---|---|
| 1 | `application.properties` / `.yml` **inside** the jar |
| 2 | `application-{profile}.properties` / `.yml` **inside** the jar |
| 3 | `application.properties` / `.yml` **outside** the jar |
| 4 | `application-{profile}.properties` / `.yml` **outside** the jar |

Two rules are encoded here and both get used daily. **Outside beats inside** —
a file next to the jar overrides the packaged one, which is how you patch a
deployed artifact without rebuilding it. And **profile-specific beats generic**,
so `application-prod.yml` sharpens `application.yml` rather than replacing it,
key by key.

⚠️ Note what this does *not* say: profile-specific inside the jar (2) still
loses to generic outside the jar (3). A value in a mounted `application.yml`
beats your packaged `application-prod.yml`, which is rarely what people expect
the first time it bites.

## `RandomValuePropertySource`, briefly

Entry 4 supplies `random.*` keys — `${random.int}`, `${random.uuid}`,
`${random.int(1024,65535)}` — resolved at startup:

```yaml
server.port: ${random.int(9000,9999)}
```

Genuinely useful for a test that needs a free port, and a trap anywhere else: it
is re-randomised on every restart, so anything that must survive a restart (an
instance id used as a lock owner, a seed, a cache namespace) must never come
from it.

## The trade-off

An ordered stack of fifteen sources is what makes one artifact deployable
everywhere without a rebuild — the single most valuable property of the whole
scheme. The cost is that **the effective value of any key is not visible in any
one place.** You cannot answer "what is `server.port` in production?" by reading
a file; you have to know the stack and what each layer set. That is a real
operational cost, and it is why the `env` and `configprops` Actuator endpoints
exist — they report the resolved view, which no file can.

## Gotchas

**Symptom:** you set a value in `application.yml`, deploy, and the application uses something else entirely
**Cause:** a higher source has the same key — most often an environment variable injected by the platform, or a command-line argument in the container's entrypoint. Config data is source 3 of 15
**Fix:** inspect the resolved environment rather than the file. The `env` Actuator endpoint reports every source and which one won; failing that, check the container spec's env block and the entrypoint arguments

**Symptom:** `SERVER_PORT=8081` is set in the environment and the app still starts on the port from a `-D` flag
**Cause:** system properties (6) outrank OS environment variables (5). The `-D` is more specific to this launch than an ambient variable
**Fix:** this is the documented order, not a bug — pick one mechanism per concern. If the platform must win, remove the `-D` from the launch command rather than trying to out-set it

**Symptom:** a mounted `application.yml` unexpectedly overrides settings from the packaged `application-prod.yml`
**Cause:** within config data the order is inside-jar generic, inside-jar profile, outside-jar generic, outside-jar profile — so any external file beats *both* packaged files, profile-specific or not
**Fix:** if the external file is meant to hold only overrides, keep it minimal, or name it `application-prod.yml` externally so it sits in the highest config-data slot

**Symptom:** a property is set in one place and read as `null` with no error anywhere
**Cause:** nothing in the `Environment` validates that a key exists; a missing key resolves to `null` or to whatever default the reader supplied. A typo in the key is indistinguishable from a deliberate omission
**Fix:** bind configuration as a typed object ([chunk 5](05-constructor-binding-and-validation.md)) and validate it ([chunk 6](06-defaults-and-validation.md)), so startup fails naming the property

**Symptom:** two YAML files each define half of a nested block and only one half takes effect
**Cause:** resolution is per-key, not per-tree. The higher source wins for the keys it has; it does not "replace the block", and the lower source's neighbouring keys are still visible — but a `List` bound from the higher source replaces the whole list rather than appending
**Fix:** never split one logical list across sources; keep collections whole in a single file and override the entire collection when you need to change it

**Symptom:** an instance identifier generated with `${random.uuid}` changes on every restart and breaks a distributed lock
**Cause:** `RandomValuePropertySource` resolves at startup, every startup — it is a fresh value per process, not a stable identity
**Fix:** take stable identity from the platform, which supplies one, rather than generating it:
```yaml
app.instance-id: ${HOSTNAME:local}
```

**Symptom:** a test passes locally and fails in CI with different configuration
**Cause:** devtools global settings in `$HOME/.config/spring-boot` sit at the very top of the order and are present on the developer's machine only
**Fix:** treat that file as personal and never rely on it for anything a test asserts; put test configuration in `@TestPropertySource` or `@SpringBootTest(properties = …)`, which are documented sources 12–14 and travel with the code

## Interview questions

**★ Where does `application.yml` sit in Spring Boot's property precedence?**
Low — it is entry 3 in a documented list of fifteen, under the "config data"
heading. OS environment variables, Java system properties, `SPRING_APPLICATION_JSON`
and command-line arguments all beat it, and the test-related sources and devtools
settings beat those. That placement is deliberate: the packaged file is the
developer's guess about the general case, and everything supplied later and more
specifically by whoever is running the process is expected to override it.

**★ Environment variable or system property — which wins, and why that way round?**
The system property. Environment variables are entry 5, system properties entry
6, and later entries override earlier ones. The reasoning follows the general
axis of the list: a `-D` flag is set on one specific launch command, whereas an
environment variable is ambient and could have been inherited from a shell, a
base image or a container platform without anyone intending it for this process.
The more deliberate and more local statement wins.

**★ Explain the ordering principle behind the fifteen sources.**
It runs from least to most specific about *this particular run*. Sources 1–4 are
baked into the artifact and identical everywhere. Sources 5–9 come from the
environment the process was deployed into, so whoever deployed it overrides
whoever built it — which is what makes one artifact promotable through
environments. Sources 10–11 are supplied by hand at launch and are the most
deliberate statement available. Sources 12–15 are test and development
overrides, which have to beat production configuration or tests could not
isolate anything.

**★ Within the config files themselves, what is the order?**
Four slots, later winning: packaged generic, packaged profile-specific, external
generic, external profile-specific. So "outside the jar beats inside" and
"profile-specific beats generic" — but only within the same inside/outside
group. The consequence people trip on is that an external `application.yml`
beats a packaged `application-prod.yml`, because the inside/outside distinction
is the outer sort key and the profile distinction the inner one.

**★ How do you find out the effective value of a property in a running application?**
Not by reading a file — no single file can tell you, because the effective value
is whatever the highest-priority source with that key supplied. You ask the
running application: the `env` Actuator endpoint lists every property source in
order and shows which one supplied each value, and `configprops` shows the
result of binding those values onto `@ConfigurationProperties` objects. That
opacity is the real operational cost of an override stack, and those endpoints
are the compensation for it.

**★ What happens when two sources each define part of the same nested block?**
Resolution is per-key, not per-tree, so the higher source wins for the exact
keys it defines and the lower source's other keys remain visible — the blocks
effectively interleave. The important exception is collections: a `List` bound
from a higher source replaces the whole list rather than merging element by
element, so splitting one logical list across two files gives you whichever
file's version won, not the union. Keep collections whole in one place.

**★ When is `${random.*}` appropriate, and when is it a bug?**
It is appropriate for anything that must be unique per process and needs no
continuity — the classic case being `server.port: ${random.int(9000,9999)}` so
parallel test runs do not collide. It is a bug for anything that must survive a
restart, because `RandomValuePropertySource` resolves afresh on every startup.
An instance identifier used as a distributed-lock owner, a cache namespace or a
persistence seed must come from something stable such as the platform-supplied
hostname, not from `${random.uuid}`.

---

← Index: [Configuration and profiles](README.md) · Phase: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Config data: files, locations and imports](02-config-data-files-and-imports.md)
