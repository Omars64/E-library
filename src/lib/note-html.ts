import sanitizeHtml from "sanitize-html";

export function cleanNoteHtml(value: string) {
  return sanitizeHtml(value, {
    allowedTags: ["p","br","b","strong","i","em","u","ul","ol","li","h2","blockquote","div"],
    allowedAttributes: {},
  });
}
