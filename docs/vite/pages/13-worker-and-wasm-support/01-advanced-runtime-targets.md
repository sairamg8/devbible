---
title: "Worker & WASM Support: Native Web Worker Bundling & WebAssembly Imports"
sidebar_label: "Worker & WASM Support"
sidebar_position: 1
---

# ⚡ Worker & WASM Support: Native Web Worker Bundling & WebAssembly Imports

## 1. Under-The-Hood Mechanics

Vite treats Web Workers and WebAssembly modules as first-class import targets, with dedicated bundling behavior for each — rather than requiring manual `new Worker('path/to/file.js')` string-path wiring disconnected from the module graph.

```javascript
import MyWorker from './worker.js?worker';        // resolves to a Worker CONSTRUCTOR — new MyWorker() spins one up
import MySharedWorker from './shared.js?sharedworker'; // resolves to a SharedWorker constructor (shared across tabs)

import init from './module.wasm?init';                  // resolves to an INIT function returning the instantiated module
```

### `worker.format`: Controlling the Worker's Own Module Format
`worker: { format: 'es' }` (the modern default) bundles the worker's own code as native ESM, letting the worker script itself use `import`/`export` — `format: 'iife'` instead produces a self-contained, non-module script, needed for compatibility with older worker-hosting contexts that don't support module workers at all.

### WASM's `?init` Suffix: Explicit, Async Instantiation
Unlike a JS module (synchronously available once imported), a WebAssembly module requires an explicit, asynchronous **instantiation** step before its exports are usable — the `?init` suffix resolves to a function that, when called (and awaited), performs that instantiation and returns the module's actual exports, rather than pretending WASM has the same synchronous-import semantics plain JS modules do.

---

## 2. Real-World Engineering Scenario

**Scenario**: Offloading a CPU-Intensive Image Filter to a Worker, Bundled and Versioned Alongside the Rest of the App.
A photo-editing feature needed a computationally expensive filter to run without blocking the main thread's ability to keep the UI responsive (the same underlying motivation covered in the JS browser APIs doc's Web Worker section) — but rather than manually managing a separate, hand-bundled worker script file, Vite's `?worker` import suffix let the worker's source live as an ordinary module in the same source tree, get the same TypeScript/JSX transform pipeline as the rest of the app, and be automatically included (with its own correctly-hashed chunk) in the production build — no separate build step or manual file-path wiring required.

---

## 3. Production-Grade Code Example

```typescript
// image-filter.worker.ts — an ordinary TS module, just executed in a worker context
self.onmessage = (event: MessageEvent<{ imageData: ImageData }>) => {
  const filtered = applyExpensiveFilter(event.data.imageData); // CPU-heavy, off the main thread
  self.postMessage({ result: filtered });
};

function applyExpensiveFilter(data: ImageData): ImageData {
  // ... pixel-by-pixel processing ...
  return data;
}
```

```typescript
// PhotoEditor.tsx — importing the worker via Vite's ?worker suffix
import ImageFilterWorker from './image-filter.worker.ts?worker';

function usePhotoFilter() {
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new ImageFilterWorker(); // a REAL Worker instance, fully bundled/versioned with the app
    return () => workerRef.current?.terminate();
  }, []);

  function applyFilter(imageData: ImageData) {
    return new Promise((resolve) => {
      workerRef.current!.onmessage = (e) => resolve(e.data.result);
      workerRef.current!.postMessage({ imageData });
    });
  }

  return { applyFilter };
}
```

```typescript
// Loading and instantiating a WASM module
import init from './image-processor.wasm?init';

async function loadWasmProcessor() {
  const wasmModule = await init(); // async instantiation — NOT a synchronous import
  return wasmModule.exports.processImage; // the actual exported WASM function, now usable
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Forgetting Workers Can't Access the DOM or Main-Thread Variables
```typescript
// ❌ WRONG: worker.js has NO access to `document`, `window`, or any main-thread variable —
// exactly the same constraint covered in the JS browser APIs doc's Web Worker section
self.onmessage = () => { document.getElementById('foo'); }; // ❌ ReferenceError: document is not defined

// ✅ CORRECT: workers communicate exclusively via postMessage — all DOM interaction
// happens back on the main thread, after receiving the worker's result
```

### ⚠️ Pitfall 2: Treating WASM Instantiation as Synchronous
```typescript
// ❌ WRONG: forgetting `?init` resolves to an ASYNC function — this doesn't compile/type-check,
// and even if forced, would return an un-instantiated module promise, not usable exports directly
import wasmExports from './module.wasm?init'; // NOT the actual exports — it's an init FUNCTION
wasmExports.someFunction(); // ❌ TypeError — wasmExports is a function, not the module's exports object

// ✅ CORRECT: call and await the init function first
import init from './module.wasm?init';
const { someFunction } = await init();
someFunction();
```

### ⚠️ Pitfall 3: Using `format: 'iife'` Workers Unnecessarily, Losing Module Syntax
```typescript
// ❌ SUBOPTIMAL (usually): forcing IIFE format when the worker's own code could use ESM
// import/export means losing the ability to import shared utility modules cleanly INTO the worker
worker: { format: 'iife' }, // worker script can't use import/export internally

// ✅ CORRECT: default to 'es' format unless a SPECIFIC compatibility requirement
// (an older browser/runtime lacking module worker support) genuinely necessitates IIFE
worker: { format: 'es' },
```
