---
title: "Since v22.0.0 the `PORT` environment variable outranks both `angular.json` and the `--port` flag — a container that exports `PORT` for an unrelated reason silently wins the argument, and the only trace is one info line"
sidebar_label: "06f · Ports and the PORT variable"
sidebar_position: 6.5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — the breaking-change text is quoted verbatim
> from the `22.0.0 (2026-06-03)` section of
> [`CHANGELOG.md`](https://github.com/angular/angular-cli/blob/v22.1.7/CHANGELOG.md) at tag
> `v22.1.7`; the implementation from
> [`packages/angular/build/src/builders/dev-server/options.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/dev-server/options.ts)
> and
> [`packages/angular/build/src/utils/check-port.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/utils/check-port.ts),
> both at the same tag; the `port` default from
> [`packages/angular/build/src/builders/dev-server/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/dev-server/schema.json).
> Documentation-validated against source; **no sandbox run** — no port was bound to produce this
> page.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**This is the single most surprising behaviour change in the v22 build system, and it is one
sentence in the release notes.** Before v22, the port came from the flag, then the file, then the
default — the ordering everyone assumes because every other CLI works that way. Since v22.0.0 the
`PORT` environment variable sits **above both of them**, so `ng serve --port 5000` in a shell where
`PORT=3000` serves on 3000, and nothing about that reads as an error. In a container, a CI runner or
any shell that has sourced a `.env`, the variable is frequently set by something that has nothing to
do with Angular, and the effect is a dev server on a port nobody chose.

## The breaking change, verbatim

From the `22.0.0 (2026-06-03)` Breaking Changes block of the CLI changelog:

> *"The `@angular/build:dev-server (ng serve)` now assigns the highest priority to the `PORT`
> environment variable. This value will override any port configurations specified in
> `angular.json` or via the `--port` command-line flag. This includes the default port 4200."*

Read the last sentence carefully. *"This includes the default port 4200"* is there because the
obvious workaround — "we never set `port`, so we are not affected" — is wrong. The default is also
overridden.

## The implementation, and what it proves about ordering

From `dev-server/options.ts` at `v22.1.7`:

```ts
let port = options.port ?? 4200;
// Overwrite port, if process.env.PORT is available.
if (process.env.PORT) {
  const envPort = Number(process.env.PORT);

  if (!isNaN(envPort)) {
    port = envPort;
    logger.info(`Environment variable "PORT" detected. Using port ${envPort}.`);
  }
}
```

Four facts fall straight out of nine lines.

**The environment is consulted *after* `options.port` is resolved.** By the time the builder runs,
`options.port` already contains whatever the CLI merged out of `angular.json`, the selected
configuration and the command line. The `if` block then overwrites it. So the precedence is:

| Rank | Source | Beats |
|---:|---|---|
| 1 | `PORT` environment variable | everything below |
| 2 | `--port` on the command line | the file and the default |
| 3 | `port` in `angular.json` (options or configuration) | the default |
| 4 | `4200`, the schema default | — |

🔴 **Rank 1 over rank 2 is the reversal.** Command-line flags normally win against everything; here
they do not. This is the opposite of what almost everyone assumes, and the changelog sentence exists
precisely because it is a change.

**An unparsable `PORT` is ignored, not an error.** `Number(process.env.PORT)` guarded by
`!isNaN(envPort)` means `PORT=auto` leaves the resolved port untouched and produces no warning. An
empty `PORT=` is falsy and never enters the block at all.

**A non-integer numeric `PORT` is not filtered here.** The guard rejects `NaN` and nothing else, so
whatever `Number()` produces for a numeric-looking string is what gets assigned. Whether the socket
layer then accepts it is a different layer's problem, and this code does not check.

**There is exactly one trace, and it is an `info` log.** The builder emits
`Environment variable "PORT" detected. Using port <n>.` — quoted here from the source's template
literal, not from a captured run. If your terminal, your CI log filter or your task runner is
hiding info-level output, the override is completely invisible.

## Why this bites in exactly the places it is hardest to debug

`PORT` is not an Angular variable. Nothing in the workspace declares it, nothing in `angular.json`
references it, and grepping the repository for it finds nothing. It arrives from outside:

- a base image or process supervisor that exports it for the service it normally runs;
- a `.env` file sourced into the shell for a backend that runs on 3000;
- a CI job that sets it for a different step and never unsets it;
- a compose file that sets it for a sibling container and inherits it into yours.

In every one of those cases the Angular project is correct, the command is correct, and the port is
wrong. The diagnostic is to ask the environment rather than the file:

```bash
node -p "process.env.PORT ?? '(unset)'"
```

If that prints a number, you have your answer before you read any JSON.

## Making it deterministic

The variable wins, so the only reliable fixes either remove it or set it deliberately.

```bash
# One command, this invocation only — the flag will NOT save you, so unset instead.
env -u PORT ng serve --port 5000
```

```bash
# Or make the variable say what you want, since it outranks everything anyway.
PORT=5000 ng serve
```

For a shared script, prefer the second form: it is honest about which mechanism is actually in
control, and it keeps working if someone later adds a `port` to `angular.json` that would otherwise
be silently ignored.

```json
{
  "scripts": {
    "start": "PORT=5000 ng serve"
  }
}
```

⚠️ **That `scripts` form is shell-dependent** — `VAR=value cmd` is POSIX shell syntax and does not
work in `cmd.exe`. A cross-platform script needs a tool that sets the variable portably, or an
`.npmrc`/CI-level environment setting instead.

## What happens next is a separate mechanism

Once a port has been resolved by the rules above, a different file decides what to do if something
is already listening on it — and that check behaves differently with and without a terminal.
See [06g](06g-when-the-port-is-taken.md).

## Gotchas

**★ Symptom: `ng serve --port 5000` serves on a completely different port.** Cause: since v22.0.0
the `PORT` environment variable *"will override any port configurations specified in `angular.json`
or via the `--port` command-line flag"*. The flag is resolved first and then overwritten. Fix: take
the variable out of the equation for that invocation, or set it to the value you want:

```bash
env -u PORT ng serve --port 5000
```

```bash
PORT=5000 ng serve
```

**★ Symptom: the dev server binds a port nobody configured, and nothing in the repository mentions
that number.** Cause: `PORT` is coming from the environment — a base image, a sourced `.env`, a CI
job, a compose file. Nothing in the workspace will ever reveal it. Fix: ask the environment first,
before reading any JSON:

```bash
node -p "process.env.PORT ?? '(unset)'"
```

**★ Symptom: two developers on the same commit serve on different ports.** Cause: one of them has
`PORT` set and the other does not, so one is on the variable's value and the other on
`angular.json`'s or 4200. Fix: make the project's own script set it explicitly so the environment
cannot decide:

```json
{
  "scripts": {
    "start": "PORT=4200 ng serve"
  }
}
```

**★ Symptom: `PORT=auto` (or any non-numeric value) is silently ignored.** Cause:
`if (!isNaN(envPort))` — a value that does not parse as a number leaves the resolved port untouched,
with no warning. Fix: nothing breaks, but do not rely on the fallback as a feature; set a real
number, or unset the variable:

```bash
env -u PORT ng serve
```

**Symptom: an override happened and nothing in the log mentions it.** Cause: the only trace is
`Environment variable "PORT" detected. Using port <n>.` at **info** level. A log filter, a quiet
task runner, or a CI step that only surfaces warnings and errors will hide it. Fix: do not rely on
the log — check the variable directly, as above.

**Symptom: `PORT=` (empty) has no effect at all.** Cause: an empty string is falsy, so the `if
(process.env.PORT)` guard is never entered and the resolved option stands. Fix: this is the correct
behaviour and a useful one — clearing the variable in a script is a valid way to opt out, and it
behaves the same as unsetting it for this purpose.

## Interview questions

**★ What is the port precedence for `ng serve` on Angular 22, and what changed?**
From highest to lowest: the `PORT` environment variable, then `--port` on the command line, then
`port` in `angular.json`, then the schema default of 4200. What changed in v22.0.0 is that `PORT`
moved to the top — the changelog says it *"will override any port configurations specified in
`angular.json` or via the `--port` command-line flag. This includes the default port 4200."* The
reversal that matters is environment-over-flag, because every other CLI a developer uses puts the
explicit flag above ambient configuration. The implementation makes it obvious: the builder resolves
`options.port ?? 4200` first and *then* overwrites it from `process.env.PORT`.

**★ `ng serve --port 5000` is serving on 3000. Walk me through the diagnosis.**
First check the environment, not the file: `node -p "process.env.PORT ?? '(unset)'"`. If it prints
3000, that is the answer, because since v22 the variable outranks the flag. Then find where it came
from — a base image, a `.env` sourced into the shell, a CI job, or a compose file setting it for a
sibling service — because the Angular project will contain no reference to it. The fix is either
`env -u PORT ng serve --port 5000` for one invocation, or `PORT=5000 ng serve` to work with the
mechanism rather than against it. There is one confirming trace in the log if info-level output is
visible: `Environment variable "PORT" detected. Using port <n>.`

**★ Why is this specifically a container and CI problem rather than a laptop problem?**
Because `PORT` is a conventional variable that many process supervisors, base images and CI
configurations set for reasons unrelated to Angular, and because a container inherits its
environment from outside the repository. On a laptop you usually know what you exported. Inside a
container the variable may be set by a layer you did not write, for a service you are not running,
and there is nothing in the workspace to grep for. That is what makes the failure feel impossible:
every artefact under version control is correct.

**Is there any way to make the port fully deterministic across a team?**
Set it through the mechanism that wins. Because `PORT` outranks both the flag and the file, the only
setting that cannot be quietly overridden is `PORT` itself — so a project script of the form
`"start": "PORT=4200 ng serve"` is more reliable than putting `"port": 4200` in `angular.json`,
which any ambient variable will beat. The caveat is portability: `VAR=value cmd` is POSIX shell
syntax and does not work in `cmd.exe`, so a cross-platform team needs a portable way to set the
variable rather than an inline prefix.

**What does the code tell you about a `PORT` value that is not a number?**
That it is ignored silently. The guard is `if (!isNaN(envPort))` after a `Number()` conversion, so a
value like `auto` leaves the previously resolved port in place and logs nothing; an empty string
never enters the block at all, because it is falsy. That is a reasonable design — a malformed
ambient variable should not take down a dev server — but it means you cannot infer from "the server
started normally" that `PORT` was not set. Only reading the variable settles that.

{/* FOOTER */}
