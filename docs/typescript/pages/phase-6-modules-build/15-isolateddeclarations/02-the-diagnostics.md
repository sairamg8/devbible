---
title: "The diagnostics — all seventeen"
sidebar_label: "02 · The diagnostics"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 — every code and message below is quoted from the compiler's
> own numbered diagnostic table in the installed **TypeScript 5.9.3** build, and
> 🔴 `TS9005`/`TS9006`'s **sole call site** was located directly in
> `transformDeclarationsForJS`. **No sandbox, no console blocks.**

Seventeen errors, and they are worth reading as a group rather than meeting one
at a time — because every one of them is the same question in a different
syntactic position: *could a tool write this file's declaration reading only this
file?*

## The annotation requirements

The ones you will meet constantly. Each names the position that needs a type:

| Code | Message |
|---|---|
| **9007** | *"Function must have an explicit return type annotation with `--isolatedDeclarations`."* |
| **9008** | *"Method must have an explicit return type annotation with `--isolatedDeclarations`."* |
| **9009** | *"At least one accessor must have an explicit type annotation with `--isolatedDeclarations`."* |
| **9010** | *"Variable must have an explicit type annotation with `--isolatedDeclarations`."* |
| **9011** | *"Parameter must have an explicit type annotation with `--isolatedDeclarations`."* |
| **9012** | *"Property must have an explicit type annotation with `--isolatedDeclarations`."* |

📌 **`TS9009` says *"at least one"*** — a getter/setter pair needs only one
annotation, because the other is derivable from it. A small mercy, and it tells
you the rule is genuinely about *sufficiency*, not about annotating everything.

## The inference refusals

These fire where an annotation is not the issue — the *expression* cannot be
reduced to a written-down type without evaluating it:

| Code | Message |
|---|---|
| **9013** | *"Expression type can't be inferred with `--isolatedDeclarations`."* |
| **9014** | *"Computed properties must be number or string literals, variables or dotted expressions with `--isolatedDeclarations`."* |
| **9015** | *"Objects that contain spread assignments can't be inferred with `--isolatedDeclarations`."* |
| **9016** | *"Objects that contain shorthand properties can't be inferred with `--isolatedDeclarations`."* |
| **9017** | *"Only const arrays can be inferred with `--isolatedDeclarations`."* |
| **9018** | *"Arrays with spread elements can't inferred with `--isolatedDeclarations`."* |
| **9038** | *"Computed property names on class or object literals cannot be inferred with `--isolatedDeclarations`."* |

⚠️ **`TS9016` is the one that surprises people.** Shorthand properties —
`{ x, y }` — look completely ordinary, and they are refused because resolving
what `x` *is* means looking outside the object literal. The fix is an annotation
on the containing declaration, not a rewrite to `{ x: x, y: y }`.

📌 **`TS9018`'s message has a typo in the compiler** — *"can't inferred"*. Quoted
as-is; do not "correct" it when searching for it.

## The structural refusals

Patterns that cannot be declared per-file at all:

| Code | Message |
|---|---|
| **9019** | *"Binding elements can't be exported directly with `--isolatedDeclarations`."* |
| **9020** | *"Enum member initializers must be computable without references to external symbols with `--isolatedDeclarations`."* |
| **9021** | *"Extends clause can't contain an expression with `--isolatedDeclarations`."* |
| **9022** | *"Inference from class expressions is not supported with `--isolatedDeclarations`."* |
| **9023** | *"Assigning properties to functions without declaring them is not supported with `--isolatedDeclarations`. Add an explicit declaration for the properties assigned to this function."* |
| **9025** | *"Declaration emit for this parameter requires implicitly adding `undefined` to its type. This is not supported with `--isolatedDeclarations`."* |
| **9026** | *"Declaration emit for this file requires preserving this import for augmentations. This is not supported with `--isolatedDeclarations`."* |
| **9037** | *"Default exports can't be inferred with `--isolatedDeclarations`."* |
| **9039** | *"Type containing private name '{0}' can't be used with `--isolatedDeclarations`."* |

🔴 **`TS9021` and `TS9022` are the pair that makes the mixin factory pattern
unbuildable**, and this corpus already met them:
`phase-4-classes-declarations/14-mixins/05-the-cost-in-the-build.md` quotes both.
A mixin is `class extends Base(…)` — an expression in the extends clause — and
its return type is inferred from a class expression. Both refusals at once, and
there is no annotation that fixes it, because the *shape* is the problem.

📌 **`TS9025` is subtle and worth a second read.** A parameter with a default and
no annotation gets `undefined` added to its declared type — which the compiler
can only know by inspecting the initialiser. Annotate the parameter and it goes
away.

## 🔴 `TS9005` and `TS9006` are **not** `isolatedDeclarations` diagnostics

They sit in the same numeric range and read as though they belong:

```text
TS9005: Declaration emit for this file requires using private name '{0}'.
        An explicit type annotation may unblock declaration emit.
TS9006: …private name '{0}' from module '{1}'. An explicit type annotation may
        unblock declaration emit.
```

**Neither mentions the flag**, and that is the tell. Their **sole call site in
the 5.9.3 build is `transformDeclarationsForJS`** — the *JavaScript* declaration
path. Seeing one means `allowJs` + `declaration`, and the fix is a JSDoc
annotation.

