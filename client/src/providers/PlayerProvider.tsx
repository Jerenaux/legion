import { Component, h } from 'preact';
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
    private fetchAllDataTimeout: NodeJS.Timeout | null = null;
    private fetchAllDataDelay: number = 400; 
    private reconnectTimeout: NodeJS.Timeout | null = null;
    private reconnectDelay: number = 500;

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
      this.manageHelp = this.manageHelp.bind(this);
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
          tokens: null,
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
      if (this.state.socket) {
        this.state.socket.disconnect();
      }
      this.setState(this.getInitialState());
    }

    componentDidUpdate() {
      const user = firebaseAuth.currentUser;
      if (!user && this.state.player.isLoaded) {
        this.resetState();
      } else if (user && !this.state.player.isLoaded) {
        this.debouncedFetchAllData();
        this.setupSocket();
      }
    }

    componentWillUnmount(): void {
      this.resetState();
      if (this.fetchAllDataTimeout !== null) {
        clearTimeout(this.fetchAllDataTimeout);
      }
      if (this.reconnectTimeout !== null) {
        clearTimeout(this.reconnectTimeout);
      }
      if (this.state.socket) {
        this.state.socket.disconnect();
      }
    }

    debouncedFetchAllData = () => {
      if (this.fetchAllDataTimeout !== null) {
        clearTimeout(this.fetchAllDataTimeout);
      }
      this.fetchAllDataTimeout = setTimeout(() => {
        this.fetchAllData();
        this.fetchAllDataTimeout = null;
      }, this.fetchAllDataDelay);
    }

    fetchAllData() {
      const user = firebaseAuth.currentUser;
      if (!user) {
        return;
      }

      this.fetchPlayerData();
      this.fetchRosterData();
      this.fetchFriends();
    }
    
    async fetchPlayerData() {
      const user = firebaseAuth.currentUser;
      if (!user) return;
    
      try {
          const data = await apiFetch('getPlayerData', {}, 3) as PlayerContextData;
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
                  tokens: data.tokens || {},
                  engagementStats: data.engagementStats || {},
              }
          });
      } catch (error) {
          errorToast(`Error: ${error}`);
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
            characters: updatedCharacters
          };
      });
    }

    updateInventory(type: ItemDialogType, action: InventoryActionType, index: number) {
      this.setState((prevState) => {
        const activeCharacter = this.getActiveCharacter();
        if (!activeCharacter) {
          errorToast('No active character selected!');
          return prevState;
        }
  
        const newState = { ...prevState };
        let updatedInventory = { ...newState.player.inventory };
        let updatedCharacter = { ...activeCharacter };
  
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
  
        switch(type) {
          case ItemDialogType.CONSUMABLES:
            if (action === InventoryActionType.EQUIP) {
              if (!canEquipConsumable(updatedCharacter)) {
                errorToast('Character inventory is full!');
                return prevState;
              }
              result = equipConsumable(newState.player, updatedCharacter, index);
            } else {
              if (!roomInInventory(newState.player)) {
                errorToast('Player inventory is full!');
                return prevState;
              }
              result = unequipConsumable(newState.player, updatedCharacter, index);
            }
            break;
          case ItemDialogType.EQUIPMENTS:
            if (action === InventoryActionType.EQUIP) {
              if (!canEquipEquipment(updatedCharacter, updatedInventory.equipment[index])) {
                errorToast('Cannot equip this item!');
                return prevState;
              }
              result = equipEquipment(newState.player, updatedCharacter, index);
            } else {
              if (!roomInInventory(newState.player)) {
                errorToast('Player inventory is full!');
                return prevState;
              }
              result = unequipEquipment(newState.player, updatedCharacter, index);
            }
            break;
          case ItemDialogType.SPELLS:
            if (action === InventoryActionType.EQUIP) {
              if (!canLearnSpell(updatedCharacter, updatedInventory.spells[index])) {
                errorToast('Cannot learn this spell!');
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
          inventory: result.playerUpdate.inventory,
          characters: updatedCharacters,
          characterSheetIsDirty: true
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
          }
        }
      });
    }

    // addChestContentToInventory = (content: ChestReward[]) => {
    //   const { inventory } = this.state.player;
      
    // }

    getCharacter = (characterId: string): APICharacterData | undefined => {
      return this.state.characters.find(char => char.id === characterId);
    }

    getActiveCharacter = (): APICharacterData | undefined => {
      return this.getCharacter(this.state.activeCharacterId) || this.state.characters[0];
    }

    setPlayerInfo = (updates: Partial<PlayerContextData>) => {
      this.setState(({ player }) => ({
        player: { ...player, ...updates }
      }));
    }

    markShownWelcome = () => {
      this.setState({ welcomeShown: true });
    }

    manageHelp = (page: string) => {
      // const todoTours = this.state.player.tours;
      // if (todoTours.includes(page)) {
      //   // startTour(page);
      //   this.setState({
      //     player: {
      //       ...this.state.player,
      //       tours: todoTours.filter(tour => tour !== page)
      //     }
      //   });
      //   this.setState({ lastHelp: Date.now() });
      // } else {
      //   if (Date.now() - this.state.lastHelp >= 3000) {
      //     fetchGuideTip();
      //   }
      // }
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

      console.log(`Connecting to ${process.env.MATCHMAKER_URL} ...`);
      
      const token = await getFirebaseIdToken();
      if (!token) {
        console.error('Could not obtain authentication token');
        // Clear any existing reconnect timeout
        if (this.reconnectTimeout) {
          clearTimeout(this.reconnectTimeout);
          this.reconnectTimeout = null;
        }
        errorToast('Connection error - Please reload the page');
        return;
      }

      const socket = io(process.env.MATCHMAKER_URL, {
        auth: {
          token
        },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: this.reconnectDelay,
        reconnectionDelayMax: 5000,
      });

      socket.on('connect', () => {
        console.log('Connected to matchmaker');
        // Clear any pending reconnect timeout
        if (this.reconnectTimeout) {
          clearTimeout(this.reconnectTimeout);
          this.reconnectTimeout = null;
        }
      });

      socket.on('disconnect', (reason) => {
        console.log(`Disconnected from matchmaker: ${reason}`);
        
        // Don't attempt to reconnect if the disconnection was intentional
        if (reason === 'io client disconnect') {
          return;
        }

        // For other disconnections, attempt to reconnect
        this.setState({ socket: null }, () => {
          this.scheduleReconnect();
        });
      });

      socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        // errorToast('Connection error, attempting to reconnect...');
        
        // Schedule reconnect on connection error
        this.scheduleReconnect();
      });

      socket.on('error', (e) => {
        errorToast(e);
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
            playerName = 'another player';
          }
          silentErrorToast(`Your challenge to ${playerName} was declined!`);
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
            silentErrorToast(`The challenge from ${data?.challengerName || 'Player'} was cancelled`);
        }
      });

        this.setState({ socket });
    }

    private scheduleReconnect = () => {
      // Clear any existing reconnect timeout
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
      }

      this.reconnectTimeout = setTimeout(() => {
        console.log('Attempting to reconnect...');
        this.setupSocket();
      }, this.reconnectDelay);
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
      return this.state.player.engagementStats.completedGames >= LOCKED_FEATURES[feature];
    }

    render() {
      const { children } = this.props;
  
      return (
        <PlayerContext.Provider value={{
          player: this.state.player,
          characters: this.state.characters,
          activeCharacterId: this.state.activeCharacterId,
          characterSheetIsDirty: this.state.characterSheetIsDirty,
          welcomeShown: this.state.welcomeShown,
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
          manageHelp: this.manageHelp,
          friends: this.state.friends,
          addFriend: this.addFriend,
          refreshFriends: this.fetchFriends,
          socket: this.state.socket,
          challengeModal: this.state.challengeModal,
          handleChallengeAccept: this.handleChallengeAccept,
          handleChallengeDecline: this.handleChallengeDecline,
          canAccessFeature: this.canAccessFeature,
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
                      <h3>Duel</h3>
                      <div className="challenge-description">
                          <p>
                              <span className="highlight-name">
                                  {this.state.challengeModal.challengerName}
                              </span>
                              {' '}has challenged you to a duel!
                          </p>
                      </div>
                      <div className="modal-footer">
                          <button
                              onClick={this.handleChallengeDecline}
                              className="cancel-btn"
                          >
                              Decline
                          </button>
                          <button
                              onClick={this.handleChallengeAccept}
                              className="confirm-btn"
                          >
                              Accept
                          </button>
                      </div>
                  </div>
              </div>
          )}
        </PlayerContext.Provider>
      );
    }
  }
  
  export default PlayerProvider;
  