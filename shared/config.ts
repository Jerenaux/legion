import { LockedFeatures, RewardType } from "./enums";

const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'docker';

// Profile
export const MAX_NICKNAME_LENGTH = 18;
export const MAX_AVATAR_ID = 31;

// Gameplay
export const NB_START_CHARACTERS = 3;
export const MAX_CHARACTERS = 6;
export const TURN_DURATION = 7;
export const GAME_0_TURN_DURATION = 60;
export const CAST_DELAY = 1;
export const ATTACK_DELAY = 0.5;
export const SPELL_DELAY = 1;
export const MOVE_DELAY = 0.5;
export const ITEM_DELAY = 1;
export const KILL_CAM_DURATION = 3;
export const KILL_CAM_DELAY = 0.5;
export const PARALYZED_DELAY = 1.5;
export const FIRST_TURN_DELAY = 2.5;
export const BASE_INVENTORY_SIZE = 20;
export const BASE_CARRYING_CAPACITY = 3;
export const STARTING_GOLD = 50;
export const STARTING_CONSUMABLES = [];
export const STARTING_WHITE_MAGE_SPELLS = [9];
export const STARTING_BLACK_MAGE_SPELLS = [0];
export const XP_PER_LEVEL = 50;
export const AVERAGE_GOLD_REWARD_PER_GAME = 100; 
export const MAX_AUDIENCE_SCORE = 1500;
export const PROMOTION_RATIO = 0.4;
export const DEMOTION_RATIO = 0.3;
export const SEASON_END_CRON = '0 19 * * 5' // UTC
export const BASE_ANIM_FRAME_RATE = 5;


export const PRACTICE_XP_COEF = 0.6;
export const PRACTICE_GOLD_COEF = 0.1; // TODO: make 0?
export const RANKED_XP_COEF = 1.2;
export const RANKED_GOLD_COEF = 1.5;

// Time, all in seconds
export const TIME_COEFFICIENT = 4;

export const MOVE_COOLDOWN = 1;
export const ATTACK_COOLDOWN = 2;

export const INITIAL_COOLDOWN = 3; // sec

// Matchmaking
export const eloRangeIncreaseInterval = 20; // seconds
export const eloRangeStart = 600;
export const eloRangeStep = 50; // Increase range by 50 points every interval
export const goldRewardInterval = 15;
export const goldReward = 1;
export const casualModeThresholdTime = 5; // seconds after which redirection probability starts increasing
export const maxWaitTimeForPractice = isDev ? 5 : 60; // maximum wait time after which a player is guaranteed to be redirected
export let ALLOW_SWITCHEROO_RANKED = true;

// Feature flags
export const ENABLE_PLAYER_LEVEL = false;
export const ENABLE_TEAM_NAME = false;
export const ENABLE_APPROX_WT = false;
export const ENABLE_MM_TOGGLE = false;
export const ENABLE_Q_NEWS = true;
export const ENABLE_QUESTS = false;
export const ENABLE_SPECTATOR_MODE = false;
export const ENABLE_SETTINGS = true;
export const ENABLE_ELYSIUM = false;

// Admin
export let FREEZE_AI = true;
export const STARTING_GOLD_ADMIN = 100000;
export const STARTING_SPELLS_ADMIN = [2];
export const STARTING_EQUIPMENT_ADMIN = [2];
export let INJURED_MODE = false;
export let SKIP_LEVEL_RESTRICTIONS = false;
export let IMMEDIATE_LOOT = true;
export let LOTSA_MP = false;
export let MAX_AI_CHARACTERS = 6;
export let KILLALL_BM = false;
export let KILLALL_WM = false;
export let KILLALL_W = false;
export let FREEZE_CAMERA = false;

// Web3
export let NETWORK = isDev ? 'devnet' : 'mainnet';
const ALCHEMY_API_KEY = '7aGAP4QZtAC0FxXqFvVSTz0X4jPLFSd4';
export const RPC = NETWORK === 'devnet' ? `https://solana-${NETWORK}.g.alchemy.com/v2/${ALCHEMY_API_KEY}` : 'https://snowy-lively-tree.solana-mainnet.quiknode.pro/06a13c157e50528707e63ef977c12ef76163056f';
export const GAME_WALLET = NETWORK === 'devnet' ? '5sbSbXRifoT3TyZn98Vt2k9pXE59PbcKBewfVYco6HUY' : '3An5UbyPzsoaHHCiqfou7SX88V9JJM1x1XzN77JyYWNh';
export const MIN_WITHDRAW = 0.01;
export const LEGION_CUT = 0.02;

