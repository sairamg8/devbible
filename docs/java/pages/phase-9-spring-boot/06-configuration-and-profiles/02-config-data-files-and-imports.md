---
title: "Config data: files, locations and imports"
sidebar_label: "2 · Config data and imports"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Boot reference *Externalized
> Configuration · External Application Properties* (docs.spring.io/spring-boot/reference
> — `spring.config.name`, `spring.config.location`,
> `spring.config.additional-location`, `spring.config.import`, the default
> search locations and their order, the `optional:` prefix,
> `spring.config.on-not-found`, multi-document files and their separators,
> `spring.config.activate.on-profile` / `on-cloud-platform`, location groups
> with `;`, and the extension/encoding hints in square brackets), plus the
> YAML 1.1 implicit-typing behaviour of SnakeYAML, which Spring uses to parse
> `.yml`. Spring Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**"Config data" is a specific, named subsystem, not a synonym for "the
properties file". It is the machinery that decides which files exist, where it
looks for them, in what order it reads them, and — through
`spring.config.import` — how a file can pull in another one mid-parse. Learning
its four locations and one import rule replaces almost all of the folklore
about where Spring "finds" configuration, and it is the difference between
patching a deployed artifact confidently and redeploying because nobody knows
which file the container actually read.**

## The default search locations

With no configuration about configuration, Boot searches, in order:

| Order | Location | Meaning |
|---|---|---|
| 1 | `classpath:/` | the packaged root |
| 2 | `classpath:/config/` | a packaged `config` package |
| 3 | `file:./` | the process's current directory |
| 4 | `file:./config/` | a `config` directory beside it |
| 5 | `file:./config/*/` | each immediate child of `config/` |

and inside each location it looks for `application.properties` and
`application.yaml`, then the profile-specific `application-{profile}.*`.

Locations 3–5 are what make a packaged jar patchable: drop an
`application.yml` next to it, or mount one at `./config/`, and it wins over
everything inside the archive — the config-data sub-order from
[chunk 1](01-the-environment-and-precedence.md).

Location 5, the wildcard, exists for Kubernetes: mount several ConfigMaps as
sibling directories under `config/` and each is picked up without naming any of
them.

## Changing where it looks

| Property | Effect |
|---|---|
| `spring.config.name` | the basename, default `application` |
| `spring.config.location` | **replaces** the default locations entirely |
| `spring.config.additional-location` | **adds** to them, keeping the defaults |
| `spring.config.import` | pulls in another location from inside a file |

```bash
java -jar app.jar --spring.config.name=invoice
# now looks for invoice.properties / invoice.yaml, not application.*
```

⚠️ **`spring.config.location` replaces; `additional-location` adds.** Reaching
for `location` when you meant `additional-location` silently discards the
packaged defaults, and the symptom is every property you did not restate going
missing at once.

These three must be supplied as **environment properties** — a command-line
argument, a system property or an OS environment variable. They cannot be set
inside `application.yml`, because they are what decides whether that file is
read at all.

## `spring.config.import`

Unlike the location properties, `import` is used *from inside* a config file:

```yaml
spring.application.name: invoice-service
spring.config.import: optional:file:./dev.properties
```

Two rules govern it, and the second is the one people get wrong:

1. **The imported document is inserted immediately below the file that declared
   the import** — so it participates in the ordinary ordering.
2. **Imported values take precedence over the file that triggered the import**,
   and the relative position of the `spring.config.import` line within the file
   makes no difference. Declaring it first or last produces identical results.

Multiple locations in one import are processed in order, later winning:

```yaml
spring.config.import: my.properties,other.properties   # other.properties wins
```

Imports also accept hints in square brackets for extensionless files and
encodings, and an `env:` prefix for a variable holding a whole document:

```yaml
spring.config.import:
  - "file:/etc/config/myconfig[.yaml]"
  - "classpath:import.properties[encoding=utf-8]"
  - "env:MY_CONFIGURATION"
```

## `optional:` and missing locations

Without the prefix, a location that does not exist is fatal —
`ConfigDataLocationNotFoundException` at startup:

```yaml
spring.config.import: optional:file:./dev.properties   # absent is fine
```

`spring.config.on-not-found=ignore` relaxes it globally, which is worth
knowing and rarely worth using: a per-location `optional:` states which files
are genuinely allowed to be absent, while the global switch turns a real
misconfiguration — a mount that failed — into silence.

⚠️ **The default is deliberately strict, and that is a feature.** A container
whose secrets volume failed to mount should fail loudly rather than start
without its secrets.

## The trade-off

Config data buys deployment flexibility that nothing else in the JVM ecosystem
matches — five search locations, external overrides and imports, all without a
rebuild. The price is that **the set of files actually read is itself a runtime
outcome**, not something you can determine from the repository. Somebody has to
know that this container mounts `./config/secrets/` and that the entrypoint
passes `--spring.config.additional-location`, and none of that is in the code.
The mitigation is to keep the mechanism boring: default locations wherever
possible, one documented external override point, and `optional:` used to mark
exactly which absences are legitimate.

## Gotchas

**Symptom:** setting `spring.config.location` makes every property you did not restate disappear
**Cause:** `location` **replaces** the default search locations; the packaged `application.yml` is no longer read at all
**Fix:** use the additive form unless replacement is genuinely intended:
```bash
--spring.config.additional-location=optional:file:./external/
```

