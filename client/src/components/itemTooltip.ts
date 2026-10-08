import {t} from '../i18n/core';
import {BaseEquipment} from '@legion/shared/BaseEquipment';
import {BaseItem} from '@legion/shared/BaseItem';
import {BaseSpell} from '@legion/shared/BaseSpell';
import {Stat, StatLabels} from '@legion/shared/enums';

/** Full names for the abbreviated stat labels (HP, SP.ATK...). */
export const statNames: Record<number, string> = {
  [Stat.HP]: "Health Points",
  [Stat.MP]: "Magic Points",
  [Stat.ATK]: "Attack",
  [Stat.DEF]: "Defense",
  [Stat.SPATK]: "Special Attack",
  [Stat.SPDEF]: "Special Defense",
  [Stat.SPEED]: "Speed",
};

export const statExplanations: Record<number, string> = {
  [Stat.HP]: "Maximum health. A character falls when HP reaches zero.",
  [Stat.MP]: "Maximum magic points available for casting spells.",
  [Stat.ATK]: "Increases damage dealt by physical attacks.",
  [Stat.DEF]: "Reduces damage taken from physical attacks.",
  [Stat.SPATK]: "Strengthens spell damage and healing.",
  [Stat.SPDEF]: "Reduces damage taken from hostile spells.",
  [Stat.SPEED]: "Helps this character act earlier and more often.",
};

export const tooltipStyle = {
  backgroundColor: '#101c28',
  border: '1px solid #5d8998',
  borderRadius: '6px',
  color: '#e8f4f6',
  fontFamily: "var(--locale-font, 'Kim'), system-ui, sans-serif",
  fontSize: '0.875rem',
  lineHeight: '1.45',
  maxWidth: '280px',
  opacity: 1,
  whiteSpace: 'pre-line' as const,
  zIndex: 1200,
};

export function itemTooltip(item: BaseItem | BaseSpell | BaseEquipment): string {
  const lines = [t(item.name)];
  if (item.description) lines.push(t(item.description));
  if (item instanceof BaseSpell) lines.push(t("{{count}} MP to cast", {count: item.cost}));
  for (const effect of item.effects) {
    const value = item instanceof BaseItem && effect.value === -1
      ? t("Full") : effect.value > 0 ? `+${effect.value}` : String(effect.value);
    lines.push(`${value} ${t(StatLabels[effect.stat] ?? '')}`.trim());
  }
  return lines.join('\n');
}
