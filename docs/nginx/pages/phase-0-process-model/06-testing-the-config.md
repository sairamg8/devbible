---
title: "nginx -t, -T and -V"
sidebar_label: "06 · Testing the config"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against [Command-line parameters](https://nginx.org/en/docs/switches.html)
> — `-t` appeared long before, `-T` in 1.9.2, `-e` in 1.19.5, `-l` in 1.29.8 —
> and [Controlling nginx](https://nginx.org/en/docs/control.html).
> **No sandbox run** — nothing on this page was executed, and it carries no console output.

**Three flags answer the three questions you will actually ask nginx: is this
configuration valid, what configuration is really in effect, and what can this
binary even do?**

## The whole command line

| Flag | Documented meaning |
|---|---|
| `-t` | "test the configuration file: nginx checks the configuration for correct syntax, and then tries to open files referred in the configuration" |
| `-T` | "same as `-t`, but additionally dump configuration files to standard output" (1.9.2) |
| `-v` | "print nginx version" |
| `-V` | "print nginx version, compiler version, and configure parameters" |
| `-q` | "suppress non-error messages during configuration testing" |
| `-s signal` | send `stop`, `quit`, `reload` or `reopen` to the master (page 04) |
| `-c file` | use an alternative configuration file |
| `-p prefix` | set the path prefix — the directory holding server files |
| `-e file` | use an alternative error log; `stderr` is a special value (1.19.5) |
| `-g directives` | set global configuration directives |
| `-l port` | enable the nginx control REST API on a port or Unix socket (1.29.8) |
| `-?`, `-h` | print help |

## `-t` — does this configuration work?

`-t` does two distinct things, and the second is the one people forget:

1. **Parses** the configuration for syntax errors.
2. **Tries to open the files it refers to** — certificates, `include`d files, log
   paths, `auth_basic_user_file`.

So `-t` catches a missing semicolon *and* a certificate path that does not exist
*and* a log directory the worker cannot write to. That is why it is a genuine
pre-flight check and not just a linter.

```bash
nginx -t && nginx -s reload
```

**Make this the only way you ever reload.** The `&&` means a failed test stops the
reload. Without it, a bad config causes the master to roll back silently (page
05) and your deploy does nothing while appearing to succeed.

Two things `-t` cannot tell you:

- **Whether the config is *correct*.** A `proxy_pass` to the wrong port, a
  `location` that never matches, an `alias` missing its trailing slash — all
  valid syntax, all wrong. `-t` is a compiler, not a test suite.
- **Whether a reload will apply it.** `load_module` additions need a restart
  (page 05), and `-t` will happily validate them.

`-t` runs as whoever invoked it. Testing as `root` can pass while the worker,
running as `www-data`, cannot open the same files — so a `-t` in CI is a syntax
check, and a `-t` on the target host as the right user is a real one.

## `-T` — what configuration is *actually* in effect?

`-T` is `-t` plus a dump of every configuration file, `include`s resolved, to
standard output. It is the single most useful debugging flag nginx has, and it is
underused because most people have never heard of it.

```bash
nginx -T > /tmp/effective.conf          # everything, includes expanded
nginx -T | grep -n 'proxy_pass'         # where does traffic actually go?
nginx -T | grep -c 'server_name'        # how many virtual hosts are there really?
```

Use it whenever the answer to "why is nginx doing that?" might be **"it is not
reading the file you think it is."** That covers a large share of nginx mysteries:

- A distro layout with both `conf.d/` and `sites-enabled/`, only one of them
  actually `include`d.
- An editor backup — `app.conf.bak`, `app.conf.save` — matched by
  `include conf.d/*.conf`… or not matched, when you assumed it was.
- Two `server` blocks claiming the same `server_name`, one of them silently
  ignored (Phase 2).
- A file edited on the host while nginx runs from a container image that has its
  own copy.

**The rule: if your directive is not in `nginx -T` output, nginx has never seen
it.** Stop debugging behaviour and start debugging includes.

⚠️ `-T` prints everything, and "everything" includes any secret you put in the
config — `auth_basic_user_file` paths, upstream credentials in a `proxy_pass`
URL, API keys in a `proxy_set_header`. Do not paste raw `-T` output into a ticket
or a chat channel.

## `-V` — what can this binary do?

`-V` prints the version, the compiler, and the full `./configure` line the binary
was built with. That configure line is the definitive answer to "do I have this
module?":

```bash
nginx -V 2>&1 | tr ' ' '\n' | grep -- '--with'    # every module compiled in
nginx -V 2>&1 | grep -o 'with-http_v3_module'     # is HTTP/3 available?
nginx -V 2>&1 | grep -o 'with-debug'              # can I use the debug log?
```

`-V` writes to **stderr**, which is why every one-liner above redirects `2>&1`
before piping. Forgetting it produces an empty grep and a confusing minute.

Three things worth checking before you write config that depends on them:

| Looking for | Grep for | Needed by |
|---|---|---|
| HTTP/3 and QUIC | `--with-http_v3_module` | Phase 5 |
| The debug log | `--with-debug` | Phase 10 |
| Real IP from a proxy | `--with-http_realip_module` | Phase 4 |

A module that is **dynamic** rather than compiled in will not appear here — it
appears as a `load_module` line instead. Page 08 covers the distinction.

`-v` is the short version and is what you want in a script, or when answering the
question that governs this whole track: **are you on 1.29.7 or later, where
upstream keep-alive is the default?**

## Where the paths come from

`-p`, `-c` and `-e` exist because nginx's file layout is a build-time decision,
not a standard. A binary built from source defaults to the prefix
`/usr/local/nginx`; a Debian package points at `/etc/nginx`; the container image
has its own. `nginx -V` shows you which, in the `--prefix` and `--conf-path`
values.

This is why the same `nginx -t` can pass on your laptop and fail on the server:
different prefix, different resolved include paths, different files entirely.
Page 07 covers those layouts.

## Gotchas

**Symptom:** `nginx -t` says the configuration is fine, but the behaviour did not
change after a reload.
**Cause:** nginx is not reading the file you edited, or another block matches
first.
**Fix:** `nginx -T | grep <your directive>`. If it is absent, it is an include
problem. If it is present, it is a matching problem — go to Phase 2.

**Symptom:** `nginx -t` passes as root and the reload fails, or the site 403s.
**Cause:** `-t` opened files with root's permissions; the workers run as `user`.
**Fix:** Test as the worker's user where it matters, and check that every
directory on the path to your `root` is traversable by that user.

**Symptom:** `nginx -V | grep something` prints nothing even though the module is
clearly there.
**Cause:** `-V` writes to stderr; the pipe only carries stdout.
**Fix:** `nginx -V 2>&1 | grep …`.

**Symptom:** A CI job runs `nginx -t` and passes, then the deploy fails on the
host.
**Cause:** CI validated a config whose `include`d files, certificates and log
directories do not exist in the CI container. `-t` tries to open files, so it is
only meaningful where those files are.
**Fix:** Run `-t` **inside the image that will run in production**, with the
config mounted where it really lands (Phase 11).

**Symptom:** You pasted `nginx -T` output into a ticket and leaked a credential.
**Cause:** `-T` dumps everything, including secrets in the config.
**Fix:** Redact before sharing, and prefer keeping secrets out of nginx config
entirely — nginx has no environment-variable substitution, which is exactly why
they end up hard-coded (Phase 11).

## Trade-off

**`nginx -t` gives you confidence that is narrower than it feels.** It proves the
configuration parses and its files open. It proves nothing about whether the
routing is right, whether a `location` will match, or whether the upstream is
reachable. Teams that treat a green `-t` as "the deploy is safe" eventually ship a
`proxy_pass` pointing at the wrong port and are surprised.

The complete pre-flight is `-t` for validity, `-T` for what is actually in
effect, and a real request afterwards for correctness. Only the first two are
free.

## Interview questions

**★ What does `nginx -t` check, and what does it not?**
It checks the configuration parses, and it tries to open the files the config
refers to — certificates, includes, log paths. It does **not** check that the
configuration is *correct*: a `proxy_pass` to a dead port, a `location` that never
matches, or a missing trailing slash on an `alias` all pass.

**★ Why should a reload always be written `nginx -t && nginx -s reload`?**
Because a reload with an invalid configuration is silently rolled back by the
master. The site stays up on the old config, the deploy appears to succeed, and
the only evidence is a line in the error log.

**★ What is `nginx -T` for?**
It dumps the fully resolved configuration — every `include` expanded — to stdout.
It answers "is nginx even reading the file I edited?", which is the real cause of
a large share of "my change did nothing" problems. If a directive is not in that
output, nginx has never seen it.

**How do you find out whether your nginx supports HTTP/3?**
`nginx -V 2>&1 | grep http_v3_module` — `-V` prints the `./configure` line the
binary was built with. Remember the `2>&1`: `-V` writes to stderr. A dynamic
module would not appear there; it would appear as a `load_module` line in the
config instead.

**Why can `nginx -t` pass in CI and fail on the server?**
Because `-t` opens files, and CI has different files: includes that do not exist,
certificate paths that are absent, a different prefix. A meaningful test runs
inside the production image with the real config layout, as the user nginx will
actually run as.

**What is the risk of sharing `nginx -T` output?**
It contains the entire configuration, secrets included — credentials embedded in
an upstream URL, tokens in `proxy_set_header`, paths to password files. Redact
before pasting it anywhere.

---

← Prev: [Reload, restart and binary upgrade](05-reload-and-upgrade.md) · Index: [Phase 0](README.md) · Next → [Installing nginx](07-installing.md)
