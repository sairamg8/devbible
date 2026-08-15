---
title: "Heredocs"
sidebar_label: "14 · Heredocs"
sidebar_position: 14
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the
> [Dockerfile reference — here-documents](https://docs.docker.com/reference/dockerfile/#here-documents)
> and the [Dockerfile frontend release notes](https://docs.docker.com/build/buildkit/dockerfile-release-notes/).
> **No sandbox** — no console output on this page.

**Heredocs let a `RUN` span multiple lines without `&& \` chains, and let `COPY`
write a small file inline.** Purely a readability feature — and readability is
what makes long `RUN` blocks reviewable.

## Requires the syntax directive

```dockerfile
# syntax=docker/dockerfile:1
```

Heredocs are a BuildKit frontend feature, so the parser directive must be the
**first line** of the file (page 15).

## Multi-line `RUN`

```dockerfile
# syntax=docker/dockerfile:1
FROM debian:12-slim

RUN <<EOF
apt-get update
apt-get install -y --no-install-recommends curl ca-certificates
rm -rf /var/lib/apt/lists/*
EOF
```

Compare with the traditional form:

```dockerfile
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
```

Both produce **one layer**. The heredoc reads as a script, and a diff that adds a
package touches one line instead of reflowing the chain.

## 🔴 The failure-mode difference

This is the part that matters more than the syntax.

With `&&`, a failing command stops the chain — `&&` only continues on success.
With a heredoc, the body runs under `/bin/sh`, which by default **continues after
a failed command** and returns the status of the *last* one. A failure in the
middle can therefore be ignored and the layer committed anyway.

```dockerfile
RUN <<EOF
set -eux                    # ← exit on error, exit on unset var, trace
apt-get update
apt-get install -y curl
rm -rf /var/lib/apt/lists/*
EOF
```

**Start every heredoc `RUN` with `set -e`** (or `set -eux`). Without it you have
traded a fail-fast chain for a script that can silently half-succeed.

## Choosing an interpreter

```dockerfile
RUN <<EOF bash
set -euo pipefail
[[ -f /etc/os-release ]] && echo "found"
EOF

RUN <<EOF python3
import json, pathlib
pathlib.Path("/app/config.json").write_text(json.dumps({"env": "prod"}))
EOF
```

The interpreter goes after the delimiter. Useful when the setup logic is easier
in Python than in shell — and the interpreter must exist in the image.

## Inline files with `COPY`

```dockerfile
COPY <<EOF /app/config.json
{
  "logLevel": "info",
  "port": 3000
}
EOF
```

Good for a few lines of configuration that would otherwise need a separate file
in the build context. Beyond about ten lines, a real file is easier to lint,
diff and syntax-highlight.

## Quoting the delimiter

As in shell heredocs, quoting stops expansion:

```dockerfile
RUN <<'EOF'
echo '$HOME is not expanded here — it is written literally'
EOF
```

Unquoted `<<EOF` allows the shell inside the container to expand variables;
quoted `<<'EOF'` writes them literally. This matters when generating a script or
a config file that contains `$` characters.

## Podman

`podman build` supports heredocs when using a BuildKit-compatible frontend
version. Support for the newest frontend features can lag; if a heredoc is not
recognised, that is a builder-capability difference rather than a Dockerfile
error. The `&& \` form remains universally portable, which is a fair reason to
keep using it in a Dockerfile that must build anywhere.

## Gotchas

**Symptom:** A heredoc `RUN` succeeds although a command inside it failed.
**Cause:** `/bin/sh` continues after errors and returns the last command's
status.
**Fix:** `set -e` as the first line of every heredoc body. This is the single
most important rule on this page.

**Symptom:** The build fails with a parse error on `<<EOF`.
**Cause:** The `# syntax=docker/dockerfile:1` directive is missing, or is not the
first line.
**Fix:** Add it at the very top — before comments, before `FROM`.

**Symptom:** `$VARIABLE` inside a heredoc was expanded when you wanted it
literal.
**Cause:** The delimiter was unquoted.
**Fix:** `<<'EOF'`.

**Symptom:** A heredoc that works locally fails in another builder.
**Cause:** Frontend-version differences.
**Fix:** Pin `# syntax=docker/dockerfile:1` so the frontend is fetched rather
than assumed, and fall back to `&& \` if the builder cannot fetch frontends.

## Interview questions

**★ What do heredocs give you in a Dockerfile?**
Multi-line `RUN` bodies without `&& \` chains, and inline file creation with
`COPY <<EOF`. Both are readability features; a heredoc `RUN` still produces one
layer, exactly as the chained form does.

**★ What is the one thing you must add to a heredoc `RUN`?**
`set -e`. Without it the body runs under `/bin/sh`, which continues after a
failed command and returns the last one's status — so a mid-script failure can be
silently committed into the layer. `&&` chains fail fast for free.

**★ What must be at the top of the file for heredocs to work?**
`# syntax=docker/dockerfile:1`, as the very first line. Heredocs are a BuildKit
frontend feature and the parser directive is how the frontend is selected.

**How do you stop variable expansion inside a heredoc?**
Quote the delimiter: `<<'EOF'`. Unquoted, the shell expands `$VAR` as usual.

---

← Prev: [VOLUME in a Dockerfile](13-volume.md) · Index: [Phase 3](README.md) · Next → [The syntax directive](15-syntax-directive.md)
