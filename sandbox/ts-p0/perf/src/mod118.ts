export interface Row118 { id: string; qty: number; tags: string[] }
export function total118(rows: Row118[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample118: Row118 = { id: 'r118', qty: 118, tags: ['a', 'b'] };
