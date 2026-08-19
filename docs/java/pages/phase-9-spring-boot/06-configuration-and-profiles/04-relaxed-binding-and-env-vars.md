---
title: "Relaxed binding and environment variables"
sidebar_label: "4 · Relaxed binding and env vars"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Boot reference *Externalized
> Configuration · Type-safe Configuration Properties · Relaxed Binding*
> (docs.spring.io/spring-boot/reference — the four property-source formats and
> their notes, the "Binding From Environment Variables" rules, and the map-key
> bracket-notation requirement). Spring Boot 4.1.0, Spring Framework 7.0.x,
> JDK 25.

**An operating system will not let you put a dot in an environment variable
name, and Java will not let you put a dash in a field name. Relaxed binding is
the documented translation between those two facts — a set of rules that maps
`MY_MAINPROJECT_PERSON_FIRSTNAME` onto `my.main-project.person.first-name` onto
a field called `firstName`. The rules are short, they are lossy in one
direction, and almost every "the environment variable is being ignored" ticket
is somebody who guessed them instead of learning them.**

## The canonical form

Every property has one **canonical name**, and it is the form the rules
normalise *towards*:

- lowercase only,
- words separated by `-` (kebab-case),
- levels separated by `.`,
- list elements addressed with `[n]`.

So `my.main-project.person.first-name` and `my.servers[0].host` are canonical.
This is the form to write in your own files and the form to quote in
documentation, because it is the only one every source can express.

## The four accepted formats

The reference gives four, one per kind of source:

| Property source | Accepted form | Example |
|---|---|---|
| `.properties` files | kebab-case (canonical) | `my.main-project.person.first-name` |
| `.yml` / `.yaml` files | kebab-case (canonical) | `my.main-project.person.first-name` |
| System properties | kebab-case **or** camelCase | `-Dmy.mainProject.person.firstName` |
| Environment variables | uppercase with underscores | `MY_MAINPROJECT_PERSON_FIRSTNAME` |

All four bind to the same field:

```java
@ConfigurationProperties("my.main-project.person")
public record PersonProperties(String firstName) {}
```

Note what the table does **not** say: it does not say every format works in
every source. The environment-variable form is *for* environment variables, and
writing `MY_MAINPROJECT_PERSON_FIRSTNAME` as a key inside `application.yml`
binds nothing at all.

## System property versus environment variable

The two are constantly treated as interchangeable and they differ in three ways
that matter.

**Syntax.** A system property keeps the dots, so it can be written in canonical
form and read like the property it is: `-Dmy.main-project.timeout=30s`. It also
accepts camelCase. An environment variable can do neither and must be mangled.

**Precedence.** System properties beat environment variables — entries 6 and 5
in the ordered stack from
[chunk 1](01-the-environment-and-precedence.md) — because a `-D` is attached to
one specific launch command while a variable is ambient.

**Visibility.** A system property appears in the process's own command line;
an environment variable is inherited and may have been set by a base image, an
orchestrator or a shell profile nobody in the room remembers writing. When both
are in play and the value is wrong, the environment is where to look first, and
the `env` Actuator endpoint reports which source actually won.

## Binding from environment variables — the three rules

To go from a canonical property name to the environment variable that supplies
it, apply exactly three transformations:

1. **Replace every `.` with `_`.**
2. **Remove every `-`.**
3. **Uppercase everything.**

Worked through:

```
my.main-project.person.first-name
→ my_main-project_person_first-name      (rule 1)
→ my_mainproject_person_firstname        (rule 2)
→ MY_MAINPROJECT_PERSON_FIRSTNAME        (rule 3)
```

The dash is **removed**, not replaced. `MY_MAIN_PROJECT_...` is a different
property — Boot reads that underscore as a level separator and looks for
`my.main.project...`, which does not exist. That single mistake accounts for
most of the failures in this area.

The rules exist because of a hard external constraint: **POSIX shells and most
process managers will not accept a `.` in a variable name**, so a dot-separated
key simply cannot be typed as an environment variable. Underscore is the only
separator available, which is why the dash has to be sacrificed — if underscore
meant both "dot" and "dash", the two would be indistinguishable.

## The direction of the lookup matters

The mental model that makes the rest of this chunk obvious: **binding is
pull-based.** The `Binder` starts from a name it already knows — taken from your
`@ConfigurationProperties` class — builds the candidate forms for it, and asks
each source whether it has any of them. It does not read the environment and try
to work out what your properties might be called.

