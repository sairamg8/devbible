---
title: "@use and @forward"
sidebar_label: "04 · @use and @forward"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against the **Sass documentation** —
> [`@use`](https://sass-lang.com/documentation/at-rules/use/),
> [`@forward`](https://sass-lang.com/documentation/at-rules/forward/) and
> [`@import`](https://sass-lang.com/documentation/at-rules/import/).

**The module system that replaced `@import`.** `@use` loads a file **once**,
namespaces its members, and keeps them out of the global scope — which is the
whole set of problems `@import` had.

## The basics

```scss
// _tokens.scss
$brand: #2563eb;
$radius: 8px;
@mixin card-surface { background: #fff; border-radius: $radius; }
```

```scss
// styles.scss
@use "tokens";

.card {
  color: tokens.$brand;
  @include tokens.card-surface;
}
```

**The namespace is the filename** without the underscore or extension. Every
member is reached through it — `tokens.$brand`, `tokens.card-surface`.

## `as` and `as *`

```scss
@use "tokens" as t;        // t.$brand
@use "tokens" as *;        // $brand — no namespace at all
```

`as *` is tempting and the documentation is explicit that it is only appropriate
"for stylesheets written by you", because it reintroduces exactly the name
collisions that namespacing prevents. Reserve it for a single project-local
`_shared.scss`, if at all.

## Configuration with `with`

A module can declare configurable defaults using `!default`, and consumers
override them at load time:

```scss
// _theme.scss
$brand: #2563eb !default;
$radius: 8px !default;

.button { background: $brand; border-radius: $radius; }
```

```scss
// styles.scss
@use "theme" with ($brand: #16a34a);
```

Two rules that bite:

- **`!default` is required** on the variable, or it cannot be configured.
- **A module can be configured only once, at its first load.** If another file
  already did `@use "theme"` without configuration, a later
  `@use "theme" with (...)` is an error.

That second rule is the main practical friction, and it is why configuration
belongs in the entry point, before anything else loads the module.

The `as` clause must come **before** `with`:

```scss
@use "theme" as t with ($brand: #16a34a);
```

## Private members

A member whose name starts with `-` or `_` is private to its module:

```scss
$-internal-scale: 1.25;      // not visible to consumers
$scale: $-internal-scale;    // this is
```

This gives a module a real public API — genuinely useful in a shared partial,
where otherwise every helper variable is part of the contract.

## `@forward`: building one entry point from many partials

`@use` makes a module's members available **only in the file that loaded it**.
So a barrel file needs `@forward`, not `@use`:

```scss
// _index.scss — the public face of the directory
@forward "tokens";
@forward "mixins";
@forward "typography";
```

```scss
// any consumer
@use "styles/index" as s;
// s.$brand, s.card-surface — everything the forwarded modules expose
```

`@forward` re-exports without making the members usable in the forwarding file
itself. If the barrel file also needs them, load both:

```scss
@forward "tokens";
@use "tokens";        // now usable here too
```

Sass looks for `_index.scss` (or `_index.sass`) automatically when a directory is
loaded, so `@use "styles"` finds `styles/_index.scss` — the convention worth
adopting.

### Narrowing what is forwarded

```scss
@forward "tokens" show $brand, card-surface;
@forward "internals" hide $-scratch, reset-hack;
@forward "buttons" as btn-*;      // prefixes every member
```

`as <prefix>-*` is how a library keeps a flat public API while organising its
source into many files.

## Why `@import` had to go

The Sass documentation positions `@use` as the modern replacement and `@import`
as legacy. The specific failures:

| `@import` problem | `@use` behaviour |
|---|---|
| everything lands in one global scope | members are namespaced |
| a file loaded twice is **emitted twice** | loaded once, emitted once |
| no way to tell where a variable came from | the namespace says |
| no private members | `-`/`_` prefix |
| load order silently determines overrides | configuration is explicit via `with` |

The duplicate-output problem is the one that bit hardest in practice: importing a
partial from two places emitted its CSS twice, and nobody noticed until the
bundle was inspected.

**Note:** `@use` is supported by dart-sass only, which is another reason
`node-sass` should be gone.

## Migrating

The official `sass-migrator` tool automates most of it:

```bash
npx sass-migrator module --migrate-deps src/styles.scss
```

It rewrites `@import` to `@use`, adds namespaces to every member reference, and
follows dependencies. It is not perfect on codebases that relied on global scope,
but it removes the mechanical work.

## Trade-off

**Namespacing buys traceability and costs terseness.** `tokens.$brand` says where
the value comes from, and it is longer than `$brand` at every single use site. In
a file that references twenty tokens, the noise is real, and the pressure toward
`as *` — which discards the main benefit — is genuine.

The configure-once rule is the sharper cost. In a large codebase it is easy to
have a partial loaded early by something unrelated, at which point configuring it
later is an error with a message that does not obviously point at the cause. The
fix — configure at the entry point before anything else — is a discipline the
tooling does not enforce.

Both costs are worth paying. Global scope with silent duplicate output is the
alternative, and it is worse in ways that are harder to detect.

## Gotchas

**"This module was already loaded, so it can't be configured using `with`."**
*Symptom:* an error on a `@use ... with`.
*Cause:* another file loaded the module first without configuration.
*Fix:* configure at the entry point, before any other `@use` of it.

**A variable is undefined despite being in a forwarded file.**
*Symptom:* "Undefined variable" in the barrel file itself.
*Cause:* `@forward` re-exports but does not make members usable locally.
*Fix:* add `@use` alongside the `@forward`.

**A variable cannot be configured.**
*Symptom:* `with` has no effect or errors.
*Cause:* the variable lacks `!default`.
*Fix:* add `!default` in the module.

**Name collisions after `as *`.**
*Symptom:* one module's `$radius` silently overrides another's.
*Cause:* `as *` removes namespacing.
*Fix:* use namespaces; reserve `as *` for a single local file.

**CSS appears twice in the output.**
*Symptom:* duplicated rules in the bundle.
*Cause:* `@import` used somewhere — `@use` cannot cause this.
*Fix:* migrate the remaining imports.

## Interview questions

**★ What problems does `@use` solve that `@import` had?**
Global scope, duplicate output when a file is loaded twice, no way to tell which
file a member came from, no private members, and configuration by load order.
`@use` namespaces members, loads each file exactly once, and makes configuration
explicit through `with`.

**★ What is the difference between `@use` and `@forward`?**
`@use` makes a module's members available **in the current file**. `@forward`
re-exports them to files that load *this* one, without making them usable here.
A barrel `_index.scss` uses `@forward`; a consumer uses `@use`.

**★ What are the two rules about `with` configuration?**
The target variable must be declared `!default`, and a module can be configured
only once — at its first load. If anything else loaded it unconfigured first, a
later `with` is an error, which is why configuration belongs at the entry point.

**How do you make part of a module private?**
Prefix the member with `-` or `_`. It remains usable inside the module and is not
exposed to consumers, which gives the module a real public API.

**What is `as *` and when is it appropriate?**
It loads a module without a namespace. The documentation limits it to stylesheets
you wrote yourself, because it reintroduces the name collisions namespacing
prevents — realistically, a single project-local shared partial.

**How do you migrate an existing `@import` codebase?**
`npx sass-migrator module --migrate-deps <entry>`, which rewrites imports to
`@use` and namespaces every reference. It needs review where the code relied on
global scope.

---

← [03 · Variables vs custom properties](./03-variables-sass-vs-custom-properties.md) · Next: [05 · Mixins](./05-mixins.md) →
