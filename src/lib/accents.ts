import type { TAccent } from "./prefs/prefs";



export type TSwatch = {
  /** The fill: checks, primary buttons, switches. */
  fill: string;
  /** Text and check marks on the fill. */
  text: string;
};

/**
 * The accent colors, for light and for dark surfaces. They mirror
 * `src/assets/skins/accents.css`, and a test keeps the two in step and
 * checks each pair's contrast.
 */
export const ACCENT_SWATCHES: Record<TAccent, Record<"light" | "dark", TSwatch>> = {
  mint: { light: { fill: "#39c89a", text: "#161c5c" }, dark: { fill: "#39c89a", text: "#161c5c" } },
  sky: { light: { fill: "#4fb3ef", text: "#0b1f45" }, dark: { fill: "#4fb3ef", text: "#0b1f45" } },
  coral: { light: { fill: "#ff7366", text: "#2b0b07" }, dark: { fill: "#ff7366", text: "#2b0b07" } },
  violet: { light: { fill: "#6d4fe0", text: "#ffffff" }, dark: { fill: "#a693ff", text: "#160c3d" } },
  amber: { light: { fill: "#f4b223", text: "#2a1a00" }, dark: { fill: "#f4b223", text: "#2a1a00" } },
  rose: { light: { fill: "#ee6aa2", text: "#2a0617" }, dark: { fill: "#ee6aa2", text: "#2a0617" } },
  teal: { light: { fill: "#17a8a2", text: "#021c1b" }, dark: { fill: "#35c9c2", text: "#021c1b" } },
  ink: { light: { fill: "#2d3596", text: "#ffffff" }, dark: { fill: "#a3aef2", text: "#0b0f38" } },
};

function luminance(hex: string): number {
  const channels = [1, 3, 5].map(start => Number.parseInt(hex.slice(start, start + 2), 16) / 255);
  const [r = 0, g = 0, b = 0] = channels.map(value => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * The WCAG contrast ratio between two colors.
 *
 * @param a A color as `#rrggbb`.
 * @param b Another color as `#rrggbb`.
 * @returns The ratio, from 1 to 21.
 */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];

  return (light + 0.05) / (dark + 0.05);
}
