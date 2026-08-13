const u = null;                      // the ROOT is nullish
console.log('u = null:');
try { console.log('  u?.profile.name  =', u?.profile.name); } catch(e){ console.log('  u?.profile.name  ->', e.constructor.name); }
try { console.log('  (u?.profile).name=', (u?.profile).name); } catch(e){ console.log('  (u?.profile).name->', e.constructor.name+':', e.message); }
const v = {};                        // root fine, MIDDLE link missing
console.log('v = {} (profile missing):');
try { console.log('  v?.profile.name  =', v?.profile.name); } catch(e){ console.log('  v?.profile.name  ->', e.constructor.name+':', e.message); }
console.log('  v?.profile?.name =', v?.profile?.name);
