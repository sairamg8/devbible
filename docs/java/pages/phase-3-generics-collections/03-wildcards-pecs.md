---
title: "Wildcards and PECS"
sidebar_label: "03 · Wildcards and PECS"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the JLS SE 25 §4.5.1 (type arguments and
> wildcards), §5.1.10 (capture conversion), and the JDK 25 API
> documentation for `java.util.Collections#copy`, `java.util.function`
> and `java.util.stream.Stream`.

**Invariance ([topic 01](01-generics-raw-types/03-generic-methods-and-invariance.md))
keeps generic writes safe but makes signatures rigid: a method taking
`List<Number>` rejects a `List<Integer>`. Wildcards are the pressure valve —
`? extends Number` means "some fixed subtype of Number, I'll only read",
`? super Integer` means "some fixed supertype of Integer, I'll only write".
The mnemonic that organizes all of it is PECS: Producer Extends, Consumer
Super — name what the collection does *for your code*, and the wildcard
follows.**

## The two bounds, from a real signature

```java
public static <T> void copy(List<? super T> dest, List<? extends T> src)
```

`Collections.copy` reads from `src` and writes into `dest`:

- **`src` produces** elements for the method → `? extends T`. Any
  `List<Integer>` or `List<Double>` serves as a source of `Number`s.
- **`dest` consumes** elements → `? super T`. Copying `Integer`s can
  target a `List<Integer>`, `List<Number>` or `List<Object>` — anything
  that can *hold* an `Integer`.

The signature accepts every combination that is actually safe, and no
combination that isn't. That is the entire art of wildcards: **maximum
caller flexibility, zero new unsafety.**

### What each form permits

| | read `get(i)` yields | write `add(x)` accepts |
|---|---|---|
| `List<? extends Number>` | `Number` | nothing (only `null`) |
| `List<? super Integer>` | `Object` | `Integer` (and subtypes) |
| `List<?>` | `Object` | nothing (only `null`) |

The asymmetry is the safety argument, run in both directions:

- `List<? extends Number>` might *be* a `List<Integer>` — so adding a
  `Double` must be refused; the compiler can't prove any non-null write
  safe.
- `List<? super Integer>` might *be* a `List<Object>` — so reads can
  promise only `Object`; but every list it could be holds `Integer`, so
  writing one is always safe.
- `List<?>` — "some type, unknown" — is the read-only stranger: safe to
  size, iterate as `Object`, `clear`; never to add to. It differs from raw
  `List` precisely in that the compiler enforces this
  ([topic 01 chunk 2](01-generics-raw-types/02-raw-types-the-bug-factory.md)).

Note "some *fixed* type": `List<?>` is not "a list that holds anything" —
it is "a list of one specific type I don't know". That reading explains
every rule above.

## PECS, applied

*Producer extends, consumer super* — from the perspective of the code
holding the reference:

```java
double sum(Collection<? extends Number> nums)      // produces for me → extends
void fill(Collection<? super Order> sink, int n)   // consumes for me → super
```

The JDK is written in it — internalize these and library signatures
become legible:

```java
Stream<T>:  map(Function<? super T, ? extends R>)  // takes a T (consumes),
                                                   // returns an R (produces)
forEach(Consumer<? super T>)                       // consumes T
Comparator.comparing(Function<? super T, ? extends U>)
Collections.sort(List<T>, Comparator<? super T>)   // a Comparator<Object>
                                                   // can sort anything
```

`Comparator<? super T>` is PECS earning its keep: a single
`Comparator<Person>` sorts `List<Employee>` — without the `super`, every
subclass would need its own comparator
(**topic 10 · Comparable vs Comparator** *(not written yet)* builds on
this).

When **neither** applies — the method both reads and writes T-typed
elements meaningfully — use the exact type `List<T>`, and that's correct,
not a failure of imagination.

### Where wildcards don't belong

- **Return types**: returning `List<? extends Number>` forces every caller
  into wildcard gymnastics forever. Produce exact types; take wildcards.
- **Fields and locals**: a field of wildcard type mostly proves the class
  doesn't know its own data. Wildcards are for *method parameters*.
- **When you need the type twice**: if two parameters must share the
  element type, or a result reuses it, a named parameter `<T>` is the
  tool; a wildcard appears once and can never be referred to again.

## Capture — the error message decoded

`? extends Number` at a call site is *captured* (JLS §5.1.10) as a fresh,
unnameable variable — the `capture of ?` / `CAP#1` in compiler errors:

```java
void swapFirstTwo(List<?> list) {
    list.set(0, list.get(1));          // error: Object → CAP#1 refused
}
```

The compiler forgot the element type between the read and the write. The
classic fix routes through a named parameter, which *holds* the type:

