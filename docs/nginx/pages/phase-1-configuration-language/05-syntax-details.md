---
title: "Units, quoting and comments"
sidebar_label: "05 · Units, quoting and comments"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against [Configuration file measurement units](https://nginx.org/en/docs/syntax.html)
> (every suffix and the combining rule below is quoted from it),
> [ngx_core_module](https://nginx.org/en/docs/ngx_core_module.html) and
> [ngx_http_core_module](https://nginx.org/en/docs/http/ngx_http_core_module.html).
> **No sandbox run** — nothing on this page was executed, and it carries no console output.

**Units are part of the syntax, not decoration. `keepalive_timeout 60` is sixty
*seconds*; `client_max_body_size 10` is ten *bytes*. The same bare number means
something different depending on which directive it is attached to.**

## Size suffixes

| Suffix | Means | Used by |
|---|---|---|
| *(none)* | **bytes** | all size directives |
| `k` or `K` | kilobytes | sizes and offsets |
| `m` or `M` | megabytes | sizes and offsets |
| `g` or `G` | gigabytes | **offsets only** |

That last row is a real distinction the documentation draws: `g` is available for
*offsets*, which is why `proxy_max_temp_file_size 1g;` and
`proxy_cache_path … max_size=10g;` work, and why you write large body limits in
`m`.

```nginx
client_max_body_size   50m;    # 50 megabytes
client_body_buffer_size 16k;   # 16 kilobytes
proxy_buffer_size       4k;
client_max_body_size   10;     # ⚠ TEN BYTES. Almost certainly not what you meant.
```

## Time suffixes

Quoted from the documentation, in full:

| Suffix | Unit |
|---|---|
| `ms` | milliseconds |
| `s` | seconds — **the default when no suffix is given** |
| `m` | minutes |
| `h` | hours |
| `d` | days |
| `w` | weeks |
| `M` | **months (30 days)** |
| `y` | years (365 days) |

**Two of these are traps.** `m` means *minutes* in a time context and *megabytes*
in a size context — the same letter, and only the directive tells you which.
And `M` (capital) is *months*, while `m` (lowercase) is *minutes*: nginx time
suffixes are the one place in the config file where case is significant.

The documentation's own advice is the right habit: *"it is recommended to always
specify a suffix"*. A bare `60` is legal and means sixty seconds, and it is
exactly the kind of thing that reads as "sixty minutes" to the next person.

### Units combine

*"Multiple units can be combined in a single value by specifying them from most to
least significant, optionally separated by whitespace."*

```nginx
proxy_read_timeout  1h 30m;    # documented as identical to 90m and to 5400s
expires             30d;
ssl_session_timeout 1d;
keepalive_timeout   65s;       # say the s, even though it is the default
```

One caveat the page notes: some time intervals accept **only seconds
resolution**, so `500ms` is meaningful for `proxy_connect_timeout` and rounded
elsewhere. The directive's own documentation is the authority when it matters.

## Quoting

nginx needs quotes far less often than most config languages, and the rule is
mechanical: **quote when the value contains whitespace, a semicolon, braces, or is
an empty string.**

```nginx
add_header X-Frame-Options DENY;                       # no quotes needed
add_header Cache-Control "public, max-age=31536000";   # contains a space and a comma
proxy_set_header Connection "";                        # empty string MUST be quoted
return 200 "ok\n";                                     # contains an escape
log_format main '$remote_addr - $request';             # single quotes are equally valid
```

Single and double quotes are interchangeable. **Variables are interpolated inside
both** — nginx has no "raw string" quote:

```nginx
return 200 "$host";      # the value of $host
return 200 '$host';      # ALSO the value of $host — single quotes do not escape
return 200 "\$host";     # a literal dollar sign, escaped
```

That last line is how you get a literal `$` — with a backslash, not by choosing a
different quote character. The mistake matters most in `log_format`, where a
literal `$` in your format string is very unlikely to be what you want anyway.

A related case: `${name}` braces exist for when a variable is followed by
characters that could be part of its name.

```nginx
proxy_pass http://$backend_host:8080;        # fine — ':' cannot be in a name
set $file "${name}_backup.txt";              # braces needed — '_backup' would be read as part of the name
```

## Comments

One form only:

```nginx
# a comment runs from the hash to the end of the line
worker_processes auto;    # trailing comments are fine
```

There is **no block comment**. Commenting out a `server { … }` block means
prefixing every line, which is why the "move it out of the include path"
convention from [topic 03](03-include-and-files/01-how-include-works.md) exists —
it is genuinely the easier way to disable a block of config.

## The stray semicolon

Every simple directive ends in `;`. Block directives do not:

```nginx
server {          # ✓ no semicolon after a block's opening brace
    listen 80;    # ✓ simple directive, semicolon required
}                 # ✓ no semicolon after the closing brace
```

Three failure modes, and knowing which is which saves real time:

| Mistake | What nginx says |
|---|---|
| Missing `;` after a simple directive | `unexpected "…"` or `directive "x" is not terminated by ";"` |
| Extra `;` after a block's `}` | `unexpected ";"` |
| Unbalanced braces | `unexpected end of file, expecting "}"` — reported at the **end of the file** |

**The important one is the third.** nginx reports the failure where the parse
gives up, not where you made the mistake, so a missing `}` near the top of a long
file is reported hundreds of lines later. Read *upward* from the reported line,
and let an editor's brace matching do the work.

`nginx -t` catches all three before a reload can, which is the entire argument for
[`nginx -t && nginx -s reload`](../phase-0-process-model/06-testing-the-config.md).

## Gotchas

**Symptom:** Uploads over 10 bytes fail with 413.
**Cause:** `client_max_body_size 10;` — a bare number is **bytes**.
**Fix:** `client_max_body_size 10m;`. Always write the suffix. This is the
single most common unit mistake in nginx configs.

**Symptom:** A timeout you set to `5` behaves as five seconds when you meant five
minutes.
**Cause:** No suffix means seconds for time directives.
**Fix:** `5m`. And note that `m` here is *minutes* — the same letter means
megabytes on a size directive.

**Symptom:** `expires 1M;` produced a much longer cache lifetime than expected.
**Cause:** Capital `M` is **months (30 days)**; lowercase `m` is minutes. Time
suffixes are case-sensitive.
**Fix:** Decide which you meant and be explicit — `30d` is unambiguous to every
reader and is what most people intend.

**Symptom:** `nginx: [emerg] invalid number of arguments`.
**Cause:** An unquoted value containing a space, so nginx read it as several
arguments.
**Fix:** Quote it: `add_header Cache-Control "public, max-age=3600";`.

**Symptom:** `nginx: [emerg] unexpected end of file, expecting "}"` pointing at
the last line of the file.
**Cause:** An unclosed brace somewhere far above.
**Fix:** Read upward, not at the reported line. The reported position is where
the parse failed, not where the error is.

**Symptom:** A literal `$` in a `log_format` or `return` string became an empty
value.
**Cause:** Variables interpolate inside both single and double quotes — there is
no raw-string quote in nginx.
**Fix:** Escape it as `\$`.

## Trade-off

**Unit suffixes make values self-documenting and make bare numbers dangerous.**
`50m` cannot be misread; `50` can, and nginx will accept it without complaint
because a bare number is always valid — just in a different unit than you meant.

There is no type checking to lean on here and no linter that knows your intent.
The only defence is the documentation's own advice, adopted as a habit: **always
write the suffix**, even when it is the default. `keepalive_timeout 65s;` costs
one character and removes a whole class of review comment.

## Interview questions

**★ What does `client_max_body_size 10;` mean?**
Ten **bytes**. A size value with no suffix is bytes, so this rejects essentially
every request with a body. The intended value is almost always `10m`.

**★ In nginx, does `m` mean minutes or megabytes?**
Both, depending on the directive — minutes in a time value, megabytes in a size
value. Nothing in the syntax distinguishes them; only the directive does. Worse,
in time values `M` (capital) means months, so time suffixes are case-sensitive.

**★ What is the default time unit when no suffix is given?**
Seconds. The documentation still recommends always writing the suffix, because a
bare `60` reads ambiguously to the next person even though nginx is certain.

**Can nginx time values combine units?**
Yes — most to least significant, optionally separated by whitespace. The
documented example is `1h 30m`, which is identical to `90m` and to `5400s`.

**When do you need quotes in an nginx config?**
When the value contains whitespace, a semicolon, braces, or is the empty string —
`proxy_set_header Connection "";` is the classic case. Single and double quotes
are interchangeable, and **both interpolate variables**, so a literal dollar sign
needs `\$` rather than a different quote character.

**Does nginx have block comments?**
No — only `#` to end of line. Disabling a whole `server` block means commenting
every line, which is why moving the file out of the include path is the
conventional way to switch a site off.

**`nginx -t` reports `unexpected end of file, expecting "}"` on the last line.
Where is the bug?**
Not on that line. An unbalanced brace is only detected when the parse runs out of
input, so the real mistake is somewhere above — read upward and rely on brace
matching.

---

← Prev: [Variables](04-variables.md) · Index: [Phase 1](README.md) · Next → [`map`](06-map.md)
