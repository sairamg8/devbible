export interface Row295 { id: string; qty: number; tags: string[] }
export function total295(rows: Row295[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample295: Row295 = { id: 'r295', qty: 295, tags: ['a', 'b'] };
