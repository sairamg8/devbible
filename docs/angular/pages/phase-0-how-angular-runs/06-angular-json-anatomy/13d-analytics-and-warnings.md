---
title: "`analytics` and `warnings` are the two `cli` keys about what the CLI reports — one to Google, one to you — and each is dangerous for the opposite reason: a string that is an identity, and a warning that is easier to silence than to fix"
sidebar_label: "13d · `analytics` and `warnings`"
sidebar_position: 13.3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** —
> [`packages/angular/cli/lib/config/workspace-schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/lib/config/workspace-schema.json)
> at tag `v22.1.7`, cross-read against
> [angular.dev — Angular CLI configuration options](https://angular.dev/reference/configs/workspace-config#angular-cli-configuration-options),
> which supplies the defaults the schema omits. Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Neither of these keys can change what a build produces, which is exactly why they are the two most
commonly set thoughtlessly.** `analytics` decides whether the CLI reports usage, and its string form
is an identity that propagates every time the file is copied. `warnings` decides whether the CLI
tells *you* about a version split between the global and local CLI, and turning it off is the
canonical example of fixing the message instead of the problem.

## `analytics` — a boolean, or a pseudonymous identifier

The schema types it as two things at once:

```json
"analytics": {
  "type": ["boolean", "string"],
  "description": "Share pseudonymous usage data with the Angular Team at Google."
}
```

angular.dev's table row explains what the two types mean, verbatim, and supplies the default:

> *"| `analytics` | Share anonymous usage data with the Angular Team. A boolean value indicates
> whether or not to share data, while a UUID string shares data using a pseudonymous identifier. |
> `boolean` \| `string` | `false` |"*

Two things in that pair of quotes are worth noticing.

**The two sources use different adjectives for the same key.** The schema says *"pseudonymous"*; the
table's summary sentence says *"anonymous"*. The table's own longer text reconciles them by attaching
*"pseudonymous"* specifically to the string form — so the reading that fits both is: the boolean is a
plain on/off, and the string adds a stable identifier to what is reported. Quoting both is
deliberate here; paraphrasing one of them would flatten a distinction the sources are actually
making.

**The documented default is `false`.** So the key's absence is not an unresolved question — it is a
documented state, and adding the key changes behaviour in one direction only.

### 🔴 The string form is a footgun about copying

A UUID is an identity, and `angular.json` is a file people copy. Since [nothing generates a `cli`
block at all](13b-where-the-cli-block-comes-from.md), copying is essentially the only way the block
travels between repositories — so the identifier travels with it, and two unrelated projects report
under one identity.

If you are recording a decision in a repository that will be forked, templated, or scaffolded from,
use the boolean:

```json
{
  "$schema": "./node_modules/@angular/cli/lib/config/schema.json",
  "version": 1,
  "cli": { "analytics": false },
  "projects": {}
}
```

The distinction between this key and the equivalent state in the machine-wide config file matters
too: a workspace value is a statement about the repository, checked into version control and shared
by everyone; the machine-wide file is per-developer and is not in the repository at all. See
[01b](01b-the-global-config-is-a-different-file.md) for which file owns which kind of decision.

## `warnings` — one switch, and it is closed around it

`warnings` is an object with exactly one property at 22.1.7:

```json
"warnings": {
  "description": "Control CLI specific console warnings",
  "type": "object",
  "properties": {
    "versionMismatch": {
      "description": "Show a warning when the global version is newer than the local one.",
      "type": "boolean"
    }
  },
  "additionalProperties": false
}
```

angular.dev supplies both defaults the schema omits:

> *"| `warnings` | Control Angular CLI specific console warnings. | Warnings options | `{}` |"*

> *"| `versionMismatch` | Show a warning when the global Angular CLI version is newer than the local
> one. | `boolean` | `true` |"*

The shape is informative on its own. `warnings` is a *namespace* for individually controllable
console warnings, and it is closed — so the set is enumerable, and a warning switch you remember
from an older CLI is now a validation error rather than a leftover the file tolerates.

### What the warning is actually telling you

There are two copies of the CLI in play whenever you type `ng`: the **global** one your shell
resolves on `PATH`, and the **local** one in the workspace's `node_modules` that the project pins.
When the global one is newer, the binary you invoked and the version the repository is built around
disagree — about which schematics exist, about builder option names, and about what `ng update` will
attempt to do.

That is not cosmetic, and this warning is the only routine signal that the split exists. Disabling
it leaves the split in place and removes the notification.

**The fix is to stop invoking the global binary.** A package script resolves the workspace's own
copy, so the two versions cannot diverge in the first place:

```json
{
  "scripts": {
    "build": "ng build --configuration production",
    "test": "ng test",
    "ci:build": "npm exec -- ng build --configuration production"
  }
}
```

⛔ **The wrong fix, shown so you recognise it in a diff.** This makes the message stop and the
version skew continue:

```json
{ "cli": { "warnings": { "versionMismatch": false } } }
```

## Gotchas

**★ Symptom: every command in CI prints a version-mismatch warning, and someone proposes turning it
off.** Cause: the global `@angular/cli` on the runner image is newer than the workspace's pinned one,
and `warnings.versionMismatch` defaults to `true`. Fix: stop invoking the global binary — run the
workspace's own, so the versions cannot diverge:

```json
{
  "scripts": {
    "ci:build": "npm exec -- ng build --configuration production"
  }
}
```

**★ Symptom: two repositories report analytics under the same identity.** Cause: `analytics` was set
to a UUID string in one of them and the `angular.json` was copied to seed the other; the string form
is documented as a *"pseudonymous identifier"*, and copying the file copies the identifier. Fix: use
the boolean form in anything that gets copied:

```json
{ "cli": { "analytics": false } }
```

**★ Symptom: `"warnings": { "versionMismatch": false, "typescriptMismatch": false }` is flagged by
your editor.** Cause: `warnings` is itself `additionalProperties: false` and has exactly one property
at `v22.1.7`; other warning switches existed in older CLI schemas and are not in this one. Fix: keep
only the property the current schema declares:

```json
{ "cli": { "warnings": { "versionMismatch": true } } }
```

**Symptom: setting `"analytics": true` did not stop a prompt on a colleague's machine.** Cause: the
workspace file records a decision for the workspace; the machine-wide config at
`~/.config/angular/config.json` carries its own `cli` block, is not in version control, and is where
per-developer state lives. Fix: keep the two straight, and set the workspace value explicitly rather
than assuming it reaches every machine:

```json
{ "cli": { "analytics": false } }
```

**Symptom: `"warnings": true` is rejected.** Cause: the key is an object, not a boolean — it is a
namespace for individual switches, and there is no "all warnings" master toggle at this level. Fix:
name the switch you mean:

```json
{ "cli": { "warnings": { "versionMismatch": true } } }
```

**Symptom: you turned the version-mismatch warning off months ago, and now a schematic behaves
differently from what the repository's documentation describes.** Cause: the warning was the signal
that the global and local CLIs had drifted apart; with it suppressed, the drift kept growing
silently and a newer global CLI ran an older workspace's generation. Fix: re-enable the warning and
route every invocation through the workspace copy:

```json
{ "cli": { "warnings": { "versionMismatch": true } } }
```

**Symptom: a security or privacy review asks what `"analytics": "3f2a…"` in the repository does and
nobody can answer.** Cause: the string form is documented only as a pseudonymous identifier, so the
value in the file carries no self-describing meaning — and it almost certainly arrived by copying.
Fix: replace it with an explicit boolean, which states the decision instead of encoding an identity:

```json
{ "cli": { "analytics": false } }
```

## Interview questions

**★ Why is disabling `warnings.versionMismatch` the wrong response to the warning?**
Because the warning reports a real split rather than a nuisance. Two copies of the CLI are in play —
the global one the shell resolves and the local one the workspace pins — and they can differ in
schematics, in builder option names and in what `ng update` will attempt. Suppressing the message
does not make the two agree; it removes the only routine indication that they might not, and the
next surprise arrives as a schematic behaving differently from what the repository expects. The fix
is to invoke the workspace's own CLI through a package script so there is one version in play.

**★ What is the difference between `"analytics": true` and `"analytics": "<uuid>"`?**
The schema types the key as `boolean` or `string`, and the documentation explains the split: the
boolean is a straight on/off decision, while a UUID string reports under a pseudonymous identifier.
The practical difference is that the string is an identity and `angular.json` is a file people copy,
so the string form propagates into every repository seeded from that one. A repository that will be
forked or used as a template should use the boolean.

**★ The schema says "pseudonymous" and angular.dev's table says "anonymous". Which is right?**
Both, applied to different forms of the value — and the way to see that is to read the table's full
row rather than its summary phrase. The longer sentence attaches "pseudonymous" specifically to the
UUID string, which implies the boolean form is the plainer on/off case the summary is describing.
The useful discipline here is to notice the difference rather than smooth it over: two primary
sources using different privacy adjectives for the same key is exactly the kind of thing worth
quoting verbatim instead of paraphrasing, because the paraphrase is where the error would enter.

**Why is `warnings` an object with one property instead of a boolean?**
Because it is a namespace for console warnings the CLI itself emits, and it is closed with
`additionalProperties: false` so the set is enumerable. At 22.1.7 there is exactly one switch in it.
The shape tells you the design intent — individual warnings are separately controllable rather than
governed by one master toggle — and it tells you that a switch you remember from an older CLI is now
a validation error rather than a key the file will tolerate.

**Can either of these keys explain a build that works locally and fails in CI?**
Not directly: neither changes what is produced. `analytics` affects reporting, and `warnings`
affects what is printed. The plausible CI-only cause in this neighbourhood is not in `angular.json`
at all — it is a value living only in the machine-wide config file, which is not in version control
and therefore not present on a runner. That is the standing lesson of these two keys: they are the
part of the config surface where "it works on my machine" is usually about a second file rather than
about this one.

**Where should a decision about analytics live — the workspace file or the machine-wide one?**
It depends on whose decision it is. A repository-wide policy belongs in `angular.json`, because that
file is committed and everyone who checks the repository out gets it. A personal preference belongs
in `~/.config/angular/config.json`, because it should not travel with the code. The failure mode
worth naming is putting a personal decision in the committed file and then wondering why it applies
to colleagues, or putting a project policy in the machine-wide file and then wondering why CI
behaves differently.

{/* FOOTER */}
