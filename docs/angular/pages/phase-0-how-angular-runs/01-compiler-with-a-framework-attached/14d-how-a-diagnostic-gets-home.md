---
title: "A comment is the return address — an error inside machine-written code reaches line 12 of your HTML through markers embedded in the generated string, and anything whose position cannot be mapped back is dropped rather than shown somewhere absurd"
sidebar_label: "14d · How a diagnostic gets home"
sidebar_position: 14.3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/typecheck/src/diagnostics.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/typecheck/src/diagnostics.ts),
> [`packages/compiler/src/typecheck/type_check_block.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler/src/typecheck/type_check_block.ts).
> Documentation-validated; **no sandbox run** — every code block is source read from a named file.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**[14c](14c-the-type-check-file-and-how-errors-get-home.md) put the block in a file you cannot open.
This chunk is the return journey. TypeScript produces a diagnostic carrying a position in
machine-written text; what you need is a squiggle on line 12 of an HTML file that `tsc` has never
heard of. The bridge is a comment. That is not a simplification — the source map for template
diagnostics is literally comments embedded in the generated string, for a reason that follows from
every other decision in this chunk family, and the design's most surprising property falls straight
out of it: when the comment cannot be read, the error is not reported at a best guess. It is thrown
away.**

## The return address: `/*id*/` at the top of every block

The very first thing `generateTypeCheckBlock` puts in the string is a comment, and it is not
decoration:

```ts
const thisParamStr = `this: ${ctxRawType.print()}${typeArgsStr}`;
// …
const bodyStr = `{\n${statements.join('\n')}\n}`;
const funcDeclStr = `function ${name}${typeParamsStr}(${thisParamStr}) ${bodyStr}`;

return `/*${meta.id}*/\n${funcDeclStr}`;
```

That `id`, together with the comments the generator embeds through the body, is what makes the round
trip possible. A diagnostic TypeScript produces carries a position in the generated file; the
comments are what let Angular work out which piece of which template that position came from.

## Why comments, and not a real source map

This looks like a workaround and it is actually the only available channel. Follow the constraints
from [14](14-template-type-checking.md): the design's entire premise is that the generated text is
handed to an **unmodified** TypeScript compiler. Angular does not own `tsc`'s diagnostic pipeline. It
cannot attach side-channel metadata to a `ts.Diagnostic`, cannot ask the checker to carry an extra
field through, and cannot post-process at a layer that still knows which template statement produced
which node.

What it *can* do is put information into the source text, because the source text is the one thing
that goes in, gets checked, and comes back referenced by position. A diagnostic's position is a
number into that text; the comments nearest that number say where the text came from. The source map
is made of comments because comments are the only thing that survives the trip.

🔴 **This is the same argument as "the block is a string, not an AST", one level down.** Both
decisions come from refusing to fork or wrap the TypeScript compiler. Every awkwardness in this area
— the comment map, the artefact suppressions, the drop — is the price of that refusal, and the thing
bought with it is that Angular's template type system is exactly as good as TypeScript's, forever,
with no second implementation to maintain.

## The drop: what happens when the address cannot be read

The translator states its own contract, verbatim:

```ts
/**
 * Attempts to translate a TypeScript diagnostic produced during template type-checking to their
 * location of origin, based on the comments that are emitted in the TCB code.
 *
 * If the diagnostic could not be translated, `null` is returned to indicate that the diagnostic
 * should not be reported at all. This prevents diagnostics from non-TCB code in a user's source
 * file from being reported as type-check errors.
 */
export function translateDiagnostic(
```

🔴 **Read the second paragraph twice, because it is the surprising half.** An untranslatable
diagnostic is not reported at a best-guess location, and it is not reported against the synthetic
file either. It is **returned as `null` and dropped**.

The stated reason is protective, and it is a good one. The type-checking program contains your real
source files as well as the shims — it has to, because the generated code refers to your types.
Without this filter, an ordinary TypeScript error in your own `.ts` could be picked up by the
template type-checking pass and re-reported a second time as a template error, at which point every
type error in your project would appear twice with one copy pointing somewhere absurd.

The side effect is that the pass is **allowed to be silent** about anything it could not place. That
is a deliberate trade in favour of never showing a nonsense location. It is worth knowing about, and
it is worth also knowing that it is rare compared to the far more common cause of the same symptom —
a check that is simply off, so no statement was ever generated to be wrong. That case is **[14e · The errors that never arrive](14e-the-errors-that-never-arrive.md)**.

## The whole route, end to end

1. The template is translated into statements and appended to a `_tcbN` function, which is appended
   to the shared shim — or generated inline when the component's type is not referenceable, per
   [14c](14c-the-type-check-file-and-how-errors-get-home.md).
2. TypeScript checks that file like any other and produces diagnostics with positions in generated
   text.
3. The artefact filter drops four codes that are complaints about the generator (**14e** *(not
   written yet)*).
4. `translateDiagnostic` maps what remains back through the embedded comments to a position in your
   template, and drops anything it cannot map.
5. What survives is what you see.

Steps 3 and 4 are both *lossy on purpose*. That is the single most useful thing to hold on to about
this pipeline: it is designed to under-report rather than to mislead.

## Gotchas

**★ Symptom: a build error names a file ending in `.ngtypecheck.ts`.** Cause: a diagnostic reached
the surface still carrying a position in generated text, which means step 4 did not map it — a normal
template error is translated before you ever see it. Fix: treat it as a *translation or generation*
problem rather than a template error, and do not go looking for the file, because it does not exist
on disk. Reduce the template until the message moves; the construct you removed is the one worth
reporting upstream.

**★ Symptom: the squiggle sits on the wrong part of a long interpolation.** Cause: the mapping is
only as fine-grained as the comments the generator embedded, and a compound expression tends to
become a single generated statement. Fix: give each part its own statement, which gives each part its
own position:

```html
<!-- before: one statement, one position, and the error lands on the whole thing -->
<p>{{ user.profile.displayName ?? user.email.split('@')[0] }}</p>

<!-- after: two statements, and the error lands on the half that is actually wrong -->
@let fallback = user.email.split('@')[0];
<p>{{ user.profile.displayName ?? fallback }}</p>
```

**★ Symptom: a real type error in one of your own `.ts` files is reported twice, once sensibly and
once pointing at a template.** Cause: the untranslatable-drop filter is exactly what is meant to
prevent this, so a duplicate means a diagnostic from non-block code was mapped when it should not
have been. Fix: nothing you can configure — this is a translation bug worth reporting upstream with
the construct that triggers it. It is worth recognising precisely because the design intends the
opposite.

**Symptom: an error appears at the top of a template, on nothing in particular.** Cause: the position
mapped back to the block's own `/*id*/` header rather than to a statement inside it, which is what
you get when the diagnostic concerns the generated function's signature rather than its body — most
often the `this` parameter, meaning the component's own type. Fix: read it as an error about the
component class, not about any line of the template. A component whose class does not type-check
produces template diagnostics that have nowhere sensible to point.

**Symptom: template diagnostics vanish entirely after an editor restart but the build still reports
them.** Cause: not this pipeline. The mapping is deterministic and identical in both; a
build-versus-editor difference is about *which components got blocks generated at all*, which is
[14c](14c-the-type-check-file-and-how-errors-get-home.md)'s inline-TCB story. Fix: check whether the
component is exported before suspecting anything about diagnostics.

## Interview questions

**★ A TypeScript diagnostic is produced inside generated code. How does it end up pointing at a line
in an HTML file?**
The generator writes a `/*id*/` comment as the first thing in every block and embeds comments through
the generated text; `translateDiagnostic` maps a position in the generated file back through those
comments to a position in the original template. The important half is what happens when it cannot:
it returns `null` and the diagnostic is **dropped entirely** rather than reported at a guessed
location. The doc comment gives the reason — the type-checking program also contains your real source
files, and without the filter an ordinary error in your own `.ts` would be re-reported as a template
error.

**★ Why is the source map for template diagnostics made of comments rather than a real source map?**
Because the generated text has to survive being handed to an unmodified TypeScript compiler. Angular
does not control `tsc`'s diagnostic pipeline, so it cannot attach side-channel metadata to a
diagnostic and have it come back. The only thing that reliably travels with the code and returns
referenced by position is the text itself, so the metadata goes into the text as comments. It is the
same constraint that makes the block a string rather than a synthesised AST, one level down.

**What stops a type error in your own `.ts` file from being reported twice?**
The untranslatable-diagnostic drop. The type-checking program necessarily contains your real source
files alongside the shims, because the generated code refers to your types, so it will produce
diagnostics about them too. Those positions do not map back to any template, `translateDiagnostic`
returns `null`, and they are discarded — leaving the main program as the single reporter of errors in
your own source.

**Characterise the failure mode this pipeline was designed to have.**
Under-reporting rather than misdirection. Two of the five steps discard diagnostics on purpose: the
artefact filter drops four specific codes, and the translator drops anything it cannot place. Neither
one ever falls back to a guessed location. The design would rather miss an error than point you at a
line that has nothing to do with it — which is worth knowing when you are trying to decide whether a
green build means your template is correct. It does not; it means nothing survived to be reported.

---

← Prev: [14c · The type-check file](14c-the-type-check-file-and-how-errors-get-home.md) · Index: [Topic index](README.md) · Next → [14e · The errors that never arrive](14e-the-errors-that-never-arrive.md)
