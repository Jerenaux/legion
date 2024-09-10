import { createContext } from 'preact';
import { PlayerContextData, APICharacterData } from '@legion/shared/interfaces';
import { League, Stat, InventoryActionType, ShopTab } from "@legion/shared/enums";

export interface PlayerContextState {
  player: PlayerContextData;
  characters: APICharacterData[];
  activeCharacterId: string;
  characterSheetIsDirty: boolean;
}

export const PlayerContext = createContext<{
  player: PlayerContextData;
  characters: APICharacterData[];
  activeCharacterId: string;
  characterSheetIsDirty: boolean;
  setPlayerInfo: (updates: Partial<PlayerContextData>) => void;
  refreshPlayerData: () => void;
  fetchRosterData: () => Promise<void>;
  updateCharacterStats: (characterId: string, stat: Stat, amount: number) => void;
  getCharacter: (characterId: string) => APICharacterData | undefined;
  getActiveCharacter: () => APICharacterData | undefined;
  updateInventory: (type: string, action: InventoryActionType, index: number) => void;
  applyPurchase: (articleId: number, price: number, quantity: number, shoptab: ShopTab) => void;
  updateActiveCharacter: (characterId: string) => void;
  refreshAllData: () => void;
}>({
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
  setPlayerInfo: () => {},
  refreshPlayerData: () => {},
  fetchRosterData: async () => {},
  updateCharacterStats: () => {},
  getCharacter: () => undefined,
  getActiveCharacter: () => undefined,
  updateInventory: () => {},
  applyPurchase: () => {},
  updateActiveCharacter: () => {},
  refreshAllData: () => {},
});