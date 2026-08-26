---
title: "The key covers the arguments, so every input to the answer that is not an argument is a dimension missing from the key — and a missing dimension is not a cache miss, it is a confident wrong answer"
sidebar_label: "3c · Keys that silently vary"
sidebar_position: 8
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Cache Abstraction →
> Declarative Annotation-based Caching* (the key-generation and SpEL context sections)
> ([docs.spring.io/spring-framework/reference/integration/cache/annotations.html](https://docs.spring.io/spring-framework/reference/integration/cache/annotations.html))
> and *Understanding the Cache Abstraction*
> ([docs.spring.io/spring-framework/reference/integration/cache/strategies.html](https://docs.spring.io/spring-framework/reference/integration/cache/strategies.html)).
> JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8.

**The reference states the precondition in one sentence: caching "works only for methods that
are guaranteed to return the same output (result) for a given input (or arguments) no matter
how many times they are invoked." Most methods people cache do not satisfy that, because their
real inputs include things the parameter list never mentions — who is asking, which tenant,
which locale, what today is. The key does not know about any of it, and the cache will happily
serve one caller's answer to another.**

## The shape of every bug on this page

A method's answer is a function of two sets: **its arguments**, and **the ambient context it
reads**. The default key covers the first set exactly and the second set not at all.

If the second set is empty, caching is safe and dull. If it is not, and you do not put it in
the key, then two calls that the cache considers identical are not identical — and the second
one gets the first one's answer. That is not a performance bug. It is a correctness bug, and
in the common case it is a data-disclosure bug.

**And it is invisible in the way that matters.** A missing key dimension raises no exception,
logs nothing, and improves the hit rate. Every signal you have points the right way.

## The ambient inputs, one at a time

### The authenticated user

The most serious, and the most common:

```java
@Cacheable("dashboard")
public Dashboard forCurrentUser() {
    var principal = SecurityContextHolder.getContext().getAuthentication().getName();
    return build(principal);
}
```

No arguments, so the key is `SimpleKey.EMPTY` — one entry for the entire application. The first
user to hit the endpoint after a deploy populates it and every other user is served their
dashboard. Nothing fails. The cache is doing exactly what it was told.

The version with an argument is not automatically better:

```java
@Cacheable("orders")
public List<Order> ordersFor(Long customerId) { … }
```

That one keys correctly *if* the method's answer depends only on `customerId`. If the service
also filters by the caller's permissions — a support agent sees masked fields, an admin sees
all of them — then the answer depends on the caller too, and two different callers asking about
the same customer share one entry.

### The tenant

Schema-per-tenant, database-per-tenant and discriminator-column-per-tenant all have the same
property: the tenant is resolved from context, not passed as a parameter, precisely so that
application code does not have to thread it through. Caching reintroduces the coupling —
the cache is one map per JVM, shared across every tenant the pod serves.

### Locale, and everything derived from it

`LocaleContextHolder` is ambient by design. A method returning translated labels, formatted
currency, a localized product description or a sorted list (collation is locale-dependent) is
locale-varying. Caching it under a key without the locale means the first requester's language
becomes everyone's language, until eviction.

### Time, and "today"

```java
@Cacheable("summaries")
public Summary summaryFor(Long accountId) {
    return summarise(accountId, LocalDate.now());
}
```

The key is the account. The answer contains a date. At midnight the answer changes and the key
does not, so the cache serves yesterday's summary for as long as the entry lives. This is one
of the few cases where a TTL is a genuine fix rather than a plaster — but only if the TTL is
short relative to the boundary, and it still serves the wrong day for the length of the window.

Time zone is the same problem one level subtler: "today" for a user in Auckland and a user in
Los Angeles are different days, resolved from context, absent from the key.

### Roles, permissions and row-level filtering

Any query whose result set depends on who is running it — row-level security, a permission
join, a `@PreFilter`, a Hibernate `@Filter` enabled on the session for soft deletes or
organisation scoping — produces different rows for the same arguments. The filter is enabled on
the session; the cache sits above the session and cannot see it.

### Feature flags and experiment buckets

A method whose branch depends on a flag evaluated per user, or on an A/B bucket, is
user-varying by construction. Flag flips are worse still: the flag changes, the code path
changes, and the cache keeps serving results produced by the old branch with no eviction
anywhere.

### API version and content negotiation

A shared service method that shapes its response according to a requested version, or a
`@Cacheable` sitting on something that reads the `Accept` header, varies by request metadata
that never reaches the parameter list.

### Anything non-deterministic inside the method

`Random`, `UUID.randomUUID()`, a shuffle, a "featured item" chosen by rotation. These are not
missing dimensions so much as an outright violation of the precondition the reference states.
The first call's dice roll becomes permanent.

### The shape of your own classes

The value in a persistent cache was serialized by the code that was deployed when it was
written. Add a field, change a type, rename a package, and the entry that comes back is shaped
by yesterday's class. This one belongs to the key because the usual fix is a version segment in
the key or the cache name — see
[5b · Serialization is the hard part](05b-serialization-is-the-hard-part.md).

## "Just add it to the key" is right, and it is not enough

Adding the missing dimension is the correct fix for the method in front of you:

```java
@Cacheable(cacheNames = "dashboard", key = "#root.target.currentUserId()")
```

It is not a fix for the class, because it is a convention, and the next cached method added to
that class next year will not have it. The structural version is one of these two:

**Make the ambient input an argument.** `dashboardFor(String userId)` cannot be cached wrongly
by accident — the default key generator covers it, and so does every future method that takes
the same parameter. This is the single highest-value change in this whole topic, because it
converts a discipline into a type signature.

**Or put it in a `KeyGenerator` and apply it as the default for that cache.** Then the
dimension is in the key whether or not the author of the next method thought about it.
See [3b · Writing the key yourself](03b-writing-the-key-yourself.md).

The inverse failure — a key that carries *more* than the answer depends on, and therefore never
repeats — is [3d · The key that never repeats](03d-the-key-that-never-repeats.md).

## Gotchas

**★ A cached method that reads `SecurityContextHolder` is a data-disclosure bug by default.**
No arguments means one shared entry; the first caller's answer becomes everyone's.

**★ Adding the correct key to one method does not protect the class.** The next cached method
added there will be written by somebody who did not read this page.

**★ Tenant context is ambient on purpose, which is exactly why it is missing from the key.**
The pattern that keeps application code clean is the pattern that makes the cache wrong.

**★ Locale affects sorting, not just text.** A "cached list of countries" is locale-varying even
if every string in it is a code.

**★ A method that computes `LocalDate.now()` internally is time-varying with a time-invariant
key.** The entry outlives the day it describes.

**★ Time zone is a second, independent time dimension.** Two users on the same wall clock can
be on different days.

**★ A Hibernate session filter is invisible to the cache.** The filter shapes the result set;
the key describes the arguments; nothing connects them.

**★ Flipping a feature flag does not evict anything.** Entries produced by the old branch stay
until they expire, so the flag appears not to have taken effect — for some users.

**★ A cached value is shaped by the class that serialized it**, so a deployment that changes
that class changes the meaning of every surviving entry without touching a key.

**★ Row-level security and permission filters make "the same query" return different rows per
caller**, and the cache sits above the layer that knows this.

**★ The security version of this bug is not found by tests, because tests run as one user.**
A single-principal integration test cannot distinguish "cached correctly" from "cached
globally".

## Interview questions

**★ What is the precondition for caching a method's return value?**
The reference states it directly: the approach "works only for methods that are guaranteed to
return the same output (result) for a given input (or arguments) no matter how many times they
are invoked." So the method must be a pure function of its parameters. In practice that is the
question I ask about any `@Cacheable` I see: what does this answer depend on, and is all of it
in the parameter list? Everything on this page is a way of the answer being no.

**★ Somebody adds `@Cacheable` to a method that reads the current user from the security
context. What happens?**
If the method takes no arguments, the key is the empty key, so there is exactly one entry for
the whole application and every user is served whichever user warmed it first. If it takes
arguments unrelated to the principal, the entry is shared by all callers who pass those
arguments. Either way it is a data-disclosure bug that raises no exception, logs nothing and
improves the hit rate — every signal points the wrong way. It is also the version that
single-user integration tests cannot catch.

**★ How would you make user-scoped caching safe rather than merely correct once?**
By making the user id a method parameter rather than an ambient read. Then the default key
generator covers it, the method signature documents the dependency, and the next method somebody
adds to that class inherits the protection instead of relying on remembering. If the ambient
read cannot be removed, the second-best option is a `KeyGenerator` applied as that cache's
default, so the dimension is in the key whether or not the author thought about it. Putting the
principal in a per-annotation SpEL expression is the version I trust least, because it is a
convention repeated by hand at every call site.

**★ Why is a TTL a legitimate fix for the `LocalDate.now()` case but not for the security case?**
Because the two failure modes are different in kind. With `now()` the cached answer was correct
when it was written and becomes stale, so a TTL bounds how wrong it can get and the worst case is
a user seeing yesterday's summary. With a missing principal in the key the answer was never
correct for the caller receiving it, so a TTL only bounds how long the disclosure lasts. A TTL
is a staleness control; it is not an access control.

**★ Your application is multi-tenant with a tenant resolved from the request. What does that
imply for every cache in it?**
That every cache key must carry the tenant, and I would not want that to be a per-annotation
decision. I would make it the default `KeyGenerator` for the application, so a cache cannot be
added without it, and I would want a test that exercises the same method under two tenants and
asserts the answers differ. The reason to make it structural rather than conventional is that
the failure is cross-tenant data disclosure, and the probability that every future author
remembers is not one.

**★ Can you cache something that depends on a Hibernate session filter?**
Not with a key that ignores the filter. The filter is enabled on the session and changes which
rows the query returns; the cache sits above the session and keys on the method arguments, so
two callers with different filter parameters share an entry. If the filter parameter is
essentially a tenant or an organisation id, the honest fix is the same one as for tenancy: put
it in the key, preferably by making it an argument. If it is a soft-delete filter that is always
on, it is stable and does not need to be in the key — but "always on" is an assumption worth
checking rather than inheriting.

{/* FOOTER */}
