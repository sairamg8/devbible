export interface Row161 { id: string; qty: number; tags: string[] }
export function total161(rows: Row161[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample161: Row161 = { id: 'r161', qty: 161, tags: ['a', 'b'] };
