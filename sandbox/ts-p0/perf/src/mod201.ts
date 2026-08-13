export interface Row201 { id: string; qty: number; tags: string[] }
export function total201(rows: Row201[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample201: Row201 = { id: 'r201', qty: 201, tags: ['a', 'b'] };
