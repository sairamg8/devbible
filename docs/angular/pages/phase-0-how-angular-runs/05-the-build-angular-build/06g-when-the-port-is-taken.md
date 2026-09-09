---
title: "A busy port is a question on a laptop and a hard failure in CI — the builder branches on whether it has a terminal, the interactive branch defaults to yes, and the error it prints advises a flag that v22 demoted"
sidebar_label: "06g · When the port is taken"
sidebar_position: 6.6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — the in-use check, its error text and the
> TTY branch are quoted verbatim from
> [`packages/angular/build/src/utils/check-port.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/utils/check-port.ts)
> at tag `v22.1.7`, with the `@inquirer/confirm` pin read from the published manifest of
> `@angular/build` 22.1.7 (`@inquirer/confirm` 6.1.1) and the precedence rule from the
> `22.0.0 (2026-06-03)` Breaking Changes section of
> [`CHANGELOG.md`](https://github.com/angular/angular-cli/blob/v22.1.7/CHANGELOG.md).
> Documentation-validated against source; **no sandbox run** — no port was bound to produce this
> page.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**One condition, two completely different outcomes, decided by something no configuration file
mentions: whether standard input is a terminal.** A stale dev server holding 4200 produces a
friendly question on a developer's machine and an exit code in CI, from the same code path in the
same version. That asymmetry manufactures "works on my machine" reports, and the interactive branch
is not the harmless half — it defaults to *yes*, so it silently moves you to a different port and
you carry on testing a URL your colleague is not on.

## The check, verbatim

From `check-port.ts` at `v22.1.7`, the error the builder constructs:

```ts
function createInUseError(port: number): Error {
  return new Error(`Port ${port} is already in use. Use '--port' to specify a different port.`);
}
```

and the branch that decides whether that error is thrown or a question is asked:

```ts
if (!isTTY()) {
  reject(createInUseError(port));

  return;
}

import('@inquirer/confirm')
  .then(({ default: confirm }) =>
    confirm({
      message: `Port ${port} is already in use.\nWould you like to use a different port?`,
      default: true,
      theme: { prefix: '' },
    }),
  )
```

Three things are settled by those two fragments.

**The discriminator is `isTTY()`, not an option and not an environment variable.** Nothing in
`angular.json` selects between the two behaviours; nothing on the command line does either. Whether
the process was given a terminal decides it, and that is a property of how the command was invoked —
a shell, a CI runner, a Docker build step, a background task runner, an editor's integrated task
pane.

**Without a TTY the promise is rejected.** `reject(createInUseError(port))` is a failure, and it
carries the message `Port <n> is already in use. Use '--port' to specify a different port.` — quoted
here from the source's template literal, not from a captured run.

**With a TTY the prompt defaults to accepting a different port.** `default: true` means pressing
Enter — or any automation that answers a prompt optimistically — moves the server. The dev server
starts, the browser opens, and the port is not the one you configured.

## Why the error message is now partly wrong

The text advises `--port`. Since v22.0.0 that is rank 2 of four:

> *"The `@angular/build:dev-server (ng serve)` now assigns the highest priority to the `PORT`
> environment variable. This value will override any port configurations specified in
> `angular.json` or via the `--port` command-line flag. This includes the default port 4200."*
> — CLI `CHANGELOG.md`, `22.0.0 (2026-06-03)`

So if the reason you are on a busy port is an ambient `PORT`, following the error's own advice
changes nothing: the flag is resolved and then overwritten. The message predates the precedence
change. The full precedence ladder and its diagnosis are
[06f](06f-ports-and-the-port-variable.md).

```bash
# What the message tells you to do — ineffective when PORT is set.
ng serve --port 4300

# What actually moves the server in that case.
PORT=4300 ng serve
```

## Port `0` is not currently a way to get a free port

`check-port.ts` carries a commented-out branch with its own explanation, verbatim:

```ts
// Disabled due to Vite not handling port 0 and instead always using the default value (5173)
// TODO: Enable this again once Vite is fixed
```

The usual "let the operating system pick a free port" trick is therefore not available through this
path at 22.1.7. Note carefully what that comment does and does not establish: it records why a
branch is disabled and what the authors observed about Vite. **What happens end to end if you set
`port` to `0` today was not confirmed**, and this page does not guess. If you need a port in CI that
will not collide, choose one deterministically:

```bash
PORT=4321 ng serve
```

## Designing CI so this cannot happen

Two properties make the failure impossible rather than unlikely: a port nothing else claims, and a
mechanism that cannot be overridden by the environment. Since `PORT` outranks everything, using
`PORT` gives you both at once.

```bash
# Deterministic, and immune to an ambient PORT because it *is* the ambient PORT.
PORT=4321 ng serve
```

If a job genuinely needs several Angular servers at once, give each one an explicit number rather
than relying on the in-use behaviour to sort them out — the non-TTY branch does not fall back, it
fails.

## Gotchas

**★ Symptom: `ng serve` fails in CI with `Port 4200 is already in use. Use '--port' to specify a
different port.` but only prompts on a laptop.** Cause: the `isTTY()` branch — no TTY means the
error is thrown, a TTY means `@inquirer/confirm` asks and defaults to yes. Fix: give CI a port
nothing else will hold, through the mechanism that outranks the rest:

```bash
PORT=4321 ng serve
```

**★ Symptom: you followed the error's advice and passed `--port`, and it still failed.** Cause: the
message advises `--port`, but since v22.0.0 `--port` is rank 2 and the `PORT` environment variable
is rank 1. If an ambient `PORT` is what put you on the busy port, the flag cannot move you off it.
Fix: change the variable, not the flag:

```bash
PORT=4300 ng serve
```

**★ Symptom: your colleague is testing different behaviour from you, on a port you both call
"4200".** Cause: the interactive in-use prompt has `default: true`, so one of you accepted a
different port without registering the question while a stale server still holds 4200. Fix: find and
stop the stale process rather than accepting a new port, and confirm which URL you are actually
looking at before comparing behaviour.

**★ Symptom: a CI step that used to pass now fails on the port, with no code change.** Cause: a
previous step in the same job left a dev server running, or two jobs share a runner. Without a TTY
there is no negotiation — the second one fails immediately. Fix: give each concurrent server an
explicit distinct port rather than relying on a fallback that does not exist in this branch:

```bash
PORT=4321 ng serve --no-open
```

**Symptom: an automated wrapper answers the prompt and the server ends up somewhere unpredictable.**
Cause: the prompt defaults to `true`, so any automation that accepts prompts takes a different port
without recording which one. Fix: remove the ambiguity by pinning the port up front, so the prompt
is never reached.

**Symptom: `"port": 0` does not give you an OS-assigned free port.** Cause: the port-0 path in
`check-port.ts` is commented out, with the note *"Disabled due to Vite not handling port 0 and
instead always using the default value (5173)"*. The exact end-to-end behaviour today was not
confirmed. Fix: pick a port deterministically instead of asking for an arbitrary one:

```bash
PORT=4321 ng serve
```

**Symptom: the same command behaves differently inside your editor's task runner than in your
terminal.** Cause: the same `isTTY()` split — integrated task panes frequently do not allocate a
TTY, so the editor gets the throwing branch while the terminal next to it gets the prompt. Fix: do
not treat "it works in my terminal" as evidence about the editor run; set the port explicitly so
both paths behave identically.

## Interview questions

**★ Why does the same busy port prompt on a laptop and fail the build in CI?**
Because the builder branches on whether it has a TTY. With one, it imports `@inquirer/confirm` and
asks `Port <n> is already in use.\nWould you like to use a different port?` with `default: true`, so
the interactive case quietly moves to another port. Without one — CI, a Docker build, a task runner
that does not allocate a terminal — it rejects with
`Port <n> is already in use. Use '--port' to specify a different port.` and the command fails.
Nothing in `angular.json` or on the command line selects between the two; the discriminator is how
the process was invoked. The second-order lesson is that the interactive path is not the safe half:
it changed your port without a decision being recorded, so two developers can both believe they are
on 4200 and be testing different servers.

**★ The error says to use `--port`. Why might that not work on Angular 22?**
Because v22.0.0 moved the `PORT` environment variable above the flag: *"This value will override any
port configurations specified in `angular.json` or via the `--port` command-line flag."* The message
in `check-port.ts` was written when the flag was the top of the ladder and has not been updated, so
it now gives advice that is correct only when `PORT` is unset. If an ambient `PORT` is why you are on
a busy port, the fix is to change or unset the variable — `PORT=4300 ng serve` or
`env -u PORT ng serve --port 4300` — not to add a flag the variable will overwrite.

**★ How do you make a CI job immune to this?**
Pick the port deterministically and set it through the mechanism that cannot be outranked, which
since v22 is `PORT` itself: `PORT=4321 ng serve`. That is immune to an ambient `PORT` because it *is*
the ambient `PORT` for that command, and it does not depend on the in-use negotiation, which does not
exist without a TTY. If several servers must run concurrently in one job, give each an explicit
distinct number rather than expecting a fallback — the non-TTY branch fails rather than searching
for a free port.

**Can you ask the dev server for any free port, the way `port: 0` works elsewhere?**
Not through this path at 22.1.7. `check-port.ts` contains a commented-out branch with the note
*"Disabled due to Vite not handling port 0 and instead always using the default value (5173)"* and a
`TODO` to re-enable it once that is fixed upstream. That comment establishes why the code is
disabled; it does not establish what setting `port` to `0` does end to end today, and I could not
confirm that. The practical answer is to choose a port yourself, which is what you want in CI
anyway — an arbitrary port is difficult to hand to a test runner or a health check.

**What does this tell you in general about relying on interactive prompts in a build tool?**
That a prompt is a branch, and every branch has a non-interactive side you will eventually run.
Angular's is well behaved — it fails loudly rather than hanging — but the two sides produce opposite
outcomes from identical state, so any behaviour you observed interactively is weak evidence about
CI. The habit worth forming is to make the automated path explicit: set the port, pass `--no-open`,
and never let a default answer decide something a later step depends on.

{/* FOOTER */}
