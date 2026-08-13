interface Cart { items: string[]; total: number }
const cart: Cart = { items: ['sku-1'], total: 'four thousand' };
console.log(cart.total.toFixed(2));
