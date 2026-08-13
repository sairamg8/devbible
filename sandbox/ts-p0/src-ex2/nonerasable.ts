enum Status { Pending, Shipped }

class Order {
  constructor(private readonly id: string, public total: number) {}
  describe(): string { return `${this.id}: ${this.total}`; }
}

const o = new Order('O-1', 4800);
console.log(Status.Pending, Status[0], o.describe());
