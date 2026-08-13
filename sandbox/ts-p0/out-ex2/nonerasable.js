var Status;
(function (Status) {
    Status[Status["Pending"] = 0] = "Pending";
    Status[Status["Shipped"] = 1] = "Shipped";
})(Status || (Status = {}));
class Order {
    id;
    total;
    constructor(id, total) {
        this.id = id;
        this.total = total;
    }
    describe() { return `${this.id}: ${this.total}`; }
}
const o = new Order('O-1', 4800);
console.log(Status.Pending, Status[0], o.describe());
export {};
