try { await import('./thing'); }  catch (e) { console.log('ESM ./thing   →', e.code); }
try { await import('./folder'); } catch (e) { console.log('ESM ./folder  →', e.code); }
console.log('ESM ./thing.js →', (await import('./thing.js')).default);
