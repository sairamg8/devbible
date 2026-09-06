---
title: "The template expression grammar is a deliberately small subset of JavaScript, and every hole in it — no globals, no `new`, no bitwise operators — is there to keep expressions analysable and cheap to re-evaluate"
sidebar_label: "02 · What an expression may contain"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against angular.dev — [Expression syntax](https://angular.dev/guide/templates/expression-syntax) — the [v21.2.0 and v22.0.0 CHANGELOG](https://github.com/angular/angular/blob/main/CHANGELOG.md) in `angular/angular`, the expression parser source [`packages/compiler/src/expression_parser/parser.ts`](https://github.com/angular/angular/blob/main/packages/compiler/src/expression_parser/parser.ts), and the published `@angular/core` **22.1.5** type definitions.
> Version spine: **Angular 22.1.5**. Documentation-validated; **no sandbox run**.

**A template expression looks like JavaScript and is not JavaScript. It is a small,
closed grammar with no globals, no constructors, no bitwise operators and no statements —
and the omissions are load-bearing rather than accidental.** Angular re-evaluates every
binding expression on every change-detection pass, so expressions must be cheap and
side-effect-light; and the compiler has to be able to reason about them at build time,
so they must not be able to reach outside the component instance. This chunk is the
complete grammar, taken from the documented tables, plus the three places where the
documented tables and the shipped compiler currently disagree.

## Value literals

angular.dev: *"Angular supports a subset of literal values from JavaScript."*

| Literal type | Example values | Supported? |
|---|---|---|
| String | `'Hello'`, `"World"` | yes |
| Boolean | `true`, `false` | yes |
| Number | `123`, `3.14` | yes |
| Object | `{name: 'Alice'}` | yes |
| Array | `['Onion', 'Cheese', 'Garlic']` | yes |
| `null` | `null` | yes |
| RegExp | `/\d+/` | yes |
| Template string | `` `Hello ${name}` `` | yes |
| Tagged template string | `` tag`Hello ${name}` `` | yes |
| **BigInt** | `1n` | **no** |

Note what is *not* on the "unsupported" side: object and array literals are fully legal in a
binding. That matters more than it looks — see the `ɵɵpureFunction` discussion in chunk
**08 · Instructions, not a virtual DOM** *(not written yet)*, because a fresh object literal in a binding is
allocated on every update pass unless the compiler can prove it constant.

## Globals: you get exactly two

> *"Angular expressions support the following globals: `undefined`, `$any`. No other
> JavaScript globals are supported. Common JavaScript globals include `Number`, `Boolean`,
> `NaN`, `Infinity`, `parseInt`, and more."*

That is the whole list. `Math`, `JSON`, `Object`, `Date`, `Array`, `String`, `parseFloat`,
`isNaN`, `console`, `window`, `document` — none of them resolve. An identifier that is not a
member of the component instance, not a template variable and not one of those two globals
is simply not found.

```ts
// product-card.ts — the fix for "Math is not defined in the template"
@Component({
  selector: 'app-product-card',
  template: `
    <p>Best price: {{ bestPrice() }}</p>
    <p>Raw JSON: {{ debugPayload() }}</p>
  `,
})
export class ProductCard {
  product = input.required<Product>();

  // Expose the computation, not the global.
  bestPrice = computed(() => Math.min(this.product().price, this.product().rrp));
  debugPayload = computed(() => JSON.stringify(this.product()));
}
```

`undefined` is in the list and `null` is a *literal* rather than a global, so both work.
`$any` is not a real function — it is a compiler directive that switches off type checking
for one sub-expression, covered in chunk **[14 · Template type checking](14-template-type-checking.md)**.

## Local variables beginning with `$`

> *"Angular automatically makes special local variables available for use in expressions in
> specific contexts. These special variables always start with the dollar sign character
> (`$`). For example, `@for` blocks make several local variables corresponding to
> information about the loop, such as `$index`."*

The `$` prefix is reserved by the language for exactly this. `$index`, `$count`, `$first`,
`$last`, `$even`, `$odd` inside `@for`; `$event` in an event binding; `$any` everywhere;
`$safeNavigationMigration` as a temporary v22 migration aid (chunk
[05 · Expressions, statements and safe navigation](05-expressions-statements-and-safe-navigation.md)). Do not name a component property
`$something` and expect it to resolve cleanly — you are in the language's namespace.

## Supported operators

Every operator angular.dev lists as supported, grouped so the shape is visible:

| Group | Operators |
|---|---|
| Arithmetic | `+` `-` `*` `/` `%` `**` |
| Comparison | `<` `<=` `>` `>=` `==` `===` `!=` `!==` |
| Logical | `&&` `\|\|` `!` |
| Nullish | `??` |
| Conditional | `a ? b : c` |
| Unary | `-x` `+y` |
| Type / membership | `typeof 42`, `void 1`, `'model' in car`, `car instanceof Automobile` |
| Property access | `person['name']`, `person.name` |
| Grouping | `(a + b)` |
| Spread / rest | `{...obj, foo: 'bar'}`, `[...arr, 1, 2, 3]`, `fn(...args)` |
| Assignment (statements only — see below) | `=` `+=` `-=` `*=` `/=` `%=` `**=` `&&=` `\|\|=` `??=` |

Plus three that are Angular's own and have no JavaScript equivalent:

| Operator | Example | What it is |
|---|---|---|
| Pipe | `{{ total \| currency }}` | invokes a `PipeTransform` |
| Optional chaining | `someObj.someProp?.nestedProp` | JavaScript's `?.` — but see the v22 semantics change |
| Non-null assertion | `someObj!.someProp` | TypeScript's `!`, honoured by the template type checker |

## Unsupported operators, and why each one is out

| Operator | Example | Why it is out |
|---|---|---|
| **All bitwise operators** — `&`, `&=`, `~`, `\|=`, `^=`, … | `flags & MASK` | 🔴 `\|` is the pipe operator. Once `\|` is taken, keeping the rest of the bitwise family would be an inconsistent grammar. Do the bit twiddling in a `computed()`. |
| **Object destructuring** | `const { name } = person` | it is a *declaration*, and declarations are out entirely |
| **Array destructuring** | `const [firstItem] = items` | same |
| **Comma operator** | `x = (x++, x)` | sequencing two expressions is a statement in disguise; a binding must be one value |
| **`new`** | `new Car()` | 🔴 constructing on every update pass is a performance trap, and it makes the expression's value unanalysable |

`new` is the one people argue with. A binding expression is re-evaluated on every change
detection run for that view; `[config]="new HttpParams()"` would allocate a new object each
time, and because the reference differs from the last one, every downstream `OnPush` child
would be marked dirty forever. Banning it in the grammar turns a subtle perpetual-rerender
bug into a parse error.

Two categories are missing from both tables above because they are not operators at all —
**declarations** (`let`, `const`, `function`, `class`) and the arrow-function form. Those,
and the `@let` block that replaces them, are chunk
[03 · Declarations and `@let`](03-declarations-and-the-let-block.md).

## Gotchas

**★ Symptom: `Math.max(a, b)` in a template fails but the identical line in the class
compiles.** Cause: `Math` is a JavaScript global, and the template grammar supports exactly
two globals, `undefined` and `$any`. The expression parser resolves `Math` against the
component instance, does not find it, and the type checker reports it as a missing property.
Fix: expose it. Either a `computed()` as shown above, or — if you genuinely want the global
in many templates — a single class field:

```ts
export class ProductCard {
  protected readonly Math = Math; // now `Math.max(...)` resolves in this template only
}
```

The `computed()` form is better: it is memoised, and it keeps the arithmetic out of the
update pass.

**★ Symptom: `[value]="flags & READ_MASK"` fails to parse.** Cause: `&` is a bitwise
operator and all of them are removed from the grammar, because `|` is the pipe operator.
Fix: compute it in the class.

```ts
export class PermissionsBadge {
  flags = input.required<number>();
  protected canRead = computed(() => (this.flags() & PermissionMask.Read) !== 0);
}
```

**Symptom: an object literal in a binding causes a child `OnPush` component to re-render
constantly.** Cause: object and array literals are legal in the grammar, and each update
pass evaluates the literal afresh, producing a new reference. Fix: hoist it to a `computed()`
so identity is stable while the inputs are:

```ts
export class ChartHost {
  data = input.required<Series[]>();
  // stable identity: recomputed only when `data()` changes
  protected chartOptions = computed(() => ({ series: this.data(), animate: false }));
}
```

**Symptom: a `1n` BigInt literal is a parse error.** Cause: BigInt is the single documented
unsupported *literal*. Fix: keep BigInt values in the class and bind a formatted `string`,
which is what the DOM wants anyway.

**Symptom: `[disabled]="new Date() > deadline"` will not compile.** Cause: `new` is not in
the grammar. Fix: a `computed()` reading a signal clock, or a plain field if the value only
needs to be sampled once — but be aware that a plain field sampled at construction does not
update. If you need "is it past the deadline *now*", you need a time source, not a template
expression.

**Symptom: you name a component property `$data` and it stops resolving predictably.**
Cause: the `$` prefix is reserved for the language's own contextual locals. Fix: rename it.
There is no configuration for this.

**Symptom: `{{ items.length ? 'some' : 'none' }}` works but `{{ items?.length ?? 0 }}` warns
`optionalChainNotNullable` / `nullishCoalescingNotNullable`.** Cause: the template type
checker knows `items` is non-nullable, so the `?.` and the `??` are dead code — and the v22
release note says exactly this: *"This change will trigger the `nullishCoalescingNotNullable`
and `optionalChainNotNullable` diagnostics on exisiting projects."* Fix: delete the operator
that cannot fire. If you genuinely believe the value can be null, the type is wrong, not the
template — widen it in the class:

```ts
export class ItemList {
  // was: items = input.required<Item[]>();  ->  `items()?.length` is provably non-null
  items = input<Item[] | undefined>();
}
```

**Symptom: `{{ 'x' in obj }}` compiled in v21 and throws in v22.** Cause: a v22 breaking
change, listed in the CHANGELOG under `compiler` as *"`in` variables will throw in template
expressions."* Fix: move the membership test into the class, where `in` is unrestricted:

```ts
protected hasCity = computed(() => 'city' in this.address());
```

**Symptom: a `typeof` check in metadata fails even though `typeof` is supported in
templates.** Cause: two different grammars again. `typeof 42` is a supported *template
expression* operator; the documented AOT metadata error *"Expression form not supported"*
names `typeof` explicitly as invalid inside a decorator argument — *"You can use `typeof`
and bracket notation in normal application code. You just can't use those features within
expressions that define Angular metadata."* Fix: see chunk
**10 · Metadata errors, one by one** *(not written yet)*; the template grammar and the metadata grammar are
not the same subset and do not have the same holes.

## Interview questions

**★ Why does Angular refuse `new` in a template expression when it allows a method call?**
Because of what re-evaluation costs. Binding expressions run on every change-detection pass
for their view. A method call *may* be cheap and may return a stable reference; `new` is
guaranteed to allocate and guaranteed to produce a reference that differs from the last one.
That combination is the classic Angular performance bug — a fresh object flowing into an
`OnPush` child input marks it dirty on every pass, forever, and the symptom (jank, endless
re-render) is nowhere near the cause (one `new` in a template). Removing it from the grammar
converts a runtime pathology into a compile error. The same reasoning is why `@for` requires
`track` and why extended diagnostics warn about uninvoked functions in interpolations.

**★ Why are all bitwise operators unsupported when only `|` conflicts with the pipe syntax?**
The direct conflict is only with `|`, and it is a real one — `{{ a | b }}` has to mean "pipe
`a` through `b`" and cannot also mean bitwise-or. Removing just that one would leave a
grammar where `&`, `^` and `~` work, `|` does not, and `|=` is ambiguous depending on
position. Angular took the consistent option and removed the family. In practice the cost is
near zero: bit flags belong in a `computed()` in the class, where they are also type-checked
properly and evaluated once rather than per pass.

**What is `$any()` and when is reaching for it a mistake?**
`$any(x)` tells the template type checker to treat `x` as `any` for that sub-expression. It
is a documented escape hatch for false positives — the guide names three: a library whose
typings are wrong or incomplete, a library input type that is too narrow, and
`$event.target` for DOM events, where bubbling means the DOM typings cannot give you the
type you expect. Using it anywhere else means you are switching off the checker that is the
main thing Angular's compiler buys you. If a template needs `$any` regularly, the real fix
is a typed wrapper in the class or a better-typed directive input, not a cast in the markup.

**Why does a template expression have no access to `window` or `document`?**
Two reasons, and only one is about discipline. The practical one is server-side rendering:
an expression that touches `window` cannot run on the server, and Angular is not willing to
have a template grammar in which half the language only works in a browser. The design one
is that the template's lexical scope is deliberately the component instance plus template
variables plus two globals — a closed, statically known set — which is what makes it
possible to generate a type-check block for a template at all (chunk
**[14 · Template type checking](14-template-type-checking.md)**). If templates could reach ambient globals, the checker
would have to model the entire ambient environment. Inject `DOCUMENT`, or read the value
into a signal in the class.


**What happens if a template expression throws?**
It throws during change detection, inside the update pass of the enclosing view's template
function, and by default Angular reports it through the global error handler. The important
part is *where* — the stack you get names the generated template function, not a line of
your `.html` file, unless source maps for the template are in play. This is a large part of
why the grammar is small: an expression that cannot construct, cannot assign and cannot
declare has far fewer ways to throw, and the ones that remain (a null dereference, a bad
method call) are exactly what the template type checker in chunk
**[14 · Template type checking](14-template-type-checking.md)** is designed to catch first.

**Angular supports `instanceof` and `in` as operators but bans `new`. Is that consistent?**
It is, once you separate *reading* from *creating*. `instanceof` and `in` interrogate a
value that already exists; they allocate nothing and return the same answer for the same
inputs. `new` creates. The grammar's rule is not "no runtime work" — a method call does
runtime work — it is closer to "no expression may produce a value whose identity changes
every time it is evaluated". `new` violates that by definition; `instanceof` cannot. (v22
narrowed this further: `in` on a *variable* now throws, per the release notes, while
`'literal' in obj` remains fine.)

**Why can a template not contain a semicolon-separated sequence of expressions?**
Because a binding produces exactly one value and Angular has to know which one. The comma
operator is listed as unsupported for the same reason. Event *statements* are the one place
where sequencing matters — and there Angular allows a semicolon-separated list, which is
covered in chunk [05 · Expressions, statements and safe navigation](05-expressions-statements-and-safe-navigation.md). The split between
"expression" and "statement" contexts is the single most important distinction in this
grammar, and it is the thing most people get wrong when they first meet it.

---

← Prev: [01 · The template is a separate language](01-the-template-is-a-separate-language.md) · Index: [Topic index](README.md) · Next → [03 · Declarations and `@let`](03-declarations-and-the-let-block.md)
