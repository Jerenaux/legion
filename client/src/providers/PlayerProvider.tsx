import { Component, h } from 'preact';
import { PlayerContextState, PlayerContextData, PlayerContext } from '../contexts/PlayerContext';
import { apiFetch } from '../services/apiService';
import { successToast, errorToast } from '../components/utils';
import { APIPlayerData, APICharacterData } from '@legion/shared/interfaces';
import { League, Stat, StatFields, InventoryActionType, equipmentFields, EquipmentSlot,
 } from "@legion/shared/enums";
 import { ItemDialogType } from '../components/itemDialog/ItemDialogType';
import { firebaseAuth } from '../services/firebaseService'; 
import { getSPIncrement } from '@legion/shared/levelling';
import { inventorySize } from '@legion/shared/utils';
import { playSoundEffect } from '../components/utils';
import { getEquipmentById } from "@legion/shared/Equipments";
import { getSpellById } from "@legion/shared/Spells";


import equipSfx from "@assets/sfx/equip.wav";
class PlayerProvider extends Component<{}, PlayerContextState> {
    constructor(props: {}) {
      super(props);
      this.state = {
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
        },
        characters: [],
        activeCharacterId: '',
        characterSheetIsDirty: false,
        inventory: {
          consumables: [],
          equipment: [],
          spells: [],
        },
        isInventoryLoaded: false,
        carrying_capacity: 0,
      };

