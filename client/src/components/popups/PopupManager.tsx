import { h, Component } from 'preact';
import Welcome from './welcome/Welcome';
import { PlayOneGameNotification } from './gameNotification/PlayOneGameNotification';
import { UnlockedFeature } from './unlockedFeature/UnlockedFeature';
import { ChestReward } from "@legion/shared/interfaces";
import { InventoryType, LockedFeatures, ShopTab } from "@legion/shared/enums";
import { SimplePopup } from './simplePopup/SimplePopup';
import { UNLOCK_REWARDS } from '@legion/shared/config';
import { PlayerContext } from '../../contexts/PlayerContext';
import { FeatureReveal } from './featureReveal/FeatureReveal';

export enum Popup {
  Guest,
  PlayTwiceToUnlockShop,
  PlayToUnlockShop,
  UnlockedShop,
  BuySomething,
  GoTeamPage,
  EquipConsumable,
  EquipEquipment,
  EquipSpell,
  SwitchCharacterForEquipment,
  SwitchCharacterForSpell,
  UnlockedSpells,
  UnlockedEquipment,
  UnlockedRanked,
  UnlockedConsumables2,
  UnlockedSpells2,
  UnlockedEquipment2,
  UnlockedDailyLoot,
  UnlockedEquipment3,
  UnlockedConsumables3,
  UnlockedSpells3,
  UnlockedCharacters,
  PlayToUnlockSpells,
  PlayToUnlockEquipment,
  PlayToUnlockRanked,
  PlayToUnlockConsumables2,
  PlayToUnlockSpells2,
  PlayToUnlockEquipment2,
  PlayToUnlockDailyLoot,
  PlayToUnlockEquipment3,
  PlayToUnlockConsumables3,
  PlayToUnlockSpells3,
  PlayToUnlockCharacters,
  SpendSP,
  SwitchCharacterForSP,
  FeatureReveal,
}

interface UnlockedFeatureConfig {
  name: string;
  description: string;
  rewards: ChestReward[];
  route?: string;
}

interface SimplePopupConfig {
  header?: string;
  text: string;
}

interface FeatureRevealConfig {
  title: string;
  description: string;
  contentCategory: InventoryType;
  frame: number;
  route?: string;
}

interface PopupConfig {
  component: any;
  priority: number;
  highlightSelectors?: string[];  // CSS selectors for elements to highlight
  props?: UnlockedFeatureConfig | SimplePopupConfig | FeatureRevealConfig;  
  ignoreStorage?: boolean;  
}

const STORAGE_KEY = 'displayed_popups';

