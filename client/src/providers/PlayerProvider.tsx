import { Component, h } from 'preact';
import { PlayerContextState, PlayerContext } from '../contexts/PlayerContext';
import { apiFetch } from '../services/apiService';
import { successToast, errorToast } from '../components/utils';
import { APICharacterData, PlayerContextData, PlayerInventory } from '@legion/shared/interfaces';
import { League, Stat, StatFields, InventoryActionType, ShopTab
 } from "@legion/shared/enums";
 import { ItemDialogType } from '../components/itemDialog/ItemDialogType';
import { firebaseAuth } from '../services/firebaseService'; 
import { getSPIncrement } from '@legion/shared/levelling';
import { playSoundEffect, fetchGuideTip } from '../components/utils';
import { ChestReward } from "@legion/shared/chests";
import { startTour } from '../components/tours';  

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
  numericalSort
} from '@legion/shared/inventory';

import equipSfx from "@assets/sfx/equip.wav";
class PlayerProvider extends Component<{}, PlayerContextState> {
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
          tours: [],
          isLoaded: false,
          inventory: {
            consumables: [],
            equipment: [],
            spells: [],
          },
          carrying_capacity: 0,
        },
        characters: [],
        activeCharacterId: '',
        characterSheetIsDirty: false,
        welcomeShown: false,
        lastHelp: 0,
      };
    }

    resetState = () => {
      this.setState(this.getInitialState());
    }

    componentDidMount() {
      this.fetchAllData();
    }

    componentDidUpdate() {
      const user = firebaseAuth.currentUser;
      if (!user && this.state.player.isLoaded) this.resetState();
      if (user && !this.state.player.isLoaded) this.fetchAllData();
    }

    componentWillUnmount(): void {
      this.resetState();
    }

    fetchAllData() {
      const user = firebaseAuth.currentUser;
      if (!user) {
        return;
      }

      this.fetchPlayerData();
      this.fetchRosterData();
    }
    
    async fetchPlayerData() {
      const user = firebaseAuth.currentUser;
      if (!user) return;
    
      try {
          const data = await apiFetch('getPlayerData') as PlayerContextData;
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
                  tours: data.tours,
                  isLoaded: true,
                  inventory: data.inventory,
                  carrying_capacity: data.carrying_capacity,
              }
          });
      } catch (error) {
          errorToast(`Error: ${error}`);
      }
    }

    async fetchRosterData() {
      try {
        const data = await apiFetch('rosterData');
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
      const todoTours = this.state.player.tours;
      if (todoTours.includes(page)) {
        startTour(page);
        this.setState({
          player: {
            ...this.state.player,
            tours: todoTours.filter(tour => tour !== page)
          }
        });
        this.setState({ lastHelp: Date.now() });
      } else {
        if (Date.now() - this.state.lastHelp >= 3000) {
          fetchGuideTip();
        }
      }
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
          manageHelp: this.manageHelp
        }}>
          {children}
        </PlayerContext.Provider>
      );
    }
  }
  
  export default PlayerProvider;
  