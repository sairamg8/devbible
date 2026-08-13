export interface Row157 { id: string; qty: number; tags: string[] }
export function total157(rows: Row157[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample157: Row157 = { id: 'r157', qty: 157, tags: ['a', 'b'] };