const POPUP_CONFIGS: Record<Popup, PopupConfig> = {
  [Popup.Guest]: {
    component: Welcome,
    priority: -1,
    ignoreStorage: true  // Guest popup ignores storage
  },
  [Popup.PlayTwiceToUnlockShop]: {
    component: PlayOneGameNotification,
    priority: 1,
    highlightSelectors: [
      '[data-playmode="practice"]',
      '[data-playmode="casual"]'
    ],
    props: {
      header: 'Unlocking the Shop',
      text: 'Play two <span class="highlight-text">Practice</span> or <span class="highlight-text">Casual</span> games to unlock the <span class="highlight-text">Shop</span>!',
      rewards: UNLOCK_REWARDS[LockedFeatures.CONSUMABLES_BATCH_1]
    }
  },
  [Popup.PlayToUnlockShop]: {
    component: PlayOneGameNotification,
    priority: 1,
    highlightSelectors: [
      '[data-playmode="practice"]',
      '[data-playmode="casual"]'
    ],
    props: {
      header: 'Unlocking the Shop',
      text: 'Play one <span class="highlight-text">Practice</span> or <span class="highlight-text">Casual</span> game to earn <span class="highlight-text">Gold</span>, <span class="highlight-text">Potions</span> and unlock the <span class="highlight-text">Shop</span>!',
      rewards: UNLOCK_REWARDS[LockedFeatures.CONSUMABLES_BATCH_1]
    }
  },
  [Popup.UnlockedShop]: {
    component: UnlockedFeature,
    priority: 100,
    props: {
      name: 'The shop',
      description: 'You can now buy <span class="highlight-text">Consumables</span> for your characters in the <span class="highlight-text">Shop</span>! Here\'s some gold and potions to get you started.',
      rewards: UNLOCK_REWARDS[LockedFeatures.CONSUMABLES_BATCH_1],
      route: '/shop'
    }
  },
  [Popup.BuySomething]: {
    component: SimplePopup,
    priority: 3,
    highlightSelectors: ['[data-shop-item="consumable-0"]'],
    props: {
      header: 'Your first purchase',
      text: 'Click on the <span class="highlight-text">Potion</span> to buy one!',
    }
  },
  [Popup.GoTeamPage]: {
    component: SimplePopup,
    priority: 4,
    highlightSelectors: ['[data-team-page]'],
    props: {
      text: 'Go to the <span class="highlight-text">Team Page</span> to check your inventory and equip something you bought!',
    }
  },
  [Popup.EquipConsumable]: {
    component: SimplePopup,
    priority: 5,
    highlightSelectors: ['[data-item-icon="consumables-0"]'],
    props: {
      text: 'Click on a <span class="highlight-text">Potion</span> to equip it on the current character so they can use it in combat!',
    }
  },
  [Popup.UnlockedSpells]: {
    component: UnlockedFeature,
    priority: 100,
    props: {
      name: 'The Spells Shop',
      description: 'You can now buy <span class="highlight-text">Spells</span> for your mages from the shop! Here is some gold, and some <span class="highlight-text">Ethers</span> to replenish <span class="highlight-text">MP</span> after casting spells.',
      rewards: UNLOCK_REWARDS[LockedFeatures.SPELLS_BATCH_1],
      route: `/shop/spells`
    }
  },
  [Popup.UnlockedEquipment]: {
    component: UnlockedFeature,
    priority: 100,
    props: {
      name: 'The Equipment Shop',
      description: 'You can now buy <span class="highlight-text">Equipment</span> for your characters from the shop! Here is some gold, and a <span class="highlight-text">Golden Ring</span> to start your collection!',
      rewards: UNLOCK_REWARDS[LockedFeatures.EQUIPMENT_BATCH_1],
      route: `/shop/equipments`
    }
  },
  [Popup.UnlockedRanked]: {
    component: UnlockedFeature,
    priority: 100,
    props: {
      name: 'Ranked Mode',
      description: 'You can now compete against other players in <span class="highlight-text">Ranked Mode</span> for the top spot on the leaderboard! Here is some more gold, and two <span class="highlight-text">Clovers</span> to help you a bit!',
      rewards: UNLOCK_REWARDS[LockedFeatures.RANKED_MODE],
      route: '/rank'
    }
  },
  [Popup.UnlockedConsumables2]: {
    component: UnlockedFeature,
    priority: 100,
    props: {
      name: 'More Consumables',
      description: 'New <span class="highlight-text">Consumables</span> are available! Here is a sample for you!',
      rewards: UNLOCK_REWARDS[LockedFeatures.CONSUMABLES_BATCH_2],
      route: `/shop`
    }
  },
  [Popup.UnlockedSpells2]: {
    component: UnlockedFeature,
    priority: 100,
    props: {
      name: 'More Spells',
      description: 'New <span class="highlight-text">Spells</span> are available in the shop!',
      rewards: UNLOCK_REWARDS[LockedFeatures.SPELLS_BATCH_2],
      route: `/shop/spells`
    }
  },
  [Popup.UnlockedEquipment2]: {
    component: UnlockedFeature,
    priority: 100,
    props: {
      name: 'More Equipment',
      description: 'New <span class="highlight-text">Equipment</span> is available in the shop!',
      rewards: UNLOCK_REWARDS[LockedFeatures.EQUIPMENT_BATCH_2],
      route: `/shop/equipments`
    }
  },
  [Popup.UnlockedDailyLoot]: {
    component: UnlockedFeature,
    priority: 100,
    props: {
      name: 'Daily Rewards',
      description: 'From now on, you can get a daily rewards, every 6, 12 and 24 hours! Play <span class="highlight-text">Casual</span> or <span class="highlight-text">Ranked</span> games to get keys to open the chests!',
      rewards: UNLOCK_REWARDS[LockedFeatures.DAILY_LOOT],
    }
  },
  [Popup.UnlockedEquipment3]: {
    component: UnlockedFeature,
    priority: 100,
    props: {
      name: 'All Equipment',
      description: 'All <span class="highlight-text">Equipment</span> pieces are now available in the shop!',
      rewards: UNLOCK_REWARDS[LockedFeatures.EQUIPMENT_BATCH_3],
      route: `/shop/equipments`
    }
  },
  [Popup.UnlockedConsumables3]: {
    component: UnlockedFeature,
    priority: 100,
    props: {
      name: 'All Consumables',
      description: 'All <span class="highlight-text">Consumables</span> are now available in the shop!',
      rewards: UNLOCK_REWARDS[LockedFeatures.CONSUMABLES_BATCH_3],
      route: `/shop`
    }
  },
  [Popup.UnlockedSpells3]: {
    component: UnlockedFeature,
    priority: 100,
    props: {
      name: 'All Spells',
      description: 'All <span class="highlight-text">Spells</span> are now available in the shop!',
      rewards: UNLOCK_REWARDS[LockedFeatures.SPELLS_BATCH_3],
      route: `/shop/spells`
    }
  },
  [Popup.UnlockedCharacters]: {
    component: UnlockedFeature,
    priority: 100,
    props: {
      name: 'Characters',
      description: 'You can now increase your team size by purchasing additional <span class="highlight-text">Characters</span> in the shop!',
      rewards: UNLOCK_REWARDS[LockedFeatures.CHARACTER_PURCHASES],
      route: `/shop/characters`
    }
  },
  [Popup.SwitchCharacterForEquipment]: {
    component: SimplePopup,
    priority: 15,
    highlightSelectors: ['[data-character-canequip]'],
    props: {
      text: 'One of your <span class="highlight-text">Characters</span> can equip a new piece of equipment! Click on the character to switch to it!',
    }
  },
  [Popup.SwitchCharacterForSpell]: {
    component: SimplePopup,
    priority: 16,
    highlightSelectors: ['[data-character-canlearnspell]'],
    props: {
      text: 'One of your <span class="highlight-text">Characters</span> can learn a new spell! Click on the character to switch to it!',
    }
  },
  [Popup.EquipSpell]: {
    component: SimplePopup,
    priority: 17,
    highlightSelectors: ['[data-item-learnable]'],
    props: {
      text: 'Click on a <span class="highlight-text">Spell</span> to teach it to the current character; they will then be able to use it in combat! But be careful, teaching a spell will take a spell slot and cannot be undone!',
    }
  },
  [Popup.EquipEquipment]: {
    component: SimplePopup,
    priority: 18,
    highlightSelectors: ['[data-item-equipable]'],
    props: {
      text: 'Click on a <span class="highlight-text">Equipment</span> to equip it on the current character to boost their stats as long as it is equipped!',
    }
  },
  [Popup.PlayToUnlockSpells]: {
    component: PlayOneGameNotification,
    priority: 19,
    props: {
      header: 'Unlocking Spells',
      text: 'Play one <span class="highlight-text">Practice</span> or <span class="highlight-text">Casual</span> game to unlock <span class="highlight-text">Spells</span> in the shop and earn these rewards!',
      rewards: UNLOCK_REWARDS[LockedFeatures.SPELLS_BATCH_1]
    },
    highlightSelectors: [
      '[data-playmode="practice"]',
      '[data-playmode="casual"]'
    ],
  },
  [Popup.PlayToUnlockEquipment]: {
    component: PlayOneGameNotification,
    priority: 20,
    props: {
      header: 'Unlocking Equipment',
      text: 'Play one <span class="highlight-text">Practice</span> or <span class="highlight-text">Casual</span> game to unlock <span class="highlight-text">Equipment</span> in the shop and earn these rewards!',
      rewards: UNLOCK_REWARDS[LockedFeatures.EQUIPMENT_BATCH_1]
    },
    highlightSelectors: [
      '[data-playmode="practice"]',
      '[data-playmode="casual"]'
    ],
  },  
  [Popup.PlayToUnlockRanked]: {
    component: PlayOneGameNotification,
    priority: 21,
    props: {
      header: 'Unlocking Ranked Mode',
      text: 'Play one <span class="highlight-text">Practice</span> or <span class="highlight-text">Casual</span> game to unlock <span class="highlight-text">Ranked Mode</span> and earn these rewards!',
      rewards: UNLOCK_REWARDS[LockedFeatures.RANKED_MODE]
    },
    highlightSelectors: [
      '[data-playmode="practice"]',
      '[data-playmode="casual"]'
    ],
  },
  [Popup.PlayToUnlockConsumables2]: {
    component: PlayOneGameNotification,
    priority: 22,
    props: {
      header: 'Unlocking more Consumables',
      text: 'Play one <span class="highlight-text">Casual</span> or <span class="highlight-text">Ranked</span> game to unlock <span class="highlight-text">more Consumables</span> in the shop and earn these rewards!',
      rewards: UNLOCK_REWARDS[LockedFeatures.CONSUMABLES_BATCH_2]
    },
    highlightSelectors: [
      '[data-playmode="casual"]',
      '[data-playmode="ranked"]'
    ],
  },
  [Popup.PlayToUnlockSpells2]: {
    component: PlayOneGameNotification,
    priority: 23,
    props: {
      header: 'Unlocking more Spells',
      text: 'Play one <span class="highlight-text">Casual</span> or <span class="highlight-text">Ranked</span> game to unlock <span class="highlight-text">more Spells</span> in the shop and earn these rewards!',
      rewards: UNLOCK_REWARDS[LockedFeatures.SPELLS_BATCH_2]
    },
    highlightSelectors: [
      '[data-playmode="casual"]',
      '[data-playmode="ranked"]'
    ],
  },
  [Popup.PlayToUnlockEquipment2]: {
    component: PlayOneGameNotification,
    priority: 24,
    props: {
      header: 'Unlocking more Equipment',
      text: 'Play one <span class="highlight-text">Casual</span> or <span class="highlight-text">Ranked</span> game to unlock <span class="highlight-text">more Equipment</span> in the shop and earn these rewards!',
      rewards: UNLOCK_REWARDS[LockedFeatures.EQUIPMENT_BATCH_2]
    },
    highlightSelectors: [
      '[data-playmode="casual"]',
      '[data-playmode="ranked"]'
    ],
  },
  [Popup.PlayToUnlockDailyLoot]: {
    component: PlayOneGameNotification,
    priority: 25,
    props: {
      header: 'Unlocking Daily Rewards',
      text: 'Play one <span class="highlight-text">Casual</span> or <span class="highlight-text">Ranked</span> game to unlock <span class="highlight-text">Daily Rewards</span> and earn these rewards!',
      rewards: UNLOCK_REWARDS[LockedFeatures.DAILY_LOOT]
    },
    highlightSelectors: [
      '[data-playmode="casual"]',
      '[data-playmode="ranked"]'
    ],
  },
  [Popup.PlayToUnlockCharacters]: {
    component: PlayOneGameNotification,
    priority: 26,
    props: {
      header: 'Unlocking Characters',
      text: 'Play one <span class="highlight-text">Casual</span> or <span class="highlight-text">Ranked</span> game to unlock <span class="highlight-text">Characters</span> in the shop and earn these rewards!',
      rewards: UNLOCK_REWARDS[LockedFeatures.CHARACTER_PURCHASES]
    },
    highlightSelectors: [
      '[data-playmode="casual"]',
      '[data-playmode="ranked"]'
    ],
  },
  [Popup.PlayToUnlockConsumables3]: {
    component: PlayOneGameNotification,
    priority: 27,
    props: {
      header: 'Unlocking all Consumables',
      text: 'Play one <span class="highlight-text">Casual</span> or <span class="highlight-text">Ranked</span> game to unlock <span class="highlight-text">all Consumables</span> in the shop and earn these rewards!',
      rewards: UNLOCK_REWARDS[LockedFeatures.CONSUMABLES_BATCH_3]
    },
    highlightSelectors: [
      '[data-playmode="casual"]',
      '[data-playmode="ranked"]'
    ],
  },
  [Popup.PlayToUnlockSpells3]: {
    component: PlayOneGameNotification,
    priority: 28,
    props: {
      header: 'Unlocking all Spells',
      text: 'Play one <span class="highlight-text">Casual</span> or <span class="highlight-text">Ranked</span> game to unlock <span class="highlight-text">all Spells</span> in the shop and earn these rewards!',
      rewards: UNLOCK_REWARDS[LockedFeatures.SPELLS_BATCH_3]
    },
    highlightSelectors: [
      '[data-playmode="casual"]',
      '[data-playmode="ranked"]'
    ],
  },
  [Popup.PlayToUnlockEquipment3]: {
    component: PlayOneGameNotification,
    priority: 29,
    props: {
      header: 'Unlocking all Equipment',
      text: 'Play one <span class="highlight-text">Casual</span> or <span class="highlight-text">Ranked</span> game to unlock <span class="highlight-text">all Equipment</span> in the shop and earn these rewards!',
      rewards: UNLOCK_REWARDS[LockedFeatures.EQUIPMENT_BATCH_3]
    },
    highlightSelectors: [
      '[data-playmode="casual"]',
      '[data-playmode="ranked"]'
    ],
  },
  [Popup.SpendSP]: {
    component: SimplePopup,
    priority: 31,
    highlightSelectors: ['[data-sp-plus="true"]'],
    props: {
      header: 'SP Available',
      text: 'You have <span class="highlight-text">SP</span> to spend! Click on the <span class="highlight-text">+</span> button next to a stat to increase it and make your character stronger!',
    }
  },
  [Popup.SwitchCharacterForSP]: {
    component: SimplePopup,
    priority: 30,
    highlightSelectors: ['[data-character-canspendsp]'],
    props: {
      text: 'One of your <span class="highlight-text">Characters</span> has SP to spend! Click on the character to switch to it!',
    }
  },
  [Popup.FeatureReveal]: {
    component: FeatureReveal,
    priority: 0, // Higher than Guest (-1) but lower than others
    props: {
      title: 'New spell: Revive!',
      description: 'The Revive spell is now available in the shop!',
      contentCategory: InventoryType.SPELLS,
      frame: 33,
      route: '/shop/spells',
    }
  },
};

