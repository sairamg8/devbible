---
title: "Designing with access"
sidebar_label: "2 · Designing with access"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 API documentation
> (`List.copyOf`, `Collections.unmodifiableList`), the JLS SE 25 §13.4.9
> (binary compatibility of constants), and JEP 395 (records) for the
> data-carrier contrast.

**Encapsulation is not "make fields private and generate accessors" — that
ships the same coupling with extra steps. It is deciding which *decisions*
stay inside the object: the invariants only it can enforce, the
representation only it may know, the mutable internals nobody else may
touch. This chunk is what that looks like in code that has to survive
maintenance.**

## Encapsulation is about behaviour, not getters

Wrapping every field in `getX`/`setX` is not encapsulation — it is `public`
fields with extra steps. The object still cannot defend an invariant, and
callers still implement the logic that belongs inside:

```java
// Ask for data, decide outside — invariant lives in every caller
if (order.getStatus() == SHIPPED || order.getStatus() == DELIVERED) { ... }

// Tell the object — invariant lives in one place
if (order.isClosed()) { ... }

// The full version: no setter at all; the transition guards itself
public void ship() {
    if (status != PAID) throw new IllegalStateException("unpaid order: " + id);
    this.status = SHIPPED;
}
```

"Tell, don't ask" is the habit: push decisions toward the data. The practical
payoffs are concrete — invariants enforceable in one place, a seam for
logging/metrics, and the freedom to change representation (store cents, split
a field) without touching callers.

**Records are not a counterexample.** A record exposes its *components* —
that is its contract as a transparent data carrier — but the representation
is still `private final` fields, validation still guards construction in the
compact constructor, and there are no setters. Data carriers expose data;
domain objects expose behaviour. Knowing which one you are writing is the
actual skill ([records](../08-records/README.md)).

## Collections: the leak that setters don't cause

The commonest encapsulation hole has no setter in sight:

```java
public class Order {
    private final List<OrderLine> lines = new ArrayList<>();
    public List<OrderLine> getLines() { return lines; }   // hole: caller mutates internals
}
order.getLines().clear();                                  // no invariant stood a chance
```

Returning the live mutable collection hands every caller write access to
your internals — aliasing, not access modifiers, is the breach. The
defenses, in order of preference:

- **Return an immutable copy** — `List.copyOf(lines)`. Truly detached;
  callers can't affect internals and later internal mutations don't
  surprise the caller's snapshot. Cost: a copy per call.
- **Return an unmodifiable *view*** — `Collections.unmodifiableList(lines)`.
  No copy, callers can't write — but the view is **live**: it changes as the
  underlying list changes, and code that stored it may see mutation at a
  distance. Fine for hot paths; document the view-ness.
- **Don't return the collection at all** — expose the operations callers
  actually perform: `addLine(line)` (validating), `totalWeight()`,
  `Stream<OrderLine> lines()`. The strongest form of "tell, don't ask".

Same discipline inbound: a constructor storing a caller-supplied collection
must defensive-copy it (`this.lines = new ArrayList<>(lines)` — or
`List.copyOf` for immutables), or the caller retains a write handle into
your object ([immutable design](../12-immutable-design.md) makes this rule
load-bearing).

## Why `public` fields lock your API

A `public` field is a commitment to a *storage layout*: no validation on
write, no interception (logging, lazy init, metrics), no thread-safety
hook, no representation change — ever — without breaking or recompiling
callers. And remember that `static final` compile-time constants get
*inlined* into consumers (JLS §13.4.9 — [source to
bytecode](../../phase-0-platform-jvm/01-what-java-is/01-source-to-bytecode.md)):
changing the value and redeploying the one class is not enough; consumers
compiled against the old value keep it until they recompile.

The exceptions the ecosystem accepts: `public static final` constants of
immutable types, and `public final` fields on small package-internal value
types. Everything else earns a method.

## Setters are a design decision, not a default

A setter is a public commitment that the field may change at any time, to
any caller, independent of every other field. Most fields don't want that
contract:

- Fields fixed at construction → `final`, no setter
  ([immutable design](../12-immutable-design.md)).
- Fields that change only as part of a *transition* → a named operation
  (`ship()`, `cancel(reason)`) enforcing the state machine, not `setStatus`.
