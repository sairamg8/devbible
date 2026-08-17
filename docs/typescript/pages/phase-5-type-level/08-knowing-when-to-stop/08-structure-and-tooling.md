---
title: "Tables, interfaces and base types"
sidebar_label: "08 · Tables, interfaces, base types"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript wiki, *Performance*** — *Preferring
> Interfaces Over Intersections* and *Preferring Base Types Over Unions* are **quoted
> verbatim**. **No sandbox, no console block.** The compile-time consequences are named
> but **not developed here**: performance is **09 · Type-level performance** *(not
> written yet)*. Anything not attributed is **judgement**.

Three structural replacements. These are the options people forget exist, which is how a
computed type ends up carrying work that a plain interface would carry better —
and each of them improves the error message *and* the build, which makes them easy
decisions.

## 1 · A lookup interface, indexed by the kind

The replacement for a long conditional chain **and** for a long overload set:

```ts
// was: K extends "user" ? User : K extends "order" ? Order : … (nine branches)
interface ResponseByKind {
  user: User;
  order: Order;
  invoice: Invoice;
  // …
}

declare function get<K extends keyof ResponseByKind>(
  kind: K,
): ResponseByKind[K];
```

Everything good here follows from it being **data instead of control flow**:

- **One place to add a kind** — a property, not a branch and not a signature.
- **The constraint is `keyof` the table**, so a typo fails at the call site with the valid
  keys named — [chunk 02](./02-three-designs-one-mistake.md)'s version B, for free.
- **Indexed access is not a conditional.** `ResponseByKind[K]` is a lookup
  ([phase 3 · indexed access types](../../phase-3-generics/06-indexed-access-types.md)),
  so there is no branch order to get wrong and no fallback to forget.
- **It is documentation.** The table *is* the list of kinds, in one hoverable place, and
  jump-to-definition works on every entry.

🔴 **If you take one replacement from this topic, take this one.** A large share of
real-world conditional chains are lookup tables written as control flow.

📌 **It composes with the module system.** An `interface` table can be extended by
declaration merging, which is how libraries let consumers register their own kinds
([phase 4 · module augmentation](../../phase-4-classes-declarations/01-module-augmentation/README.md)).
A `type` alias cannot do that — so if the table is an extension point, it must be an
interface
([declaration merging](../../phase-4-classes-declarations/05-interface-declaration-merging/README.md)).

## 2 · `interface … extends` instead of an intersection

The wiki states this as performance guidance, and it is readability guidance too:

> Interfaces create a single flat object type that detects property conflicts

> Type relationships between interfaces are also cached, as opposed to intersection types
> as a whole.

> For this reason, extending types with `interface`s/`extends` is suggested over creating
> intersection types.

```ts
// intersection: printed as A & B & C; conflicts silently become impossible members
type Row = Base & Timestamps & { name: string };

// interface: one flat object in every message, and conflicts are reported
interface Row2 extends Base, Timestamps { name: string }
```

**Why this belongs in a "when to stop" topic:** the most common complaint about derived
types is *"the error says `A & B & C` instead of the shape"*. If the type can be an
interface, that complaint disappears with no type-level cleverness at all — and `Prettify`
becomes unnecessary rather than merely available
([topic 01 · chunk 01](../01-mapped-types/01-the-loop.md)).

⚠️ **The conflict half is a correctness benefit, not a formatting one.** Two intersected
types that declare the same property with incompatible types produce a member whose type
is the intersection of both — frequently `never` — and nothing warns you. An interface
reports it.

⚠️ **The limit is real:** an interface cannot extend something that is not statically an
object type, so a genuinely computed shape may have to stay a `type`. Then name it and
flatten it at the boundary — back to [chunk 03](./03-four-fixes.md)'s fixes.

## 3 · A base type instead of a wide union

> One way to avoid this is to use subtypes, rather than unions.

The wiki's reasoning is about compile time —

> to eliminate redundant members from a union, the elements have to be compared pairwise,
> which is quadratic

— and the readability consequence follows directly: **a union prints every member**, so a
fifteen-member union is a fifteen-line error. A base type with members extending it prints
one name.

```ts
// wide union: every error lists all of them
type Shape = Circle | Square | Triangle | /* … */;

// base type: errors talk about Shape, and narrowing still works on the discriminant
interface ShapeBase { kind: string }
interface Circle extends ShapeBase { kind: "circle"; r: number }
```

⚠️ **Do not read this as "avoid discriminated unions".** They are
[chunk 06](./06-what-to-write-instead.md)'s recommendation and they remain right at
ordinary sizes. The guidance is about *wide* unions — especially ones assembled by
computation — where the member count makes both the pairwise work and the printed output
the problem.