That is why the mapping being lossy is survivable. `MY_MAINPROJECT` on its own
is ambiguous — it could have come from `my.mainproject` or `my.main-project` —
but nobody ever has to resolve that ambiguity, because the binder is asking
about a name it was given, not guessing at one it found.

It is also why **you cannot introduce a brand-new property tree purely from the
environment and expect it to be discovered.** The names have to exist somewhere
for something to ask for them.

## What `@Value` does and does not get

This is the distinction people get wrong most often, and it is genuinely subtle.

**`@Value` is not relaxed binding.** `@Value("${my.first-name}")` resolves that
placeholder literally against the `Environment` — there is no `Binder`, no
canonical form, and no camelCase/kebab-case equivalence. If the value lives in
YAML as `my.firstName`, the placeholder `${my.first-name}` does not find it.

**But `@Value` does still see environment variables**, because the relaxed part
of that lookup lives in the property source rather than in the binder:
`SystemEnvironmentPropertySource` accepts a request for `my.property.name` and
answers with `MY_PROPERTY_NAME`. So `@Value("${server.port}")` picks up
`SERVER_PORT` perfectly well.

The practical summary: **environment-variable name mangling works everywhere;
kebab/camel equivalence only works under `@ConfigurationProperties`.** Mixing
naming styles is safe in a typed configuration class and unsafe in a `@Value`.

## Map keys — where relaxed binding stops

For maps the rules invert, because **the key is data, not a name**, and
normalising it would corrupt it. Boot's rule is that a key containing anything
other than lowercase alphanumerics or `-` must be written in bracket notation so
the original characters survive:

```yaml
my:
  service:
    limits:
      "[api.reads]": 100          # key is literally  api.reads
      "[Legacy_Key]": 5           # key is literally  Legacy_Key
```

Without the brackets, `api.reads` would be read as two more levels of property
name rather than as one key containing a dot.

Now put that beside the environment-variable rules and the consequence is
unavoidable: **an environment variable cannot express a map key that needs
uppercase, a dot, or a dash**, because the three transformations flatten all
three away and there is no bracket syntax available inside a variable name. Map
keys that need punctuation or case have to come from a file — or from
`SPRING_APPLICATION_JSON`, which carries a whole JSON document verbatim and is
covered in [chunk 13](13-twelve-factor-and-secrets.md).

## The trade-off

Relaxed binding removes an entire category of friction: one property can be set
from a file, a `-D` flag, a CI variable or a Kubernetes `env:` block without
anyone rewriting it, and a class can use idiomatic Java names while files use
idiomatic kebab-case. That is worth a great deal.

What it costs is **greppability**. `grep -r "first-name"` will not find
`MY_MAINPROJECT_PERSON_FIRSTNAME` in a deployment manifest, and
`grep -r FIRSTNAME` will not find it in `application.yml`. The link between the
two is a rule in somebody's head, and that is precisely why the mangled form
should appear in exactly one place — the deployment manifest — and the canonical
form everywhere else.

## Gotchas

**Symptom:** `MY_MAIN_PROJECT_TIMEOUT` is set and the property `my.main-project.timeout` is still unset
**Cause:** the dash is **removed**, not converted to an underscore. That variable maps to `my.main.project.timeout`
**Fix:** delete the dash rather than replacing it:
```bash
MY_MAINPROJECT_TIMEOUT=30s
```

**Symptom:** an environment variable works for one property and is ignored for another in the same class
**Cause:** the one that works has no dash in its canonical name, so the naive "dots to underscores" guess happens to be correct; the one that fails has a dash
**Fix:** derive the variable name mechanically with all three rules every time, rather than by pattern-matching on one that worked

**Symptom:** `@Value("${my.first-name}")` returns null although `my.firstName` is set in `application.yml`
**Cause:** `@Value` resolves the placeholder literally — kebab/camel equivalence is a `Binder` feature and `@Value` does not use the `Binder`
**Fix:** bind the value with `@ConfigurationProperties`, or make the placeholder match the key exactly. Mixed naming styles are only safe under typed binding

**Symptom:** an uppercase, underscored key put into `application.yml` binds nothing
**Cause:** the uppercase-underscore form is the *environment variable* format; inside a file the accepted forms are kebab-case and, for system properties, camelCase
**Fix:** write the canonical form in files:
```yaml
my.main-project.person.first-name: "Ada"
```

**Symptom:** a `-D` flag and an environment variable are both set and the `-D` wins, contradicting a platform-level setting
**Cause:** system properties outrank environment variables in the documented order
**Fix:** pick one mechanism per concern rather than trying to out-set the other. If the platform must win, remove the `-D` from the entrypoint

