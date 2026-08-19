---
title: "Conversion, durations and data sizes"
sidebar_label: "10 · Conversion and units"
sidebar_position: 10
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Boot reference *Externalized
> Configuration · Type-safe Configuration Properties · Properties Conversion*
> (docs.spring.io/spring-boot/reference — `ApplicationConversionService`,
> custom converters annotated `@ConfigurationPropertiesBinding`, converting
> durations with `@DurationUnit` and the `ns`/`us`/`ms`/`s`/`m`/`h`/`d`
> suffixes, converting periods with `@PeriodUnit` and the `y`/`m`/`w`/`d`
> suffixes, and converting data sizes with `@DataSizeUnit` and the
> `B`/`KB`/`MB`/`GB`/`TB` suffixes), and the *Relaxed Binding 2.0* design note
> for lenient enum matching. Spring Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**Every property arrives as text, and the interesting question is who turns it
into a `Duration`. Boot's answer is a conversion service applied during binding,
with three purpose-built types — `Duration`, `Period`, `DataSize` — that exist
because `int timeoutMillis` is a bug waiting for the first person who assumes
seconds. Getting the units into the type rather than into the field name is one
of the cheapest correctness wins available in a Spring application.**

## The conversion service

Binding runs values through `ApplicationConversionService`, which handles the
obvious cases without any configuration: primitives and their boxes, `String`,
enums, `Charset`, `Locale`, `URI` and `URL`, `File` and `Path`, `Resource`,
`InetAddress`, `Class`, and comma-delimited text into arrays and collections.

**Enum constants are matched leniently.** Case is ignored and dashes and
underscores are treated as equivalent, so all of these bind the same constant:

```yaml
my.service.isolation: "read-uncommitted"    # ✅ READ_UNCOMMITTED
my.service.isolation: "READ_UNCOMMITTED"    # ✅
my.service.isolation: "read_uncommitted"    # ✅
```

That is deliberate: the kebab-case form is what documentation and configuration
files use everywhere else, and forcing `SCREAMING_SNAKE_CASE` into a YAML file
purely because Java spells enums that way would be gratuitous.

## Durations

`Duration` should be the type of every timeout, interval and delay in your
configuration. It accepts two spellings:

```yaml
my.service.read-timeout: "PT30S"     # ISO-8601
my.service.read-timeout: "30s"       # simplified
```

The simplified suffixes are `ns`, `us`, `ms`, `s`, `m`, `h`, `d`.

A value with **no suffix** is interpreted as milliseconds — unless the property
declares another default unit:

```java
@ConfigurationProperties("my.service")
public class MyProperties {

    @DurationUnit(ChronoUnit.SECONDS)
    private Duration sessionTimeout;      // "30" now means 30 seconds
}
```

`@DurationUnit` exists mainly for **migrating an existing numeric property**
without breaking the deployments that set it. A field that used to be
`sessionTimeoutSeconds` becomes a `Duration` annotated `SECONDS`, every existing
manifest keeps working, and new deployments can start writing `30m`.

⚠️ **For a new property, do not use `@DurationUnit` — require the suffix.** An
unsuffixed number is exactly the ambiguity the type was introduced to remove,
and a default unit quietly reintroduces it for anyone reading the file.

## Periods

`Period` covers calendar-based spans, where "one month" is not a fixed number of
seconds and a `Duration` would be wrong:

```java
@PeriodUnit(ChronoUnit.DAYS)
private Period reportingPeriod;
```

Suffixes are `y`, `m`, `w`, `d`, and the ISO-8601 form (`P3M`) is accepted. An
unsuffixed value means days unless `@PeriodUnit` says otherwise.

**Choose between the two by whether a calendar is involved.** A retention window
of "three months" is a `Period`; an HTTP read timeout of "thirty seconds" is a
`Duration`. Modelling a retention policy as a `Duration` of 90 days is the bug
that appears once a year, in February.

## Data sizes

`DataSize` does the same job for bytes:

```yaml
my.service.max-upload: "10MB"
my.service.buffer: "512KB"
```

Suffixes are `B`, `KB`, `MB`, `GB`, `TB`; an unsuffixed value is bytes unless
`@DataSizeUnit` declares otherwise:

```java
@DataSizeUnit(DataUnit.MEGABYTES)
private DataSize maxFileSize;
```

The same advice applies as for durations — the annotation is a migration aid,
not a design choice.

## Custom converters

When a property should become a domain type, register a `Converter` and mark it
for the binder:

```java
@Configuration(proxyBeanMethods = false)
public class MyConverterConfiguration {

    @Bean
    @ConfigurationPropertiesBinding
    public Converter<String, Person> personConverter() {
        return source -> Person.parse(source);
    }
}
```

**`@ConfigurationPropertiesBinding` is the whole point of that declaration.**
An ordinary `Converter` bean joins the application's conversion service, which
is not the one used during property binding — binding happens early, before most
of the context exists. The annotation is what makes the converter available to
the binder.

A converter is the right tool when the type has a canonical text form somebody
would naturally write in a file — a duration-like domain type, an account
identifier with a checksum, a version range. It is the wrong tool for structure:
if the value has fields, model it as a nested type
([chunk 9](09-nested-types-and-collections.md)) rather than inventing a
delimiter and parsing it.

