---
title: "01.2 · Specifiers, loading and top-level await"
sidebar_label: "02 · Specifiers and loading"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [JavaScript modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules), [`await`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await). Documentation-validated.

**Everything in this chunk is about the string in the `from` clause, and about how the file
gets from a server into the engine.** These are the parts that fail at load time with errors
that do not look like JavaScript errors at all.

## The specifier

MDN:

> "The *module specifier* provides a string that the JavaScript environment can resolve to a
> path to the module file."

```js
import { draw } from "./modules/square.js";
```

The `./` is not decoration. **A bare name and a relative path are two different things**, and
the browser treats them differently:

| Specifier | Meaning |
|---|---|
| `"./modules/square.js"` | relative to the **current module's URL** |
| `"../shared/util.js"` | one level up from it |
| `"/js/square.js"` | absolute from the **site root** |
| `"https://example.com/x.js"` | a full URL |
| `"square"` | a **bare name** — needs an import map on the web |

🔴 **The file extension is required in the browser.** `import … from "./square"` does not
resolve; the specifier is turned into a URL, and a URL has no notion of "try adding `.js`".
Node and bundlers have resolution algorithms that *do* guess, which is why code that works
under a bundler can break when served directly.

## Bare names and import maps

MDN:

> "In some JavaScript environments, such as Node.js, you can use bare names for the module
> specifier… **To use bare names on a browser you need an import map**, which provides the
> information needed by the browser to resolve module specifiers to URLs."

```html
<script type="importmap">
  {
    "imports": {
      "square": "./shapes/square.js"
    }
  }
</script>
```

```js
import { name as squareName, draw } from "square";
```

> "Import maps allow developers to instead specify almost any text they want in the module
> specifier when importing a module; the map provides a corresponding value that will replace
> the text when the module URL is resolved."

This is what lets a browser run the same `import "lodash-es"` a bundler would resolve from
`node_modules`, without a build step.

## Getting the module into the page

MDN:

> "First of all, you need to include `type="module"` in the `<script>` element, to declare
> this script as a module."

```html
<script type="module" src="main.js"></script>
```

> "You can only use `import` and `export` statements inside modules, not regular scripts. An
> error will be thrown if your `<script>` element doesn't have the `type="module"` attribute
> and attempts to import other modules."

Only the **entry point** needs the tag. Everything it imports is fetched by the engine as
part of the graph; those files are never referenced from HTML.

### Two loading failures that are not code failures

**CORS on `file://`:**

> "if you try to load the HTML file locally (i.e., with a `file://` URL), you'll run into
> CORS errors due to JavaScript module security requirements. **You need to do your testing
> through a server.**"

A plain `<script>` works from the filesystem; a module script does not. Opening the HTML by
double-clicking it is the single most common first encounter with modules, and the error
mentions CORS rather than modules.

**MIME type, especially for `.mjs`:**

> "you need to make sure that your server is serving them with a `Content-Type` header that
> contains a JavaScript MIME type such as `text/javascript`. If you don't, you'll get a
> strict MIME type checking error along the lines of *'The server responded with a
> non-JavaScript MIME type'*… **Most servers already set the correct type for `.js` files,
> but not yet for `.mjs` files.**"

### `.mjs` or `.js`

MDN gives the case for `.mjs`:

> - "It is good for clarity, i.e., it makes it clear which files are modules, and which are
>   regular JavaScript."
> - "It ensures that your module files are parsed as a module by runtimes such as Node.js,
>   and build tools such as Babel."

…and then the practical cost above: servers frequently do not send the right MIME type for
it. **The trade is clarity against deployment friction.** In Node the alternative is
`"type": "module"` in `package.json`, which makes `.js` mean ESM for that package and leaves
`.cjs` for CommonJS.

## Top-level `await`

MDN:

> "Top level await is a feature available within modules… It allows modules to act as **big
> asynchronous functions** meaning code can be evaluated before use in parent modules, but
> **without blocking sibling modules from loading**."

```js
// getColors.js
const colors = fetch("../data/colors.json").then((response) => response.json());

export default await colors;
```

