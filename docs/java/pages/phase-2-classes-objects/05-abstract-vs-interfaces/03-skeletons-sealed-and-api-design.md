---
title: "Skeletons, sealed types and API design"
sidebar_label: "3 · Skeletons, sealed, API design"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against the JLS SE 25 §8.1.1.2 (`sealed`/`permits`),
> JEP 409 (sealed classes, final in 17), the JDK 25 Javadoc for
> `AbstractList`, `AbstractMap` and `Thread.Builder`, and JEP 395/JLS §9.6.4.9
> (`@FunctionalInterface`).

**The mature answer to "abstract class or interface?" is often *both, in a
fixed arrangement*: the interface is the published contract, the abstract
class an optional skeleton that makes implementing it cheap. The JDK has
shipped that pairing since 1998 (`List`/`AbstractList`), and two modern
features finish the picture — sealed interfaces give contracts the
closed-hierarchy control that used to force abstract classes, and
functional interfaces make the one-method contract a lambda target.**

## The skeletal-implementation pattern

An interface with more than a few methods is expensive to implement from
scratch — but many of its methods are derivable from a core few. The
skeleton class implements the derivable ones and leaves the core abstract:

```java
public interface EventLog {                    // the published contract
    void append(Event e);
    Event get(long index);
    long size();
    default boolean isEmpty() { return size() == 0; }
    List<Event> range(long from, long to);
    Optional<Event> last();
}

public abstract class AbstractEventLog implements EventLog {
    // implementors supply only the three primitives:
    // append, get, size — everything else is derived here
    @Override public List<Event> range(long from, long to) {
        List<Event> out = new ArrayList<>();
        for (long i = from; i < to; i++) out.add(get(i));
        return List.copyOf(out);
    }
    @Override public Optional<Event> last() {
        return size() == 0 ? Optional.empty() : Optional.of(get(size() - 1));
    }
}
```

A team with an exotic storage engine implements `EventLog` directly; every
normal implementation extends `AbstractEventLog` and writes three methods.
This is exactly `AbstractList` under `List`: `get(int)` and `size()` in,
`iterator`, `indexOf`, `equals`, `subList` out.

Why not put `range` and `last` in the interface as defaults? Often you
can — and post-Java-8 the skeleton has migrated partway into interfaces.
The skeleton still earns its place when the derived methods need **state**
(caching, `modCount`-style invariant tracking — `AbstractList` keeps a
field defaults could never hold) or **protected hooks** implementors may
refine but callers must not see. Defaults for stateless derivation,
skeleton for stateful; the interface stays the contract either way.

## Template method: the enforcement only classes have

A default is a suggestion; a `final` method is a rule. When the *algorithm*
must be fixed and only steps vary, that is an abstract class:

```java
public abstract class PaymentFlow {
    public final Receipt process(Order order) {   // cannot be overridden away
        validate(order);
        Charge c = charge(order);                 // the one open decision
        audit(order, c);
        return receipt(c);
    }
    protected abstract Charge charge(Order order);
    private void validate(Order o) { /* fixed */ }
    private void audit(Order o, Charge c) { /* fixed, always runs */ }
    private Receipt receipt(Charge c) { /* fixed */ }
}
```

No interface can promise "audit always runs." If compliance depends on it,
the type that fixes the sequence must be a class and the method `final`.
(The dispatch mechanics of the hook call are
[chunk 3 of polymorphism](../04-polymorphism-dispatch/03-dispatch-in-the-wild.md)'s
template-method section.)

## Sealed interfaces: the calculus changed in 17

Before sealed types, "closed set of subtypes" required an abstract class
with package-private constructors — contract and closure couldn't coexist.
`sealed` broke that coupling
([Sealed types as ADTs](../09-sealed-adts.md) is the full treatment):

```java
public sealed interface PaymentResult permits Approved, Declined, Failed { }
public record Approved(TransactionId id, Money amount) implements PaymentResult { }
public record Declined(String reason)                  implements PaymentResult { }
public record Failed(Exception cause)                  implements PaymentResult { }
```

Consequences for the decision line:

- **Exhaustive `switch` over pure contracts.** The compiler knows the full
  set, so pattern-matching `switch` needs no `default` arm — and *fails to
  compile* when a new subtype arrives, which is the point.
- **"Closed hierarchy" stopped implying "class hierarchy".** The last
  structural reason to pick an abstract class for a *stateless* closed set
  is gone.
- **Records implement interfaces but cannot extend classes** — a sealed
  *interface* is the only closure that admits record subtypes, and
  sealed-interface-over-records is the modern ADT idiom.
- The abstract class keeps its ground exactly where it always had it:
  shared state, constructors, final skeletons — `sealed abstract class`
  exists for closed hierarchies that also share implementation.

## Functional interfaces: the one-method special case