## The trade-off

Rich conversion means a configuration file reads like prose — `30s`, `10MB`,
`read-uncommitted` — and the application receives types that carry their units,
which removes an entire class of off-by-1000 error. The cost is a small amount
of magic at the boundary: a value that fails to convert produces a binding
failure whose message is about types rather than about intent, and a custom
converter is a piece of behaviour that lives nowhere near the property it
affects. Keeping converters rare, and preferring nested types for anything
structured, is what stops that boundary becoming a second configuration language.

## Gotchas

**Symptom:** a timeout configured as `30` behaves as if it were instant
**Cause:** an unsuffixed `Duration` value is milliseconds, and 30ms is not 30 seconds
**Fix:** always write the suffix:
```yaml
my.service.read-timeout: "30s"
```

**Symptom:** an existing numeric property breaks when its field is changed to `Duration`
**Cause:** deployments are setting a bare number that used to mean seconds and now means milliseconds
**Fix:** declare the legacy unit so old manifests keep working while new ones use suffixes:
```java
@DurationUnit(ChronoUnit.SECONDS)
private Duration sessionTimeout;
```

**Symptom:** a retention policy of "three months" is a few days out at some times of year
**Cause:** it was modelled as a `Duration` of 90 days; a `Duration` is a fixed quantity of time and months are not
**Fix:** use `Period` for calendar spans — `P3M` or `3m` — so the arithmetic follows the calendar

**Symptom:** a custom `Converter` bean is ignored during binding but works elsewhere in the application
**Cause:** binding uses its own conversion service and only picks up converters marked for it
**Fix:** annotate the bean:
```java
@Bean
@ConfigurationPropertiesBinding
public Converter<String, Person> personConverter() { … }
```

**Symptom:** an upload limit set to `10` allows almost nothing through
**Cause:** an unsuffixed `DataSize` is bytes
**Fix:** write `10MB`, and reserve `@DataSizeUnit` for properties that already existed as plain numbers

**Symptom:** an enum property fails to bind for one value and works for the rest
**Cause:** lenient matching covers case, dashes and underscores — it does not cover a misspelling or a constant that was renamed
**Fix:** check the constant actually exists; the leniency is about spelling conventions, not about approximate matching

**Symptom:** a comma-delimited string binds to a `List` in one place and not in another
**Cause:** the target is an array or collection in the first case and a single `String` in the second, where the commas are just characters
**Fix:** make the target type a `List<String>`, or use the indexed form so the intent is explicit

## Interview questions

**★ Why does Spring Boot have a `Duration` type in configuration at all?**
Because `int timeoutMillis` puts the unit in the field name, where nothing
enforces it and every reader has to trust it. Binding to `java.time.Duration`
moves the unit into the value — `30s`, `PT30S`, `5m` — so the file says what it
means and the application receives a type that cannot be misread as the wrong
scale. It is the cheapest available fix for the off-by-1000 class of bug.

**★ What does an unsuffixed duration mean, and how do you change it?**
Milliseconds, by default. `@DurationUnit(ChronoUnit.SECONDS)` on the property
changes the default unit for values that carry no suffix. The important part is
*when* to use it: it is a migration aid, so an existing numeric property that
meant seconds keeps working when its field becomes a `Duration`. On a new
property it is a mistake — it reintroduces exactly the ambiguity the type
removed, for anyone reading the file without reading the class.

**★ `Duration` or `Period`?**
`Duration` is a fixed quantity of time and is right for timeouts, intervals and
delays. `Period` is calendar-based and is right for spans where the answer
depends on which months are involved — retention windows, billing cycles,
subscription lengths. The failure mode of getting it wrong is seasonal: a
"three month" retention modelled as 90 days is correct in some quarters and
wrong in others, which makes it very hard to notice.

**★ Why does a custom converter need `@ConfigurationPropertiesBinding`?**
Because property binding runs early — before most of the application context
exists — and uses its own conversion service rather than the general-purpose
one. A plain `Converter` bean is registered too late and in the wrong place to
influence binding. The annotation marks the bean as one the binder should pick
up, which is why the symptom of leaving it off is a converter that works
perfectly everywhere except where you wanted it.

**★ How lenient is enum binding?**
It ignores case and treats dashes and underscores as equivalent, so
`read-uncommitted`, `READ_UNCOMMITTED` and `read_uncommitted` all bind the same
constant. That exists so configuration files can use the kebab-case convention
they use everywhere else instead of importing Java's naming style. It is not
fuzzy matching: a misspelling or a constant that was renamed still fails, and it
fails at binding time rather than silently choosing something near.

**★ When would you write a converter instead of a nested type?**
When the value has a canonical *text* form that a human would naturally write in
a file and no useful internal structure to configure — an account identifier
with a checksum, a version range, a domain-specific quantity. If the value has
fields, a nested type is better: it gives each field its own key, its own
default, its own validation constraint and its own line in the IDE's completion,
none of which a hand-parsed delimited string can offer.

---

← Prev: [Nested types, collections and maps](09-nested-types-and-collections.md) · Index: [Configuration and profiles](README.md) · Next → [Profiles: activation, expressions and groups](11-profiles.md)
