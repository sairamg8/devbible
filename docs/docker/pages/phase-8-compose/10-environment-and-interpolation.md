---
title: "Environment and interpolation"
sidebar_label: "10 · Environment and interpolation"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against
> [Interpolation](https://docs.docker.com/reference/compose-file/interpolation/),
> [Environment variables precedence](https://docs.docker.com/compose/how-tos/environment-variables/envvars-precedence/),
> [the `services` element](https://docs.docker.com/reference/compose-file/services/) and
> [the `docker compose` CLI reference](https://docs.docker.com/reference/cli/docker/compose/).
> **No sandbox** — no console output on this page.

**There are three mechanisms here, they are constantly confused for one another, and
the confusion is the single most common source of "my environment variable is
empty".** Get the three straight and the precedence table becomes a lookup rather
than a mystery.

## The three mechanisms

| Mechanism | Where the value goes | Written as |
|---|---|---|
| **The project `.env` file** | Into **the Compose file itself**, filling `${...}` placeholders | A `.env` beside the compose file, or `--env-file` |
| **`env_file:`** | Into **the container's environment** | A service attribute naming one or more files |
| **`environment:`** | Into **the container's environment** | A service attribute with literal values |

Read that first row twice. **The `.env` file does not put anything in your
container.** It supplies values for interpolation while Compose parses the file. If
a service needs `DATABASE_URL`, a `.env` containing `DATABASE_URL=...` reaches it
only because something in the compose file said so:

```yaml
services:
  api:
    environment:
      DATABASE_URL: ${DATABASE_URL}     # ← this line is what makes it happen
```

Without that line the value sits in `.env`, gets loaded, and goes nowhere.

⚠️ **The exception that hides the rule:** Compose *also* makes shell and `.env`
variables available to a bare `environment: - DATABASE_URL` entry (a name with no
value), which passes the ambient value through. That is why the mechanism sometimes
appears to work by magic — and why it stops working the moment somebody rewrites the
list into map form.

## Interpolation syntax

"Both `$VARIABLE` and `${VARIABLE}` syntax is supported", and the braced form takes
modifiers:

| Form | Meaning |
|---|---|
| `${VAR}` | The value of `VAR` |
| `${VAR:-default}` | The value of `VAR` if **set and non-empty**, otherwise `default` |
| `${VAR-default}` | The value of `VAR` if **set**, otherwise `default` |
| `${VAR:?error}` | The value of `VAR` if set and non-empty, otherwise **exit with error** |
| `${VAR?error}` | The value of `VAR` if set, otherwise exit with error |
| `${VAR:+replacement}` | `replacement` if `VAR` is set and non-empty, otherwise empty |
| `${VAR+replacement}` | `replacement` if `VAR` is set, otherwise empty |

**The colon is the whole distinction:** colon variants require set *and non-empty*;
non-colon variants only require *set*. An empty string is a real value, and the
difference decides whether `POSTGRES_PASSWORD=` gives you an empty password or the
default.

🔴 **`${VAR:?error}` is underused and should not be.** It turns a silently missing
secret into a refusal to start:

```yaml
services:
  api:
    environment:
      JWT_SECRET: ${JWT_SECRET:?JWT_SECRET must be set}
      API_PORT: ${API_PORT:-3000}
    ports:
      - "${API_PORT:-3000}:3000"
```

A stack that fails loudly on a missing secret is strictly better than one that boots
with an empty one and fails an hour later inside an auth handler.

**A literal dollar sign needs doubling:** "You can use a `$$` (double-dollar sign)
when your configuration needs a literal dollar sign." This bites on bcrypt hashes,
crontab lines and any password containing `$` — Compose eats the single `$` and you
get a mangled value with no warning.

## The precedence, highest first

From the documentation, for a variable that ends up inside the container:

1. Set using `docker compose run -e` on the CLI
2. Set with `environment` or `env_file` **but with the value interpolated** from
   your shell or an environment file
3. Set using just the `environment` attribute in the Compose file
4. Use of the `env_file` attribute in the Compose file
5. Set in the container image with the `ENV` directive

The shape to remember: **the CLI beats the file, interpolated beats literal, and
anything in Compose beats the image's `ENV`.** Row 5 is the one that catches people
coming from Dockerfiles — an `ENV NODE_ENV=production` baked into the image loses to
a compose file that says otherwise
([Phase 3, page 07](../phase-3-dockerfile/07-env-vs-arg.md)).

Note that row 2 outranks row 3: `environment: {FOO: ${FOO}}` with `FOO` set in your
shell beats `environment: {FOO: literal}` — the interpolated value wins because the
outer source is more specific.

## `.env`, and `--env-file`

```bash
docker compose up -d                              # loads ./.env
docker compose --env-file .env.staging up -d      # loads that instead
```

`--env-file` replaces the default; it does not add to it. Two habits follow:

- **Commit a `.env.example`, never the `.env`.** The real file holds secrets and
  belongs in `.gitignore` — and in `.dockerignore` too, for a different reason: it
  otherwise lands in the build context and can end up in a layer
  ([Phase 3, page 08](../phase-3-dockerfile/08-dockerignore.md)).
- **`docker compose config` is the arbiter.** It renders the file after
  interpolation, so "is the variable actually set" takes one command rather than a
  guess ([page 02](02-compose-yaml-and-the-spec/02-yaml-that-bites.md)).

⚠️ **`env_file` is parsed by Compose, not sourced by a shell.** As with
`docker run --env-file` ([Phase 1, page 06](../phase-1-running-containers/06-environment.md)),
do not expect `export`, shell quote-stripping, variable expansion inside the file,
or trailing comments to behave the way they do in a script. A line reading
`PASSWORD="hunter2"` may well deliver the quotes.

## None of this is a secret store

Everything here is visible to anyone who can run `docker inspect`, and `.env` files
have a long history of being committed by accident. For development this is an
accepted trade; for anything else, `secrets:` exists and the material lives outside
the compose file. **Phase 10 · Config and secrets in production** *(not written
yet)* is where that is taken seriously.

The rule from Phase 2 applies unchanged: if a secret has reached a place it should
not be, **rotate it** — deleting the file does not unpublish it.

## Podman

Interpolation happens in the compose provider before Podman sees anything, so the
syntax and precedence above are the provider's behaviour
([page 15](15-podman-compose.md)) and match this documentation when `docker-compose`
is the provider. Podman's own environment handling for a plain `podman run` is the
same as Docker's.

One Podman-specific hazard worth carrying: registry credentials live in a
per-session `XDG_RUNTIME_DIR` authfile, so a compose stack started by a systemd unit
may not see a login you performed interactively
([Phase 2, page 09](../phase-2-images-and-registries/09-authentication.md)).

## Gotchas

**Symptom:** A variable is in `.env` and the container does not have it.
**Cause:** `.env` feeds interpolation in the compose file, not the container.
**Fix:** Reference it — `environment: {FOO: ${FOO}}` — or list the bare name under
`environment` to pass the ambient value through. `docker compose config` shows what
the service actually got.

**Symptom:** A password containing `$` arrives truncated or mangled.
**Cause:** Compose interpreted it as an interpolation.
**Fix:** Double it — `$$`. Or keep the value out of the compose file entirely.

**Symptom:** The stack started with an empty secret and failed much later.
**Cause:** `${JWT_SECRET}` on an unset variable interpolates to empty, which is a
valid value.
**Fix:** `${JWT_SECRET:?JWT_SECRET must be set}` so it refuses to start.

**Symptom:** `${VAR:-default}` used the default even though `VAR` is set.
**Cause:** It is set to the empty string, and the colon variant treats empty as
unset.
**Fix:** Decide which you mean. `${VAR-default}` honours an empty value; `${VAR:-default}`
replaces it.

**Symptom:** A value from `env_file` arrives with quotes around it.
**Cause:** `env_file` is parsed, not sourced — quoting rules are not shell rules.
**Fix:** Write the value unquoted in the file.

## Interview questions

**★ What is the difference between the `.env` file and `env_file:`?**
Completely different mechanisms. `.env` sits beside the compose file and supplies
values for `${...}` interpolation *in the compose file itself* — it puts nothing in
any container. `env_file:` is a service attribute naming files whose contents are
passed *into the container's environment*. The commonest bug in Compose is expecting
`.env` to do `env_file`'s job.

**★ What does the colon do in `${VAR:-default}`?**
It makes the check "set and non-empty" rather than just "set". `${VAR:-default}`
substitutes the default when `VAR` is unset *or* empty; `${VAR-default}` only when it
is unset, so an explicitly empty value survives. The same distinction applies to
`:?` and `:+`.

**★ Which wins: `environment`, `env_file`, or the image's `ENV`?**
`environment` beats `env_file`, and both beat the image's `ENV`. Above all of them, a
value interpolated from the shell or an environment file beats a literal in the
compose file, and `docker compose run -e` beats everything. The short version:
the CLI beats the file, interpolated beats literal, and Compose beats the image.

**How do you make a stack refuse to start when a secret is missing?**
`${JWT_SECRET:?JWT_SECRET must be set}`. It exits with that message rather than
interpolating to an empty string. It is the difference between a clear failure at
`up` and a confusing one in production an hour later.

**A password contains a `$` and arrives wrong. Why?**
Compose treated it as the start of an interpolation. Escape it by doubling the
dollar sign — `$$`. It is the same hazard as bcrypt hashes and crontab entries in a
compose file.

**Is `.env` a safe place for secrets?**
For local development it is the accepted convention, provided it is in `.gitignore`
*and* `.dockerignore`. It is not a secret store: the values are readable with
`inspect`, and `.env` files are committed by accident constantly. Anything that
matters belongs in a real secret mechanism — and if one has leaked, rotate it,
because deleting the file does not unpublish it.

---

← Prev: [The project name](09-project-name.md) · Index: [Phase 8](README.md) · Next → [Override files](11-override-files.md)