An interface with exactly one abstract method is a **functional
interface** — a lambda target. `@FunctionalInterface` makes the intent
compiler-checked: a second abstract method becomes a compile error, which
is API insurance (adding one would break every lambda call site, a breakage
defaults can't fix). `Comparator` shows the full modern shape at once:
one abstract method (`compare`), `default` combinators (`thenComparing`,
`reversed`), `static` factories (`comparing`, `nullsFirst`) — contract,
evolution and construction on a single type. The lambda side of the story
is [Lambdas and functional interfaces](../../phase-4-lambdas-streams/01-lambdas-functional-interfaces/README.md).

## A worked evolution: the API over five versions

1. **v1 — the contract.** `interface PaymentProcessor { Receipt charge(Order o); }`
   Interface, not abstract class: implementors keep their `extends` slot,
   tests mock it trivially.
2. **v2 — a derived operation.** Refunds expressible via `charge`? Add
   `default Receipt refund(Order o) { ... }` — zero implementors break.
3. **v3 — implementing is getting heavy.** Ship
   `AbstractPaymentProcessor implements PaymentProcessor` with retry
   plumbing and protected hooks. *Beside* the interface, never replacing
   it — adoption stays optional.
4. **v4 — the result type wants case analysis.** `PaymentResult` becomes a
   sealed interface over records; callers `switch` exhaustively.
5. **v5 — a hard new capability.** Genuinely new abstract method? That is
   a new interface (`RecurringPaymentProcessor extends PaymentProcessor`)
   or a major version — not a bare abstract addition to the shipped one.

Each step used the loosest construct that could carry the requirement.
That is the whole discipline: contracts default to interfaces; classes
enter for state, constructors and enforcement; sealing enters when the
*set of implementations* is part of the contract.

## Gotchas

**Symptom:** users extend the skeleton class, and a later refactor of its internals breaks them — though the interface never changed
**Cause:** the skeleton's protected surface became de-facto API; extension couples to implementation exactly as inheritance always does
**Fix:** document the skeleton's self-use and protected hooks as API, or keep the skeleton minimal; breaking-change budget applies to it, not just the interface

**Symptom:** documentation says "extend `AbstractFoo` to implement `Foo`" and a team with an existing base class is stuck
**Cause:** the optional skeleton drifted into being the documented mandatory path
**Fix:** the interface is the contract — keep at least the reference docs and one test implementing it directly, so the direct path stays visible and known-working

**Symptom:** `sealed interface` refuses to compile: "class is not allowed to extend sealed class" or a permitted type "is not a subtype"
**Cause:** every `permits` entry must actually implement the interface, live in the same module (or package, if unnamed), and itself be `final`, `sealed` or `non-sealed`
**Fix:** co-locate the hierarchy and give each permitted type one of the three modifiers; records are implicitly `final`, which is why they slot in cleanly

**Symptom:** a `default` method was added to a functional interface and lambdas still work, but a second *abstract* method broke every lambda call site
**Cause:** lambda targets need exactly one abstract method; defaults don't count, abstract additions do
**Fix:** `@FunctionalInterface` turns that mistake into a compile error at the interface, before it ships

**Symptom:** template-method base class lets a subclass skip the mandatory audit step
**Cause:** the skeleton method was left overridable — a non-`final` public method is an invitation
**Fix:** `final` on the algorithm method, `protected abstract` only on the intended hooks, `private` on the fixed steps

**Symptom:** exhaustive `switch` over a sealed interface fails to compile after adding a permitted type — in *other* teams' code
**Cause:** that is the feature: sealing makes the subtype set part of the contract, and every exhaustive `switch` is a compile-time subscriber to it
**Fix:** treat adding a `permits` entry as a breaking API change; release-note it and let the compiler find every site

## Interview questions

**★ How do sealed interfaces change the abstract-class-vs-interface decision?**
They give interfaces the one control that used to force abstract classes —
a closed set of subtypes (`permits`) — enabling exhaustive `switch` over
contracts. "Closed hierarchy" stopped implying "class hierarchy"; abstract
classes are now chosen only for shared state, constructors and enforced
skeletons, and `sealed abstract class` covers closed-plus-shared-state.

**★ Explain the skeletal-implementation pattern and when defaults replace it.**
Publish the interface as the contract; beside it, an abstract class
implements everything derivable from a few core primitives (`AbstractList`
from `get`/`size`). Post-Java-8, stateless derivation can live in the
interface as defaults; the skeleton survives where derived methods need
state or protected hooks. Implementors choose: extend the skeleton
cheaply, or implement the interface directly when their `extends` slot is
taken.

**★ Why can records only participate in sealed *interfaces*, and why does that matter?**
Records implicitly extend `java.lang.Record`, so they can never extend
another class — an interface is the only supertype they can take. Since
sealed-hierarchy-over-records is the standard ADT shape, the sealed
*interface* became the default closure construct, not the sealed class.

**★ You need to guarantee a step always runs around subclass-supplied logic. Interface or abstract class?**
Abstract class, necessarily: a `final` template method fixing the sequence
around `protected abstract` hooks. Interfaces cannot enforce — every
default is overridable and `final default` does not exist. (The alternative
that avoids inheritance entirely: a wrapper/decorator the caller controls.)

**What does `@FunctionalInterface` actually do?**
Nothing at runtime — it makes the compiler reject a second abstract method.
It is API insurance: it converts "someone added an abstract method and
broke every lambda call site" into a compile error at the declaration.

**Why does `Comparator` have static and default methods?**
It is the post-Java-8 interface shape in miniature: one abstract method
keeps it a lambda target, `static` factories (`comparing`) build instances
without a companion class, `default` combinators (`thenComparing`,
`reversed`) compose them. Contract, construction and evolution on one type.

**When would you still ship an abstract class as the public contract?**
When the contract *is* stateful by nature — shared fields, constructor
invariants, mandatory sequencing — and every implementation genuinely is-a
specialization of one representation (`InputStream`, `Thread`). Accept the
cost knowingly: implementors spend their `extends` slot, and you can never
convert to an interface compatibly.

---

← Prev: [Default methods and the diamond](02-default-methods-and-the-diamond.md) · Index: [Abstract classes vs interfaces](README.md)
