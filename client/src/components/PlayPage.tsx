import {t} from '../i18n/core';
import { shouldShowPageIntro } from './pageIntro/PageIntro';
import { PlayIntro } from './pageIntro/intros';
import IdentityIntro from './pageIntro/IdentityIntro';
import { h } from 'preact';
// PlayPage.tsx
import { Component, createRef } from 'preact';
import Roster from './roster/Roster';
import PlayModes from './playModes/PlayModes';
import OnGoingArena from './onGoingArena/OnGoingArena';
import DailyQuest from './dailyQuest/DailyQuest';
import DailyLoot from './dailyLoot/DailyLoot';
import Ghost from './ghost/Ghost';
import { PlayerContext } from '../contexts/PlayerContext';
import { ENABLE_QUESTS, ENABLE_SPECTATOR_MODE } from "@legion/shared/config";
import { firebaseAuth } from '../services/firebaseService';
import PopupManager, { Popup } from './popups/PopupManager';
import { LockedFeatures } from "@legion/shared/enums";
/* eslint-disable react/prefer-stateless-function */
class PlayPage extends Component {
  static contextType = PlayerContext;

  state = {
    showWelcome: false,
    introClosed: false,
    identityClosed: false,
  };

  // After the tutorial match, one dialog at a time: the player's generated name and
  // portrait, then how matches work, then any unlock popup.
  afterFirstMatch() {
    return this.context.player.isLoaded && this.context.getCompletedGames() >= 1;
  }

  identityOpen() {
    return !this.state.identityClosed && this.afterFirstMatch() && shouldShowPageIntro('identity', this.context.player.uid);
  }

  introOpen() {
    return !this.state.introClosed && this.afterFirstMatch() && shouldShowPageIntro('play', this.context.player.uid);
  }

  popupManagerRef = createRef();

  componentDidMount() {
    const user = firebaseAuth.currentUser;

    if (user?.isAnonymous && !this.context.welcomeShown && this.context.player.isLoaded) {
      this.popupManagerRef.current?.enqueuePopup(Popup.Guest);
    }
  }

  enqueuePopup = (popup: Popup) => {
    this.popupManagerRef.current?.enqueuePopup(popup);
  }

  componentDidUpdate() {
    if (!this.context.player.isLoaded) return;

    const completedGames = this.context.getCompletedGames();

    switch(completedGames) {
      case 0:
        this.enqueuePopup(Popup.PlayToUnlockShop);
        break;
      case 1:
        this.enqueuePopup(Popup.UnlockedShop);
        this.enqueuePopup(Popup.PlayToUnlockSpells);
        break;
      case 2:
        this.enqueuePopup(Popup.UnlockedSpells);
        this.enqueuePopup(Popup.PlayToUnlockEquipment);
        break;
      case 3:
        this.enqueuePopup(Popup.UnlockedEquipment);
        this.enqueuePopup(Popup.PlayToUnlockRanked);
        break;
      case 4:
        this.enqueuePopup(Popup.UnlockedRanked);
        this.enqueuePopup(Popup.PlayToUnlockConsumables2);
        break;
      case 5:
        this.enqueuePopup(Popup.UnlockedConsumables2);
        this.enqueuePopup(Popup.PlayToUnlockSpells2);
        break;
      case 6:
        this.enqueuePopup(Popup.UnlockedSpells2);
        this.enqueuePopup(Popup.PlayToUnlockEquipment2);
        break;
      case 7:
        this.enqueuePopup(Popup.UnlockedEquipment2);
        this.enqueuePopup(Popup.PlayToUnlockDailyLoot);
        break;
      case 8:
        this.enqueuePopup(Popup.UnlockedDailyLoot);
        this.enqueuePopup(Popup.PlayToUnlockEquipment3);
        break;
      case 9:
        this.enqueuePopup(Popup.UnlockedEquipment3);
        this.enqueuePopup(Popup.PlayToUnlockConsumables3);
        break;
      case 10:
        this.enqueuePopup(Popup.UnlockedConsumables3);
        this.enqueuePopup(Popup.PlayToUnlockSpells3);
        break;
      case 11:
        this.enqueuePopup(Popup.UnlockedSpells3);
        this.enqueuePopup(Popup.PlayToUnlockCharacters);
        break;
      case 12:
        this.enqueuePopup(Popup.UnlockedCharacters);
        break;
    }
  }

  handlePopupResolved = (popup: Popup) => {
    if (popup === Popup.Guest) {
      this.context.markWelcomeShown();
    }
  };

  render() {
    const data = {
      dailyQuests: [
        {
          name: t("Use 5 fire spells"),
          rewards: { gold: 500, xp: 2000 },
          completion: 0.8
        },
        {
          name: t("Win 3 games"),
          rewards: { gold: 700, xp: 1000 },
          completion: 1 // = completed
        },
        {
          name: t("Use 5 fire spells"),
          rewards: { gold: 500, xp: 2000 },
          completion: 0.8
        },
      ],
      ongoingGames: [
        {
          teamA: {
            name: "TeamA",
            teamSize: 6,
            aliveCharacters: 3,
          },
          teamB: {
            name: "TeamB",
            teamSize: 6,
            aliveCharacters: 5,
          },
          spectators: 5,
          duration: 412, // seconds
        },
        {
          teamA: {
            name: "TeamA",
            teamSize: 6,
            aliveCharacters: 3,
          },
          teamB: {
            name: "TeamB",
            teamSize: 6,
            aliveCharacters: 5,
          },
          spectators: 5,
          duration: 328, // seconds
        },
        {
          teamA: {
            name: "TeamA",
            teamSize: 6,
            aliveCharacters: 3,
          },
          teamB: {
            name: "TeamB",
            teamSize: 6,
            aliveCharacters: 5,
          },
          spectators: 5,
          duration: 621, // seconds
        }
      ]
    }

    return (
      <div className="play-content">
        {this.identityOpen()
          ? <IdentityIntro onClose={() => this.setState({identityClosed: true})} />
          : this.introOpen()
          ? <PlayIntro uid={this.context.player.uid} onClose={() => this.setState({introClosed: true})} />
          : <PopupManager
              ref={this.popupManagerRef}
              onPopupResolved={this.handlePopupResolved}
            />}
        <Roster/>
        {data ? <PlayModes /> : <Ghost height={280} count={4} className="ghost-row" width="13rem" />}
        {this.context.canAccessFeature(LockedFeatures.DAILY_LOOT) && <DailyLoot data={this.context.player.dailyloot} />}
        {ENABLE_QUESTS && <DailyQuest questData={data.dailyQuests} />}
        {ENABLE_SPECTATOR_MODE && <OnGoingArena ongoingGameData={data.ongoingGames} />}
      </div>
    );
  }
}

export default PlayPage;