⚠️ **One page in this corpus cites `TS9005` for a `.ts` mixin** —
`phase-4-classes-declarations/14-mixins/05-the-cost-in-the-build.md`, as the
sibling of `TS4060`. That grouping is reasonable — both are declaration-emit
"private name" diagnostics — but `TS9005` reaches only the JavaScript path, so
it would not fire for the `.ts` example given. `TS4060` alone carries that
argument. The file belongs to another lane and has been left alone.

📌 **The general lesson:** a diagnostic's number range does not tell you which
feature raises it. Phase 10's error-code work makes the same point from the other
direction — the 90xxx range is mostly not errors at all.

## The 90xx range is mostly quick-fix labels

`TS9027`–`TS9036` are not diagnostics you can hit:

> *"Add a type annotation to the variable {0}."* · *"Add a return type to the
> function declaration."* · *"Add a return type to the get accessor
> declaration."* · *"Add a type to parameter of the set accessor declaration."* ·
> 🔴 *"Add satisfies and a type assertion to this expression (satisfies T as T)
> to make the type explicit."* · *"Move the expression in default export to a
> variable and add a type annotation to it."*

They are the **editor's fix-menu text**, which matches
[phase 10's finding](../../phase-10-strictness/10-the-error-codes/README.md) that
242 codes in the 90xxx/95xxx ranges are quick-fix labels rather than errors.

🔴 **That matters practically:** every annotation requirement in this topic has a
**one-keystroke automated fix**, and `TS9035` shows the compiler will even
suggest `satisfies T as T` for an expression it cannot infer. Adoption is much
less manual than the diagnostic count suggests —
[chunk 03](./03-adopting-it.md) leans on exactly this.

## Gotchas

**Symptom:** `TS9016` on an object literal using shorthand properties.
**Cause:** Resolving `{ x }` means looking outside the literal.
**Fix:** Annotate the containing declaration. Expanding to `{ x: x }` does not
help.

**Symptom:** `TS9017` on an exported array.
**Cause:** Only `const` arrays can be inferred.
**Fix:** `as const`, or an explicit type.

**Symptom:** A mixin factory cannot be made to compile under the flag.
**Cause:** `TS9021` **and** `TS9022` — an expression in `extends`, and inference
from a class expression.
**Fix:** No annotation fixes it; the pattern is the problem. Phase 4's mixins
page covers the alternatives.

**Symptom:** `TS9025` on a parameter that looks fully typed.
**Cause:** It has a default and no annotation, so `undefined` would be added
implicitly.
**Fix:** Annotate the parameter.

**Symptom:** Searching for `TS9018`'s message finds nothing.
**Cause:** The compiler's string is *"can't inferred"* — a typo, quoted here
as-is.
**Fix:** Search the code, not the prose.

**Symptom:** `TS9005` appears and `isolatedDeclarations` is blamed.
**Cause:** It is the JavaScript declaration path — `allowJs` + `declaration`.
**Fix:** A JSDoc annotation. The flag is unrelated.

**Symptom:** The seventeen errors look like an enormous amount of manual work.
**Cause:** Counting diagnostics rather than fixes.
**Fix:** `TS9027`–`TS9036` are the quick-fix labels for them. Most are one
keystroke.

**Symptom:** An accessor pair is annotated twice "to be safe".
**Cause:** Misreading `TS9009`.
**Fix:** *"At least one"* — the other is derived.

## Interview questions

**★ What do all the `isolatedDeclarations` diagnostics have in common?**
Each asks the same question in a different syntactic position: could a tool write
this file's declaration reading only this file? They split into annotation
requirements (9007–9012), inference refusals where no annotation would help the
expression (9013–9018, 9038), and structural refusals where the pattern itself
cannot be declared per file (9019–9026, 9037, 9039).

**★ Why is a shorthand property (`{ x, y }`) refused?**
`TS9016` — resolving what `x` is requires looking outside the object literal, so
the declaration is not derivable from this file alone. The fix is an annotation
on the containing declaration.

**★ Why can't a mixin factory work under this flag?**
`TS9021` (an expression in the `extends` clause) and `TS9022` (inference from a
class expression) fire together. No annotation resolves it — the pattern's shape
is what cannot be declared per file.

**★ Are `TS9005` and `TS9006` `isolatedDeclarations` errors?**
No, despite the number range. Neither message mentions the flag, and their sole
call site is `transformDeclarationsForJS` — the JavaScript declaration path. They
mean `allowJs` plus `declaration`, and the fix is JSDoc.

**What is `TS9027`–`TS9036`?**
Quick-fix menu labels, not errors — the same pattern phase 10 found across the
90xxx/95xxx ranges. It means most annotation requirements have an automated fix,
including a suggested `satisfies T as T` for un-inferrable expressions.

**What does `TS9009`'s "at least one" tell you about the rule?**
That it is about *sufficiency*, not about annotating everything. A getter/setter
pair needs one annotation because the other follows from it.

**Why does `TS9025` fire on a parameter with a default?**
Because the declaration would implicitly add `undefined` to its type, which the
compiler can only determine from the initialiser. Annotating the parameter states
it instead.

---

← Prev: [01 · What it requires, and why](./01-what-it-requires-and-why.md) · Next → [03 · Adopting it](./03-adopting-it.md)
