export interface Row123 { id: string; qty: number; tags: string[] }
export function total123(rows: Row123[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample123: Row123 = { id: 'r123', qty: 123, tags: ['a', 'b'] };
