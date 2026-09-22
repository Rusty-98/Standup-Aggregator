/** True when TipTap/HTML markup still has visible text after stripping tags. */
export function htmlHasContent(html: string): boolean {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim().length > 0;
}
