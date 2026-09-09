---
title: "Everything `fileReplacements` substitutes is bundled into the client and visible to anyone who loads the page — the documentation flags that CRITICAL, and no configuration, flag or build mode changes it"
sidebar_label: "07d · Secrets, conflicts, alternative"
sidebar_position: 7.3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — the CRITICAL security note quoted verbatim
> from [angular.dev/tools/cli/environments](https://angular.dev/tools/cli/environments); the
> conflict-handling source read from
> [`packages/schematics/angular/environments/index.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/environments/index.ts)
> and the `conditions` option from
> [`packages/angular/build/src/builders/application/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/application/schema.json),
> both at tag `v22.1.7`; the replacement hint quoted verbatim from
> [angular.dev/tools/cli/build-system-migration](https://angular.dev/tools/cli/build-system-migration).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**The environments mechanism is a build-time substitution of client source code, which means every
value it can carry is a public value.** That is not a caveat; it is what the mechanism *is*, and
the documentation escalates it to CRITICAL. This page covers the three things that sit around
`fileReplacements` rather than inside it: what must never go in an environment file, what the
schematic does when your entry and its entry disagree, and the newer mechanism the migration guide
suggests can replace the option entirely.

## The security note, reproduced rather than paraphrased

> *"CRITICAL: Files in `src/environments/` are bundled into your client-side application and visible
> to anyone who loads the page. Never store secrets such as API keys here. Use a server-side proxy
> or a secrets manager instead."*

🔴 **There is no build mode that changes this.** Minification renames identifiers, it does not
remove string literals. Production optimisation does not encrypt anything. Putting the value in a
configuration that only CI runs does not help, because the value still ends up in the artefact CI
publishes. The mechanism substitutes a *source file*, and source files become bundles.

The two remedies the documentation names are the two that exist:

- **A server-side proxy.** The browser calls your server; your server holds the credential and
  calls the third party. During development that is what
  [`proxyConfig`](../05-the-build-angular-build/06j-proxying-to-a-backend.md) stands in for.
- **A secrets manager**, read by that server at runtime — never at build time, because a value read
  at build time is a value in the bundle.

What *does* legitimately belong in an environment file is anything a user could read off the
network anyway: a public API base URL, a feature flag, a public analytics key that is scoped and
revocable, a build channel name.

## What the schematic does when your entry disagrees with its entry

`ng generate environments` is idempotent, and it is polite about hand edits. Verbatim from the
environments schematic at `v22.1.7`:

```ts
const replacements = (configurationOptions['fileReplacements'] ??= []) as {
  replace: string;
  with: string;
}[];
const existing = replacements.find((value) => value.replace === defaultFilePath);
if (existing) {
  if (existing.with === configurationFilePath) {
    yield log('info',
      `Skipping addition of already existing file replacements option for "${defaultFilePath}" to "${configurationFilePath}".`);
  } else {
    yield log('warn',
      `Configuration "${name}" has a file replacements option for "${defaultFilePath}" but with a different replacement.` +
        ` Expected "${configurationFilePath}" but found "${existing.with}". This may result in unexpected build behavior.`);
  }
} else {
  replacements.push({ replace: defaultFilePath, with: configurationFilePath });
}
```

Three behaviours, and the third is the important one:

1. **Exact match** → an `info` message beginning
   `Skipping addition of already existing file replacements option for`. Nothing changes.
2. **Same `replace`, different `with`** → a `warn` beginning
   `Configuration "<name>" has a file replacements option for` and ending
   `This may result in unexpected build behavior.` **Nothing changes.**
3. **No entry** → the entry is pushed.

🔴 **Case 2 warns and then leaves your entry in place.** The schematic will not overwrite a hand
edit, which is the right default — but it means the warning is the *only* signal that the workspace
now has a replacement the tooling did not expect, and a warning in a generate run is exactly the
kind of line that scrolls past.

Note also `configurationOptions['fileReplacements'] ??= []`: the schematic creates the array when
it is absent, so running it against a configuration that has none is safe.

## The alternative the migration guide points at

The build system migration guide, describing import and export conditions, says:

> *"HELPFUL: If currently using the `fileReplacements` build option, this feature may be able to
> replace its usage."*

The `application` builder declares a `conditions` option — an array, with no default declared in
the schema — which participates in that mechanism. The feature itself belongs to
[topic 05 · 10 · Features only this builder has](../05-the-build-angular-build/10-features-only-this-builder-has.md);
what matters here is the shape of the trade:

| | `fileReplacements` | import conditions |
|---|---|---|
| Where the mapping lives | `angular.json`, once per configuration | the package manifest, once |
| What it can swap | files in the TypeScript program only | whatever the resolver can resolve |
| What selects it | `--configuration` | a resolution condition |
| Editing cost per new environment | a configuration entry | none, if the condition already exists |

⚠️ **The guide says the feature *"may be able to"* replace `fileReplacements`, not that it does.**
This page reproduces that hedge rather than removing it: no source examined here states that
conditions cover every `fileReplacements` use case, and the option remains fully supported and
fully documented at 22.1.7.

## Gotchas

**★ Symptom: an API key from an environment file turns up in the shipped bundle.** Cause: it was
always going to — environment files are client source, and the substitution happens before
bundling. Fix: the key does not go in the client at all; the client calls your server, which holds
it:

```ts
// src/environments/environment.ts — public values only
export const environment = {
  production: true,
  apiUrl: 'https://api.example.com',
};
```

**★ Symptom: `Configuration "staging" has a file replacements option for "src/environments/environment.ts"
but with a different replacement.` appears during `ng generate environments`.** Cause: a
hand-written entry pointing somewhere the schematic did not expect. It is a warning; the schematic
will not overwrite you. Fix: decide which one is right and make the file say it explicitly:

```json
{
  "configurations": {
    "staging": {
      "fileReplacements": [
        { "replace": "src/environments/environment.ts", "with": "src/environments/environment.staging.ts" }
      ]
    }
  }
}
```

**★ Symptom: someone "protects" a key by moving it into a configuration only CI builds.** Cause:
the artefact CI publishes is the artefact users download — restricting *who runs the build* does
nothing about *what is in the output*. Fix: remove the value from the client entirely and proxy the
call:

```ts
// the client calls your own origin; the credential never leaves the server
fetch('/api/third-party/search?q=angular');
```

**★ Symptom: `define` is used for the key instead, on the theory that it is "compile-time".** Cause:
`define` substitutes a literal into the bundle at build time, which is the same exposure by a
different route. Fix: same answer — a server holds it. `define` is for genuinely public build-time
values:

```json
{ "options": { "define": { "APP_BUILD_CHANNEL": "\"staging\"" } } }
```

**★ Symptom: secrets were moved into a `.env` file and `fileReplacements` cannot read it.** Cause:
the schema's extension pattern accepts only JavaScript, TypeScript and JSON
([07](07-file-replacements.md)) — and even if it accepted `.env`, the contents would end up in the
bundle. Fix: `.env` belongs to your server process, not to the client build:

```json
{ "replace": "src/environments/environment.ts", "with": "src/environments/environment.staging.ts" }
```

**Symptom: `Skipping addition of already existing file replacements option for …` and someone
re-runs the schematic expecting it to repair the entry.** Cause: that message means the entry
already matches exactly; the schematic has nothing to do. Fix: nothing — if the entry is wrong,
edit it, because the schematic will neither overwrite nor remove it.

**Symptom: a migration to import conditions leaves `fileReplacements` in place and the two
mechanisms disagree.** Cause: they are independent — nothing removes the `angular.json` entries
when a condition-based resolution is added. Fix: remove the entries in the same change, so exactly
one mechanism decides which file is used:

```json
{ "configurations": { "development": { "optimization": false, "sourceMap": true } } }
```

**Symptom: a public analytics key in an environment file is treated as a secret in a security
review.** Cause: the distinction is not "is it a key" but "can a user read it from the network
anyway". Fix: document the classification next to the value, so the next reviewer does not have to
re-derive it:

```ts
export const environment = {
  production: true,
  // Public, origin-scoped and revocable — safe to ship.
  analyticsKey: 'pub_1a2b3c',
};
```

## Interview questions

**★ Why can an API key never live in an environment file, even in one only production uses?**
Because `fileReplacements` substitutes a client source file before the build, and client source
becomes a bundle the browser downloads. The documentation flags this CRITICAL and says it directly:
files in `src/environments/` are *"bundled into your client-side application and visible to anyone
who loads the page."* No build mode changes it — minification renames identifiers but keeps string
literals, and restricting who runs the build does nothing about what is in the output. The remedies
are the two the documentation names: a server-side proxy, or a secrets manager read by a server at
runtime.

**★ What does `ng generate environments` do when a configuration already has a `fileReplacements`
entry for the same file?**
It compares the `with` side. If it matches, it logs an `info` message beginning
`Skipping addition of already existing file replacements option for` and changes nothing. If it
differs, it logs a `warn` beginning `Configuration "<name>" has a file replacements option for` and
ending `This may result in unexpected build behavior.` — and still changes nothing. The schematic
never overwrites a hand edit, which is the correct default but means the warning is the only signal
that your workspace and the tooling's expectation have diverged.

**★ Is `define` a safer place for a secret than an environment file?**
No, and the reasoning is identical. `define` substitutes a literal value into the bundle at build
time; the value ends up in the shipped JavaScript exactly as an environment-file value does. It is
a good mechanism for genuinely public build-time facts — a build channel, a version string, a
feature flag — and no mechanism that runs at build time can be a good mechanism for a secret,
because the output of a build is a public artefact.

**What alternative to `fileReplacements` does the migration guide suggest, and how firm is the
suggestion?**
Import and export conditions, resolved through the package manifest rather than through
`angular.json`. The guide's wording is a hedge — *"If currently using the `fileReplacements` build
option, this feature may be able to replace its usage."* — and this corpus keeps the hedge, because
no source examined states that conditions cover every use case. The trade is real, though: the
mapping lives in one place instead of once per configuration, and it is not restricted to the
TypeScript program's extensions. `fileReplacements` remains fully supported at 22.1.7.

**Why is a mismatched `fileReplacements` entry a warning rather than an error?**
Because a hand-written entry is a legitimate thing to have, and the schematic is not in a position
to know which of the two is intended. Erroring would make `ng generate environments` unusable in
any workspace with a customised configuration; overwriting would silently discard a deliberate
edit. Warning and leaving the file alone is the only option that preserves the user's intent — at
the cost that the signal is a single line in a command's output.

**Which values legitimately belong in an environment file?**
Anything a user could obtain from the network anyway: a public API base URL, a feature flag, a
build channel, a scoped and revocable public key. The test is not whether the value looks like a
credential but whether knowing it grants any capability the user does not already have. Writing
that classification down next to the value, in a comment, saves the next security review from
re-deriving it and stops a genuinely public key being "fixed" into a server round-trip nobody
needed.

---

← Prev: [Adding an environment](07c-adding-a-new-environment.md) · Index: [Topic index](README.md) · Next → [Budgets: the seven types](08-budgets-the-seven-types.md)
