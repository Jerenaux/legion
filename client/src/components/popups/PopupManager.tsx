import { h, Component } from 'preact';
import Welcome from './welcome/Welcome';
import { PlayOneGameNotification } from './gameNotification/PlayOneGameNotification';
import { UnlockedFeature } from './unlockedFeature/UnlockedFeature';
import { ChestReward, RewardType } from "@legion/shared/chests";
import { Rarity } from '@legion/shared/enums';
import { BuySomething } from './buySomething/buySomething';
import { SimplePopup } from './simplePopup/SimplePopup';

export enum Popup {
  Guest = 'GUEST',
  PlayOneGame = 'PLAY_ONE_GAME',
  UnlockedShop = 'UNLOCKED_SHOP',
  BuySomething = 'BUY_SOMETHING',
  GoTeamPage = 'GO_TEAM_PAGE'
}

interface UnlockedFeatureConfig {
  name: string;
  description: string;
  rewards: ChestReward[];
  route?: string;
}

interface SimplePopupConfig {
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
      rewards: [
        { type: RewardType.CONSUMABLES, rarity: Rarity.COMMON, id: 1, frame: 1, amount: 5, name: 'Potion' },
        { type: RewardType.GOLD, amount: 100, name: 'Gold', rarity: Rarity.COMMON, id: 1, frame: 1 },
      ],
      route: '/shop'
    }
  },
  [Popup.BuySomething]: {
    component: BuySomething,
    priority: 3,
    highlightSelectors: ['[data-shop-item="consumable-0"]']
  },
  [Popup.GoTeamPage]: {
    component: SimplePopup,
    priority: 4,
    highlightSelectors: ['[data-team-page]'],
    props: {
      text: 'Go to the Team Page to equip consumables!',
    }
  }
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