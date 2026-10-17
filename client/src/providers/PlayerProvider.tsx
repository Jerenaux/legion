import {t, i18n, userError} from '../i18n/core';
import {Trans} from '../i18n/Trans';
import { h } from 'preact';
import { Component, } from 'preact';
import { PlayerContextState, PlayerContext } from '../contexts/PlayerContext';
import { apiFetch } from '../services/apiService';
import { errorToast, avatarContext, silentErrorToast } from '../components/utils';
import { APICharacterData, PlayerContextData } from '@legion/shared/interfaces';
import { League, LockedFeatures
 } from "@legion/shared/enums";
import { firebaseAuth } from '../services/firebaseService';
import { playSoundEffect } from '../components/utils';
import { sfxLevel } from '../sfxMix';
import { io } from 'socket.io-client';
import { getFirebaseIdToken } from '../services/apiService';
import matchFound from "@assets/sfx/match_found.wav";
import { route } from 'preact-router';
import {createRefreshingSocketAuth, retrySocketAuthentication, socketReconnectOptions} from '../services/socketPolicy';

import {canEquipEquipment, canLearnSpell} from '@legion/shared/inventory';
import { LOCKED_FEATURES } from '@legion/shared/config';
import type { PlayerView } from './predictions';
import { isRejection, Rejection } from '@legion/shared/playerActions';

class PlayerProvider extends Component<{}, PlayerContextState> {
    private bootstrapRequest: Promise<void> | undefined;
    /** Invalidates in-flight loads on sign-out or account switch. */
    private session = 0;
    /** Player data is applied only from a request started after the one last applied. */
    private playerRequestSeq = 0;
    private playerAppliedSeq = 0;
    private bootstrapDone = false;
    private refreshQueued = false;
    private retryDelay = 0;
    private retryTimer: ReturnType<typeof setTimeout> | undefined;
    private failureNotified = false;
    private identitySaves: Partial<Record<'name' | 'avatar', {value: string; saved: string; request: Promise<void>}>> = {};
    private identityApplied: Partial<Record<'name' | 'avatar', {seq: number; value: string}>> = {};
    /** Optimistic mutations: sent one at a time, in the order the player made them. */
    private mutationTail: Promise<void> = Promise.resolve();
    private mutationsPending = 0;
    /** Bumped by a failed mutation, which cancels the predicted mutations queued behind it. */
    private mutationEpoch = 0;
    /** Ticks whenever a mutation is queued or settles; loads that overlap one are discarded. */
    private mutationClock = 0;

    constructor(props: {}) {
      super(props);
      this.state = this.getInitialState();

      // Bind the methods to ensure 'this' refers to the class instance
      this.fetchPlayerData = this.fetchPlayerData.bind(this);
      this.setPlayerInfo = this.setPlayerInfo.bind(this);
      this.fetchRosterData = this.fetchRosterData.bind(this);
      this.getCharacter = this.getCharacter.bind(this);
      this.getActiveCharacter = this.getActiveCharacter.bind(this);
      this.updateActiveCharacter = this.updateActiveCharacter.bind(this);
      this.fetchAllData = this.fetchAllData.bind(this);
      this.markShownWelcome = this.markShownWelcome.bind(this);
      this.hasEquipableEquipment = this.hasEquipableEquipment.bind(this);
      this.hasEquipableSpells = this.hasEquipableSpells.bind(this);
      this.hasEquipableEquipmentByCurrentCharacter = this.hasEquipableEquipmentByCurrentCharacter.bind(this);
      this.hasEquipableSpellsByCurrentCharacter = this.hasEquipableSpellsByCurrentCharacter.bind(this);
      this.getEquipmentThatCurrentCharacterCanEquip = this.getEquipmentThatCurrentCharacterCanEquip.bind(this);
      this.getCharacterThatCanEquipEquipment = this.getCharacterThatCanEquipEquipment.bind(this);
      this.getSpellsThatCurrentCharacterCanEquip = this.getSpellsThatCurrentCharacterCanEquip.bind(this);
      this.getCharacterThatCanEquipSpells = this.getCharacterThatCanEquipSpells.bind(this);
      this.hasCurrentCharacterSpendableSP = this.hasCurrentCharacterSpendableSP.bind(this);
      this.getCharacterThatCanSpendSP = this.getCharacterThatCanSpendSP.bind(this);
      this.hasAnyCharacterSpendableSP = this.hasAnyCharacterSpendableSP.bind(this);
      this.buyInventorySlots = this.buyInventorySlots.bind(this);
    }

