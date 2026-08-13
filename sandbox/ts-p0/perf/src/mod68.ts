export interface Row68 { id: string; qty: number; tags: string[] }
export function total68(rows: Row68[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample68: Row68 = { id: 'r68', qty: 68, tags: ['a', 'b'] };
