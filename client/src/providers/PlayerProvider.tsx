import {t, i18n, userError} from '../i18n/core';
import {Trans} from '../i18n/Trans';
import { h } from 'preact';
import { Component, } from 'preact';
import { PlayerContextState, PlayerContext } from '../contexts/PlayerContext';
import { apiFetch } from '../services/apiService';
import { errorToast, avatarContext, silentErrorToast } from '../components/utils';
import { APICharacterData, PlayerContextData, PlayerInventory } from '@legion/shared/interfaces';
import { League, Stat, StatFields, InventoryActionType, ShopTab, ItemDialogType, LockedFeatures
 } from "@legion/shared/enums";
import { firebaseAuth } from '../services/firebaseService';
import { getSPIncrement } from '@legion/shared/levelling';
import { playSoundEffect } from '../components/utils';
import { io } from 'socket.io-client';
import { getFirebaseIdToken } from '../services/apiService';
import matchFound from "@assets/sfx/match_found.wav";
import { route } from 'preact-router';
import {createRefreshingSocketAuth, retrySocketAuthentication, socketReconnectOptions} from '../services/socketPolicy';

import {
  canEquipConsumable,
  canLearnSpell,
  canEquipEquipment,
  equipConsumable,
  unequipConsumable,
  learnSpell,
  equipEquipment,
  unequipEquipment,
  roomInInventory,
  numericalSort,
} from '@legion/shared/inventory';