    getInitialState(): PlayerContextState {
      return {
        player: {
          uid: '',
          name: '',
          avatar: '0',
          lvl: 0,
          gold: 0,
          elo: 0,
          wins: 0,
          rank: 0,
          allTimeRank: 0,
          dailyloot: null,
          league: League.BRONZE,
          isLoaded: false,
          inventory: {
            consumables: [],
            equipment: [],
            spells: [],
          },
          carrying_capacity: 0,
          engagementStats: {},
        },
        characters: [],
        activeCharacterId: '',
        characterSheetIsDirty: false,
        welcomeShown: false,
        firstMatchCompleted: false,
        lastHelp: 0,
        friends: [],
        socket: null,
        challengeModal: {
            show: false,
            challengerId: '',
            challengerName: '',
            challengerAvatar: '',
            lobbyId: '',
        },
      };
    }

    resetState = () => {
      this.session++;
      this.identitySaves = {};
      this.identityApplied = {};
      this.bootstrapRequest = undefined;
      this.bootstrapDone = false;
      this.refreshQueued = false;
      this.retryDelay = 0;
      this.failureNotified = false;
      this.mutationTail = Promise.resolve();
      this.mutationsPending = 0;
      clearTimeout(this.retryTimer);
      this.retryTimer = undefined;
      if (this.state.socket) {
        this.state.socket.disconnect();
      }
      this.setState(this.getInitialState());
    }

    componentDidMount() {
      if (firebaseAuth.currentUser) {
        this.ensureLoaded();
        this.setupSocket();
      }
    }

    componentDidUpdate() {
      const user = firebaseAuth.currentUser;
      if (!user && this.state.player.isLoaded) {
        this.resetState();
      } else if (user && !this.bootstrapDone) {
        this.ensureLoaded();
        if (!this.state.player.isLoaded) this.setupSocket();
      }
    }

    // Automatic loading: at most one request at a time, and after a failure only the
    // scheduled retry runs, so state updates during an outage cannot cause a request storm.
    ensureLoaded() {
      if (this.bootstrapRequest || this.retryTimer || this.bootstrapDone) return;
      void this.startBootstrap();
    }

    componentWillUnmount(): void {
      clearTimeout(this.retryTimer);
      this.resetState();
      if (this.state.socket) {
        this.state.socket.disconnect();
      }
    }

    // Explicit refresh (after rewards, purchases, matches). A refresh requested while a load is
    // in flight runs again afterwards, so callers always end up with data fetched after their change.
    fetchAllData(): Promise<void> {
      if (!firebaseAuth.currentUser) return Promise.resolve();
      if (this.bootstrapRequest) {
        this.refreshQueued = true;
        return this.bootstrapRequest.then(() => (this.refreshQueued ? this.fetchAllData() : undefined));
      }
      clearTimeout(this.retryTimer);
      this.retryTimer = undefined;
      return this.startBootstrap();
    }

    private startBootstrap(): Promise<void> {
      const user = firebaseAuth.currentUser;
      if (!user) return Promise.resolve();
      this.refreshQueued = false;
      const session = this.session;
      const request = this.loadBootstrap(user.uid, session).finally(() => {
        if (this.bootstrapRequest === request) this.bootstrapRequest = undefined;
      });
      this.bootstrapRequest = request;
      void this.fetchFriends();
      return request;
    }

    private async loadBootstrap(uid: string, session: number) {
      const seq = ++this.playerRequestSeq;
      const clock = this.mutationClock;
      const current = () => session === this.session && firebaseAuth.currentUser?.uid === uid;
      try {
        let data: {player: PlayerContextData; characters: APICharacterData[]};
        try {
          data = await apiFetch('bootstrapPlayer', {}, 3);
        } catch (error) {
          // Any bootstrap failure falls back to the long-standing endpoints: being able to play
          // matters more than saving a round trip.
          console.warn('bootstrapPlayer failed; using legacy player endpoints', error);
          const [player, roster] = await Promise.all([apiFetch('getPlayerData', {}, 3), apiFetch('rosterData', {}, 3)]);
          data = {player, characters: roster.characters};
        }
        if (!current()) return;
        this.bootstrapDone = true;
        this.retryDelay = 0;
        this.failureNotified = false;
        // Predicted changes still pending would be overwritten; the refresh after them resyncs.
        if (!this.mutationsSettledSince(clock)) return;
        // Keep player data that a newer refresh already applied; the roster is still needed.
        if (seq > this.playerAppliedSeq) {
          this.playerAppliedSeq = seq;
          this.setState({player: {...data.player, ...this.pendingIdentity(seq), uid, isLoaded: true}, characters: data.characters});
        } else {
          this.setState({characters: data.characters});
        }
      } catch (error) {
        if (!current()) return;
        if (!this.failureNotified) {
          this.failureNotified = true;
          errorToast(userError(error));
        }
        this.retryDelay = Math.min(30_000, this.retryDelay ? this.retryDelay * 2 : 1_000);
        clearTimeout(this.retryTimer);
        this.retryTimer = setTimeout(() => {
          this.retryTimer = undefined;
          if (current() && !this.bootstrapDone) this.ensureLoaded();
        }, this.retryDelay);
      }
    }

