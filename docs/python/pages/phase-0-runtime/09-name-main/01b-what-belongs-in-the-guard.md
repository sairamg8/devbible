---
title: "The guard body should be one line, because everything it binds is a module global and everything above it is what servers, tests and importers actually see"
sidebar_label: "1b · What belongs in the guard"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Python 3.14
> [`__main__` — Top-level code environment](https://docs.python.org/3.14/library/__main__.html)
> (Idiomatic Usage) and
> [`multiprocessing` — Contexts and start methods](https://docs.python.org/3.14/library/multiprocessing.html#contexts-and-start-methods).
> Version spine: **CPython 3.14.7**.

**Deciding what goes above the guard and what goes below it is the whole design
decision, and the documentation's answer is unambiguous: as little as possible
goes below. The reason is not tidiness. A statement under the guard executes at
module scope, so every name it binds becomes a module global that other
functions in the file can read by accident; and every object a server, a test or
an importer needs must be defined *above* it, because those routes never execute
the guard at all.**

## The documentation's rule

> *"Putting as few statements as possible in the block below
> `if __name__ == '__main__'` can improve code clarity and correctness. Most
> often, a function named `main` encapsulates the program's primary behavior."*

And the reason, which is a correctness argument rather than a style one:

> *"Note that if the module didn't encapsulate code inside the `main` function
> but instead put it directly within the `if __name__ == '__main__'` block, the
> `phrase` variable would be global to the entire module. This is error-prone as
> other functions within the module could be unintentionally using the global
> variable instead of a local name. A `main` function solves this problem."*

Concretely, the failure it describes:

```python
# bad — `config` is a module global
if __name__ == "__main__":
    config = load_config(sys.argv[1])
    run(config)

def run(cfg=None):
    cfg = cfg or config      # reads the global; works as a script,
    ...                      # NameError when imported and called
```

```python
# good — `config` is a local
def main(argv: list[str] | None = None) -> int:
    args = argv if argv is not None else sys.argv[1:]
    run(load_config(args[0]))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
```

The second version fails immediately and loudly if `run` forgets its argument.
The first fails only in the import path — which is to say, in production.

## The division, in a table

| Goes **inside** the guard | Goes **outside** (module level) |
|---|---|
| `sys.exit(main())` | `def` and `class` statements |
| `multiprocessing.freeze_support()` | module constants and type aliases |
| `multiprocessing.set_start_method(...)` | `logger = logging.getLogger(...)` |
| `asyncio.run(main())` | `app = FastAPI()` / `application = get_wsgi_application()` |
| `uvicorn.run(app, ...)` for a dev launcher | `parser = build_parser()` if a doc tool needs it |
| a demo or self-test invocation | `Enum` and `dataclass` definitions |

Three rows are worth spelling out because they are the ones that break real
deployments.

## `app` goes outside; `uvicorn.run(app)` goes inside

`gunicorn myapp:app` and `uvicorn myapp:app` *import* `myapp` and look up the
attribute `app` — they never execute the guard. An `app` built inside the guard
does not exist for them, and the process dies at startup. The mirror image is
equally real: `uvicorn.run(app)` at module level starts a listening server the
moment anything imports the module, including `pytest` collection.

```python
# myapp/asgi.py
from fastapi import FastAPI

app = FastAPI()            # outside: the production server imports this

if __name__ == "__main__": # inside: only when a human runs the file
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=False)
```

The same split applies to Django's `wsgi.py`/`asgi.py` (the `application` object
is imported, never run by the file), to Celery's `app` object, and to any
plugin system that loads a module and reads an attribute out of it.

## `set_start_method` goes inside

The `multiprocessing` docs place it there explicitly:

> *"To select a start method you use the `set_start_method()` in the
> `if __name__ == '__main__'` clause of the main module."*

> *"`set_start_method()` should not be used more than once in the program."*

Those two sentences are one rule. [Chunk 4](04-multiprocessing-and-the-guard.md)
explains the mechanism: a spawned child **re-imports the main module**, so a
`set_start_method` at module level would execute a second time in the child,
violating the second sentence. Inside the guard, it runs exactly once, in the
parent, where it belongs.

## Asynchronous entry points

`asyncio.run()` creates and closes an event loop. It belongs inside the guard
for the same reason `uvicorn.run` does — it is an *action*, and it is a
particularly hostile one to perform at import time, because it will refuse to
run inside an already-running loop:

```python
async def main() -> int:
    async with httpx.AsyncClient() as client:
        ...
    return 0

if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
```

Note that `main` here is a coroutine function, so `sys.exit(main())` without the
`asyncio.run` would exit with a coroutine object as the status — which is not an
`int` and not `None`, so `sys.exit` prints its `repr` to stderr and exits 1.

## Gotchas

### `app = FastAPI()` inside the guard

**Symptom.** The dev server works, the production `gunicorn` command fails with
`Attribute "app" not found in module "myapp"`.
**Cause.** The server imports the module; the guard does not run under import.
**Fix.** Build `app` at module level and put only `uvicorn.run(app)` inside the
guard, as in the example above.

### `uvicorn.run(app)` outside the guard

**Symptom.** `pytest` hangs, or importing the module in a shell starts a web
server on port 8000 and never returns.
**Cause.** The mirror of the previous gotcha — the *action* is at module level,
so importing performs it.
**Fix.** The object outside, the action inside. If you need both an importable
app and a runnable file, that is exactly what the guard is for.

### Reading environment variables at module level

**Symptom.** `KeyError: 'DATABASE_URL'` during test collection, or a test that
sets an environment variable has no effect because the module already read it.
**Cause.** `DB = os.environ["DATABASE_URL"]` at module level executes once, at
first import, before any fixture has run — and the import cache means it will
never re-run.
**Fix.** Read configuration in a function, and cache it there if the cost
matters:

```python
@functools.cache
def settings() -> Settings:
    return Settings(db_url=os.environ["DATABASE_URL"])
```

`functools.cache` gives the same "computed once" property with a `cache_clear()`
a test can call.

### `os.getcwd()`-relative paths in the entry point

**Symptom.** The tool works from the project root and fails from anywhere else,
or under a systemd unit with a different `WorkingDirectory`.
**Cause.** A relative path resolved at module level against whatever directory
the process happened to start in. `sys.path[0]` differs by launch mode too — see
[topic 08, chunk 2](../08-imports/02-sys-path.md) — so "next to the script" is
not a stable notion either.
**Fix.** Resolve user data against an explicit argument, and package data with
`importlib.resources`:

```python
from importlib.resources import files
template = files("mypkg.templates").joinpath("report.html").read_text()
```

### `set_start_method` at module level

**Symptom.** `RuntimeError: context has already been set` in a child process, or
in a second call in the same program.
**Cause.** The main module is re-imported by spawned children, so a module-level
call runs again there; the docs state it must not be used more than once.
**Fix.** Move it under the guard, or stop using it and pass an explicit context
with `multiprocessing.get_context("spawn")` instead — which is what the docs
recommend for libraries.

### `logging.basicConfig()` at module level in a library

**Symptom.** Importing your package changes the logging behaviour of the
application that imported it, or your own configuration is silently ignored
because something else called `basicConfig` first.
**Cause.** `basicConfig` mutates the root logger and is a no-op if the root
logger already has handlers. It is an *application* decision performed at
*import* time by a library.
**Fix.** Call it inside `main()`, never at module level, and never in a library
module at all. Libraries add a `NullHandler` and stop:

```python
# mypkg/__init__.py
logging.getLogger(__name__).addHandler(logging.NullHandler())
```

### A guard in a module that is only ever imported

**Symptom.** Dead code that a reader assumes is reachable, and a test-coverage
report with a permanently uncovered branch.
**Cause.** A guard copied into every file by habit. In a module that no launch
mode ever targets, the body is unreachable.
**Fix.** Delete it, or make the module genuinely runnable and document that. A
`if __name__ == "__main__": main()` in a library module is a claim that
`python -m mypkg.thatmodule` is supported — do not make the claim by accident,
because [chunk 3](03-the-double-import-trap.md) shows what it costs when
somebody takes you up on it.

## Interview questions

**★ Why is `main()` recommended over putting the code directly under the guard?**
Because a block under the guard executes at module scope, so every name it binds
becomes a module global. Other functions in the file can then read those globals
by accident and appear to work when the module is run as a script, failing only
when it is imported and the globals do not exist. Wrapping the body in `main()`
makes those names locals, so the mistake becomes an immediate `TypeError` or
`NameError` instead. The docs make exactly this argument about the `phrase`
variable in their `echo.py` example.

**★ Where does the `app = FastAPI()` object belong relative to the guard, and
where does the server start?**
The object goes outside, the server start goes inside. `uvicorn myapp:app` and
`gunicorn myapp:app` import the module and look up the attribute, so an `app`
built inside the guard does not exist for them. Conversely, calling
`uvicorn.run(app)` at module level means importing the module for a test starts
a listening server. The two halves live on opposite sides of the same line, and
getting them the wrong way round produces two different production incidents.

**★ Why must `multiprocessing.set_start_method` be called inside the guard?**
Because the spawn and forkserver start methods re-import the main module in
every child process. A `set_start_method` at module level therefore executes
again inside each child, and the documentation states it *"should not be used
more than once in the program"* — the second call raises. Inside the guard it
runs once, in the parent, before any child exists. For library code the docs
prefer `get_context("spawn")`, which sets nothing globally and cannot conflict
with the application's choice.

**Why can't a library call `logging.basicConfig()`?**
Because it configures the *root* logger, which belongs to the application, and
it does so at import time — before the application has had a chance to express a
preference. Worse, it is a no-op when the root logger already has handlers, so
whether it wins is a function of import order. A library attaches a
`NullHandler` to its own logger and leaves configuration to `main()`.

**Is `if __name__ == "__main__":` harmful in a module nobody runs?**
Not harmful, but it is a lie in the source: it advertises that
`python -m mypkg.thatmodule` is a supported way to start the program. If someone
believes it, that module now exists twice in the process — once as `__main__`
and once under its real name — with two copies of every class it defines. Either
support the claim deliberately, with a thin body, or delete the guard.

**Where does `asyncio.run(main())` go?**
Inside the guard, because it is an action that creates and destroys an event
loop and will raise if a loop is already running in that thread. Note also that
if `main` is `async def`, `sys.exit(main())` on its own exits with a coroutine
object as the status — not an `int`, not `None` — so `sys.exit` prints its repr
to stderr and exits 1. The correct spelling is
`raise SystemExit(asyncio.run(main()))`.

---

← Prev: [What __name__ is](01-what-name-is.md) · Index: [if __name__ == "__main__"](README.md) · Next → [The entry-point contract](01c-the-entry-point-contract.md)
