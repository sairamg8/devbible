---
title: "Multi-document files and the YAML traps"
sidebar_label: "3 · Multi-document files and YAML"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Boot reference *Externalized
> Configuration · External Application Properties* (docs.spring.io/spring-boot/reference
> — multi-document files, the `---` and `#---` / `!---` separators and their
> exact formatting rules, the restriction against loading them via
> `@PropertySource` / `@TestPropertySource`, `spring.config.activate.on-profile`
> and `on-cloud-platform`, and location groups with `;`), and the YAML 1.1
> implicit-typing behaviour of SnakeYAML, which Spring uses to parse `.yml`.
> Spring Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**A configuration file is not one document, and YAML is not a format that
stores what you typed. Boot lets a single file hold several independently
activated documents, which is how environment variation stays next to the value
it varies instead of scattering across five files. And SnakeYAML implements YAML
1.1 implicit typing, which means an unquoted country code, version number or PIN
becomes a boolean, a float or an octal integer before your code ever sees it.
The first is a feature worth using deliberately; the second is a defect you
defend against with one habit.**

## Multi-document files

One file can hold several documents, each independently activated. YAML uses
`---`; properties files use a `#---` (or `!---`) comment line:

```yaml
myprop: always-set
---
spring.config.activate.on-cloud-platform: kubernetes
spring.config.activate.on-profile: prod | staging
myotherprop: sometimes-set
```

```properties
myprop=always-set
#---
spring.config.activate.on-cloud-platform=kubernetes
myotherprop=sometimes-set
```

The separator rules are exact: **no leading whitespace, exactly three hyphens**,
and the lines immediately before and after must not use the same comment prefix.
Multi-document files cannot be loaded through `@PropertySource` or
`@TestPropertySource`.

`spring.config.activate` takes `on-profile` (which accepts an expression) and
`on-cloud-platform`. Both present means both must hold.

### Location groups with `;`

Comma-separated locations are processed one group at a time; **semicolon**-separated
locations are processed at the same level, where a last-wins strategy applies
across profiles:

```bash
--spring.config.location=classpath:/cfg/,classpath:/ext/   # all of /cfg, then all of /ext
--spring.config.location=classpath:/cfg/;classpath:/ext/   # same level, last wins
```

This matters when profile-specific files live in both directories, because it
changes whether `/cfg/application-live.properties` or
`/ext/application-prod.properties` is read later.

## 🔴 The YAML traps

Spring parses `.yml` with SnakeYAML, which implements **YAML 1.1** implicit
typing. Three consequences bite regularly.

**The Norway problem.** YAML 1.1 treats `y`, `n`, `yes`, `no`, `on`, `off`,
`true`, `false` as booleans. So an unquoted country code becomes a boolean:

```yaml
country: NO         # ⚠️ parses as the boolean false
country: "NO"       # ✅ the string "NO"
```

The same catches `on` and `off` used as legitimate string values, and it is
worse than it looks because binding to a `String` field then produces `"false"`.

**Leading zeros and version-like values.**

```yaml
pin: 0123           # ⚠️ YAML 1.1 reads a leading 0 as octal
version: 1.10       # ⚠️ a float — trailing zero is lost
version: "1.10"     # ✅ the string you meant
```

**Duplicate keys.** A repeated key silently takes the later value rather than
erroring, so an accidental duplicate deep in a long file wins over the one
somebody was editing.

**The rule that avoids all three: quote every value that is conceptually a
string.** Country codes, version numbers, identifiers, ports written as text,
anything with a leading zero.

## The trade-off

Multi-document files keep variation adjacent to what it varies, which beats five
near-identical profile files that drift apart. The cost is that a single file
now has conditional logic inside it, and conditional logic is invisible when you
read a file top to bottom looking for a key — a value can appear three times in
one file with only one occurrence active. Past two or three documents, separate
profile files are easier to reason about, and the honest test is whether someone
can still answer "what is this value in prod" by looking.

## Gotchas

**Symptom:** a country code, a version string or a PIN binds to the wrong value from YAML
**Cause:** SnakeYAML implements YAML 1.1 implicit typing — `NO` is boolean false, `0123` is octal, `1.10` is a float that loses its trailing zero
**Fix:** quote every value that is conceptually a string:
```yaml
country: "NO"
version: "1.10"
pin: "0123"
```

**Symptom:** a `String` field ends up holding the literal text `"false"` and nobody can find where that came from
**Cause:** the YAML value was an unquoted `no`, `off` or `n`; YAML 1.1 resolved it to a boolean, and the binder then converted that boolean to a `String`
**Fix:** quote the value at the source. The conversion is working correctly — the type was already wrong by the time binding started

