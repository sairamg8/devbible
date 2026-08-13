export interface Row105 { id: string; qty: number; tags: string[] }
export function total105(rows: Row105[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample105: Row105 = { id: 'r105', qty: 105, tags: ['a', 'b'] };
