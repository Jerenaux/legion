import { h, Component } from 'preact';
import Welcome from './welcome/Welcome';
import { PlayOneGameNotification } from './gameNotification/PlayOneGameNotification';
import { UnlockedFeature } from './unlockedFeature/UnlockedFeature';
import { ChestReward } from "@legion/shared/interfaces";
import { LockedFeatures } from "@legion/shared/enums";
import { SimplePopup } from './simplePopup/SimplePopup';
import { UNLOCK_REWARDS } from '@legion/shared/config';

export enum Popup {
  Guest,
  PlayOneGame,
  UnlockedShop,
  BuySomething,
  GoTeamPage,
  EquipConsumable,
//   UnlockedSpells
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

interface PopupConfig {
  component: any;
  priority: number;
  highlightSelectors?: string[];  // CSS selectors for elements to highlight
  props?: UnlockedFeatureConfig | SimplePopupConfig;  // Add props for UnlockedFeature
}

const POPUP_CONFIGS: Record<Popup, PopupConfig> = {
  [Popup.Guest]: {
    component: Welcome,
    priority: -1
  },
  [Popup.PlayOneGame]: {
    component: PlayOneGameNotification,
    priority: 1,
    highlightSelectors: [
      '[data-playmode="practice"]',
      '[data-playmode="casual"]'
    ]
  },
  [Popup.UnlockedShop]: {
    component: UnlockedFeature,
    priority: 2,
    props: {
      name: 'The Shop',
      description: 'There you can spend gold to buy consumables that your characters can use in combat! Here is some gold and some potions to get you started!',
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
      text: 'Go to the <span class="highlight-text">Team Page</span> to equip consumables!',
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
//   [Popup.UnlockedSpells]: {
//     component: UnlockedFeature,
//     priority: 6,
//     props: {
//       name: 'Buying Spells',
//       description: 'You can now buy spells for your mages from the shop!',
//       rewards: [
//         { type: RewardType.SPELL, rarity: Rarity.COMMON, id: 1, frame: 1, amount: 1, name: 'Fireball' },
//       ],
//       route: '/spells'
//     }
//   }
};

interface Props {
  onPopupResolved: (popup: Popup) => void;
}

interface State {
  activePopup: Popup | null;
  queuedPopups: Set<Popup>;
}

export class PopupManager extends Component<Props, State> {
  state: State = {
    activePopup: null,
    queuedPopups: new Set()
  };

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (this.state.activePopup !== prevState.activePopup) {
      // Remove previous highlights
      if (prevState.activePopup) {
        this.removeHighlights(prevState.activePopup);
      }
      // Add new highlights
      if (this.state.activePopup) {
        this.addHighlights(this.state.activePopup);
      }
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
      config.highlightSelectors.forEach(selector => {
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

  enqueuePopup = (popup: Popup) => {
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

  handlePopupClosed = () => {
    const { activePopup, queuedPopups } = this.state;
    if (activePopup) {
      queuedPopups.delete(activePopup);
      this.props.onPopupResolved(activePopup);
      this.setState({ queuedPopups }, this.resolvePopup);
    }
  };

  hidePopup = () => {
    this.removeHighlights(this.state.activePopup);
    this.setState({ activePopup: null });
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