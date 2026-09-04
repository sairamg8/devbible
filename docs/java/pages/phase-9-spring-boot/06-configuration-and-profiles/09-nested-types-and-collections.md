---
title: "Nested types, collections and maps"
sidebar_label: "9 · Nested types and collections"
sidebar_position: 9
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Boot reference *Externalized
> Configuration · Type-safe Configuration Properties* (docs.spring.io/spring-boot/reference
> — nested POJO binding for JavaBean and constructor-bound types, `[index]`
> notation for lists and sets, map binding and the bracket-notation rule for
> keys, the `@Name` annotation for reserved keywords, and the *Merging Complex
> Types* section: a list configured in more than one place is **replaced**, a
> map is **merged**). Spring Boot 4.1.1, Spring Framework 7.0.x, JDK 25.

**Configuration is a tree, and the two shapes at its leaves behave in opposite
ways when two sources both supply them. A list is replaced wholesale by the
higher-priority source; a map is merged key by key. That asymmetry is
documented, it is not symmetrical for a reason, and it is behind most of the
"why did my other three entries disappear" incidents that typed binding is
supposed to have eliminated.**

## Nesting is structure, not decoration

A nested type turns a flat prefix into a shape that matches how the settings are
actually used:

```java
@ConfigurationProperties("invoice.api")
public record InvoiceApiProperties(
        URI url,
        @DefaultValue Retry retry,
        @DefaultValue Auth auth) {

    public record Retry(@DefaultValue("3") int maxAttempts,
                        @DefaultValue("500ms") Duration backoff) {}

    public record Auth(String clientId, String clientSecret) {}
}
```

The property names follow the nesting exactly — `invoice.api.retry.max-attempts`,
`invoice.api.auth.client-id` — and the component names are lowered to canonical
form on the way, so `maxAttempts` is written `max-attempts` in every file.

Two rules from [chunk 5](05-constructor-binding-and-validation.md) apply at each
level. **Nested members of a constructor-bound type are bound through their own
constructors**, so nested records need nothing extra. In a JavaBean-bound class,
a nested POJO must either be pre-initialised (getter only) or have a setter, or
it stays null.

**Nest by the boundary a reader would draw**, not to save typing. `retry` and
`auth` are separate concerns of one client and read that way in a manifest; a
nested type created only to shorten a prefix produces keys nobody can guess.

## Reserved keywords

A property whose canonical name collides with a Java keyword cannot also be a
component name. `@Name` decouples the two:

```java
@ConfigurationProperties("my.service")
public record MyProperties(@Name("import") String importPath) {}
```

The property stays `my.service.import`, which is what the configuration file
needs; the component is `importPath`, which is what Java needs.

## Lists and sets

A YAML sequence, a properties index and an environment variable are three
spellings of the same thing:

```yaml
my:
  servers:
    - "dev.example.com"
    - "another.example.com"
```

```properties
my.servers[0]=dev.example.com
my.servers[1]=another.example.com
```

```bash
MY_SERVERS_0=dev.example.com
MY_SERVERS_1=another.example.com
```

All three bind to a `List<String>` or a `Set<String>`. The `[index]` notation is
what Boot's `Binder` uses internally, which is why the properties and
environment forms both spell it positionally.

⚠️ **Indexes must be contiguous from zero.** A gap terminates the list: setting
`[0]` and `[2]` gives a one-element list, silently, with no warning about the
orphan.

Lists of nested objects index the whole object:

```yaml
my:
  endpoints:
    - name: "primary"
      url: "https://a.example.com"
    - name: "secondary"
      url: "https://b.example.com"
```

## Maps

A map's keys are **data**, so the binder must not normalise them — which is why
any key that is not purely lowercase alphanumerics or `-` has to be bracketed so
the original characters survive:

```yaml
my:
  service:
    limits:
      reads: 100                # plain key, no brackets needed
      "[api.writes]": 20        # key is literally  api.writes
      "[Legacy_Key]": 5         # key is literally  Legacy_Key
```

Without brackets, `api.writes` is read as two more levels of property name and
you get a nested map you did not ask for.

This is also the limit of what an environment variable can express: the three
name transformations from [chunk 4](04-relaxed-binding-and-env-vars.md) flatten
case, dots and dashes, and there is no bracket syntax in a variable name. Map
keys needing punctuation or case must come from a file.

## 🔴 Lists are replaced, maps are merged

The documented rule, and the one thing from this chunk to memorise:

| Type | Configured in more than one source | Result |
|---|---|---|
| `List` / `Set` | higher-priority source wins | the **entire** collection is replaced |
| `Map` | both contribute | entries are **merged**, matching keys overridden |

So with `application.yml` holding three servers and an environment variable
setting `MY_SERVERS_0`, the application sees **one** server, not four and not
three-with-one-changed. And with a map, setting one key from the environment
leaves the other entries from the file in place.

The asymmetry is not an accident. A list has no stable identity per element —
"element 1" means nothing across sources, and merging positionally would produce
a collection nobody wrote. A map's keys *are* identities, so merging is
well-defined and overriding a single entry is exactly what an operator wants.

The practical consequences:

- **Never split one logical list across two sources.** Keep it whole in one
  file and override the whole thing when it changes.
- **Prefer a map when operators need to override one entry.** `my.limits.reads`
  can be raised in production without restating the other limits; a list of
  limit objects cannot.

## The trade-off

