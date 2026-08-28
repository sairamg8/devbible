---
title: "TypeScript wins on expressiveness and coverage, Python wins because its annotations still exist at runtime — and the tax of choosing both is one generated client"
sidebar_label: "4b · Checkers and validation"
sidebar_position: 8
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the [mypy configuration
> reference](https://mypy.readthedocs.io/en/stable/config_file.html), the
> [Pyright documentation](https://microsoft.github.io/pyright/), the Python
> [`typing`](https://docs.python.org/3.14/library/typing.html) docs,
> [PEP 561](https://peps.python.org/pep-0561/) (`py.typed`), the Node.js
> [TypeScript support](https://nodejs.org/api/typescript.html) page and the
> [FastAPI](https://fastapi.tiangolo.com/) documentation.
> Targets: **Python 3.14.7** · **Node.js 24 LTS / 26**.

**Once you accept that both languages erase their types, the comparison stops being about
the languages and becomes about three practical things: whose type system can express
more, whose ecosystem is more uniformly typed, and what happens at the boundary where
real data arrives. TypeScript wins the first two. Python wins the third decisively, and
for one structural reason — its annotations survive into runtime as objects, so Pydantic
and FastAPI can read the same declaration you type-check and turn it into a validator, a
serialiser and an OpenAPI schema. That single fact is why the Python backend does not
maintain two descriptions of every payload, and the TypeScript one does.**

This is the second half of [chunk 4](04-typing.md), which established that neither runtime
enforces anything.

## Where TypeScript is genuinely ahead

Concede these in an interview; hedging on them reads as not having used TypeScript.

1. **Expressiveness.** Conditional types, mapped types, template literal types and
   inference from them have no Python equivalent. Python's type system is powerful —
   generics, protocols, `TypedDict`, `Literal`, `ParamSpec`, and 3.12's `type` statement —
   but it cannot express "the keys of this object with `on` prefixed and capitalised".
2. **Ecosystem coverage.** DefinitelyTyped plus the near-universal practice of shipping
   `.d.ts` files means almost every npm package is typed. Python's coverage is good and
   improving — `py.typed` markers under PEP 561, `typeshed` for the standard library — but
   a meaningful tail of packages still resolves to `Any`, and `Any` silently disables
   checking wherever it spreads.
3. **One canonical checker.** `tsc` defines the language. Python has `mypy` (the reference
   implementation) and `pyright` (Microsoft's, and what Pylance runs), plus `ty` and
   `pyrefly` as newer entrants — and they legitimately disagree on edge cases. A team must
   pick one and run *that* one in CI, or developers see errors in their editor that CI
   does not reproduce, and vice versa.

## Where Python is genuinely ahead

1. **Runtime validation as a first-class citizen.** Pydantic reads your annotations and
   validates actual data at the boundary. FastAPI reads the same annotations to generate
   request parsing, response serialisation *and* the OpenAPI schema. One declaration does
   four jobs:

   ```python
   class CreateUser(BaseModel):
       name: str
       age: int = Field(ge=0, le=150)
       email: EmailStr

   @app.post("/users")
   async def create(user: CreateUser) -> UserOut: ...
   # parsed, validated, documented, and type-checked — from one class
   ```

   Node's equivalent is `zod` or `valibot`, which are excellent, but they run in the
   opposite direction: you write the schema and *derive* the type from it
   (`z.infer<typeof schema>`), because the type itself is not available at runtime. That
   is a real ergonomic difference, and it is why the schema-and-type duplication Python
   avoids is a standing tax in TypeScript codebases.

2. **Gradual typing that was designed to be gradual.** Python's annotations were optional
   from the day they landed and the ecosystem never assumed otherwise. TypeScript's
   gradual path exists, but a codebase with `strict: false` and scattered `any` is widely
   treated as a failure state, whereas a Python codebase typed at its boundaries and
   untyped in its internals is a normal, defensible position.

3. **Decorators that read types.** Because annotations are objects, a Python framework can
   build behaviour from them — dependency injection in FastAPI, column types in
   SQLAlchemy 2.x's `Mapped[int]`, CLI argument parsing in Typer. TypeScript decorators
   cannot see a type, only a name, which is why every TypeScript equivalent needs the type
   restated as a runtime value.

## The setup you would actually recommend

```toml
# pyproject.toml — Python
[tool.mypy]
python_version = "3.14"
strict = true
warn_unreachable = true

[[tool.mypy.overrides]]
module = ["untyped_vendor_sdk.*"]
ignore_missing_imports = true     # narrow, named, and reviewable
```

```json
// tsconfig.json — Node
{
  "compilerOptions": {
    "strict": true,
    "noEmit": true,
    "target": "esnext",
    "module": "nodenext",
    "erasableSyntaxOnly": true,
    "verbatimModuleSyntax": true,
    "rewriteRelativeImportExtensions": true
  }
}
```

In both cases the checker runs in CI, not at runtime, and `strict` is on from the first
commit — retrofitting strictness onto a large untyped codebase is the expensive path in
either language.

## The cost of choosing both

A TypeScript frontend against a Python backend is an extremely common and perfectly good
architecture, and its one real cost is that the type cannot cross the wire. The fix is to
generate it rather than hand-write it twice:

```bash
# 1. FastAPI serves the schema its Pydantic models already describe.
curl localhost:8000/openapi.json > openapi.json

# 2. A generator turns it into TypeScript client types, in CI.
npx openapi-typescript openapi.json -o src/api/schema.d.ts
```

Run step 2 in CI and fail the build when the checked-in output changes without the
generator having been run — that is what keeps the two sides honest. A team that skips
this and hand-maintains an `interface User` on the frontend has re-introduced exactly the
duplication that Pydantic removed on the backend.

## Gotchas

### `ignore_missing_imports = true` set globally
**Symptom.** `mypy` reports zero errors on code that is clearly wrong.
**Cause.** A global ignore turns every unresolvable import into `Any`, and `Any` spreads
through every expression it touches, silently disabling checking across whole modules.
**Fix.** Scope the ignore to named modules, as in the config above, and prefer installing
the `types-*` stub package where one exists:

```bash
uv add --dev types-requests types-python-dateutil
```

`--strict`'s `disallow_any_explicit` and `warn_return_any` are what surface the spread
once it has started.

### Two checkers, two answers
**Symptom.** VS Code shows a red squiggle that CI does not report, or the reverse.
**Cause.** Pylance runs `pyright`; your CI runs `mypy`. They differ on inference in real,
documented ways.
**Fix.** Pick one as the source of truth, run it in CI and pin its version, and configure
the editor to match — either set Pylance to basic mode and run `mypy` on save, or move CI
to `pyright`. What you cannot do is run both in strict mode and expect agreement.

### Typing a dict when you mean a model
**Symptom.** `dict[str, Any]` threaded through twelve functions, with `.get("user_id")`
returning `None` in production.
**Cause.** Reaching for the loosest type that compiles.
**Fix.** `TypedDict` when the shape is genuinely a dict on the wire; a dataclass or a
Pydantic model when it is a domain object. The Node equivalent mistake is
`Record<string, unknown>` everywhere instead of an interface.

```python
class UserRow(TypedDict):        # a wire shape
    user_id: int
    email: str

@dataclass(frozen=True)          # a domain object
class User:
    id: int
    email: str
```

### A Pydantic model used as the ORM model, the API model and the domain model
**Symptom.** A field you added for the database appears in a public API response; or a
validator that belongs to input runs on data loaded from your own table.
**Cause.** One class doing three jobs because it validated nicely once.
**Fix.** Separate models per boundary — `CreateUser` in, `UserOut` out, an ORM row in
between. Duplication between them is the point, not a smell; they change for different
reasons.

### An untyped package that has no stubs and never will
**Symptom.** You cannot get a vendor SDK to type-check and the ignore list keeps growing.
**Cause.** No `py.typed` marker, no `types-` package on PyPI.
**Fix.** Write a minimal local stub for the handful of symbols you actually use, and point
the checker at it. It is far less work than it sounds, and it types the surface you touch
rather than the whole library:

```python
# stubs/vendor_sdk/__init__.pyi
class Client:
    def __init__(self, api_key: str) -> None: ...
    def charge(self, cents: int, *, idempotency_key: str) -> str: ...
```
```toml
[tool.mypy]
mypy_path = "stubs"
```

### Trusting `.d.ts` files as much as the code
**Symptom.** TypeScript is satisfied and the value at runtime is `undefined`.
**Cause.** A hand-written `.d.ts` in DefinitelyTyped can drift from the JavaScript it
describes, and nothing checks the pair. This is TypeScript's version of Python's stale
stub problem, and it is worth knowing so the comparison stays honest.
**Fix.** Validate data crossing any boundary regardless of what the types claim — the same
rule as Python, for the same reason.

## Interview questions

**Q. `mypy` or `pyright`?**
A. Either, but only one. `mypy` is the reference implementation and has the widest plugin
support; `pyright` is faster, has stronger inference, and is what VS Code's Pylance
already runs, so choosing it removes the editor/CI mismatch. The failure mode is running
`pyright` in the editor and `mypy` in CI and treating their disagreements as bugs.

**Q. Pydantic and zod solve the same problem — how do they differ?**
A. Direction. Pydantic reads the type annotations you already wrote and builds a validator
from them, so the type is the source of truth. Zod makes you write a schema object and
infers the TypeScript type from it, because the type has no runtime existence. Zod's
approach is more flexible for complex refinement; Pydantic's avoids maintaining two
descriptions of the same shape.

**Q. Where does gradual typing actually bite you?**
A. `Any`. One untyped import or one `ignore_missing_imports` turns a value into `Any`, and
`Any` propagates through everything it touches without complaint, so a module can be
nominally checked and effectively unchecked. TypeScript's `any` behaves identically. The
defence is `strict` mode plus a narrow, named list of ignored modules rather than a global
switch.

**Q. Would you use TypeScript on the frontend and Python on the backend? What is the cost?**
A. Yes, routinely, and the cost is the API contract: you lose the ability to share a type
across the boundary. The fix is to generate it — FastAPI emits an OpenAPI schema from the
Pydantic models, and `openapi-typescript` turns that into client types in CI, with the
build failing if the checked-in output is stale. That is a build step the single-language
teams do not need, and it is the honest price of the split.

**Q. What is `py.typed` and why does it matter?**
A. A marker file, specified by PEP 561, that tells type checkers a package's inline
annotations are intended to be used. Without it, checkers treat the package as untyped and
everything it returns becomes `Any`, even if the source is fully annotated. It is a
one-line addition that library authors forget, and it is the first thing to check when a
well-typed dependency is silently giving you nothing.

**Q. Is TypeScript's type system strictly better than Python's?**
A. More expressive, yes — conditional and mapped types have no Python analogue. Strictly
better, no, because expressiveness is not the only axis. Python's annotations exist at
runtime, which buys validation, serialisation, schema generation and dependency injection
from the same declaration. A TypeScript codebase gets the stronger compile-time story and
pays for the runtime story separately, in zod schemas that duplicate the types.

**Q. How do you type a third-party library that ships no types?**
A. Install the `types-*` stub package if one exists on PyPI. If not, write a local `.pyi`
stub covering only the symbols you use and add its directory to `mypy_path`. Use a
targeted, named `ignore_missing_imports` override as a last resort — never the global one,
because that turns the whole dependency into `Any` and takes your own code's checking with
it.

---

← Prev: [The typing story](04-typing.md) · Index: [Python vs Node](README.md) · Next → [Ecosystem shapes](05-ecosystems.md)

{/* FOOTER */}
