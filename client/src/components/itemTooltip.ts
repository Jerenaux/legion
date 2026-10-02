import {BaseEquipment} from '@legion/shared/BaseEquipment';
import {BaseItem} from '@legion/shared/BaseItem';
import {BaseSpell} from '@legion/shared/BaseSpell';
import {Stat, StatLabels} from '@legion/shared/enums';

export const statExplanations: Record<number, string> = {
  [Stat.HP]: 'Maximum health. A character falls when HP reaches zero.',
  [Stat.MP]: 'Maximum magic points available for casting spells.',
  [Stat.ATK]: 'Increases damage dealt by physical attacks.',
  [Stat.DEF]: 'Reduces damage taken from physical attacks.',
  [Stat.SPATK]: 'Strengthens spell damage and healing.',
  [Stat.SPDEF]: 'Reduces damage taken from hostile spells.',
  [Stat.SPEED]: 'Helps this character act earlier and more often.',
};

export const tooltipStyle = {
  backgroundColor: '#101c28',
  border: '1px solid #5d8998',
  borderRadius: '6px',
  color: '#e8f4f6',
  fontFamily: 'Kim, sans-serif',
  fontSize: '0.875rem',
  lineHeight: '1.45',
  maxWidth: '280px',
  opacity: 1,
  whiteSpace: 'pre-line' as const,
  zIndex: 1200,
};

export function itemTooltip(item: BaseItem | BaseSpell | BaseEquipment): string {
  const lines = [item.name];
  if (item.description) lines.push(item.description);
  if (item instanceof BaseSpell) lines.push(`${item.cost} MP to cast`);
  for (const effect of item.effects) {
    const value = item instanceof BaseItem && effect.value === -1
      ? 'Full' : effect.value > 0 ? `+${effect.value}` : String(effect.value);
    lines.push(`${value} ${StatLabels[effect.stat] ?? ''}`.trim());
  }
  return lines.join('\n');
}