**Symptom:** `spring.config.name` set inside `application.yml` has no effect
**Cause:** it decides which file to load, so by the time that file is being parsed the decision is already made. It must be an environment property
**Fix:** pass it at launch, where it can be read before any config file:
```bash
java -jar app.jar --spring.config.name=invoice
```

**Symptom:** startup fails with `ConfigDataLocationNotFoundException` on a developer machine
**Cause:** a `spring.config.import` names a file that exists only in deployed environments, and imports are mandatory unless marked otherwise
**Fix:** mark the genuinely-optional ones per location rather than disabling the check globally:
```yaml
spring.config.import: optional:file:/etc/secrets/app.yml
```

**Symptom:** a container starts happily with no secrets and fails on the first request
**Cause:** somebody set `spring.config.on-not-found=ignore` globally, so a secrets volume that failed to mount produced silence rather than a startup failure
**Fix:** remove the global setting and mark individual locations `optional:`. A missing secrets mount should be a fatal startup error, not a runtime surprise

**Symptom:** properties in an imported file are ignored, so the import is moved to the bottom of the file "so it loads later"
**Cause:** a misunderstanding — imported values always take precedence over the importing document regardless of where the import line sits. The real problem is elsewhere, usually a higher-priority source
**Fix:** leave the import where it reads best and look up the stack instead; check the `env` Actuator endpoint for which source actually supplied the value

**Symptom:** a mounted ConfigMap is not picked up, though the path looks right
**Cause:** the default filesystem locations are `./`, `./config/` and each *immediate child* of `./config/` — a file nested two levels below `config/` is outside the search
**Fix:** mount one level deeper into the search, or name the location explicitly:
```bash
--spring.config.additional-location=optional:file:./config/deep/nested/
```

## Interview questions

**★ Where does Spring Boot look for configuration files by default?**
Five locations in order: the classpath root, the classpath `/config` package,
the current directory, a `config/` directory beside it, and each immediate child
directory of `config/`. Within each it reads `application.properties` and
`application.yaml`, then the profile-specific variants. The last three are
filesystem locations, which is what makes a packaged jar patchable without a
rebuild, and the wildcard child directory exists so several mounted Kubernetes
ConfigMaps can be picked up without naming any of them.

**★ `spring.config.location` versus `spring.config.additional-location` — what is the difference?**
`location` **replaces** the default search locations entirely;
`additional-location` **adds** to them. Reaching for the first when you meant
the second is a classic outage: every property you did not restate in the new
location vanishes at once, because the packaged `application.yml` is no longer
being read. Use `additional-location` unless you genuinely intend the
application to ignore its packaged configuration.

**★ Why can't `spring.config.name` be set in `application.yml`?**
Because it determines which file to load, and by the time `application.yml` is
being parsed that decision has already been taken — the property would only be
read after the file it was supposed to select. The same applies to
`spring.config.location` and `spring.config.additional-location`. All three must
be supplied as environment properties: a command-line argument, a system
property, or an OS environment variable.

**★ How does `spring.config.import` interact with the file that declares it?**
The imported document is inserted immediately below the declaring file, and its
values **take precedence** over that file. Crucially, the position of the
`spring.config.import` line within the file makes no difference — declaring it
on the first line or the last produces identical results. That surprises people
who move the import around trying to change ordering; when an imported value
appears to be ignored, the cause is a higher-priority property source, not the
import's position.

**★ What does the `optional:` prefix do, and why is the default strict?**
Without it, a config location that does not exist causes
`ConfigDataLocationNotFoundException` and the application fails to start.
`optional:` marks that specific location as allowed to be absent. Strictness is
the right default because the common failure is a volume that did not mount or
a path that changed — and an application that silently starts without its
secrets is far worse than one that refuses to start. The global
`spring.config.on-not-found=ignore` exists but converts every such
misconfiguration into silence, which is why per-location `optional:` is
preferable.

**★ What can `spring.config.import` load besides a properties file?**
Several things, each with its own prefix or hint. An extensionless file with an
extension hint in square brackets — `file:/etc/config/myconfig[.yaml]` — or an
encoding hint, `classpath:import.properties[encoding=utf-8]`. An environment
variable holding an entire document, with `env:MY_CONFIGURATION`. And a
**configuration tree** with `configtree:`, which maps a directory of
single-value files onto property keys and is how Kubernetes Secrets are
consumed; that one is covered in [chunk 13](13-twelve-factor-and-secrets.md).

**★ When would you use semicolon-separated locations rather than commas?**
Commas process locations as successive groups — everything in `/cfg` before
everything in `/ext` — whereas semicolons put them at the same level, where a
last-wins strategy applies across the profile-specific files. The difference
only shows up when profile-specific files exist in both directories, and it
decides whether `/cfg/application-live.properties` or
`/ext/application-prod.properties` is read later. It is a niche control, and
worth knowing mainly so an unexpected precedence result is recognisable.

---

← Prev: [The Environment and the precedence order](01-the-environment-and-precedence.md) · Index: [Configuration and profiles](README.md) · Next → [Multi-document files and the YAML traps](03-multi-document-and-yaml-traps.md)
