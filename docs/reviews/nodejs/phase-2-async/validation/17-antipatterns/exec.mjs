process.on('unhandledRejection', (r) => console.log('unhandledRejection →', r.message));
const p = new Promise(async (resolve) => {
  throw new Error('lost');
});
let settled = false;
p.then(() => settled = 'fulfilled', () => settled = 'rejected');
setTimeout(() => console.log('p settled?', settled), 50);
