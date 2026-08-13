// Modules are always strict — no directive needed
console.log('module this:', typeof this, this);
try { undeclared = 1; } catch (e) { console.log('1 assign undeclared:', e.constructor.name + ':', e.message); }
try { Object.freeze({}).x = 1; } catch (e) { console.log('2 write frozen:', e.constructor.name + ':', e.message); }
try { delete Object.prototype; } catch (e) { console.log('3 delete non-configurable:', e.constructor.name + ':', e.message); }
function f() { return this; }
console.log('4 this in plain call:', f());
class C { m() { return this; } }
console.log('5 detached class method this:', (0, new C().m)());
