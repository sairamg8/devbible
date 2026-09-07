---
title: "`dotenv-expand`: Why a `$` in Your Password Truncates It, and Why the Same File Means Two Things"
sidebar_label: "`dotenv-expand` & Escaping"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07 against the Vite documentation — [Env Variables and Modes](https://vite.dev/guide/env-and-mode). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> ⚠️ Scope: `dotenv-expand`'s own edge cases beyond what the Vite docs state — quoting rules, nested defaults — were **not** fetched from that project's documentation and are not asserted here.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ `dotenv-expand`: Why a `$` in Your Password Truncates It

Everyone learns the `VITE_` prefix. Almost nobody learns that Vite runs a **second** processing pass
over `.env` values, with shell-like substitution semantics — until a generated credential arrives
mangled and the investigation starts three systems away.

---

## 1. Under-The-Hood Mechanics

> *"Vite uses dotenv-expand to expand variables written in env files out of the box."* — [Env Variables and Modes](https://vite.dev/guide/env-and-mode)

So a `.env` file is not a key–value store. It is a **tiny template language**, and `$` is its
operator.

> *"Note that if you want to use `$` inside your environment value, you have to escape it with `\`."*

The docs' own three-line example is the whole specification:

```bash
KEY=123
NEW_KEY1=test$foo   # test        ← $foo was never defined → expands to NOTHING
NEW_KEY2=test\$foo  # test$foo    ← escaped, kept literally
NEW_KEY3=test$KEY   # test123     ← expanded
```

🔴 **Read `NEW_KEY1` carefully.** An **undefined** reference expands to the empty string. It does
not error, warn, or leave the text alone. This is the entire mechanism behind every "my token is
mysteriously truncated" report:

```
VITE_TOKEN=abc$Rt7!k
             └──┬──┘
                └─ read as the variable $Rt7, which does not exist
                   → expands to ""
                   → VITE_TOKEN becomes "abc!k"
```

The value is not empty and not obviously wrong — it is **plausible**. It fails downstream as an
authentication error, so the investigation begins at the auth service and takes hours to arrive back
at a file nobody suspected.

---

## 2. Real-World Engineering Scenario

**A password manager, a `$`, and a two-day outage investigation.**

A team rotated their staging API credentials. The new secret came out of a password generator:
`k9$Wm2!qXz`. It was pasted into `.env.staging` exactly as generated, committed to the secrets
store, and deployed.

Staging began returning 401s. The investigation went, in order: the identity provider's logs (the
credential was being *presented*, just rejected), clock skew on the token, a suspected rotation race
between two deploy jobs, and finally a support ticket with the API vendor.

What had happened is one line of `.env`:

```bash
VITE_STAGING_KEY=k9$Wm2!qXz
```

`$Wm2` is an undefined variable. It expanded to nothing. The application presented `k9!qXz` — the
right *length* range, the right character classes, a completely plausible credential. Nothing in any
log said "this value was modified", because from the application's point of view it never was.

Two details made it expensive:

- **The value looked fine everywhere it was inspected.** `cat .env.staging` shows the original.
  The mangling happens after parsing, so only a runtime log of the parsed value would have shown it
  — and logging credentials is exactly what you should not do.
- **It was intermittent across environments.** Production's key had no `$`, so production was fine,
  which pointed the investigation at "something about staging" rather than at the shared mechanism.

The fix is one backslash. The *durable* fix is a lint rule: any `.env` value containing an
unescaped `$` fails CI unless it is an intentional reference.

---

## 3. Production-Grade Code Example

```bash
# .env — composition done deliberately, with the pitfalls annotated.

# ── 1. Legitimate reuse. Definition BEFORE reference, so every reader agrees. ──
API_HOST=api.acme.com
VITE_API_URL=https://${API_HOST}/v2
VITE_WS_URL=wss://${API_HOST}/socket

# Note: API_HOST is unprefixed, so it never reaches the client — but its VALUE
# is now inside VITE_API_URL, which does. Expansion happens BEFORE the prefix
# filter, so composing a public value out of a private one exposes the private one.

# ── 2. Literal values containing $ — ALWAYS escape ─────────────────────────────
# ❌ VITE_TOKEN=k9$Wm2!qXz      → "k9!qXz"; $Wm2 is undefined and expands to ""
VITE_TOKEN=k9\$Wm2!qXz

# ── 3. NEVER rely on reverse-order expansion ───────────────────────────────────
# ❌ Vite gives "foobar"; docker compose and `source` give "foo".
# VITE_FOO=foo${VITE_BAR}
# VITE_BAR=bar
```

```bash
#!/usr/bin/env bash
# scripts/lint-env.sh — run in CI. Catches the class, not the instance.
# Flags any unescaped $ that is NOT followed by a defined-looking reference.
status=0
for f in .env .env.*; do
  [ -f "$f" ] || continue

  # 1. Unescaped $ in a value, excluding intentional ${...} and $NAME references
  if grep -nP '=[^#]*(?<!\\)\$(?![A-Za-z_{])' "$f"; then
    echo "::error file=$f::unescaped '\$' in a value — it will be expanded away"
    status=1
  fi

  # 2. Reverse-order references: a ${VAR} used before VAR is defined
  awk -F= '/^[A-Za-z_]/ {
    while (match($0, /\$\{?[A-Za-z_][A-Za-z0-9_]*\}?/)) {
      ref = substr($0, RSTART, RLENGTH); gsub(/[${}]/, "", ref)
      if (!(ref in seen)) print FILENAME ":" NR ": forward reference to " ref
      $0 = substr($0, RSTART + RLENGTH)
    }
    seen[$1] = 1
  }' "$f"
done
exit $status
```

```bash
# Verifying what a value ACTUALLY parsed to, without logging the secret itself.
# Compare lengths and a hash — never print the value.
node -e '
  const v = process.env.VITE_TOKEN ?? "";
  console.log("len", v.length, "sha256",
    require("crypto").createHash("sha256").update(v).digest("hex").slice(0, 12));
'
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — A `$` in a generated credential

```bash
# ❌ dotenv-expand sees $Rt7 as a reference. It is undefined, so it expands to "".
#    VITE_TOKEN becomes "abc!k" — not empty, just truncated, and entirely plausible.
VITE_TOKEN=abc$Rt7!k

# ✅
VITE_TOKEN=abc\$Rt7!k
```

Password generators emit `$` routinely. Any project that pastes generated secrets into `.env` will
hit this; it is a matter of time, not of carelessness.

### ⚠️ Pitfall 2 — Assuming quoting behaves like a shell

The Vite docs specify escaping with `\$` and nothing else about quoting. `dotenv`'s own quoting rules
(single vs double quotes, multi-line values) are that project's behaviour, not Vite's, and this page
deliberately does not assert them — **I did not fetch `dotenv`'s documentation in this pass.** If a
value's quoting matters, verify it against `dotenv` and `dotenv-expand` directly rather than
reasoning from shell habits.

### ⚠️ Pitfall 3 — Debugging by printing the value

The mangling happens after parsing, so `cat .env` always shows the original and tells you nothing.
The only useful evidence is the *parsed* value — and printing a credential to a CI log trades one
incident for a worse one. Compare a length and a truncated hash instead.

---

## Gotchas

**★ Symptom: a token, password or connection string is silently truncated.** Cause: an unescaped `$` triggered `dotenv-expand`, and an undefined reference expands to the empty string rather than erroring. Fix: escape it. Audit every generated credential the first time an auth error appears with a value that "looks right".

```bash
VITE_TOKEN=abc\$Rt7!k   # ✅
```

**★ Symptom: a 401 that reproduces on staging and not production, with no code difference.** Cause: only one of the two credentials happened to contain a `$`. Fix: same escape — but the diagnostic lesson matters more. An environment-specific auth failure with identical code is a *value* problem, and `.env` parsing is the first place to look, not the last.

**★ Symptom: `cat .env` shows the right value and the app disagrees.** Cause: the transformation happens after parsing, so the file on disk is not evidence. Fix: compare the parsed value's length and hash — never print the value itself into a CI log.

**★ Symptom: a value ending in `$` behaves oddly.** Cause: a trailing `$` with nothing after it is still the expansion operator's territory, and the Vite docs specify only that `$` must be escaped with `\` — they do not enumerate what an unescaped trailing `$` does. Fix: escape it and stop guessing; this is a case where the documentation genuinely does not settle the behaviour.

**★ Symptom: a multi-line value (a PEM key, a certificate) does not parse as expected.** Cause: multi-line and quoting semantics come from `dotenv`, not from anything Vite documents. Fix: verify against `dotenv`'s own docs — and reconsider: a PEM in a client-side `.env` is a secret in a public bundle, which is a bigger problem than the parsing.

---

## Interview questions

**★ What is `dotenv-expand` doing to your `.env` file, and when does it hurt?**
It performs shell-style `$VAR` and `${VAR}` substitution on values, so a `.env` file is a small
template language rather than a key–value store. It hurts in two places. First, any literal `$` in a
generated credential is read as a reference, and an undefined reference expands to the empty string
rather than erroring — so the value is silently *truncated* rather than missing, and you find out at
the auth layer, three systems from the cause. Second, Vite supports **reverse-order** expansion,
referencing a variable defined further down the file, which `docker compose` and shell `source` do
not. The same bytes then yield different values to different readers with a byte-identical diff. The
docs recommend against relying on it and warn of future warnings, so treat it as deprecated.

**★ Why is a truncated secret worse than a missing one?**
Because a missing value fails loudly and locally — an empty string usually trips a required-field
check, or produces an obviously malformed request. A truncated one is the right shape: right
character classes, plausible length, no null. It passes every validation you wrote, gets presented
to the remote service, and comes back as a generic 401. The failure surfaces at the furthest point
from its cause, and every log along the way shows the value being handled correctly, because from
the application's perspective it was. This is a general principle worth stating in an interview:
**silent value corruption is more expensive than absence**, which is why config validation should
check *shape*, not just presence.

**★ How would you debug a value you suspect is being mangled, without leaking it?**
Not by printing it, and not by reading the file — the file is not evidence, because the
transformation happens after parsing. Print the *parsed* value's length and a truncated SHA-256, and
compare against the same two facts computed from the intended value on a machine where you already
have it. That distinguishes "truncated" from "wrong" from "correct but rejected" in one step,
without putting a credential into a CI log that is retained for ninety days and visible to everyone
with read access to the repository.

---

← [Modes in CI & Containers](01f-modes-in-ci-and-containers.md) · [Vite overview](../../README.md) · Next → [Composition, the Prefix Filter & Tool Interop](01h-env-composition-and-interop.md)