**Symptom:** a map key that must contain a dot ends up creating extra nesting instead of a key
**Cause:** without bracket notation, a dot inside a key is read as another level of property name
**Fix:** quote and bracket the key so the literal characters survive:
```yaml
my:
  service:
    limits:
      "[api.reads]": 100
```

**Symptom:** a map key set from an environment variable arrives lowercased and without its dash
**Cause:** the three transformations apply to the whole variable name; there is no way to escape part of it
**Fix:** set that map from a file, or pass the block through `SPRING_APPLICATION_JSON`, which carries JSON verbatim

**Symptom:** nobody can find where a production value is set, and grep finds nothing in the repository
**Cause:** the value exists only in the deployment manifest, in the mangled uppercase form, which shares no substring with the canonical name once dashes are involved
**Fix:** treat the manifest as the single home for mangled names, and keep the canonical name in the class, the documentation and the default file, so there is always something to grep for

## Interview questions

**★ What exactly is relaxed binding?**
It is the set of rules the `Binder` applies when matching property names from a
source onto the properties of a `@ConfigurationProperties` object. Every
property has a canonical name — lowercase, kebab-case, dot-separated — and the
binder accepts several equivalent spellings of it depending on the source:
kebab-case in files, kebab-case or camelCase in system properties, and
uppercase-with-underscores in environment variables. The point is that one
property can be supplied from any source without being renamed.

**★ Give the exact rules for turning a property name into an environment variable name.**
Three, in order: replace every dot with an underscore, remove every dash, and
uppercase the result. So `my.main-project.person.first-name` becomes
`MY_MAINPROJECT_PERSON_FIRSTNAME`. The critical detail is that the dash is
*removed* rather than replaced — writing `MY_MAIN_PROJECT_PERSON_FIRSTNAME`
addresses `my.main.project.person.firstname`, a property that does not exist,
and the failure is silent.

**★ Why can't environment variables just use dots?**
Because POSIX shells and most process managers reject a dot in a variable name,
so the dot-separated form cannot be typed at all in the place where it is
needed. Underscore is the only separator available, which forces the second
rule: if underscore meant "dot", then dash cannot also map to underscore without
making the two indistinguishable, so dashes are dropped instead.

**★ Does `@Value` get relaxed binding?**
No, and this is the distinction worth being precise about. `@Value` resolves its
placeholder literally against the `Environment`, with no binder and no canonical
form, so `@Value("${my.first-name}")` will not find a YAML key written
`my.firstName`. What `@Value` *does* still get is environment-variable matching,
because that part lives in `SystemEnvironmentPropertySource` rather than in the
binder — `@Value("${server.port}")` picks up `SERVER_PORT` quite happily. So:
variable-name mangling works everywhere, kebab/camel equivalence only under
`@ConfigurationProperties`.

**★ The mapping from environment variable to property name is ambiguous. Why isn't that a problem?**
Because binding is pull-based. The binder starts from a name it already knows —
taken from your configuration class — generates the candidate forms for that
name, and asks each source whether it has one of them. It never has to look at
`MY_MAINPROJECT` and decide whether it means `my.mainproject` or
`my.main-project`. The corollary is that you cannot invent an entirely new
property tree in the environment and expect anything to pick it up: something
has to be asking for those names.

**★ Why do map keys need bracket notation, and what does that imply for environment variables?**
Because a map key is data rather than a name — normalising it would corrupt it,
and a dot inside a key would otherwise be read as another level of nesting. Boot
requires bracket notation for any key that is not purely lowercase alphanumerics
or dashes, which preserves the literal characters. The implication for
environment variables is a genuine limitation: the three name transformations
flatten case, dots and dashes away, and there is no bracket syntax available in
a variable name, so a map key needing punctuation or uppercase cannot be set
from one. It has to come from a file or from `SPRING_APPLICATION_JSON`.

**★ A system property and an environment variable can both set the same key. Which do you reach for?**
The environment variable, for anything the platform owns — it is what container
orchestrators, CI systems and secret managers actually give you, and it survives
a change of entrypoint. The `-D` system property is for the launch command
itself: a one-off override during an incident, or a value that is genuinely a
property of this invocation. It also wins, which makes it a good escape hatch
and a bad default, because a forgotten `-D` in an entrypoint quietly defeats
every platform-level setting.

---

← Prev: [Multi-document files and the YAML traps](03-multi-document-and-yaml-traps.md) · Index: [Configuration and profiles](README.md) · Next → [Constructor binding and records](05-constructor-binding-and-validation.md)
