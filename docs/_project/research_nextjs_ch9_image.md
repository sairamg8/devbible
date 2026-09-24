---
name: research-nextjs-ch9-image
metadata:
  type: reference
---

# Research bank — Next.js chapter 9 · `next/image`, format negotiation, design-system packaging

**Banked 2026-09-04. Do not re-derive.** Five primary-source fetches, all resolved.
Version spine: **Next.js 16.3.4 · React 19.2.8 · Node 20.9 floor**. No sandbox run;
`next` is **not installed** in the devbible checkout (`require('next/package.json')`
throws `MODULE_NOT_FOUND`), so no T1 probe of the package is possible. `react` probes
at 19.2.8.

## Sources fetched

| # | URL | Doc header says | Resolved? |
|---|---|---|---|
| 1 | https://nextjs.org/docs/app/api-reference/components/image | `version: 16.3.4`, `lastUpdated: 2026-08-25` | ✅ |
| 2 | https://nextjs.org/blog/august-2026-security-release | `publishedAt: August 25th 2026` | ✅ |
| 3 | https://nextjs.org/docs/app/api-reference/config/next-config-js/transpilePackages | `version: 16.3.4`, `lastUpdated: 2026-05-27` | ✅ |
| 4 | https://nextjs.org/docs/app/guides/static-exports | `version: 16.3.4`, `lastUpdated: 2026-08-25` | ✅ |
| 5 | https://react.dev/reference/rsc/use-client | — | ✅ |

---

## 🔴 The headline finding — `priority` is deprecated in Next.js 16

The chapter 9 syllabus line names `priority`. **The API reference says it is deprecated.**

> *"Starting with Next.js 16, the `priority` property has been deprecated in favor of the `preload` property in order to make the behavior clear."*

Version history row: `v16.0.0` — *"`qualities` default configuration changed to `[75]`, `preload` prop added, `priority` prop deprecated, `dangerouslyAllowLocalIP` config added, `maximumRedirects` config added."*

`preload` docs, verbatim:

> *"A boolean that indicates if the image should be preloaded."*
> *"`true`: Preloads the image by inserting a `<link>` in the `<head>`. `false`: Does not preload the image."*
> **When to use it:** *"The image is the Largest Contentful Paint (LCP) element. The image is above the fold, typically the hero image. You want to begin loading the image in the `<head>`, before its discovered later in the `<body>`."*
> **When not to use it:** *"When you have multiple images that could be considered the Largest Contentful Paint (LCP) element depending on the viewport. When the `loading` property is used. When the `fetchPriority` property is used."*
> 🔴 *"In most cases, you should use `loading="eager"` or `fetchPriority="high"` instead of `preload`."*

`loading`: default `lazy`. *"`lazy`: Defer loading the image until it reaches a calculated distance from the viewport. `eager`: Load the image immediately, regardless of its position in the page."*

Theme-detection example note: *"The default behavior of `loading="lazy"` ensures that only the correct image is loaded. You cannot use `preload` or `loading="eager"` because that would cause both images to load. Instead, you can use `fetchPriority="high"`."*

---

## Sizing contract

> *"The `width` and `height` properties represent the intrinsic image size in pixels. This property is used to infer the correct **aspect ratio** used by browsers to reserve space for the image and avoid layout shift during loading. It does not determine the *rendered size* of the image, which is controlled by CSS."*

> *"You **must** set both `width` and `height` properties unless: The image is statically imported. The image has the `fill` property."*
> *"If the height and width are unknown, we recommend using the `fill` property."*

`fill`: *"A boolean that causes the image to expand to the size of the parent element."*
*"The parent element **must** assign `position: "relative"`, `"fixed"`, `"absolute"`."*
*"By default, the `<img>` element uses `position: "absolute"`."*
*"If no styles are applied to the image, the image will stretch to fit the container."*

Remote-images example: *"Since Next.js does not have access to remote files during the build process, you'll need to provide the `width`, `height` and optional `blurDataURL` props manually."*

Style note: *"If you're using the `style` prop to set a custom width, be sure to also set `height: 'auto'` to preserve the image's aspect ratio."*

---

## `sizes` and `srcset`

> *"Define the sizes of the image at different breakpoints. Used by the browser to choose the most appropriate size from the generated `srcset`."*
> *"`sizes` should be used when: The image is using the `fill` prop. CSS is used to make the image responsive."*
> 🔴 *"If `sizes` is missing, the browser assumes the image will be as wide as the viewport (`100vw`). This can cause unnecessarily large images to be downloaded."*
> *"In addition, `sizes` affects how `srcset` is generated: Without `sizes`: Next.js generates a limited `srcset` (e.g. 1x, 2x), suitable for fixed-size images. With `sizes`: Next.js generates a full `srcset` (e.g. 640w, 750w, etc.), optimized for responsive layouts."*

