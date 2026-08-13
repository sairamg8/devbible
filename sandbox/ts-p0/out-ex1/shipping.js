function quote(parcel, rate) {
    const surcharge = parcel.express ? 500 : 0;
    return rate.base + parcel.weightKg * rate.perKg + surcharge;
}
const parcel = { id: 'P-1', weightKg: 2.5, express: true };
console.log(quote(parcel, { base: 4000, perKg: 120 }));
export {};
