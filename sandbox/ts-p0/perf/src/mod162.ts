export interface Row162 { id: string; qty: number; tags: string[] }
export function total162(rows: Row162[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample162: Row162 = { id: 'r162', qty: 162, tags: ['a', 'b'] };
