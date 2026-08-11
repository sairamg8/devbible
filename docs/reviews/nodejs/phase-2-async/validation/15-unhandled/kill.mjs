Promise.reject(new Error('boom'));
setTimeout(() => console.log('should not print if process dies'), 100);
