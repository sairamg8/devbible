---
title: "Method references"
sidebar_label: "02 · Method references"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the JLS SE 25 §15.13 (method reference
> expressions), the JDK 25 API documentation for `java.util.function`, and
> the Java Language Updates guide (docs.oracle.com/en/java/javase/25/).

**A method reference is a lambda you write by *pointing at a method that
already exists* instead of restating its call. `user -> user.getEmail()`
and `User::getEmail` compile to the same kind of functional-interface
instance — but the reference form comes in four distinct kinds, and the
differences between them (especially *when the receiver is evaluated* and
*where the first parameter goes*) are exactly what the compact syntax
hides. Read the four kinds once, properly, and every `::` in a stream
pipeline becomes legible.**

## The four kinds

| # | Kind | Form | Equivalent lambda |
|---|---|---|---|
| 1 | Static | `Integer::parseInt` | `s -> Integer.parseInt(s)` |
| 2 | Bound instance — a *particular* object's method | `System.out::println` | `x -> System.out.println(x)` |
| 3 | Unbound instance — a method of the *first parameter* | `String::toLowerCase` | `s -> s.toLowerCase()` |
| 4 | Constructor | `ArrayList::new`, `String[]::new` | `() -> new ArrayList<>()`, `n -> new String[n]` |

Kinds 2 and 3 look identical on the page — `receiver::method` vs
`Type::method` — and behave completely differently. That contrast is most
of this topic.

## Kind 3 and the arity shift

In an *unbound* instance reference, the functional interface's **first
parameter becomes the receiver**; remaining parameters become the
arguments. So a zero-argument instance method satisfies a *one*-argument
interface:

```java
Function<String, String> lower = String::toLowerCase;   // s.toLowerCase()
Predicate<String> blank        = String::isBlank;        // s.isBlank()

// two interface params, one becomes the receiver:
BiPredicate<String, String> starts = String::startsWith; // (s, p) -> s.startsWith(p)
Comparator<String> byLen = Comparator.comparingInt(String::length);
```

This is why `String::compareTo` — an instance method taking *one*
argument — implements `Comparator<String>`, a *two*-argument interface:
`(a, b) -> a.compareTo(b)`. When a reference "has the wrong number of
arguments", check whether the first parameter is being consumed as the
receiver before concluding it doesn't fit.

`User::getEmail` in a pipeline is this kind:

```java
List<String> emails = users.stream()
        .map(User::getEmail)      // u -> u.getEmail()
        .toList();
```

## Kind 2 and receiver capture — the timing bug

A *bound* reference evaluates its receiver expression **once, when the
reference is created** (JLS §15.13.3), not each time the function runs:

```java
Supplier<Config> current = this.config::snapshot;
// `this.config` was read NOW. If the config field is later reassigned,
// `current` still snapshots the OLD object.
```

The equivalent lambda `() -> this.config.snapshot()` reads the field on
*every call*. The two are **not** interchangeable whenever the receiver
expression can change or throw:

```java
User user = null;
Supplier<String> s1 = user::getEmail;      // NullPointerException HERE, at creation
Supplier<String> s2 = () -> user.getEmail(); // NPE later, when s2.get() runs
```

Both behaviours are sometimes what you want — a bound reference pins "the
logger I had at construction time"; a lambda tracks "whatever the field
holds when called". Choose deliberately, because a refactor from one form
to the other silently changes the program.

## Constructor references

```java
Supplier<List<String>> fresh = ArrayList::new;            // () -> new ArrayList<>()
Function<Integer, List<String>> sized = ArrayList::new;   // n -> new ArrayList<>(n)
IntFunction<String[]> arr = String[]::new;                // n -> new String[n]
```

Two things worth noticing:

- **The same `ArrayList::new` token means different constructors** depending
  on the target interface — the compiler picks the constructor whose
  signature matches the single abstract method. The reference itself is
  ambiguous until target-typed.
- **Array constructor references** exist because `T[]::new` is the only way
  to hand an array factory around generically — it is the standard answer
  to `toArray`'s array-creating overload:
  `users.stream().toArray(User[]::new)`.

## How the compiler resolves a reference

The reference has no type of its own — like a lambda, it is target-typed
([chunk 1 of topic 01](01-lambdas-functional-interfaces/01-syntax-capture-and-this.md)).
Resolution runs against the target interface's single abstract method:

1. Find the target functional interface (assignment, argument, return,
   cast).
2. Gather the named method's applicable overloads — for `Type::method`,
   *both* static methods and instance methods (with the arity shift) are
   candidates.
3. Pick the most specific applicable one, exactly like ordinary overload
   resolution against the interface's parameter types.

Step 2 is where the famous ambiguity lives: a class with a static
`valueOf(String)` *and* an instance method that also fits produces
"reference to method is ambiguous". The documented example shape:

```java
// Integer has static Integer.toString(int) and instance int.toString()
// Function<Integer, String> f = Integer::toString;   // ✗ ambiguous
Function<Integer, String> f = i -> Integer.toString(i); // ✓ lambda disambiguates
```

A lambda states its argument positions explicitly, so it never has this
problem — which is also the escape hatch.

## When the lambda reads better

References win when the method name *is* the operation:
`map(User::getEmail)` says everything. Prefer a lambda when:

- **Arguments need rearranging, dropping, or adding** — `(a, b) -> f(b, a)`
  has no reference form.