📌 **The two pressures point the same way at every size**, which is unusual: fewer, named,
flatter types are both faster to check and shorter to print. When a design decision is
hard, it is usually because those two disagree; here they do not.

## Gotchas

**Symptom:** A nine-branch conditional chain keeps growing.
**Cause:** A lookup table written as control flow.
**Fix:** An interface keyed by the kind plus `T[K]` indexed access. One property per kind,
and the constraint becomes `keyof` the table.

**Symptom:** Errors print `A & B & C` instead of the merged object.
**Cause:** An intersection — the compiler prints it structurally.
**Fix:** `interface … extends` where the parts are statically object types.

**Symptom:** Two intersected types declare a property with incompatible types and nothing
complained.
**Cause:** Intersections do not report conflicts; the member becomes the intersection of
both, often `never`.
**Fix:** Interfaces. *"Interfaces create a single flat object type that detects property
conflicts"* is the wiki's exact phrasing.

**Symptom:** A property on an intersected type is `never` and no line of code says so.
**Cause:** The same conflict, one step further along — you find it when a caller cannot
assign anything to it.
**Fix:** Same fix, and it is worth grepping for intersections of two large object types
when this shows up.

**Symptom:** A fifteen-member union makes every error fifteen lines long.
**Cause:** Unions print every member, and members are compared pairwise.
**Fix:** A base type the members extend, or group them behind a discriminant. Do not
compute the union.

**Symptom:** Declaration merging into a lookup table stopped working after a refactor.
**Cause:** The table was changed from an `interface` to a `type`; only interfaces merge.
**Fix:** Keep an extension point as an `interface`.

**Symptom:** The lookup table is an interface and a consumer's augmentation is being
ignored.
**Cause:** The augmentation is not reaching the right declaration — a module-resolution
problem, not a type-level one.
**Fix:** [Phase 4 · why it did not load](../../phase-4-classes-declarations/01-module-augmentation/03-why-it-did-not-load.md)
is the checklist.

**Symptom:** Converting an intersection to an interface produced new errors.
**Cause:** They were always there, hidden by the intersection's silent conflict handling.
**Fix:** Fix them. This is the recommendation working.

## Interview questions

**★ What single structural change replaces most long conditional chains?**
A lookup interface keyed by the discriminant plus indexed access — `ResponseByKind[K]` with
`K extends keyof ResponseByKind`. It turns control flow into data: one property per kind
instead of a branch, a call-site error naming the valid keys, no branch order to get wrong,
no fallback to forget, and a hoverable table that documents the set. It also extends by
declaration merging, which is how libraries let consumers register kinds.

**★ Why does the wiki recommend `interface … extends` over intersections, and why does that
matter for readability?**
Its stated reasons are that *"Interfaces create a single flat object type that detects
property conflicts"* and that *"Type relationships between interfaces are also cached, as
opposed to intersection types as a whole"*. The readability consequence is immediate: the
most common complaint about derived types is that errors print `A & B & C` rather than the
merged shape, and an interface prints one flat object. It also converts a silent conflict —
two incompatible declarations intersecting to `never` — into a reported one.

**★ What is wrong with a wide union, and what replaces it?**
Two things with one cause. Redundant members are eliminated by comparing them pairwise,
*"which is quadratic"*, and every error message prints every member. A base type the members
extend gives one name in messages and less work in the checker. This is not an argument
against discriminated unions at ordinary sizes; it is an argument against wide ones,
especially computed ones.

**Why must a lookup table be an `interface` if consumers extend it?**
Because only interfaces merge. A `type` alias is a single declaration and a second one is a
duplicate-identifier error, so a library that wants callers to register their own kinds must
expose an interface — that is the whole mechanism behind the augmentable registries you see
in framework typings.

**Converting an intersection to an interface produced new errors. What happened?**
They were always true and the intersection was hiding them. Incompatible property
declarations intersect to an impossible type rather than being reported, so the mismatch
surfaces later as "nothing can be assigned to this field". The interface reports it at the
declaration, which is the recommendation working rather than a regression.

**These come from a performance page — why quote them in a readability topic?**
Because they are the two places where the compile-time and readability arguments coincide,
which makes them easy decisions rather than trade-offs. Flat object types print better and
cache better; a base type prints shorter and skips quadratic pairwise elimination. The
compile-time half is developed in **09 · Type-level performance** *(not written yet)*; what
belongs here is that the better error message comes free.

---

← Prev: [07 · Overloads, and the handbook's two warnings](./07-overloads-and-the-handbook.md) ·
[Topic index](./README.md) · Next → [09 · The boundary and the generator](./09-the-boundary-and-the-generator.md)
