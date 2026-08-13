function parse(input: string): string[];
function parse(input: string, limit: number): string[];
function parse(input: string, limit?: number): string[] {
  const parts = input.split(',');
  return limit === undefined ? parts : parts.slice(0, limit);
}
parse('a,b,c');
parse('a,b,c', 2);
parse('a,b,c', 2, true);
