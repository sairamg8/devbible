export interface Row173 { id: string; qty: number; tags: string[] }
export function total173(rows: Row173[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample173: Row173 = { id: 'r173', qty: 173, tags: ['a', 'b'] };
