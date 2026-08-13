export interface Row266 { id: string; qty: number; tags: string[] }
export function total266(rows: Row266[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample266: Row266 = { id: 'r266', qty: 266, tags: ['a', 'b'] };
