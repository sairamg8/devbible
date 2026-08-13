interface Parcel { id: string; weightKg: number }

function quote(p: Parcel, perKg: number): number {
  return Math.round(p.weightKg * perKg);
}

const parcel: Parcel = { id: 'P-1', weightKg: 2.5 };
console.log('quote:', quote(parcel, 120));