      // Bind the methods to ensure 'this' refers to the class instance
      this.fetchPlayerData = this.fetchPlayerData.bind(this);
      this.setPlayerInfo = this.setPlayerInfo.bind(this);
      this.fetchRosterData = this.fetchRosterData.bind(this);
      this.updateCharacterStats = this.updateCharacterStats.bind(this);
      this.getCharacter = this.getCharacter.bind(this);
      this.updateInventory = this.updateInventory.bind(this);
      this.updateActiveCharacter = this.updateActiveCharacter.bind(this);
    }

    componentDidMount() {
      this.fetchAllData();
    }

    fetchAllData() {
      this.fetchPlayerData();
      this.fetchRosterData();
      this.fetchInventoryData();
    }
    
    async fetchPlayerData() {
      const user = firebaseAuth.currentUser;
      if (!user) {
          return;
          // throw new Error("No authenticated user found");
      }
      try {
          const data = await apiFetch('getPlayerData') as APIPlayerData;
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
              }
          });
      } catch (error) {
          errorToast(`Error: ${error}`);
      }
    }

    async fetchInventoryData() { 
      // await new Promise(resolve => setTimeout(resolve, 20000));
  
      try {
          const data = await apiFetch('inventoryData');
          this.setState({ 
            inventory: {
              consumables: data.inventory.consumables?.sort(),
              equipment: data.inventory.equipment?.sort(), 
              spells: data.inventory.spells?.sort(),
            },
            carrying_capacity: data.carrying_capacity,
            isInventoryLoaded: true,
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
        errorToast(`Error: ${error}`);
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
        const activeCharacter = prevState.characters.find(char => char.id === prevState.activeCharacterId);
        if (!activeCharacter) {
          errorToast('No active character selected!');
          return prevState;
        }

        const newState = { ...prevState };
        let updatedInventory = { ...newState.inventory };
        let updatedCharacter = { ...activeCharacter };

        switch(type) {
          case ItemDialogType.CONSUMABLES:
            if (action === InventoryActionType.EQUIP) {
              if (updatedCharacter.inventory.length >= updatedCharacter.carrying_capacity + (updatedCharacter.carrying_capacity_bonus || 0)) {
                errorToast('Character inventory is full!');
                return prevState;
              }
              const id = updatedInventory.consumables[index];
              updatedInventory.consumables.splice(index, 1);
              updatedCharacter.inventory.push(id);
            } else {
              if (inventorySize(updatedInventory) >= newState.carrying_capacity) {
                errorToast('Character inventory is full!');
                return prevState;
              }
              const id = updatedCharacter.inventory[index];
              updatedInventory.consumables.push(id);
              updatedInventory.consumables.sort();
              updatedCharacter.inventory.splice(index, 1);
            }
            break;
          case ItemDialogType.EQUIPMENTS:
            if (action === InventoryActionType.EQUIP) {
              const data = getEquipmentById(updatedInventory.equipment[index]);

              if (data.minLevel > updatedCharacter.level) {
                errorToast('Character level is too low!');
                return prevState;
              }

              if (data.classes.length && !data.classes.includes(updatedCharacter.class)) {
                errorToast('Character class is not compatible!');
                return prevState;
              }

              let slotNumber = data.slot;

              if (slotNumber === EquipmentSlot.LEFT_RING 
                && updatedCharacter.equipment['left_ring'] > -1
                && updatedCharacter.equipment['right_ring'] == -1) {
                  slotNumber = EquipmentSlot.RIGHT_RING;
              }

              // Save the current equipment id, if any
              const previousId = updatedCharacter.equipment[equipmentFields[slotNumber]];

              const field = equipmentFields[slotNumber];
              const id = updatedInventory.equipment[index];
              updatedInventory.equipment.splice(index, 1);

              if (updatedCharacter.equipment[field] !== -1) {
                const removed_id = updatedCharacter.equipment[field];
                updatedInventory.equipment.push(removed_id);
                updatedInventory.equipment.sort();
              }

              updatedCharacter.equipment[field] = id;

              // Apply stat changes of the removed equipment
              if (previousId !== -1) {
                const data = getEquipmentById(previousId);
                const effects = data.effects;
                effects.forEach(effect => {
                  const stat = effect.stat;
                  const value = effect.value;
                  updatedCharacter.stats[StatFields[stat]] -= value;
                });
              }

              // Apply stats changes
              const effects = data.effects;
              effects.forEach(effect => {
                const stat = effect.stat;
                const value = effect.value;
                updatedCharacter.stats[StatFields[stat]] += value;
              });
            } else {
              if (inventorySize(updatedInventory) >= newState.carrying_capacity) {
                errorToast('Character inventory is full!');
                return prevState;
              }
              const field = equipmentFields[index];
              const id = updatedCharacter.equipment[field];
              updatedCharacter.equipment[field] = -1;
              updatedInventory.equipment.push(id);
              updatedInventory.equipment.sort();

              // Apply stats changes
              const data = getEquipmentById(id);
              const effects = data.effects;
              effects.forEach(effect => {
                const stat = effect.stat;
                const value = effect.value;
                updatedCharacter.stats[StatFields[stat]] -= value;
              });
            }
            break;
          case ItemDialogType.SPELLS:
            if (action === InventoryActionType.EQUIP) {
              const data = getSpellById(updatedInventory.spells[index]);
              if (data.classes.length && !data.classes.includes(updatedCharacter.class)) {
                errorToast('Character class is not compatible!');
                return prevState;
              }
              if (data.minLevel > updatedCharacter.level) {
                errorToast('Character level is too low!');
                return prevState;
              }

              if (updatedCharacter.skill_slots == 0) {
                errorToast('Character has no spell slots!');
                return prevState;
              }
              if (updatedCharacter.skills.length >= updatedCharacter.skill_slots) {
                errorToast('Character spell slots are full!');
                return prevState;
              }
              const id = updatedInventory.spells[index];
              // Check if character already knows the spell
              if (updatedCharacter.skills.includes(id)) {
                errorToast('Character already knows this spell!');
                return prevState;
              }
              updatedInventory.spells.splice(index, 1);
              updatedCharacter.skills.push(id);
            }
            break;
        }

        playSoundEffect(equipSfx);

        // Update the character in the characters array
        const updatedCharacters = newState.characters.map(char =>
          char.id === updatedCharacter.id ? updatedCharacter : char
        );

        return {
          ...newState,
          inventory: updatedInventory,
          characters: updatedCharacters,
          characterSheetIsDirty: true
        };
      });
    }

    getCharacter = (characterId: string): APICharacterData | undefined => {
      return this.state.characters.find(char => char.id === characterId);
    }

    setPlayerInfo = (updates: Partial<PlayerContextData>) => {
      this.setState(({ player }) => ({
        player: { ...player, ...updates }
      }));
    }
  
    render() {
      const { children } = this.props;
  
      return (
        <PlayerContext.Provider value={{
          player: this.state.player,
          characters: this.state.characters,
          activeCharacterId: this.state.activeCharacterId,
          characterSheetIsDirty: this.state.characterSheetIsDirty,
          inventory: this.state.inventory,
          carrying_capacity: this.state.carrying_capacity,
          isInventoryLoaded: this.state.isInventoryLoaded,
          setPlayerInfo: this.setPlayerInfo,
          refreshPlayerData: this.fetchPlayerData,
          fetchRosterData: this.fetchRosterData,
          updateCharacterStats: this.updateCharacterStats,
          getCharacter: this.getCharacter,
          updateInventory: this.updateInventory,
          updateActiveCharacter: this.updateActiveCharacter,
        }}>
          {children}
        </PlayerContext.Provider>
      );
    }
  }
  
  export default PlayerProvider;
  