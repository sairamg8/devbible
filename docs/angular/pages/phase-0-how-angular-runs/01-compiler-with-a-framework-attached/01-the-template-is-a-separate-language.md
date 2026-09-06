---
title: "An Angular template is a distinct language with its own tokenizer and parser, and the browser and TypeScript are both incapable of reading it"
sidebar_label: "01 · The template is a separate language"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against angular.dev — [Ahead-of-time (AOT) compilation](https://angular.dev/tools/cli/aot-compiler), [Expression syntax](https://angular.dev/guide/templates/expression-syntax) — and the Ivy design doc [`packages/compiler/design/architecture.md`](https://github.com/angular/angular/blob/main/packages/compiler/design/architecture.md) in `angular/angular`, plus the [v22.0.0 CHANGELOG](https://github.com/angular/angular/blob/main/CHANGELOG.md).
> Version spine: **Angular 22.1.5** · TypeScript peer `>=6.0 <6.1`. Documentation-validated; **no sandbox run**.

**Open any Angular component and you are looking at two languages in one file. The class
body is TypeScript, which `tsc` understands. The template is not TypeScript, not HTML, and
not JavaScript — it is a fourth thing, and to every tool in your toolchain except Angular's
own compiler it is an opaque string.** Your editor's HTML formatter does not understand it.
Your bundler cannot see through it. TypeScript type-checks the class and skips the template
entirely, because as far as `tsc` is concerned `template: '<p>{{ user.nmae }}</p>'` is just
a string literal that happens to have quotes around it. Something else has to read it, and
that something is a compiler that ships in your `devDependencies`.

angular.dev states the situation in one sentence:

> *"An Angular application consists mainly of components and their HTML templates. Because
> the components and templates provided by Angular cannot be understood by the browser
> directly, Angular applications require a compilation process before they can run in a
> browser."*

## The syntax that is not HTML

An HTML parser reading an Angular template will silently accept most of it and understand
none of it. Attribute names containing brackets and parentheses are legal HTML attribute
names, so no browser complains — it just does nothing with them.

`product-card.component.html`:

```html
<article class="card" [class.card--sale]="product().onSale">
  <img [src]="product().imageUrl" [alt]="product().name" />

  <h2>{{ product().name }}</h2>
  <p class="price">{{ product().price | currency:'GBP' }}</p>

  @if (product().stock === 0) {
    <p class="oos">Out of stock</p>
  } @else if (product().stock < 5) {
    <p class="low">Only {{ product().stock }} left</p>
  } @else {
    <button type="button" (click)="addToCart.emit(product())">Add to cart</button>
  }

  @for (tag of product().tags; track tag) {
    <span class="tag">{{ tag }}</span>
  } @empty {
    <span class="tag tag--none">Untagged</span>
  }
</article>
```

Six constructs there are not HTML:

| Construct | What it is |
|---|---|
| `[src]="…"` | a **property binding** — an attribute named `[src]` means nothing to a browser |
| `(click)="…"` | an **event binding** |
| `{{ … }}` | **interpolation** — a text node containing braces, to HTML |
| `\| currency:'GBP'` | a **pipe** — the `\|` character is not an operator in JavaScript expressions Angular accepts, it is Angular's own |
| `@if` / `@else if` / `@for` / `@empty` | **block syntax** — an `@` at the start of an element's content is plain text to HTML |
| `[class.card--sale]="…"` | a **class binding**, a compound key an HTML parser sees as an opaque attribute name |

The `@if` block is the clearest demonstration. There is nothing in the HTML specification
that gives `@` any meaning inside element content. The only reason
`@if (x) { … } @else { … }` is a conditional rather than literal text is that Angular's own
tokenizer runs over that file first and recognises the block. Serve that template as a
static `.html` page and a browser will render the word `@if` on screen.

## The syntax that is not JavaScript either

The `product().price | currency:'GBP'` expression is not valid JavaScript. In JavaScript
`|` is bitwise OR; in an Angular expression it invokes a pipe — and Angular's expression
grammar bans bitwise operators outright specifically so the character is free for this. That
is a language-design decision, and language-design decisions require a language.

angular.dev opens the expression-syntax guide with exactly this framing:

> *"Angular expressions are based on JavaScript, but differ in some key ways."*

Chunk [02](02-what-a-template-expression-may-contain.md) enumerates every one of those ways.

## The four stages every template goes through

The Ivy compiler-architecture design doc in `angular/angular` sets out the pipeline. A
template is compiled by:

> *"1. Tokenizes the template 2. Parses the tokens into an HTML AST 3. Converts the HTML AST
> into an Angular Template AST. 4. Translates the Angular Template AST to a template
> function"*

Read that as four distinct jobs:

1. **Tokenize.** Angular's own lexer, not the browser's. It knows about `{{`, about `@if`,
   about the `*` prefix, about `#ref`. A browser tokenizer knows none of them.
2. **HTML AST.** A tree of elements, attributes and text — structurally HTML-shaped, but
   built by Angular's parser so that the Angular-specific tokens survive as first-class
   nodes instead of being flattened into attribute strings.
3. **Angular Template AST.** The semantic layer. The same design doc lists what this stage
   does: it *"Converts Angular template syntax short-cuts such as `*ngFor` and `[name]` into
   the their canonical versions, (`<ng-template>` and `bind-name`)"*, it *"Collects
   references (`#` attribute) and variables (`let-` attributes)"*, and it *"Parses and
   converts binding expressions in the binding expression AST using the variables and
   references collected"*. Note the last one: **the binding expressions get their own
   parser and their own AST.** `product().price | currency:'GBP'` is parsed by an expression
   parser that is separate again from the HTML parser.
4. **Template function.** The AST is lowered to a JavaScript function of imperative
   instruction calls. That is chunks [04](04-what-the-compiler-emits.md) and
   [05](05-create-pass-and-update-pass.md).

## `templateUrl` and `template` compile identically

A separate file is a convenience, not a different mechanism. The compiler reads the file at
build time and inlines it. angular.dev lists this among the reasons to use AOT at all:

> *"The compiler inlines external HTML templates and CSS style sheets within the application
> JavaScript, eliminating separate ajax requests for those source files."*

```ts
// product-card.component.ts — these two compile to the same ɵcmp
@Component({
  selector: 'app-product-card',
  templateUrl: './product-card.component.html',
  styleUrl: './product-card.component.css',
})
export class ProductCard {
  product = input.required<Product>();
  addToCart = output<Product>();
}
```

```ts
@Component({
  selector: 'app-product-card',
  template: `
    <article class="card">
      <h2>{{ product().name }}</h2>
    </article>
  `,
  styles: `.card { padding: 1rem; }`,
})
export class ProductCard {
  product = input.required<Product>();
  addToCart = output<Product>();
}
```

The practical difference is where errors are reported, not what is produced — see
[15 · Consequences you actually hit](15-consequences-you-actually-hit.md).

## The language keeps changing, on Angular's schedule

Because it is Angular's language, Angular versions it. The v22 CHANGELOG lists under
`compiler`:

> *"Support comments in html element."*

and, as a breaking change:

> *"`in` variables will throw in template expressions."*

Both are grammar changes to a language whose only implementation is `@angular/compiler`.
That is the honest reason template syntax moves between majors: there is no external
standard pinning it down.

## Gotchas

**★ Symptom: your HTML formatter mangles `@if` blocks or reports the file as invalid.**
Cause: it is an HTML formatter and this is not HTML — `@if (cond) {` is text content
followed by an unbalanced brace as far as it is concerned. Fix: use a formatter that has an
Angular template mode. Prettier has supported Angular templates as a distinct parser for
years; point it at the file explicitly rather than letting it infer `html` from the
extension:

```json
// .prettierrc
{
  "overrides": [
    {
      "files": ["*.component.html"],
      "options": { "parser": "angular" }
    }
  ]
}
```

If you use an editor plugin instead, disable the generic HTML formatter for
`*.component.html` and let the Angular Language Service own those files.

**★ Symptom: a typo in a template compiles clean in your editor's TypeScript checker and
fails only on `ng build`.** Cause: `tsc` never reads the template. In a `templateUrl`
component the template is in a file TypeScript does not include; in an inline component it
is a string literal. Only `ngtsc` reads it. Fix: run the Angular Language Service (it is the
compiler's checker exposed to the editor, not a second implementation) and do not treat a
green TypeScript check as a green build. Chunk
[11](11-where-the-compiler-runs-ngtsc.md) explains why they are two different programs.

**Symptom: a template renders `@if (isAdmin) {` as literal text in the browser.** Cause: the
file was served as static HTML, or the block is inside something Angular does not compile —
most often a string you injected with `innerHTML`, which is inserted by the DOM, not by the
template compiler. Fix: bindings and blocks only exist inside a compiled template. If you
need dynamic structure, put it in the template and drive it with a signal; `innerHTML` will
never grow Angular semantics.

**Symptom: `<` inside template text breaks the parse.** Cause: the template goes through an
HTML tokenizer, so `<` starts a tag. `@if (stock < 5)` is fine because that `<` is inside an
attribute-position expression, but a bare `Fewer than <5 left` in text content is not. Fix:
escape it as `&lt;` in text content, exactly as you would in HTML.

**Symptom: an expression that is valid TypeScript is rejected in a binding.** Cause: two
different parsers with two different grammars. Fix: move the expression into the class and
bind the result. This is not a workaround, it is the intended shape — see chunk
[02](02-what-a-template-expression-may-contain.md) for the full grammar and
[07](07-static-analysability.md) for why the grammar is small on purpose.

## Interview questions

**★ Why does Angular need its own template parser instead of reusing the browser's?**
Because the browser's parser throws away everything Angular needs. An HTML parser reduces
`[src]="product().imageUrl"` to an attribute with the name `[src]` and the value
`product().imageUrl` — a string. It has no concept of a binding, no concept of an
expression, and no way to report that `imageUrl` is not a property of `Product`. Angular
needs a tree in which a binding is a node with a parsed expression AST attached, so that it
can generate an update instruction for it and type-check it against the component class.
Beyond that, Angular's grammar contains constructs — `{{ }}`, `@if`, `*ngFor`, `#ref`,
pipes — that a conforming HTML parser is required to treat as text or as opaque attributes.
There is no way to get them out of a standard parser, so Angular ships its own.

**★ TypeScript compiles my component file. Why doesn't it catch template errors?**
Because from TypeScript's point of view there is no template. `templateUrl:
'./x.component.html'` is a string; the `.html` file is not in the TypeScript program at all.
An inline `template:` is a template-literal expression whose *contents* TypeScript has no
reason to inspect. Template checking is a separate feature implemented by
`@angular/compiler-cli`, which builds a synthetic TypeScript file representing the template
and asks the TypeScript type checker about *that* — see chunk
[12](12-template-type-checking.md). This is why "it compiles in the IDE" and "it builds" are
different statements in Angular in a way they are not in React.

**Where in the pipeline does an expression like `user.name | titlecase` actually get
parsed, and by what?**
In stage three. The HTML parser produces an attribute or text node whose value is the raw
string; the Angular Template AST stage then runs a dedicated **expression parser** over that
string, using the references and template variables collected from the surrounding template
as its lexical scope. So a template involves at least three grammars: the block/tokenizer
grammar, the HTML grammar, and the expression grammar. A pipe is only meaningful to the
third of those.

**What actually changes if I move a template from `template:` to `templateUrl:`?**
Almost nothing about the output — the compiler inlines the file at build time and emits the
same component definition. What changes is diagnostics and tooling: errors are reported
against the real `.html` file with its own line and column numbers instead of against a
synthetic file, editors treat the file as an Angular template rather than a TypeScript
string, and the file becomes a build input that must be watched for changes. There is no
runtime fetch in either case; the "external template" is external only in your source tree.

**Why can Angular change template syntax in a major release when it cannot change JavaScript?**
Because the template language has exactly one implementation, `@angular/compiler`, and no
external standards body. The v22 release both added grammar (`"Support comments in html
element."`) and removed it (`"`in` variables will throw in template expressions."`). That
freedom is what let Angular introduce built-in control flow blocks at all — nobody had to
ratify `@if`. It is also why every major release note has a template-syntax section and why
`ng update` ships schematics that rewrite templates rather than merely bumping a version.

---

← Prev: [Topic index](README.md) · Index: [Topic index](README.md) · Next → [02 · What a template expression may contain](02-what-a-template-expression-may-contain.md)
