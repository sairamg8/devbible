interface Parcel { id: string; weightKg: number }

// never mentions Parcel, but has the right shape
class Crate {
  constructor(public id: string, public weightKg: number, public fragile = true) {}
}
const c: Parcel = new Crate('C-1', 3);        // fine: shapes match

function ship(p: Parcel) { return p.id; }

const extra = { id: 'P-1', weightKg: 2, express: true };
ship(extra);                                   // fine: a variable, extra prop ignored

ship({ id: 'P-2', weightKg: 2, express: true }); // ERROR: object literal

const widened: Parcel = extra;                 // fine
const direct: Parcel = { id: 'P-3', weightKg: 1, express: true }; // ERROR

ship({ id: 'P-4', weightKg: 2, express: true } as Parcel);  // silenced by assertion
