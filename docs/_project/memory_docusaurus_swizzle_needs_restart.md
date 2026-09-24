---
name: devbible-docusaurus-swizzle-needs-restart
description: A NEWLY CREATED file under src/theme/ is invisible to a running Docusaurus dev server — the @theme alias map is built once at boot. Editing a swizzle hot-reloads; creating one does not. Cost 20 minutes on 2026-09-06 after the ui-redesign merge.
metadata:
  type: reference
---

# 🔴 A new `src/theme/` swizzle needs a dev server RESTART, not a save

**Symptom, verbatim, from the running site on 2026-09-06:**

```
A theme navbar item failed to render.
Please double-check the following navbar item (themeConfig.navbar.items):
{ "type": "custom-techPicker", "position": "left" }
Cause: No NavbarItem component found for type "custom-techPicker".
```

**The code was correct.** `src/theme/NavbarItem/ComponentTypes.js` spread
`@theme-original/…` and added the key; `TechPicker` default-exported cleanly; the config
string matched the registered key exactly. Nothing needed changing — the restart alone
fixed it.

## The mechanism

Docusaurus resolves `@theme/*` through an **alias map built by scanning `src/theme/**`
once, at server start**. Webpack/Rspack aliases are not re-derived on a file event, so a
swizzle file that appears *after* boot is never in the map. `@theme/NavbarItem/ComponentTypes`
therefore kept resolving to theme-classic's original — which has no `custom-` key — and the
lookup returned `undefined`.

🔴 **The asymmetry is the whole trap: `docusaurus.config.js` DOES hot-reload.** So the
navbar item appeared, on the strength of a config the server had re-read, pointing at a
component map the server had not. New config, old component map. Every visible signal said
"the registration is broken" when the registration was fine.

## How it happened, and the general shape

The dev server started at **05:32:22**. A `git merge --ff-only` wrote the swizzle at
**05:36:14** — four minutes later. **Any operation that writes files behind a running dev
server can cause this**: a merge, a rebase, a `git checkout`, a stash pop, a sibling session
committing into the shared checkout.

⚠️ **Do not debug the code first.** The diagnostic that settles it in one command is a
timestamp comparison, not a code read:

```bash
ps -eo pid,lstart,args | grep '[d]ocusaurus.*start'   # when did the server boot?
stat -c '%y %n' src/theme/**/*.js                     # when did the file appear?
```

**File newer than the process → restart, and stop reading the code.**

## Restarting

A plain restart is enough — the alias map is rebuilt at boot regardless of the Rspack
persistent cache. **Do not reach for `yarn clear` first**: with `faster: true` it discards
the Rspack cache and `.docusaurus`, and the next boot recompiles ~6,800 routes from cold.
The first compile after a plain restart already costs several minutes on this corpus.

Related: [[devbible-ui-redesign-workspace-rail]] · [[devbible-docusaurus-faster-and-build-memory]]
