import { createContext } from 'preact';
import { DailyLootAllData } from '@legion/shared/interfaces';

export interface PlayerContextData {
  name: string;
  lvl: number;
  gold: number;
  elo: number;
  ranking: number;
  dailyloot: DailyLootAllData;
}

export interface PlayerContextState {
  player: PlayerContextData;
}

export const PlayerContext = createContext<{
  player: PlayerContextData;
  setPlayerInfo: (updates: Partial<PlayerContextData>) => void;
  refreshPlayerData: () => void;
}>({
  player: {
    name: '',
    lvl: 0,
    gold: 0,
    elo: 0,
    ranking: 0,
    dailyloot: null,
  },
  setPlayerInfo: () => {},
  refreshPlayerData: () => {}
});