export interface Row153 { id: string; qty: number; tags: string[] }
export function total153(rows: Row153[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample153: Row153 = { id: 'r153', qty: 153, tags: ['a', 'b'] };