import equipSfx from "@assets/sfx/equip.wav";
import { getConsumableById } from "@legion/shared/Items";
import { getSpellById } from "@legion/shared/Spells";
import { getEquipmentById } from "@legion/shared/Equipments";
import { LOCKED_FEATURES } from '@legion/shared/config';

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

    constructor(props: {}) {
      super(props);
      this.state = this.getInitialState();

      // Bind the methods to ensure 'this' refers to the class instance
      this.fetchPlayerData = this.fetchPlayerData.bind(this);
      this.setPlayerInfo = this.setPlayerInfo.bind(this);
      this.fetchRosterData = this.fetchRosterData.bind(this);
      this.updateCharacterStats = this.updateCharacterStats.bind(this);
      this.getCharacter = this.getCharacter.bind(this);
      this.getActiveCharacter = this.getActiveCharacter.bind(this);
      this.updateInventory = this.updateInventory.bind(this);
      this.applyPurchase = this.applyPurchase.bind(this);
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
      this.bootstrapRequest = undefined;
      this.bootstrapDone = false;
      this.refreshQueued = false;
      this.retryDelay = 0;
      this.failureNotified = false;
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
        // Keep player data that a newer refresh already applied; the roster is still needed.
        if (seq > this.playerAppliedSeq) {
          this.playerAppliedSeq = seq;
          this.setState({player: {...data.player, uid, isLoaded: true}, characters: data.characters});
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

      try {
          const data = await apiFetch('getPlayerData', {}, 3) as PlayerContextData;
          // Ignore if signed out, or if a newer player load already landed.
          if (session !== this.session || seq <= this.playerAppliedSeq || firebaseAuth.currentUser?.uid !== user.uid) return;
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
              }
          });
      } catch (error) {
          if (session !== this.session || firebaseAuth.currentUser?.uid !== user.uid) return;
          errorToast(userError(error));
      }
    }

    async fetchRosterData() {
      try {
        const data = await apiFetch('rosterData', {}, 3);
        this.setState({
          characters: data.characters
        });
      } catch (error) {
        console.error('Error fetching roster data:', error);
        // errorToast(`Error: ${error}`);
      }
    }

    updateActiveCharacter = (characterId: string): void => {
      this.setState({
        activeCharacterId: characterId,
        characterSheetIsDirty: true
      });
    }

    updateCharacterStats = (characterId: string, stat: Stat, amount: number): void => {
      this.setState((prevState) => {
        const updatedCharacters = prevState.characters.map((character) => {
          if (character.id === characterId) {
            const newStats = { ...character.stats };
            newStats[StatFields[stat]] += getSPIncrement(stat) * amount;
            return {
              ...character,
              stats: newStats,
              sp: character.sp - amount,
            };
          }
          return character;
        });

        return {
            characterSheetIsDirty: true,
            characters: updatedCharacters,
            player: {
              ...prevState.player,
              engagementStats: {
                ...prevState.player.engagementStats,
                everSpentSP: true
              }
            }
          };
      });
    }

    updateInventory(type: ItemDialogType, action: InventoryActionType, index: number) {
      this.setState((prevState) => {
        const activeCharacter = prevState.characters.find(character => character.id === prevState.activeCharacterId) || prevState.characters[0];
        if (!activeCharacter) {
          errorToast(t("No active character selected!"));
          return prevState;
        }

        // Shared inventory helpers mutate their inputs. Work on detached copies
        // so queued updates and failed operations cannot corrupt existing state.
        const newState = { ...prevState, player: {...prevState.player, inventory: structuredClone(prevState.player.inventory)} };
        const updatedInventory = newState.player.inventory;
        const updatedCharacter = structuredClone(activeCharacter);

        let result = null;

        // Handle sell action
        if (action === InventoryActionType.SELL) {
          let itemPrice = 0;
          let inventoryField: keyof PlayerInventory;

          switch(type) {
            case ItemDialogType.CONSUMABLES:
              itemPrice = (getConsumableById(updatedInventory.consumables[index])?.price || 0) / 2;
              inventoryField = 'consumables';
              break;
            case ItemDialogType.EQUIPMENTS:
              itemPrice = (getEquipmentById(updatedInventory.equipment[index])?.price || 0) / 2;
              inventoryField = 'equipment';
              break;
            case ItemDialogType.SPELLS:
              itemPrice = (getSpellById(updatedInventory.spells[index])?.price || 0) / 2;
              inventoryField = 'spells';
              break;
            default:
              return prevState;
          }

          const updatedItems = [...updatedInventory[inventoryField]];
          updatedItems.splice(index, 1);

          return {
            ...newState,
            player: {
              ...newState.player,
              gold: newState.player.gold + itemPrice,
              inventory: {
                ...updatedInventory,
                [inventoryField]: updatedItems
              }
            }
          };
        }
        // ### END OF SELL ACTION ###

        switch(type) {
          case ItemDialogType.CONSUMABLES:
            if (action === InventoryActionType.EQUIP) {
              if (!canEquipConsumable(updatedCharacter)) {
                errorToast(t("Character inventory is full!"));
                return prevState;
              }
              result = equipConsumable(newState.player, updatedCharacter, index);
            } else {
              if (!roomInInventory(newState.player)) {
                errorToast(t("Player inventory is full!"));
                return prevState;
              }
              result = unequipConsumable(newState.player, updatedCharacter, index);
            }
            break;
          case ItemDialogType.EQUIPMENTS:
            if (action === InventoryActionType.EQUIP) {
              if (!canEquipEquipment(updatedCharacter, updatedInventory.equipment[index])) {
                errorToast(t("Cannot equip this item!"));
                return prevState;
              }
              result = equipEquipment(newState.player, updatedCharacter, index);
            } else {
              if (!roomInInventory(newState.player)) {
                errorToast(t("Player inventory is full!"));
                return prevState;
              }
              result = unequipEquipment(newState.player, updatedCharacter, index);
            }
            break;
          case ItemDialogType.SPELLS:
            if (action === InventoryActionType.EQUIP) {
              if (!canLearnSpell(updatedCharacter, updatedInventory.spells[index])) {
                errorToast(t("Cannot learn this spell!"));
                return prevState;
              }
              result = learnSpell(newState.player, updatedCharacter, index);
            }
            break;
        }

        if (!result) {
          return prevState;
        }

        playSoundEffect(equipSfx);

        // Update the character in the characters array
        const updatedCharacters = newState.characters.map(char =>
          char.id === updatedCharacter.id ? { ...updatedCharacter, ...result.characterUpdate } : char
        );

        return {
          ...newState,
          characters: updatedCharacters,
          characterSheetIsDirty: true,
          player: {
            ...newState.player,
            ...result.playerUpdate,
            engagementStats: {
              ...newState.player.engagementStats,
              ...result.playerUpdate.engagementStats,
            }
          }
        };
      });
    }

    applyPurchase(articleId: number, price: number, quantity: number, shoptab: ShopTab) {
      if (shoptab === ShopTab.CHARACTERS) {
        // For character purchases, update gold and fetch roster data
        this.setState(
          prevState => ({
            player: {
              ...prevState.player,
              gold: prevState.player.gold - price * quantity
            }
          }),
          () => {
            this.fetchRosterData();
          }
        );
        return;
      }

      const { inventory } = this.state.player;
      let inventoryField: keyof PlayerInventory;

      switch (shoptab) {
        case ShopTab.CONSUMABLES:
          inventoryField = 'consumables';
          break;
        case ShopTab.EQUIPMENTS:
          inventoryField = 'equipment';
          break;
        case ShopTab.SPELLS:
          inventoryField = 'spells';
          break;
        default:
          return;
      }

      const updatedInventoryField = [...inventory[inventoryField]];
      for (let i = 0; i < quantity; i++) {
        updatedInventoryField.push(articleId);
      }

      this.setState({
        player: {
          ...this.state.player,
          gold: this.state.player.gold - price * quantity,
          inventory: {
            ...inventory,
            [inventoryField]: updatedInventoryField.sort(numericalSort)
          },
          engagementStats: {
            ...this.state.player.engagementStats,
            everPurchased: true
          }
        }
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
          playSoundEffect(matchFound, 0.5);
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
          loaded: this.state.player.isLoaded,
          setPlayerInfo: this.setPlayerInfo,
          refreshPlayerData: this.fetchPlayerData,
          refreshAllData: this.fetchAllData,
          fetchRosterData: this.fetchRosterData,
          updateCharacterStats: this.updateCharacterStats,
          getCharacter: this.getCharacter,
          getActiveCharacter: this.getActiveCharacter,
          updateInventory: this.updateInventory,
          applyPurchase: this.applyPurchase,
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