interface Props {
  onPopupResolved: (popup: Popup) => void;
}

interface State {
  activePopup: Popup | null;
  queuedPopups: Set<Popup>;
}

export class PopupManager extends Component<Props, State> {
  static contextType = PlayerContext;
  declare context: React.ContextType<typeof PlayerContext>;

  state: State = {
    activePopup: null,
    queuedPopups: new Set()
  };

  componentDidUpdate(prevProps: Props, prevState: State) {
    // Always remove all highlights first
    document.querySelectorAll('.popup-highlight').forEach(element => {
      element.classList.remove('popup-highlight');
    });

    // Then add new highlights if there's an active popup
    if (this.state.activePopup) {
      this.addHighlights(this.state.activePopup);
    }
  }

  componentWillUnmount() {
    if (this.state.activePopup) {
      this.removeHighlights(this.state.activePopup);
    }
  }

  addHighlights(popup: Popup) {
    const config = POPUP_CONFIGS[popup];
    if (config.highlightSelectors) {
      // Remove any existing highlights first
      document.querySelectorAll('.popup-highlight').forEach(element => {
        element.classList.remove('popup-highlight');
      });

      config.highlightSelectors.forEach(selector => {
        if (selector === '[data-character-canequip]') {
          const character = this.context.getCharacterThatCanEquipEquipment();
          if (character) {
            selector = `[data-character-id="${character.id}"]`;
          }
        }
        if (selector === '[data-character-canlearnspell]') {
          const character = this.context.getCharacterThatCanEquipSpells();
          if (character) {
            selector = `[data-character-id="${character.id}"]`;
          }
        }
        if (selector === '[data-item-learnable]') {
          const spellId = this.context.getSpellsThatCurrentCharacterCanEquip();
          if (spellId != undefined) {
            selector = `[data-item-icon="spells-${spellId}"]`;
          }
        }
        if (selector === '[data-item-equipable]') {
          const equipmentId = this.context.getEquipmentThatCurrentCharacterCanEquip();
          if (equipmentId != undefined) {
            selector = `[data-item-icon="equipment-${equipmentId}"]`;
          }
        }
        if (selector === '[data-character-canspendsp]') {
          const character = this.context.getCharacterThatCanSpendSP();
          if (character) {
            selector = `[data-character-id="${character.id}"]`;
          }
        }

        const elements = document.querySelectorAll(selector);
        // console.log(`Found ${elements.length} elements for selector: ${selector}`);
        elements.forEach(element => {
          element.classList.add('popup-highlight');
        });
      });
    }
  }

