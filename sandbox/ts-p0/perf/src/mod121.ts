export interface Row121 { id: string; qty: number; tags: string[] }
export function total121(rows: Row121[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample121: Row121 = { id: 'r121', qty: 121, tags: ['a', 'b'] };
