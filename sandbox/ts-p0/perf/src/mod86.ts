export interface Row86 { id: string; qty: number; tags: string[] }
export function total86(rows: Row86[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample86: Row86 = { id: 'r86', qty: 86, tags: ['a', 'b'] };
