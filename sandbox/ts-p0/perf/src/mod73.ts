export interface Row73 { id: string; qty: number; tags: string[] }
export function total73(rows: Row73[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample73: Row73 = { id: 'r73', qty: 73, tags: ['a', 'b'] };