> "the code within `main.js` won't execute until the code in `getColors.js` has run. However
> it won't block other modules being loaded."

Both halves matter, and they are the whole feature:

- **Importers wait.** A module that awaits at the top level delays every module that imports
  it, transitively. That is what makes `export default await colors` safe to consume — by the
  time anyone imports it, it is a value, not a promise.
- **Siblings do not wait.** Modules elsewhere in the graph keep loading in parallel.

🔴 **The cost is that an importer cannot opt out.** There is no way for a consumer to say "I
will take this module now and wait for its data later" — the wait is imposed by the
dependency. So top-level `await` is right for genuine initialisation that everything
downstream requires, and wrong for anything slow, optional, or only needed by one code path.
For those, export a function that returns the promise.

It is also **modules only**. From [Phase 7 · 07 · 02](../../phase-7-async/07-async-await/02-where-it-suspends.md):
`await` is allowed inside an `async` function or at the top level of a module, and CommonJS
cannot use it because `require` is synchronous.

## Gotchas

**Symptom:** CORS errors when opening the page from the filesystem
**Cause:** Module scripts have stricter security requirements than classic scripts. MDN:
*"You need to do your testing through a server."*
**Fix:** Serve over HTTP, even locally.

**Symptom:** *"The server responded with a non-JavaScript MIME type"*
**Cause:** The server is not sending `text/javascript` — MDN notes most servers still do not
for **`.mjs`**.
**Fix:** Configure the MIME type, or use `.js` with `"type": "module"`.

**Symptom:** `import … from "./square"` fails in the browser but works under a bundler
**Cause:** The browser resolves the specifier as a **URL** — there is no extension guessing.
Bundlers and Node have resolution algorithms that guess.
**Fix:** Always write the extension.

**Symptom:** `import "lodash"` fails in the browser with a bare-specifier error
**Cause:** Bare names need an **import map** on the web.
**Fix:** Add one, or use a build step.

**Symptom:** `SyntaxError: Cannot use import statement outside a module`
**Cause:** The `<script>` lacks `type="module"`, or in Node the file is being treated as
CommonJS.
**Fix:** Add the attribute; in Node set `"type": "module"` or use `.mjs`.

**Symptom:** A page got slower after an unrelated dependency was updated
**Cause:** That dependency added **top-level `await`**, and every importer now waits for it.
**Fix:** Reserve top-level `await` for initialisation everything needs; export a function for
anything optional.

**Symptom:** Only the entry script is in the HTML and you expect to add the others
**Cause:** Not needed — the engine fetches the whole graph from the imports.
**Fix:** Expected.

## Interview questions

**★ Why does `import { x } from "./util"` fail in a browser but work with a bundler?**
The browser resolves the specifier to a **URL**, and URLs have no extension guessing. Node and
bundlers apply a resolution algorithm that tries extensions and directory indexes. Always
write the extension for code that will be served directly.

**★ What is an import map for?**
Resolving **bare specifiers** in the browser. MDN: to use bare names *"on a browser you need
an import map, which provides the information needed by the browser to resolve module
specifiers to URLs"* — so `import "square"` can work without a build step.

**★ Why can't you open a page using modules with `file://`?**
Module scripts are subject to CORS; MDN says you *"need to do your testing through a
server."* A classic `<script>` has no such restriction, which is why the problem appears only
after switching to modules.

**★ `.mjs` or `.js`?**
`.mjs` makes module-ness explicit and guarantees runtimes parse it as a module — but MDN
warns that most servers do not yet send the right MIME type for it, which breaks it in the
browser. In Node, `"type": "module"` gives the same guarantee for `.js`.

**★ What does top-level `await` do to the module graph?**
Importers wait for it — transitively — while **siblings keep loading**. MDN: modules act as
*"big asynchronous functions… without blocking sibling modules from loading."* The cost is
that an importer cannot opt out of the wait, so it belongs to genuine initialisation only.

**Do you need a `<script>` tag for every module?**
No — only the entry point. The engine fetches the rest of the graph from the `import`
declarations.

---

← Prev [01 · import and export](./01-import-and-export.md) · [Topic index](./README.md) · Next → [Phase index](../README.md)