// Social
export const DISCORD_LINK = 'https://discord.gg/s2XZhYCK2m';
export const X_LINK = 'https://x.com/iolegion';

// Locked features
export const LOCKED_FEATURES = {
    [LockedFeatures.CONSUMABLES_BATCH_1]: 1,
    [LockedFeatures.SPELLS_BATCH_1]: 2,
    [LockedFeatures.EQUIPMENT_BATCH_1]: 3,
    [LockedFeatures.RANKED_MODE]: 4,
    [LockedFeatures.CONSUMABLES_BATCH_2]: 5,
    [LockedFeatures.SPELLS_BATCH_2]: 6,
    [LockedFeatures.EQUIPMENT_BATCH_2]: 7,
    [LockedFeatures.DAILY_LOOT]: 8,
    [LockedFeatures.CONSUMABLES_BATCH_3]: 9,
    [LockedFeatures.EQUIPMENT_BATCH_3]: 10,
    [LockedFeatures.SPELLS_BATCH_3]: 11,
    [LockedFeatures.CHARACTER_PURCHASES]: 12,
}

export const EQUIPMENT_BATCH_GOLD = {
    [LockedFeatures.EQUIPMENT_BATCH_1]: 500,
    [LockedFeatures.EQUIPMENT_BATCH_2]: 1000,
    [LockedFeatures.EQUIPMENT_BATCH_3]: 1000000,
}

export const UNLOCK_REWARDS = {
    [LockedFeatures.CONSUMABLES_BATCH_1]: [
        { type: RewardType.CONSUMABLES, id: 0, amount: 5 },
        { type: RewardType.GOLD, id: -1, amount: 100 },
    ],
    [LockedFeatures.SPELLS_BATCH_1]: [
        { type: RewardType.CONSUMABLES, id: 1, amount: 5 },
        { type: RewardType.GOLD, id: -1, amount: 500 },
    ],
    [LockedFeatures.EQUIPMENT_BATCH_1]: [
        { type: RewardType.EQUIPMENT, id: 17, amount: 1 },
        { type: RewardType.GOLD, id: -1, amount: 1000 },
    ],
    [LockedFeatures.RANKED_MODE]: [
        { type: RewardType.CONSUMABLES, id: 8, amount: 2 },
        { type: RewardType.GOLD, id: -1, amount: 200 },
    ],
    [LockedFeatures.CONSUMABLES_BATCH_2]: [
        { type: RewardType.CONSUMABLES, id: 10, amount: 2 },
        { type: RewardType.CONSUMABLES, id: 12, amount: 2 },
        { type: RewardType.GOLD, id: -1, amount: 200 },
    ],
    [LockedFeatures.SPELLS_BATCH_2]: [
        { type: RewardType.CONSUMABLES, id: 1, amount: 3 },
        { type: RewardType.GOLD, id: -1, amount: 200 },
    ],
    [LockedFeatures.EQUIPMENT_BATCH_2]: [
        { type: RewardType.EQUIPMENT, id: 16, amount: 1 },
        { type: RewardType.GOLD, id: -1, amount: 200 },
    ],
    [LockedFeatures.DAILY_LOOT]: [
        { type: RewardType.GOLD, id: -1, amount: 200 },
    ],
    [LockedFeatures.CONSUMABLES_BATCH_3]: [
        { type: RewardType.CONSUMABLES, id: 11, amount: 1 },
        { type: RewardType.GOLD, id: -1, amount: 200 },
    ],
    [LockedFeatures.EQUIPMENT_BATCH_3]: [
        { type: RewardType.GOLD, id: -1, amount: 500 },
    ],
    [LockedFeatures.SPELLS_BATCH_3]: [
        { type: RewardType.GOLD, id: -1, amount: 500 },
    ],
    [LockedFeatures.CHARACTER_PURCHASES]: [
        { type: RewardType.GOLD, id: -1, amount: 500 },
    ],
}

export const remoteConfig = {
    AUTO_DEFEAT: false,
    HIGH_DAMAGE: false,
    FAST_MODE: true,
    COOLDOWN_OVERRIDE: 500,
}

if (isDev) {
    // STARTING_BLACK_MAGE_SPELLS.push(2);
}

if (!isDev) {
    FREEZE_AI = false;
    INJURED_MODE = false;
    SKIP_LEVEL_RESTRICTIONS = false;
    IMMEDIATE_LOOT = false;
    LOTSA_MP = false;
    ALLOW_SWITCHEROO_RANKED = true;
    MAX_AI_CHARACTERS = MAX_CHARACTERS;
    KILLALL_BM = false;
    KILLALL_WM = false;
    KILLALL_W = false;
    FREEZE_CAMERA = false;
}
