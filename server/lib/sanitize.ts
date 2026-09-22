import sanitizeHtml from 'sanitize-html';

const ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 's', 'code', 'ul', 'ol', 'li', 'a', 'div', 'label', 'input', 'span'];

const ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  a: ['href', 'title', 'target', 'rel'],
  li: ['data-checked', 'data-type'],
  ul: ['data-type'],
  ol: ['data-type'],
  input: ['type', 'checked', 'disabled'],
  label: [],
  div: ['data-type'],
  span: []
};

export function sanitizeStandupHtml(inputHtml: string): { html: string; text: string } {
  if (!inputHtml || typeof inputHtml !== 'string') {
    return { html: '', text: '' };
  }

  const cleanHtml = sanitizeHtml(inputHtml, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: (tagName, attribs) => {
        return {
          tagName: 'a',
          attribs: {
            ...attribs,
            target: '_blank',
            rel: 'noopener noreferrer nofollow'
          }
        };
      }
    }
  });

  // Generate plain text projection
  const plainText = sanitizeHtml(cleanHtml, {
    allowedTags: [],
    allowedAttributes: {}
  })
    .replace(/\s+/g, ' ')
    .trim();

  // Enforce 4000 chars max
  const truncatedHtml = cleanHtml.length > 4000 ? cleanHtml.slice(0, 4000) : cleanHtml;
  const truncatedText = plainText.length > 4000 ? plainText.slice(0, 4000) : plainText;

  return {
    html: truncatedHtml,
    text: truncatedText
  };
}
