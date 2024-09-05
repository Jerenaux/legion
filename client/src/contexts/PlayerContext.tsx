import { createContext } from 'preact';
import { DailyLootAllAPIData, APICharacterData } from '@legion/shared/interfaces';
import { League, Stat } from "@legion/shared/enums";

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
  characterSheetIsDirty: boolean;
}

export const PlayerContext = createContext<{
  player: PlayerContextData;
  characters: APICharacterData[];
  characterSheetIsDirty: boolean;
  setPlayerInfo: (updates: Partial<PlayerContextData>) => void;
  refreshPlayerData: () => void;
  fetchRosterData: () => Promise<void>;
  updateCharacterStats: (characterId: string, stat: Stat, amount: number) => void;
  getCharacter: (characterId: string) => APICharacterData | undefined;
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
  characterSheetIsDirty: false,
  setPlayerInfo: () => {},
  refreshPlayerData: () => {},
  fetchRosterData: async () => {},
  updateCharacterStats: () => {},
  getCharacter: () => undefined,
});