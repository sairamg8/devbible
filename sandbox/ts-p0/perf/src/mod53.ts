export interface Row53 { id: string; qty: number; tags: string[] }
export function total53(rows: Row53[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample53: Row53 = { id: 'r53', qty: 53, tags: ['a', 'b'] };
