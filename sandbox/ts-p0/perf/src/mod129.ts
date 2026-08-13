export interface Row129 { id: string; qty: number; tags: string[] }
export function total129(rows: Row129[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample129: Row129 = { id: 'r129', qty: 129, tags: ['a', 'b'] };
