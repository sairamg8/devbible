// 01: JSON single-line shape from a minimal stdout logger
const log = (level, msg, fields = {}) =>
  process.stdout.write(JSON.stringify({level, time: Date.now(), msg, ...fields}) + '\n');
log('info', 'order paid', {orderId: 42, userId: 7});
log('error', 'charge failed', {orderId: 42, err: 'card_declined'});