- **There is any logic at all** — a ternary, a null guard, string
  concatenation: `u -> u.getEmail() == null ? "" : u.getEmail()`.
- **A checked exception needs handling** — you cannot wrap a `try` around
  a `::`; the lambda gets a body, the reference cannot
  (**composition and checked exceptions** *(not written yet)* covers the
  patterns).
- **The receiver should be re-read per call** — the timing section above;
  a bound reference freezes it.
- **The reference would be ambiguous** — the overload case; spelling out
  the lambda picks the overload by argument shape.
- **Chained calls** — `u -> u.getAddress().getCity()` is one lambda, but
  would need `Function` composition to write with references; the lambda
  is plainly clearer.

The honest rule: a method reference is a *readability* feature. The moment
it takes more than a second to see which kind it is and where the
arguments go, write the lambda.

## Gotchas

**Symptom:** `NullPointerException` thrown on the line that *creates* a bound method reference, before anything calls it
**Cause:** JLS §15.13.3 — the receiver expression of a bound reference is evaluated at creation; a null receiver fails immediately
**Fix:** expected — but if you wanted lazy evaluation (receiver may be set later), use a lambda, which re-reads the receiver per call

**Symptom:** behaviour didn't change after reassigning a field, though the callback "uses" it
**Cause:** the callback is `field::method` — the old object was captured when the reference was built
**Fix:** `() -> field.method()` to read the field at call time; keep the bound form only when pinning the current object is intended

**Symptom:** "incompatible types: invalid method reference — reference to method is ambiguous"
**Cause:** `Type::name` matched both a static overload and an instance method (arity shift) against the target's signature
**Fix:** write the lambda — explicit argument positions resolve the overload; or qualify differently if one form was never intended

**Symptom:** `String::toLowerCase` "takes no arguments" but the compiler wants a `Function<String, String>` and accepts it — confusion in review
**Cause:** unbound instance reference: the interface's first parameter is the receiver, not an argument
**Fix:** none needed — read `Type::instanceMethod` as "first param becomes `this`"; the mental expansion `s -> s.toLowerCase()`

**Symptom:** `list.forEach(System.out::println)` works, but extracting `PrintStream out = System.out` and reassigning `System.out` later still prints to the old stream
**Cause:** bound reference captured the `PrintStream` object that `System.out` held at creation
**Fix:** expected capture semantics; use a lambda `x -> System.out.println(x)` if the current stream must be looked up per call

**Symptom:** `toArray(User[]::new)` compiles but `toArray(new User[0]::new)` — or attempts to parameterize — don't
**Cause:** array constructor references take the array *type*, and the sole parameter is the length (`IntFunction<T[]>`)
**Fix:** always `Type[]::new`; for a generic `T`, pass the factory in from a caller who knows the concrete type

**Symptom:** replacing a lambda with the "equivalent" reference changed exception timing in tests
**Cause:** the receiver expression could throw (method call, array index) — creation-time vs call-time evaluation differ observably
**Fix:** treat lambda ⇄ bound-reference refactors as behaviour changes whenever the receiver is more than a local variable

## Interview questions

**★ Name the four kinds of method reference and give the lambda each abbreviates.**
Static (`Integer::parseInt` ≡ `s -> Integer.parseInt(s)`); bound instance
(`obj::method` ≡ `args -> obj.method(args)`, receiver fixed at creation);
unbound instance (`Type::method` ≡ `(recv, args) -> recv.method(args)`);
constructor (`Type::new`, `Type[]::new`) whose target interface picks the
constructor.

**★ Why does `String::compareTo` implement `Comparator<String>` when `compareTo` takes one argument?**
Unbound instance reference: the interface's first parameter becomes the
receiver. `compare(a, b)` maps to `a.compareTo(b)` — one parameter turns
into `this`, the other stays an argument.

**★ `config::snapshot` vs `() -> config.snapshot()` — when do they differ?**
Whenever `config` can change or be null. The bound reference evaluates
`config` once, at creation (NPE there if null; later reassignment
invisible). The lambda re-reads `config` on every invocation. Same
signature, different programs.

**★ Why can the same `ArrayList::new` mean two different constructors?**
Constructor references are target-typed: against `Supplier<List<T>>` it
resolves to the no-arg constructor, against
`Function<Integer, List<T>>` to `ArrayList(int)`. The token names the
class; the functional interface's method signature picks the overload.

**When does a method reference fail to compile where the equivalent lambda succeeds?**
Overload ambiguity — `Type::name` matching both a static method and an
arity-shifted instance method. The lambda fixes it because argument
positions are explicit. (Also: any case needing argument reordering or a
body — there is simply no reference syntax for those.)

**What is `String[]::new` for, concretely?**
An `IntFunction<String[]>` — the array-factory shape `Stream.toArray`
wants: `stream.toArray(String[]::new)` builds a correctly-typed array,
which plain generics cannot do because of erasure
([phase 3's type erasure](../phase-3-generics-collections/02-type-erasure.md)).

**Your reviewer says "make every lambda a method reference". Argue the exceptions.**
References only cover call-through shapes. Keep lambdas for argument
rearrangement, added logic or guards, checked-exception wrapping, per-call
receiver lookup, ambiguous overloads, and chained calls — in each, the
reference is either impossible or *less* readable, and readability is the
only reason references exist.

---

← Prev: [Lambdas and functional interfaces](01-lambdas-functional-interfaces/README.md) · Next → [The stream pipeline](03-stream-pipeline/README.md)
