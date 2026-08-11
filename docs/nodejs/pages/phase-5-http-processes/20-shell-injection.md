---
title: "Shell injection"
sidebar_label: "20 · Shell injection"
sidebar_position: 20
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**`exec` hands your string to `/bin/sh`. Any user-controlled character in that
string is code. Quoting is not a defence, escaping is not a defence — the fix is
to not use a shell.**

## The vulnerability

A converter endpoint. The developer even remembered to quote the interpolation:

```js
const run = (userInput) => `wc -c "uploads/${userInput}"`;
await promisify(exec)(run(req.query.file));
```

```console
$ node inject.mjs
exec ordinary input  -> "13 uploads/report.txt"
exec breaks the quote -> "13 uploads/report.txt\nTOP SECRET"
exec no quote needed  -> stdout: "" | stderr: "wc: 'uploads/report.txtTOP SECRET': No such file or director"
```

Two different payloads, two different techniques, and the file was read both times.

```
report.txt"; cat victim/secrets.txt; echo "
```
closes the developer's quote, runs a second command, and reopens the quote so the
line still parses. `TOP SECRET` lands in stdout.

```
report.txt$(cat victim/secrets.txt)
```
never needs to escape at all — `$(…)` is substituted **inside double quotes**, so
the file contents were interpolated into the filename and leaked through the error
message. Anything that reaches an attacker, including error text, is an exfiltration
channel.

A real payload does not print a file; it appends an SSH key, curls a script, or
opens a reverse shell. And this is `wc` — a command with no dangerous features of
its own. The danger is the shell, not the program.

## The fix

```js
await promisify(execFile)('wc', ['-c', `uploads/${input}`]);
```

```console
$ node inject.mjs
execFile ordinary input  -> "13 uploads/report.txt"
execFile breaks the quote -> wc: 'uploads/report.txt"; cat victim/secrets.txt; echo "': No such file or directory
```

No shell is started, so the arguments go straight to `execve` and the entire
payload is one absurd filename. The injection becomes a 404.

**`execFile` and `spawn` with an array are safe by construction — until you pass
`shell: true`, which puts the shell back and restores the vulnerability.**

## What does not work

**Escaping and quoting.** Both demos above were against quoted input. Shell
quoting rules differ between `sh`, `bash` and `cmd.exe`, and interact with
`$`, backticks, backslashes and newlines. Nobody gets this right; libraries that
promise to are one edge case from being wrong.

**Blocklisting metacharacters.** Stripping `;` leaves `|`, `&`, `` ` ``, `$()`,
`>`, `<`, newline, `{}`, `!`. A blocklist is a list of the attacks you have
thought of.

**Allow-listing the input** is legitimate when the input is genuinely from a small
set — but then you are choosing between fixed commands, not building one:

```js
const FORMATS = { png: ['-f', 'png'], jpeg: ['-f', 'mjpeg'] };
const args = FORMATS[req.query.format];
if (!args) return res.status(400).end();
```

## The second half: arguments are not filenames

`execFile` stops shell injection. It does **not** stop the argument being
something you did not intend:

- **Path traversal.** `../../etc/passwd` is a perfectly valid filename. Resolve
  and check the path first ([Phase 4, page
  04](../phase-4-filesystem/04-path-traversal.md)).
- **Argument injection.** Input starting with `-` is read as an *option*. A
  filename of `--output=/etc/cron.d/x` changes what the program does. Two defences:
  `--` before positional arguments where the program supports it, and rejecting
  leading dashes.

```js
if (name.startsWith('-')) throw new BadRequest('invalid name');
await run('grep', ['-n', '--', pattern, safePath]);
```

Then reduce what a compromise is worth: a minimal `env` rather than the inherited
one, a non-root user, a `timeout`, and `cwd` set to a scratch directory
([page 19](19-child-process.md)).

## Where this shows up

Anywhere a string becomes a command: `git` operations on a user-supplied branch,
`ffmpeg` on an uploaded file, `pdftotext`, `unzip`, image conversion, `ping` in a
"network tools" admin page, and — the one that keeps recurring — a build or
deploy script that interpolates a branch name into a shell command.

The rule is one line: **if a string that reaches a shell contains anything a user
supplied, it is a vulnerability.**

## Gotchas

**Symptom:** A command works until someone uploads a file with a space or an
apostrophe in its name
**Cause:** Shell word splitting.
**Fix:** `execFile` with an array — which also fixes the security problem.

**Symptom:** `execFile` is used and injection still happens
**Cause:** `shell: true` was passed to make a pipe or a glob work.
**Fix:** Do the piping in Node between two spawned processes; expand globs with
`fs.glob`.

**Symptom:** Input is sanitised and injection still happens
**Cause:** A blocklist missed `$()`, a backtick or a newline.
**Fix:** Do not sanitise for a shell. Remove the shell.

**Symptom:** A safe command writes to an unexpected path
**Cause:** Argument injection — input beginning with `-` parsed as an option.
**Fix:** Reject leading dashes; use `--`.

**Symptom:** Traversal through a subprocess despite `execFile`
**Cause:** The argument is a path and was never validated.
**Fix:** Resolve, check containment, `realpath`.

**Symptom:** A compromised subprocess reads production credentials
**Cause:** The child inherited `process.env`.
**Fix:** An explicit minimal `env`.

## Interview questions

**★ Why is `exec` with interpolated user input dangerous?**
The string is executed by `/bin/sh`, so shell metacharacters in the input are
commands. Verified: quoted interpolation was defeated twice — once by closing the
quote with `"; cat …; echo "`, once by `$(…)` substitution, which works *inside*
double quotes and needs no escape at all.

**★ Why isn't escaping the right fix?**
Because you would have to model the shell's grammar exactly — quoting contexts,
`$`, backticks, backslashes, newlines, and the differences between `sh`, `bash`
and `cmd.exe`. Removing the shell removes the grammar. `execFile` passes arguments
to `execve` untouched.

**★ Does `execFile` make subprocess calls safe?**
It removes shell injection, not argument abuse. The argument can still be a
traversal path, or start with `-` and be interpreted as an option — for example a
filename of `--output=/etc/cron.d/x`. Validate paths and reject leading dashes.

**★ You need a pipeline. How do you do it without a shell?**
Spawn each program separately and connect their streams in Node with `pipeline`.
You get backpressure and per-process exit codes, and no shell is involved.

**What is argument injection?**
Supplying input that the target program parses as a flag rather than a value.
`--` before positional arguments and rejecting leading dashes are the defences.

**Where do these bugs actually appear?**
Image and video conversion, `git` commands built from branch names, archive
extraction, PDF tooling, and admin "network tools" pages — anywhere a program is
invoked with a name a user chose.

---

← Prev: [child_process](19-child-process.md) · Next → [IPC](21-ipc.md)
