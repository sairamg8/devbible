---
title: "`condition` runs before the method and switches the whole cache off, `unless` runs after and only vetoes the write — and in between, a method that returned `null` gets cached, on purpose"
sidebar_label: "4 · Condition, unless and null"
sidebar_position: 10
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Cache Abstraction →
> Declarative Annotation-based Caching* — *Conditional Caching*, *Available Caching SpEL
> Evaluation Context* and the `Optional` note
> ([docs.spring.io/spring-framework/reference/integration/cache/annotations.html](https://docs.spring.io/spring-framework/reference/integration/cache/annotations.html)),
> `AbstractValueAdaptingCache` on the 7.0.x branch
> ([github.com/spring-projects/spring-framework](https://github.com/spring-projects/spring-framework/blob/7.0.x/spring-context/src/main/java/org/springframework/cache/support/AbstractValueAdaptingCache.java)),
> and the Spring Boot 4.1 reference *Caching*
> ([docs.spring.io/spring-boot/reference/io/caching.html](https://docs.spring.io/spring-boot/reference/io/caching.html)).
> JDK 25, Spring Boot 4.1.1, Spring Framework 7.0.9.

**Two attributes decide whether an entry exists, and they are not symmetrical. `condition` is
evaluated before the invocation and disables the cache in both directions. `unless` is
evaluated after and blocks only the write, so a value already in the cache is still returned
even when `unless` would have refused to put it there. And separately from both, `null` is a
value the abstraction stores rather than treats as absence — which is a real feature and a real
liability.**

## `condition` — evaluated first, and it turns the cache off entirely

> *"Sometimes, a method might not be suitable for caching all the time (for example, it might
> depend on the given arguments). The cache annotations support such use cases through the
> `condition` parameter, which takes a `SpEL` expression that is evaluated to either `true` or
> `false`. If `true`, the method is cached. If not, it behaves as if the method is not cached
> (that is, the method is invoked every time no matter what values are in the cache or what
> arguments are used)."*

```java
@Cacheable(cacheNames = "book", condition = "#name.length() < 32")
public Book findBook(String name) { … }
```

The phrase to hold onto is **"as if the method is not cached"**. A false `condition` does not
just skip the write — it skips the *read*. The method runs, and any entry that happens to be
sitting there under that key is neither consulted nor updated.

That makes `condition` the right tool for a genuine bypass:

```java
@Cacheable(cacheNames = "catalogue", key = "#sku", condition = "!#forceRefresh")
public Product lookup(String sku, boolean forceRefresh) { … }
```

⚠️ But read what that actually does. With `forceRefresh = true` the method runs and the **stale
entry stays exactly where it was** — the next ordinary caller still gets it. A "refresh" that
does not refresh anything is a common and disappointing result; if you want the entry replaced,
you want `@CachePut`, or a `@CacheEvict` alongside.

`condition` cannot see `#result` — the method has not run — so it can only reason about the
arguments, the target and the method itself.

## `unless` — evaluated last, and it only blocks the put

> *"In addition to the `condition` parameter, you can use the `unless` parameter to veto the
> adding of a value to the cache. Unlike `condition`, `unless` expressions are evaluated after
> the method has been invoked."*

```java
@Cacheable(cacheNames = "book", condition = "#name.length() < 32", unless = "#result.hardback")
public Book findBook(String name) { … }
```

Three consequences follow from "after the method has been invoked", and the third is the one
that surprises people:

1. `unless` can use `#result`. That is its entire reason to exist.
2. `unless` is evaluated only on a **miss**, because on a hit the method never ran.
3. **`unless` does not stop a hit being served.** If a value was cached earlier — before the
   `unless` clause was added, or by a code path where the expression was false — it is still
   returned. `unless` is a write filter, not a read filter.

So `unless = "#result == null"` prevents *new* nulls being stored. It does nothing about the
nulls already in the cache, and it does not stop them being returned.

**The rule of thumb: if the decision depends on the arguments, use `condition`, because it is
cheaper and it governs both directions. If it depends on the answer, you have no choice but
`unless`, and you should be aware you have only half a switch.**

## `null` is a value, not an absence

This is the part people find surprising, and it is deliberate. The framework's own
`AbstractValueAdaptingCache` substitutes a sentinel:

```java
protected Object toStoreValue(@Nullable Object userValue) {
    if (userValue == null) {
        if (this.allowNullValues) {
            return NullValue.INSTANCE;
        }
        throw new IllegalArgumentException(
            "Cache '" + getName() + "' is configured to not allow null values but null was provided");
    }
    return userValue;
}
```

and reverses it on the way out. So a cache can distinguish **"no entry for this key"** from
**"an entry whose value is null"**, and by default it does. `Cache.get(key)` returning a
`ValueWrapper` rather than the value itself exists for exactly this reason: a `null`
`ValueWrapper` means absent, a non-null wrapper containing `null` means present-and-null.

**Why you want this.** Without it, every lookup of an id that does not exist is a database round
trip, every time, forever. A user pasting a bad order number into a support tool, a crawler
walking an id space, a client retrying a 404 — none of them are ever absorbed by the cache.
Negative caching is what stops "not found" being the most expensive answer your system gives.

`allowNullValues = false` turns it into a loud failure instead: an `IllegalArgumentException`
naming the cache. That is occasionally what you want on a cache where null genuinely indicates
a bug, and it is a bad default because the exception surfaces at the cache layer for a problem
that lives in the method.

On Redis the equivalent switch is Boot's `spring.cache.redis.cache-null-values`, which defaults
to `true`, matching the framework's behaviour.

## Negative caching is also an attack surface

Follow the mechanism honestly and the downside is obvious: **anyone who can ask for keys that do
not exist can fill your cache.** A public endpoint that takes an identifier, caches misses, and
has no bound on the key space will happily store an entry per garbage request.

The mitigations are ordinary, and they are all things you would want anyway:

- **Validate the shape of the key before the cached call.** A method that only ever sees
  well-formed identifiers has a bounded key space. This is the one that actually works, and it
  belongs outside the cached method — a `@Cacheable` on a method that is called with anything
  is a cache with an unbounded key space, which is
  [3d](03d-the-key-that-never-repeats.md) again.
- **Give the cache a maximum size or a TTL**, so a flood evicts itself rather than accumulating.
- **Consider a shorter TTL for negatives than for positives**, which needs either a separate
  cache or a per-entry TTL function — see
  [5 · Redis as the store](05-redis-as-the-store.md).

What does not work is `unless = "#result == null"` as a security measure. It stops the storage,
so every one of those requests now goes to the database instead — you have converted a memory
problem into a load problem, which may be the trade you want but is not a fix.

## `Optional` is unwrapped for you

> *"The cache abstraction supports `java.util.Optional` return types. If an `Optional` value is
> present, it will be stored in the associated cache. If an `Optional` value is not present,
> `null` will be stored in the associated cache. `#result` always refers to the business entity
> and never a supported wrapper."*

```java
@Cacheable(cacheNames = "book", condition = "#name.length() < 32", unless = "#result?.hardback")
public Optional<Book> findBook(String name) { … }
```

> *"Note that `#result` still refers to `Book` and not `Optional<Book>`. Since it might be
> `null`, we use SpEL's safe navigation operator."*

Two things fall out of that. The `Optional` wrapper is not what gets stored, so it does not need
to be serializable on a remote store — the `Book` does. And an empty `Optional` is stored as
`null`, which means it is subject to everything in the two sections above: it is negative
caching whether or not you thought of it that way.

⚠️ **`unless = "#result.hardback"` on an `Optional`-returning method throws on an empty result**,
because `#result` is `null`. The safe-navigation operator in the documented example is not
stylistic.

## The three switches, side by side

| | Evaluated | Sees `#result` | Blocks the read | Blocks the write |
|---|---|---|---|---|
| `condition` | before invocation | no | yes | yes |
| `unless` | after invocation | yes | no | yes |
| `allowNullValues = false` | on write | n/a | no | throws instead |

## Gotchas

**★ A false `condition` skips the read as well as the write.** It is a bypass, not a
write filter, and any existing entry is left untouched and still served to everyone else.

**★ A `forceRefresh` flag wired to `condition` does not refresh anything.** It bypasses the
cache for that one caller and leaves the stale entry in place. Use `@CachePut`, or evict.

**★ `unless` does not stop hits.** Adding `unless = "#result == null"` to a cache that already
contains nulls changes nothing about what those callers receive.

**★ `unless` is only evaluated on a miss**, so any side effect or cost in that expression is
invisible on a warm cache and appears under exactly the conditions you were trying to protect.

**★ `condition` cannot reference `#result`** — the method has not run. An expression that tries
fails at evaluation time, on first invocation.

**★ Nulls are cached by default, in every provider that extends the framework's value-adapting
base and on Redis.** People assume the opposite and are then puzzled that a row created after a
failed lookup is still invisible.

**★ `allowNullValues = false` throws `IllegalArgumentException` from the cache layer** for a
condition produced by the method. The stack trace points at the wrong component.

**★ A cached `null` is not evicted by creating the row.** Nothing connects an insert to the
negative entry unless you wrote that connection — which is
[7 · Invalidation](07-invalidation.md).

**★ Negative caching on an unvalidated identifier is an unbounded key space open to the
internet.** Validate the identifier before the cached call, not inside it.

**★ An empty `Optional` is stored as `null`.** So a method returning `Optional` is doing
negative caching by default, whether or not that was the intent.

**★ `#result` on an `Optional`-returning method is the unwrapped value and may be `null`.**
`unless = "#result.hardback"` throws; the documented form uses `?.`.

**★ The `Optional` wrapper is never stored**, so the serialization requirements fall on the
contained type. That is usually what you want, and it is worth knowing when you are debugging a
serialization failure and the signature says `Optional`.

**★ `condition` and `unless` are both unchecked SpEL strings**, with all the fragility of
[3b](03b-writing-the-key-yourself.md) — and unlike a key, a wrong `unless` fails open, caching
things you meant to exclude.

**★ Two conditions expressing the same intent are not equivalent.**
`condition = "#result != null"` is not a thing you can write, and rewriting it as
`unless = "#result == null"` silently loses the read-side behaviour people assume it has.

## Interview questions

**★ What is the difference between `condition` and `unless`?**
`condition` is evaluated before the method is invoked, so it cannot see the result, and when it
is false the reference says the method "behaves as if the method is not cached" — no read, no
write, no interaction with an existing entry. `unless` is evaluated after the invocation, so it
can use `#result`, but it only vetoes the put. That asymmetry is the practical point: `unless`
cannot stop a value that is already cached from being returned, so it is a write filter, not a
switch.

**★ Does Spring cache a `null` return value?**
Yes, by default. The framework's value-adapting cache substitutes a `NullValue` sentinel on the
way in and reverses it on the way out, which is why `Cache.get` returns a `ValueWrapper` at all —
so that "no entry" and "an entry whose value is null" are distinguishable. It is deliberate:
without it, every lookup of a nonexistent id is a database round trip forever. You can turn it
off per cache, and then storing a null throws an `IllegalArgumentException` naming the cache.

**★ Is negative caching a good idea?**
Usually yes, and it is the default for a reason — "not found" is otherwise the most expensive
answer your system gives, and it is the answer that bad clients and crawlers ask for most. The
condition is that the key space is bounded. If the cached method can be reached with arbitrary
identifiers from outside, negative caching becomes a way for anyone to fill your cache, and the
fix is to validate the identifier before the cached call rather than to stop caching nulls. I
would also want a maximum size or a TTL, and sometimes a shorter one for negatives than for
positives.

**★ You added `unless = "#result == null"` and callers still get nulls. Why?**
Because `unless` only blocks the write. Any null already stored — written before the annotation
changed, or by a path where the expression evaluated false — is still a perfectly good cache
entry and is still returned on a hit. Changing the annotation does not retroactively clean the
store. If the existing entries are the problem, they need evicting, and if they must never be
served again, the honest fix is a new cache name so that the old keyspace is not consulted at
all.

**★ How do you implement a "force refresh" flag?**
Not with `condition`, or at least not with `condition` alone. `condition = "!#forceRefresh"`
does bypass the cache for that call, but it leaves the stale entry in place, so every other
caller keeps getting the old value and the user who asked for a refresh is the only person who
sees the new one. What I actually want is to replace the entry: either `@CachePut` on a separate
refresh method, or an eviction paired with the read. The bypass version is a reasonable answer
only when the goal really is "let this one caller see through the cache".

**★ What happens when a `@Cacheable` method returns `Optional`?**
The abstraction unwraps it: a present value is stored, an empty `Optional` stores `null`, and
`#result` refers to the contained business entity rather than the wrapper. So `unless` and
`@CachePut` key expressions are written against the entity, and — because the entity may be
absent — the documented example uses the safe-navigation operator. Two practical consequences:
the wrapper never needs to be serializable, only the contained type does; and an
`Optional`-returning method is doing negative caching whether or not that was the intention.

**★ When would you set `allowNullValues = false`?**
When `null` from that method means a bug rather than "not found" — an internal lookup that
should always resolve, a configuration read that must be present. Making it throw converts a
silent, sticky wrong answer into an immediate failure. What I would not do is set it because I
dislike nulls in the cache: the exception is raised by the cache for a condition created by the
method, so the stack trace points at the wrong layer and the person who has to read it will
spend a while there.

**★ Is `condition` cheaper than `unless`?**
Yes, in the case that matters. `condition` is evaluated on every invocation but can prevent the
method from running at all when it is true and there is a hit — and when it is false it avoids
the read as well. `unless` is only evaluated after the method has run, on a miss, so it can never
save you the invocation; its cost is invisible on a warm cache and appears exactly when the cache
is cold. That is not usually a reason to choose between them — they answer different questions —
but it does mean an expensive `unless` expression is expensive at the worst moment.

{/* FOOTER */}