    async fetchPlayerData() {
      const user = firebaseAuth.currentUser;
      if (!user) return;
      const session = this.session;
      const seq = ++this.playerRequestSeq;
      const clock = this.mutationClock;

      try {
          const data = await apiFetch('getPlayerData', {}, 3) as PlayerContextData;
          // Ignore if signed out, if a newer player load already landed, or if it would undo predicted changes.
          if (session !== this.session || seq <= this.playerAppliedSeq || firebaseAuth.currentUser?.uid !== user.uid) return;
          if (!this.mutationsSettledSince(clock)) return;
          this.playerAppliedSeq = seq;
          this.setState({
              player: {
                  uid: user.uid,
                  name: data.name,
                  avatar: data.avatar,
                  lvl: data.lvl,
                  gold: data.gold,
                  elo: data.elo,
                  wins: data.wins,
                  rank: data.rank,
                  allTimeRank: data.allTimeRank,
                  dailyloot: data.dailyloot,
                  league: data.league,
                  isLoaded: true,
                  inventory: data.inventory,
                  carrying_capacity: data.carrying_capacity,
                  engagementStats: data.engagementStats || {},
                  community: data.community ?? null,
                  firstWinBonusGold: data.firstWinBonusGold || 0,
                  ...this.pendingIdentity(seq),
              }
          });
      } catch (error) {
          if (session !== this.session || firebaseAuth.currentUser?.uid !== user.uid) return;
          errorToast(userError(error));
      }
    }

    async fetchRosterData() {
      const clock = this.mutationClock;
      try {
        const data = await apiFetch('rosterData', {}, 3);
        if (!this.mutationsSettledSince(clock)) return;
        this.setState({
          characters: data.characters
        });
      } catch (error) {
        console.error('Error fetching roster data:', error);
        // errorToast(`Error: ${error}`);
      }
    }

    /** True when no optimistic mutation was pending, queued or settled since `clock` was read. */
    private mutationsSettledSince(clock: number) {
      return this.mutationsPending === 0 && clock === this.mutationClock;
    }

    /**
     * Shows the predicted outcome of an action at once, then sends it to the server after every
     * earlier one, so each request reaches the state its prediction was made from. A failure shows
     * an error and cancels the predictions queued behind it; once the queue drains, a refresh
     * replaces the predictions with server data. When the shared rules reject the action, shows the
     * reason and returns null without sending anything; otherwise resolves to whether the server applied it.
     */
    optimisticMutation = (predict: (view: PlayerView) => PlayerView | Rejection, send: () => Promise<unknown>): Promise<boolean> | null => {
      const prediction = predict(this.state);
      if (isRejection(prediction)) {
        silentErrorToast(userError(prediction.error));
        return null;
      }
      this.setState(prev => {
        const next = predict(prev);
        return isRejection(next) ? null : {...next, characterSheetIsDirty: true};
      });
      const session = this.session;
      const epoch = this.mutationEpoch;
      this.mutationsPending++;
      this.mutationClock++;
      const outcome = this.mutationTail.then(async () => {
        if (session !== this.session || epoch !== this.mutationEpoch) return false;
        try {
          await send();
          return true;
        } catch (error) {
          if (session === this.session && epoch === this.mutationEpoch) {
            this.mutationEpoch++;
            silentErrorToast(userError(error));
          }
          return false;
        }
      });
      this.mutationTail = outcome.then(() => {
        if (session !== this.session) return;
        this.mutationClock++;
        if (--this.mutationsPending === 0) void this.fetchAllData();
      });
      return outcome;
    }

    updateActiveCharacter = (characterId: string): void => {
      this.setState({
        activeCharacterId: characterId,
        characterSheetIsDirty: true
      });
    }



