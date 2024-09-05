import { createContext } from 'preact';
import { DailyLootAllAPIData, APICharacterData } from '@legion/shared/interfaces';
import { League, Stat, InventoryActionType } from "@legion/shared/enums";

export interface PlayerContextData {
  uid: string;
  name: string;
  avatar: string;
  lvl: number;
  gold: number;
  elo: number;
  wins: number;
  rank: number;
  allTimeRank: number;
  dailyloot: DailyLootAllAPIData;
  league: League;
  tours: string[];
  isLoaded: boolean;
}

export interface PlayerContextState {
  player: PlayerContextData;
  characters: APICharacterData[];
  activeCharacterId: string;
  characterSheetIsDirty: boolean;
  inventory: {
    consumables: number[];
    equipment: number[];
    spells: number[];
  };
  carrying_capacity: number;
  isInventoryLoaded: boolean;
}

export const PlayerContext = createContext<{
  player: PlayerContextData;
  characters: APICharacterData[];
  activeCharacterId: string;
  characterSheetIsDirty: boolean;
  inventory: {
    consumables: number[];
    equipment: number[];
    spells: number[];
  };
  carrying_capacity: number;
  isInventoryLoaded: boolean;
  setPlayerInfo: (updates: Partial<PlayerContextData>) => void;
  refreshPlayerData: () => void;
  fetchRosterData: () => Promise<void>;
  updateCharacterStats: (characterId: string, stat: Stat, amount: number) => void;
  getCharacter: (characterId: string) => APICharacterData | undefined;
  updateInventory: (type: string, action: InventoryActionType, index: number) => void;
  updateActiveCharacter: (characterId: string) => void;
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
  },
  characters: [],
  activeCharacterId: '',
  characterSheetIsDirty: false,
  inventory: {
    consumables: [],
    equipment: [],
    spells: [],
  },
  carrying_capacity: 0,
  isInventoryLoaded: false,
  setPlayerInfo: () => {},
  refreshPlayerData: () => {},
  fetchRosterData: async () => {},
  updateCharacterStats: () => {},
  getCharacter: () => undefined,
  updateInventory: () => {},
  updateActiveCharacter: () => {},
});