try {
  require('./tla-side.js');
} catch (e) {
  console.log(e.code, '—', e.message.split('\n')[0]);
}