- Fields that genuinely are freely mutable properties (a UI bean's
  `setVisible`) → fine, and the JavaBeans naming convention
  (`getX`/`setX`/`isX` — [naming and
  idiom](../../phase-1-language-core/15-naming-idiom.md)) is what frameworks
  reflect over.

Generating both accessors for every field "for consistency" is how domain
objects degrade into bags of getters — each generated setter is invariant
surface you now defend in review instead of in the compiler.

## Gotchas

**Symptom:** collection returned by a getter was cleared by a caller; invariants silently gone
**Cause:** returned the live internal collection — aliasing bypassed every modifier
**Fix:** `List.copyOf` (detached) or `unmodifiableList` (live view, document it), or expose operations instead of the collection

**Symptom:** caller's list, passed into a constructor, keeps mutating the object after construction
**Cause:** stored the caller's reference instead of copying — inbound aliasing
**Fix:** defensive-copy at the boundary: `new ArrayList<>(input)` or `List.copyOf(input)`

**Symptom:** changed a `public static final int` "constant" and consumers still see the old value after redeploy
**Cause:** compile-time constants are inlined into consuming class files at their compile time
**Fix:** recompile consumers, or expose values that may change via a method instead of a constant

**Symptom:** `unmodifiableList` result "changed by itself" in a caller that cached it
**Cause:** it is a live view over the still-mutable internal list, not a snapshot
**Fix:** where callers may retain the result, hand out `List.copyOf` instead; reserve views for transient iteration

**Symptom:** business rule about status transitions duplicated (differently) in three services
**Cause:** `getStatus`/`setStatus` pushed the state machine out to every caller
**Fix:** replace the setter with transition methods that enforce legal moves in one place; delete the duplicates

**Symptom:** review reveals a "domain object" whose every field has generated getter and setter; invariants enforced nowhere
**Cause:** accessor generation applied as reflex — the class is a mutable bag, not a model
**Fix:** decide per field: `final` + constructor, transition method, or (rarely) a real property setter; if it truly is all-data, make it a [record](../08-records/README.md)

**Symptom:** Jackson/JPA fails after setters were removed in an encapsulation cleanup
**Cause:** those frameworks bind via the JavaBeans convention or field reflection — the accessors were load-bearing for serialization
**Fix:** keep the domain model encapsulated and map through dedicated DTO records at the boundary, or configure field access — don't re-open the domain type

## Interview questions

**★ Why is a getter-and-setter pair for every field not encapsulation?**
Because encapsulation means hiding *decisions*, not adding indirection to
data. Invariants still leak to every caller; representation still can't
change (the getter's return type pins it). Encapsulation shows up as
behaviour methods (`ship()`, `isClosed()`) and constructors that refuse
invalid states.

**★ `List.copyOf` vs `Collections.unmodifiableList` as a getter's return — the real difference?**
`copyOf` detaches: an immutable snapshot, internal changes invisible to the
caller, at the cost of a copy. `unmodifiableList` wraps: free, but a *live*
view that mutates under the caller as internals change, and the internals
remain mutable through the original reference. Choose by whether callers may
retain the result.

**★ Why do records expose all their state — isn't that anti-encapsulation?**
A record's contract *is* its data (a transparent carrier); construction
still validates, fields are still `private final`, and there are no setters.
The design question is upstream: whether the type should be a data carrier
or a behaviour-owning domain object.

**★ What makes a `public static final` constant a binary-compatibility trap?**
Compile-time constants are inlined into every consumer's class file.
Changing the value changes nothing for already-compiled consumers until they
recompile — so constants that may ever change should be methods or
non-constant fields.

**When is a setter the right design?**
When the field is genuinely an independent, freely mutable property with no
invariant coupling it to other fields — configuration beans, UI state. State
that participates in a lifecycle wants transition methods instead.

**How do you keep a domain model encapsulated when frameworks demand JavaBeans accessors?**
Boundary DTOs: records (or beans) shaped for the framework at the edges,
mapped to/from the encapsulated domain type — or framework field-access
configuration. The domain type's API stays behavioural.

---

← Prev: [The four levels, precisely](01-the-four-levels.md) · Next → [Boundaries at scale](03-boundaries-at-scale.md)
