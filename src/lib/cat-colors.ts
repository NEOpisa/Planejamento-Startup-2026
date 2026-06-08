import type { CatColor } from "./roadmap-data";

/** Mantenha em sincronia com as variáveis --cat-* definidas em globals.css. */
const CAT_HEX: Record<CatColor, string> = {
  violet: "#9f6ef9",
  orchid: "#c084fc",
  teal: "#2dd4bf",
  amber: "#fbbf24",
  magenta: "#e879f9",
};

function hexToRgb(hex: string) {
  const n = parseInt(hex.replace("#", ""), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function catSolid(c: CatColor): string {
  return CAT_HEX[c];
}

export function catSubtle(c: CatColor, alpha = 0.12): string {
  const { r, g, b } = hexToRgb(CAT_HEX[c]);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function catTagStyle(c: CatColor): React.CSSProperties {
  return { background: catSubtle(c, 0.12), color: catSolid(c) };
}
