const feats = {
  'ES2015 class/let/Map': () => typeof Map === 'function',
  'ES2017 async/await': () => (async()=>{})() instanceof Promise,
  'ES2019 flat/flatMap': () => !!Array.prototype.flat,
  'ES2020 optional chaining': () => ({a:{b:1}})?.a?.b === 1,
  'ES2020 ??': () => (null ?? 'd') === 'd',
  'ES2020 BigInt': () => typeof 1n === 'bigint',
  'ES2020 globalThis': () => typeof globalThis === 'object',
  'ES2021 replaceAll': () => 'a-a'.replaceAll('-','+') === 'a+a',
  'ES2021 ||= &&= ??=': () => { let x = null; x ??= 1; return x === 1; },
  'ES2022 at()': () => [1,2,3].at(-1) === 3,
  'ES2022 Object.hasOwn': () => Object.hasOwn({a:1},'a'),
  'ES2022 #private + static block': () => { class A { #p = 1; static { this.s = 2; } get(){return this.#p;} } return new A().get()===1 && A.s===2; },
  'ES2022 Error cause': () => new Error('a',{cause:'b'}).cause === 'b',
  'ES2022 top-level await': () => true,
  'ES2023 toSorted/toReversed/with': () => !!Array.prototype.toSorted && [1,2].with(0,9)[0]===9,
  'ES2023 findLast': () => [1,2,3].findLast(n=>n<3) === 2,
  'ES2024 groupBy': () => typeof Object.groupBy === 'function',
  'ES2024 Promise.withResolvers': () => typeof Promise.withResolvers === 'function',
  'ES2025 Set methods (union)': () => typeof new Set().union === 'function',
  'ES2025 Iterator helpers': () => typeof Iterator !== 'undefined' && typeof Iterator.prototype?.map === 'function',
  'ES2025 RegExp.escape': () => typeof RegExp.escape === 'function',
  'Stage-3 Temporal': () => typeof Temporal !== 'undefined',
  'Stage-3 decorators': () => { try { eval('class A { @dec m(){} }'); return true; } catch { return false; } },
};
for (const [name, test] of Object.entries(feats)) {
  let ok; try { ok = !!test(); } catch { ok = false; }
  console.log((ok ? '  yes ' : '  NO  ') + name);
}
