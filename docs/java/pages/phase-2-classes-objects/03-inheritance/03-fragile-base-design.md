---
title: "The fragile base class, and designing for extension"
sidebar_label: "3 · Fragile base, design"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against the JLS SE 25 §6.6.2 (details of `protected`
> access), §8.1.1.2 (`final` classes), §8.4.3.3 (`final` methods), the
> JDK 25 API documentation for `java.sql.Timestamp`, `java.util.Stack`,
> `java.util.Properties` and `java.util.HashSet`, and *Effective Java*'s
> item "Design and document for inheritance or else prohibit it" (the
> `InstrumentedHashSet` demonstration).

**The fragile-base-class problem is structural, not stylistic: a subclass
couples to *how* its parent works — which methods call which, what
invariants hold mid-call — none of it in the type signature. The parent
evolves for its own reasons; subclasses break without a compile error. The
JDK carries its own permanent examples, and the defenses are concrete:
`final` by default, `protected` used deliberately, sealed hierarchies, and
composition where reuse was the only goal.**

## Self-use: the coupling you can't see

The canonical demonstration (Effective Java's `InstrumentedHashSet`):

```java
class InstrumentedHashSet<E> extends HashSet<E> {
    private int addCount = 0;
    @Override public boolean add(E e) { addCount++; return super.add(e); }
    @Override public boolean addAll(Collection<? extends E> c) {
        addCount += c.size();
        return super.addAll(c);          // HashSet.addAll calls add() —
    }                                    // which is now YOUR add(): double count
}
```

`addAll` is documented to be *implemented on top of* `add` in
`AbstractCollection` — so the count is added twice. Fixing it means either
not counting in `addAll` (now you depend on the parent *keeping* that
self-use) or reimplementing `addAll` (now you've forked the parent). Either
way, your correctness depends on a private implementation decision the
parent never promised. That is the fragile base class in one class: the
parent's **self-use pattern is an unwritten API**, and every subclass
silently signs up to it.

Symptoms in real codebases: `BaseService` with 40 protected methods,
template hooks nobody dares rename, and test setups that construct half
the hierarchy to test a leaf.

## The JDK's own cautionary tales

These ship in every JVM and can't be fixed for compatibility reasons:

- **`java.util.Stack extends Vector`** — a stack that lets any caller
  `insertElementAt` into the middle, plus inherited synchronization nobody
  asked for. The Javadoc itself now points you to `ArrayDeque`.
- **`java.util.Properties extends Hashtable`** — designed for
  String-to-String, but the inherited `put(Object, Object)` lets non-String
  entries in, corrupting `store()`. The fix inside the JDK is defensive
  overrides and documentation pleading "use `setProperty`".
- **`java.sql.Timestamp extends java.util.Date`** — adds nanoseconds and
  breaks `equals` symmetry: `date.equals(timestamp)` can be `true` while
  `timestamp.equals(date)` is `false`. The
  [equals contract](../06-equals-hashcode/README.md) explains why adding
  state under an instantiable parent forces exactly this choice; the
  Javadoc's own advice is not to mix the two in collections.

Each is the same lesson: **is-a for reuse, without a designed contract,
becomes a permanent public liability.**

## `protected` — what it actually grants

`protected` is not "package-private plus a bit". It means package access
**plus** subclass access — but with a rule that surprises (JLS §6.6.2): a
subclass in another package may access an inherited `protected` instance
member **only through a reference of its own type (or a subtype)**, not
through a `Parent`-typed or sibling-typed reference. `this.helper()` works;
`otherParentRef.helper()` does not compile from outside the package. The
intent: `protected` grants access to *your own inherited state*, not to
every instance of the parent. Every `protected` member is also **API for
every future subclass** — it carries the same compatibility burden as
`public`, with less tooling attention.

## The defenses

- **`final` classes and methods.** A class not *designed* for extension
  should refuse it — `final` on the class, or `final` on the template's
  skeleton methods while the hooks stay overridable. Records and enums are
  implicitly final;
  [sealed hierarchies](../09-sealed-adts.md) are the middle
  ground — extension, but only by the types the parent names, which makes
  exhaustive `switch` possible and keeps the contract reviewable.
- **Design for it, or prohibit it.** A class that invites extension must
  document its self-use ("this method calls `add` once per element"),
  keep constructors free of overridable calls
  ([chunk 1](01-extends-super-construction.md)), and mark the skeleton
  `final`. If you won't pay that documentation bill, `final` the class.
- **Composition over inheritance** — hold the collaborator, delegate, own
  your API ([topic 13](../13-composition-over-inheritance.md) builds the
  wrapper/forwarding pattern that fixes `InstrumentedHashSet` for good).
  Java's single class inheritance (one `extends`, many `implements`)
  exists precisely to keep the implementation-coupling channel narrow;
  interfaces share contract without sharing implementation
  ([topic 05](../05-abstract-vs-interfaces/README.md)).

Where inheritance genuinely earns its keep: shallow, designed-for-it
hierarchies — an abstract base owning a template with `final` skeleton
methods and documented hooks, sealed hierarchies where the parent controls
the subtype set, and framework extension points documented as such
(`HttpServlet`, JUnit base classes, Spring's template classes). "I want to
reuse three methods" is not on the list — that's composition.

## Gotchas

**Symptom:** a counting/instrumenting subclass double-counts on bulk operations
**Cause:** the parent's bulk method self-uses the unit method you overrode (`addAll` → `add`)
**Fix:** don't extend for instrumentation — wrap and delegate ([composition](../13-composition-over-inheritance.md)); if you must extend, read the parent's documented self-use and pin it with tests

**Symptom:** `date.equals(ts)` true but `ts.equals(date)` false — a `Set` behaves differently depending on insertion order
**Cause:** `Timestamp extends Date` adds state; symmetric `equals` across an instantiable parent and a richer child is mathematically impossible
**Fix:** never mix the two types in one collection; in your own designs, don't add equals-relevant state under an instantiable parent — use composition or a sealed hierarchy

**Symptom:** non-String garbage appears in a `Properties` file written by `store()`
**Cause:** the inherited `Hashtable.put` bypassed the String-only intent
**Fix:** `setProperty`/`getProperty` only — and in your own code, don't inherit from a general container to build a constrained one; wrap it

**Symptom:** subclass in another package fails to compile calling `otherInstance.protectedMethod()` though "it's protected and we're a subclass"
**Cause:** JLS §6.6.2 — cross-package protected access works only through a reference of the accessing class's own type
**Fix:** access via `this`/own-type references; if two siblings must share it, the member wants to be in the parent's package or wrapped in a public operation

**Symptom:** upgrading a library breaks your subclasses with no signature change anywhere
**Cause:** the parent changed *how* its methods call each other; your overrides were coupled to the old self-use
**Fix:** this is the fragile base class itself — migrate the extension to composition, and prefer extending only types whose docs promise their self-use

**Symptom:** a "stack" or other constrained type is corrupted through operations it never meant to expose
**Cause:** it `extends` a general collection, inheriting the whole surface (`Stack extends Vector` shape)
**Fix:** compose — private field, expose exactly `push`/`pop`/`peek`; the JDK's own advice is `ArrayDeque` over `Stack`

**Symptom:** every service in the codebase extends `BaseService`, and changing it requires a fleet-wide regression run
**Cause:** inheritance used as a code-sharing bucket — dozens of subclasses coupled to one mutable implementation
**Fix:** break it up: inject the shared collaborators (phase 9's DI), keep interfaces for the contract, and let `BaseService`'s pieces become `final` utilities

## Interview questions

**★ What is the fragile base class problem?**
Subclasses couple to the parent's self-use patterns and internal
invariants — none of it expressed in the signature — so parent evolution
breaks subclasses without compile errors. It is the structural reason
"prefer composition" is standard advice rather than taste.

**★ Walk through why `InstrumentedHashSet` double-counts.**
`HashSet.addAll` (via `AbstractCollection`) is implemented by calling
`add` per element; the subclass counted in `addAll` *and* in its
overridden `add`, which the parent's `addAll` now dispatches to. The
subclass's correctness depended on an implementation detail the parent
never promised — and the clean fix is a forwarding wrapper, not a smarter
override.

**★ Why does Java allow only single class inheritance?**
To keep implementation coupling on a single, explicit channel and avoid
state-diamond problems; multiple inheritance of *type* comes from
interfaces, and (since default methods) limited behaviour sharing too,
with [explicit diamond-resolution rules](../05-abstract-vs-interfaces/README.md).

**★ What does `protected` grant, exactly?**
Package access plus subclass access — but cross-package subclasses may
touch inherited protected instance members only through references of
their own type. It's "access to your inherited state", not "access to any
parent instance" — and every protected member is permanent API for all
future subclasses.

**★ When is inheritance the right tool?**
Designed-for-extension points: shallow abstract bases with a `final`
template skeleton and documented hooks and self-use, sealed hierarchies
where the parent controls the subtype set, and framework classes that name
themselves extension points. "I want to reuse three methods" is
composition's job.

**Why are `Stack`, `Properties` and `Timestamp` considered design mistakes?**
Each inherited a surface it needed to *restrict* (Vector's random access,
Hashtable's Object keys) or added state that broke an inherited contract
(Timestamp vs Date equals symmetry) — and compatibility means the JDK can
never fix them. They're the standing argument for `final`-by-default and
composition.

**What should a class designed for extension document?**
Its self-use: which public/protected methods call which overridable ones,
in what order, under what invariants — plus constructor discipline (no
overridable calls) and which hooks exist for subclasses. If that bill is
too expensive, the honest alternative is `final`.

---

← Prev: [Overriding vs hiding — the exact rules](02-overriding-rules-hiding.md) · Next → [Polymorphism and dynamic dispatch](../04-polymorphism-dispatch/README.md)
