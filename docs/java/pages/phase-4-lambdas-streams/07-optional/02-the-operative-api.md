---
title: "The operative API"
sidebar_label: "2 · The operative API"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against the JDK 25 API documentation for
> `java.util.Optional` — the Javadoc of `orElse`, `orElseGet`,
> `orElseThrow`, `map`, `flatMap`, `filter`, `ifPresent`,
> `ifPresentOrElse`, `or` and `stream` — and the `Stream.flatMap` Javadoc.

**Two habits separate fluent `Optional` code from `Optional`-flavored null
checks: knowing that `orElse`'s argument is *always evaluated* (it is an
ordinary method argument — Java evaluates it before the call, present or
not), and reaching for `map`/`flatMap`/`filter` chains instead of
`isPresent()` + `get()`. The first habit prevents a real performance-and-
correctness bug; the second is the difference between using the type and
merely carrying it around.**

## Unwrapping: the `orElse` family

```java
config.timeout().orElse(DEFAULT_TIMEOUT);            // constant default → orElse
config.timeout().orElseGet(this::computeDefault);    // computed default → orElseGet
config.timeout().orElseThrow(                        // no default is acceptable
    () -> new MissingConfigException("timeout"));
repo.findById(id).orElseThrow();                     // NoSuchElementException — get()'s honest twin
```

**`orElse(expr)` evaluates `expr` unconditionally.** This is not a quirk of
`Optional` — it is Java's ordinary call-by-value semantics. The consequence
bites when the default is expensive or side-effecting:

```java
// BUG (performance, often correctness): the fallback query runs on EVERY call,
// even when the cache hit — its result is just thrown away.
User u = cache.lookup(id).orElse(userRepo.loadAndCache(id));

// Right: the Supplier runs only when the Optional is empty.
User u = cache.lookup(id).orElseGet(() -> userRepo.loadAndCache(id));
```

With `orElse`, `loadAndCache` executes on the hit path too — an extra
database round-trip per call, and if the "default" expression has side
effects (writes a cache entry, increments a counter, allocates heavily),
those happen on every call as well. The rule of thumb: **literal or
already-computed value → `orElse`; anything with a method call in it →
`orElseGet`.** The cost of the supplier lambda is negligible; the cost of
an accidental eager query is not.

`orElse(null)` deserves a special mention: it is sometimes the right seam
into null-expecting legacy code, but inside your own logic it silently
converts the typed absence back into the untyped one the return type was
protecting you from.

## Transforming: `map`, `flatMap`, `filter`

The anti-pattern the API was designed to retire:

```java
// Optional as a fancy null check — verbose AND re-creates get() risk
Optional<User> user = repo.findByEmail(email);
if (user.isPresent()) {
    String domain = user.get().getEmail().substring(...);
    if (domain.equals("example.com")) {
        return domain.toUpperCase();
    }
}
return "unknown";
```

The same logic as a chain:

```java
return repo.findByEmail(email)
        .map(User::getEmail)
        .map(e -> e.substring(e.indexOf('@') + 1))
        .filter(d -> d.equals("example.com"))
        .map(String::toUpperCase)
        .orElse("unknown");
```

The mechanics mirror streams, on a container of zero-or-one:

- **`map(fn)`** — applies `fn` to the value if present. If `fn` returns
  null, the result is `empty()` (the Javadoc specifies `ofNullable`
  semantics) — so a null-returning legacy call *inside* a chain degrades
  gracefully into absence instead of NPE-ing.
- **`flatMap(fn)`** — for when `fn` itself returns an `Optional`. Without
  it you get `Optional<Optional<Address>>`:

  ```java
  Optional<ZipCode> zip = repo.findByEmail(email)   // Optional<User>
          .flatMap(User::address)                   // address() returns Optional<Address>
          .flatMap(Address::zip);                   // zip() returns Optional<ZipCode>
  ```

- **`filter(pred)`** — present-and-matching stays; otherwise `empty()`.
  Reads as "keep this result only if…".

A chain states the happy path once, and absence falls through every step to
the single unwrap at the end. That locality — *one* place decides what
empty means — is the maintainability win over scattered `if`s.

## Acting: `ifPresent` and `ifPresentOrElse`

When the goal is a side effect, not a value:

```java
repo.findByEmail(email).ifPresent(auditLog::recordSeen);

repo.findByEmail(email).ifPresentOrElse(
        auditLog::recordSeen,
        () -> auditLog.recordMiss(email));
```

`ifPresentOrElse` (JDK 9+) closes the gap that used to force
`isPresent()`/`else` blocks. If you find yourself wanting a *value* out of
an `ifPresent`, that's the signal you wanted `map`/`orElseGet` instead.

## Falling back to another `Optional`: `or`

`orElse`/`orElseGet` end the chain with a plain `T`. `or` (JDK 9+) keeps it
an `Optional`, which is what a lookup cascade wants:

```java
Optional<Config> cfg = fromCli(args)
        .or(() -> fromEnv())
        .or(() -> fromFile(path));   // first present Optional wins, lazily
```

Each supplier runs only if everything before it was empty — a lazy chain of
alternatives without a single `isPresent`.

## Into streams: `stream()`

`Optional.stream()` (JDK 9+) turns present into a one-element stream and
empty into an empty one. Its main job is flattening a stream of `Optional`s
without an explicit filter-then-get pair:

```java
List<User> users = emails.stream()
        .map(repo::findByEmail)          // Stream<Optional<User>>
        .flatMap(Optional::stream)       // Stream<User> — empties vanish
        .toList();
```

Before JDK 9 this required `.filter(Optional::isPresent).map(Optional::get)`
— which still works but names the machinery instead of the intent.

## Equality

`equals` compares contained values: `Optional.of("a").equals(Optional.of("a"))`
is true, and `empty().equals(empty())` is true. That makes `Optional`
results directly assertable in tests —
`assertEquals(Optional.of(expected), service.find(id))` — with no
unwrapping. (`==`, as [chunk 1](01-the-contract.md) established, is never
correct on a value-based class.)

## Gotchas

**Symptom:** a fallback query/computation runs even when the value was present — visible as doubled DB load or a side effect firing on every call
**Cause:** `orElse(expensiveCall())` — method arguments are evaluated before the call, unconditionally
**Fix:** `orElseGet(() -> expensiveCall())`; keep `orElse` for constants

**Symptom:** chain compiles to `Optional<Optional<T>>` and won't type-check against the expected `Optional<T>`
**Cause:** `map` with a mapper that itself returns `Optional`
**Fix:** `flatMap` for `Optional`-returning mappers — same rule as `Stream.flatMap`

**Symptom:** `NoSuchElementException` in production from a bare `orElseThrow()`/`get()`
**Cause:** "empty can't happen here" stopped being true — the assertion had no message explaining why
**Fix:** `orElseThrow(() -> new DomainException(...))` with context, or an upstream redesign so the impossible case is structurally impossible

**Symptom:** NPE *inside* a chain that was supposed to be null-safe
**Cause:** a lambda in `map`/`filter` dereferences something nullable of its own (`u -> u.getProfile().getBio()`) — the chain only guards the *chained* value
**Fix:** break the navigation into steps: `.map(User::getProfile).map(Profile::getBio)` — each hop's null becomes empty

**Symptom:** `filter` chain silently drops values and the "why is it empty" hunt takes an afternoon
**Cause:** several predicates and mappings fused into one chain with no observability
**Fix:** split the chain and extract predicates into named methods; in a pinch, log in a `map(x -> { log(x); return x; })` step during debugging — then remove it

**Symptom:** `ifPresent(x -> result = x)` — assigning a captured variable out of the lambda fails to compile or mutates state awkwardly
**Cause:** using the side-effect method to extract a value; locals must be effectively final
**Fix:** that's `map`/`orElse` territory: `var result = opt.map(...).orElse(default)`

**Symptom:** lookup-cascade code full of nested `isPresent` ladders
**Cause:** pre-JDK-9 habits — `or` didn't exist
**Fix:** `a.or(() -> b()).or(() -> c())` — lazy, flat, reads in priority order

**Symptom:** `.filter(Optional::isPresent).map(Optional::get)` flagged in review
**Cause:** flattening a `Stream<Optional<T>>` the long way
**Fix:** `.flatMap(Optional::stream)`

## Interview questions

**★ Why is `orElse(computeDefault())` a bug pattern while `orElseGet(this::computeDefault)` is fine?**
Java evaluates method arguments eagerly, so `computeDefault()` runs whether
or not the `Optional` is empty — wasted work always, wrong behaviour if it
has side effects. `orElseGet` takes a `Supplier` invoked only on empty.
The distinction is invisible in tests where the value is absent, which is
why it ships.

**★ `map` vs `flatMap` on `Optional` — state the rule and the failure mode of picking wrong.**
Mapper returns a plain value → `map`; mapper returns an `Optional` →
`flatMap`. Wrong pick doesn't crash — it produces `Optional<Optional<T>>`,
which fails at the *next* step's types, or worse gets unwrapped twice by
someone "fixing" the compile error.

**★ What happens when the function passed to `Optional.map` returns null?**
The result is `Optional.empty()` — `map` is specified to wrap "as if by
`ofNullable`". This makes chains tolerant of null-returning legacy calls
mid-stream, and it also means a null return quietly becomes indistinguishable
from genuine absence — if that distinction matters, don't fold it into one
chain.

**★ Refactor `if (opt.isPresent()) { return f(opt.get()); } else { return d; }` and explain why the chain is better, not just shorter.**
`opt.map(this::f).orElse(d)` (or `orElseGet` if `d` is computed). Beyond
brevity: `get()` disappears, so there is no unwrap that can be copy-pasted
into a context without its guard; and the empty-case policy lives in exactly
one place at the end of the chain.

**★ How do you express "try source A, then B, then C, first hit wins" with `Optional`s?**
`a().or(() -> b()).or(() -> c())` — each supplier is lazy, the first
present result short-circuits the rest. Ending with `orElseThrow` or
`orElseGet` sets the policy for all-empty.

**★ How do you go from `Stream<Optional<T>>` to `Stream<T>`, and what did this look like before JDK 9?**
`.flatMap(Optional::stream)` — empty `Optional`s contribute zero elements.
Pre-9: `.filter(Optional::isPresent).map(Optional::get)`, which is the same
result with the machinery exposed.

**★ When is `isPresent()` still the right call?**
When presence itself is the *answer* — a boolean check with no value use
(`return repo.findByEmail(e).isPresent();`), or at a boundary where a
framework/legacy API needs an explicit branch. As a prelude to `get()`, it
is almost always a chain waiting to be written.

---

← Prev: [The contract](01-the-contract.md) · Next → [The boundaries](03-the-boundaries.md)
