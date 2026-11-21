// Just enough Markdown for PRIVACY.md: headings, paragraphs, lists, bold,
// italics, code and links. Text is escaped before anything is turned into tags.

/**
 * Escapes text for HTML.
 *
 * @param text The text.
 * @returns The escaped text.
 */
function escape(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\"", "&quot;");
}

/**
 * Renders the inline parts of a line.
 *
 * @param text One block's text.
 * @returns HTML.
 */
function inline(text: string): string {
  return escape(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|\W)_([^_]+)_(?=\W|$)/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\((https?:[^)\s]*)\)/g, "<a href=\"$2\" target=\"_blank\" rel=\"noopener noreferrer\">$1</a>")
    .replace(/\[([^\]]+)\]\(((?:mailto:|\/)[^)\s]*)\)/g, "<a href=\"$2\">$1</a>");
}

/**
 * Renders Markdown to HTML.
 *
 * @param markdown The Markdown.
 * @param shift How many levels to lower headings by (1 turns `#` into `<h2>`).
 * @returns HTML.
 */
export function renderMarkdown(markdown: string, shift = 0): string {
  const blocks = markdown.replaceAll("\r\n", "\n").trim().split(/\n{2,}/);

  return blocks.map((block) => {
    const heading = /^(#{1,6}) (.*)$/.exec(block);

    if (heading !== null) {
      const level = Math.min(6, heading[1]!.length + shift);

      return `<h${level}>${inline(heading[2]!)}</h${level}>`;
    }

    if (block.startsWith("- ")) {
      const items = block.split(/\n(?=- )/).map(item => `<li>${inline(item.slice(2).replace(/\n\s*/g, " "))}</li>`);

      return `<ul>${items.join("")}</ul>`;
    }

    return `<p>${inline(block.replace(/\n/g, " "))}</p>`;
  }).join("\n");
}
