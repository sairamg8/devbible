---
title: "The type-check block lives in a file that is in your program and not on your disk — one shared shim per source file, hoisting what several blocks need, with an inline fallback for any component whose type that shim cannot import"
sidebar_label: "14c · The type-check file"
sidebar_position: 14.2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/typecheck/src/type_check_file.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/typecheck/src/type_check_file.ts),
> [`packages/compiler-cli/src/ngtsc/core/src/compiler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/src/compiler.ts),
> [`packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts),
> [`goldens/public-api/compiler-cli/error_code.api.md`](https://github.com/angular/angular/blob/v22.1.5/goldens/public-api/compiler-cli/error_code.api.md) —
> and the [v22.0.0 CHANGELOG](https://github.com/angular/angular/blob/main/CHANGELOG.md).
> Documentation-validated; **no sandbox run** — every code block is source read from a named file.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**[14](14-template-type-checking.md) established that the type-check block is a string of generated
TypeScript. This chunk answers the first of the two questions that leaves open: where does the
string go? The answer is a synthetic file that is real to TypeScript and imaginary to everything
else — in your `ts.Program`, never on your disk, shared by every component whose type it is able to
import. That last clause is the whole of the interesting behaviour. A component the shim cannot
import cannot be checked from the shim, so its block has to be written into your own source file
instead, and whether that is even possible depends on who is running the compiler. This is why a
missing `export` keyword has, for several Angular versions, been the difference between a template
your build checks and one your editor silently skips.**

## One shim per source file, in the program, never on disk

[13](13-where-the-compiler-runs-ngtsc.md) introduced the `.ngtypecheck.ts` shims and made the point
that they exist in *both* the main program and the type-checking program, for a performance reason
that has nothing to do with type checking: TypeScript only reuses a program's work when the file
sets match, so the main program is padded with the same synthetic files. This chunk is about what
goes inside them.

The class is `TypeCheckFile`, and its doc comment states the design in two sentences, verbatim:

```ts
/**
 * An `Environment` representing the single type-checking file into which most (if not all) Type
 * Check Blocks (TCBs) will be generated.
 *
 * The `TypeCheckFile` hosts multiple TCBs and allows the sharing of declarations (e.g. type
 * constructors) between them. Rather than return such declarations via `getPreludeStatements()`, it
 * hoists them to the top of the generated `ts.SourceFile`.
 */
export class TypeCheckFile extends Environment {
```

Three load-bearing words. **"Multiple"** — the file is not per component, it is a shared container,
and every component whose block can go in it is appended to the same source file. **"Hoists"** —
declarations that more than one block needs are emitted once at the top rather than repeated per
block. And **"most (if not all)"**, which is the doc comment quietly admitting the exception this
page is really about.

The hoisted declarations are chiefly *type constructors*. A type constructor is a synthesised
generic function whose only job is to let TypeScript infer a directive's type parameters from the
inputs bound to it — you cannot write `new SomeDirective<T>()` in generated code and get inference
from a property bag, so the compiler generates a function that has the right signature to produce
it. A large application has many components using the same handful of directives. One copy per file
rather than one copy per block is the difference between a shim TypeScript checks quickly and one it
does not.

Each block inside that file is named, and the prefix is a constant:

```ts
export const TCB_FUNCTION_PREFIX = '_tcb';
```

So a stack of generated functions named `_tcb1`, `_tcb2`, `_tcb3` accumulates in one synthetic file,
each taking the component it checks as its `this` parameter, with the shared declarations above
them. That is the whole storage model.

🔴 **The consequence people trip over: these files are real to TypeScript and unreal to everyone
else.** They are in the `ts.Program`, so `tsc` checks them, they contribute to compile time, and
they can appear in a TypeScript-level error message. They are not on disk, so you cannot open one,
cannot log from one, and cannot put a breakpoint in one. There is no build flag that dumps them —
`shouldEmit` is false for the shim, which is the same mechanism that keeps them out of your `dist`.

## When the block cannot go in the shared file

The shared file is the fast path, not the only path. The shim is **a separate module**, so it can
only refer to a type it is able to *import*. A component that is not exported, or whose type is
otherwise not referenceable from another file, cannot be the `this` parameter of a function living
elsewhere — so its block has to be written where the type is already in scope, which is your own
source file. That is an **inline** type-check block. The same argument applies one level down to a
type constructor for a non-referenceable directive.

Both cases have an error code, because generating inline is not always available:

- **NG8900 `INLINE_TCB_REQUIRED`** — *"The template type-checking engine would need to generate an
  inline type check block for a component, but the current type-checking environment doesn't support
  it."*
- **NG8901 `INLINE_TYPE_CTOR_REQUIRED`** — *"The template type-checking engine would need to generate
  an inline type constructor for a directive or component, but the current type-checking environment
  doesn't support it."*

The capability switch is one line in `getTypeCheckingConfig`:

```ts
useInlineTypeConstructors = this.programDriver.supportsInlineOperations;
```

The `programDriver` is the abstraction over **who is running the compiler**. A batch `ngc` build owns
the program and can rewrite a source file's contents before checking it, so it supports inline
operations. The language service, historically, could not — it is servicing a live editor buffer,
and synthesising declarations into the user's own file is a far more invasive act there.

🔴 **This is the same non-exported-symbol problem as
[10c](10c-symbols-the-compiler-cannot-resolve.md), arriving through a completely different door.**
There, an unexported symbol broke metadata evaluation at compile time. Here it costs you the shared
file and, on older versions, editor type-checking entirely. The lesson generalises past both:
**exporting the classes Angular compiles is not a style preference, it is what keeps you on every
fast path the compiler has.**

**v22 narrowed the gap.** The 22.0.0 CHANGELOG records a language-service change, verbatim:
*"Typecheck templates which would require inline typecheck blocks"* (commit `4f9c824dd9`). Before
that, a component needing an inline TCB was one your editor silently declined to check while your
build checked it fine — the IDE-versus-build divergence [14](14-template-type-checking.md) opens
with, in its purest form. If you are on v21 or earlier and a component's template errors appear only
in CI, an unexported component class is the first thing to check.

## What goes wrong is a property of the environment, not a setting

Worth stating explicitly because it is where people go looking for a flag that does not exist.
Whether inlining is possible is decided by `programDriver.supportsInlineOperations` — a capability
of the tool hosting the compiler. There is no compiler option that grants a driver the ability to
rewrite your source. So NG8900 and NG8901 are never fixed by configuration; they are fixed by making
the type referenceable, or by using a different tool.

The routing of the diagnostics *out* of these blocks — the return address, the codes Angular throws
away, and the ones it silently drops — is **[14d · How a diagnostic gets home](14d-how-a-diagnostic-gets-home.md)**.

## Gotchas

**★ Symptom: templates type-check in `ng build` but the editor shows no template errors at all for
one particular component.** Cause: that component needs an inline TCB — most often because the class
is not exported — and your Angular version's language service does not support inline operations.
Fix: export the class. It is a one-word change and it moves the component onto the shared-file path
that both the build and the editor use:

```ts
// before — the TCB cannot live in the shared shim, because the shim cannot import this type
@Component({selector: 'app-user-card', template: '{{ user.nmae }}'})
class UserCard {
  user = {name: 'Ada'};
}

// after — referenceable, so the block joins _tcb1, _tcb2, … in the shared file
@Component({selector: 'app-user-card', template: '{{ user.nmae }}'})
export class UserCard {
  user = {name: 'Ada'};
}
```

**★ Symptom: NG8901 `INLINE_TYPE_CTOR_REQUIRED` names a directive you did not write.** Cause: the
directive is in a library, and its published `.d.ts` declares a generic type the shared file cannot
build a type constructor for without inlining. Fix: this is a library packaging problem, not yours
to fix in the template. Report it upstream; the local workaround is to do the inference in ordinary
TypeScript instead, by binding through a typed intermediate in your component class:

```ts
// instead of letting the template infer T from the binding, fix it in the class
export class ReportPage {
  // the type constructor would have inferred this; now nothing has to
  readonly rows: readonly ReportRow[] = [];
}
```

**★ Symptom: NG8900 appears in a tool that is not `ng build`.** Cause: that tool's `programDriver`
reports `supportsInlineOperations: false`, and your component forced the inline path. Fix: make the
type referenceable — export the class — rather than looking for a flag. The capability is a property
of the environment and no compiler option changes it.

**★ Symptom: type-checking time grows much faster than your component count.** Cause: growth is in
*total template statements*, not components. Hoisting shares the type constructors, but the blocks
themselves all accumulate in one `ts.SourceFile`, and each is a function with one statement per
binding, reference, variable and directive instance. Two hundred small components cost less than
twenty large ones. Fix: there is no type-checking-specific tuning knob. Reduce statements — split
large templates, and prefer one computed value in the class over the same expression repeated across
many bindings.

**★ Symptom: you want to see the generated block to understand an error, and cannot find a flag that
prints it.** Cause: there is none. The shim is synthesised into the program with `shouldEmit` false;
it is not written at any point in the build. Fix: reason from the translation rules instead —
[14b](14b-how-each-construct-is-translated.md) gives the TypeScript sentence each construct becomes,
which is sufficient to predict the statement that produced any given message.

**Symptom: a `.ngtypecheck` path appears in your coverage report, bundle analysis or lint output.**
Cause: a tool is walking the `ts.Program`'s file list rather than the filesystem, and the shims are
in that list. Fix: exclude anything matching `.ngtypecheck` in that tool's config. The file is not
source, no style rule applies to it, and no coverage number computed over it means anything.

**Symptom: two components in the same file behave differently, one checked from the shim and one
inline.** Cause: inlining is decided per component type, not per file — one exported and one not is
enough to split them. Fix: nothing is broken, but it explains an asymmetry that otherwise looks
impossible. Export both if you want both on the same path.

## Interview questions

**★ Angular generates TypeScript to check templates. Where does the generated code go, and can you
open it?**
It goes into a synthetic `.ngtypecheck.ts` file — one per source file — that `ngtsc` inserts into the
`ts.Program`. It is never written to disk, so you cannot open it, and there is no flag that prints
it. The class managing it, `TypeCheckFile`, is documented as hosting *multiple* type-check blocks and
hoisting declarations shared between them to the top of the file; each block is a function named
`_tcb1`, `_tcb2` and so on, from the `TCB_FUNCTION_PREFIX` constant. There is a second reason the
file exists in the main program too, and it is unrelated to checking: TypeScript only reuses a
program's work across builds when the file sets are identical, so both programs are padded with the
same shims.

**★ What is an inline type-check block, and what forces one?**
The shared shim is a separate module, so it can only refer to types it can import. A component whose
type is not referenceable — most commonly one that is simply not exported — cannot be the `this`
parameter of a function in another file, so its block must be generated inline, into your own source
file. The same applies to a type constructor for a non-referenceable directive. Whether inlining is
possible at all is `programDriver.supportsInlineOperations`; where it is not, you get NG8900 for the
block or NG8901 for the type constructor.

**★ What is a type constructor, and why does the shared file hoist them?**
It is a synthesised generic function that exists so TypeScript can infer a directive's type
parameters from the inputs bound to it — generated code cannot get that inference from a property bag
any other way. They are hoisted because they are shared: many components in one file use the same
directives, and emitting one copy at the top of the shim rather than one per block is what keeps the
shim cheap to check.

**Why did the language service historically type-check fewer templates than the build?**
Because inline generation means rewriting a source file's contents, which a batch compiler that owns
the program can do and an editor service servicing a live buffer could not. Components requiring
inline TCBs were therefore checked by `ng build` and skipped in the editor. v22.0.0 closed this — the
CHANGELOG line is *"Typecheck templates which would require inline typecheck blocks"* — so on v21 and
earlier, a component whose template errors appear only in CI is very often simply not exported.

**Does the type-check file make compilation slower, and where does the cost actually sit?**
Yes, and the cost is proportional to total template statements rather than to component count. Each
block is one function with a statement per binding, reference, variable and directive instance, and
they all accumulate in one `ts.SourceFile` that TypeScript checks like any other. Hoisting shared
type constructors is the mitigation the design does apply. There is no knob for the rest; the lever
is fewer and smaller templates.

**Is there any compiler option that makes NG8900 go away?**
No, and that is the useful thing to know about it. The error reports that inlining was *required* and
*unavailable*, and availability is `programDriver.supportsInlineOperations` — a property of the tool
hosting the compiler, not a setting. The fix is always to remove the requirement by making the type
referenceable, which in practice means exporting the class.

---

← Prev: [14b · How each template construct becomes TypeScript](14b-how-each-construct-is-translated.md) · Index: [Topic index](README.md) · Next → [14d · How a diagnostic gets home](14d-how-a-diagnostic-gets-home.md)