Structured binding is what makes configuration a value object rather than a bag
of strings, and the cost is that the *file* now has a schema that nobody
validates. A misspelled nested key does not fail — it binds nothing, silently,
because there is no requirement that every property in a source correspond to a
field. That is the mirror image of the null-property problem from
[chunk 1](01-the-environment-and-precedence.md), and the mitigations are the
same three: validation constraints so the missing value is fatal, IDE metadata
so the key is completed rather than typed, and the `configprops` Actuator
endpoint to see what actually bound.

## Gotchas

**Symptom:** a list configured in `application.yml` loses every entry but the first when one is overridden from the environment
**Cause:** lists are replaced, not merged — the higher-priority source supplies the whole collection
**Fix:** override the whole list, or restructure it as a map so individual entries can be set independently:
```yaml
my.servers.primary: "dev.example.com"
my.servers.secondary: "another.example.com"
```

**Symptom:** a three-element list arrives with one element
**Cause:** the indexes are not contiguous from zero, so binding stopped at the gap
**Fix:** renumber from `[0]` with no gaps; a deleted middle entry has to be renumbered, not left as a hole

**Symptom:** a map key containing a dot produces nested maps instead of one entry
**Cause:** without bracket notation a dot in a key is read as another level of property name
**Fix:** bracket and quote it:
```yaml
my.service.limits."[api.writes]": 20
```

**Symptom:** a nested configuration object is null in a JavaBean-bound class although its properties are set
**Cause:** the nested field was neither pre-initialised nor given a setter, so the binder had nothing to populate
**Fix:** pre-initialise it and expose a getter, add a setter, or move the class to constructor binding where nested members bind through their own constructors

**Symptom:** a misspelled key in `application.yml` is silently ignored
**Cause:** nothing requires a property in a source to correspond to a field; unmatched keys are simply unused
**Fix:** rely on IDE metadata to complete the key rather than typing it, constrain the target with `@NotNull` so absence is fatal, and check `configprops` for what actually bound

**Symptom:** a property called `import` cannot be expressed as a record component
**Cause:** the canonical property name is a Java keyword
**Fix:** decouple the two names:
```java
public record MyProperties(@Name("import") String importPath) {}
```

**Symptom:** a list of nested objects binds only its first element from a properties file
**Cause:** each element's fields must repeat the index — `my.endpoints[0].name`, `my.endpoints[1].name` — and one of them was written without it
**Fix:** index every field of every element, or use YAML, where the sequence syntax makes the mistake impossible

**Symptom:** an operator raises one limit in production and the others revert to their packaged values
**Cause:** the limits were modelled as a list of objects, so setting one replaced the collection
**Fix:** model per-entry-overridable settings as a map keyed by name, which merges

## Interview questions

**★ What happens when a list is configured in two property sources, and what happens to a map?**
The list is **replaced** — the highest-priority source supplies the whole
collection, and the lower source's entries disappear entirely rather than
merging or appending. A map is **merged** — both sources contribute entries and
matching keys are overridden. It is the documented behaviour and it is
asymmetric on purpose: a list element has no identity across sources, so
positional merging would produce a collection nobody wrote, whereas a map's keys
are identities and merging is well-defined.

**★ How would you design configuration that an operator needs to override one entry of?**
As a map keyed by something meaningful, not as a list of objects. A map lets
`my.limits.reads` be raised from an environment variable while every other entry
stays as packaged; the same settings modelled as a list force the operator to
restate the entire collection to change one number, and the commonest failure is
restating it incompletely.

**★ Why do map keys need bracket notation, and when exactly?**
Because a key is data rather than a name — a dot inside it would otherwise be
read as another level of nesting, and normalising case or dashes would change
the key. The rule is that any key which is not purely lowercase alphanumerics or
dashes must be bracketed so the literal characters survive. The corollary is a
real limitation: environment variables cannot express such keys at all, because
the name transformations flatten case, dots and dashes and there is no bracket
syntax available.

**★ What is the trap with indexed properties?**
Indexes must be contiguous from zero, and a gap terminates the list without any
diagnostic. The usual way to create one is deleting a middle entry from a
properties file or a manifest and not renumbering, and the result is a list that
silently loses everything after the hole. YAML sequences avoid the problem
entirely, which is one of the few concrete arguments for YAML over properties.

**★ How do nested types bind, and what differs between the two binding modes?**
The property path follows the nesting — `invoice.api.retry.max-attempts` for a
`retry` component with a `maxAttempts` field. Under constructor binding, nested
members are bound through their own constructors, so nested records need no
annotation; a bare `@DefaultValue` on the nesting point is worth adding so an
absent block yields a defaulted object rather than null. Under JavaBean binding,
a nested POJO must either be pre-initialised — in which case a getter is enough,
because the binder mutates the existing instance — or have a setter, otherwise
it stays null.

**★ A key in `application.yml` is misspelled. What tells you?**
Nothing, by default: unmatched properties are simply unused, because there is no
requirement that a source's keys correspond to fields. That is the same
silent-absence problem as an unset property, and it has the same three
mitigations — validation constraints so a missing required value is fatal at
startup, the configuration metadata processor so the IDE completes keys instead
of you typing them, and the `configprops` Actuator endpoint, which shows what
actually bound rather than what you meant.

---

← Prev: [Typed properties versus `@Value`](08-typed-properties-vs-value.md) · Index: [Configuration and profiles](README.md) · Next → [Conversion, durations and data sizes](10-conversion-and-units.md)
