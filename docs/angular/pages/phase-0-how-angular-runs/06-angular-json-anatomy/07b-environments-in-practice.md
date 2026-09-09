---
title: "`ng generate environments` writes the whole mechanism for you, and the one rule that makes it work is counter-intuitive: your components must import the file that gets replaced, never the replacement"
sidebar_label: "07b · Environments in practice"
sidebar_position: 7.1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — the generated layout, the environment files,
> the configuration entry, the import rule and the consumption example are quoted verbatim from
> [angular.dev/tools/cli/environments](https://angular.dev/tools/cli/environments); the
> `fileReplacement` definition is read from
> [`packages/angular/build/src/builders/application/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/application/schema.json)
> at tag `v22.1.7`.
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**The environments mechanism has exactly one rule that is easy to get backwards, and getting it
backwards produces a build that succeeds and silently uses the wrong values.** Your components
import `environment.ts` — the file that is *replaced* — never `environment.development.ts`, the
file that replaces it. This page runs the generated setup end to end and names the trap that
catches every second attempt. The field it configures is
[07 · `fileReplacements`](07-file-replacements.md); adding an environment of your own is
[07c](07c-adding-a-new-environment.md).

## What `ng generate environments` produces

```bash
ng generate environments
```

The layout the documentation shows for a workspace that has run it, with a staging environment
added:

```text
my-app/src/environments
├── environment.development.ts
├── environment.staging.ts
└── environment.ts
```

`environment.ts` is the default — the file every component imports, and the one that is *replaced*:

```ts
export const environment = {
  production: true,
  apiUrl: 'http://my-prod-url',
};
```

`environment.development.ts` is the substitute chosen by the `development` configuration:

```ts
export const environment = {
  production: false,
  apiUrl: 'http://my-dev-url',
};
```

and the configuration entry the schematic writes into `angular.json`:

```json
{
  "configurations": {
    "development": {
      "fileReplacements": [
        {
          "replace": "src/environments/environment.ts",
          "with": "src/environments/environment.development.ts"
        }
      ]
    }
  }
}
```

🔴 **Note the direction.** `replace` names the file your code imports; `with` names the substitute.
The default file holds the **production** values and the development configuration is what
deviates — the same shape as everything else in a generated workspace, where `options` carries the
common case and a configuration carries the exception.

## The import rule

Consumption is an ordinary import of the **default** file:

```ts
import {environment} from './../environments/environment';

// Fetches from `http://my-prod-url` in production, `http://my-dev-url` in development.
fetch(environment.apiUrl);
```

and the documentation is explicit about why:

> *"To use the environment configurations you have defined, your components must import the original
> environments file … This ensures that the build and serve commands can find the configurations for
> specific build targets."*

🔴 **Importing `environment.development.ts` directly is the failure that does not fail.** The build
succeeds, the types are right, the values are wrong in every configuration except the one you were
testing, and nothing anywhere reports a problem. `fileReplacements` substitutes a *path*; it has no
idea what your import statements say and cannot warn you that they bypass it.

The mechanical reason is worth holding on to: the replacement is applied to the file **before** the
compiler sees the program. If your import resolves to a path that is not on the left-hand side of
any entry, there is nothing to substitute and the import simply gets the file it named.

## Gotchas

**★ Symptom: the replacement never happens, but the build succeeds and the values are wrong.**
Cause: a component imported `environment.development.ts` directly instead of `environment.ts`, so
no path matched the entry's `replace` side. Fix: import the original everywhere, exactly as the
documentation requires:

```ts
import { environment } from '../environments/environment';
```

**★ Symptom: a new field added to `environment.staging.ts` is a type error at every usage site.**
Cause: each environment file declares its own object literal, so their inferred types can diverge —
the file the compiler sees is whichever one the configuration substituted. Fix: give them a shared
declared type so a missing key is an error in the file that is missing it, not at the usage site:

```ts
// src/environments/environment.model.ts
export interface Environment {
  production: boolean;
  apiUrl: string;
}
```

```ts
// src/environments/environment.staging.ts
import { Environment } from './environment.model';

export const environment: Environment = {
  production: false,
  apiUrl: 'https://staging.example.com/api',
};
```

**★ Symptom: `production: false` in a production build.** Cause: the flag is an ordinary property
in a file, not a value the CLI sets — the generated `environment.ts` happens to declare
`production: true` because it is the *default* file. If someone reorganised the files so that the
production values live in a replacement, the default now holds development values. Fix: keep the
production values in the file that is replaced, and let every configuration deviate from it:

```ts
// src/environments/environment.ts — the DEFAULT, holds production values
export const environment = { production: true, apiUrl: 'https://api.example.com' };
```

**Symptom: `ng generate environments` did nothing visible in a workspace that already had
environment files.** Cause: it is idempotent for entries that already match; the schematic checks
for an existing replacement of the same file before adding one. Fix: nothing — the details of that
check, including the message it emits, are
[07d](07d-secrets-conflicts-and-the-alternative.md).

**Symptom: the development build reads production values after someone deleted the `development`
configuration to "simplify" the file.** Cause: with no configuration there is no replacement, and
the default file is the production one. Fix: keep the configuration; if you want fewer of them,
delete the *files* and the entries together:

```json
{
  "configurations": {
    "development": {
      "optimization": false,
      "extractLicenses": false,
      "sourceMap": true,
      "fileReplacements": [
        { "replace": "src/environments/environment.ts", "with": "src/environments/environment.development.ts" }
      ]
    }
  }
}
```

**Symptom: environment values differ between `ng serve` and `ng build` in ways nobody expected.**
Cause: two different configurations are in play — `serve` defaults to `development` and `build`
defaults to `production`, so the two commands substitute different files by design. Fix: expected;
if you need to reproduce a production build locally, name it on both sides:

```bash
ng serve --configuration production
```

## Interview questions

**★ Why must components import `environment.ts` rather than the environment file for their
target?**
Because `fileReplacements` substitutes a path before the build runs, and it can only substitute a
path that something imports. If a component imports `environment.development.ts` directly, that
path never appears on the `replace` side of any entry, so nothing is substituted and the component
gets development values in every configuration — including production. The documentation states the
rule directly: components *"must import the original environments file"*. It is the rare case where
the failure is completely silent: the build succeeds, the types are correct, and the values are
wrong.

**★ What is the direction of a `fileReplacements` entry, and why does the default file hold the
production values?**
`replace` names the file your source imports; `with` names the file substituted in. The generated
setup puts production values in `environment.ts` — the default — and has the `development`
configuration replace it. That matches the rest of the workspace, where the base case is in
`options` and the deviation is in a configuration. It also fails in the less harmful direction: a
forgotten configuration gives you production values in a development build, which someone notices
immediately, rather than development values in production, which nobody notices until a customer
does.

**How would you keep several environment files from drifting apart in shape?**
Declare a shared interface in its own module and annotate each environment object with it. Without
that, each file is an independent object literal whose inferred type is whatever it happens to
contain, so a key added to one and forgotten in another produces an error at the *usage* site in
one configuration and no error at all in the other. With the interface, the error appears in the
file that is missing the key, in every configuration, which is where you can act on it.

**Why do `ng serve` and `ng build` produce different environment values by default?**
Because they have different `defaultConfiguration` values — `development` on the serve target,
`production` on the build target — and the environment file is selected by whichever configuration
applies. That is intentional: serving should give you the development backend, building should give
you the production one. It surprises people the first time only because the mechanism that selects
the file is two indirections away from the file itself.

**Is `production: true` a value Angular sets?**
No. It is an ordinary property of an object literal in a file you own; the CLI never reads or
writes it. It appears in the generated `environment.ts` purely as a convention, and it is correct
only for as long as the default file continues to hold production values. Reorganise the files so
production lives in a replacement and `production: true` becomes a lie in every build that does not
name that configuration.

---

← Prev: [fileReplacements](07-file-replacements.md) · Index: [Topic index](README.md) · Next → [Adding an environment](07c-adding-a-new-environment.md)
