---
title: "What if actually is"
sidebar_label: "01 · What if actually is"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-15 against [ngx_http_rewrite_module](https://nginx.org/en/docs/http/ngx_http_rewrite_module.html)
> — the `if` directive's syntax, context, allowed conditions, the sentence
> *"the request is assigned the configuration inside the `if` directive"*, and the
> module's "Internal Implementation" section.
> **No sandbox run** — nothing on this page was executed, and it carries no console output.

**`if` is not a statement. It is a block directive that creates a configuration
context, and the request is moved into it.**

## The documentation, read carefully

```text
Syntax:   if (condition) { ... }
Default:  —
Context:  server, location
```

> *"The specified condition is evaluated. If true, **this module** directives
> specified inside the braces are executed, **and the request is assigned the
> configuration inside the `if` directive**. Configurations inside the `if`
> directives are inherited from the previous configuration level."*

Two phrases carry the whole page.

**"the request is assigned the configuration inside the `if`"** — `if` is a
*level*, exactly like `location` is. It inherits from its parent, and per
[page 02's replace rule](../02-inheritance.md) it discards any multi-valued
directive it redefines.

**"this module directives"** — `if` belongs to `ngx_http_rewrite_module`, and only
that module's directives (`break`, `return`, `rewrite`, `set`) are defined to work
inside it. Everything from every other module happens to be *parseable* there and
is not specified to behave.

## The conditions it accepts

Documented in full, and worth knowing so you recognise them in other people's
configs:

| Condition | Meaning |
|---|---|
| `$var` | false if the value is an empty string or `0` |
| `=`, `!=` | comparison with a string |
| `~`, `~*` | regex match, case-sensitive / insensitive |
| `!~`, `!~*` | negated regex match |
| `-f`, `!-f` | file exists / does not |
| `-d`, `!-d` | directory exists / does not |
| `-e`, `!-e` | file, directory or symlink exists |
| `-x`, `!-x` | executable file exists |

Note there is **no `and`, no `or`, no `else` and no `elseif`**. That absence is
not an oversight — it is a sign of what `if` was scoped to do.

## The two things that are safe

| Safe | Why |
|---|---|
| `return` | a rewrite-module directive; terminates processing immediately |
| `rewrite` | a rewrite-module directive; the classic conditional-redirect use |

`set` and `break` are also rewrite-module directives, so they execute — but `set`
inside `if` interacts with the phase ordering from
[page 04](../04-variables.md) and is rarely what you want.

**Everything else** — `proxy_pass`, `add_header`, `try_files`, `root`, `expires`,
`limit_req`, `access_log` — may parse, and its behaviour inside `if` is not
something to build on.

## Breakage 1 — `add_header` silently drops the inherited set

```nginx
location / {
    add_header X-Frame-Options DENY;

    if ($http_user_agent ~* "bot") {
        add_header X-Robots-Tag noindex;
        # ✗ the request is now in the `if` context, which defines an add_header,
        #   so X-Frame-Options — inherited from the location — is GONE.
    }
}
```

This is just the replace rule applied to a context you did not realise you had
created. Nothing errors, nothing warns; one class of request quietly loses a
security header.

## Breakage 2 — two `if` blocks do not combine

```nginx
location / {
    if ($request_method = POST) { set $a 1; }
    if ($http_x_test)           { set $b 1; }   # if both match, only ONE context applies
    proxy_pass http://app;
}
```

There is no accumulation and no `else`. When two `if`s match, the request ends up
assigned **one** configuration and the other's is not merged in. A config that
reads as a chain of independent checks is not one.

## Breakage 3 — `if` with a content-phase directive

```nginx
location / {
    try_files $uri $uri/ @fallback;

    if ($host = old.example.com) {
        proxy_pass http://legacy;    # ✗ documented as producing unpredictable results
    }
}
```

`if` containing a content-phase directive, alongside `try_files` in the same
location, is the canonical example on the wiki page. It has historically produced
crash-class behaviour and produces wrong routing in current versions. This is not
a subtle performance concern; it is a "do not do this" case.

## Why it is like this

The module's "Internal Implementation" section explains it. Rewrite-module
directives *"are compiled at the configuration stage into internal instructions
that are interpreted during request processing"* by *"a simple virtual stack
machine"*, and they all execute in the rewrite phase.

So `if` is not a runtime branch over the whole configuration — it is an
instruction in a small interpreter that runs early, whose side effect is
**selecting a configuration context**. Directives from other modules were never
part of that design; they are simply structurally allowed to appear between the
braces.

Once you see it that way the behaviour stops being surprising. `if` does exactly
what it was built to do, and what it was built to do is much narrower than the
syntax suggests.

## Gotchas

**Symptom:** A header set at `location` level disappears for requests matching an
`if`.
**Cause:** The `if` created a configuration context that defines `add_header`, so
the inherited set was replaced.
**Fix:** Move the condition into a `map` and set the header unconditionally from
the mapped value — see [chunk 02](02-what-to-use-instead.md).

**Symptom:** Two `if` blocks both match and only one takes effect.
**Cause:** The request is assigned **one** configuration; matching contexts do not
merge, and there is no `else`.
**Fix:** Express the whole decision as a single `map` with one entry per case.

**Symptom:** `proxy_pass` inside `if`, combined with `try_files` in the same
location, routes unpredictably.
**Cause:** The documented-as-unsafe combination.
**Fix:** Separate `location` blocks. There is no configuration of this shape worth
saving.

**Symptom:** `nginx: [emerg] "if" directive is not allowed here` inside `http`.
**Cause:** `if` is `server` and `location` context only.
**Fix:** Whatever you were about to do at `http` level, a `map` does better — and
`map` is an `http`-context directive.

**Symptom:** You want `if (A and B)` and nginx will not parse it.
**Cause:** There is no `and`, `or`, `else` or `elseif`. The grammar has none.
**Fix:** Build a composite key and use a `map` — `map "$a:$b" $result { … }`.

## Trade-off

**`if` gives you a familiar-looking construct whose semantics are not the familiar
ones.** Every developer can read `if ($host = www.example.com)` and believe they
know what happens next. That legibility is exactly what makes it dangerous: the
construct borrows the appearance of a conditional statement while actually being
a configuration-context selector in a small stack machine.

nginx could have named it something else and saved a great deal of trouble. It did
not, and the compensating knowledge is this page: **`if` is a level, not a
branch.**

## Interview questions

**★ Why is `if` considered harmful in nginx?**
Because it is not a statement — it is a block directive that creates a
configuration context, and the request is assigned that context. Only
rewrite-module directives are defined to work inside it; directives from other
modules parse but are not specified to behave, and `if` + `proxy_pass` +
`try_files` in one location is documented as unpredictable.

**★ Why does `add_header` inside an `if` drop the headers set outside it?**
Because `if` is a configuration level, so the replace-not-merge inheritance rule
applies: the `if` context defines an `add_header`, therefore it inherits none from
the enclosing `location`.

**★ Which directives are safe inside `if`?**
`return` and `rewrite` — both rewrite-module directives, both terminating or
redirecting. `set` and `break` also execute but interact with phase ordering in
ways that are rarely what you want.

**If two `if` blocks in the same location both match, what happens?**
The request is assigned one configuration; they do not merge, and there is no
`else`. A config that reads like a chain of independent checks is not one.

**Why does `if` behave this way at all?**
Because the rewrite module compiles its directives into instructions for a simple
virtual stack machine that runs in the rewrite phase, and `if`'s effect is to
select a configuration context. Directives from other modules were never part of
that design.

**Does nginx's `if` support `and`, `or` or `else`?**
None of them. The condition grammar is a single test — a variable, a string
comparison, a regex match, or a file-existence check. That absence is a signal of
how narrowly the directive was scoped.

---

← Index: ["If is evil"](README.md) · Next → [What to use instead](02-what-to-use-instead.md)
