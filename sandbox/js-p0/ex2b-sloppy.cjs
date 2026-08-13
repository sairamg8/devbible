console.log('cjs this === module.exports:', this === module.exports);
undeclared = 1;
console.log('assign undeclared succeeded:', globalThis.undeclared);
Object.freeze({}).x = 1;
console.log('write to frozen: silently ignored, no throw');
function f() { return this === globalThis; }
console.log('this in plain call is globalThis:', f());
