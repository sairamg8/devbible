const a = await import('./once.js');
const b = await import('./once.js');
console.log('same module object?', a === b, '| same timestamp?', a.t === b.t);