**Symptom:** editing a key in `application.yml` changes nothing, and the file has no obvious error
**Cause:** the key is defined twice in the same document and YAML silently takes the later occurrence rather than erroring
**Fix:** search the file for the key before editing it; when a file is long enough that this is a real risk, split it by concern or profile so any key has one obvious home

**Symptom:** a multi-document properties file behaves as a single document
**Cause:** the `#---` separator has leading whitespace, the wrong number of hyphens, or an adjacent line using the same comment prefix — all of which make it an ordinary comment
**Fix:** put the separator flush left with exactly three hyphens and ordinary lines around it, and prefer `.yml` where the multi-document syntax is less fragile

**Symptom:** a multi-document file works in the application and its documents are ignored in a test
**Cause:** multi-document files cannot be loaded through `@PropertySource` or `@TestPropertySource` — the documented restriction
**Fix:** let the test load configuration the ordinary way with `@SpringBootTest`, and use `@SpringBootTest(properties = …)` for per-test overrides rather than pointing an annotation at the multi-document file

**Symptom:** a document guarded by `spring.config.activate.on-profile` never activates, though the profile is definitely on
**Cause:** the document also carries an `on-cloud-platform` condition — when both are present, both must hold
**Fix:** split the two conditions into separate documents if they are meant to be independent, so each activates on its own terms

**Symptom:** a value appears three times in one file and nobody can tell which one is live
**Cause:** several activated documents define the same key, and later documents win — but the activation conditions are only visible by reading each document's header
**Fix:** keep the number of documents small, and check the resolved value with the `env` Actuator endpoint rather than reasoning about it from the file

## Interview questions

**★ Explain multi-document configuration files.**
One file can contain several documents separated by `---` in YAML or a `#---`
comment line in properties, each carrying its own
`spring.config.activate.on-profile` or `on-cloud-platform` so it applies only in
matching conditions. The separator rules are exact — flush left, exactly three
hyphens, and adjacent lines must not use the same comment prefix — and these
files cannot be loaded through `@PropertySource` or `@TestPropertySource`. The
value is keeping environment variation adjacent to what it varies instead of
scattered across files.

**★ What is the Norway problem, and what else does it imply about YAML?**
Spring parses `.yml` with SnakeYAML, which implements YAML 1.1 implicit typing,
where `no` — along with `yes`, `on`, `off`, `y` and `n` — is a boolean. So
`country: NO` binds as the boolean `false`, and to a `String` field it arrives
as the text `"false"`. The same class of bug covers leading zeros parsed as
octal and `1.10` parsed as a float that loses its trailing zero. The single
habit that avoids all of them is quoting every value that is conceptually a
string: country codes, version numbers, identifiers and PINs.

**★ Why do duplicate keys in YAML deserve a mention?**
Because a repeated key does not error — the later occurrence silently wins. In a
long `application.yml` that means an accidental duplicate, often introduced by a
merge, overrides the value someone is actively editing, and the file looks
entirely correct on inspection. It is a good argument for keeping configuration
files short and split by concern or profile, so any given key has one obvious
home and a duplicate is visible rather than buried.

**★ When would you use a multi-document file rather than separate profile files?**
When the variation is small and the values belong together — two or three keys
that differ between prod and staging, where seeing them side by side is clearer
than opening two files and diffing them. Past that, separate profile files win,
because a multi-document file has conditional logic inside it and conditional
logic is invisible when you scan a file for a key. The test worth applying is
whether a colleague can still answer "what is this value in prod" by reading.

**★ How do the two `spring.config.activate` conditions combine?**
They are ANDed: a document carrying both `on-profile` and `on-cloud-platform`
activates only when the profile expression matches *and* the platform matches.
That catches people who intended alternatives — a document meant to apply on
Kubernetes *or* in prod will never activate if both conditions are written into
the same document. Independent conditions belong in separate documents, and
`on-profile` itself accepts an expression, so alternatives among profiles can be
written as `prod | staging`.

**★ Why does the separator formatting have such exact rules?**
Because the separator has to be unambiguously distinguishable from ordinary
content: `---` is meaningful YAML, and in a properties file `#---` has to be
told apart from a genuine comment. Hence flush left, exactly three hyphens, and
the requirement that adjacent lines do not use the same comment prefix. When a
separator is slightly wrong the file remains perfectly valid — it simply becomes
one document with a comment in it — which is why the failure is silent and reads
as "my profile-specific block is being ignored".

---

← Prev: [Config data: files, locations and imports](02-config-data-files-and-imports.md) · Index: [Configuration and profiles](README.md) · Next → [Relaxed binding and environment variables](04-relaxed-binding-and-env-vars.md)
