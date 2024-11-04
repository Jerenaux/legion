const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'docker';

// Gameplay
export const MAX_CHARACTERS = 10;
export const BASE_INVENTORY_SIZE = 20;
export const BASE_CARRYING_CAPACITY = 3;
export const STARTING_GOLD = 1000;
export const STARTING_CONSUMABLES = [0,0,1];
export const STARTING_WHITE_MAGE_SPELLS = [9];
export const STARTING_BLACK_MAGE_SPELLS = [0];
export const XP_PER_LEVEL = 50;
export const AVERAGE_GOLD_REWARD_PER_GAME = 100; 
export const MAX_AUDIENCE_SCORE = 1500;
export const PROMOTION_RATIO = 0.2;
export const DEMOTION_RATIO = 0.2;
export const SEASON_END_CRON = '0 19 * * 5' // UTC
export const KILL_CAM_DURATION = 3000;
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
export const eloRangeStart = 50;
export const eloRangeStep = 50; // Increase range by 50 points every interval
export const goldRewardInterval = 15;
export const goldReward = 1;
export const casualModeThresholdTime = 5; // seconds after which redirection probability starts increasing
export const maxWaitTimeForPractice = 60; // maximum wait time after which a player is guaranteed to be redirected
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
export const ENABLE_ELYSIUM = true;

// Admin
export let FREEZE_AI = true;
export const STARTING_GOLD_ADMIN = 100000;
export const STARTING_SPELLS_ADMIN = [2];
export const STARTING_EQUIPMENT_ADMIN = [2];
export let INJURED_MODE = false;
export let SKIP_LEVEL_RESTRICTIONS = true;
export let IMMEDIATE_LOOT = false;
export let LOTSA_MP = false;

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

export const remoteConfig = {
    AUTO_DEFEAT: false,
    HIGH_DAMAGE: false,
    FAST_MODE: true,
    COOLDOWN_OVERRIDE: 500,
}

if (isDev) {
    STARTING_BLACK_MAGE_SPELLS.push(2);
}

if (!isDev) {
    FREEZE_AI = false;
    INJURED_MODE = false;
    SKIP_LEVEL_RESTRICTIONS = false;
    IMMEDIATE_LOOT = false;
    LOTSA_MP = false;
    ALLOW_SWITCHEROO_RANKED = true;
}