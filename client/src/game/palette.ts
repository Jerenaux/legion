// Colour-blind mode swaps the red/green meaning pairs for blue/orange, which stay distinct
// for the common forms of colour blindness. Callers keep using the logical colours.
const COLORBLIND_TINTS: Record<number, number> = {
    0xff0000: 0xff8a00, // enemy team, targeting cursor
    0x00ff00: 0x3d9bff, // ally glow, hover, item cursor
    0xffaaaa: 0xffc98f, // enemy target range
    0xaaffaa: 0xa9d2ff, // ally target range
    0xff5555: 0xff9b33, // enemy spell area
    0x55ff55: 0x5aa9ff, // ally spell area
    0x00cc00: 0x2f86ff, // ally in range
    0xff3333: 0xff8a1c, // enemy in range
};

export const colorblindEnabled = () => typeof document !== 'undefined' && document.documentElement.hasAttribute('data-colorblind');

export function displayTint(color: number) {
    return colorblindEnabled() ? COLORBLIND_TINTS[color] ?? color : color;
}
