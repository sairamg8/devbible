---
title: "Inheritance"
sidebar_label: "03 · Inheritance"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JLS SE 25 §8.1.4 (superclasses), §8.4.8
> (inheritance, overriding, and hiding), §12.5 (instance creation), and the
> `@Override` Javadoc in the JDK 25 API documentation.

**`extends` buys you code reuse at the price of the strongest coupling Java
has: the subclass depends on its parent's *implementation details*, forever,
across every parent version. The mechanics — overriding rules, `super`,
hiding vs overriding — are exact and learnable; the judgement is knowing that
most inheritance in application code is a mistake that composition or an
interface would have made cheaper.**

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
  compile when the parent has no accessible no-arg constructor. (Since 25,
  statements may precede it — [class anatomy](01-class-anatomy.md).)
- `super.method()` calls the parent's implementation *statically* — no
  dispatch, and there is no `super.super`; skipping a level is not
  expressible, by design.
- Everything non-`private` and non-`static` is inherited; constructors are
  not inherited.

## Overriding: the exact rules

An instance method overrides a parent method with the **same name and
parameter types**. The compiler then holds the subclass to the contract the
parent published:

| Aspect | Rule | Why |
|---|---|---|
| Return type | Same, or a **subtype** (covariant) | Callers were promised at least the parent type |
| Checked exceptions | Same, **fewer, or narrower** — never broader | Callers only handle what the parent declared |
| Visibility | Same or **wider** — never narrower | [Access can't be revoked](02-encapsulation-access.md) |
| `static`? | No — statics don't override, they **hide** | Dispatch is per-instance; statics have no instance |

Covariant returns are why `clone()`-style and builder APIs can return their
own type; exception narrowing is why an implementation of an interface method
declared `throws IOException` may throw nothing at all.

## `@Override`: annotate every single one

`@Override` makes the compiler verify "this really overrides something". The
bug it kills is quiet and common — an *accidental overload*:

```java
@Override
public boolean equals(MyType o) { ... }   // compile error: overloads, not overrides
```

Without the annotation, this compiles, `equals(Object)` remains inherited
from `Object`, and every `HashSet`/`HashMap` silently uses identity — the
entity "randomly" fails lookups. Same trap with a typo'd name or a slightly
different parameter type. The rule with no exceptions: **every override
carries `@Override`**, so the compiler — not production — finds the mismatch.

## Overriding vs hiding

Only instance *methods* override. Two look-alikes bind statically:

- **Fields hide.** A subclass field with a parent field's name creates a
  second field; which one an expression reads depends on the *static type of
  the reference*, not the object. Two `name` fields, both alive, chosen at
  compile time — never do this deliberately.
- **Static methods hide.** `Child.create()` vs `Parent.create()` are chosen
  by the reference's compile-time type. A "polymorphic static" does not
  exist ([dispatch](04-polymorphism-dispatch.md) has the full model).

`private` methods are outside all of this: not inherited, so a same-named
`private` method in the subclass is an unrelated method, and parent-internal
calls keep hitting the parent's own.

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

Construction order ([class anatomy](01-class-anatomy.md)) runs the parent
constructor before the child's field initializers — but dispatch already
targets the child's override, which reads uninitialized state. The rule:
**constructors call only `private`, `static` or `final` methods.** Modern
compilers and linters flag it; frameworks that need post-construction hooks
give you one explicitly (`@PostConstruct` — phase 9) instead.

## Why deep hierarchies rot

The fragile-base-class problem is structural, not stylistic. The subclass
depends on *how* the parent works — which methods call which (self-use),
what invariants hold mid-call — none of it in the type signature. The parent
evolves for its own reasons; subclasses three levels down break without a
compile error. Symptoms in real codebases: `BaseService` with 40 protected
methods, template hooks nobody dares rename, and test setups that construct
half the hierarchy to test a leaf.

The alternatives that age better: **composition over inheritance** (topic 13
*(not written yet)*) — hold the collaborator, delegate, own your API; and
**interfaces** ([topic 05](05-abstract-vs-interfaces.md)) — share contract
without sharing implementation. Java's single class inheritance (one
`extends`, many `implements`) exists precisely to keep the
implementation-coupling channel narrow. Where inheritance genuinely earns its
keep: shallow, designed-for-it hierarchies — an abstract base owning a
template with `final` skeleton methods, sealed hierarchies
([topic 09](README.md) once written), and framework extension points
documented as such.

