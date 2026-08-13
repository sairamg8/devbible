export interface Row83 { id: string; qty: number; tags: string[] }
export function total83(rows: Row83[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample83: Row83 = { id: 'r83', qty: 83, tags: ['a', 'b'] };
