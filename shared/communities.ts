// Creator communities: a cosmetic affiliation shown next to a player's name.
// Membership is permanent once joined (operators can change it). No gameplay effect.

/** A sigil is drawn from these parts; the client renders them as SVG in the class-crest style. */
export const SIGIL_SHAPES = ['crest', 'heater', 'round', 'banner'] as const;
export const SIGIL_PATTERNS = ['plain', 'pale', 'fess', 'bend', 'chevron', 'quarterly', 'cross', 'bordure', 'saltire', 'chief'] as const;
/** Field colour pairs, tuned to read on the dark UI. Index 0 of each pair is the field, 1 the division. */
export const SIGIL_PALETTE = [
  ['#2f4a7a', '#c9a24b'], // sapphire / gold
  ['#7a2f3a', '#d9c7a1'], // crimson / bone
  ['#2d6a4f', '#e3d29a'], // emerald / straw
  ['#5b3a7a', '#c0c8d8'], // amethyst / silver
  ['#1f5e66', '#e7b85c'], // teal / amber
  ['#8a4a1f', '#2a2f3d'], // copper / iron
  ['#3d4452', '#d65a48'], // slate / ember
  ['#6b7a2f', '#2b3a2a'], // olive / pine
  ['#a3364a', '#f0dcb4'], // rose / parchment
  ['#26324a', '#7fc8d9'], // midnight / frost
] as const;
export const SIGIL_SYMBOLS = [
  'sword', 'axe', 'shield', 'crown', 'star', 'sun', 'moon', 'flame', 'drop', 'leaf',
  'tree', 'mountain', 'tower', 'key', 'skull', 'eye', 'anchor', 'arrow', 'bolt', 'gem',
  'hourglass', 'chalice', 'heart', 'wolf', 'raven', 'hammer', 'fang', 'feather', 'rune', 'wave',
] as const;

export interface Sigil {
  shape: number;
  pattern: number;
  palette: number;
  symbol: number;
}

export interface CommunitySummary {
  id: string;
  name: string;
  tag: string;
  sigil: Sigil;
}

/** Stored on the player document; copied from the community when joining. */
export interface PlayerCommunity extends CommunitySummary {
  joinedAt: number;
  via: 'code' | 'link' | 'operator';
}

export interface CommunityRankingEntry extends CommunitySummary {
  rank: number;
  wins: number;
  games: number;
  members: number;
}

/** Community IDs double as the codes creators share ("use code KESTREL"). */
export const COMMUNITY_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,22}[a-z0-9]$/;
export const COMMUNITY_TAG_PATTERN = /^[A-Z0-9]{2,5}$/;
export const COMMUNITY_NAME_MAX = 32;

/** Accepts what players type ("Kestrel", " kestrel ") and returns the ID, or null. */
export function normalizeCommunityCode(code: unknown): string | null {
  if (typeof code !== 'string') return null;
  const id = code.trim().toLowerCase();
  return COMMUNITY_ID_PATTERN.test(id) ? id : null;
}

const inRange = (value: unknown, length: number) => Number.isInteger(value) && (value as number) >= 0 && (value as number) < length;

export function isValidSigil(sigil: unknown): sigil is Sigil {
  if (!sigil || typeof sigil !== 'object') return false;
  const {shape, pattern, palette, symbol} = sigil as Sigil;
  return inRange(shape, SIGIL_SHAPES.length) && inRange(pattern, SIGIL_PATTERNS.length)
    && inRange(palette, SIGIL_PALETTE.length) && inRange(symbol, SIGIL_SYMBOLS.length);
}

/** Deterministic default so every community has a distinct-looking sigil without any art. */
export function defaultSigil(id: string): Sigil {
  let hash = 2166136261;
  for (const char of id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  const pick = (length: number) => {
    const value = hash % length;
    hash = (Math.floor(hash / length) ^ Math.imul(hash, 2654435761)) >>> 0;
    return value;
  };
  return {shape: pick(SIGIL_SHAPES.length), pattern: pick(SIGIL_PATTERNS.length), palette: pick(SIGIL_PALETTE.length), symbol: pick(SIGIL_SYMBOLS.length)};
}

export function validateCommunity(input: {id: unknown; name: unknown; tag: unknown; sigil?: unknown}): CommunitySummary {
  const id = normalizeCommunityCode(input.id);
  if (!id) throw new Error('Community code must be 3-24 lowercase letters, digits or hyphens');
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name || name.length > COMMUNITY_NAME_MAX || /[<>]/.test(name) || [...name].some(char => char.charCodeAt(0) < 32)) throw new Error(`Community name must be 1-${COMMUNITY_NAME_MAX} plain characters`);
  const tag = typeof input.tag === 'string' ? input.tag.trim().toUpperCase() : '';
  if (!COMMUNITY_TAG_PATTERN.test(tag)) throw new Error('Community tag must be 2-5 uppercase letters or digits');
  const sigil = input.sigil === undefined ? defaultSigil(id) : input.sigil;
  if (!isValidSigil(sigil)) throw new Error('Invalid sigil');
  return {id, name, tag, sigil};
}

/** The counter document holding one community's results for one weekly season. */
export const communitySeasonDocId = (seasonId: string, communityId: string) => `${seasonId}_${communityId}`;

/** The public part of a membership, safe to send to other players. */
export function communitySummary(community: unknown): CommunitySummary | null {
  if (!community || typeof community !== 'object') return null;
  const {id, name, tag, sigil} = community as CommunitySummary;
  return typeof id === 'string' && typeof name === 'string' && typeof tag === 'string' && isValidSigil(sigil)
    ? {id, name, tag, sigil} : null;
}