## Gotchas

**Symptom:** entity "disappears" from a `HashSet` — `contains` false for an element that is present
**Cause:** `equals(MyType)` overload instead of `equals(Object)` override; identity comparison inherited from `Object` was in effect
**Fix:** `@Override public boolean equals(Object o)` — the annotation would have made the original mistake a compile error

**Symptom:** `NullPointerException` from a field "that is definitely initialized" during construction
**Cause:** parent constructor invoked an overridable method; the override ran before the subclass's field initializers
**Fix:** constructors call only `private`/`static`/`final` methods; move subclass setup into its own constructor or an explicit lifecycle hook

**Symptom:** `there is no default constructor available in 'Parent'` on a subclass that declares no constructor
**Cause:** the implicit `super()` the compiler inserts has nothing accessible to call — the parent declared only parameterized constructors
**Fix:** declare a subclass constructor that passes arguments up via `super(...)`

**Symptom:** the same expression reads different `name` values depending on whether the reference is typed `Parent` or `Child`
**Cause:** field *hiding* — fields bind by static type; both fields exist on the object
**Fix:** never shadow a parent field; rename one. If the parent's is `private`, no conflict exists in the first place

**Symptom:** override that declares `throws SQLException` won't compile, though the body genuinely throws it
**Cause:** the parent method declares no (or narrower) checked exceptions; overrides cannot broaden them
**Fix:** wrap in an unchecked domain exception at this boundary (phase 5's translation pattern), or widen the declaration at the parent *if you own the contract*

**Symptom:** "overrode" a static factory method; parent-typed call sites ignore it
**Cause:** statics hide, not override — resolution used the reference's compile-time type
**Fix:** don't design around static polymorphism; use instance methods on a factory object, or keep statics `final`-in-spirit and unique per class

**Symptom:** subclass method never runs though its name matches the parent's helper
**Cause:** the parent helper is `private` — not inherited, not overridable; the two methods are unrelated
**Fix:** if the parent intends a hook, it must expose `protected` (and document it); otherwise stop pretending to override internals

## Interview questions

**★ What are the rules an overriding method must satisfy?**
Same name and parameter types; return type same or covariant; checked
exceptions same, fewer or narrower; visibility same or wider; and it must be
an instance method — statics hide instead. `@Override` asks the compiler to
verify all of it.

**★ Why is calling an overridable method from a constructor a bug?**
Dispatch targets the subclass override immediately, but the subclass's field
initializers and constructor haven't run — the override observes default
values. Restrict constructor calls to `private`/`static`/`final` methods.

**★ Overriding vs hiding — what binds when?**
Instance methods override and bind dynamically (runtime type). Fields and
static methods hide and bind statically (compile-time type of the
reference). Private methods are outside inheritance entirely.

**★ Why does Java allow only single class inheritance?**
To keep implementation coupling on a single, explicit channel and avoid
state-diamond problems; multiple inheritance of *type* is provided by
interfaces, and (since default methods) limited behaviour sharing too, with
[explicit diamond-resolution rules](05-abstract-vs-interfaces.md).

**★ What is the fragile base class problem?**
Subclasses couple to the parent's self-use patterns and internal invariants
— none of it expressed in the signature — so parent evolution breaks
subclasses without compile errors. It is the structural reason "prefer
composition" is standard advice rather than taste.

**What do covariant return types buy in API design?**
An override can promise its own, more specific type — fluent builders and
copy methods return `Child` where the parent declared `Parent`, sparing
callers a cast.

**When is inheritance the right tool?**
Designed-for-extension points: shallow abstract bases with a `final`
template skeleton and documented hooks, sealed hierarchies where the parent
controls the subtype set, and framework classes that name themselves
extension points. "I want to reuse three methods" is not on the list —
that's composition.

---

← Prev: [Encapsulation and access modifiers](02-encapsulation-access.md) · Next → [Polymorphism and dynamic dispatch](04-polymorphism-dispatch.md)
