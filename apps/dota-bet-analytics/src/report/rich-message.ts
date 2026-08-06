/**
 * The slice of Telegram's Rich Message format this app sends.
 *
 * Rich messages arrived in Bot API 10.1 and are built from typed blocks. Only
 * the pieces used here are typed — the full set is much larger.
 *
 * **Tables and lists are deliberately absent**, and both were tried. A table's
 * columns are fixed and do not reflow, so a phone crops the right-hand ones. A
 * list wraps correctly but ten players make twenty lines, which buries the one
 * sentence worth reading. The report links to the console instead.
 *
 * A block's `type` string is not its class name: `InputRichBlockBlockQuotation`
 * sends `"blockquote"` and `InputRichBlockSectionHeading` sends `"heading"`.
 * Read the "always ..." value from the docs rather than deriving it — the API
 * rejects the whole message for one wrong type string.
 *
 * https://core.telegram.org/bots/api#rich-messages
 */

/** Plain text, a styled run, or a list of either. */
export type RichText = string | RichTextNode | RichText[];

export type RichTextNode =
  | { type: 'bold'; text: RichText }
  | { type: 'italic'; text: RichText }
  | { type: 'marked'; text: RichText }
  | { type: 'url'; text: RichText; url: string };

export type RichBlock =
  | { type: 'heading'; text: RichText; size?: number }
  | { type: 'paragraph'; text: RichText }
  | { type: 'footer'; text: RichText }
  | { type: 'blockquote'; blocks: RichBlock[] };

/**
 * Telegram's stated ceilings. Exceeding one rejects the whole message, so the
 * builder counts blocks rather than finding out at send time.
 */
export const RICH_MESSAGE_LIMITS = {
  characters: 32_768,
  blocks: 500,
  nesting: 16,
} as const;

export const bold = (text: RichText): RichTextNode => ({ type: 'bold', text });
export const marked = (text: RichText): RichTextNode => ({ type: 'marked', text });
export const link = (text: RichText, url: string): RichTextNode => ({ type: 'url', text, url });

/** Counts blocks the way Telegram does, nested blocks included. */
export function countBlocks(blocks: RichBlock[]): number {
  let total = 0;

  for (const block of blocks) {
    total += 1;

    if (block.type === 'blockquote') {
      total += countBlocks(block.blocks);
    }
  }

  return total;
}
