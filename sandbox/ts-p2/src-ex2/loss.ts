type Order = { shippedAt: Date | null; items: string[] };
declare const order: Order;
declare function save(o: Order): Promise<void>;

async function afterAwait() {
  if (order.shippedAt !== null) {
    await save(order);
    order.shippedAt.getTime();       // LOST
  }
}

function inCallback() {
  if (order.shippedAt !== null) {
    order.items.forEach(() => {
      order.shippedAt.getTime();     // LOST
    });
  }
}

function withConst() {
  const shippedAt = order.shippedAt;
  if (shippedAt !== null) {
    order.items.forEach(() => shippedAt.getTime());   // kept
  }
}

function reassigned(v: string | number) {
  if (typeof v === 'string') {
    v = 42;
    const r: 1 = v;                  // reveals what it is now
  }
}
