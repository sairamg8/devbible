interface Parcel {
  id: string;
  weightKg: number;
  express?: boolean;
}

type Rate = { base: number; perKg: number };

function quote<T extends Parcel>(parcel: T, rate: Rate): number {
  const surcharge: number = parcel.express ? 500 : 0;
  return rate.base + parcel.weightKg * rate.perKg + surcharge;
}

const parcel = { id: 'P-1', weightKg: 2.5, express: true } satisfies Parcel;
console.log(quote(parcel, { base: 4000, perKg: 120 } as Rate));
