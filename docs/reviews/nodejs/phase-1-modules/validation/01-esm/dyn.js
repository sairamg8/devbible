const name = process.argv[2] ?? 'math';
const mod = await import(`./${name}.js`);
console.log('loaded', name, '→', Object.keys(mod));
