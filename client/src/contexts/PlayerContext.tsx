import { createContext } from 'preact';
import { PlayerContextData, APICharacterData, FriendData, } from '@legion/shared/interfaces';
import { League, Stat, InventoryActionType, ShopTab, LockedFeatures } from "@legion/shared/enums";
import { Socket } from 'socket.io-client';

export interface PlayerContextState {
  player: PlayerContextData;
  characters: APICharacterData[];
  activeCharacterId: string;
  characterSheetIsDirty: boolean;
  welcomeShown: boolean;
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
  markWelcomeShown: () => void;
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
    tokens: null,
    friends: [],
  },
  loaded: false,
  characters: [],
  activeCharacterId: '',
  characterSheetIsDirty: false,
  welcomeShown: false,
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
  markWelcomeShown: () => {},
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
});
