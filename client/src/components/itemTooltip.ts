import {t} from '../i18n/core';
import {BaseEquipment} from '@legion/shared/BaseEquipment';
import {BaseItem} from '@legion/shared/BaseItem';
import {BaseSpell} from '@legion/shared/BaseSpell';
import {Stat, StatLabels} from '@legion/shared/enums';

export const statExplanations: Record<number, string> = {
  [Stat.HP]: t("Maximum health. A character falls when HP reaches zero."),
  [Stat.MP]: t("Maximum magic points available for casting spells."),
  [Stat.ATK]: t("Increases damage dealt by physical attacks."),
  [Stat.DEF]: t("Reduces damage taken from physical attacks."),
  [Stat.SPATK]: t("Strengthens spell damage and healing."),
  [Stat.SPDEF]: t("Reduces damage taken from hostile spells."),
  [Stat.SPEED]: t("Helps this character act earlier and more often."),
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
