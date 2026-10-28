import type { CSSProperties } from "react";

export const BOOK_PALETTES = [
  { id: "burgundy", label: "Burgundy & dusty rose", base: "#6b344b", light: "#bd7e91", ink: "#fff1d8" },
  { id: "plum", label: "Plum & lavender", base: "#51405f", light: "#9d82b0", ink: "#fff1d8" },
  { id: "forest", label: "Forest green & teal", base: "#244d46", light: "#568c83", ink: "#fff1d8" },
  { id: "navy", label: "Navy & slate blue", base: "#253852", light: "#6e829d", ink: "#fff1d8" },
  { id: "brown", label: "Warm brown & antique gold", base: "#6b4c37", light: "#b49255", ink: "#fff1d8" },
  { id: "sand", label: "Sand & charcoal", base: "#d5bd96", light: "#9f8f79", ink: "#302c2d" },
] as const;

export type PaletteId = (typeof BOOK_PALETTES)[number]["id"];

export function BookCover({ title, author, palette = "burgundy", compact = false }: {
  title: string;
  author?: string | null;
  palette?: string;
  compact?: boolean;
}) {
  const colors = BOOK_PALETTES.find((item) => item.id === palette) ?? BOOK_PALETTES[0];
  const style = {
    "--cover-base": colors.base,
    "--cover-light": colors.light,
    "--cover-ink": colors.ink,
  } as CSSProperties;

  return (
    <div className={`book-cover ${compact ? "book-cover--compact" : ""}`} style={style} aria-label={`${title} book cover`}>
      <span className="book-cover__motif" aria-hidden="true">✦</span>
      <span className="book-cover__rule" aria-hidden="true" />
      <strong style={{ fontSize: title.length > 90 ? "clamp(10px, 1vw, 15px)" : title.length > 50 ? "clamp(12px, 1.3vw, 19px)" : undefined }}>{title}</strong>
      {author && <span className="book-cover__author">{author}</span>}
      <span className="book-cover__imprint">E · LIBRARY</span>
    </div>
  );
}