    getCharacter = (characterId: string): APICharacterData | undefined => {
      return this.state.characters.find(char => char.id === characterId);
    }

    getActiveCharacter = (): APICharacterData | undefined => {
      return this.getCharacter(this.state.activeCharacterId) || this.state.characters[0];
    }

    setPlayerInfo = (updates: Partial<PlayerContextData>) => {
      this.setState(({ player }) => ({
        player: { ...player, ...updates,
          engagementStats: {...player.engagementStats, ...updates.engagementStats}
        }
      }));
    }

    private pendingIdentity(seq: number) {
      return Object.fromEntries([
        ...Object.entries(this.identityApplied).filter(([, applied]) => seq <= applied.seq).map(([field, applied]) => [field, applied.value]),
        ...Object.entries(this.identitySaves).map(([field, save]) => [field, save.value]),
      ]);
    }

    updateIdentity = (updates: Partial<Pick<PlayerContextData, 'name' | 'avatar'>>) => {
      const session = this.session;
      const uid = this.state.player.uid;
      const current = () => session === this.session && firebaseAuth.currentUser?.uid === uid;
      for (const field of ['name', 'avatar'] as const) {
        const value = updates[field];
        if (value === undefined) continue;
        const save = this.identitySaves[field] ?? {
          value, saved: this.state.player[field], request: Promise.resolve(),
        };
        save.value = value;
        this.identitySaves[field] = save;
        // Serialize edits of each field so an older request cannot overwrite a newer one.
        const request = save.request.then(async () => {
          if (!current()) return;
          try {
            await apiFetch(field === 'name' ? 'updatePlayerName' : 'updatePlayerAvatar', {
              method: 'POST', body: field === 'name' ? {name: value} : {avatarId: value},
            });
            save.saved = value;
          } catch (error) {
            if (current() && save.request === request) errorToast(userError(error));
          } finally {
            if (current() && save.request === request) {
              delete this.identitySaves[field];
              // Older snapshots may still apply rewards, but cannot undo the saved identity.
              this.identityApplied[field] = {seq: this.playerRequestSeq, value: save.saved};
              this.setPlayerInfo({[field]: save.saved});
            }
          }
        });
        save.request = request;
      }
      this.setPlayerInfo(updates);
    }

    markShownWelcome = () => {
      this.setState({ welcomeShown: true });
    }

    addFriend = async (friendId: string) => {
        try {
            await apiFetch('addFriend', {
                method: 'POST',
                body: { friendId }
            });

            // Refresh friends list after adding
            await this.fetchFriends();
        } catch (error) {
            console.error('Error adding friend:', error);
            throw error;
        }
    };

    fetchFriends = async () => {
      const user = firebaseAuth.currentUser;
      if (!user) return;
      try {
          // console.log(`Fetching friends for ${user.uid}`);
          const friends = await apiFetch(
            `listFriends?playerId=${user.uid}`,
            {},
            3
          );
          this.setState({ friends });
      } catch (error) {
          console.warn('Error fetching friends:', error);
      }
    };

    setupSocket = async () => {
      const user = firebaseAuth.currentUser;
      if (!user || this.state.socket) return;

      // console.log(`Connecting to ${process.env.MATCHMAKER_URL} ...`);

      const socket = io(process.env.MATCHMAKER_URL, {
        auth: createRefreshingSocketAuth(() => getFirebaseIdToken()),
        ...socketReconnectOptions,
      });

      socket.on('connect', () => {
        // console.log('Connected to matchmaker');
      });

      socket.on('disconnect', (reason) => {
        console.log(`Disconnected from matchmaker: ${reason}`);

      });

      socket.on('connect_error', (error) => {
        if (retrySocketAuthentication(socket, error, getFirebaseIdToken, () => this.state.socket === socket && Boolean(firebaseAuth.currentUser))) return;
        console.error('Connection error:', error);
        // errorToast('Connection error, attempting to reconnect...');

      });

      socket.on('error', (e) => {
        errorToast(userError(e));
      });

      socket.on('gameError', (data: { message: string }) => {
        console.error(data.message);
      });

      socket.on('challengeReceived', (data: {
        challengerId: string,
        challengerName: string,
        challengerAvatar: string,
        lobbyId: string
    }) => {
          // Show the challenge modal with the received data
          this.setState({
              challengeModal: {
                  show: true,
                  challengerId: data.challengerId,
                  challengerName: data.challengerName,
                  challengerAvatar: data.challengerAvatar,
                  lobbyId: data.lobbyId
              }
          });

          // Play sound effect
          playSoundEffect(matchFound, sfxLevel('matchFound'));
      });

      socket.on('challengeDeclined', (data: { playerName: string }) => {
          console.log(`[matchmaker:challengeDeclined] Challenge was declined`);
          let playerName = data?.playerName;
          if (!playerName) {
            playerName = t("another player");
          }
          silentErrorToast(t("Your challenge to {{value0}} was declined!", {value0: playerName}));
          route('/profile');
      });

      socket.on('challengeCancelled', (data?: { challengerName: string }) => {
        // Hide the challenge modal if it's showing
        if (this.state.challengeModal.show) {
            this.setState({
                challengeModal: {
                    ...this.state.challengeModal,
                    show: false
                }
            });
            silentErrorToast(t("The challenge from {{value0}} was cancelled", {value0: data?.challengerName || t("Player")}));
        }
      });

        this.setState({ socket });
    }