  removeHighlights(popup: Popup) {
    if (!popup) return;
    const config = POPUP_CONFIGS[popup];
    if (config.highlightSelectors) {
      config.highlightSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          element.classList.remove('popup-highlight');
        });
      });
    }
  }

  private getDisplayedPopups(): Set<Popup> {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  }

  private markPopupDisplayed(popup: Popup) {
    const displayed = this.getDisplayedPopups();
    displayed.add(popup);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...displayed]));
  }

  handlePopupClosed = () => {
    const { activePopup, queuedPopups } = this.state;
    if (activePopup) {
      // Mark popup as displayed unless it ignores storage
      if (!POPUP_CONFIGS[activePopup].ignoreStorage) {
        this.markPopupDisplayed(activePopup);
      }
      queuedPopups.delete(activePopup);
      this.props.onPopupResolved(activePopup);
      this.setState({ queuedPopups }, this.resolvePopup);
    }
  };

  enqueuePopup = (popup: Popup) => {
    // Check if popup should be shown
    if (!POPUP_CONFIGS[popup].ignoreStorage && this.getDisplayedPopups().has(popup)) {
      return;
    }

    // console.log(`Enqueuing popup: ${popup}`);

    this.setState(prevState => ({
      queuedPopups: new Set([...prevState.queuedPopups, popup])
    }), this.resolvePopup);
  };

  resolvePopup = () => {
    const { queuedPopups } = this.state;
    if (queuedPopups.size === 0) {
      this.setState({ activePopup: null });
      return;
    }

    // Find popup with highest priority
    const nextPopup = Array.from(queuedPopups)
      .reduce((highest, current) => {
        if (!highest) return current;
        return POPUP_CONFIGS[current].priority > POPUP_CONFIGS[highest].priority ? current : highest;
      }, null as Popup | null);

    this.setState({ activePopup: nextPopup });
  };

  hidePopup = () => {
    // Remove all popup highlights from the DOM
    document.querySelectorAll('.popup-highlight').forEach(element => {
      element.classList.remove('popup-highlight');
    });
    // Clear both active popup and queue
    this.setState({ 
      activePopup: null,
      queuedPopups: new Set()
    });
  };

  render() {
    const { activePopup } = this.state;
    if (!activePopup) return null;

    const config = POPUP_CONFIGS[activePopup];
    const PopupComponent = config.component;
    return <PopupComponent 
      onHide={this.handlePopupClosed}
      {...config.props}  
    />;
  }
}

export default PopupManager; 