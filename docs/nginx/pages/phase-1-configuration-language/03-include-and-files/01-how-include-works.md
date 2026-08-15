---
title: "How include works"
sidebar_label: "01 · How include works"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against [ngx_core_module](https://nginx.org/en/docs/ngx_core_module.html)
> (`include` — `Syntax: include file | mask;`, `Context: any`) and
> [nginx: Linux packages](https://nginx.org/en/linux_packages.html).
> **No sandbox run** — nothing on this page was executed, and it carries no console output.

**`include` is textual substitution at parse time, in whatever context it appears.
There is no scope, no namespace, and no import semantics.**

## What `include` does

```text
Syntax:   include file | mask;
Default:  —
Context:  any
```

**`Context: any`** — you can put `include` anywhere a directive is legal, and the
included file's contents are parsed **as if they had been typed at that point**.
It is `#include` from C.

Two consequences follow immediately, and they are the whole chunk:

1. **The included file must be legal where you include it.** A file full of
   `server { … }` blocks is only valid inside `http`. A file full of bare
   `proxy_set_header` lines is only valid inside a `server` or `location`. The
   same file cannot serve both purposes.
2. **Because contents land at the including level, inheritance never applies to
   them.** This is why the include-a-snippet pattern from
   [page 02](../02-inheritance.md) works: the directives are written at the same
   level, so there is nothing for the replace rule to discard.

## Two kinds of included file

Keep them in separate directories and the confusion disappears:

| Kind | Contains | Included from | Convention |
|---|---|---|---|
| **Site file** | a whole `server { … }` block | `http` | `conf.d/*.conf` (or Debian's `sites-enabled/*`) |
| **Snippet** | bare directives, no enclosing block | inside `server` or `location` | `snippets/*.conf` |

```nginx
# nginx.conf (main)
http {
    include /etc/nginx/mime.types;         # a `types { }` block — legal in http
    include /etc/nginx/conf.d/*.conf;      # site files, each a whole server block
}
```

```nginx
# /etc/nginx/conf.d/app.conf — a SITE file
server {
    listen 80;
    server_name app.example.com;

    location /api/ {
        include /etc/nginx/snippets/proxy.conf;   # a SNIPPET, inside location
        proxy_pass http://app;
    }
}
```

```nginx
# /etc/nginx/snippets/proxy.conf — a SNIPPET: no braces, no server, no location
proxy_set_header Host              $host;
proxy_set_header X-Real-IP         $remote_addr;
proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

Put a site file where a snippet belongs and you get
`"server" directive is not allowed here`. Put a snippet where a site file belongs
and you get the same class of error one level up. Both are loud, which is the good
case.

## The glob is literal, and that is where files go missing

`include conf.d/*.conf` matches exactly what it says:

| File | Included? |
|---|---|
| `app.conf` | ✅ |
| `app.conf.bak` | ❌ — does not end in `.conf` |
| `app.conf.disabled` | ❌ |
| `app` | ❌ |
| `app-old.conf` | ⚠️ **yes** — and this is the dangerous one |

The silent failures run in both directions. A file you meant to be live is not
matched and does nothing — no error, because **nginx cannot report a syntax error
in a file it never opened**, so `nginx -t` passes happily. And a file you meant to
be *disabled* is matched, quietly reintroducing a duplicate `server_name`, where
the first block read wins and the second is ignored (Phase 2).

**The rule: disabled configs move out of the included directory. They do not get
renamed in place.**

This is exactly what `nginx -T` is for
([Phase 0, page 06](../../phase-0-process-model/06-testing-the-config.md)):

```bash
nginx -T | grep -n 'server_name'     # every virtual host nginx actually knows about
```

**If your file's contents are not in that output, nginx has never read it.** Stop
debugging behaviour and start debugging the include.

## `sites-available` / `sites-enabled` is Debian, not nginx

Worth repeating from
[Phase 0](../../phase-0-process-model/07-installing.md) because it belongs here
mechanically. nginx knows nothing about that layout. It works only because Debian
and Ubuntu's `nginx.conf` contains a line like
`include /etc/nginx/sites-enabled/*;`.

The nginx.org packages and the official container image ship `conf.d/*.conf`
instead and have no `sites-enabled`. Drop a Debian tutorial's config onto such a
server and it sits in an unincluded directory doing nothing, while `nginx -t`
reports success.

Note also the mask difference: Debian's include is often `sites-enabled/*` with no
extension filter, which is why the symlink convention works there and why an
editor backup in that directory *is* picked up.

## A layout that scales

```text
/etc/nginx/
├── nginx.conf                 # main, events, http-level defaults, the includes
├── mime.types                 # shipped
├── conf.d/
│   ├── 00-defaults.conf       # http-level settings you own (gzip, logs, limits)
│   ├── app.conf               # one server block
│   └── admin.conf             # another
├── snippets/
│   ├── proxy.conf             # the proxy_set_header set (page 02)
│   ├── security-headers.conf  # add_header … always
│   └── ssl.conf               # ssl_protocols, ciphers, session cache
└── disabled/                  # NOT included — where retired configs live
```

Three properties worth copying: one file per site, snippets for anything repeated
across sites, and **a directory outside the include path for things that are
switched off.**

The numeric prefix on `00-defaults.conf` is not decoration. Includes are expanded
in glob order, and while most `http`-level settings are order-independent, some —
a `map` referenced by a later `server`, a `limit_req_zone` used further down —
must be parsed first. Naming them to sort first removes the question.

## Gotchas

**Symptom:** You created a config file, reloaded, and nothing changed —
`nginx -t` passes.
**Cause:** The file is not matched by any `include` mask, so nginx never opened
it. A file nginx never reads cannot have a syntax error.
**Fix:** `nginx -T | grep <something from your file>`. If it is absent, fix the
filename or the include, not the config.

**Symptom:** `nginx: [emerg] "server" directive is not allowed here`.
**Cause:** A site file included from inside a `server` or `location`, or from the
`main` context instead of `http`.
**Fix:** Site files (whole `server` blocks) go in `http`. Snippets (bare
directives) go inside `server` or `location`. Do not mix the two kinds in one
directory.

**Symptom:** A config you renamed to `app.conf.disabled` correctly has no effect,
but one you renamed to `app-old.conf` broke the site.
**Cause:** The second still matches `*.conf`, so a duplicate `server_name` is now
loaded and one of the two blocks is silently ignored.
**Fix:** Move retired configs to a directory outside the include path. Renaming
in place is a coin flip.

**Symptom:** `include` with an absolute path works and a relative one does not.
**Cause:** Relative paths resolve against the **prefix**, which is a build-time
value differing between distro packages, nginx.org packages and the container.
**Fix:** `nginx -V 2>&1 | tr ' ' '\n' | grep prefix` to see what yours is, and
prefer absolute paths in anything that moves between environments.

**Symptom:** A `server` block fails with `unknown "…" variable` naming a `map`
variable that is definitely defined.
**Cause:** The `map` is in a file included *after* the server block that uses it.
**Fix:** Name shared `http`-level files so they sort first — the `00-` prefix
convention above.

## Trade-off

**Textual inclusion is trivial to reason about and gives you nothing to lean on.**
No namespacing, no parameters, no conditional includes, no way to say "include
this only if the file exists". Snippets cannot take arguments, so a snippet that
needs to vary becomes two snippets.

What you get in exchange is that `nginx -T` can always show you the complete
truth as one flat document. There is no build step and no indirection to resolve
in your head — which is why `-T` is such an effective debugging tool, and why it
is the answer to almost every question on this page.

## Interview questions

**★ What does `include` do, and in which contexts can it appear?**
It substitutes a file's contents at the point of inclusion, parsed as if typed
there. Its documented context is `any`, so it works anywhere a directive is legal
— which is why an included file must itself be legal at that level.

**★ Why does the include-a-snippet pattern avoid the inheritance trap?**
Because the included directives land at the including level rather than being
inherited from a parent. Since every `proxy_set_header` is written at the same
level, there is no inherited set for the replace rule to discard.

**★ You added a file to `conf.d/` and nothing happened, but `nginx -t` passes.
What is wrong?**
The file almost certainly does not match the include mask — `conf.d/*.conf` will
not pick up `app.conf.bak` or `app`. nginx cannot report a syntax error in a file
it never opened. `nginx -T` shows what it actually read.

**Is `sites-available` / `sites-enabled` an nginx feature?**
No. It is a Debian and Ubuntu packaging convention that works only because their
`nginx.conf` includes `sites-enabled/*`. The nginx.org packages and the official
container use `conf.d/*.conf` and have no such directory.

**What is the risk of renaming a config file to disable it?**
If the new name still matches the include mask — `app-old.conf` does — it stays
live, and a duplicate `server_name` means one of the two blocks is silently
ignored. Move retired configs out of the included directory instead.

**Why do shared `http`-level files often start with a numeric prefix?**
Because includes expand in glob order, and a `map` or `limit_req_zone` must be
parsed before the `server` block that references it. Naming the file to sort
first removes the ordering question entirely.

---

← Index: [`include` and the file layout](README.md) · Next → [MIME types and `default_type`](02-mime-types.md)
