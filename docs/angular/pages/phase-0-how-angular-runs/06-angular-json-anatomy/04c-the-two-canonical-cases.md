---
title: "The two cases everyone meets first — an array that a configuration silently empties, and an object a boolean silently erases — worked all the way through with the effective options written out"
sidebar_label: "04c · The two canonical cases"
sidebar_position: 4.2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** —
> `getOptionsForTarget` in
> [`packages/angular_devkit/architect/node/node-modules-architect-host.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular_devkit/architect/node/node-modules-architect-host.ts),
> the option types in
> [`packages/angular/build/src/builders/application/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/application/schema.json),
> and the budget values written by
> [`packages/schematics/angular/application/index.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/index.ts),
> all at tag `v22.1.7`. Documentation-validated; **no sandbox run** — the effective option objects
> below are derived from the spread in the source, not captured from a build.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**[04b](04b-the-merge-is-shallow.md) gave the rule; this page shows it doing damage twice, in the
two shapes people hit first.** An array — `budgets` — where the instinct is that a configuration adds
to the list. And an option that accepts either a boolean or an object — `optimization` — where the
instinct is that setting the boolean leaves the object's sub-keys alone. Both instincts are wrong,
neither produces an error, and both are worth working through line by line rather than accepting as a
rule. The full inventory of shapes with the same problem is
[04d](04d-every-option-shape-the-rule-bites.md).

## Worked example 1 — budgets cannot be added to

```json
{
  "build": {
    "builder": "@angular/build:application",
    "options": {
      "tsConfig": "tsconfig.app.json",
      "budgets": [
        { "type": "initial", "maximumWarning": "500kB", "maximumError": "1MB" },
        { "type": "anyComponentStyle", "maximumWarning": "4kB", "maximumError": "8kB" }
      ]
    },
    "configurations": {
      "production": {
        "budgets": [{ "type": "bundle", "name": "vendor", "maximumError": "600kB" }]
      }
    }
  }
}
```

What the builder receives under `--configuration production`:

```json
{
  "tsConfig": "tsconfig.app.json",
  "budgets": [{ "type": "bundle", "name": "vendor", "maximumError": "600kB" }]
}
```

**The `initial` and `anyComponentStyle` budgets are gone.** Not merged, not appended — the array
under `budgets` was replaced by the array in the configuration. The build passes, the bundle grows,
and nothing warns you that two budgets stopped being enforced.

The fix is to repeat every entry you still want:

```json
{
  "configurations": {
    "production": {
      "budgets": [
        { "type": "initial", "maximumWarning": "500kB", "maximumError": "1MB" },
        { "type": "anyComponentStyle", "maximumWarning": "4kB", "maximumError": "8kB" },
        { "type": "bundle", "name": "vendor", "maximumError": "600kB" }
      ]
    }
  }
}
```

## Worked example 2 — a boolean replacing an object

`optimization` accepts either a boolean or an object with sub-keys. Configure the object form in
`options` and switch it off in a configuration, and the object does not survive:

```json
{
  "build": {
    "builder": "@angular/build:application",
    "options": {
      "tsConfig": "tsconfig.app.json",
      "optimization": {
        "scripts": true,
        "styles": { "minify": true, "inlineCritical": true },
        "fonts": { "inline": true }
      }
    },
    "configurations": {
      "development": { "optimization": false }
    }
  }
}
```

What the builder receives under `--configuration development`:

```json
{
  "tsConfig": "tsconfig.app.json",
  "optimization": false
}
```

That is usually what you wanted — development genuinely means "all of it off". The failure comes
later, when someone adds a `staging` configuration meaning "optimise, but keep font inlining off":

```json
{
  "configurations": {
    "staging": { "optimization": { "fonts": { "inline": false } } }
  }
}
```

The effective value there is exactly `{ "fonts": { "inline": false } }` — **`scripts` and `styles`
are no longer set at all**, and fall back to whatever the builder's own defaults are, not to what
`options` said. To keep them, restate them:

```json
{
  "configurations": {
    "staging": {
      "optimization": {
        "scripts": true,
        "styles": { "minify": true, "inlineCritical": true },
        "fonts": { "inline": false }
      }
    }
  }
}
```

## The pattern behind both

In the array case the base entries vanish. In the object case the base sub-keys vanish. In neither
case does the builder see anything from `options` for that key, and in neither case is there a
message. The generalisation worth carrying: **a configuration answers a key completely or not at
all.** There is no partial answer.

That is also why the two cases feel different but are not. `budgets: [...]` replacing `budgets:
[...]` looks like an obvious overwrite once stated; `optimization: false` replacing
`optimization: { … }` feels like a different kind of operation because the types differ. It is the
same operation. The spread does not inspect types.

## Gotchas

**★ Symptom: you add a `bundle` budget to `configurations.production` and the two default budgets
stop being enforced.** Cause: shallow spread — the array was replaced, not appended. Fix: repeat
every entry you still want in the configuration:

```json
{
  "configurations": {
    "production": {
      "budgets": [
        { "type": "initial", "maximumWarning": "500kB", "maximumError": "1MB" },
        { "type": "anyComponentStyle", "maximumWarning": "4kB", "maximumError": "8kB" },
        { "type": "bundle", "name": "vendor", "maximumError": "600kB" }
      ]
    }
  }
}
```

**★ Symptom: `configurations.development` sets `"optimization": false` and a carefully configured
`optimization.fonts.inline` in `options` stops applying.** Cause: the boolean replaced the object.
Fix: if you want partial optimisation, express the whole object in the configuration:

```json
{
  "configurations": {
    "development": {
      "optimization": { "scripts": false, "styles": { "minify": false }, "fonts": { "inline": false } }
    }
  }
}
```

**★ Symptom: a production build stops failing on bundle size after someone adds a budget.** Cause:
the added budget replaced the array containing `initial`, so the size limit that used to fail the
build is no longer declared. Nothing reports a removed budget — the build simply stops complaining.
Fix: restate every budget in the configuration that sets any of them:

```json
{
  "configurations": {
    "production": {
      "budgets": [
        { "type": "initial", "maximumWarning": "500kB", "maximumError": "1MB" },
        { "type": "anyComponentStyle", "maximumWarning": "4kB", "maximumError": "8kB" },
        { "type": "bundle", "name": "vendor", "maximumError": "600kB" }
      ]
    }
  }
}
```

**★ Symptom: a `staging` configuration meant to disable only font inlining also disables script and
style optimisation.** Cause: the partial `optimization` object replaced the full one from `options`;
the sub-keys it does not mention are absent, and the builder falls back to its own defaults rather
than to the base object. Fix: restate the whole object:

```json
{
  "configurations": {
    "staging": {
      "optimization": {
        "scripts": true,
        "styles": { "minify": true, "inlineCritical": true },
        "fonts": { "inline": false }
      }
    }
  }
}
```

**Symptom: the `anyComponentStyle` budget values in a generated file do not match the ones in the
documentation.** Cause: the two sources disagree. angular.dev's budget table states defaults of 2kb
warning and 4kb error for that type; the application schematic at `v22.1.7` writes 4kB/8kB under its
default `strict: true`, and 6kB/10kB under `--no-strict`. This topic reports both rather than
reconciling them. Fix: read your own file rather than the table, and state the values you want
explicitly:

```json
{
  "configurations": {
    "production": {
      "budgets": [
        { "type": "initial", "maximumWarning": "500kB", "maximumError": "1MB" },
        { "type": "anyComponentStyle", "maximumWarning": "4kB", "maximumError": "8kB" }
      ]
    }
  }
}
```

## Interview questions

**★ Can you add a budget in a configuration and keep the defaults?**
No. `budgets` is an array, so a configuration that sets it replaces the whole array — the entries in
`options` are discarded. To have three budgets under production you must write all three in the
production configuration. This is the most commonly hit instance of the rule because it fails
silently: budgets that stop being enforced do not produce an error, they produce a build that no
longer complains about size.

**★ What happens to a nested `optimization` object when a configuration sets `"optimization": false`?**
The whole object is gone. `false` replaces it, so any `scripts`, `styles` or `fonts` sub-configuration
in `options` no longer applies. The same happens in reverse: a configuration setting
`"optimization": { "fonts": { "inline": false } }` does not inherit `scripts` and `styles` from
`options` — those keys are simply absent from the effective value and fall back to the builder's own
defaults, not to what `options` said.

**★ Why do the array case and the boolean-replacing-an-object case behave the same way when they look
so different?**
Because the spread does not inspect types. `{ ...base, ...override }` assigns the override's value for
every key the override names, whatever that value is — an array, an object, a boolean or a string. The
array case reads as an obvious overwrite once you see it; the boolean case feels like a different
operation because the types differ, and that intuition is what makes it dangerous. Saying "a
configuration answers a key completely or not at all" covers both without needing to think about
types.

**Someone reports that a production build stopped enforcing a size limit and nothing in the budget
configuration was deleted. What happened?**
Almost certainly a budget was *added*. Adding an entry to `configurations.production.budgets` replaces
the whole array, so any budget that was previously there and is not restated in the new array stops
existing. No message is produced — a removed budget is not an error, it is simply a limit that is no
longer declared — so the symptom is a build that stops complaining rather than one that starts
failing. The fix is to restate every entry, and the preventive measure is to treat any array inside a
configuration as a complete answer that must be reviewed in full.

**Where should budgets live — `options` or a configuration?**
In the configurations that produce comparable output, which in practice means production and anything
production-like. Putting them in `options` applies them to every run of the target, including
development builds, which are unoptimised and therefore much larger; the budget then fails for
reasons that have nothing to do with the change being tested. This is a good illustration of the
general placement rule: `options` is for what is true whenever the target runs, and a size limit that
only makes sense against optimised output is not.

{/* FOOTER */}
