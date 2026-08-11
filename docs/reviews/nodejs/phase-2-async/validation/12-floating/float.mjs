process.on('unhandledRejection', (r) => console.log('caught floating', r.message));
async function bad() { throw new Error('float'); }
bad(); // not awaited
await new Promise(r => setTimeout(r, 20));
