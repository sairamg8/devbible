---
title: "`schemas` is not a hint to the compiler — it is two early returns inside `DomElementSchemaRegistry`, and reading them tells you exactly which tags `CUSTOM_ELEMENTS_SCHEMA` will refuse to rescue"
sidebar_label: "06f · What `schemas` actually does"
sidebar_position: 6.5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against angular.dev — [NG8001 Invalid Element](https://angular.dev/errors/NG8001),
> [NG8002 Invalid Attribute](https://angular.dev/errors/NG8002) — and `angular/angular` at tag
> `v22.1.5`:
> [`compiler/src/schema/dom_element_schema_registry.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler/src/schema/dom_element_schema_registry.ts),
> [`core/src/metadata/schema.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/metadata/schema.ts),
> [`core/src/metadata/directives.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/metadata/directives.ts),
> [`compiler-cli/src/ngtsc/typecheck/src/dom.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/typecheck/src/dom.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**`schemas` has a reputation as a general "make the error go away" switch, and it is not one. The two
tokens are objects with a single `name` field, and the only code that reads them is a pair of guard
clauses at the top of `DomElementSchemaRegistry.hasElement` and `hasProperty`. Reading those eleven
lines settles every question people ask about schemas: `NO_ERRORS_SCHEMA` returns `true` immediately
and disables both checks for the entire component; `CUSTOM_ELEMENTS_SCHEMA` is consulted only inside
`if (normalizedTag.includes('-'))`, so it cannot rescue a hyphen-free tag at all; and `<ng-container>`
and `<ng-content>` are special-cased before either token is examined, which is why a binding on
`<ng-container>` is unreachable by any schema but `NO_ERRORS_SCHEMA`. Where the field lives and what
it does not cover at runtime is chunk 06g.**

## The two tokens, and how little they are

Both are still exported from `@angular/core` 22.1.5. Their complete definitions and doc comments,
verbatim:

```ts
/**
 * A schema definition associated with a component or an NgModule.
 *
 * @param name The name of a defined schema.
 */
export interface SchemaMetadata {
  name: string;
}

/**
 * Defines a schema that allows an NgModule to contain the following:
 * - Non-Angular elements named with dash case (`-`).
 * - Element properties named with dash case (`-`).
 * Dash case is the naming convention for custom elements.
 */
export const CUSTOM_ELEMENTS_SCHEMA: SchemaMetadata = {name: 'custom-elements'};

/**
 * Defines a schema that allows any property on any element.
 *
 * This schema allows you to ignore the errors related to any unknown elements or properties in a
 * template. The usage of this schema is generally discouraged because it prevents useful validation
 * and may hide real errors in your template. Consider using the `CUSTOM_ELEMENTS_SCHEMA` instead.
 */
export const NO_ERRORS_SCHEMA: SchemaMetadata = {name: 'no-errors-schema'};
```

There is no behaviour in either object. They are name tags, compared by string, at two call sites.

The field that carries them, from `@Component`'s declaration:

```ts
/**
 * The set of schemas that declare elements to be allowed in a standalone component. Elements and
 * properties that are neither Angular components nor directives must be declared in a schema.
 *
 * This property is only available for standalone components - specifying it for components
 * declared in an NgModule generates a compilation error.
 */
schemas?: SchemaMetadata[];
```

## `hasElement` — the eleven lines that decide everything

```ts
override hasElement(tagName: string, schemaMetas: SchemaMetadata[]): boolean {
  if (schemaMetas.some((schema) => schema.name === NO_ERRORS_SCHEMA.name)) {
    return true;
  }

  const normalizedTag = normalizeTagName(tagName);
  if (normalizedTag.includes('-')) {
    if (isNgContainer(normalizedTag) || isNgContent(normalizedTag)) {
      return true;
    }

    if (schemaMetas.some((schema) => schema.name === CUSTOM_ELEMENTS_SCHEMA.name)) {
      // Allow any custom elements
      return true;
    }
  }

  return this._schema.has(normalizedTag);
}
```

Four consequences, all readable off that code and none of them folklore:

1. 🔴 **`CUSTOM_ELEMENTS_SCHEMA` is only consulted when the normalised tag contains a hyphen.** It
   cannot rescue `<usercard>` or `<dvi>`, by design — the custom-elements specification requires a
   hyphen, so a hyphen-free unknown tag can only be a typo or a missing import.
2. **`NO_ERRORS_SCHEMA` short-circuits before normalisation happens at all.** Nothing else in the
   function runs.
3. **`<ng-container>` and `<ng-content>` are always known elements** regardless of schemas, handled
   before either token is examined.
4. **The final line is a `Map` membership test.** `this._schema` is the generated table; there is no
   fuzzy matching, no similarity suggestion, and no way to extend it other than a schema.

`normalizeTagName` lowercases first, which is why case mismatches resolve here but not in the message
text:

```ts
function normalizeTagName(tagName: string): string {
  const tagNameLower = tagName.toLowerCase();
  const [ns, name] = splitNsName(tagNameLower, false);

  return ns === SVG_NAMESPACE || ns === MATH_ML_NAMESPACE ? `:${ns}:${name}` : name;
}
```

## `hasProperty` — the same shape with one asymmetry

```ts
override hasProperty(tagName: string, propName: string, schemaMetas: SchemaMetadata[]): boolean {
  if (schemaMetas.some((schema) => schema.name === NO_ERRORS_SCHEMA.name)) {
    return true;
  }

  const normalizedTag = normalizeTagName(tagName);
  if (normalizedTag.includes('-')) {
    if (isNgContainer(normalizedTag) || isNgContent(normalizedTag)) {
      return false;
    }

    if (schemaMetas.some((schema) => schema.name === CUSTOM_ELEMENTS_SCHEMA.name)) {
      // Can't tell now as we don't know which properties a custom element will get
      // once it is instantiated
      return true;
    }
  }

  const elementProperties = this._schema.get(normalizedTag) || this._schema.get('unknown')!;
  return elementProperties.has(propName);
}
```

🔴 **The `isNgContainer` branch returns `false` here where `hasElement` returned `true`.**
`<ng-container>` and `<ng-content>` are *always* known elements and *never* have known properties, and
because that check runs first, the `CUSTOM_ELEMENTS_SCHEMA` branch is unreachable for them. That is
the precise reason a binding on `<ng-container>` cannot be silenced by `CUSTOM_ELEMENTS_SCHEMA` and
lands instead in the `ng-` branch of NG8002 — the branch that tells you to add `CommonModule`.

Note also the fallback: an unknown tag falls back to `this._schema.get('unknown')`, a synthetic entry,
rather than accepting anything. So even for a tag the registry has never heard of, only the properties
on that baseline entry are bindable.

The honest comment on the custom-element branch — *"Can't tell now as we don't know which properties a
custom element will get once it is instantiated"* — is the whole justification for the token existing.
Angular is not choosing to be permissive; it genuinely cannot know.

## Gotchas

**★ Symptom: you added `CUSTOM_ELEMENTS_SCHEMA` and `<usercard>` still fails.** Cause: `hasElement`
only reaches the `CUSTOM_ELEMENTS_SCHEMA` check inside `if (normalizedTag.includes('-'))`, so a
hyphen-free tag never gets there. Fix: give the custom element a hyphenated name, which the
custom-elements specification requires anyway:

```ts
@Component({
  selector: 'app-checkout',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<user-card data-user-id="42"></user-card>`,
})
export class Checkout {}
```

**★ Symptom: `CUSTOM_ELEMENTS_SCHEMA` does not silence a binding on `<ng-container>`.** Cause:
`hasProperty` returns `false` for `isNgContainer` / `isNgContent` **before** the schema check, so
nothing short of `NO_ERRORS_SCHEMA` applies. Fix: the binding is almost always `*ngIf` — replace it
with the built-in block, which needs neither an import nor a schema:

```ts
@Component({
  selector: 'app-team-page',
  imports: [UserCard],
  template: `
    @if (user(); as u) {
      <app-user-card [name]="u.name" />
    }
  `,
})
export class TeamPage {
  readonly user = input<{ name: string } | null>(null);
}
```

**★ Symptom: someone added `NO_ERRORS_SCHEMA` and a genuine typo shipped to production.** Cause: it
returns `true` from both `hasElement` and `hasProperty` before any other logic runs, disabling element
*and* property validation for the whole component. Angular's own doc comment warns about exactly this,
verbatim: *"The usage of this schema is generally discouraged because it prevents useful validation and
may hide real errors in your template."* Fix: replace it with `CUSTOM_ELEMENTS_SCHEMA`, which still
validates every hyphen-free tag and every non-custom property:

```ts
@Component({
  selector: 'app-checkout',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<stripe-card-element [publishableKey]="key" />`,
})
export class Checkout {
  readonly key = 'pk_live_placeholder';
}
```

**★ Symptom: a binding fails on a tag the registry has never heard of, even though you expected no
checking at all.** Cause: an unknown tag falls back to `this._schema.get('unknown')`, a synthetic
baseline entry, rather than to "anything goes". Fix: either add the appropriate schema, or bind the
value as an attribute — attribute bindings are not schema-checked:

```html
<my-widget [attr.data-mode]="mode()"></my-widget>
```

**★ Symptom: a mis-cased tag such as `<AppUserCard>` fails while `<app-user-card>` works, but the error
message suggests `NO_ERRORS_SCHEMA` rather than a rename.** Cause: `normalizeTagName` lowercases before
the lookup, so the registry sees `appusercard` — but the *message* is built from your original string,
and its hyphen test runs on that. Fix: rename the tag to match the selector exactly; no schema is
involved and adding one would only mask it.

## Interview questions

**★ What does `CUSTOM_ELEMENTS_SCHEMA` actually change, and what will it refuse to rescue?**
It makes `DomElementSchemaRegistry.hasElement` and `hasProperty` return `true` — but only inside the
`if (normalizedTag.includes('-'))` branch. So it whitelists hyphenated tags and their properties and
nothing else. It will not rescue a hyphen-free tag such as `<usercard>` or `<dvi>`, and it will not
rescue a binding on `<ng-container>` or `<ng-content>`, because `hasProperty` returns `false` for
those before the schema check runs. The token itself is just `{name: 'custom-elements'}`; all of the
behaviour is in those two guards.

**★ Why does `NO_ERRORS_SCHEMA` exist at all if the documentation discourages it?**
Because it is the only escape for a template whose tags are genuinely not knowable at build time — a
host element for a third-party widget library, or a wrapper rendering markup it does not own. Angular
is blunt about the cost in its own doc comment: it *"prevents useful validation and may hide real
errors in your template."* It short-circuits both checks before any other logic, so it disables
element *and* property validation for the whole component, which is why the same comment tells you to
prefer `CUSTOM_ELEMENTS_SCHEMA`.

**Why can `<ng-container>` be a known element and simultaneously have no known properties?**
Because it is not a DOM element at all — it is a template construct the compiler removes, so there is
nothing for a property to be set on. `hasElement` returns `true` for it so that writing the tag is
legal; `hasProperty` returns `false` so that binding to it is not. Both answers are given before any
schema is consulted, which is why no schema short of `NO_ERRORS_SCHEMA` changes either.

**Angular could suggest "did you mean `<div>`?" for a typo. Why doesn't it?**
Because the final line of `hasElement` is a `Map` membership test against a table generated from a
browser IDL — there is no similarity search and no candidate list in that code path. The message is
assembled from a template literal that has access to the tag name and a boolean about whether the host
is standalone, and nothing else. That is also why the second numbered suggestion is a hyphen heuristic
rather than a diagnosis.

**Why does the registry normalise SVG and MathML tags to a `:ns:name` form instead of stripping the
namespace?**
Because those namespaces have their own element tables, and a name can be valid in one and not in
another. `normalizeTagName` keeps the prefix only for `SVG_NAMESPACE` and `MATH_ML_NAMESPACE`, and the
XHTML prefix is stripped earlier by `checkElement` because HTML tags inside an SVG `foreignObject`
should be looked up in the plain HTML table. Two different namespaces, two different treatments, and
both are decided before any schema is consulted.

---

← Prev: [The `CommonModule` anti-fix](06e-the-commonmodule-anti-fix.md) · Index: [Topic index](README.md) · Next → [Where `schemas` lives](06g-where-schemas-lives.md)