`deviceSizes` default: `[640, 750, 828, 1080, 1200, 1920, 2048, 3840]`.
`imageSizes` default: `[32, 48, 64, 96, 128, 256, 384]`.
> *"`imageSizes` is only used for images which provide a `sizes` prop, which indicates that the image is less than the full width of the screen. Therefore, the sizes in `imageSizes` should all be smaller than the smallest size in `deviceSizes`."*

**Doc-published generated HTML** (from the `overrideSrc` section — this is the docs' own output block, safe to quote as quoted):

```html
<img
  srcset="
    /_next/image?url=%2Fprofile.jpg&w=640&q=75 1x,
    /_next/image?url=%2Fprofile.jpg&w=828&q=75 2x
  "
  src="/_next/image?url=%2Fprofile.jpg&w=828&q=75"
/>
```

`overrideSrc` rationale: *"when upgrading an existing website from `<img>` to `<Image>`, you may wish to maintain the same `src` attribute for SEO purposes such as image ranking or avoiding recrawl."*

`path` default: `/_next/image`.

---

## `quality` and `qualities`

> *"An integer between `1` and `100` that sets the quality of the optimized image."* Default 75.
> *"If you've configured `qualities` in `next.config.js`, a value outside that list is coerced to the closest allowed entry. For example, with `qualities: [50, 75, 100]`, a `quality` of `80` is served as `75`. Development logs a warning so you can add the value to the allowlist."*
> 🔴 *"This field is required starting with Next.js 16 because unrestricted access could allow malicious actors to optimize more qualities than you intended."* (default `qualities: [75]`)
> *"If the REST API is visited directly with a quality that does not match a value in this array, the server will return a 400 Bad Request response."*

---

## Placeholders

`placeholder`: *"`empty`: No placeholder while the image is loading. `blur`: Use a blurred version of the image as a placeholder. Must be used with the `blurDataURL` property. `data:image/...`: Uses the Data URL as the placeholder."* Default `empty`.

`blurDataURL`:
> *"The image is automatically enlarged and blurred, so a very small image (10px or less) is recommended."*
> **Automatic:** *"If `src` is a static import of a `jpg`, `png`, `webp`, or `avif` file, `blurDataURL` is added automatically—unless the image is animated."*
> **Manually set:** *"If the image is dynamic or remote, you must provide `blurDataURL` yourself."* Suggested tools: png-pixel.com, Plaiceholder.
> *"A large blurDataURL may hurt performance. Keep it small and simple."*

`getImageProps`: *"can be used to get the props that would be passed to the underlying `<img>` element, and instead pass them to another component, style, canvas, etc."*
> *"This also avoid calling React `useState()` so it can lead to better performance, but it cannot be used with the `placeholder` prop because the placeholder will never be removed."*

Known browser bugs: *"When using the blur-up placeholder, older browsers before Safari 12 will fallback to empty placeholder."* Safari 15–16.3 grey border while lazy loading; Firefox 67+ white background while loading.

---

## `remotePatterns` / `localPatterns`

> *"Use `remotePatterns` in your `next.config.js` file to allow images from specific external paths and block all others. This ensures that only external images from your account can be served."*
> *"Any other protocol, hostname, port, or unmatched path will respond with `400` Bad Request."*

Wildcards:
> *"`*` match a single path segment or subdomain. `**` match any number of path segments at the end or subdomains at the beginning. This syntax does not work in the middle of the pattern."*
> 🔴 *"When omitting `protocol`, `port`, `pathname`, or `search` then the wildcard `**` is implied. This is not recommended because it may allow malicious actors to optimize urls you did not intend."*

`localPatterns`: *"allow images from specific local paths to be optimized and block all others."*
> *"Omitting the `search` property allows all search parameters which could allow malicious actors to optimize URLs you did not intend. Try using a specific value like `search: '?v=2'` to ensure an exact match."*

Redirects:
> 🔴 *"Note that any allowed `remotePatterns` that respond with a redirect will follow the redirect from the remote image server without validating `remotePatterns` again on the redirect location. You can reduce or disable redirects by configuring `maximumRedirects`."*
> *"The default image optimization loader will follow HTTP redirects when fetching remote images up to 3 times."* Set `0` to disable.
> *"For your convenience, these redirects do not need to satisfy `remotePatterns`."*

`domains` — *"Warning: Deprecated since Next.js 14 in favor of strict `remotePatterns` in order to protect your application from malicious users."* … *"the `domains` configuration does not support wildcard pattern matching and it cannot restrict protocol, port, or pathname. Since most remote image servers are shared between multiple tenants, it's safer to use `remotePatterns`."*

`dangerouslyAllowLocalIP` — default `false`. *"This is not recommended for most users because it could allow malicious users to access content on your internal network."* … *"Only enable once you understand the SSRF risk."*

`dangerouslyAllowSVG` — *"By default, Next.js does not optimize SVG images for a few reasons: SVG is a vector format meaning it can be resized losslessly. SVG has many of the same features as HTML/CSS, which can lead to vulnerabilities without proper Content Security Policy (CSP) headers."*
> *"We recommend using the `unoptimized` prop when the `src` prop is known to be SVG. This happens automatically when `src` ends with `".svg"`."*
> *"it is strongly recommended to also set `contentDispositionType` to force the browser to download the image, as well as `contentSecurityPolicy` to prevent scripts embedded in the image from executing."*

`contentSecurityPolicy`/`contentDispositionType`: *"By default, the loader sets the `Content-Disposition` header to `attachment` for added protection since the API can serve arbitrary remote images."*

`maximumResponseBody`: *"The default image optimization loader will fetch source images up to 50 MB in size."* Reduce *"to protect memory constrained servers"*.

Headers: *"For security reasons, the Image Optimization API using the default loader will *not* forward headers when fetching the `src` image. If the `src` image requires authentication, consider using the `unoptimized` property to disable Image Optimization."*

---

## `formats` — negotiation and the AVIF trade-off

Default: `formats: ['image/webp']`.
> *"Next.js automatically detects the browser's supported image formats via the request's `Accept` header in order to determine the best output format."*
> *"If the `Accept` header matches more than one of the configured formats, the first match in the array is used. Therefore, the array order matters. If there is no match (or the source image is animated), it will use the original image's format."*

Good-to-know block, verbatim (**these numbers are the docs', not measured here**):
> *"We still recommend using WebP for most use cases."*
> *"AVIF generally takes 50% longer to encode but it compresses 20% smaller compared to WebP. This means that the first time an image is requested, it will typically be slower, but subsequent requests that are cached will be faster."*
> *"When using multiple formats, Next.js will cache each format separately. This means increased storage requirements compared to using a single format, as both AVIF and WebP versions of images will be stored for different browser support."*
> 🔴 *"If you self-host with a Proxy/CDN in front of Next.js, you must configure the Proxy to forward the `Accept` header."*

### 🔴 Conflict between two primary sources — recorded, not resolved

The **August 2026 security release** says, verbatim:

> *"A vulnerability in the underlying libheif library used by `sharp` can lead to unauthenticated remote code execution when Next.js optimizes an attacker-controlled AVIF image. The patched releases disable AVIF optimization until an upstream fix is propagated."*
> Advisory pair: **GHSA-2xp9-vwfh-vxw4** / libheif **GHSA-g89c-p67h-r497**. Patched in **v16.3.3 (Active LTS)** and **v15.5.24 (Maintenance LTS)**.

The **API reference**, `lastUpdated: 2026-08-25` — the same day the release was published — **still documents `formats: ['image/avif']` as an enableable option with no mention of the disable.** The two pages are not reconcilable from documentation alone: the reference does not say whether `formats: ['image/avif']` is now a no-op, a build error, or silently falls through to the source format on a patched build. **Written on the page as explicitly unsettled.** Operationally: the default is `['image/webp']`, AVIF is opt-in, so a default configuration is not affected.

Second CVE in the same release (owned by ch10, summarised in ch17 — do not re-derive):
> *"A vulnerability in applications using both the Pages Router and App Router without Cache Components can lead to unauthenticated remote code execution when the Next.js server uses a Windows filesystem. Linux and macOS are not affected by this issue. There is no known workaround for affected Windows-hosted applications."* — **CVE-2026-75604** / GHSA-p293-qw3h-jr36.

---

## Caching

`minimumCacheTTL` default **14400** (4 hours).
> *"The expiration (or rather Max Age) of the optimized image is defined by either the `minimumCacheTTL` or the upstream image `Cache-Control` header, whichever is larger."*
> 🔴 *"There is no mechanism to invalidate the cache at this time, so its best to keep `minimumCacheTTL` low. Otherwise you may need to manually change the `src` prop or delete the cached file `<distDir>/cache/images`."*
> *"In many cases, it's better to use a Static Image Import which will automatically hash the file contents and cache the image forever with a `Cache-Control` header of `immutable`."*

`maximumDiskCacheSize`: *"If no value is configured, the default behavior is to check the current available disk space once during startup and use 50%."* … *"When the disk cache exceeds the configured size, the least recently used optimized images will be deleted until the cache is under the limit again."* Set `0` to disable. Overridden entirely by a custom `cacheHandler`.

`unoptimized`: *"useful for images that do not benefit from optimization such as small images (less than 1KB), vector images (SVG), or animated images (GIF)."*

---

## Static export

> *"Image Optimization through `next/image` can be used with a static export by defining a custom image loader in `next.config.js`."*

Unsupported-features list names, verbatim: *"Image Optimization with the default `loader`"* — 🔴 **not "images", and not "image optimization" unqualified.**

Doc's Cloudinary loader example:

```ts
export default function cloudinaryLoader({ src, width, quality }: {
  src: string; width: number; quality?: number
}) {
  const params = ['f_auto', 'c_limit', `w_${width}`, `q_${quality || 'auto'}`]
  return `https://res.cloudinary.com/demo/image/upload/${params.join(',')}${src}`
}
```

`loaderFile`: *"The path must be relative to the project root. The file must export a default function that returns a URL string."* Config is `{ loader: 'custom', loaderFile: './my/image/loader.js' }`.

---

## `transpilePackages` (for the design-system chunk)

> *"Use `transpilePackages` to compile and bundle a dependency instead of treating it as untouched runtime code. Values are package names, including scoped names like `@scope/pkg`. Paths and glob patterns are not supported."*
> *"This replaces the `next-transpile-modules` package."*
> 🔴 *"Turbopack transpiles workspace packages (npm, pnpm, or Yarn workspaces) in your monorepo automatically under both routers. Webpack does the same for the App Router."*

Add a package when:
> *"**A `node_modules` dependency ships raw TypeScript or JSX.** Next.js does not compile code inside `node_modules` by default. Listing the package opts it in, or you can build the package to plain JavaScript and point its `main`/`exports` at the compiled output."*
> *"**You build with webpack for the Pages Router and the dependency's source lives outside the next app's directory.**"*
> *"**You use the Pages Router and want a `node_modules` dependency bundled into the route.** … App Router already bundles Server Component and Route Handler dependencies unless the package is listed in `serverExternalPackages`."*

> *"A package cannot appear in both `transpilePackages` and `serverExternalPackages`; Next.js throws at build start if it does. Packages listed in `optimizePackageImports` and the entries in `default-transpiled-packages.json` are added automatically; you do not need to repeat them."*

Version history: `v13.0.0` — `transpilePackages` added.

---

## `'use client'` (React reference — for the design-system chunk)

> *"`'use client'` lets you mark what code runs on the client."*
> *"`'use client'` must be at the very beginning of a file, above any imports or other code (comments are OK). They must be written with single or double quotes, but not backticks."*

Third-party libraries:
> *"These libraries may rely on component Hooks or client APIs. Third-party components that use any of the following React APIs must run on the client: `createContext`, `react` and `react-dom` Hooks excluding `use` and `useId`, `forwardRef`, `memo`, `startTransition`; if they use client APIs, ex. DOM insertion or native platform views."*
> 🔴 *"If these libraries have been updated to be compatible with React Server Components, then they will already include `'use client'` markers of their own, allowing you to use them directly from your Server Components. If a library hasn't been updated, or if a component needs props like event handlers that can only be specified on the client, you may need to add your own Client Component file in between the third-party Client Component and your Server Component where you'd like to use it."*

Serializable props across the boundary — **supported:** primitives (string, number, bigint, boolean, undefined, null, `Symbol.for` symbols); iterables (String, Array, Map, Set, TypedArray, ArrayBuffer); Date; plain objects with serializable properties; Server Functions and Client/Server Component elements (JSX); Promises. **Not supported:** regular functions (unless exported from client-marked modules or marked `'use server'`), classes, class instances (except built-ins), symbols not registered globally.

---

## What this bank does NOT settle

- Whether `formats: ['image/avif']` on a patched 16.3.3+ build errors, warns, or silently falls back. Neither source says.
- Any compression ratio, encode time, byte count or Lighthouse score beyond the two numbers the docs themselves publish (50% encode / 20% size, AVIF vs WebP). **No measurement was performed.**
- The exact `<link>` attributes Next.js emits for `preload` (the docs say "inserting a `<link>` in the `<head>`" and no more).
- Whether `imageSizes` entries are used for `fill` images that also declare `sizes` (docs say `imageSizes` applies "for images which provide a `sizes` prop"; they do not carve out `fill`).
