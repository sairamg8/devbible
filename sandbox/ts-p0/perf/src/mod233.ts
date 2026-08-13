export interface Row233 { id: string; qty: number; tags: string[] }
export function total233(rows: Row233[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample233: Row233 = { id: 'r233', qty: 233, tags: ['a', 'b'] };
