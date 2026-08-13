export function send(to: string, subject = 'none', ...cc: string[]) {
  return { to, subject, cc };
}
