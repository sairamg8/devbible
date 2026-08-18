---
title: "Composition over inheritance"
sidebar_label: "13 · Composition over inheritance"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against Effective Java 3rd ed. Item 18 ("Favor
> composition over inheritance"), the JDK 25 Javadoc for
> `java.util.Properties` (the standing example of the mistake), and the JLS
> SE 25 §8.4.8 on method overriding.

**Inheritance is the strongest coupling Java offers: a subclass depends not
just on its parent's API but on its parent's *implementation choices* —
which methods call which, in what order, with what assumptions. Composition
gets you the same reuse by *holding* the other object and forwarding to it,
coupled only to its public contract. The guideline is not "never extend" —
it is that extension is a specialized tool for genuine is-a relationships
within code you control, while composition is the default for everything
else.**

## The mistake, concretely: `extends ArrayList`

```java
// Looks like reuse. Is actually a trap.
public class AuditedList<E> extends ArrayList<E> {
    private int addCount = 0;

    @Override public boolean add(E e) {
        addCount++;
        return super.add(e);
    }
    @Override public boolean addAll(Collection<? extends E> c) {
        addCount += c.size();
        return super.addAll(c);        // does addAll call add()? You don't know.
    }
    public int addCount() { return addCount; }
}
```

Whether `addCount` is right depends on whether `ArrayList.addAll` happens to
be implemented in terms of `add` — a **self-call assumption** about a class
you don't own. If it does delegate, this code double-counts. If a future JDK
changes the internal delegation, behaviour changes without your code
changing. Effective Java Item 18 walks this exact failure with
`HashSet.addAll`. This is the **fragile base class problem**: the base
class's private implementation becomes your public behaviour.

Three more costs come bundled:

- **API lock-in to someone else's contract.** `AuditedList` *is* an
  `ArrayList`: all ~30 public methods, forever. `clear()` bypasses your
  count. Every method added to `ArrayList` in a future release appears in
  your class unaudited. The JDK's own `Properties extends Hashtable` is the
  fossil record: `props.put(1, "x")` compiles and corrupts the "strings
  only" contract, and the Javadoc now begs you not to use the inherited
  methods.
- **You can never change the decision.** Published subclasses can't switch
  parents without breaking every caller.
- **`equals` across a hierarchy is unfixable** in general (topic 06's
  symmetry problem) — extending an instantiable class and adding a value
  component breaks the contract.

## The composition version

Hold it, don't be it — implement the *interface*, forward to a private
delegate:

```java
public class AuditedList<E> implements List<E> {
    private final List<E> delegate;         // ANY List — injected, swappable
    private int addCount = 0;

    public AuditedList(List<E> delegate) { this.delegate = delegate; }

    @Override public boolean add(E e) { addCount++; return delegate.add(e); }
    @Override public boolean addAll(Collection<? extends E> c) {
        addCount += c.size(); return delegate.addAll(c);
    }
    @Override public int size()      { return delegate.size(); }
    // ... remaining List methods forward one line each
    public int addCount() { return addCount; }
}
```

Now the count is right *regardless* of how any `List` implements `addAll` —
calls the delegate makes to itself stay inside the delegate and never
re-enter your wrapper. You depend only on `List`, the published contract.
You can wrap an `ArrayList`, a `LinkedList`, an unmodifiable list, or
another wrapper — at runtime, per instance. That stacking is the
**decorator pattern**, and the JDK is full of it:
`Collections.unmodifiableList`, `synchronizedList`, `checkedList`,
`BufferedReader(new FileReader(...))` — wrappers adding one behaviour over
any implementation of the same interface.

The honest cost: forwarding boilerplate (one line per method — IDEs
generate it; a *forwarding class* per interface can be written once and
reused), one extra object, and the wrapper doesn't intercept the
delegate's internal self-calls — which is exactly the isolation that makes
it robust, but matters if you *wanted* to hook them.

## When inheritance is right

Inheritance is the correct tool when all of these hold:

- **Genuine is-a, per substitutability**: every instance of the subclass is
  usable *anywhere* the superclass is expected, honouring its full contract
  (Liskov) — not just "shares some fields".
- **The base class is designed and documented for extension** — it
  specifies its self-use (which public methods call which overridables), has
  protected hooks on purpose, and its maintainers treat that as API.
  Effective Java Item 19's rule: design and document for inheritance, *or
  prohibit it* (`final`, or sealed to a known set).
- **Same codebase or same release cadence** — base and subclass evolve
  together, so implementation coupling is manageable.

That is exactly the profile of framework extension points (`extends
AbstractHandler`-style template methods within one library) and of closed
domain hierarchies — which in modern Java are increasingly **sealed**
interfaces + records (topic 09's ADTs) rather than open class trees.
Abstract classes designed as skeletal implementations
(`AbstractList`-style) are inheritance used as intended: the JDK documents
their self-use precisely so you *can* subclass safely.

Interfaces changed the calculus too: `default` methods let an interface
ship shared behaviour without any base-class coupling — the "shared code"
argument for extending is far weaker than it was pre-Java 8.

## The decision test

Ask, in order:

1. Do I need to *be* the other type for callers (substitutability), or do I
   just need its *functionality*? Functionality → compose.
2. Is the candidate base class documented for extension? Undocumented
   self-use → compose.
3. Would I be embarrassed if the base class added a method that bypasses my
   logic? If that breaks correctness (audit, validation, security
   wrappers) → compose; inheritance cannot seal those holes.
4. Am I adding a *value component* to an instantiable class? → compose
   (topic 06's equals problem has no inheritance-shaped fix).

## Gotchas

**Symptom:** a counter/validator/security check in an overridden method is bypassed intermittently
**Cause:** the base class has other public methods (or internal paths) reaching the same state without going through your override — `clear()` next to `add()`, bulk ops beside single ops
**Fix:** wrap the interface and forward, so *every* path goes through your object; inheritance can't enumerate someone else's bypass routes

**Symptom:** double-counting or double-processing after a JDK/library upgrade, with no code change on your side
**Cause:** self-call assumption — your override was implicitly relying on whether `addAll` delegates to `add` internally, and the base implementation changed
**Fix:** composition: internal self-calls of the delegate never re-enter the wrapper, so its implementation strategy stops being your problem

**Symptom:** `Properties`-style corruption — a compile-legal call violates the subclass's documented contract
**Cause:** the subclass inherited a wider API than its abstraction allows (`Hashtable.put` on a strings-only store)
**Fix:** composition hides the delegate's API entirely; expose only the methods your abstraction means

**Symptom:** class explosion — `SortedAuditedList`, `AuditedSyncList`, `SortedSyncList`...
**Cause:** using subclassing to combine orthogonal features; combinations multiply
**Fix:** decorators stack at runtime: `new Audited<>(new Synced<>(list))` — one wrapper per feature, any combination

**Symptom:** unit tests of a subclass drag in the whole base-class machinery (DB calls, framework context)
**Cause:** inheritance is compile-time-fixed and unmockable — you cannot substitute the parent
**Fix:** composed dependencies are injected and mockable; the test hands in a fake delegate

**Symptom:** a wrapper's added behaviour doesn't fire for operations happening "inside" the delegate (e.g. iterator-based removal)
**Cause:** the flip side of composition's isolation — the delegate's internal paths are invisible to the wrapper
**Fix:** intercept at the right interface (wrap the `Iterator` too), or accept that the wrapper decorates the boundary, not the internals — and document it

**Symptom:** `instanceof ArrayList` checks or APIs demanding the concrete class break after switching to a wrapper
**Cause:** callers were coupled to the implementation class instead of the interface
**Fix:** program to `List` everywhere (Phase 3's hierarchy discipline); the wrapper then substitutes freely

## Interview questions

**★ What does "favor composition over inheritance" actually mean?**
Default to holding a delegate behind an interface and forwarding, because
inheritance couples you to the base class's *implementation* (its self-call
structure, its full API surface, its future changes), while composition
couples you only to a published contract. Inheritance remains right for
true is-a with a base class designed for extension in code you control.

**★ What is the fragile base class problem?**
Subclass correctness depends on undocumented implementation details of the
parent — typically which methods call which. The parent can break the
subclass without changing its API, as in the classic
`HashSet.addAll`-calls-`add` double-count. Composition eliminates it: the
delegate's internals never re-enter the wrapper.

**★ Why is `Properties extends Hashtable` cited as a design mistake?**
`Properties` means "string keys and values", but it inherited `Hashtable`'s
untyped `put`, so callers can insert non-strings that later blow up
`getProperty` — the inherited API is wider than the abstraction's contract,
and it is frozen into the public type forever. Composition would have
exposed only string-typed methods.

**★ When is inheritance the right choice?**
Genuine substitutability (Liskov), a base class explicitly designed and
documented for extension (documented self-use, deliberate hooks — or
skeletal implementations like `AbstractList`), and shared ownership/release
cadence. Otherwise compose. And if you publish a class not designed for
extension, prohibit it — `final` or sealed.

**How does the decorator pattern relate?**
It *is* composition formalized: wrapper and delegate share an interface,
the wrapper adds one behaviour and forwards the rest, and wrappers stack —
`Collections.unmodifiableList`, buffered streams. Runtime-composable
features instead of a compile-time subclass per combination.

**What are composition's costs?**
Forwarding boilerplate (IDE-generated, or a reusable forwarding class), one
extra hop and object, and no visibility into the delegate's internal
self-calls — plus the discipline that callers must be typed to the
interface, not the concrete class.

**Did default methods change this debate?**
They removed the last common excuse for extending-for-reuse: shared
behaviour can live on the interface itself, so "I extended it to inherit
helpers" no longer justifies implementation coupling.

---

← Prev: [Designing immutable classes](12-immutable-design.md) · Next → [Object lifecycle](14-object-lifecycle.md)
