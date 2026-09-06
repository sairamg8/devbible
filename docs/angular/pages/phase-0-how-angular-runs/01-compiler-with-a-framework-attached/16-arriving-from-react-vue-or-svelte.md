---
title: "All four of React, Vue, Svelte and Angular compile something — the useful question is never whether there is a compile step but what it reads, what it emits, and whether it is allowed to refuse your markup"
sidebar_label: "16 · Arriving from React, Vue or Svelte"
sidebar_position: 16
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-06 against the other frameworks' own documentation —
> [Vue · Rendering Mechanism](https://vuejs.org/guide/extras/rendering-mechanism.html),
> [React · React Compiler](https://react.dev/learn/react-compiler/introduction),
> [Svelte · Overview](https://svelte.dev/docs/svelte/overview) —
> and angular.dev [Ahead-of-time compilation](https://angular.dev/tools/cli/aot-compiler).
> Documentation-validated; **no sandbox run** — nothing was built in any of the four frameworks, and every comparison below is traceable to a quoted sentence.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7**. ⚠️ The React, Vue and Svelte documentation was read at 2026-09; no version is pinned for them here.

**The sentence you will hear, and may have said, is "Angular compiles and React doesn't." It is
wrong, and being wrong about it is expensive, because the interesting differences are all downstream
of it. React has two compile steps. Vue compiles its templates ahead of time and says so in the same
vocabulary Angular uses. Svelte's own documentation calls the framework a compiler in its first
sentence. What separates Angular is not the existence of a build step but three properties of it:
what it reads, what artefact it emits, and — the one that has no equivalent anywhere else — whether
it is permitted to fail your build because of something in your markup.**

## Vue is the closest comparison, not the furthest

Vue compiles templates, and the vocabulary is nearly Angular's. Verbatim, from the Render Pipeline
section: > *"**Compile**: Vue templates are compiled into **render functions**: functions that return
virtual DOM trees."* And the framing of the whole approach: > *"We call this hybrid approach
**Compiler-Informed Virtual DOM**."*

The reasoning behind it is the same argument [08](08-instructions-not-a-virtual-dom.md) makes for
Angular, arrived at from the other side:

> *"The virtual DOM implementation in React and most other virtual-DOM implementations are purely
> runtime: the reconciliation algorithm cannot make any assumptions about the incoming virtual DOM
> tree, so it has to fully traverse the tree and diff the props of every vnode in order to ensure
> correctness."*

> *"In Vue, the framework controls both the compiler and the runtime. This allows us to implement
> many compile-time optimizations that only a tightly-coupled renderer can take advantage of."*

Vue spends that knowledge on three named optimisations — caching static vnodes, patch flags
(*"Bitwise checks are extremely fast"*), and Tree Flattening, which *"greatly reduces the number of
nodes that need to be traversed during virtual DOM reconciliation"*.

🔴 **So the difference is the artefact, not the analysis.** Vue emits a render function that returns
a vnode tree annotated with patch flags; Angular emits a template function that mutates the DOM
through slot-indexed instructions ([07](07-the-create-pass-and-the-update-pass.md)). **Vue keeps the
tree and annotates it. Angular deletes the tree and keeps only the annotations.** Vue's own
"purely runtime" → "compiler-informed" spectrum is exactly the right frame; Angular sits at the far
end of it, past where Vue stopped.

One more thing Vue has that Angular does not: > *"Vue also provides APIs that allow us to skip the
template compilation step and directly author render functions."* Angular has no such escape —
[01](01-the-template-is-a-separate-language.md) is why.

## React has two compile steps, and neither is Angular's kind

**JSX is compiled.** It is not JavaScript, so Babel or `tsc` rewrites it into `createElement` /
`jsx()` calls. That is a mechanical syntax transform: it reads syntax, emits function calls, and
understands nothing about your component.

**React Compiler is real, stable, and optional.** Verbatim: > *"React Compiler is a new build-time
tool that automatically optimizes your React app."* · > *"React Compiler is now stable and has been
tested extensively in production. While it is still an optional addition to React today, in the
future some features may require the compiler in order to fully work."* What it does is a different
job entirely: > *"React Compiler automatically applies the optimal memoization, ensuring your app
only re-renders when necessary."* — *"eliminating the need for manual `useMemo`, `useCallback`, and
`React.memo`."* And it does it without a rewrite: > *"It works with plain JavaScript, and understands
the Rules of React, so you don't need to rewrite any code to use it."*

Laid against `ngtsc`, the three are cleanly separable:

| | JSX transform | React Compiler | Angular `ngtsc` |
|---|---|---|---|
| Required? | yes — JSX is not JavaScript | **no** — *"still an optional addition"* | yes |
| What it reads | syntax only | your component functions, plus the Rules of React | your decorator metadata **and** your template |
| What it emits | function calls returning elements | the same code with memoization inserted | `ɵcmp`, a DOM-mutating template function, and `.d.ts` type metadata |
| Can it fail your build over your **markup**? | no | no | **yes** — NG8001, NG8002, NG5002, every `strictTemplates` error |

🔴 **That last row is the honest one-line answer to "what is different about Angular".** React
Compiler optimises code it assumes is correct. Angular's compiler decides whether your markup *is*
correct, which is a different power, and it is the power that pays for the metadata restrictions in
[09](09-static-analysability-is-the-load-bearing-constraint.md) — an analysis can only refuse what it
can first understand.

## Svelte — and the claim not to make

Svelte's overview, verbatim: > *"Svelte is a framework for building user interfaces on the web. It
uses a compiler to turn declarative components written in HTML, CSS and JavaScript … into lean,
tightly optimized JavaScript."*

⚠️ **"Svelte has no virtual DOM" is not asserted here.** It is widely repeated and it may well be
true, but the current Svelte documentation pages read for this page — the overview and the FAQ — do
not contain a sentence stating it, and the corpus rule is that a framework's own current
documentation is the source. The nearest adjacent line is contextual, in a section about testing:
*"Components can be compiled (since Svelte is a compiler and not a normal library)"*. So: **the
documentation describes Svelte as a compiler producing "lean, tightly optimized JavaScript"; it does
not, on the pages checked, make a virtual-DOM claim.** If you need that claim, source it from
Svelte's blog and cite it as such.

What is safe to say is that Svelte and Angular agree on the premise — the framework *is* a compiler,
which is Angular's *"the decorator is the compiler"* from [12](12-ivy-and-locality.md) — and diverge
on the consequence. Svelte compiles toward a minimal runtime. Angular deliberately keeps a
substantial one, because locality ([12d](12d-where-locality-breaks.md)) means much of what *could*
be precomputed across your whole application is deliberately not.

## The four axes, side by side

| | React | Vue | Svelte | Angular |
|---|---|---|---|---|
| Compile step for markup? | yes — JSX → function calls | yes — template → render function | yes — component → JavaScript | yes — template → instruction stream |
| Is markup a separate language? | no — an expression syntax over JS | yes | yes | **yes**, with its own grammar and error codes |
| What is emitted? | `createElement` / `jsx()` calls | a render function returning vnodes, plus patch flags | *"lean, tightly optimized JavaScript"* | `ɵcmp` with a slot-indexed template function |
| Runtime vnode diff? | yes — *"purely runtime"* | yes, but compiler-informed | not stated in the docs checked | no — per-slot `bindingUpdated` |
| Optional optimising compiler? | yes — React Compiler | n/a, built in | n/a, it *is* the compiler | n/a, built in |
| Can the build fail on your markup? | no | type errors only via `vue-tsc`, not the default | limited | **yes, extensively** |

## The one thing to say to each audience

- **From React:** your build step is a syntax transform plus, optionally, a memoiser. Angular's is an
  *analysis*. That is why Angular can refuse to compile your markup and React cannot, and why Angular
  imposes the metadata restrictions React has no need of.
- **From Vue:** you already have everything except the last step. Angular takes the same
  compiler-informed idea and removes the vnode tree, paying for it with a template shape fixed at
  build time — [08d](08d-what-the-fixed-shape-costs.md) is that bill.
- **From Svelte:** you already believe the framework is a compiler. Angular agrees, and then keeps a
  large runtime anyway, because compiling each file in isolation is a deliberate constraint rather
  than a limitation.

## Gotchas

**★ Symptom: you say "Angular compiles, React doesn't" and get corrected.** Cause: React ships an
optional compiler, and JSX has always required a compile step. Fix: make the claim about the *kind*
of compilation — Angular's reads your markup and can reject it; React's transform reads syntax and
its compiler reads component code, and neither can fail a build over a template.

**★ Symptom: you tell a Vue developer that Angular is fundamentally different because Vue uses a
virtual DOM.** Cause: true, and it hides the more interesting half — Vue's compiler does the *same
kind* of static template analysis Angular's does, and spends it on patch flags and tree flattening
rather than on eliminating the tree. Fix: frame it as Vue's own spectrum. Both are compiler-informed;
Angular went one step further and kept only the instructions.

**★ Symptom: coming from React, you look for a `render()` function to write by hand.** Cause: in
React the markup *is* an expression in your language, so escaping to code is natural. In Angular the
template is a separate language with its own grammar
([01](01-the-template-is-a-separate-language.md)), and there is no supported hand-authored
equivalent — unlike Vue, which documents one. Fix: express the dynamism in the template's own
constructs, and treat "I want a render function" as a signal you are fighting the model.

**★ Symptom: a build fails on something that "would just render wrong" in React.** Cause: this is the
design, not a regression — Angular's own documentation gives it as a benefit: *"Detect template
errors earlier — The AOT compiler detects and reports template binding errors during the build step
before users can see them."* Fix: read the NG code. Nothing in React's toolchain produces this class
of error, so there is no habit to transfer; the codes are the vocabulary
([13c](13c-the-ng-error-code-is-a-typescript-code.md)).

**Symptom: you expect Angular's compiler to memoize for you, like React Compiler.** Cause: different
jobs. React Compiler inserts memoization into ordinary JavaScript; `ngtsc` turns a template into an
instruction stream and type-checks it. Neither does the other's work. Fix: Angular's equivalent lever
is change detection and signals, not the compiler.

**Symptom: you assume the compiler can be skipped for a quick prototype, as JSX-less React can be.**
Cause: React runs without JSX (`createElement` by hand) and React Compiler is optional, so both build
steps are, in principle, avoidable. Angular's is not — a class with no `ɵcmp` is not renderable at
all, per [08e](08e-only-compiled-classes-are-renderable.md). Fix: none needed; know that "just drop
the build step" has no Angular meaning.

## Interview questions

**★ All four of React, Vue, Svelte and Angular have a compile step. What does Angular's do that the
others' do not?**
It reads your markup as a language it understands and is allowed to refuse it. The JSX transform
reads syntax and rewrites it to function calls; React Compiler reads component code and inserts
memoization; Vue compiles templates into render functions and annotates them with patch flags;
Svelte compiles components into JavaScript. None of those can fail a build because a binding target
does not exist or a type does not match — Angular's can, and does, through NG8001, NG8002 and the
whole `strictTemplates` family. That single property is what the metadata restrictions buy: an
analysis can only reject what it can first understand statically.

**★ Vue calls its approach a "Compiler-Informed Virtual DOM". Where does Angular sit on that spectrum,
and what does it give up?**
At the far end. Vue's own documentation contrasts *"purely runtime"* virtual DOM implementations,
which must diff every vnode because they can assume nothing, with its own approach where the compiler
*"can statically analyze the template and leave hints in the generated code"*. Angular takes the same
premise and drops the tree entirely: the compiler emits slot-indexed instructions that touch the DOM
directly, so there is no vnode diff at all. What it gives up is the flexibility a tree buys — the
template's shape is fixed at build time, which is the cost the `@defer`/control-flow constructs exist
to work around, and it forfeits Vue's escape hatch of hand-authored render functions.

**★ React Compiler is optional. Why can Angular's compiler never be?**
Because they produce different things. React Compiler adds memoization to code that already runs
correctly without it — which is exactly why it can be optional, and why the docs describe it as
*"still an optional addition to React today"*. Angular's compiler produces the artefact that makes a
class renderable at all: `ɵcmp`, the template function, the factory, the `.d.ts` metadata. A
component class that has not been through `ngtsc` is an ordinary class Angular cannot render. The
compile step is not an optimisation pass over working code; it is where the component comes from.

**What can Angular's compiler tell you at build time that a JSX transform structurally cannot?**
Everything that requires knowing what a name in the markup *means*. A JSX transform maps
`<Foo bar={x} />` to a function call without asking whether `Foo` exists, whether `bar` is a
declared prop, or whether `x` is assignable to it — those become type errors only if the surrounding
TypeScript happens to check them. Angular resolves every element and attribute in a template against
the component's actual dependency set and types every expression against the class, which is why it
can report an unknown element, an unknown property, or an assignment whose types do not line up, and
why turning that checking off changes what compiles.

**Someone claims Svelte has no virtual DOM and Angular does. How would you settle it?**
By going to the current documentation for both rather than to received wisdom. Angular's side is
settled here: there is no vnode diff, updates run through per-slot instructions. For Svelte, the
overview says only that the compiler produces *"lean, tightly optimized JavaScript"* — the pages read
for this corpus do not state the virtual-DOM claim at all, so the honest answer is that it is not
documented on those pages and would need sourcing from Svelte's blog. The habit matters more than the
answer: the compile-step comparison is full of claims everyone repeats and nobody sources.

---

← Prev: [15e · What changes underneath you](15e-what-changes-underneath-you.md) · Index: [Topic index](README.md) · Next → **17 · What the compiler refuses, end to end** *(not written yet)*
