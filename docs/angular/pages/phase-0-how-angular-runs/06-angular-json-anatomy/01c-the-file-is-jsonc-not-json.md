---
title: "`angular.json` is parsed as JSONC, so comments and trailing commas are legal to the CLI and fatal to every other tool that reads the same file"
sidebar_label: "01c · It is JSONC, not JSON"
sidebar_position: 1.2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** —
> [`packages/angular_devkit/core/src/workspace/json/reader.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular_devkit/core/src/workspace/json/reader.ts)
> at tag `v22.1.7`, and the `angular.json` example published on
> [angular.dev/tools/cli/serve](https://angular.dev/tools/cli/serve).
> Documentation-validated; **no sandbox run** — the parser call below is transcribed from the
> workspace reader's source.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**The file is named `.json` and is not parsed as JSON.** The workspace reader hands it to
`jsonc-parser` with comments and trailing commas explicitly permitted, which means a `//` line in
`angular.json` is a supported, documented thing that angular.dev's own examples use. It also means
the file will pass `ng build` and fail the `jq` step in your pipeline, the `JSON.parse` in your
release script, and any validator that assumes the extension tells the truth. Both halves of that
are true simultaneously, and the mismatch is what turns a helpful comment into a broken deploy.

## The parser call, and the two options that matter

The workspace reader imports `jsonc-parser` directly:

```ts
import { Node, findNodeAtLocation, getNodeValue, parseTree } from 'jsonc-parser';
```

and calls it with both leniencies switched on:

```ts
const ast = parseTree(raw, undefined, { allowTrailingComma: true, disallowComments: false });
```
— [`packages/angular_devkit/core/src/workspace/json/reader.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular_devkit/core/src/workspace/json/reader.ts) at `v22.1.7`

Read the second option carefully, because it is a double negative and it is routinely misread:
`disallowComments: false` means **comments are allowed**. Together the two options give you:

- `//` line comments and `/* */` block comments, anywhere JSON permits whitespace;
- a trailing comma after the last member of an object or array.

`jsonc-parser` is not an optional extra pulled in for a corner case — it is a direct dependency of
both `@angular/cli` and `@angular/build`, pinned at `3.3.1`. If you have an Angular workspace
installed, the exact parser the CLI uses is already in your `node_modules`.

## angular.dev's own example has a comment in it

This is reproduced from the published `ng serve` page, comment included:

```json
{
  "projects": {
    "my-app": {
      "architect": {
        // `ng serve` invokes the Architect target named `serve`.
        "serve": {
          "builder": "@angular/build:dev-server"
        }
      }
    }
  }
}
```
— reproduced from [angular.dev/tools/cli/serve](https://angular.dev/tools/cli/serve)

So this is not a tolerated accident. The documentation teaches the file with a comment in it, which
settles the question of whether comments are supported. (That the same example uses `architect`
rather than `targets` is a separate matter, and it is [02d](02d-architect-or-targets.md)'s.)

## What the leniency costs you

Everything downstream of `angular.json` that is not the Angular CLI parses it as strict JSON by
default. The list is longer than people expect:

| Consumer | Behaviour on a comment or trailing comma |
|---|---|
| `ng build`, `ng serve`, `ng generate` | fine — this is the documented format |
| `JSON.parse()` in your own scripts | throws |
| `jq` in a CI step | fails |
| A JSON schema validator run as a lint gate | fails before it validates anything |
| An editor with the file associated as strict `json` | red squiggle on a legal file |
| A formatter configured to treat the file as strict JSON | may delete the comment on save |

🔴 **The dangerous member of that list is the last one**, because it does not fail — it silently
removes the thing you wrote. A comment that disappears on save is not an error anybody reports; it
is just information that stops existing.

## Reading it correctly from your own tooling

If you have a script that reads `angular.json`, use the parser the CLI uses rather than
`JSON.parse`. It is already installed, and this is the same three-function surface the reader
itself imports:

```js
// scripts/list-projects.mjs
import { readFileSync } from 'node:fs';
import { parseTree, getNodeValue } from 'jsonc-parser';

const raw = readFileSync('angular.json', 'utf-8');
const ast = parseTree(raw, undefined, { allowTrailingComma: true, disallowComments: false });

if (!ast) {
  throw new Error('angular.json did not parse as JSONC');
}

const workspace = getNodeValue(ast);
for (const name of Object.keys(workspace.projects ?? {})) {
  process.stdout.write(name + '\n');
}
```

Passing the same two options is the point: a default `parseTree` call is not necessarily as lenient
as the CLI's, and matching the CLI exactly is what makes your script agree with `ng` about whether
a file is valid.

**Whether comments survive a write-back was not confirmed.** The reader keeps AST node metadata
around — that is why `findNodeAtLocation` appears in its imports — and the CLI does rewrite
`angular.json` during commands such as `ng generate library`. What happens to a comment in a
rewritten region was not traced against the source for this page. Treat comments in `angular.json`
as something you might have to re-add after a schematic runs.

## Gotchas

**★ Symptom: a CI step that pipes `angular.json` through `jq` starts failing, and `ng build` is
fine.** Cause: someone added a `//` comment or a trailing comma, which the CLI accepts and `jq`
does not. Fix: read the file with the CLI's own parser instead of a strict-JSON tool:

```js
import { readFileSync } from 'node:fs';
import { parseTree, getNodeValue } from 'jsonc-parser';

const ast = parseTree(readFileSync('angular.json', 'utf-8'), undefined, {
  allowTrailingComma: true,
  disallowComments: false,
});
const outputPath = getNodeValue(ast).projects.storefront.targets.build.options.outputPath;
process.stdout.write(String(outputPath) + '\n');
```

**★ Symptom: `JSON.parse` throws `Unexpected token /` on a workspace file the CLI builds happily.**
Cause: the extension says JSON, the parser is JSONC. Fix: swap the parse call — `jsonc-parser` is
already a transitive install of every Angular workspace, so no new dependency is required:

```js
// before: JSON.parse(readFileSync('angular.json', 'utf-8'))
import { parseTree, getNodeValue } from 'jsonc-parser';
const workspace = getNodeValue(
  parseTree(readFileSync('angular.json', 'utf-8'), undefined, {
    allowTrailingComma: true,
    disallowComments: false,
  }),
);
```

**★ Symptom: a comment you added to `angular.json` disappeared and nobody edited the file.** Cause:
a formatter or an editor action treated the file as strict JSON and normalised it on save. Fix:
tell the editor the file is JSON-with-comments so that both the linter and the formatter agree with
the CLI. The VS Code form of that association is:

```json
{
  "files.associations": {
    "angular.json": "jsonc",
    ".angular.json": "jsonc"
  }
}
```

**Symptom: your editor marks a legal comment in `angular.json` as a syntax error.** Cause: the same
association problem, seen from the linting side rather than the formatting side. Fix: the
association above; if your editor has no JSONC mode, do not use comments in this file at all,
because the tooling around it will keep disagreeing with the CLI.

**Symptom: a trailing comma left by a merge conflict resolution breaks a deploy script but not the
build.** Cause: `allowTrailingComma: true`. The CLI never told you the file was malformed because,
by its rules, it was not. Fix: validate the file with the same parser in a pre-commit or CI step so
the two agree:

```js
import { readFileSync } from 'node:fs';
import { parseTree } from 'jsonc-parser';

const errors = [];
parseTree(readFileSync('angular.json', 'utf-8'), errors, {
  allowTrailingComma: true,
  disallowComments: false,
});
if (errors.length > 0) {
  throw new Error(`angular.json has ${errors.length} parse error(s)`);
}
```

**Symptom: a team reads `disallowComments: false` and concludes comments are forbidden.** Cause:
the double negative. `disallowComments` set to `false` disallows nothing. Fix: nothing to change in
the file — but if you are documenting this for a team, write the positive form: **comments are
allowed, trailing commas are allowed.**

**Symptom: a JSON-schema lint gate reports zero validation results on `angular.json` rather than
passing it.** Cause: many validators parse before they validate, and a parse failure short-circuits
the run — so a file with a comment produces "could not read" rather than "invalid". Fix: give the
validator a strict-JSON rendering, produced from the same parser, rather than the source file:

```js
import { readFileSync, writeFileSync } from 'node:fs';
import { parseTree, getNodeValue } from 'jsonc-parser';

const ast = parseTree(readFileSync('angular.json', 'utf-8'), undefined, {
  allowTrailingComma: true,
  disallowComments: false,
});
writeFileSync('angular.strict.json', JSON.stringify(getNodeValue(ast), null, 2));
```

**Symptom: comments used to explain a configuration are gone after `ng generate library` or a
migration.** Cause: the CLI rewrites `angular.json` during those commands, and **whether comments
in a rewritten region are preserved was not confirmed** for this page. Fix: do not rely on
`angular.json` comments as the only home for a decision — record it where a schematic will not
touch it, and treat any comment in the workspace file as expendable:

```markdown
### docs/decisions/0007-build-budgets.md

The `initial` budget is 500 kB because the storefront's landing route must stay
under the CDN's edge-cache threshold. See `angular.json`, `projects.storefront`.
```

**Symptom: a colleague insists comments in `angular.json` are "a hack that happens to work".**
Cause: the extension. Fix: nothing in code — point at the parser options and at angular.dev's own
`ng serve` example, which ships a `//` comment inside an `angular.json` snippet. It is documented
behaviour, and the only real caution is about the *other* tools that read the file.

## Interview questions

**★ Is it valid to put comments in `angular.json`?**
Yes, for the CLI. The workspace reader parses the file with `jsonc-parser` and passes
`{ allowTrailingComma: true, disallowComments: false }`, so line comments, block comments and
trailing commas are all accepted, and angular.dev's own `ng serve` page publishes an `angular.json`
example with a `//` comment in it. The caveat is that nothing else in a typical toolchain agrees:
`JSON.parse`, `jq`, schema validators and strict-JSON formatters all reject or destroy the same
file. So the honest answer is "valid, and risky for reasons that have nothing to do with Angular".

**★ A script does `JSON.parse(readFileSync('angular.json'))` and started throwing. What happened and
how do you fix it properly?**
Someone added a comment or a trailing comma, both of which the CLI accepts. The wrong fix is to
delete the comment, because the file is legal and the next person will add another one. The right
fix is to parse with the same parser the CLI uses — `jsonc-parser`, already installed as a direct
dependency of `@angular/cli` and `@angular/build` at 3.3.1 — and to pass the same two options, so
that your script's definition of "valid workspace file" matches `ng`'s exactly.

**What does `disallowComments: false` mean, and why does that phrasing matter?**
It means comments are *allowed*: it is a double negative, and the flag name describes the
restriction being switched off. It matters because the option is quoted in issue threads and
migration notes without its value, and people reading `disallowComments` in isolation conclude the
opposite of the truth. Whenever you write this down for a team, state the positive: comments and
trailing commas are legal in `angular.json`.

**Why is a formatter more dangerous here than a linter?**
A linter reports and stops; a formatter rewrites. A formatter that has the file associated as
strict JSON will normalise it on save, and normalising strict JSON means dropping comments. Nothing
fails, nothing is logged, and the information is gone — so the reason the budget is 500 kB, or the
reason a proxy target points where it does, quietly stops existing. That is why the editor
association is the fix worth making, rather than a rule about not writing comments.

**Should a team use comments in `angular.json`?**
Sparingly, and never as the only record of a decision. They are supported by the CLI, so they will
not break a build, but they are exposed to three separate hazards: tools that parse the file
strictly, formatters that strip them, and schematics that rewrite regions of the file — with the
last of those unconfirmed either way. A comment that points at a durable document is a good use; a
comment that *is* the document is not.

---

← Prev: [The global config file](01b-the-global-config-is-a-different-file.md) · Index: [Topic index](README.md) · Next → [The six top-level keys](01d-version-and-the-six-top-level-keys.md)