    handleChallengeAccept = () => {
        const { lobbyId } = this.state.challengeModal;

        // Close modal and redirect
        this.setState({ challengeModal: { ...this.state.challengeModal, show: false } });
        route(`/lobby/${lobbyId}`);
    };

    handleChallengeDecline = () => {
        const { socket } = this.state;
        const { challengerId, lobbyId } = this.state.challengeModal;

        if (socket) {
            socket.emit('challengeDeclined', {
                challengerId,
                lobbyId
            });
        }

        this.setState({ challengeModal: { ...this.state.challengeModal, show: false } });
    };

    canAccessFeature = (feature: LockedFeatures) => {
      return this.getCompletedGames() >= LOCKED_FEATURES[feature];
    }

    getCompletedGames = (): number => {
      // -1 to account for game 0, and clamp at 0 so that players who skip it are on the same footing
      return Math.max(0, (this.state.player.engagementStats?.completedGames || 0) - 1);
    }

    checkEngagementFlag = (flag: string): boolean => {
      if (!this.state.player.engagementStats) {
        return false;
      }
      return this.state.player.engagementStats[flag] || false;
    }

    getCharacterThatCanSpendSP = (): APICharacterData | undefined => {
      return this.state.characters.find(character => character.sp > 0);
    }

    hasAnyCharacterSpendableSP = (): boolean => {
      return this.state.characters.some(character => character.sp > 0);
    }

    hasCurrentCharacterSpendableSP = (): boolean => {
      return this.getActiveCharacter()?.sp > 0;
    }

    hasConsumable = (): boolean => {
      return this.state.player.inventory.consumables.length > 0;
    }

    hasEquipableEquipment = (): boolean => {
      return this.state.characters.some(character =>
        this.state.player.inventory.equipment.some(equipment => canEquipEquipment(character, equipment))
      );
    }

    hasEquipableEquipmentByCurrentCharacter = (): boolean => {
      return this.state.player.inventory.equipment.some(equipment => canEquipEquipment(this.getActiveCharacter(), equipment));
    }

    hasEquipableSpellsByCurrentCharacter = (): boolean => {
      return this.state.player.inventory.spells.some(spell => canLearnSpell(this.getActiveCharacter(), spell));
    }

    hasEquipableSpells = (): boolean => {
      return this.state.characters.some(character =>
        this.state.player.inventory.spells.some(spell => canLearnSpell(character, spell))
      );
    }

    hasEquipment = (): boolean => {
      return this.state.player.inventory.equipment.length > 0;
    }

    hasSpells = (): boolean => {
      return this.state.player.inventory.spells.length > 0;
    }

    getEquipmentThatCurrentCharacterCanEquip = (): number => {
      return this.state.player.inventory.equipment.find(equipment => canEquipEquipment(this.getActiveCharacter(), equipment));
    }

    getCharacterThatCanEquipEquipment = (): APICharacterData => {
      return this.state.characters.find(character =>
        this.state.player.inventory.equipment.some(equipment => canEquipEquipment(character, equipment))
      );
    }

    getSpellsThatCurrentCharacterCanEquip = (): number => {
      return this.state.player.inventory.spells.find(spell => canLearnSpell(this.getActiveCharacter(), spell));
    }

    getCharacterThatCanEquipSpells = (): APICharacterData => {
      return this.state.characters.find(character =>
        this.state.player.inventory.spells.some(spell => canLearnSpell(character, spell))
      );
    }

    getGamesUntilFeature = (feature: LockedFeatures): number => {
        const completedGames = this.getCompletedGames();
        const requiredGames = LOCKED_FEATURES[feature];
        return Math.max(0, requiredGames - completedGames);
    }

