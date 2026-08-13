export interface Row107 { id: string; qty: number; tags: string[] }
export function total107(rows: Row107[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample107: Row107 = { id: 'r107', qty: 107, tags: ['a', 'b'] };
