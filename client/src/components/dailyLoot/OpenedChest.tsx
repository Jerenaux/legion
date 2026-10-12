// The chest reveal shared by the daily loot and the end-of-match rewards: the chest rattles
// while its content loads, bursts open in a ring of embers, then deals its rewards one by one.
import {t} from '../../i18n/core';
import { h, Component } from 'preact';
import { createPortal } from 'preact/compat';

import { ChestReward } from "@legion/shared/interfaces";
import { RewardType, ChestColor, Rarity } from "@legion/shared/enums";
import { mapFrameToCoordinates, getRewardBgImage, getRewardObject } from '../utils';

import bronzeChest from '@assets/shop/bronze_chest.png';
import silverChest from '@assets/shop/silver_chest.png';
import goldChest from '@assets/shop/gold_chest.png';
import './OpenedChest.css';

interface OpenedChestProps {
    /** Kept for callers sizing the old overlay; the reveal fills the window. */
    width?: number;
    height?: number;
    color: ChestColor;
    content: ChestReward[] | null;
    onClick: () => void;
}

const CHESTS = {
  [ChestColor.BRONZE]: {image: bronzeChest, title: () => t("Bronze Chest")},
  [ChestColor.SILVER]: {image: silverChest, title: () => t("Silver Chest")},
  [ChestColor.GOLD]: {image: goldChest, title: () => t("Golden Chest")},
};

const KINDS = {
  [RewardType.EQUIPMENT]: () => t("Equipment"),
  [RewardType.SPELL]: () => t("Spell"),
  [RewardType.CONSUMABLES]: () => t("Consumable"),
  [RewardType.GOLD]: () => t("Gold"),
};

const RARITIES = {
  [Rarity.COMMON]: {key: 'common', label: () => t("Common")},
  [Rarity.RARE]: {key: 'rare', label: () => t("Rare")},
  [Rarity.EPIC]: {key: 'epic', label: () => t("Epic")},
  [Rarity.LEGENDARY]: {key: 'legendary', label: () => t("Legendary")},
};

class OpenedChest extends Component<OpenedChestProps> {
  button: HTMLButtonElement | null = null;

  componentDidMount() {
    document.addEventListener('keydown', this.onKey);
  }

  componentDidUpdate(prev: OpenedChestProps) {
    if (!prev.content && this.props.content) this.button?.focus({preventScroll: true});
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.onKey);
  }

  onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && this.props.content) {
      event.preventDefault();
      this.props.onClick();
    }
  };

  renderReward(reward: ChestReward, index: number) {
    const gold = reward.type === RewardType.GOLD;
    const item = gold ? null : getRewardObject(reward.type, reward.id);
    const {x, y} = item ? mapFrameToCoordinates(item.frame) : {x: 0, y: 0};
    const rarity = gold ? null : RARITIES[item?.rarity ?? Rarity.COMMON];
    return (
      <li key={index} className={`chest-reward chest-reward--${gold ? 'gold' : rarity.key}`} style={{'--i': index}}>
        <span className={`chest-reward-icon${gold ? ' is-gold' : ''}`} aria-hidden="true" style={{
          backgroundImage: `url(${getRewardBgImage(reward.type)})`,
          '--fx': x / 32,
          '--fy': y / 32,
        }} />
        {(gold || reward.amount > 1) && <span className="chest-reward-amount">{gold ? reward.amount : `×${reward.amount}`}</span>}
        <span className="chest-reward-name">{gold ? t("Gold") : item ? t(item.name) : ''}</span>
        {rarity && <span className="chest-reward-kind">{KINDS[reward.type]?.()}</span>}
        {rarity && <span className="chest-reward-rarity">{rarity.label()}</span>}
      </li>
    );
  }

  render() {
    const {color, content, onClick} = this.props;
    const chest = CHESTS[color] ?? CHESTS[ChestColor.BRONZE];
    const open = content !== null;
    return createPortal(
      <div className={`chest-reveal chest-reveal--${color}${open ? ' is-open' : ''}`} role="dialog" aria-modal="true" aria-label={chest.title()} aria-busy={!open}>
        <div className="chest-reveal-rays" aria-hidden="true" />
        <div className="chest-reveal-stage">
          <p className="chest-reveal-title">{chest.title()}</p>
          <div className="chest-reveal-chest">
            <img src={chest.image} alt="" />
            <span className="chest-reveal-burst" aria-hidden="true">
              {Array.from({length: 12}, (_, i) => <i key={i} style={{'--a': `${i * 30}deg`}} />)}
            </span>
          </div>
          <ul className="chest-reveal-rewards" aria-live="polite">
            {open && content.map((reward, index) => this.renderReward(reward, index))}
          </ul>
          <button type="button" data-game-control className="chest-reveal-continue" ref={el => { this.button = el; }}
            onClick={onClick} disabled={!open} style={{'--n': content?.length ?? 0}}>
            {open ? t("Continue") : t("Loading...")}
          </button>
        </div>
      </div>,
      document.body,
    );
  }
}

export default OpenedChest;
