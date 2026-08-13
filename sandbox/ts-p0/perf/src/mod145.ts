export interface Row145 { id: string; qty: number; tags: string[] }
export function total145(rows: Row145[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample145: Row145 = { id: 'r145', qty: 145, tags: ['a', 'b'] };