    notifyLeaveGame = (gameId: string) => {
      if (this.state.socket) {
        this.state.socket.emit('leaveGame', { gameId });
      }
    }

    buyInventorySlots = async (slots: number) => {
      try {
        await apiFetch('buyInventorySlots', {
            method: 'POST',
            body: { slots },
        });
        this.fetchPlayerData();
      } catch (error) {
          console.error('Error buying inventory slots:', error);
          throw error;
      }
    };

    render() {
      const { children } = this.props;

      return (
        <PlayerContext.Provider value={{
          player: this.state.player,
          characters: this.state.characters,
          activeCharacterId: this.state.activeCharacterId,
          characterSheetIsDirty: this.state.characterSheetIsDirty,
          welcomeShown: this.state.welcomeShown,
          firstMatchCompleted: this.state.firstMatchCompleted,
          markFirstMatchCompleted: () => this.setState({firstMatchCompleted: true}),
          loaded: this.state.player.isLoaded,
          setPlayerInfo: this.setPlayerInfo,
          updateIdentity: this.updateIdentity,
          refreshPlayerData: this.fetchPlayerData,
          refreshAllData: this.fetchAllData,
          fetchRosterData: this.fetchRosterData,
          getCharacter: this.getCharacter,
          getActiveCharacter: this.getActiveCharacter,
          updateActiveCharacter: this.updateActiveCharacter,
          markWelcomeShown: this.markShownWelcome,
          resetState: this.resetState,
          friends: this.state.friends,
          addFriend: this.addFriend,
          refreshFriends: this.fetchFriends,
          socket: this.state.socket,
          challengeModal: this.state.challengeModal,
          handleChallengeAccept: this.handleChallengeAccept,
          handleChallengeDecline: this.handleChallengeDecline,
          canAccessFeature: this.canAccessFeature,
          getGamesUntilFeature: this.getGamesUntilFeature,
          getCompletedGames: this.getCompletedGames,
          checkEngagementFlag: this.checkEngagementFlag,
          hasConsumable: this.hasConsumable,
          hasEquipableEquipment: this.hasEquipableEquipment,
          getEquipmentThatCurrentCharacterCanEquip: this.getEquipmentThatCurrentCharacterCanEquip,
          getCharacterThatCanEquipEquipment: this.getCharacterThatCanEquipEquipment,
          hasEquipableSpells: this.hasEquipableSpells,
          hasEquipableEquipmentByCurrentCharacter: this.hasEquipableEquipmentByCurrentCharacter,
          hasEquipableSpellsByCurrentCharacter: this.hasEquipableSpellsByCurrentCharacter,
          getSpellsThatCurrentCharacterCanEquip: this.getSpellsThatCurrentCharacterCanEquip,
          getCharacterThatCanEquipSpells: this.getCharacterThatCanEquipSpells,
          hasAnyCharacterSpendableSP: this.hasAnyCharacterSpendableSP,
          hasCurrentCharacterSpendableSP: this.hasCurrentCharacterSpendableSP,
          notifyLeaveGame: this.notifyLeaveGame,
          getCharacterThatCanSpendSP: this.getCharacterThatCanSpendSP,
          buyInventorySlots: this.buyInventorySlots,
          optimisticMutation: this.optimisticMutation,
        }}>
          {children}

          {/* Challenge Response Modal */}
          {this.state.challengeModal.show && (
              <div className="modal-overlay">
                  <div className="modal challenge-modal">
                      <div
                          className="challenger-avatar"
                          style={{
                              backgroundImage: `url(${avatarContext(
                                  `./${this.state.challengeModal.challengerAvatar}.png`
                              )})`
                          }}
                      />
                      <h3>{t("Duel")}</h3>
                      <div className="challenge-description">
                          <p><Trans i18n={i18n} i18nKey={"<0>{{value0}}</0> has challenged you to a duel!"} components={[<span className="highlight-name" />]} values={{value0: this.state.challengeModal.challengerName}} /></p>
                      </div>
                      <div className="modal-footer">
                          <button type="button"
                              onClick={this.handleChallengeDecline}
                              className="cancel-btn"
                          >{t("Decline")}</button>
                          <button type="button"
                              onClick={this.handleChallengeAccept}
                              className="confirm-btn"
                          >{t("Accept")}</button>
                      </div>
                  </div>
              </div>
          )}
        </PlayerContext.Provider>
      );
    }
  }

  export default PlayerProvider;
