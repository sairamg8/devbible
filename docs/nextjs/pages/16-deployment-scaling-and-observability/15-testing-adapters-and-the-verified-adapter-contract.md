---
sidebar_position: 15
title: "\"Supported\" stopped being a marketing claim: the adapter compatibility suite is a pass/fail contract, and three shell scripts are the entire integration surface"
sidebar_label: "Testing adapters, verified status"
description: "The Next.js adapter compatibility test harness — the deploy, logs and cleanup script contracts, the environment variables that drive them, and what open-source plus a passing suite buys a platform."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against [Adapters · Testing Adapters](https://nextjs.org/docs/app/api-reference/adapters/testing-adapters), [Deploying to Platforms](https://nextjs.org/docs/app/guides/deploying-to-platforms), [Deploying](https://nextjs.org/docs/app/getting-started/deploying), and [Next.js Across Platforms](https://nextjs.org/blog/nextjs-across-platforms) (25 March 2026).
> Target: **Next.js 16.3.4**. Adapter API stable since 16.2. Prior page: [14 · Invoking entrypoints, and PPR resume](14-invoking-entrypoints-runtime-integration-and-ppr-resume.md).

**Every framework ecosystem eventually runs into the same argument: a platform says it supports the framework, a user hits a broken feature, and neither side can point at a definition. Next.js resolved that by making its own end-to-end suite runnable against any adapter, and by defining "verified" as two facts that can be checked rather than asserted — open source, and runs the suite. The integration surface for a platform is three executable scripts and three lines of output. That is deliberately small: the test harness has to be cheap enough that a platform runs it nightly, not once before a launch post.**

## What "supported" means now

> *"**Functional fidelity** means every Next.js feature works correctly. The adapter test suite is the contract: if a platform's adapter passes the tests, it supports Next.js. This is binary: it passes or it doesn't."*

> *"**Performance fidelity** means features achieve their optimal performance characteristics. Examples include PPR's static shell served at CDN latency rather than origin latency, or ISR serving stale content instantly with sub-second revalidation propagation. Performance fidelity is a spectrum that every platform will achieve differently based on their architecture."*

And the conclusion that follows:

> *"A platform that achieves functional fidelity is a fully supported deployment target for Next.js. Performance fidelity is how platforms differentiate, and it improves incrementally over time."*

The March 2026 post describes what the suite covers:

> *"It covers streaming behavior, caching interactions, client navigation, and real-world edge cases. When a new feature ships, its behavior is encoded in these tests."*

> *"Adapter authors can run the suite using any adapter and get a pass/fail answer for each feature. This is the same test suite Vercel uses for its own adapter, so the correctness bar is shared across all providers."*

## The harness contract

The suite is the Next.js repository's own e2e tests, run in `deploy` mode against a real deployment produced by your adapter. Next.js creates an isolated temporary application per test, and then calls out to your scripts.

> *"The test harness looks for these environment variables: `NEXT_TEST_DEPLOY_SCRIPT_PATH`: Path to the executable that builds and deploys the isolated test app · `NEXT_TEST_DEPLOY_LOGS_SCRIPT_PATH`: Path to the executable that returns build and runtime logs for that deployment · `NEXT_TEST_CLEANUP_SCRIPT_PATH`: Path to the optional executable that tears the deployment down after the test run"*

All three run with `cwd` set to the isolated temporary app. The logs and cleanup scripts additionally receive `NEXT_TEST_DIR` and `NEXT_TEST_DEPLOY_URL`.

### The deploy script contract

> *"Exit with a non-zero code on failure. · Print the deployment URL to `stdout`. This will be used to verify the deployment. Avoid writing anything else to `stdout`. · Write diagnostic output to `stderr` or to files inside the working directory."*

That middle bullet is the whole protocol: **stdout is a single URL channel**. Anything else on stdout — a build banner, a progress spinner, an npm notice — is parsed as part of the deployment URL.

> *"Because the deploy script and logs script run as separate processes, any data you want to use later, such as build IDs or server logs, should be persisted to files inside the working directory."*

```bash filename="scripts/e2e-deploy.sh"
#!/usr/bin/env bash
set -euo pipefail

# Install the adapter, build the app, and deploy or start it.
node -e "
const pkg=JSON.parse(require('fs').readFileSync('package.json','utf8'));
pkg.dependencies=pkg.dependencies||{};
pkg.dependencies['adapter']='file:${ADAPTER_DIR}';
require('fs').writeFileSync('package.json',JSON.stringify(pkg,null,2));
" >&2

# Set the adapter path so that the app uses it.
export NEXT_ADAPTER_PATH="${ADAPTER_DIR}/dist/index.js"

# Build the app
pnpm build

# Write any metadata needed later to files in the working directory.
BUILD_ID="$(cat .next/BUILD_ID)"
DEPLOYMENT_ID="my-adapter-local"
# If your adapter enables immutable static assets, set this to "1".
NEXT_SUPPORTS_IMMUTABLE_ASSETS="0"

{
  echo "BUILD_ID: $BUILD_ID"
  echo "DEPLOYMENT_ID: $DEPLOYMENT_ID"
  echo "NEXT_SUPPORTS_IMMUTABLE_ASSETS: $NEXT_SUPPORTS_IMMUTABLE_ASSETS"
} >> .adapter-build.log

# Start or deploy the app. Capture the URL at this point or make the script output the URL to stdout.
provider-cli-to-deploy

# Example URL output:
# echo "http://127.0.0.1:3000"
```

Note the `>&2` on the Node one-liner. Every diagnostic in this script is deliberately pushed to stderr so stdout stays clean.

### The logs script contract

> *"Its output must include lines starting with: `BUILD_ID:` · `DEPLOYMENT_ID:` · `NEXT_SUPPORTS_IMMUTABLE_ASSETS:`"*

> *"After those markers, the logs script can print any additional build or server logs that would help debug failures."*

```bash filename="scripts/e2e-logs.sh"
#!/usr/bin/env bash
set -euo pipefail

if [ -f ".adapter-build.log" ]; then
  cat ".adapter-build.log"
fi

if [ -f ".adapter-server.log" ]; then
  echo "=== .adapter-server.log ==="
  cat ".adapter-server.log"
fi
```

> *"One pattern is to have the deploy script write `.adapter-build.log` and `.adapter-server.log`, then have the logs script replay those files so the harness can extract the required markers. This is one option, each platform has different ways to get the logs."*

Those three markers are not decoration. `BUILD_ID` and `DEPLOYMENT_ID` let tests assert skew-protection behaviour; `NEXT_SUPPORTS_IMMUTABLE_ASSETS` tells the harness whether to expect `/_next/static/immutable/*` URLs without `?dpl`. Reporting `1` when your adapter does not actually serve immutable assets will fail asset tests in a way that looks like a caching bug.

### The cleanup script contract

> *"The cleanup script can be used to clean up any resources created by the deploy script. It runs after the tests have completed."*

Optional, and the only one of the three that is. On a suite sharded sixteen ways, forgetting it means sixteen concurrent streams of orphaned deployments.

## Running it in CI

The documented workflow builds Next.js from source alongside your adapter, then shards the e2e run:

```yaml filename=".github/workflows/test-e2e-deploy.yml"
      - uses: actions/checkout@v4
        with:
          repository: vercel/next.js
          ref: ${{ inputs.nextjsRef || 'canary' }}
          path: nextjs
          fetch-depth: 25
```

```yaml
    strategy:
      fail-fast: false
      matrix:
        group: [1/16, 2/16, 3/16, /* … */ 16/16]
```

```yaml
        env:
          NEXT_TEST_MODE: deploy
          NEXT_E2E_TEST_TIMEOUT: 240000
          NEXT_EXTERNAL_TESTS_FILTERS: test/deploy-tests-manifest.json
          ADAPTER_DIR: ${{ github.workspace }}/adapter
          IS_TURBOPACK_TEST: 1
          NEXT_TEST_JOB: 1
          NEXT_TELEMETRY_DISABLED: 1
        run: node run-tests.js --timings -g ${{ matrix.group }} -c 2 --type e2e
```

Three of those variables carry meaning worth naming. `NEXT_TEST_MODE: deploy` is what switches the harness from spawning a local server to calling your scripts. `NEXT_EXTERNAL_TESTS_FILTERS` points at the manifest of which tests are expected to run in deploy mode. `IS_TURBOPACK_TEST: 1` reflects that Turbopack is the default bundler in 16.x — an adapter tested only against a Webpack build is testing a configuration most users will not have.

The workflow checks out `canary` by default and `fetch-depth: 25`. Testing against `canary` rather than a release tag is the point: the whole reason for the working group is that platforms see changes before users do.

## What "verified" buys, and what it does not

> *"A **verified adapter** is one that meets two requirements: 1. **Open source.** The adapter source code is publicly available so the community and the Next.js team can inspect, contribute to, and verify it. 2. **Runs the compatibility test suite.** The platform provides a way to run the full Next.js compatibility test suite against their adapter. This gives visibility into which features work, which are in progress, and where gaps remain."*

Verified adapters *"are hosted under the Next.js GitHub organization, listed as supported deployment targets in the Next.js documentation, and maintained by their respective platform teams."*

The commitments the Next.js team makes in return:

> *"**Coordinated testing.** Before major releases, we work with platform teams to run the compatibility test suite and surface issues early. · **Early access.** Adapter authors receive early access to API changes during RFCs and release candidates. · **Direct support.** When the adapter contract needs updating, we work directly with adapter teams."*

And the deliberate carve-out for closed-source platforms:

> *"Platforms can build closed-source adapters on the same public API and test suite. However, closed-source adapters will not be listed as verified, since the Next.js team cannot verify what it cannot inspect."*

As of the versions checked on 2026-09-03, the Deploying page lists **Vercel** and **Bun** as verified adapters, notes that *"Cloudflare and Netlify are working on verified adapters built on the Adapter API"*, and says of results: *"Publicly visible test results for each adapter are coming soon."* Everything else on that page — Appwrite Sites, AWS Amplify Hosting, Cloudflare, Deno Deploy, Firebase App Hosting, Netlify — is listed under "Other Platforms" with the caveat that those integrations *"are not built on the public Adapter API and are not verified by the Next.js team, so feature support and compatibility may vary."*

## Gotchas

**★ Printing anything except the deployment URL to stdout.**
The harness reads stdout as the URL. An `npm notice`, a CLI progress bar, or a stray `echo "deploying..."` is concatenated into it and every test fails with what looks like a total outage. Route every diagnostic to stderr — the documented script does this even for its own inline Node call, with `>&2`.

**★ Expecting state to survive between the deploy script and the logs script.**
They are separate processes. Shell variables, exported environment, in-memory handles: none of it carries. The docs are explicit that *"any data you want to use later, such as build IDs or server logs, should be persisted to files inside the working directory."* Write `.adapter-build.log` in deploy, read it in logs.

**★ Reporting `NEXT_SUPPORTS_IMMUTABLE_ASSETS: 1` aspirationally.**
The marker tells the harness which asset URLs to expect — `/_next/static/immutable/*` without `?dpl` versus deployment-scoped assets with it. Claiming support you have not implemented makes asset tests fail in a way that reads like a CDN configuration problem rather than a mis-declared capability.

**★ Omitting the cleanup script on a sharded run.**
Cleanup is the one optional script, which makes it the one people skip. With a 16-way shard matrix each running dozens of isolated apps, every skipped teardown multiplies. Even a local-server adapter should kill its process; a cloud adapter should delete the deployment.

**★ Testing only against a release tag.**
The documented workflow defaults to `ref: 'canary'`. Testing against the version your users already run tells you nothing you did not know; testing against canary is how a platform finds out about a contract change while there is still time to file a bug against it. That is precisely the "early access" commitment the ecosystem working group exists to deliver.

**★ Running the suite with Webpack when Turbopack is the default.**
`IS_TURBOPACK_TEST: 1` is in the documented environment. Turbopack is the default bundler in Next.js 16, so an adapter validated only against a Webpack build has validated a configuration most of its users do not have — including different chunk naming, which is exactly the surface `assets`, `assetsHashes` and immutable asset hashing touch.

**★ Reading "verified" as "everything works".**
Verification is open source *plus* running the suite. The docs describe the suite's value as visibility — *"which features work, which are in progress, and where gaps remain"* — and note that public per-adapter results are still coming. Read the platform's own results before assuming a feature is covered.

**★ Assuming a closed-source adapter is a second-class citizen technically.**
It is not; it is a second-class citizen *reputationally*. The same public API and the same test suite are available. The only thing withheld is the verified listing, and the stated reason is inspectability, not capability.

## Interview questions

**★ How does Next.js define whether a platform "supports" the framework?**
By the adapter compatibility test suite, which is binary: *"if a platform's adapter passes the tests, it supports Next.js. This is binary: it passes or it doesn't."* That is functional fidelity. Performance fidelity — shell served at CDN latency, sub-second revalidation propagation — is a separate spectrum on which platforms differentiate, and it does not affect whether the platform is a supported target.

**★ What is the entire integration surface a platform must implement to run the suite?**
Three executables, pointed at by `NEXT_TEST_DEPLOY_SCRIPT_PATH`, `NEXT_TEST_DEPLOY_LOGS_SCRIPT_PATH` and `NEXT_TEST_CLEANUP_SCRIPT_PATH`. Deploy builds and deploys the isolated test app and prints its URL to stdout; logs prints `BUILD_ID:`, `DEPLOYMENT_ID:` and `NEXT_SUPPORTS_IMMUTABLE_ASSETS:` followed by any diagnostics; cleanup (optional) tears the deployment down.

**★ Why must the deploy script keep stdout clean?**
Because stdout *is* the URL channel. The harness takes what the deploy script prints and uses it to verify the deployment. The docs say to *"avoid writing anything else to stdout"* and to send diagnostics to stderr or to files in the working directory.

**★ Why do the logs come from a separate script rather than the deploy script's output?**
Because they run as separate processes at different times — logs runs after the deployment exists and receives `NEXT_TEST_DEPLOY_URL`, so it can pull runtime logs from a live deployment. That separation is also why the docs insist on persisting anything you need later to files: nothing in the deploy process's memory or environment reaches the logs process.

**★ What are the three markers the logs script must emit, and what are they for?**
`BUILD_ID:`, `DEPLOYMENT_ID:` and `NEXT_SUPPORTS_IMMUTABLE_ASSETS:`. The first two let tests assert build identity and skew-protection behaviour; the third tells the harness whether to expect immutable asset URLs served without the `?dpl` query parameter, which changes what a correct asset response looks like.

**★ What are the two requirements for verified status, and what does the framework team commit to in return?**
Open source, and running the full compatibility test suite. In return: coordinated testing before major releases, early access to API changes during RFCs and release candidates, and direct support when the adapter contract needs updating. Verified adapters live under the Next.js GitHub organization and are listed in the docs, but remain owned by their platform teams — *"Publishing rights, release cadence, and implementation decisions are theirs."*

**★ Can a closed-source platform build an adapter?**
Yes, on the same public API with the same test suite. It simply will not be listed as verified, and the stated reason is that *"the Next.js team cannot verify what it cannot inspect."* Nothing technical is withheld.

**★ Why does the reference workflow default to testing against `canary`?**
Because the point of the suite for a platform is early warning. Testing the release your users already run confirms yesterday's state; testing canary surfaces contract changes while they can still be discussed — which is the mechanism behind the working group's early-access commitment and behind the promise that breaking changes come with lead time proportional to their scope.

{/* FOOTER */}
