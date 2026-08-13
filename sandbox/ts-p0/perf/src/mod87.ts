export interface Row87 { id: string; qty: number; tags: string[] }
export function total87(rows: Row87[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample87: Row87 = { id: 'r87', qty: 87, tags: ['a', 'b'] };
