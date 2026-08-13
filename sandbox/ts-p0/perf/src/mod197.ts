export interface Row197 { id: string; qty: number; tags: string[] }
export function total197(rows: Row197[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample197: Row197 = { id: 'r197', qty: 197, tags: ['a', 'b'] };
