---
title: "Methods: overloading, varargs, pass-by-value"
sidebar_label: "10 · Methods"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the JLS SE 25 §15.12.2 (choosing the most
> specific method — the three phases of overload resolution), §8.4.1 (formal
> parameters, varargs), and §8.4.9 (overloading); JDK 25 API documentation
> for `java.util.Objects` and `List.of`.

**Three method facts generate a disproportionate share of real Java
confusion: overloads are chosen at *compile time* from the *static* types
(dynamic dispatch chooses overrides, never overloads); varargs is compiler
sugar over an array, with everything that implies; and Java is strictly
pass-by-value — the value being, for objects, a copy of the reference.
"Java is pass-by-reference for objects" is the single most-corrected wrong
sentence in Java interviews.**

## Overloading: resolved at compile time, from static types

Overloads are same name, different parameter lists, in the same class (or
inherited into it). The compiler picks one signature per call site using the
declared types of the arguments — the runtime never re-decides:

```java
void log(Object o)  { ... }
void log(String s)  { ... }

Object x = "hello";
log(x);              // log(Object) — x's STATIC type decides, not what it holds
log("hello");        // log(String) — most specific applicable overload
```

Contrast with overriding: which *override* runs is decided at runtime from
the actual object ([Phase 2's dispatch topic](../phase-2-classes-objects/04-polymorphism-dispatch/README.md));
which *overload* is targeted was fixed when the class compiled. A method
that is both overloaded and overridden resolves in two steps: compile time
picks the signature, runtime picks the implementation of that signature.

### Which one runs when you pass `null`?

```java
void handle(Object o) { ... }
void handle(String s) { ... }

handle(null);        // handle(String) — the MOST SPECIFIC applicable type
```

`null` is applicable to every reference type, so the compiler chooses the
most specific — `String`, since `String` is an `Object` but not vice versa.
Add a third overload `handle(Integer i)` and the call becomes a **compile
error** ("reference to handle is ambiguous"): `String` and `Integer` are
unrelated, so neither is more specific. The fix at the call site is an
explicit cast — `handle((String) null)` — and the better fix is not
designing overloads that force callers to write that.

### The three-phase resolution order

JLS §15.12.2 tries applicable methods in three widening rounds, stopping at
the first round that finds any match:

1. **Strict** — subtyping and widening primitive conversion only
   (`int` → `long`), no boxing, no varargs.
2. **Loose** — adds boxing/unboxing (`int` → `Integer`).
3. **Varargs** — finally considers `T...` arity.

So `f(int)` beats `f(long)` beats `f(Integer)` beats `f(Object)` beats
`f(int...)` for the call `f(42)`. Practical reading: **widening beats
boxing beats varargs**, and an exact primitive match beats everything. This
order is also why adding one innocent overload to an API can silently
re-route existing call sites — an overload set is a public contract.

## Varargs: an array in a costume

```java
static String join(String sep, String... parts) { ... }   // last param only

join("-", "a", "b", "c");        // compiler builds new String[]{"a","b","c"}
join("-");                       // new String[0] — empty, not null
join("-", myArray);              // passed AS the array — no wrapping
```

- One varargs parameter, **last position only**. Inside the method it *is*
  `String[] parts` — length, indexing, the works.
- Callers may still pass a real array explicitly; zero args produce an
  empty array. But passing literally `null` binds the array itself to
  `null` — an NPE trap on the first `parts.length`.
- **`int...` vs `Integer...`**: primitive varargs build a primitive array —
  no boxing. This is why `List.of(1, 2, 3)` boxes (its signature is
  `List.of(E...)`) but `IntStream.of(1, 2, 3)` doesn't (`of(int...)`).
- Generic varargs (`List<String>... lists`) trigger the "possible heap
  pollution" warning — varargs makes an *array* of an erased generic type,
  the exact unsafe combination the [arrays topic](09-arrays.md) explains.
  `@SafeVarargs` on a `static`/`final`/`private` method is the author's
  promise the array never leaks.

Cost note: every varargs call that isn't handed an existing array allocates
one. That is why performance-conscious APIs (`List.of`, `Map.of`,
`EnumSet.of`) declare fixed-arity overloads for 0–10 arguments and fall to
varargs only past that — a pattern worth recognizing, not one to copy
prematurely.

## Pass-by-value — always, with no exception

Java copies the argument into the parameter. For primitives that copies the
number; for objects it copies the **reference**. The method can therefore
*mutate the object the caller sees* but can never *rebind the caller's
variable*:

```java
static void mutate(List<String> list)   { list.add("added"); }     // caller SEES this
static void rebind(List<String> list)   { list = new ArrayList<>(); } // caller does NOT
static void increment(int n)            { n++; }                     // caller does NOT

var names = new ArrayList<String>();
mutate(names);       // names now contains "added" — shared object, mutated
rebind(names);       // names unchanged — the parameter was rebound, not the variable
```

If Java were pass-by-reference, `rebind` would leave the caller holding the
new list, and a C#-style `swap(ref a, ref b)` would be writable — it isn't.
The precise sentence: **references are passed by value.** Consequences that
follow:

- "Out parameters" don't exist. Return a value — or, for two values, a
  record ([Phase 2](../phase-2-classes-objects/08-records/README.md)); a
  one-element array as an out-param is a legacy smell.
- Reassigning parameters inside a method is legal but confusing — treat
  parameters as `final` ([topic 12](12-final.md)).
- A mutable argument is a *shared* object: mutation inside the method is
  visible to every other holder, which is either the point (`mutate`) or a
  bug (Phase 2's defensive-copy discipline decides which).

## Signatures, return types, and what can't overload

The signature is the name + parameter types. **Return type is not part of
it** — two methods differing only in return type don't compile. Neither do
two whose parameter types erase to the same thing (`f(List<String>)` vs
`f(List<Integer>)` — Phase 3's erasure). Overloading on `boolean`-vs-`Boolean`
or on argument *order* of same-typed parameters compiles but reads as a trap.

## Gotchas

**Symptom:** the "wrong" overload runs — `log(Object)` although the variable holds a `String`
**Cause:** overload choice is compile-time, from the static type of the expression, not the runtime object
**Fix:** cast at the call site to select (`log((String) x)`), or collapse the overloads into one method that checks `instanceof` ([topic 14](14-casting-instanceof/README.md))

**Symptom:** "reference to method is ambiguous" appears after *adding* an overload — old code, new error
**Cause:** the new overload ties with an existing one for "most specific" on some call shapes (classically two unrelated reference types and a `null`/lambda argument)
**Fix:** rename instead of overloading (`ofSeconds`/`ofMillis` beats `of(int)`/`of(long)`); overload sets are API surface

**Symptom:** `NullPointerException` on `args.length` at the top of a varargs method
**Cause:** a caller wrote `f(null)` — that binds the whole array to `null`, not a one-element array containing null
**Fix:** callers: `f((String) null)` if a null element is meant; authors: `Objects.requireNonNull` the array with a message naming the parameter

**Symptom:** method "modifies its argument" per a bug report, but reassignment inside it does nothing
**Cause:** confusion between mutating the shared object (visible) and rebinding the parameter copy (invisible)
**Fix:** return the new value instead of rebinding; make parameters effectively final so the compiler flags rebinding

**Symptom:** an `Integer` argument silently selects a different overload than an `int` did
**Cause:** resolution phases — widening (`int`→`long`) wins over boxing (`int`→`Integer`), so changing a variable's type re-routes the call
**Fix:** be suspicious of overload sets mixing primitives, wrappers and `Object`; the JDK's own `List.remove(int)` vs `remove(Object)` is the cautionary tale (boxing the index changes which method runs)

**Symptom:** "possible heap pollution" warning on a varargs method
**Cause:** varargs of a generic type creates an array of an erased type — the unsafe arrays+generics mix
**Fix:** `@SafeVarargs` if the method never stores into or leaks the array; otherwise take a `Collection<T>` instead

**Symptom:** performance regression traced to a hot method taking `T...`
**Cause:** every call allocates a fresh array (and boxes, if the values are primitives)
**Fix:** fixed-arity overloads for the hot arities, or take the array/collection explicitly — measure first (Phase 12)

## Interview questions

**★ Is Java pass-by-value or pass-by-reference?**
Pass-by-value, always. For objects the copied value is the reference — so a
method can mutate the object it shares with the caller but cannot rebind the
caller's variable. The test: a `swap(a, b)` method is unwritable in Java,
and reassigning a parameter is invisible to the caller.

**★ With `f(Object)` and `f(String)` overloads, what does `f(null)` call — and when does that become a compile error?**
`f(String)`: null is applicable to all reference types, and the compiler
picks the most specific. It breaks the moment a sibling overload on an
unrelated type (`f(Integer)`) exists — no unique most-specific candidate,
so the call is ambiguous and needs a cast to compile.

**★ How do overloading and overriding interact with static vs runtime types?**
Overloads are selected at compile time from the arguments' static types;
overrides are selected at run time from the receiver's actual class. A call
therefore compiles against one *signature*, and dispatches to the most
derived *implementation* of exactly that signature — never re-choosing a
"better" overload for the runtime argument type.

**★ Rank the conversions overload resolution prefers.**
Exact match, then widening primitive conversion, then boxing/unboxing, then
varargs — three JLS phases, stopping at the first with a match. Mnemonic:
the compiler tries the cheapest, oldest conversions first; varargs is the
last resort.

**Why does `list.remove(1)` on a `List<Integer>` do something different from `list.remove(Integer.valueOf(1))`?**
`List` overloads `remove(int index)` and `remove(Object element)`. An `int`
argument matches the index overload in the strict phase — boxing to reach
the `Object` overload is never considered while an exact match exists. The
classic demonstration that overload sets plus autoboxing are API hazards.

**What exactly does the compiler do with a varargs call?**
Wraps the trailing arguments into a freshly allocated array (empty for zero
args), unless the caller already passes a compatible array, which goes
through untouched. `null` as the sole argument binds the array reference
itself to null.

**Why isn't return type part of the method signature?**
Call sites frequently ignore return values, so return type can't
disambiguate every call — overloading on it would be undecidable. The JVM
*does* store it in the descriptor (bridge methods exploit that, Phase 3),
but the language forbids source-level overloading on it.

**How do you return two values from a method?**
A record — `record Range(int min, int max) {}` — named, typed, and free
since Java 16. Arrays and `Map.Entry` are the legacy idioms; "out
parameters" via mutable arguments don't survive review.

---

← Prev: [Arrays](09-arrays.md) · Next → [`static`](11-static/README.md)
