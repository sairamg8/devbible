export interface Row43 { id: string; qty: number; tags: string[] }
export function total43(rows: Row43[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample43: Row43 = { id: 'r43', qty: 43, tags: ['a', 'b'] };
