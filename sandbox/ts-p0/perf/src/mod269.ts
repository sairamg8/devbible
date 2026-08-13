export interface Row269 { id: string; qty: number; tags: string[] }
export function total269(rows: Row269[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample269: Row269 = { id: 'r269', qty: 269, tags: ['a', 'b'] };
