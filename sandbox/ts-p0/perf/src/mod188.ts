export interface Row188 { id: string; qty: number; tags: string[] }
export function total188(rows: Row188[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample188: Row188 = { id: 'r188', qty: 188, tags: ['a', 'b'] };
