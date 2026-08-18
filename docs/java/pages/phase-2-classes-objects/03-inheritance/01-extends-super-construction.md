---
title: "extends, super and construction"
sidebar_label: "1 · extends and super"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against the JLS SE 25 §8.1.4 (superclasses and
> subclasses), §8.2 (class members), §8.8.7 (constructor body — explicit
> constructor invocations, statements before `super(...)` since SE 25 via
> JEP 513), and §12.5 (creation of new class instances).

**`extends` wires two classes together at construction time and forever
after: every subclass instance *is* a parent instance, built parent-first,
carrying every non-private instance member the parent declared. The
mechanics are strict — `super(...)` rules, construction order, what is and
isn't inherited — and one of them produces the classic silent bug: a
constructor calling a method the subclass overrode, before the subclass
exists.**

## The mechanics: `extends` and `super`

```java
public class AuditedRepository extends BaseRepository {
    public AuditedRepository(DataSource ds) {
        super(ds);                        // parent constructor — must run first
    }

    @Override
    public void save(Entity e) {
        audit(e);
        super.save(e);                    // parent's version, explicitly
    }
}
```

- `super(...)` invokes a parent constructor; if you write no explicit
  `this(...)`/`super(...)`, the compiler inserts `super()` — which fails to
  compile when the parent has no accessible no-arg constructor. Since 25
  (JEP 513, final), statements may precede the `super(...)` call —
  argument validation and computation, as long as they don't touch the
  instance under construction
  ([class anatomy](../01-class-anatomy/README.md) has the full construction
  order).
- `super.method()` calls the parent's implementation **statically** — no
  dispatch, and there is no `super.super`; skipping a level is not
  expressible, by design: it would let a subclass break the intermediate
  class's invariants from outside.
- A constructor may chain sideways with `this(...)` *or* upward with
  `super(...)`, not both; exactly one constructor in the chain ends up
  calling up. Constructors themselves are **not inherited** — a subclass
  declares its own or gets only the default.

## What is actually inherited

- **Inherited:** every non-`private` instance method and field, `protected`
  and public and (same-package) package-private alike. `static` members are
  *accessible* through the subclass name but belong to the parent
  ([hiding, not overriding](02-overriding-rules-hiding.md)).
- **Not inherited:** constructors; `private` members (they exist in the
  object's memory, but the subclass cannot name them — a same-named
  `private` method in the subclass is an unrelated method, and
  parent-internal calls keep hitting the parent's own).
- Inheritance is transitive and single: one `extends` per class, chains as
  deep as you let them (see
  [why deep chains rot](03-fragile-base-design.md)), and every class's
  chain tops out at `Object`.

## Construction order, precisely

For `new Child(...)` where `Child extends Parent`:

1. `Child`'s constructor starts; its (implicit or explicit) `super(...)`
   runs **before the rest of its body**.
2. `Parent`'s field initializers and instance init blocks run, then
   `Parent`'s constructor body.
3. Only then: `Child`'s field initializers, then the rest of `Child`'s
   constructor body.

The object's *class* is `Child` from the first instruction — dispatch is
live before initialization is complete. That gap is the next section's bug.

## The constructor + overridable-method bug

The classic, worth knowing cold:

```java
class Parent {
    Parent() { init(); }                 // calls the OVERRIDDEN version
    void init() { }
}
class Child extends Parent {
    private final List<String> tags = new ArrayList<>();
    @Override void init() { tags.add("default"); }   // NPE: tags is still null
}
```

The parent constructor runs before the child's field initializers — but
dispatch already targets the child's override, which reads uninitialized
state. Yes, even a `final` field can be observed as `null` this way. The
rule: **constructors call only `private`, `static` or `final` methods.**
Modern compilers and linters flag it; frameworks that need
post-construction hooks give you one explicitly (`@PostConstruct` —
phase 9) instead of pretending the constructor is one. The same trap wears
two other costumes: a field initializer calling an overridable method, and
`clone()`/deserialization paths that bypass constructors and then invoke
overridables.

## Gotchas

**Symptom:** `NullPointerException` from a field "that is definitely initialized" — even a `final` one — during construction
**Cause:** parent constructor invoked an overridable method; the override ran before the subclass's field initializers
**Fix:** constructors call only `private`/`static`/`final` methods; move subclass setup into its own constructor or an explicit lifecycle hook

**Symptom:** `there is no default constructor available in 'Parent'` on a subclass that declares no constructor
**Cause:** the implicit `super()` the compiler inserts has nothing accessible to call — the parent declared only parameterized constructors
**Fix:** declare a subclass constructor that passes arguments up via `super(...)`

**Symptom:** validation added at the top of a subclass constructor "has no effect" — the parent constructor already ran and side-effected
**Cause:** pre-25 rules forced `super(...)` first, so validation was written after it; on 25+ the old workaround (static helper inside the `super(...)` argument list) lingers
**Fix:** on JDK 25, put checks as plain statements before `super(...)` (JEP 513); they run before the parent constructor and may throw cleanly

**Symptom:** a subclass needs the grandparent's behaviour, but `super.super.method()` won't compile
**Cause:** the language forbids skipping a level — the intermediate class's invariants would be bypassed
**Fix:** restructure — have the parent expose the grandparent behaviour under a `protected` method, or stop inheriting and [compose](../13-composition-over-inheritance.md)

**Symptom:** subclass method never runs though its name matches the parent's helper
**Cause:** the parent helper is `private` — not inherited, not overridable; the two methods are unrelated
**Fix:** if the parent intends a hook, it must expose `protected` (and document it); otherwise stop pretending to override internals

**Symptom:** object graph half-initialized after deserialization or `clone()` runs an overridden method
**Cause:** those paths construct without running the usual constructor chain, then dispatch to overrides just like constructors do
**Fix:** the same rule extended — `readObject`/`clone` must not call overridable methods; prefer records or explicit factory-based serialization (phase 7)

## Interview questions

**★ Why is calling an overridable method from a constructor a bug?**
Dispatch targets the subclass override immediately, but the subclass's
field initializers and constructor haven't run — the override observes
default values (`null`/0), including for `final` fields. Restrict
constructor calls to `private`/`static`/`final` methods.

**★ What is the exact construction order for `new Child()`?**
Child constructor entered → `super(...)` → parent field initializers and
init blocks → parent constructor body → child field initializers → child
constructor body. The runtime class is `Child` throughout, which is why
dispatch can outrun initialization.

**★ What changed about constructors in JDK 25?**
JEP 513 (flexible constructor bodies, final in 25): statements may run
before `super(...)`/`this(...)` — argument validation, computation, even
assigning the subclass's own fields — as long as nothing reads the
under-construction instance. Fail-fast validation no longer needs the
static-helper contortion.

**★ Why is there no `super.super`?**
It would let `C` bypass `B`'s override — and therefore `B`'s invariants —
while still being a `B`. The parent chain is an implementation contract
each level owns; if `B` wants to expose `A`'s behaviour, it must do so
explicitly.

**What exactly does a subclass inherit?**
All non-private instance members visible to it (public, protected,
package-private if same package). Not constructors, not private members —
those exist in the instance layout but are unnameable. Statics are
reachable through the subclass but belong to the declaring class.

**Can a constructor be `final`, `static` or overridden?**
No to all three — constructors aren't methods, aren't inherited, and every
class writes its own. The keywords are meaningless on them; what looks
like "overriding a constructor" is just declaring one with the same
parameter list.

---

← Prev: [Overview](README.md) · Next → [Overriding vs hiding — the exact rules](02-overriding-rules-hiding.md)