```java
void swapFirstTwo(List<?> list) { swapHelper(list); }
private <T> void swapHelper(List<T> list) {
    T tmp = list.get(0);
    list.set(0, list.get(1));
    list.set(1, tmp);                  // compiles — T names the type
}
```

Public face stays maximally accepting; private helper does the typed work.

## Gotchas

**Symptom:** `add` refuses everything on a `List<? extends Order>` — "have you tried adding an Order?" doesn't compile either
**Cause:** the list might be a `List<PaidOrder>`; no non-null element is provably safe
**Fix:** if the method must write, the parameter is wrong — `? super Order`, or exact `List<Order>`; `extends` promises read-only

**Symptom:** `incompatible types: Object cannot be converted to CAP#1`
**Cause:** wildcard capture — read from a wildcard collection, write back refused because the compiler holds the type as an unnameable fresh variable
**Fix:** the capture-helper idiom: delegate to a private `<T>` method that names the type; or redeclare the public method generic outright

**Symptom:** API returns `List<? extends Customer>` and every caller writes casts or wildcard-typed locals
**Cause:** wildcard in a return type exports the flexibility problem to all callers, forever
**Fix:** return `List<Customer>` (covariant *reads* are what callers do anyway); wildcards belong in what you accept, not what you produce

**Symptom:** two wildcard parameters "obviously the same type" won't interact — `merge(List<? extends T> a, List<? extends T> b)` can't move elements between them
**Cause:** each `?` captures independently; `CAP#1` and `CAP#2` are unrelated types even if both lists are `List<Integer>`
**Fix:** name the parameter once: `<E> void merge(List<E> a, List<E> b)` — a shared name is the statement that they match

**Symptom:** `List<? super Integer>` reads give `Object` and someone "fixes" it by casting to `Integer`
**Cause:** the list may legitimately be a `List<Number>` holding a `Double` put there by other code — the cast is a landmine
**Fix:** consumer-side collections are for writing; if the method also needs typed reads, its contract wants an exact type parameter

**Symptom:** `Function<? super T, ? extends R>` in an error message reads as noise, so a simpler `Function<T, R>` overload gets written and rejects existing lambdas/method refs on super/subtypes
**Cause:** dropping the wildcards narrows what callers may pass — `String::valueOf` (a `Function<Object, String>`) no longer serves where `Function<T, String>` is demanded
**Fix:** keep PECS in functional-interface parameters exactly as the JDK does; the noise is the flexibility

## Interview questions

**★ Explain PECS and apply it: a method that drains a queue of events into an audit sink.**
Producer extends, consumer super — from the method's viewpoint. The queue
produces events for the method: `Queue<? extends Event>`. The sink
consumes them: `Collection<? super Event>`. Callers may then drain a
`Queue<PaymentEvent>` into a `Collection<Object>` — every safe
combination, no unsafe one.

**★ Why can't you add an `Order` to a `List<? extends Order>`?**
Because the wildcard means *some fixed subtype*: the list might be a
`List<PaidOrder>`, and inserting a plain `Order` would pollute it. The
compiler can't prove any non-null write safe against every possible
instantiation, so it refuses them all. Reading is fine — whatever the
subtype, elements are `Order`s.

**★ `List<?>` vs raw `List` — same thing?**
Opposites in safety: `List<?>` is fully checked — reads typed as
`Object`, writes refused; raw `List` is unchecked in both directions.
`List<?>` says "unknown type, compiler enforce it"; raw says "stop
checking". One is the fix for the other.

**★ What is wildcard capture, and what is the standard workaround when it blocks you?**
At each use, the compiler converts `?` into a fresh anonymous type
variable (`CAP#1`) — sound, but unnameable, so you can't declare a local
of it or prove two captures equal. Workaround: the capture helper — a
private generic method that gives the captured type a name (`<T>`), called
from the wildcard-typed public method. `Collections.swap` is implemented
with exactly this shape.

**★ Why is `Comparator<? super T>` the standard bound in sorting APIs?**
So one comparator serves a hierarchy: `Comparator<Person>` compares
`Employee`s too, and `Collections.sort(List<Employee>, byLastName)`
should accept it. With plain `Comparator<T>`, every subtype would need
its comparators re-declared. Consumer position (`compare` *takes* Ts) →
`super`, by PECS.

**When is an exact type parameter better than any wildcard?**
When the type is used more than once (two parameters that must agree, a
parameter that flows to the return), or the method genuinely reads *and*
writes. Wildcards model one-sided, one-shot use; `<T>` models identity
across positions.

---

← Prev: [Type erasure](02-type-erasure.md) · Next → **The collection hierarchy** *(not written yet)*
