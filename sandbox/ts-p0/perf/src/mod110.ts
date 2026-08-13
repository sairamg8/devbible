export interface Row110 { id: string; qty: number; tags: string[] }
export function total110(rows: Row110[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample110: Row110 = { id: 'r110', qty: 110, tags: ['a', 'b'] };
