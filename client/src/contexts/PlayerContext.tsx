import { createContext } from 'preact';
import { PlayerContextData, APICharacterData, FriendData, } from '@legion/shared/interfaces';
import { League, LockedFeatures } from "@legion/shared/enums";
import { Socket } from 'socket.io-client';
import type { PlayerView } from '../providers/predictions';
import type { Rejection } from '@legion/shared/playerActions';

export interface PlayerContextState {
  player: PlayerContextData;
  characters: APICharacterData[];
  activeCharacterId: string;
  characterSheetIsDirty: boolean;
  welcomeShown: boolean;
  firstMatchCompleted: boolean;
  lastHelp: number;
  friends: FriendData[];
  socket: Socket | null;
  challengeModal: {
    show: boolean;
    challengerId: string;
    challengerName: string;
    challengerAvatar: string;
    lobbyId: string;
  };
}

export const PlayerContext = createContext<{
  player: PlayerContextData;
  loaded: boolean;
  characters: APICharacterData[];
  activeCharacterId: string;
  characterSheetIsDirty: boolean;
  welcomeShown: boolean;
  firstMatchCompleted: boolean;
  setPlayerInfo: (updates: Partial<PlayerContextData>) => void;
  updateIdentity: (updates: Partial<Pick<PlayerContextData, 'name' | 'avatar'>>) => void;
  refreshPlayerData: () => void;
  fetchRosterData: () => Promise<void>;
  getCharacter: (characterId: string) => APICharacterData | undefined;
  getActiveCharacter: () => APICharacterData | undefined;
  updateActiveCharacter: (characterId: string) => void;
  refreshAllData: () => void;
  markWelcomeShown: () => void;
  markFirstMatchCompleted: () => void;
  resetState: () => void;
  friends: FriendData[];
  addFriend: (friendId: string) => Promise<void>;
  refreshFriends: () => Promise<void>;
  socket: Socket | null;
  challengeModal: {
    show: boolean;
    challengerId: string;
    challengerName: string;
    challengerAvatar: string;
    lobbyId: string;
  };
  handleChallengeAccept: () => void;
  handleChallengeDecline: () => void;
  canAccessFeature: (feature: LockedFeatures) => boolean;
  getGamesUntilFeature: (feature: LockedFeatures) => number;
  getCompletedGames: () => number;
  checkEngagementFlag: (flag: string) => boolean;
  hasConsumable: () => boolean;
  hasEquipableEquipment: () => boolean;
  hasEquipableSpells: () => boolean;
  hasEquipableEquipmentByCurrentCharacter: () => boolean;
  hasEquipableSpellsByCurrentCharacter: () => boolean;
  getEquipmentThatCurrentCharacterCanEquip: () => number;
  getCharacterThatCanEquipEquipment: () => APICharacterData;
  getSpellsThatCurrentCharacterCanEquip: () => number;
  getCharacterThatCanEquipSpells: () => APICharacterData;
  hasAnyCharacterSpendableSP: () => boolean;
  hasCurrentCharacterSpendableSP: () => boolean;
  getCharacterThatCanSpendSP: () => APICharacterData;
  notifyLeaveGame: (gameId: string) => void;
  buyInventorySlots: (slots: number) => Promise<void>;
  optimisticMutation: (predict: (view: PlayerView) => PlayerView | Rejection, send: () => Promise<unknown>) => Promise<boolean> | null;
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
    isLoaded: false,
    inventory: {
      consumables: [],
      equipment: [],
      spells: [],
    },
    carrying_capacity: 0,
    friends: [],
  },
  loaded: false,
  characters: [],
  activeCharacterId: '',
  characterSheetIsDirty: false,
  welcomeShown: false,
  firstMatchCompleted: false,
  setPlayerInfo: () => {},
  updateIdentity: () => {},
  refreshPlayerData: () => {},
  fetchRosterData: async () => {},
  getCharacter: () => undefined,
  getActiveCharacter: () => undefined,
  updateActiveCharacter: () => {},
  refreshAllData: () => {},
  markWelcomeShown: () => {},
  markFirstMatchCompleted: () => {},
  resetState: () => {},
  friends: [],
  addFriend: async () => {},
  refreshFriends: async () => {},
  socket: null,
  challengeModal: {
    show: false,
    challengerId: '',
    challengerName: '',
    challengerAvatar: '',
    lobbyId: '',
  },
  handleChallengeAccept: () => {},
  handleChallengeDecline: () => {},
  canAccessFeature: () => false,
  getCompletedGames: () => 0,
  checkEngagementFlag: () => false,
  getGamesUntilFeature: () => 0,
  hasConsumable: () => false,
  hasEquipableEquipment: () => false,
  hasEquipableSpells: () => false,
  hasEquipableEquipmentByCurrentCharacter: () => false,
  hasEquipableSpellsByCurrentCharacter: () => false,
  getEquipmentThatCurrentCharacterCanEquip: () => 0,
  getCharacterThatCanEquipEquipment: () => undefined,
  getSpellsThatCurrentCharacterCanEquip: () => 0,
  getCharacterThatCanEquipSpells: () => undefined,
  hasAnyCharacterSpendableSP: () => false,
  hasCurrentCharacterSpendableSP: () => false,
  getCharacterThatCanSpendSP: () => undefined,
  notifyLeaveGame: () => {},
  buyInventorySlots: async () => {},
  optimisticMutation: () => null,
});
