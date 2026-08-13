export interface Row19 { id: string; qty: number; tags: string[] }
export function total19(rows: Row19[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample19: Row19 = { id: 'r19', qty: 19, tags: ['a', 'b'] };
