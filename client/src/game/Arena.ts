import {route} from 'preact-router';
import {damageAmount, effectAmount, MELEE_POTENCY, STEAM_TURNS} from '@legion/shared/combatBalance';
import { itemNoEffectReason, type ItemNoEffectReason } from '@legion/shared/itemUse';
import {t, userError, localizedAsset, language, fontFamily} from '../i18n/core';
import { io } from 'socket.io-client';
import { Player } from './Player';
import { GameHUD, events } from '../components/HUD/GameHUD';
import { Team } from './Team';
import { MusicManager } from './MusicManager';
import {setRouteMusic} from '../routeMusic';
import {watchAudioContext} from '../audioRecovery';
import { getSpellById } from '@legion/shared/Spells';
import { serializeCoords, hexDistance, isInSpellRange, listCellsOnTheWay } from '@legion/shared/utils';
import { getFirebaseIdToken } from '../services/apiService';
import { allSprites } from '@legion/shared/sprites';
import { PlayMode, Target, Terrain, StatusEffect, GEN, AIAttackMode, TargetHighlight, Stat, Class } from "@legion/shared/enums";
import { TerrainUpdate, GameData, GameReplayMessage, OutcomeData, PlayerNetworkData, TurnQueueEntry, TurnState } from '@legion/shared/interfaces';
import {createRefreshingSocketAuth, retrySocketAuthentication, shouldAbandonGame, socketReconnectOptions} from '../services/socketPolicy';
import { KILL_CAM_DURATION, BASE_ANIM_FRAME_RATE, FREEZE_CAMERA, GRID_WIDTH, GRID_HEIGHT,
     SPELL_RANGE, PROJECTILE_DURATION, CAST_ZOOM } from '@legion/shared/config';

import iceblockImage from '@assets/iceblock.png';
import meltdownImage from '@assets/meltdown.png';

import smokeImage from '@assets/vfx/smoke.png';
import potionHealImage from '@assets/vfx/potion_heal.png';
import castImage from '@assets/vfx/cast.png';
import slashImage from '@assets/vfx/slash.png';
import impactImage from '@assets/vfx/sword_impact.png';
import poisonImage from '@assets/vfx/poison.png';
import muteImage from '@assets/vfx/mute.png';
import reviveImage from '@assets/vfx/revive.png';

import statusesImage from '@assets/States.png';

import clickSFX from '@assets/sfx/click_2.wav';
import slashSFX from '@assets/sfx/swish_2.wav';
import stepsSFX from '@assets/sfx/steps.wav';
import nopeSFX from '@assets/sfx/nope.wav';
import heartSFX from '@assets/sfx/heart.wav';
import cooldownSFX from '@assets/sfx/cooldown.wav';
import shatterSFX from '@assets/sfx/shatter.wav';
import flamesSFX from '@assets/sfx/flame.wav';
import castSoundSFX from '@assets/sfx/spells/cast.wav';
import fireballSFX from '@assets/sfx/spells/fire_3.wav';
import thunderSoundSFX from '@assets/sfx/spells/thunder.wav';
import iceSoundSFX from '@assets/sfx/spells/ice.wav';
import healingSFX from '@assets/sfx/spells/healing.wav';
import reviveSFX from '@assets/sfx/spells/revive.wav';
import poisonSoundSFX from '@assets/sfx/spells/poison.wav';
import muteSoundSFX from '@assets/sfx/spells/mute.wav';
import bgmStartSFX from '@assets/music/bgm_start.wav';
import thudSFX from '@assets/sfx/thud.wav';
import impactPunchSFX from '@assets/sfx/impact_punch.wav';
import impactSwordSFX from '@assets/sfx/impact_sword.wav';
import jingleWinSFX from '@assets/sfx/jingle_win.wav';
import jingleLoseSFX from '@assets/sfx/jingle_lose.wav';
import levelUpSFX from '@assets/sfx/level_up.wav';

import speechBubble from '@assets/speech_bubble.png';
import speechTail from '@assets/speech_tail.png';

import groundTilesImage from '@assets/tiles2.png';
import groundTilesAtlas from '@assets/tiles2.json';
import { errorToast, recordLoadingStep, silentErrorToast } from '../components/utils';
import { BaseSpell } from '@legion/shared/BaseSpell';
import { BaseItem } from '@legion/shared/BaseItem';

import { HexGridManager, HighlightType, TileColors } from './HexGridManager';
import { TutorialManager } from './TutorialManager';

import hexTileImage from '@assets/tile.png';
import { VFXconfig, fireLevels, terrainFireLevels, chargedFireLevels,
    chargedIceLevels, chargedThunderLevels, iceLevels, thunderLevels,
    healLevels, VFX_FRAME_SIZE, VFX_DISPLAY_SCALE } from './VFXconfig';
import {loadGameSettings, sfxGain} from '../settings';
import {sfxLevel} from '../sfxMix';
import {DESKTOP_ACTION_EVENT, DesktopAction} from '../input/actions';
import type {CharacterHover} from '../components/HUD/CharacterHoverCard';
import {NUMBER_COLORS} from './Player';
import {cameraNudgeEnabled, rumble, screenEffectsEnabled, shake} from './feedback';
import {shatterIce} from './iceShatter';

/** Sounds that loop or get stopped keep one instance; everything else may overlap a few times. */
const PERSISTENT_SOUNDS = new Set(['cast', 'heart', 'flames', 'jingle_win', 'jingle_lose', 'level_up']);
const MAX_SOUND_COPIES = 3;
/** The 19-tile X tier: Fire X, Ice X, Thunder X. */
const isUltimate = (spell: BaseSpell) => spell.target === Target.AOE && spell.radius >= 3;
/** Server announcements plus the client's own. */
type Announcement = GEN | 'rampage';
/** Sent actions that end the turn. */
const ACTION_CHANNELS = new Set(['move', 'attack', 'obstacleattack', 'spell', 'useitem']);
const EMBER_TINTS = [0xfff1c2, 0xffc46b, 0xff8a3c, 0xff5a1f];
const CHARGE_TINTS: Record<string, number[]> = {
    fire: [0xffd27a, 0xff9a3c, 0xff5a1f],
    ice: [0xe6fbff, 0xa8e6ff, 0x6fc8ff],
    thunder: [0xfffbd0, 0xfff07a, 0xd0c0ff],
};

const LOCAL_ANIMATION_SCALE = 2;
const DEPTH_OFFSET = 0.01;
export const DARKENING_INTENSITY = 0.9;
const TINT_COLOR = Math.round(0x66 * DARKENING_INTENSITY) * 0x010101;
const AIR_ENTRANCE_DELAY = 750;
const AIR_ENTRANCE_DELAY_VARIANCE = 200;
/** After the last blow (and its kill cam): pause, then the jingle and celebration, then the result screen. */
const RESULT_DELAY_MS = 700;
const RESULT_SCREEN_DELAY_MS = 1800;
const spellSheetFiles = require.context('@assets/vfx', false, /^\.\/(fire_[123]_explosion|terrain_fire_1|charged_(fire|ice|thunder)_[12]|(ice|thunder|heal)_[123])\.png$/);
const SPELL_SHEETS = [
    ...fireLevels.map(level => `fire_${level}_explosion`),
    ...iceLevels.map(level => `ice_${level}`),
    ...thunderLevels.map(level => `thunder_${level}`),
    ...healLevels.map(level => `heal_${level}`),
    ...terrainFireLevels.map(level => `terrain_fire_${level}`),
    ...chargedFireLevels.map(level => `charged_fire_${level}`),
    ...chargedIceLevels.map(level => `charged_ice_${level}`),
    ...chargedThunderLevels.map(level => `charged_thunder_${level}`),
];

export class Arena extends Phaser.Scene
{
    gamehud;
    socket;
    HUD;
    playerTeamId;
    gridCorners;
    gridMap: Map<string, Player> = new Map<string, Player>();
    teamsMap: Map<number, Team> = new Map<number, Team>();
    selectedPlayer: Player | null = null;
    hoveredPlayer: Player | null = null;
    private hoverSource: 'battlefield' | 'hud' | null = null;
    private characterHover: CharacterHover | null = null;
    private hoverPreviewKey = '';
    private hoverPreviewValue: CharacterHover['preview'];
    localAnimationSprite: Phaser.GameObjects.Sprite;
    terrainSpritesMap: Map<string, Phaser.GameObjects.Sprite> = new Map<string, Phaser.GameObjects.Sprite>();
    terrainMap: Map<string, Terrain> = new Map<string, Terrain>();
    server;
    animationScales;
    SFX;
    overviewReady = false;
    musicManager: MusicManager;
    private stopAudioRecovery: (() => void) | null = null;
    sprites: Phaser.GameObjects.Sprite[] = [];
    environmentalAudioSources;
    gameSettings;
    killCamActive = false;
    pendingGEN: GEN;
    genQueue: Announcement[] = [];
    isDisplayingGEN: boolean = false;
    eventsQueue = [];
    private readyToken: string | null = null;
    private tutorialIntroPending = false;
    private tutorialIntroShown = false;
    private nextTutorialWaitingAt = 0;
    private legacyFirstMatch = false;
    private arenaDisplayed = false;
    private pendingEntrances = 0;
    sceneCreated = false;
    gameInitialized = false;
    gameEnded = false;
    sfxVolume: number;
    inputLocked = false;
    handSprite: Phaser.GameObjects.Sprite;
    queue: TurnQueueEntry[];
    turnee: TurnState | null;
    isReplay: boolean = false;
    replayData: {messages: GameReplayMessage[]} | null = null;
    replayTimer: Phaser.Time.TimerEvent = null;
    currentReplayIndex: number = 0;
    eventHandlers: Map<string, Function>;
    isDarkened: boolean = false;
    tutorialManager: TutorialManager;
    hexGridManager: HexGridManager;

    // Add to the class properties at the top of the file
    // Add this class property at the top of the Arena class
    private isZoomedForSpellCast: boolean = false;

    private static readonly GEN_CONFIGS = {
        [GEN.COMBAT_BEGINS]: { label: 'Combat begins!', asset: 'announcements/combat-begins.png', text1: 'combat', text2: 'begins' },
        [GEN.MULTI_KILL]: { label: 'Multi-kill!', asset: 'announcements/multi-kill.png', text1: 'multi', text2: 'kill' },
        [GEN.MULTI_HIT]: { label: 'Multi-hit!', asset: 'announcements/multi-hit.png', text1: 'multi', text2: 'hit' },
        [GEN.ONE_SHOT]: { label: 'One shot!', asset: 'announcements/one-shot.png', text1: 'one', text2: 'shot' },
        [GEN.FROZEN]: { label: 'Frozen!', asset: 'announcements/frozen.png', text1: 'frozen', text2: null },
        [GEN.BURNING]: { label: 'Burning!', asset: 'announcements/burning.png', text1: 'stuff-is', text2: 'on-fire' },
        [GEN.TUTORIAL]: { label: 'Tutorial!', asset: 'announcements/tutorial.png', text1: 'tutorial', text2: null },
        // Client-side announcement without word artwork: drawn as lettering in the same style.
        rampage: { label: 'Rampage!', asset: 'announcements/rampage.png', text1: null, text2: null },
    };

    private static readonly SOUND_NAMES = [
        'click', 'slash', 'steps', 'nope', 'heart', 'cooldown', 'fireball',
        'healing', 'cast', 'thunder', 'ice', 'shatter', 'flames',
        'poison', 'mute', 'thud', 'revive', 'impact_punch', 'impact_sword',
        'jingle_win', 'jingle_lose', 'level_up',
    ];

    private isInTargetMode: boolean = false;
    private targetModeSize: number = 1;
    private targetModeListener: ((pointer: Phaser.Input.Pointer) => void) | null = null;
    private disposed = false;
    private towerWarningMarkers: Phaser.GameObjects.Text[] = [];
    /** Tiles where ice can't form: Warmth zones and the ring around flames. */
    private warmTiles = new Map<string, {image: Phaser.GameObjects.Graphics, fade: number}>();
    private warmPulse = {value: 1};
    private warmMotes?: Phaser.GameObjects.Particles.ParticleEmitter;
    /** Steam clouds where heat melted ice; melee into them can miss. */
    private steamClouds = new Map<string, {emitter: Phaser.GameObjects.Particles.ParticleEmitter, turns: number}>();
    private hudHandlers: Record<string, (...args: unknown[]) => void> = {};
    private selfItemPreview: {x: number; y: number; player: Player} | null = null;
    private soundCopies = new Map<string, number>();
    private sparkEmitter: Phaser.GameObjects.Particles.ParticleEmitter;
    private emberEmitter: Phaser.GameObjects.Particles.ParticleEmitter;
    private tintedSparkEmitter: Phaser.GameObjects.Particles.ParticleEmitter;
    /** Where the latest spell landed, so the characters it hits recoil away from it. */
    private lastImpact: {x: number; y: number; at: number} | null = null;
    private killCamCheck: Phaser.Time.TimerEvent | null = null;
    /** Killing spells still travelling to their target. */
    private killsInFlight = 0;
    /** An action was sent this turn: previews describe the next action, so they wait for the next turn. */
    private actionPending = false;
    /** Where the camera rests between kill cams and cinematics: the centre, or a turn nudge. */
    private cameraHome = {x: 0, y: 0};
    private cinematic: {caster: Player; overlay: Phaser.GameObjects.Rectangle} | null = null;
    /** Who last struck a blow, so a knockout can be credited to them. */
    private lastBlow: {by: Player; at: number} | null = null;
    private killsBy = new Map<Player, number>();
    /** Teams down to their last character, with the ember aura around the survivor. */
    private lastStands = new Map<number, Phaser.GameObjects.Particles.ParticleEmitter>();
    /** Lowest (own alive − enemy alive) seen, and own knockouts: for the Comeback and Flawless honours. */
    private worstDeficit = 0;
    private ownLosses = 0;
    private endKillCam: (() => void) | null = null;
    private afterKillCam: (() => void)[] = [];
    private movePreview: Phaser.GameObjects.GameObject[] = [];
    private damagePreviewTarget: Player | null = null;

    constructor() {
        super({ key: 'Arena' });
        this.sfxVolume = this.getSFXVolumeFromLocalStorage();

        // Initialize event handlers map
        const handlers = {
            gameStatus: this.initializeGame,
            replayData: this.handleReplayData,
            actionRejected: this.processActionRejected,
            move: this.processMove,
            attack: this.processAttack,
            obstacleattack: this.processObstacleAttack,
            inventory: this.processInventory,
            hpchange: this.processHPChange,
            statuseffectchange: this.processStatusChange,
            statusresisted: this.processStatusResisted,
            mpchange: this.processMPChange,
            manachange: this.processMPChange,
            useitem: this.processUseItem,
            cast: (data) => this.processCast(true, data),
            endcast: (data) => this.processCast(false, data),
            terrain: this.processTerrain,
            warmth: this.processWarmth,
            steam: this.processSteam,
            damageimmune: this.processDamageImmune,
            gen: (data) => {
                if (Array.isArray(data)) {
                    data.forEach(g => {
                        this.enqueueGEN(g);
                    });
                } else {
                    this.enqueueGEN(data.gen);
                }
            },
            localanimation: this.processLocalAnimation,
            gameEnd: this.processGameEnd,
            towerWarning: this.showTowerWarning,
            addCharacter: this.processAddCharacter,
            queueData: this.processQueueData,
            turnee: this.processTurnee,
        };

        this.eventHandlers = new Map(
            Object.entries(handlers).map(([event, handler]) =>
                [event, handler.bind(this)]
            )
        );
    }

    lockInput() {
        this.inputLocked = true;
    }

    unlockInput() {
        this.inputLocked = false;
    }

    getSFXVolumeFromLocalStorage(): number {
        return sfxGain();
    }

    preload()
    {
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
        this.events.once(Phaser.Scenes.Events.DESTROY, this.destroy, this);
        // console.log('Preloading assets ...');
        this.gamehud = new GameHUD();

        this.load.image('iceblock',  iceblockImage);
        this.load.spritesheet('meltdown',  meltdownImage, { frameWidth: 150, frameHeight: 150});
        this.load.image('speech_bubble', speechBubble);
        this.load.image('speech_tail', speechTail);

        this.load.spritesheet('potion_heal', potionHealImage, { frameWidth: 48, frameHeight: 64});

        this.load.spritesheet('smoke', smokeImage, { frameWidth: 96, frameHeight: 96});
        this.load.spritesheet('cast', castImage, { frameWidth: 48, frameHeight: 64});
        this.load.spritesheet('slash', slashImage, { frameWidth: 96, frameHeight: 96});
        this.load.spritesheet('impact', impactImage, { frameWidth: 291, frameHeight: 291});
        this.load.spritesheet('poison', poisonImage, { frameWidth: 64, frameHeight: 64});
        this.load.spritesheet('mute', muteImage, { frameWidth: 64, frameHeight: 64});
        this.load.spritesheet('statuses', statusesImage, { frameWidth: 96, frameHeight: 96});
        this.load.spritesheet('revive', reviveImage, { frameWidth: 48, frameHeight: 64});

        this.load.audio('click', clickSFX);
        this.load.audio('slash', slashSFX);
        this.load.audio('steps', stepsSFX);
        this.load.audio('nope', nopeSFX);
        this.load.audio('heart', heartSFX);
        this.load.audio('cooldown', cooldownSFX);
        this.load.audio('shatter', shatterSFX);
        this.load.audio('flames', flamesSFX);
        // this.load.audio('cheer', cheerSFX);
        this.load.audio('thud', thudSFX);
        this.load.audio('impact_punch', impactPunchSFX);
        this.load.audio('impact_sword', impactSwordSFX);
        this.load.audio('jingle_win', jingleWinSFX);
        this.load.audio('jingle_lose', jingleLoseSFX);
        this.load.audio('level_up', levelUpSFX);


        // Load spell sounds
        this.load.audio('cast', castSoundSFX);
        this.load.audio('fireball', fireballSFX);
        this.load.audio('thunder', thunderSoundSFX);
        this.load.audio('ice', iceSoundSFX);
        this.load.audio('healing', healingSFX);
        this.load.audio('poison', poisonSoundSFX);
        this.load.audio('mute', muteSoundSFX);
        this.load.audio('revive', reviveSFX);

        // Load music
        this.load.audio('bgm_start', bgmStartSFX);
        this.load.audio(`bgm_loop_1`, require(`@assets/music/bgm_loop_1.wav`));

        this.load.atlas('groundTiles', groundTilesImage, groundTilesAtlas);

        const GEN = ['gen_bg', 'begins', 'blood', 'blue_bang', 'combat', 'first', 'orange_bang', 'multi', 'kill',
            'hit', 'one', 'shot', 'frozen', 'stuff-is', 'on-fire', 'tutorial'];
        GEN.forEach((name) => {
            this.load.image(name, require(`@assets/GEN/${name}.png`));
        });

        for (const [id, config] of Object.entries(Arena.GEN_CONFIGS)) {
            const localized = localizedAsset(config.asset, '');
            if (localized) this.load.image(`announcement_${id}`, localized);
        }

        this.load.on('progress', (value) => {
            events.emit('progressUpdate', Math.floor(value * 100));
        });

        this.load.on('complete', () => {
            events.emit('progressUpdate', 100);
            // Remove listener
            this.load.off('progress');
            this.load.off('complete');
        });
        this.load.on('loaderror', file => this.failCombat(new Error('Could not load arena asset: ' + file.key)));
        this.connectToServer().catch(this.failCombat);

        this.load.image('hexTile', hexTileImage);
    }

    extractGameIdFromUrl() {
        const pathArray = window.location.pathname.split('/');
        // Assuming the URL pattern is "/game/{gameId}", and "game" is always at a fixed position
        const gameIdIndex = pathArray.findIndex(element => element === 'game') + 1;
        return pathArray[gameIdIndex];
    }

    async connectToServer(serverURL = process.env.GAME_SERVER_URL) {
        console.log('Connecting to the server ...');
        const pathParts = window.location.pathname.split('/');
        const isReplay = pathParts[1] === 'replay';
        const gameId = pathParts[2];

        this.socket = io(
            serverURL,
            {
                ...socketReconnectOptions,
                forceNew: true, // The global Socket.IO manager cache must not retain a finished Arena.
                auth: createRefreshingSocketAuth(
                    () => getFirebaseIdToken(),
                    {gameId, isReplay, combatReady: 1},
                ),
            }
        );

        this.eventHandlers.forEach((_handler, event) => {
            this.socket.on(event, data => this.enqueueMessage(event, data));
        });
        this.socket.on('towerEnd', () => { route('/tower'); });
        this.socket.on('connect_error', error => {
            if (retrySocketAuthentication(this.socket, error, getFirebaseIdToken, () => !this.gameEnded)) return;
            if (!this.socket.active) this.failCombat(error);
        });

        // Add special handlers that aren't part of the regular game flow
        this.socket.on('connect', () => {
            // console.log('Connected to the server');
        });

        this.socket.on('disconnect', (reason) => {
            if (shouldAbandonGame(reason)) {
                console.error(`Server disconnect during game: ${reason}`);
                silentErrorToast(t("Disconnected from server"));
                events.emit('serverDisconnect');
                this.destroy();
            } else if (!this.disposed) {
                events.emit('combatConnectionLost');
            }
        });

        this.socket.io.on('reconnect_failed', this.handleReconnectFailure);

        this.socket.on('joinError', (error) => {
            console.error('Could not join game:', error);
            events.emit('serverDisconnect');
            this.destroy();
        });

        this.socket.on('error', (error) => {
            console.error('Error:', error);
            errorToast(userError(error));
        });

    }

    sendMove(x, y) {
        const data = {
            tile: { x, y},
        };
        this.send('move', data);
        events.emit('performAction');
    }

    sendAttack(player: Player) {
        if (!this.selectedPlayer?.canAct()) return;
        const data = {
            target: player.num,
            sameTeam: player.team.id === this.selectedPlayer.team.id,
        };
        this.send('attack', data);
        events.emit('performAction');
    }

    sendObstacleAttack(x, y) {
        if (!this.selectedPlayer?.canAct()) return;
        const data = {
            x,
            y,
        };
        this.send('obstacleattack', data);
    }

    sendSpell(x: number, y: number, player: Player | null) {
        console.log(`[Arena:sendSpell] Sending spell at ${x}, ${y}`);
        if (!this.selectedPlayer || !this.selectedPlayer.canAct()) return;
        const data = {
            x,
            y,
            index: this.selectedPlayer.pendingSpell,
            targetTeam: player?.team.id,
            target: player?.num,
        };
        this.send('spell', data);
        this.selectedPlayer.cancelSkill();
        events.emit(`playerCastSpell_${data.index}`);
        events.emit('performAction');
    }

    sendUseItem(index: number, x: number, y: number, player: Player | null) {
        if (!this.selectedPlayer.canAct()) return;
        const data = {
            x,
            y,
            index,
            targetTeam: player?.team.id,
            target: player?.num,
        };
        this.send('useitem', data);
        this.selectedPlayer.cancelItem();
        const item = this.selectedPlayer.inventory[index];
        events.emit(`playerUseItem_${item.id}`);
        events.emit('performAction');
    }

    processActionRejected(turn: TurnState & {reason?: ItemNoEffectReason}) {
        if (this.gameEnded || turn.turnNumber !== this.turnee?.turnNumber ||
            turn.team !== this.turnee.team || turn.num !== this.turnee.num) return;
        this.actionPending = false;
        this.unlockInput();
        this.selectedPlayer?.cancelItem();
        this.selectTurnee();
        if (turn.reason && this.selectedPlayer) this.showNoEffect(this.selectedPlayer, turn.reason);
        else this.actionFeedback(t("That action is no longer valid. Choose another action."));
    }

    /** In-world hint above the target when a consumable would do nothing; returns true if shown. */
    showItemNoEffect(item: BaseItem, target: Player): boolean {
        const reason = itemNoEffectReason(item, {
            alive: target.isAlive(), hp: target.hp, maxHP: target.maxHP, mp: target.mp, maxMP: target.maxMP,
            hasStatus: status => Boolean(target.statuses?.[status]),
        });
        if (reason) this.showNoEffect(target, reason);
        return reason !== null;
    }

    private showNoEffect(target: Player, reason: ItemNoEffectReason) {
        const message = {
            'hp-full': t("HP already full"),
            'mp-full': t("MP already full"),
            'not-knocked-out': t("Only revives a fallen ally"),
            'no-status': t("Nothing to cure"),
        }[reason];
        target.displayOverheadText(message, 1800, '#ffe3a1');
        this.playSound('nope');
    }

    endTutorial() {
        if (this.socket) {
            this.socket.emit('endTutorial');
        }
    }

    send(channel, data) {
        if (ACTION_CHANNELS.has(channel)) this.actionPending = true;
        if (this.socket) {
            this.socket.emit(channel, data);
        }
    }

    getStartXY() {
        const totalWidth = HexGridManager.HEX_WIDTH * GRID_WIDTH;
        const totalHeight = HexGridManager.HEX_HEIGHT * GRID_HEIGHT;
        const gameWidth = this.scale.gameSize.width;
        const gameHeight = this.scale.gameSize.height;
        const verticalOffset = 200;
        const startX = (gameWidth - totalWidth) / 2;
        const startY = (gameHeight - totalHeight) / 2 + verticalOffset;
        return {startX, startY};
    }

    setUpArena() {
        const {startX, startY} = this.getStartXY();

        this.gridCorners = {
            startX,
            startY,
        };

       this.input.on('pointerdown', function (pointer) {
           if (pointer.rightButtonDown()) {
               this.selectedPlayer?.cancelSkill();
               this.selectedPlayer?.displayMovementRange();
               return;
           }
       }, this);

        this.input.setPollAlways();
        this.input.on('pointermove', (_pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
            // Phaser retains its over-object when DOM HUD elements cover the canvas.
            const player = over[0]?.parentContainer;
            if (player instanceof Player) this.inspectBattlefieldCharacter(player);
        });
        this.input.on('gameout', () => {
            if (this.hoverSource === 'battlefield') this.clearCharacterHover();
        });
    }

    toggleTargetMode(flag: boolean) {
        if (flag) {
            const spell = this.selectedPlayer?.spells[this.selectedPlayer?.pendingSpell];
            const isAllyTargetingSpell = spell?.targetHighlight === TargetHighlight.ALLY;

            this.isInTargetMode = true;
            this.clearMovePreview();
            this.targetModeSize = spell?.radius - 1|| 0;
            this.hexGridManager.toggleTargetMode(true);

            // Add pointer move listener to highlight tiles in radius as cursor moves
            if (!this.targetModeListener) {
                this.targetModeListener = (pointer: Phaser.Input.Pointer) => {
                    if (this.isInTargetMode) {
                        this.updateTargetHighlight(pointer);
                    }
                };
                this.input.on('pointermove', this.targetModeListener);
            }

            // Clear any existing highlights
            this.hexGridManager.clearHighlight();

            // Highlight target range
            if (this.selectedPlayer) {
                this.hexGridManager.highlightTargetRange(
                    this.selectedPlayer.gridX,
                    this.selectedPlayer.gridY,
                    this.selectedPlayer.distance,
                    isAllyTargetingSpell
                );
            }
            events.emit('pendingSpell');
        } else {
            // Exit target mode
            this.isInTargetMode = false;
            this.targetModeSize = 1;
            this.hexGridManager.toggleTargetMode(false);

            // Clear all highlighted tiles
            this.hexGridManager.clearHighlight();

            // Remove the pointer move listener
            if (this.targetModeListener) {
                this.input.off('pointermove', this.targetModeListener);
                this.targetModeListener = null;
            }

            events.emit('clearPendingSpell');
            this.brightenScene();
            this.selectedPlayer?.displayMovementRange();
        }
    }

    toggleItemMode(flag: boolean) {
        if (flag) {
            this.hexGridManager.clearHighlight();

            // Highlight target range if there's a selected player
            if (this.selectedPlayer) {
                this.hexGridManager.highlightTargetRange(
                    this.selectedPlayer.gridX,
                    this.selectedPlayer.gridY,
                    this.selectedPlayer.distance
                );
            }

            events.emit('pendingItem');
            // this.darkenScene(item?.targetHighlight);
        } else {
            events.emit('clearPendingItem');
            // this.brightenScene();
        }
    }

    handleDesktopAction = (event: CustomEvent<{action: DesktopAction}>) => {
        if (this.tutorialIntroPending || this.inputLocked || !this.gameInitialized) return;
        const {action} = event.detail;
        const slot = /^(item|spell)-(\d)$/.exec(action);
        if (slot) {
            // Like the other combat shortcuts, slot keys stay inactive while a dialog is open.
            if (document.querySelector('[role="dialog"], [aria-modal="true"]')) return;
            const index = Number(slot[2]) - 1;
            this.selectedPlayer?.onKey(slot[1] === 'spell' ? this.selectedPlayer.getSpellsIndex() + index : index);
            return;
        }
        const members = this.teamsMap.get(this.playerTeamId)?.members.filter(player => player.isAlive()) || [];
        if (action.startsWith('select-unit-')) {
            this.selectOwnUnit(members[Number(action.at(-1)) - 1]);
        } else if ((action === 'next-unit' || action === 'previous-unit') && members.length) {
            const current = members.indexOf(this.selectedPlayer);
            const direction = action === 'next-unit' ? 1 : -1;
            this.selectOwnUnit(members[(current + direction + members.length) % members.length]);
        } else if (action === 'cancel') {
            this.selectedPlayer?.cancelItem();
            this.clearCharacterHover();
            this.selectedPlayer?.cancelSkill();
            this.selectTurnee();
        }
    };

    selectOwnUnit(player?: Player) {
        if (!player) return;
        this.deselectPlayer();
        this.selectPlayer(player);
    }

    isFree(gridX, gridY) {
        return !this.gridMap.get(serializeCoords(gridX, gridY)) &&
               !this.hexGridManager.hasObstacle(gridX, gridY) &&
               !this.hexGridManager.isHole(gridX, gridY);
    }

    hasPlayer(gridX, gridY) {
        return this.gridMap.has(serializeCoords(gridX, gridY));
    }

    handleTileClick(gridX, gridY) {
        if (this.tutorialIntroPending) return;
        console.log(`[Arena:handleTileClick] Clicked on tile: ${gridX}, ${gridY}`);
        if (this.inputLocked) {
            this.unlockInput();
            return;
        }

        const player = this.gridMap.get(serializeCoords(gridX, gridY));
        const unavailable = this.unavailableActionReason();
        if (unavailable) {
            // Let a player return to the active unit after inspecting another one.
            if (player?.isPlayer && player === this.getPlayer(this.turnee?.team, this.turnee?.num) && player !== this.selectedPlayer) {
                this.selectTurnee();
            } else {
                this.actionFeedback(unavailable);
            }
            return;
        }
        const pendingSpell = this.selectedPlayer?.spells[this.selectedPlayer?.pendingSpell];
        const pendingItem = this.selectedPlayer?.inventory[this.selectedPlayer?.pendingItem];
        if (pendingSpell != null) {
            if (!this.validateTarget(gridX, gridY, pendingSpell)) {
                this.actionFeedback(t("Choose a highlighted target in range."));
                this.playSound('nope');
                return;
            }
            this.sendSpell(gridX, gridY, player);
        } else if (pendingItem != null) {
            if (!this.validateTarget(gridX, gridY, pendingItem)) {
                this.actionFeedback(t("Choose a highlighted target in range."));
                this.playSound('nope');
                return;
            }
            if (player && pendingItem.target === Target.SINGLE && this.showItemNoEffect(pendingItem, player)) return;
            this.sendUseItem(this.selectedPlayer?.pendingItem, gridX, gridY, player);
        } else if ((!player || !player.isAlive()) && this.hexGridManager.hasObstacle(gridX, gridY)) {
            this.sendObstacleAttack(gridX, gridY);
        } else if (this.selectedPlayer && !player && this.selectedPlayer.canMoveTo(gridX, gridY)) {
            this.handleMove(gridX, gridY);
        } else if (player){
            player.onClick();
        } else {
            this.actionFeedback(t("Outside movement range. Choose a blue tile."));
        }
    }

    handleTileHover(gridX, gridY, hover = true) {
        const player = this.gridMap.get(serializeCoords(gridX, gridY));
        if (hover && !player) this.showMovePreview(gridX, gridY);
        else this.clearMovePreview();
        if (hover && player) {
            this.inspectBattlefieldCharacter(player);
        } else if (this.hoverSource === 'battlefield' && (!hover ? this.hoveredPlayer === player : true)) {
            this.clearCharacterHover();
        }
    }

    inspectBattlefieldCharacter(player: Player) {
        this.setCharacterHover(player, 'battlefield');
        this.updateTargetHighlight(this.input.activePointer);
    }

    clearBattlefieldCharacter(player: Player) {
        if (this.hoverSource === 'battlefield' && this.hoveredPlayer === player) this.clearCharacterHover();
    }

    private inspectHUDCharacter = (team: number, num: number, anchor?: DOMRect) => {
        if (anchor) this.setCharacterHover(this.teamsMap.get(team)?.getMember(num), 'hud', anchor);
        else if (this.hoverSource === 'hud' && this.hoveredPlayer?.team.id === team && this.hoveredPlayer.num === num) {
            this.clearCharacterHover();
        }
    };

    private setCharacterHover(player: Player | undefined, source: 'battlefield' | 'hud', anchor?: DOMRect) {
        if (!player || !this.gameInitialized || this.gameEnded) return;
        if (this.hoveredPlayer === player && this.hoverSource === source && !anchor) return;
        this.clearCharacterHover();
        this.hoveredPlayer = player;
        this.hoverSource = source;
        player.setHovered(true);
        if (source === 'battlefield') player.onPointerOver();
        if (anchor) {
            this.characterHover = {team: player.team.id, num: player.num,
                left: anchor.left, right: anchor.right, top: anchor.top, bottom: anchor.bottom, preview: this.getHPPreview(player)};
            events.emit('characterHoverChanged', this.characterHover);
        } else this.refreshCharacterHover();
    }

    /** Blink the predicted loss on the target's own bar, not only in the HUD. */
    private showDamagePreview(target: Player | null, preview?: CharacterHover['preview']) {
        if (this.damagePreviewTarget && this.damagePreviewTarget !== target) this.damagePreviewTarget.healthBar?.setPreview(null);
        this.damagePreviewTarget = target;
        if (!target) return;
        target.healthBar?.setPreview(preview && preview.hp < 0 ? (target.hp + preview.hp) / target.maxHP : null);
    }

    clearCharacterHover = () => {
        this.showDamagePreview(null);
        this.hoverPreviewKey = '';
        if (this.hoveredPlayer) {
            this.hoveredPlayer.setHovered(false);
            if (this.hoverSource === 'battlefield') this.hoveredPlayer.onPointerOut();
        }
        this.hoveredPlayer = null;
        this.hoverSource = null;
        this.characterHover = null;
        events.emit('characterHoverChanged', null);
    };

    private sameHover(a: CharacterHover | null, b: CharacterHover) {
        return !!a && a.team === b.team && a.num === b.num && a.left === b.left && a.right === b.right &&
            a.top === b.top && a.bottom === b.bottom && a.preview?.hp === b.preview?.hp && a.preview?.action === b.preview?.action;
    }

    // Runs every frame while hovering: recompute the preview only when one of its inputs changes.
    private hoverPreview(target: Player): CharacterHover['preview'] {
        const caster = this.selectedPlayer;
        const key = [this.isReplay, this.gameSettings?.spectator, this.gameEnded, this.inputLocked, this.actionPending,
            this.turnee?.team, this.turnee?.num, caster?.team.id, caster?.num, caster?.pendingSpell, caster?.pendingItem,
            caster?.mp, caster?.gridX, caster?.gridY, caster?.isMuted(), caster?.isFrozen(), caster?.canAct(),
            target.team.id, target.num, target.hp, target.gridX, target.gridY, target.isAlive()].join();
        if (key !== this.hoverPreviewKey) {
            this.hoverPreviewKey = key;
            this.hoverPreviewValue = this.getHPPreview(target);
            this.showDamagePreview(target, this.hoverPreviewValue);
        }
        return this.hoverPreviewValue;
    }

    private refreshCharacterHover = () => {
        const player = this.hoveredPlayer;
        if (!player) return;
        if (this.hoverSource === 'hud') {
            const next = {...this.characterHover, preview: this.hoverPreview(player)};
            if (!this.sameHover(this.characterHover, next)) {
                this.characterHover = next;
                events.emit('characterHoverChanged', next);
            }
            return;
        }
        const camera = this.cameras.main;
        const canvas = this.game.canvas.getBoundingClientRect();
        const scaleX = canvas.width / this.scale.gameSize.width;
        const scaleY = canvas.height / this.scale.gameSize.height;
        const next = {team: player.team.id, num: player.num, preview: this.hoverPreview(player),
            left: canvas.left + (camera.x + (player.x - 34 - camera.worldView.x) * camera.zoom) * scaleX,
            right: canvas.left + (camera.x + (player.x + 34 - camera.worldView.x) * camera.zoom) * scaleX,
            top: canvas.top + (camera.y + (player.y - 54 - camera.worldView.y) * camera.zoom) * scaleY,
            bottom: canvas.top + (camera.y + (player.y + 62 - camera.worldView.y) * camera.zoom) * scaleY};
        if (!this.sameHover(this.characterHover, next)) {
            this.characterHover = next;
            events.emit('characterHoverChanged', next);
        }
    };

    private getHPPreview(target: Player): CharacterHover['preview'] {
        const caster = this.selectedPlayer;
        if (this.isReplay || this.gameSettings?.spectator || this.gameEnded || this.inputLocked || this.actionPending ||
            !caster?.combatStats || !target.combatStats || this.unavailableActionReason(caster) || caster.pendingItem != null) return;
        const spell = caster.pendingSpell == null ? null : caster.spells[caster.pendingSpell];
        let hp = target.hp;
        if (spell) {
            if (caster.isMuted() || spell.cost > caster.mp || !this.validateTarget(target.gridX, target.gridY, spell)) return;
            const stats = (player: Player) => ({level: player.level, getStat: (stat: Stat) => player.combatStats[stat] ?? 0});
            for (const effect of spell.effects) {
                if (effect.stat !== Stat.HP || (effect.onKO ? target.isAlive() : !target.isAlive())) continue;
                // Ice shields a frozen character from damage.
                if (effect.value < 0 && target.isFrozen()) continue;
                const amount = effectAmount(effect, stats(caster), stats(target));
                hp = Math.max(0, Math.min(target.maxHP, hp + (effect.value < 0 ? -amount : amount)));
            }
        } else {
            if (target === caster || !target.isTarget() || !caster.isNextTo(target.gridX, target.gridY) || target.isFrozen()) return;
            hp = Math.max(0, hp - damageAmount(MELEE_POTENCY, caster.level, caster.combatStats[Stat.ATK], target.combatStats[Stat.DEF]));
        }
        if (hp !== target.hp) return {hp: hp - target.hp, action: spell?.name ?? 'Attack'};
    }

    validateTarget(gridX, gridY, action: BaseSpell | BaseItem) {
        if (!isInSpellRange(this.selectedPlayer.gridX, this.selectedPlayer.gridY, gridX, gridY)) return false;
        if (action.target === Target.AOE && action.radius > 1) {
            return true;
        }
        const character = this.gridMap.get(serializeCoords(gridX, gridY));
        if (!character && action.target === Target.SINGLE) return false;
        const isAlly = character?.team.id === this.playerTeamId;
        if (action.targetHighlight === TargetHighlight.ALLY && isAlly) {
            return true;
        } else if ((action.targetHighlight === undefined || action.targetHighlight === TargetHighlight.ENEMY) && !isAlly) {
            return true;
        } else if (action.targetHighlight === TargetHighlight.DEAD && !character?.isAlive()) {
            return true;
        }
        return false;
    }

    handleMove(gridX, gridY) {
        if (!this.selectedPlayer.canMoveTo(gridX, gridY) || !this.hexGridManager.isValidCell(this.selectedPlayer.gridX, this.selectedPlayer.gridY, gridX, gridY, this.isFree.bind(this))) {
            this.playSound('nope');
            this.actionFeedback(t("You cannot reach that tile. Choose an empty blue tile."));
            return;
        }
        this.playSound('click');
        this.clearMovePreview();
        this.sendMove(gridX, gridY);
        this.hexGridManager.clearHighlight();
    }

    refreshBox() {
        const isPlayerTurn = Boolean(this.turnee && this.turnee.team === this.playerTeamId);
        const commandPlayer = isPlayerTurn ? (this.selectedPlayer?.isPlayer ? this.selectedPlayer : this.getPlayer(this.playerTeamId, this.turnee.num)) : null;
        const canCommand = !this.gameEnded && !this.gameSettings.spectator && commandPlayer === this.selectedPlayer && commandPlayer?.canAct() &&
            this.turnee?.team === commandPlayer.team.id && this.turnee?.num === commandPlayer.num;
        events.emit('showPlayerBox', this.selectedPlayer?.getProps() || null,
            commandPlayer?.getProps() || null, Boolean(canCommand), isPlayerTurn);
        this.refreshTutorial();
    }

    refreshTutorial() {
        if (!this.tutorialManager || !this.turnee) return;
        const active = this.getPlayer(this.turnee.team, this.turnee.num);
        if (!active) return;
        const player = this.selectedPlayer;
        const availableSpells = active.isMuted() ? [] : active.spells.filter(spell => spell.cost <= active.mp);
        const hasTarget = (spell: BaseSpell) => {
            // Fire targets tiles, including empty ground, not just characters.
            for (let x = 0; x < GRID_WIDTH; x++) for (let y = 0; y < GRID_HEIGHT; y++) {
                if (this.hexGridManager.getTile(x, y) && this.validateTarget(x, y, spell)) return true;
            }
            return false;
        };
        events.emit('tutorialContext', {
            turn: this.turnee.turnNumber, name: active.name, ownTurn: active.isPlayer,
            selectedIsTurnee: player === active, canAct: active.canAct(),
            hasEnemy: this.hasEnemyNextTo(active.gridX, active.gridY),
            hasSpells: availableSpells.length > 0,
            spellInRange: player === active && availableSpells.some(hasTarget),
            pendingSpell: player?.pendingSpell != null,
            pendingItem: player?.pendingItem != null,
            ice: active.isFrozen(), fire: this.hasFlame(active.gridX, active.gridY),
            poison: active.statuses[StatusEffect.POISON] !== 0,
            muted: active.isMuted(), paralyzed: active.isParalyzed(),
            lowMP: active.spells.length > 0 && active.spells.every(spell => spell.cost > active.mp),
            hasItem: active.hasUsableItem(),
        });
    }

    actionFeedback(message: string) {
        if (!this.gameEnded && !this.isReplay && !this.gameSettings?.spectator) {
            events.emit('actionFeedback', message);
        }
    }

    unavailableActionReason(player = this.selectedPlayer): string | undefined {
        const active = this.turnee && this.getPlayer(this.turnee.team, this.turnee.num);
        if (!active || !player) return t("Wait for your active character to be selected.");
        if (!active.isPlayer) return t("It is your opponent’s turn.");
        if (player !== active) return t("{{name}} acts now. Select the active character.", {name: active.name});
        if (player.isFrozen()) return t("This character is frozen. Another character can break the ice.");
        if (!player.canAct()) return t("This character cannot act right now.");
    }

    refreshOverview() {
        this.overviewReady = true;
        const { team1, team2, general, initialized, queue, turnee } = this.getOverview();
        if (this.overviewReady) {
            events.emit('refreshOverview', team1, team2, general, initialized, queue, turnee);
        }
    }

    relayEvent(event, data?) {
        // console.log(`[Arena:relayEvent] Emitting event: ${event}`);
        events.emit(event, data);
    }

    refreshUI(_num) {
        this.refreshBox();
        this.refreshOverview();
    }

    selectTurnee() {
        this.deselectPlayer();
        if (this.turnee) {
            const player = this.getPlayer(this.turnee.team, this.turnee.num);
            this.selectPlayer(player);
        }
    }

    selectPlayer(player: Player) {
        if (!this.gameInitialized) return;
        this.selectedPlayer = player;
        this.selectedPlayer?.select();
        this.refreshBox();
        this.refreshOverview();
    }

    deselectPlayer() {
        this.clearMovePreview();
        if (this.selectedPlayer) {
            this.selectedPlayer.deselect();
            this.selectedPlayer.cancelSkill();
            this.selectedPlayer = null;
            this.refreshBox();
            this.hexGridManager.clearHighlight();
        }
    }

    getPlayer(team: number, num: number): Player {
        return this.teamsMap?.get(team)?.getMember(num);
    }

    getOtherTeam(id: number): number {
        return id === 1 ? 2 : 1;
    }

    processMove({team, tile, num}) {
        if (this.gameEnded) return;

        const player = this.getPlayer(team, num);
        if (!player) {
            return;
        }

        this.clearMovePreview();
        this.gridMap.delete(serializeCoords(player.gridX, player.gridY));
        this.gridMap.set(serializeCoords(tile.x, tile.y), player);

        player.walkTo(tile.x, tile.y);
        this.playSoundMultipleTimes('steps', 2);
        if (player.isPlayer) {
            events.emit('playerMoved');
        }
    }

    processAttack({team, target, num, hp, damage, isKill, sameTeam, miss, immune}) {
        if (this.gameEnded) return;
        const player = this.getPlayer(team, num);
        const otherTeam = sameTeam ? team : this.getOtherTeam(team);
        const targetPlayer = this.getPlayer(otherTeam, target);
        if (!player || !targetPlayer) return;

        const {x: pixelX, y: pixelY} = this.hexGridToPixelCoords(targetPlayer.gridX, targetPlayer.gridY);
        // The server reports the HP change just before the attack; play it when the blow lands.
        const hpBefore = targetPlayer.hp;
        const delta = targetPlayer.takePendingReaction() ?? (hp !== hpBefore ? (damage ?? hp - hpBefore) : null);
        this.lastBlow = {by: player, at: Date.now()};

        this.playSound('slash');
        player.attack(targetPlayer.gridX);
        targetPlayer.setHP(hp);
        if (!miss) targetPlayer.displaySlash(player);
        player.lunge(targetPlayer, () => {
            if (miss) {
                // The blow passes through the steam.
                targetPlayer.playAnim('dodge', true);
                targetPlayer.displayOverheadText(t('Miss'), 2000, '#e8eef2');
                return;
            }
            this.displayAttackImpact(targetPlayer.gridX, targetPlayer.gridY);
            const mage = player.class === Class.WHITE_MAGE || player.class === Class.BLACK_MAGE;
            this.playSound(mage ? 'impact_punch' : 'impact_sword');
            if (immune) targetPlayer.displayOverheadText(t('Immune'), 2000, '#bfe8ff');
            if (delta) targetPlayer.showHPChange(delta, {from: player});
        });
        if (isKill) this.requestKillCam(pixelX, pixelY);
        if (player.isPlayer) {
            events.emit('playerAttacked');
        }
    }

    processObstacleAttack({team, num, x, y}) {
        if (this.gameEnded) return;
        const player = this.getPlayer(team, num);
        if (!player) return;
        this.playSound('slash');
        player.attack(x);
        player.lunge(this.hexGridToPixelCoords(x, y), () => {
            this.displayAttackImpact(x, y);
            const {x: pixelX, y: pixelY} = this.hexGridToPixelCoords(x, y);
            this.sparks(pixelX, pixelY - 10, 12, 0xd8f4ff);
            shake(this, 120, 0.003);
        });
    }

    processInventory({num, inventory}) {
        if (this.gameEnded) return;
        const player = this.getPlayer(this.playerTeamId, num);
        player.setInventory(inventory);
        this.refreshBox();
    }

    processHPChange({team, num, hp, damage}) {
        if (this.gameEnded) return;
        const player = this.getPlayer(team, num);
        if (!player) return;
        const delta = damage ?? hp - player.hp;
        player.setHP(hp);
        if (delta) this.queueHPReaction(player, delta);
        if (player.isPlayer) events.emit('hpChange', {num, hp});
        this.refreshTutorial();
    }

    /** Wait a moment in case a melee attack claims this change; otherwise it came from a spell, item or effect. */
    private queueHPReaction(player: Player, delta: number) {
        const total = (player.takePendingReaction() ?? 0) + delta;
        player.pendingReaction = {delta: total, timer: this.time.delayedCall(80, () => {
            player.pendingReaction = null;
            const impact = this.lastImpact && performance.now() - this.lastImpact.at < 1500 ? this.lastImpact : null;
            let color: string | undefined;
            if (total < 0 && !impact) {
                // Damage over time takes the colour of its cause.
                if (player.statuses[StatusEffect.POISON]) color = NUMBER_COLORS.poison;
                else if (player.statuses[StatusEffect.BURN] || this.hasFlame(player.gridX, player.gridY)) color = NUMBER_COLORS.burn;
            }
            player.showHPChange(total, {from: impact ?? undefined, color});
        })};
    }

    /** A spell hit a frozen character: the ice took it. */
    processDamageImmune({team, num}) {
        if (this.gameEnded) return;
        this.getPlayer(team, num)?.displayOverheadText(t('Immune'), 2500, '#bfe8ff');
    }

    processStatusResisted({team, num}) {
        if (this.gameEnded) return;
        this.getPlayer(team, num)?.displayOverheadText(t('Resisted'), 3000, '#b7c9d4');
    }

    processStatusChange({team, num, statuses}) {
        if (this.gameEnded) return;
        const player = this.getPlayer(team, num);
        player?.setStatuses(statuses);
        this.refreshTutorial();
    }

    processMPChange({team = this.playerTeamId, num, mp}) {
        if (this.gameEnded) return;
        const player = this.getPlayer(team, num);
        if (player) {
            const previous = player.setMP(mp);
            if (mp > previous) player.showMPGain(mp - previous);
        }
        this.refreshTutorial();
    }

    processUseItem({team, num, animation, name, sfx}) {
        if (this.gameEnded) return;
        const player = this.getPlayer(team, num);
        player.useItemAnimation(animation, name);
        this.playSound(sfx);
        if (player.isPlayer) {
            events.emit(`playerUseItem`);
        }
    }


    processTerrain(updates: TerrainUpdate[], isReconnect = false) {
        if (this.gameEnded) return;
        updates.forEach(({x, y, terrain, iceRemoval}) => {
            const handlers = {
                [Terrain.FIRE]: () => this.handleFireTerrain(x, y),
                [Terrain.ICE]: () => this.handleIceTerrain(x, y, isReconnect),
                [Terrain.NONE]: () => this.handleClearTerrain(x, y, iceRemoval)
            };
            handlers[terrain]?.();
        });
    }

    hasFlame(x: number, y: number) {
        return this.terrainMap.get(serializeCoords(x, y)) === Terrain.FIRE;
    }

    hasIce(x: number, y: number) {
        return this.terrainMap.get(serializeCoords(x, y)) === Terrain.ICE;
    }

    createIceBlock(x: number, y: number) {
        const {x: pixelX, y: pixelY} = this.hexGridToPixelCoords(x, y);
        const depth = this.yToZ(y) + DEPTH_OFFSET;
        const icesprite = this.add.sprite(pixelX, pixelY, 'iceblock')
            .setDepth(depth).setAlpha(0.9)
            .setOrigin(0.5, 0.35)
            // .setInteractive();
        // Add pointerover event to sprite
        icesprite.on('pointerover', () => {
            if (this.selectedPlayer?.isNextTo(x, y)
                && this.selectedPlayer.canAct()
                && this.selectedPlayer.pendingSpell == null
                && this.selectedPlayer.pendingItem == null) {
                events.emit('hoverEnemyCharacter');
            }
        });
        icesprite.on('pointerdown', () => {
            this.handleTileClick(x, y);
        });
        // Add pointerout event to sprite
        icesprite.on('pointerout', () => {
            events.emit('unhoverCharacter');
        });
        icesprite.postFX.addShine(0.5, .2, 5);
        return icesprite;
    }

    flickerAndDestroy(sprite, times, duration) {
        if (!sprite) return;

        // Create a tween to flicker the sprite
        this.tweens.add({
            targets: sprite,
            alpha: { from: 1, to: 0 },
            duration: duration / (times * 2),
            yoyo: true,
            repeat: times - 1, // Repeat for the number of times - 1 since it starts from 1
            onComplete: () => {
                sprite.destroy();
            }
        });
    }

    displayAttackImpact(gridX, gridY) {
        const {x: pixelX, y: pixelY} = this.hexGridToPixelCoords(gridX, gridY);
        this.localAnimationSprite.setPosition(pixelX, pixelY + 30)
            .clearTint()
            .setOrigin(0.5, 0.7)
            .setVisible(true)
            .setDepth(this.yToZ(gridY) + DEPTH_OFFSET)
            .setScale(0.5)
            .play('impact');
    }

    yToZ(y) {
        return Number((3.5 + y/10).toFixed(2));
    }

    processCast(flag, {team, num, id,}) {
        if (this.gameEnded) return;

        const player = this.getPlayer(team, num);
        const spell = getSpellById(id);
        player?.castAnimation(flag, spell?.name, spell?.charge);
        if (flag && player) this.lastBlow = {by: player, at: Date.now()};
        if (flag && player && spell && isUltimate(spell)) this.startSpellCinematic(player, spell);
        else if (!flag) this.endSpellCinematic(false);

        if (CAST_ZOOM) {
            // Check for cast start with charged spell
            if (flag && spell?.charge) {
                console.log(`Starting charged spell cast`);
                const { x: pixelX, y: pixelY } = this.hexGridToPixelCoords(player.gridX, player.gridY);
                this.chargeCastCam(pixelX, pixelY);
                this.isZoomedForSpellCast = true;
            }
            // Check for cast end when camera is zoomed for a spell
            else if (!flag && this.isZoomedForSpellCast) {
                console.log(`Ending spell cast, resetting camera`);
                this.resetCamera();
                    this.isZoomedForSpellCast = false;
            }
        }

        if (flag && player?.isPlayer) {
            events.emit(`playerCastSpell`);
        }
    }

    // Simplify the chargeCastCam method - no need for revert parameter
    chargeCastCam(pixelX, pixelY) {
        if (FREEZE_CAMERA) return;

        // Target zoom level for charged spells
        const targetZoom = 1.5;
        const panDuration = 800;

        // Move camera to the caster's location and zoom in
        this.cameras.main.pan(pixelX, pixelY, panDuration, 'Power2', true);
        this.cameras.main.zoomTo(targetZoom, panDuration, 'Power2', true);
    }

    // Add a helper method to reset the camera
    resetCamera(scrollX = null, scrollY = null, zoom = null) {
        if (FREEZE_CAMERA) return;

        const gameWidth = this.cameras.main.width;
        const gameHeight = this.cameras.main.height;

        // Use provided values or center the camera
        const targetX = scrollX !== null ? gameWidth/2 + scrollX : gameWidth/2;
        const targetY = scrollY !== null ? gameHeight/2 + scrollY : gameHeight/2;
        const targetZoom = zoom !== null ? zoom : 1;

        // Smoothly transition back
        this.cameras.main.pan(targetX, targetY, 800, 'Power2', true);
        this.cameras.main.zoomTo(targetZoom, 800, 'Power2', true);
    }

    processLocalAnimation({fromX, fromY, toX, toY, id, isKill}) {
        const spell = getSpellById(id);
        const caster = this.gridMap.get(serializeCoords(fromX, fromY));
        if (caster) this.lastBlow = {by: caster, at: Date.now()};
        const {x: pixelXInitial, y: pixelYInitial} = this.hexGridToPixelCoords(toX, toY);
        let pixelY = pixelYInitial;
        let pixelX = pixelXInitial;

        const config = VFXconfig[spell.vfx];
        if (config) {
            if (config.yoffset) pixelY += config.yoffset;
            if (config.xoffset) pixelX += config.xoffset;
        }

        if (spell.projectile) {
            this.animateProjectile(fromX, fromY, toX, toY, spell.projectile);
        }

        if (isKill) this.killsInFlight++;
        this.time.delayedCall(spell.projectile ? PROJECTILE_DURATION * 1000 : 0, () => {
            this.lastImpact = {x: pixelXInitial, y: pixelYInitial, at: performance.now()};
            if (isUltimate(spell)) this.endSpellCinematic(true);
            if (isKill) {
                this.killsInFlight--;
                this.requestKillCam(pixelXInitial, pixelYInitial);
            }

            const scale = config && 'scale' in config ? config.scale : LOCAL_ANIMATION_SCALE;
            let yScale = scale;

            if (config && config.stretch) {
                // Stretch above the impact, never away from the target tile.
                const beamHeight = 512 * ((config.originY ?? 1) - (config.beamTop ?? 0));
                yScale = Math.max(scale, (pixelY - this.cameras.main.worldView.top) / beamHeight);
            }
            // Normal handling for other animations
            this.localAnimationSprite.setPosition(pixelX, pixelY)
                .setOrigin(0.5, config?.originY ?? 0.7)
                .setVisible(true)
                .setDepth(this.yToZ(toY) + DEPTH_OFFSET)
                .setScale(scale * (config ? VFX_DISPLAY_SCALE : 1), yScale * (config ? VFX_DISPLAY_SCALE : 1));

            if (spell.vfxTint) this.localAnimationSprite.setTint(spell.vfxTint);
            else this.localAnimationSprite.clearTint();
            console.log(`[Arena:processLocalAnimation] spell.vfx: ${spell.vfx}`);
            this.localAnimationSprite.play(spell.vfx);

            this.playSound(spell.sfx);

            if (config && config.shake) {
                shake(this, isKill ? 450 : 320, isKill ? 0.012 : 0.007);
            }
        });
    }

    // New method to animate projectile from caster to target
        animateProjectile(fromX: number, fromY: number, toX: number, toY: number, projectileKey: string) {
        // Convert grid coordinates to pixel coordinates
        const {x: startX, y: startY} = this.hexGridToPixelCoords(fromX, fromY);
        const {x: endX, y: endY} = this.hexGridToPixelCoords(toX, toY);

        // Create projectile sprite at caster position
        const projectile = this.add.sprite(startX, startY, '')
            .setScale(VFXconfig[projectileKey].scale)
            .setOrigin(0.5, 0.5)
            .setDepth(this.yToZ(fromY) + DEPTH_OFFSET + 0.1);

        // Set initial rotation - point upward
        // Since sprite faces right by default, we need -90 degrees to point up
        projectile.setRotation(-Math.PI/2);

        // Play projectile animation
        projectile.play(projectileKey);

        // Calculate screen top with some padding
        const screenTop = -50;

        // Calculate total distance based on the actual path (up then down)
        const distanceUp = Math.abs(startY - screenTop);
        const distanceDown = Math.abs(endY - screenTop);
        const totalDistance = distanceUp + distanceDown;

        const totalDuration = PROJECTILE_DURATION * 1000;

        // Phase 1: Ascent - Move projectile straight up
        this.tweens.add({
            targets: projectile,
            y: screenTop,
            duration: (distanceUp / totalDistance) * totalDuration,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                // Phase 2: Hide the projectile
                projectile.setVisible(false);

                // Phase 3: Reappear above target and crash down
                this.time.delayedCall(totalDuration / 10, () => {
                    // Reposition projectile above the target
                    projectile.setPosition(endX, screenTop)
                        .setVisible(true)
                        // Set rotation to point downward (90 degrees)
                        .setRotation(Math.PI/2);

                    // Create the descent tween
                    this.tweens.add({
                        targets: projectile,
                        y: endY,
                        duration: (distanceDown / totalDistance) * totalDuration,
                        ease: 'Cubic.easeIn',
                        onComplete: () => {
                            // Fade out and destroy on impact
                            this.tweens.add({
                                targets: projectile,
                                alpha: 0,
                                scale: projectile.scale * 1.5,
                                duration: 200,
                                onComplete: () => {
                                    projectile.destroy();
                                }
                            });
                        }
                    });
                }); // Brief pause before reappearing
            }
        });
    }

    // Add this new method to handle camera movement
    panCameraWithOffset(targetX: number, targetY: number, duration: number = 1000, easing: string = 'Cubic.easeOut', moveRatio = 0.4) {
        if (FREEZE_CAMERA) return;
        // Get screen dimensions and target position
        const screenWidth = this.cameras.main.width;
        const screenHeight = this.cameras.main.height;

        const screenCenterX = screenWidth/2;
        const screenCenterY = screenHeight/2;

        const offsetX = (targetX - screenCenterX) * moveRatio;
        const offsetY = (targetY - screenCenterY) * moveRatio;
        this.cameraHome = {x: screenCenterX + offsetX, y: screenCenterY + offsetY};

        // Pan camera smoothly from center
        this.cameras.main.pan(
            screenCenterX + offsetX,
            screenCenterY + offsetY,
            duration,
            easing
        );
    }

    // Update spellCam to use the new method
    spellCam(pixelX: number, pixelY: number, revert = false) {
        const originalScrollX = this.cameras.main.scrollX;
        const originalScrollY = this.cameras.main.scrollY;

        this.panCameraWithOffset(pixelX, pixelY);

        if (revert) {
            // After animation duration, pan back to original position
            this.time.delayedCall(1000, () => {
                this.cameras.main.pan(
                    this.cameras.main.width/2 + originalScrollX,
                    this.cameras.main.height/2 + originalScrollY,
                    1000,
                    'Power2'
                );
            });
        }
    }

    // Update highlightTurnee to use the new method
    highlightTurnee() {
        if (!this.turnee) return;

        const player = this.getPlayer(this.turnee.team, this.turnee.num);
        if (!player) return;

        // If killcam is active, wait for it to finish before highlighting turnee
        if (this.killCamActive || this.killCamCheck) {
            this.whenKillCamEnds(() => this.highlightTurnee());
            return;
        }

        // A gentle nudge toward whoever acts; the board stays readable.
        if (cameraNudgeEnabled() && !this.isZoomedForSpellCast) {
            this.panCameraWithOffset(player.x, player.y, 700, 'Sine.easeInOut', 0.05);
        }
    }

    processGameEnd(data: OutcomeData) {
        this.clearCharacterHover();
        this.clearMovePreview();
        this.gameEnded = true;
        this.lastStands.forEach(aura => { aura.destroy(); });
        this.lastStands.clear();
        events.emit('lastStand', false);
        // Clear the stage for the result jingle.
        this.musicManager.fadeOut();
        const winningTeam = data.isWinner ? this.teamsMap.get(this.playerTeamId) : this.teamsMap.get(this.getOtherTeam(this.playerTeamId));
        const losingTeam = this.teamsMap.get(winningTeam?.id === 1 ? 2 : 1);
        // Let the final kill play out (kill cam included) before the result; the music fades meanwhile.
        this.whenKillCamEnds(() => this.time.delayedCall(RESULT_DELAY_MS, () => {
            if (this.disposed) return;
            const jingle = data.isWinner ? 'jingle_win' : 'jingle_lose';
            // The jingle closes the match; the combat soundtrack does not resume after it.
            this.playSound(jingle);
            winningTeam?.members.forEach((player) => {
                player.victoryDance();
                if (player.isAlive()) this.embers(player.x, player.y - 30, 20);
            });
            losingTeam?.members.forEach((player) => {
                if (player.isAlive()) player.playAnim('hurt');
            });
            rumble(data.isWinner ? 0.4 : 0.6, data.isWinner ? 0.6 : 0.2, data.isWinner ? 250 : 350);
            // The champions celebrate on the field before the result screen covers it.
            this.time.delayedCall(RESULT_SCREEN_DELAY_MS, () => {
                if (!this.disposed && this.overviewReady) events.emit('gameEnd', {...data, honours: this.matchHonours(data)});
            });
        }));
    }

    /** End-screen level-ups play their fanfare over the result jingle. */
    playLevelUp = () => {
        if (!this.disposed) this.playSound('level_up');
    };

    processAddCharacter(data: {team: number, character: PlayerNetworkData}) {
        const team = this.teamsMap.get(data.team);
        this.placeCharacter(data.character, team, false);
    }

    /** Warm tiles glow and give off heat; the server sends the full set whenever it changes. */
    processWarmth(tiles: {x: number; y: number}[]) {
        if (this.disposed) return;
        this.createWarmthLayer();
        const keys = new Set(tiles.map(({x, y}) => serializeCoords(x, y)));
        this.warmTiles.forEach((warm, key) => {
            if (keys.has(key)) return;
            this.warmTiles.delete(key);
            this.tweens.add({targets: warm.image, alpha: 0, duration: 450, onComplete: () => warm.image.destroy()});
        });
        for (const {x, y} of tiles) {
            const key = serializeCoords(x, y);
            const tile = this.hexGridManager.getTile(x, y);
            if (this.warmTiles.has(key) || !tile) continue;
            const warm = {image: this.warmHex(tile.x, tile.y), fade: 0};
            this.warmTiles.set(key, warm);
            this.tweens.add({targets: warm, fade: 1, duration: 450, delay: Math.random() * 150});
        }
    }

    /** A warm amber wash with a bright rim; neighbouring warm tiles read as one heated patch. */
    private warmHex(x: number, y: number) {
        const corners = (inset: number) => Array.from({length: 6}, (_, i) => {
            const angle = Math.PI / 3 * i - Math.PI / 2;
            const radius = HexGridManager.HEX_HEIGHT / 2 - inset;
            return new Phaser.Math.Vector2(radius * Math.cos(angle), radius * Math.sin(angle) * HexGridManager.PERSPECTIVE_SCALE);
        });
        return this.add.graphics({x, y}).setDepth(1.1).setAlpha(0)
            .fillStyle(0xff8a2a, 0.42).fillPoints(corners(3), true)
            .lineStyle(4, 0xffb347, 1).strokePoints(corners(4), true)
            .lineStyle(2, 0xffe2a8, 0.6).strokePoints(corners(10), true);
    }

    private createWarmthLayer() {
        if (this.warmMotes) return;
        this.tweens.add({
            targets: this.warmPulse, value: 0.72, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
            onUpdate: () => this.warmTiles.forEach(warm => { warm.image.setAlpha(warm.fade * this.warmPulse.value); }),
        });
        this.warmMotes = this.add.particles(0, 0, 'fx_spark', {
            emitting: false, lifespan: {min: 900, max: 1500}, speedY: {min: -42, max: -18}, speedX: {min: -8, max: 8},
            scale: {start: 0.45, end: 0}, alpha: {start: 0.85, end: 0}, tint: [0xffb347, 0xff8a3a, 0xffd27a], blendMode: 'ADD',
        }).setDepth(3.4);
        // A steady trickle of heat, spread over however many tiles are warm.
        this.time.addEvent({delay: 140, loop: true, callback: () => {
            if (!this.warmTiles.size || !screenEffectsEnabled()) return;
            const warm = [...this.warmTiles.values()][Math.floor(Math.random() * this.warmTiles.size)];
            if (warm.fade < 1) return;
            this.warmMotes.emitParticleAt(warm.image.x + (Math.random() - 0.5) * 50, warm.image.y + (Math.random() - 0.5) * 30);
        }});
    }

    /** Steam billows over tiles where heat melted ice, thinning as its turns run out. */
    processSteam(tiles: {x: number; y: number; turns: number}[]) {
        if (this.disposed) return;
        if (!this.textures.exists('fx_puff')) {
            // Stacked translucent discs make a soft, round puff.
            const graphics = this.make.graphics({x: 0, y: 0}, false);
            for (let radius = 30; radius >= 4; radius -= 3) graphics.fillStyle(0xffffff, 0.1).fillCircle(32, 32, radius);
            graphics.generateTexture('fx_puff', 64, 64);
            graphics.destroy();
        }
        const fade = (cloud: Phaser.GameObjects.Particles.ParticleEmitter) => {
            cloud.stop();
            this.time.delayedCall(3500, () => cloud.destroy());
        };
        const keys = new Set(tiles.map(({x, y}) => serializeCoords(x, y)));
        this.steamClouds.forEach((cloud, key) => {
            if (keys.has(key)) return;
            this.steamClouds.delete(key);
            fade(cloud.emitter);
        });
        for (const {x, y, turns} of tiles) {
            const key = serializeCoords(x, y);
            const tile = this.hexGridManager.getTile(x, y);
            const previous = this.steamClouds.get(key);
            if (!tile || previous?.turns === turns) continue;
            // Thinner and sparser as the steam runs out; a fresh emitter replaces the old one.
            const strength = Math.max(0, Math.min(1, turns / STEAM_TURNS));
            const emitter = this.add.particles(tile.x, tile.y - 20, 'fx_puff', {
                lifespan: {min: 2600, max: 3800}, frequency: 70 + (1 - strength) * 200,
                speedY: {min: -20, max: -6}, speedX: {min: -12, max: 12},
                x: {min: -40, max: 40}, y: {min: -18, max: 18}, rotate: {min: 0, max: 360},
                scale: {start: 1, end: 2.4}, alpha: {start: 0.3 + 0.35 * strength, end: 0},
                tint: [0xffffff, 0xe8f3ff, 0xd5e6f2, 0xc9d8e4],
            // Just behind the tile's occupant: the steam surrounds them without hiding them or their labels.
            }).setDepth(this.yToZ(y) - 0.002);
            // The ice bursts into steam.
            if (!previous) emitter.emitParticle(24);
            else fade(previous.emitter);
            this.steamClouds.set(key, {emitter, turns});
        }
    }

    showTowerWarning(tiles: {x: number; y: number}[]) {
        this.towerWarningMarkers.forEach(marker => { marker.destroy(); });
        this.towerWarningMarkers = tiles.map(tile => {
            const {x, y} = this.hexGridToPixelCoords(tile.x, tile.y);
            return this.add.text(x, y + 15, '⚠', {fontFamily: 'Arial', fontSize: '34px', color: '#ffe3a1', backgroundColor: '#5b251c', padding: {x: 6, y: 2}})
                .setOrigin(0.5).setDepth(10000);
        });
    }

    processQueueData(data: TurnQueueEntry[]) {
        this.queue = data;
        this.refreshOverview();
    }

    processTurnee(data: TurnState) {
        if (this.gameEnded) return;
        events.emit('combatWaiting', false);
        // Determine if turnee is player
        this.clearMovePreview();
        this.actionPending = false;
        if (data.team !== this.playerTeamId) {
            events.emit('enemyTurn');
        } else if (!this.isReplay && !this.gameSettings?.spectator) {
            rumble(0.1, 0.25, 90);
        }
        events.emit('turnStarted');

        this.turnee = data;
        this.selectTurnee();
        this.highlightTurnee();
    }

    updateMusicIntensity(ratio){
        this.musicManager.updateMusicIntensity(ratio);
    }

    createSounds() {
        this.SFX = Object.fromEntries(
            Arena.SOUND_NAMES.map(name => [
                name,
                this.sound.get(name) || this.sound.add(name)
            ])
        );

        events.on('settingsChanged', this.onSettingsChanged, this);
    }

    onSettingsChanged = (settings) => {
        this.sfxVolume = sfxGain(settings);
        for (const player of this.gridMap.values()) player.numKey?.setFontSize(12 * settings.textSize / 100);
    }

    /** Combat sounds vary a little in pitch and volume, and up to a few copies of one sound may overlap. */
    playSound(name, volume = 1, loop = false): Phaser.Sound.BaseSound | null {
        if (!this.SFX || !this.SFX[name]) {
            console.warn(`Sound effect "${name}" not found`);
            return null;
        }

        const adjustedVolume = volume * sfxLevel(name) * this.sfxVolume;
        try {
            if (loop || PERSISTENT_SOUNDS.has(name)) {
                this.SFX[name].play({delay: 0, volume: adjustedVolume, loop});
                return this.SFX[name];
            }
            const copies = this.soundCopies.get(name) ?? 0;
            if (copies >= MAX_SOUND_COPIES) return null;
            const sound = this.sound.add(name);
            this.soundCopies.set(name, copies + 1);
            sound.once(Phaser.Sound.Events.DESTROY, () => this.soundCopies.set(name, (this.soundCopies.get(name) ?? 1) - 1));
            sound.once(Phaser.Sound.Events.COMPLETE, () => sound.destroy());
            sound.play({volume: adjustedVolume * (0.9 + Math.random() * 0.2), rate: 0.94 + Math.random() * 0.12});
            return sound;
        } catch (error) {
            console.warn(`Error playing sound "${name}":`, error);
            return null;
        }
    }

    stopSound(name) {
        this.SFX[name].stop();
    }

    playSoundMultipleTimes(key, times) {
        if(times <= 0) return;

        const sound = this.SFX[key];

        sound.once('complete', () => {
            this.playSoundMultipleTimes(key, times - 1); // Play the sound again
        });

        sound.play({volume: sfxLevel(key) * this.sfxVolume});
    }


    createCharacterAnims() {
        allSprites.filter(asset => this.textures.exists(asset) && !this.anims.exists(`${asset}_anim_idle`)).forEach((asset) => {
            // Character postures
            this.createCharacterAnim(asset, 'idle', [9, 10, 11], { repeat: -1, yoyo: true });
            this.createCharacterAnim(asset, 'idle_hurt', [33, 34, 35], { repeat: -1, yoyo: true });
            this.createCharacterAnim(asset, 'walk', [6, 7, 8], { repeat: -1 });
            this.createCharacterAnim(asset, 'attack', [12, 13, 14], { frameRate: BASE_ANIM_FRAME_RATE * 2 });
            this.createCharacterAnim(asset, 'dodge', [45, 46, 47], { frameRate: BASE_ANIM_FRAME_RATE * 2 });
            this.createCharacterAnim(asset, 'item', [48, 49, 50], { frameRate: BASE_ANIM_FRAME_RATE });
            this.createCharacterAnim(asset, 'hurt', [42, 43, 44], { frameRate: BASE_ANIM_FRAME_RATE });
            this.createCharacterAnim(asset, 'cast', [39, 40, 41], { frameRate: BASE_ANIM_FRAME_RATE });
            this.createCharacterAnim(asset, 'die', [51, 52, 53], { frameRate: BASE_ANIM_FRAME_RATE * 2 });
            this.createCharacterAnim(asset, 'victory', [15, 16, 17], { repeat: -1, yoyo: true });
            this.createCharacterAnim(asset, 'boast', [15, 16, 17], { frameRate: BASE_ANIM_FRAME_RATE * 1.5, repeat: 2, yoyo: true });
        });
    }

    createSpellAnims() {
        for (const key of SPELL_SHEETS) {
            if (!this.textures.exists(key) || this.anims.exists(key)) continue;
            const charged = key.startsWith('charged_');
            const terrain = key.startsWith('terrain_');
            this.anims.create({key, frames: this.anims.generateFrameNumbers(key),
                frameRate: charged ? 50 : terrain ? 30 : VFXconfig[key]?.frameRate || 15,
                repeat: charged || terrain ? -1 : 0});
        }
    }

    private async prepareMessageAssets(event: string, data) {
        let characters: PlayerNetworkData[] = [];
        const spells: number[] = [];
        if (event === 'gameStatus') {
            if (!data?.general || !Array.isArray(data.player?.team) || !Array.isArray(data.opponent?.team)
                || !Array.isArray(data.queue) || !data.player.player || !data.opponent.player) {
                throw new Error('Invalid match snapshot');
            }
            characters = [...data.player.team, ...data.opponent.team];
        } else if (event === 'addCharacter') {
            characters = [data.character];
        } else if (event === 'cast' || event === 'localanimation') {
            // These events introduce spell graphics. endcast only stops existing animations
            // and the server deliberately sends it without a spell ID.
            spells.push(data.id);
        }
        const keys = new Set<string>();
        for (const character of characters) {
            if (!character || !allSprites.includes(character.portrait)) throw new Error('Invalid character sprite');
            keys.add(character.portrait);
            spells.push(...(character.spells || []));
        }
        for (const id of spells) {
            const spell = getSpellById(id);
            if (!spell) throw new Error('Invalid spell in match event');
            if (spell.vfx) keys.add(spell.vfx);
            if (spell.charge) keys.add(spell.charge);
        }
        // Terrain may be created by either team.
        if (event === 'gameStatus' || event === 'terrain') keys.add('terrain_fire_1');
        const missing = [...keys].filter(key => !this.textures.exists(key));
        if (!missing.length) return;
        for (const key of missing) {
            const sprite = allSprites.includes(key);
            if (!sprite && !SPELL_SHEETS.includes(key)) throw new Error('Unknown spell asset');
            this.load.spritesheet(key, sprite ? require(`@assets/sprites/${key}.png`) : spellSheetFiles(`./${key}.png`), {
                frameWidth: sprite ? 144 : VFX_FRAME_SIZE, frameHeight: sprite ? 144 : VFX_FRAME_SIZE,
            });
        }
        await new Promise<void>((resolve, reject) => {
            const finish = (error?: Error) => {
                clearTimeout(timer);
                this.load.off('complete', complete);
                this.events.off(Phaser.Scenes.Events.SHUTDOWN, cancel);
                error ? reject(error) : resolve();
            };
            const complete = () => finish(missing.some(key => !this.textures.exists(key)) ? new Error('Missing match assets') : undefined);
            const cancel = () => finish(new Error('Arena closed while loading'));
            const timer = setTimeout(() => finish(new Error('Match asset loading timed out')), 30000);
            this.load.once('complete', complete);
            this.events.once(Phaser.Scenes.Events.SHUTDOWN, cancel);
            this.load.start();
        });
        if (this.disposed) return;
        this.createCharacterAnims();
        this.createSpellAnims();
    }

    createAnims() {
        this.createCharacterAnims();

        this.anims.create({
            key: `cast`,
            frames: this.anims.generateFrameNumbers('cast', { frames: [10, 11, 12] }),
            frameRate: 15,
            repeat: -1
        });

        this.anims.create({
            key: `slash`,
            frames: this.anims.generateFrameNumbers('slash', { frames: [99, 100, 101, 102] }),
            frameRate: 15,
        });

        this.anims.create({
            key: `impact`,
            frames: this.anims.generateFrameNumbers('impact', { start: 0, end: 12 }),
            frameRate: 25,
        });

        // Spells VFX

        this.anims.create({
            key: `meltdown`,
            frames: this.anims.generateFrameNumbers('meltdown'),
            frameRate: 10,
        });

        this.anims.create({
            key: `potion_heal`,
            frames: this.anims.generateFrameNumbers('potion_heal'),
            frameRate: 10,
        });

        this.anims.create({
            key: `revive`,
            frames: this.anims.generateFrameNumbers('revive'),
            frameRate: 15,
        });

        this.createSpellAnims();

        this.anims.create({
            key: `poison`,
            frames: this.anims.generateFrameNumbers('poison', { start: 0, end: 16 }),
            frameRate: 15,
        });

        this.anims.create({
            key: `mute`,
            frames: this.anims.generateFrameNumbers('mute', { start: 0, end: 13 }),
            frameRate: 15,
        });



        this.anims.create({
            key: `smoke`,
            frames: this.anims.generateFrameNumbers('smoke', { start: 32, end: 42 }),
            frameRate: 12,
        });

        // Status effects VFX

        this.anims.create({
            key: `paralyzed`,
            frames: this.anims.generateFrameNumbers('statuses', { start: 56, end: 63 }),
            frameRate: 15,
            repeat: -1,
        });

        this.anims.create({
            key: `poisoned`,
            frames: this.anims.generateFrameNumbers('statuses', { start: 0, end: 7 }),
            frameRate: 10,
            repeat: -1,
        });

        this.anims.create({
            key: `muted`,
            frames: this.anims.generateFrameNumbers('statuses', { start: 16, end: 23 }),
            frameRate: 10,
            repeat: -1,
        });


        this.animationScales = {
            slash: 1,
        }
    }

    placeCharacter(character: PlayerNetworkData, team: Team, isReconnect = false) {
        const isPlayer = team.id === this.playerTeamId;
        const {x, y} = this.hexGridToPixelCoords(character.x, character.y);

        const player = new Player(
            this, this, team, this.gameSettings?.mode === PlayMode.TOWER && !isPlayer ? t(character.name) : character.name, character.x, character.y, x, y,
            team.getMembers().length + 1, character.portrait, isPlayer, character.class,
            character.hp, character.maxHP, character.mp, character.maxMP,
            character.level, character.xp,
        );

        if (isPlayer) {
            player.setDistance(character.distance);
            player.setInventory(character.inventory);
        }
        player.combatStats = character.combatStats;
        player.setSpells(character.spells ?? []);
        if (character.spellEffects) player.spells = player.spells.map(spell => Object.assign(Object.create(Object.getPrototypeOf(spell)), spell,
            {effects: character.spellEffects[spell.id] ?? spell.effects}));
        if (character.towerSpellCosts) player.spells = player.spells.map(spell => Object.assign(Object.create(Object.getPrototypeOf(spell)), spell,
            {cost: character.towerSpellCosts[spell.id] ?? spell.cost}));
        player.setStatuses(character.statuses);

        if (!isReconnect) {
            player.y -= 1000;
            // Stagger the entrance of each player with a random offset between -200 and +200 ms
            const randomOffset = Math.floor(Math.random() * (AIR_ENTRANCE_DELAY_VARIANCE * 2 + 1)) - AIR_ENTRANCE_DELAY_VARIANCE; // Random number between -AIR_ENTRANCE_DELAY_VARIANCE and AIR_ENTRANCE_DELAY_VARIANCE
            const entranceDelay = AIR_ENTRANCE_DELAY + randomOffset;
            this.pendingEntrances++;
            this.time.delayedCall(entranceDelay, () => player.makeAirEntrance(() => { this.pendingEntrances--; }));
        }

        this.gridMap.set(serializeCoords(character.x, character.y), player);

        team.addMember(player);
    }

    placeCharacters(data: PlayerNetworkData[], team: Team, isReconnect = false) {
        data.forEach(player => {
            this.placeCharacter(player, team, isReconnect);
        });
    }

    /** Hovering a self-target consumable highlights the acting character, the only one it affects. */
    previewSelfItem(index: number | null) {
        if (this.selfItemPreview) {
            this.hexGridManager.removeHighlight(this.selfItemPreview.x, this.selfItemPreview.y, HighlightType.SPELL);
            this.selfItemPreview.player.setItemPreviewed(false);
            this.selfItemPreview = null;
        }
        const player = this.selectedPlayer;
        const item = index == null ? null : player?.getItemAtSlot(index);
        if (!player || item?.target !== Target.SELF || this.unavailableActionReason(player)) return;
        this.selfItemPreview = {x: player.gridX, y: player.gridY, player};
        player.setItemPreviewed(true);
        this.hexGridManager.applyHighlight(player.gridX, player.gridY, TileColors.SPELL_RADIUS_ALLY, HighlightType.SPELL);
    }

    highlightCells(gridX, gridY, radius) {
        // Clear any existing highlights
        this.hexGridManager.clearHighlight();

        // Use the common helper with custom validation for movement
        this.hexGridManager.highlightTilesInRadius(
            gridX,
            gridY,
            radius,
            0x00ffff, // Cyan
            (targetX, targetY) => this.hexGridManager.isValidCell(gridX, gridY, targetX, targetY, this.isFree.bind(this))
        );
    }

    hasEnemyNextTo(gridX, gridY) {
        const enemyTeam = this.teamsMap.get(this.getOtherTeam(this.playerTeamId))
        return enemyTeam.getMembers().some(member => {
            return member.isAlive() && hexDistance(member.gridX, member.gridY, gridX, gridY) <= 1;
        });
    }

    create()
    {
        if (this.disposed) return;
        window.addEventListener(DESKTOP_ACTION_EVENT, this.handleDesktopAction as EventListener);

        this.setUpArena();
        this.createAnims();
        this.createSounds();
        this.createParticles();
        if (this.sound instanceof Phaser.Sound.WebAudioSoundManager) {
            // Phaser consumes this internal flag on its next update to unlock queued sounds.
            const sound = this.sound as Phaser.Sound.WebAudioSoundManager & {unlocked: boolean};
            this.stopAudioRecovery = watchAudioContext(sound.context, 'combat', () => {
                if (sound.locked) {
                    sound.unlocked = true;
                }
            });
        }

        this.localAnimationSprite = this.add.sprite(0, 0, '').setScale(LOCAL_ANIMATION_SCALE).setOrigin(0.5, 0.7).setVisible(false);
        this.localAnimationSprite.on('animationcomplete', () => this.localAnimationSprite.setVisible(false), this);

        this.input.mouse.disableContextMenu();

        this.musicManager = new MusicManager(this, 1, 12, [5, 6, 11]);
        const music = this.musicManager;
        void setRouteMusic('/game').then(() => {
            if (!this.disposed && !music.gameOver) music.playBeginning();
        });

        this.environmentalAudioSources = {
            flames: 0,
        }

        this.gameSettings = {
            tutorial: false,
            spectator: false,
            game0: false,
            mode: null,
        }

        this.hexGridManager = new HexGridManager(this);
        this.cameraHome = {x: this.cameras.main.width / 2, y: this.cameras.main.height / 2};

        this.sceneCreated = true;
        this.game.events.on(Phaser.Core.Events.POST_RENDER, this.reportArenaReady, this);
        this.emptyQueue();

        // Debug overlay for developers only; D is a bindable key for players.
        if (process.env.NODE_ENV !== 'production') this.input.keyboard.on('keydown-D', () => {
            this.hexGridManager.toggleCoordinateDisplay();
        });

        window.addEventListener('characterInSpellRadius', this.highlightCharacter);
        window.addEventListener('characterOutOfSpellRadius', this.unhighlightCharacter);
        window.addEventListener('blur', this.clearCharacterHover);
        this.game.events.on(Phaser.Core.Events.POST_RENDER, this.refreshCharacterHover);
    }

    private highlightCharacter = (e: CustomEvent) => {
        this.gridMap.get(serializeCoords(e.detail.x, e.detail.y))?.setTargetHighlighted(true);
    };
    private unhighlightCharacter = (e: CustomEvent) => {
        this.gridMap.get(serializeCoords(e.detail.x, e.detail.y))?.setTargetHighlighted(false);
    };

    enqueueMessage(event: string, data: unknown) {
        if (this.disposed) return;
        if (this.eventsQueue.length >= 1000) {
            this.failCombat(new Error('Match event backlog exceeded its limit'));
            return;
        }
        this.eventsQueue.push({event, data});
        void this.emptyQueue();
    }

    private draining = false;
    async emptyQueue() {
        if (this.draining || !this.sceneCreated || this.disposed) return;
        this.draining = true;
        try {
            while (this.eventsQueue.length && !this.disposed) {
                const index = this.gameInitialized ? 0 : this.eventsQueue.findIndex(message => message.event === 'gameStatus' || message.event === 'replayData');
                if (index < 0) break;
                // The authoritative snapshot supersedes updates received before it.
                if (index > 0) this.eventsQueue.splice(0, index);
                const {event, data} = this.eventsQueue.shift();
                await this.prepareMessageAssets(event, data);
                if (!this.disposed) await this.eventHandlers.get(event)?.(data);
            }
        } catch (error) {
            this.failCombat(error);
        } finally {
            this.draining = false;
        }
    }

    private failCombat = (error: unknown) => {
        if (this.disposed) return;
        events.emit('combatError', error);
        this.destroy();
    };

    async initializeGame(data: GameData): Promise<void> {
        if (this.disposed) return;
        if (this.teamsMap.size) {
            // A fresh server snapshot replaces the match, never appends a second scene's objects.
            // Reload preserves this match URL and credentials and rejoins authoritatively.
            window.location.reload();
            return;
        }
        await this.prepareMessageAssets('gameStatus', data);
        if (this.disposed) return;
        recordLoadingStep('finish');
        // A reconnect during loading is still a fresh battle. Only actual combat
        // progress skips the intro, never harmless messages buffered during loading.
        const isReconnect = data.general.combatStarted ?? data.turnee.turnNumber > 0;
        this.readyToken = data.general.readyToken ?? null;
        events.emit('towerInfo', data.general.tower || null);
        this.legacyFirstMatch = !this.readyToken && data.player.player.completedGames === 0 && !this.isReplay;
        // console.log(`[Arena:initializeGame] Reconnecting to game: ${isReconnect}`);

        this.playerTeamId = data.player.teamId;

        if(this.playerTeamId === undefined) {
            console.error('Player team id is undefined');
        }

        this.gameSettings.spectator = data.general.spectator;
        this.gameSettings.mode = data.general.mode;
        this.queue = data.queue;
        this.turnee = data.turnee;
        this.gameSettings.game0 = data.player.player.completedGames === 0;

        if (!this.isReplay && !data.general.spectator) {
            this.tutorialManager = new TutorialManager(events, data.player.player.engagementStats);
            events.emit('combatTipsAvailable', data.player.player.completedGames < 3);
        }

        this.teamsMap.set(data.player.teamId, new Team(this, data.player.teamId, true, data.player.player));
        this.teamsMap.set(data.opponent.teamId, new Team(this, data.opponent.teamId, false, data.general.mode === PlayMode.TOWER ? {...data.opponent.player, playerName: t(data.opponent.player.playerName)} : data.opponent.player));

        // Set up holes in the grid
        if (data.holes && this.hexGridManager) {
            this.hexGridManager.setHoles(data.holes);
        }

        this.tutorialIntroPending = this.gameSettings.game0 && !isReconnect && !this.isReplay && !data.general.spectator
            && (data.general.mode === PlayMode.PRACTICE || data.general.mode === PlayMode.TUTORIAL);

        // Events from the HUD
        this.hudHandlers = {
            inspectCharacter: this.inspectHUDCharacter,
            clearCharacterHover: this.clearCharacterHover,
            itemClick: (keyIndex: number) => { this.previewSelfItem(null); this.selectedPlayer?.onKey(keyIndex); },
            itemPreview: (index: number | null) => this.previewSelfItem(index),
            passTurn: () => { this.playSound('click'); this.socket.emit('passTurn'); },
            endgameLevelUp: this.playLevelUp,
            abandonGame: () => this.abandonGame(),
            exitGame: () => this.destroy(),
            tutorialIntroComplete: () => {
                if (!this.tutorialIntroPending) return;
                this.tutorialIntroPending = false;
                this.displayGEN(GEN.COMBAT_BEGINS);
            },
            teamRevealed: () => {
                this.displayGame(data, isReconnect);
            },
            versusShown: () => {
                this.displayGame(data, isReconnect);
            },
        };
        Object.entries(this.hudHandlers).forEach(([event, handler]) => { events.on(event, handler); });

        events.emit('gameInitialized', {game0: this.gameSettings.game0});

        events.emit('combatWaiting', !isReconnect);
        if (this.tutorialIntroPending) {
            events.emit('revealTeam', data.player.team);
        } else if (!isReconnect && !this.isReplay && !data.general.spectator && data.general.mode !== PlayMode.TUTORIAL) {
            // Both sides face off before the arena fills; the drop-in follows the versus screen.
            const tower = data.general.mode === PlayMode.TOWER;
            const side = (team: PlayerNetworkData[], player: GameData['player']['player'], name: string, enemy = false) => ({
                name, avatar: player.playerAvatar, league: player.playerLeague, rank: player.playerRank, bot: player.playerRank === -1,
                community: player.community ?? null,
                characters: team.map(character => ({name: tower && enemy ? t(character.name) : character.name,
                    portrait: character.portrait, class: character.class, level: character.level})),
            });
            events.emit('revealVersus', {
                mode: data.general.mode,
                floor: data.general.tower ? data.general.tower.floor : null,
                own: side(data.player.team, data.player.player, data.player.player.playerName),
                enemy: side(data.opponent.team, data.opponent.player, this.teamsMap.get(data.opponent.teamId)?.playerName ?? data.opponent.player.playerName, true),
            });
        } else {
            this.displayGame(data, isReconnect);
        }
    }

    displayGame(data: GameData, isReconnect: boolean) {
        if (this.arenaDisplayed || this.disposed) return;
        this.arenaDisplayed = true;
        this.placeCharacters(data.player.team, this.teamsMap.get(data.player.teamId), isReconnect);
        this.placeCharacters(data.opponent.team, this.teamsMap.get(data.opponent.teamId), isReconnect);
        if (data.general.tower) this.showTowerWarning(data.general.tower.warning);

        this.hexGridManager.floatHexTiles(
            this.handleTileClick.bind(this),
            this.handleTileHover.bind(this)
        );

        this.time.delayedCall(isReconnect ? 0 : AIR_ENTRANCE_DELAY + AIR_ENTRANCE_DELAY_VARIANCE * 2, () => {
            // Move this AFTER floatHexTiles so the tiles exist
            this.hexGridManager.setCharacterTiles(this.gridMap);
        });

        this.processTerrain(data.terrain, isReconnect); // Put after floatTiles() to allow for tilesMap to be intialized
        this.processWarmth(data.warmth ?? []);
        this.processSteam(data.steam ?? []);

        if (isReconnect) {
            this.setGameInitialized();
            this.selectTurnee();
        } else {
            const delay = 3000;
            this.time.delayedCall(delay + 1000, this.refreshOverview, [], this);
            this.time.delayedCall(delay, () => {
                if (!this.tutorialIntroPending) this.displayGEN(GEN.COMBAT_BEGINS);
                this.setGameInitialized();
                this.selectTurnee();
            });
        }
    }

    setGameInitialized() {
        this.gameInitialized = true;
        this.refreshOverview();
        void this.emptyQueue();
    }

    private reportArenaReady() {
        if (this.disposed || this.isReplay || document.hidden || !this.socket?.connected) return;
        if (window.matchMedia('(orientation: portrait)').matches) return;
        // POST_RENDER also runs behind the champion reveal, before gameInitialized.
        // Renew only while the loaded first-match introduction is being displayed.
        if (this.tutorialIntroPending && this.readyToken && performance.now() >= this.nextTutorialWaitingAt) {
            this.socket.emit('tutorialWaiting', this.readyToken);
            this.nextTutorialWaitingAt = performance.now() + 30_000;
        }
        if (!this.gameInitialized || this.pendingEntrances > 0) return;
        if (this.tutorialIntroPending) {
            if (!this.tutorialIntroShown) {
                this.tutorialIntroShown = true;
                events.emit('showTutorialIntro');
            }
            return;
        }
        // POST_RENDER runs after the intro and the first complete arena frame.
        if (this.readyToken) {
            this.socket.emit('arenaReady', this.readyToken);
            this.readyToken = null;
        } else if (this.legacyFirstMatch) {
            this.socket.emit('teamRevealed');
            this.legacyFirstMatch = false;
        }
    }

    startAnimation() {
        const bandHeight = 300;
        const screenWidth = this.cameras.main.width;
        const screenHeight = this.cameras.main.height;
        const bandY = (screenHeight - bandHeight) / 2; // Position Y so the band is centered vertically

        // Create the semi-transparent black band
        let currentHeight = 1; // Start with a height of 1
        const band = this.add.graphics({ fillStyle: { color: 0x000000, alpha: 0.5 } }).setDepth(10);
        band.fillRect(0, bandY, screenWidth, currentHeight);

        // Animate the height of the band
        this.tweens.add({
            targets: { height: 1 },
            height: bandHeight, // Target height for the animation
            duration: 500,
            ease: 'Power2',
            onUpdate: (tween) => {
                currentHeight = tween.getValue();
                band.clear(); // Clear previous frame
                band.fillRect(0, bandY, screenWidth, currentHeight);
            },
            onComplete: () => {
                // Once band animation is complete, animate 'START' text
                const startText = this.add.text(0, bandY + (bandHeight - 20) / 2, t("FIGHT!"), { fontSize: 40 * loadGameSettings().textSize / 100, color: '#FFFFFF', fontFamily: fontFamily() }).setAlpha(0).setDepth(11);
                startText.x = -startText.width; // Position text off-screen to the left

                // Slide in animation for 'START' text
                this.tweens.add({
                    targets: startText,
                    x: (screenWidth - startText.width) / 2,
                    alpha: 1,
                    duration: 500,
                    ease: 'Power2',
                    hold: 500, // Keep in place for a bit
                    onComplete: () => {
                        // Slide out to the right
                        this.tweens.add({
                            targets: startText,
                            x: screenWidth,
                            alpha: 0,
                            duration: 200,
                            ease: 'Power2',
                            onComplete: () => {
                                // Cleanup: remove the text and band
                                startText.destroy();
                                band.destroy();
                            }
                        });
                    }
                });
            }
        });
    }

    enqueueGEN(gen: Announcement) {
        this.genQueue.push(gen);
        this.processGENQueue();
    }

    processGENQueue() {
        if (this.gameEnded || this.isDisplayingGEN || this.killCamActive || this.genQueue.length === 0) {
            return;
        }
        this.isDisplayingGEN = true;
        const gen = this.genQueue.shift();
        this.displayGEN(gen).then(() => {
            this.isDisplayingGEN = false;
            this.processGENQueue(); // Proceed to next GEN
        });
    }

    displayGEN(gen: Announcement): Promise<void> {
        if (this.gameEnded) return Promise.resolve();

        return new Promise((resolve) => {
            if (this.killCamActive) {
                this.genQueue.unshift(gen);
                resolve();
                return;
            }

            if (gen !== GEN.COMBAT_BEGINS && this.gameSettings.game0) {
                return;
            }

            const config = Arena.GEN_CONFIGS[gen];
            if (!config) {
                resolve();
                return;
            }

            // Setup GEN Background
            const textTweenDuration = 600;
            const textDelay = 400;
            const yOffset = 80;
            const bgYPosition = yOffset;
            // Remove camera scroll from xPosition since we're using setScrollFactor(0)
            const xPosition = this.cameras.main.centerX;
            const yPosition = yOffset;
            const scale = 0.5;

            let genBg = this.add.image(xPosition, bgYPosition, 'gen_bg')
                .setScrollFactor(0)
                .setAlpha(0)
                .setDepth(10)
                .setScale(scale);

            this.tweens.add({
                targets: genBg,
                alpha: 0.7,
                duration: 200,
                ease: 'Power2',
            });

            // Whole-phrase artwork lets translators change word order and line breaks.
            const localizedKey = `announcement_${gen}`;
            const localized = this.textures.exists(localizedKey);
            const targets: (Phaser.GameObjects.Image | Phaser.GameObjects.Text)[] = [];
            if (localized) {
                const title = this.add.image(-350, yPosition, localizedKey)
                    .setScrollFactor(0).setDepth(10);
                title.setScale(Math.min(640 / title.width, 180 / title.height, (this.cameras.main.width - 32) / title.width));
                targets.push(title);
            } else if (language !== 'en' || !config.text1) {
                // Without word artwork, English lettering matches the artwork's cyan and navy.
                const lettered = language === 'en';
                const title = this.add.text(-350, yPosition, lettered ? t(config.label).toUpperCase() : t(config.label), {
                    fontFamily: fontFamily(), fontSize: lettered ? 64 : 48, fontStyle: 'bold', color: lettered ? '#5ff2ff' : '#d9f5ff',
                    stroke: lettered ? '#0b2a44' : '#17384e', strokeThickness: lettered ? 9 : 5, align: 'center',
                    shadow: lettered ? {offsetX: 0, offsetY: 5, color: '#0b2a44', fill: true, stroke: true} : undefined,
                    wordWrap: {width: Math.min(640, this.cameras.main.width - 32), useAdvancedWrap: true},
                }).setOrigin(0.5).setScrollFactor(0).setDepth(10);
                title.setScale(Math.min(1, 180 / title.height));
                targets.push(title);
            } else {
            targets.push(
                this.add.image(-350, yPosition, config.text1)
                    .setScrollFactor(0) // Make it stick to camera
                    .setDepth(10)
                    .setScale(scale),
                this.add.image(this.cameras.main.width + 100, yPosition, 'blue_bang')
                    .setScrollFactor(0) // Make it stick to camera
                    .setDepth(10)
                    .setScale(scale)
            );

            if (config.text2) {
                targets.push(
                    this.add.image(this.cameras.main.width + 100, yPosition, config.text2)
                        .setScrollFactor(0) // Make it stick to camera
                        .setDepth(10)
                        .setScale(scale)
                );
            }

            }

            // Animate GEN Texts into View
            this.tweens.add({
                targets,
                x: xPosition,
                duration: textTweenDuration,
                ease: 'Power2',
                delay: textDelay,
                onComplete: () => {
                    // After displaying, wait for a duration then fade out
                    this.time.delayedCall(2000, () => {
                        this.tweens.add({
                            targets: targets.concat([genBg]),
                            alpha: 0,
                            duration: 200,
                            ease: 'Power2',
                            onComplete: () => {
                                // Clean up GEN elements
                                targets.forEach(t => {
                                    t.destroy();
                                });
                                genBg.destroy();
                                resolve(); // Resolve the promise to allow next GEN to be processed
                            }
                        });
                    });
                }
            });
        });
    }

    getOverview() {
        const overview =  {
            team1: this.teamsMap.get(1).getOverview(),
            team2: this.teamsMap.get(2).getOverview(),
            general: this.gameSettings,
            initialized: this.gameInitialized,
            queue: this.getQueue(),
            turnee: this.getTurnee(),
        };
        return overview;
    }

    getQueue() {
        return this.queue;
    }

    getTurnee() {
        return this.turnee;
    }

    /**
     * X-tier spells get a moment of their own while they charge: the field dims around the caster,
     * the camera closes in and the HUD names the spell. The impact ends it with a white flash.
     */
    private startSpellCinematic(caster: Player, spell: BaseSpell) {
        this.endSpellCinematic(false);
        const camera = this.cameras.main;
        const overlay = this.add.rectangle(camera.width / 2, camera.height / 2, camera.width * 3, camera.height * 3, 0x07040c, 0)
            .setDepth(5);
        this.tweens.add({targets: overlay, fillAlpha: 0.62, duration: 320, ease: 'Sine.easeOut'});
        // Above the dimmed field, below the effects and announcements.
        caster.setDepth(5.5);
        this.cinematic = {caster, overlay};
        const element = ['fire', 'ice', 'thunder'].find(key => spell.vfx?.includes(key) || spell.charge?.includes(key)) ?? 'fire';
        events.emit('spellCinematic', {caster: caster.name, spell: spell.name, element, own: caster.isPlayer});
        if (!FREEZE_CAMERA) {
            camera.pan(caster.x, caster.y - 20, 450, 'Sine.easeOut', true);
            camera.zoomTo(1.3, 450, 'Sine.easeOut', true);
        }
        rumble(0.15, 0.35, 300);
    }

    private endSpellCinematic(impact: boolean) {
        const cinematic = this.cinematic;
        if (!cinematic) return;
        this.cinematic = null;
        events.emit('spellCinematic', null);
        cinematic.caster.setDepth(this.yToZ(cinematic.caster.gridY));
        this.tweens.add({targets: cinematic.overlay, fillAlpha: 0, duration: impact ? 140 : 260,
            onComplete: () => cinematic.overlay.destroy()});
        if (impact && screenEffectsEnabled()) {
            this.cameras.main.flash(260, 255, 248, 235);
            shake(this, 420, 0.012);
        }
        if (impact) rumble(0.8, 0.6, 320);
        if (!FREEZE_CAMERA) {
            this.cameras.main.pan(this.cameraHome.x, this.cameraHome.y, 500, 'Sine.easeInOut', true);
            this.cameras.main.zoomTo(1, 500, 'Sine.easeInOut', true);
        }
    }

    /** A character was just knocked out: credit the blow, track the honours, check for a last stand. */
    onCharacterDown(victim: Player) {
        if (!this.gameInitialized) return;
        if (victim.team.id === this.playerTeamId) this.ownLosses++;
        const alive = (teamId: number) => this.teamsMap.get(teamId)?.members.filter(member => member.isAlive()).length ?? 0;
        this.worstDeficit = Math.min(this.worstDeficit, alive(this.playerTeamId) - alive(this.getOtherTeam(this.playerTeamId)));
        // The attack or spell event can trail the HP change by a moment.
        this.time.delayedCall(200, () => {
            const blow = this.lastBlow;
            if (!blow || Date.now() - blow.at > 2500 || blow.by.team === victim.team || this.disposed) return;
            const kills = (this.killsBy.get(blow.by) ?? 0) + 1;
            this.killsBy.set(blow.by, kills);
            if (kills >= 2 && !this.gameEnded) this.enqueueGEN('rampage');
        });
        this.refreshLastStands();
    }

    onCharacterUp() {
        if (this.gameInitialized) this.refreshLastStands();
    }

    /** A team reduced to one character makes its last stand: callout, aura, and for your own team a vignette and the music at full tilt. */
    private refreshLastStands() {
        for (const team of this.teamsMap.values()) {
            const alive = team.members.filter(member => member.isAlive());
            const standing = alive.length === 1 && team.members.length > 1;
            const aura = this.lastStands.get(team.id);
            if (standing && !aura && !this.gameEnded) {
                const survivor = alive[0];
                const own = team.id === this.playerTeamId;
                this.lastStands.set(team.id, this.lastStandAura(survivor));
                this.whenKillCamEnds(() => {
                    if (this.gameEnded || !survivor.isAlive()) return;
                    events.emit('combatCallout', {kind: 'lastStand', name: survivor.name, own});
                    if (own) events.emit('lastStand', true);
                    this.musicManager.surge();
                    rumble(own ? 0.5 : 0.2, 0.4, 260);
                });
            } else if (!standing && aura) {
                aura.destroy();
                this.lastStands.delete(team.id);
                if (team.id === this.playerTeamId) events.emit('lastStand', false);
            }
        }
    }

    private lastStandAura(player: Player) {
        return this.add.particles(0, 0, 'fx_spark', {
            lifespan: 900, frequency: 70, speedY: {min: -70, max: -25}, x: {min: -22, max: 22}, y: {min: -20, max: 40},
            scale: {start: 0.5, end: 0}, alpha: {start: 0.85, end: 0}, tint: [0xff6a3a, 0xffb347, 0xe0412f], blendMode: 'ADD',
            follow: player,
        }).setDepth(player.depth + 0.005);
    }

    /** Honours shown on the end screen, from the whole match. */
    private matchHonours(data: OutcomeData): string[] {
        const honours: string[] = [];
        const enemies = this.teamsMap.get(this.getOtherTeam(this.playerTeamId))?.members.length ?? 0;
        const own = this.teamsMap.get(this.playerTeamId)?.members ?? [];
        if (data.isWinner && this.worstDeficit <= -2) honours.push('comeback');
        if (data.isWinner && this.ownLosses === 0 && own.length > 1) honours.push('flawless');
        const ace = data.teamStats
            ? data.teamStats.some(stats => stats.kills >= enemies)
            : own.some(member => (this.killsBy.get(member) ?? 0) >= enemies);
        if (data.isWinner && enemies >= 2 && ace) honours.push('ace');
        return honours;
    }

    /** Every kill gets the slow-motion kill cam, a moment after the blow so every HP change has arrived. */
    requestKillCam(x: number, y: number) {
        if (this.killCamActive || this.killCamCheck) {
            this.flushAfterKillCam();
            return;
        }
        this.killCamCheck = this.time.delayedCall(120, () => {
            this.killCamCheck = null;
            this.killCam(x, y);
        });
    }

    private killCamBusy() {
        return this.killCamActive || this.killCamCheck !== null || this.killsInFlight > 0;
    }

    /** Run now, or once pending kills have landed and the kill cam has returned to normal speed. */
    private whenKillCamEnds(callback: () => void) {
        if (this.killCamBusy()) this.afterKillCam.push(callback);
        else callback();
    }

    private flushAfterKillCam() {
        if (this.killCamBusy()) return;
        this.afterKillCam.splice(0).forEach(callback => { callback(); });
    }

    killCam(x, y) {
        this.killCamActive = true;
        // The camera returns to its resting framing, not wherever a cinematic left it.
        const originalZoom = 1;
        const originalTimeScale = this.localAnimationSprite.anims.timeScale;
        const originalSoundRate = this.sound.rate;
        const originalTweenRate = this.tweens.timeScale;
        const emitters = [this.sparkEmitter, this.emberEmitter, this.tintedSparkEmitter];

        const targetZoom = 2;
        const slowMotionScale = 0.2;

        this.sound.setRate(slowMotionScale);
        this.localAnimationSprite.anims.timeScale = slowMotionScale;
        this.tweens.timeScale = slowMotionScale;
        emitters.forEach(emitter => { emitter.timeScale = slowMotionScale; });

        // For every sprites in this.sprites, set anims.timeScale to slowMotionScale
        this.sprites.forEach((sprite) => {
            if (sprite.anims) sprite.anims.timeScale = slowMotionScale;
        });

        const cameraSpeed = 200;
        if (!FREEZE_CAMERA) {
            this.cameras.main.pan(x, y, cameraSpeed, 'Power2', true);
            this.cameras.main.zoomTo(targetZoom, cameraSpeed, 'Power2', true);
        }

        // Any click or key skips the rest of the kill cam.
        const skip = () => this.endKillCam?.();
        const timer = this.time.delayedCall(KILL_CAM_DURATION * 1000, skip);
        this.input.once('pointerdown', skip);
        window.addEventListener('keydown', skip, {once: true});

        this.endKillCam = () => {
            this.endKillCam = null;
            timer.remove();
            this.input.off('pointerdown', skip);
            window.removeEventListener('keydown', skip);
            if (this.disposed) return;
            // Force the return: an early skip can arrive while zoom-in is still running.
            // Phaser otherwise ignores it and finishes zooming in after the kill cam ends.
            if (!FREEZE_CAMERA) {
                this.cameras.main.pan(this.cameraHome.x, this.cameraHome.y, cameraSpeed, 'Power2', true);
                this.cameras.main.zoomTo(originalZoom, cameraSpeed, 'Power2', true);
            }
            this.localAnimationSprite.anims.timeScale = originalTimeScale;
            this.sound.setRate(originalSoundRate);
            this.tweens.timeScale = originalTweenRate;
            emitters.forEach(emitter => { emitter.timeScale = 1; });

            this.sprites.forEach((sprite) => {
                if (sprite.anims) sprite.anims.timeScale = originalTimeScale;
            });
            this.killCamActive = false;
            this.flushAfterKillCam();
            this.processGENQueue(); // Trigger processing of GEN queue after kill cam
        };
    }

    createParticles() {
        if (!this.textures.exists('fx_spark')) {
            const graphics = this.make.graphics({x: 0, y: 0}, false);
            graphics.fillStyle(0xffffff, 1).fillCircle(4, 4, 4);
            graphics.generateTexture('fx_spark', 8, 8);
            graphics.destroy();
        }
        // Below the announcements (depth 10), above every character.
        this.sparkEmitter = this.add.particles(0, 0, 'fx_spark', {
            emitting: false, lifespan: {min: 220, max: 480}, speed: {min: 120, max: 320}, angle: {min: 200, max: 340},
            gravityY: 700, scale: {start: 0.7, end: 0}, tint: EMBER_TINTS, blendMode: 'ADD',
        }).setDepth(9);
        this.tintedSparkEmitter = this.add.particles(0, 0, 'fx_spark', {
            emitting: false, lifespan: {min: 300, max: 600}, speed: {min: 60, max: 180}, gravityY: 200,
            scale: {start: 0.6, end: 0}, blendMode: 'ADD',
        }).setDepth(9);
        this.emberEmitter = this.add.particles(0, 0, 'fx_spark', {
            emitting: false, lifespan: {min: 700, max: 1400}, speedY: {min: -130, max: -40}, speedX: {min: -35, max: 35},
            x: {min: -18, max: 18}, scale: {start: 0.6, end: 0}, alpha: {start: 1, end: 0}, tint: EMBER_TINTS, blendMode: 'ADD',
        }).setDepth(9);
    }

    /** A burst of sparks; an optional tint replaces the ember colours. */
    sparks(x: number, y: number, count: number, tint?: number) {
        if (!this.sparkEmitter || count <= 0) return;
        if (tint === undefined) {
            this.sparkEmitter.explode(count, x, y);
            return;
        }
        this.tintedSparkEmitter.setParticleTint(tint);
        this.tintedSparkEmitter.explode(count, x, y);
    }

    /** Embers drifting up, for knockouts and victories. */
    embers(x: number, y: number, count: number) {
        this.emberEmitter?.explode(count, x, y);
    }

    dustPuff(x: number, y: number, depth: number, scale = 0.7) {
        if (this.disposed) return;
        const puff = this.add.sprite(x, y, '').setDepth(depth).setScale(scale).setAlpha(0.6);
        puff.play('smoke');
        puff.once('animationcomplete', () => puff.destroy());
    }

    /** Embers gathering around a caster charging a spell. */
    chargeAura(player: Player, charge: string) {
        const element = Object.keys(CHARGE_TINTS).find(key => charge.includes(key)) ?? 'fire';
        return this.add.particles(0, 0, 'fx_spark', {
            lifespan: 700, frequency: 45, speedY: {min: -90, max: -30}, x: {min: -26, max: 26}, y: {min: -10, max: 30},
            scale: {start: 0.55, end: 0}, alpha: {start: 0.9, end: 0}, tint: CHARGE_TINTS[element], blendMode: 'ADD',
            follow: player,
        }).setDepth(player.depth + 0.005);
    }

    /** While hovering a reachable tile: the route there and a ghost of the unit at the end. */
    showMovePreview(gridX: number, gridY: number) {
        this.clearMovePreview();
        const player = this.selectedPlayer;
        if (!player?.isPlayer || player.pendingSpell != null || player.pendingItem != null || this.isInTargetMode
            || this.unavailableActionReason(player) || this.gridMap.has(serializeCoords(gridX, gridY))
            || !player.canMoveTo(gridX, gridY)
            || !this.hexGridManager.isValidCell(player.gridX, player.gridY, gridX, gridY, this.isFree.bind(this))) return;
        const dots = this.add.graphics().setDepth(2);
        dots.fillStyle(0xfff1c9, 0.9);
        for (const cell of listCellsOnTheWay(player.gridX, player.gridY, gridX, gridY)) {
            const [x, y] = cell.split(',').map(Number);
            if (x === gridX && y === gridY) continue;
            const {x: px, y: py} = this.hexGridToPixelCoords(x, y);
            dots.fillCircle(px, py + 40, 7);
        }
        const {x, y} = this.hexGridToPixelCoords(gridX, gridY);
        const ghost = this.add.sprite(x, y, player.texture, player.sprite.frame.name)
            .setAlpha(0.55).setTint(0xcfe8ff).setFlipX(gridX === player.gridX ? player.sprite.flipX : gridX > player.gridX)
            .setDepth(this.yToZ(gridY) - 0.005);
        this.movePreview = [dots, ghost];
    }

    clearMovePreview() {
        this.movePreview.forEach(object => { object.destroy(); });
        this.movePreview = [];
    }

    addFlames() {
        this.environmentalAudioSources.flames++;
        this.updateEnvironmentAudio();
    }

    removeFlames() {
        this.environmentalAudioSources.flames--;
        this.updateEnvironmentAudio();
    }

    updateEnvironmentAudio() {
        if (this.gameEnded || !this.gameInitialized) return;
        const flames = this.environmentalAudioSources.flames;
        if (flames > 0) {
            this.playSound('flames', 1, true);
        } else {
            this.stopSound('flames');
        }
    }

    abandonGame() {
        this.socket.emit('abandonGame');
        this.destroy();
    }

    private handleReconnectFailure = () => {
        silentErrorToast(t("Could not reconnect to server"));
        events.emit('serverDisconnect');
        this.destroy();
    };

    destroy() {
        this.game.events.off(Phaser.Core.Events.POST_RENDER, this.reportArenaReady, this);
        if (this.disposed) return;
        this.clearCharacterHover();
        this.game.events.off(Phaser.Core.Events.POST_RENDER, this.refreshCharacterHover);
        window.removeEventListener('blur', this.clearCharacterHover);
        this.disposed = true;
        this.stopAudioRecovery?.();
        this.stopAudioRecovery = null;
        this.eventsQueue.length = 0;
        window.removeEventListener('characterInSpellRadius', this.highlightCharacter);
        window.removeEventListener('characterOutOfSpellRadius', this.unhighlightCharacter);
        this.gameEnded = true;
        window.removeEventListener(DESKTOP_ACTION_EVENT, this.handleDesktopAction as EventListener);
        events.emit('notifyMatchmakerLeave');
        this.socket?.removeAllListeners();
        this.socket?.io?.off('reconnect_failed', this.handleReconnectFailure);
        this.socket?.disconnect();
        Object.entries(this.hudHandlers).forEach(([event, handler]) => { events.off(event, handler); });
        events.off('settingsChanged', this.onSettingsChanged, this);
        this.endKillCam?.();
        this.afterKillCam.length = 0;
        this.clearMovePreview();
        this.musicManager?.destroy();
        this.tutorialManager?.destroy();
        this.tweens?.killAll();
        this.time?.removeAllEvents();
        // Phaser owns the display list (including Player containers and children).
        // Destroying those manually as well can destroy the same sprite twice.
        this.scene.stop();
    }

    // update (time, delta)
    // {
    // }

    getCharacterPosition(playerTeam: boolean, characterIdx: number) {
        const teamId = playerTeam ? this.playerTeamId : 2;
        const character = this.teamsMap.get(teamId).members[characterIdx];
        return {x: character.gridX, y: character.gridY};
    }

    summonEnemy(x: number, y: number, attackMode: AIAttackMode = AIAttackMode.IDLE) {
        this.send('tutorialEvent', {action: 'summonEnemy', x, y, attackMode});
    }

    summonAlly(x: number, y: number, className: Class) {
        this.send('tutorialEvent', {action: 'summonAlly', x, y, className});
    }

    putInFormation() {
        this.send('tutorialEvent', {action: 'putInFormation'});
    }

    slowDownCooldowns() {
        this.send('tutorialEvent', {action: 'slowDownCooldowns'});
    }

    isCharacterSelected(index: number) {
        return this.selectedPlayer?.num === index;
    }

    isTutorial() {
        return this.gameSettings.tutorial;
    }

    async handleReplayData(data: {messages: GameReplayMessage[]}) {
        this.isReplay = true;
        this.replayData = data;

        // Initialize game with first gameStatus message
        const initialStatus = this.replayData.messages.find(m => m.event === 'gameStatus');
        if (initialStatus) {
            await this.initializeGame(initialStatus.data as GameData);
        } else throw new Error('Replay has no initial match snapshot');

        // Start replay timer
        this.startReplayPlayback();
    }

    startReplayPlayback() {
        this.currentReplayIndex = 0;
        this.processNextReplayEvent();
    }

    processNextReplayEvent() {
        if (this.currentReplayIndex >= this.replayData.messages.length) {
            console.log('Replay finished');
            return;
        }

        const currentMessage = this.replayData.messages[this.currentReplayIndex];
        const nextMessage = this.replayData.messages[this.currentReplayIndex + 1];

        // Process current message
        if (currentMessage.event !== 'gameStatus') { // We already processed gameStatus
            this.processReplayMessage(currentMessage);
        }

        this.currentReplayIndex++;

        // Schedule next message if there is one
        if (nextMessage) {
            const delay = nextMessage.timestamp - currentMessage.timestamp;
            this.time.delayedCall(delay, this.processNextReplayEvent, [], this);
        }
    }

    processReplayMessage(message: GameReplayMessage) {
        const handler = this.eventHandlers.get(message.event);
        if (handler) {
            this.enqueueMessage(message.event, message.data);
        } else {
            console.warn(`No handler found for replay event: ${message.event}`);
        }
    }

    darkenScene(targetHighlight: TargetHighlight = TargetHighlight.ENEMY) {
        if (this.isDarkened) return;
        this.isDarkened = true;

        this.getAllDarkenableObjects().forEach(obj => {
            obj.setTint(TINT_COLOR);
        });
        this.hexGridManager.darkenAllTiles(TINT_COLOR);

        // Process players separately for health bars
        this.teamsMap.forEach(team => {
            team.members.forEach(player => {
                if (this.shouldStayBright(player, targetHighlight)) {
                    player.sprite.clearTint();
                    player.healthBar?.brighten();
                    player.MPBar?.brighten();
                } else {
                    player.healthBar?.darken();
                    player.MPBar?.darken();
                }
            });
        });
    }

    brightenScene() {
        if (!this.isDarkened) return;
        this.isDarkened = false;

        this.getAllDarkenableObjects().forEach(obj => {
            obj.clearTint();
        });
        this.hexGridManager.brightenAllTiles();

        // Brighten all bars
        this.teamsMap.forEach(team => {
            team.members.forEach(player => {
                player.healthBar?.brighten();
                player.MPBar?.brighten();
            });
        });

        // Restore movement range highlight if appropriate
        if (this.selectedPlayer?.canAct() &&
            !this.selectedPlayer?.pendingSpell &&
            !this.selectedPlayer?.pendingItem) {
            this.selectedPlayer.displayMovementRange();
        }
    }

    private shouldStayBright(player: Player, targetHighlight: TargetHighlight = TargetHighlight.ENEMY): boolean {
        const isAlly = this.isAlly(player);

        switch (targetHighlight) {
            case TargetHighlight.ALLY:
                return isAlly && player.isAlive();
            case TargetHighlight.ENEMY:
                return !isAlly && player.isAlive();
            case TargetHighlight.DEAD:
                return !player.isAlive();
            default:
                return !isAlly && player.isAlive();
        }
    }

    private handleFireTerrain(x: number, y: number) {
        const TERRAIN_SPRITE_DELAY = 200;
        const {x: pixelX, y: pixelY} = this.hexGridToPixelCoords(x, y);
        // Do nothing if the tile already has fire
        if (this.terrainMap.get(serializeCoords(x, y)) === Terrain.FIRE) return;
        this.time.delayedCall(TERRAIN_SPRITE_DELAY, () => {
            const sprite = this.add.sprite(pixelX, pixelY, '')
                .setDepth(this.yToZ(y)).setScale(0.5 * VFX_DISPLAY_SCALE).setAlpha(0.9);
            this.addFlames();
            sprite.on('destroy', () => {
                this.removeFlames();
            });
            const randomLevel = terrainFireLevels[Math.floor(Math.random() * terrainFireLevels.length)];
            sprite.anims.play(`terrain_fire_${randomLevel}`);
            // Apply a random flip X
            if (Math.random() < 0.5) {
                sprite.setFlipX(true);
            }
            this.sprites.push(sprite);
            this.terrainSpritesMap.set(serializeCoords(x, y), sprite);
            this.terrainMap.set(serializeCoords(x, y), Terrain.FIRE);
            events.emit('flamesAppeared');
        });
    }

    private iceFormation(x: number, y: number, isReconnect = false) {
        const {x: pixelX, y: pixelY} = this.hexGridToPixelCoords(x, y);
        const depth = this.yToZ(y) + DEPTH_OFFSET;
        const TERRAIN_SPRITE_DELAY = 200;

        // Helper function to create ice block and update maps
        const createIceAndUpdateMaps = () => {
            const icesprite = this.createIceBlock(x, y);
            this.terrainSpritesMap.set(serializeCoords(x, y), icesprite);
            this.terrainMap.set(serializeCoords(x, y), Terrain.ICE);
            this.hexGridManager.setObstacle(x, y, true);
            events.emit('iceAppeared');
        };

        if (isReconnect) {
            // Skip animation and create ice block immediately when reconnecting
            createIceAndUpdateMaps();
        } else {
            // Generate a random delay between 0-150ms for more natural look when multiple blocks appear
            const randomDelay = Math.floor(Math.random() * 150);

            // Use Phaser's time delayed call to execute with random delay
            this.time.delayedCall(TERRAIN_SPRITE_DELAY + randomDelay, () => {
                // Create meltdown sprite for reverse animation
                const meltdownSprite = this.add.sprite(pixelX, pixelY, 'meltdown')
                    .setDepth(depth)
                    .setOrigin(0.5, 0.35);

                // Play the reverse animation
                meltdownSprite.play(this.iceFormingAnim());

                // When animation completes, create the ice block
                meltdownSprite.once('animationcomplete', () => {
                    meltdownSprite.destroy();

                    // Create the ice block and update maps
                    createIceAndUpdateMaps();
                });
            });
        }
    }

    /** The meltdown played backwards: ice forming. */
    private iceFormingAnim() {
        const key = 'meltdown_reverse';
        if (!this.anims.exists(key)) {
            const frames = this.anims.generateFrameNumbers('meltdown');
            this.anims.create({
                key,
                frames: this.anims.generateFrameNumbers('meltdown', { frames: frames.map((_, i) => frames.length - 1 - i) }),
                frameRate: 10
            });
        }
        return key;
    }

    /** Ice cast on a warm tile forms, then melts straight away, so players see why it didn't hold. */
    private blockedIce(x: number, y: number) {
        const {x: pixelX, y: pixelY} = this.hexGridToPixelCoords(x, y);
        this.time.delayedCall(200 + Math.floor(Math.random() * 150), () => {
            if (this.disposed) return;
            const sprite = this.add.sprite(pixelX, pixelY, 'meltdown')
                .setDepth(this.yToZ(y) + DEPTH_OFFSET)
                .setOrigin(0.5, 0.35);
            sprite.play(this.iceFormingAnim());
            sprite.once('animationcomplete', () => {
                this.meltedText(x, y);
                sprite.play('meltdown');
                sprite.once('animationcomplete', () => sprite.destroy());
            });
        });
    }

    /** Floats "Melted" over a tile whose ice fire or Warmth melted. */
    private meltedText(x: number, y: number) {
        const {x: pixelX, y: pixelY} = this.hexGridToPixelCoords(x, y);
        const text = this.add.text(pixelX, pixelY - 20, t('Melted'), {
            fontSize: 22 * loadGameSettings().textSize / 100, color: '#ffc46b', stroke: '#000', strokeThickness: 3, fontFamily: fontFamily(),
        }).setOrigin(0.5).setDepth(10);
        this.tweens.add({targets: text, y: pixelY - 55, alpha: 0, duration: 1800, ease: 'Power2', onComplete: () => text.destroy()});
    }

    private handleIceTerrain(x: number, y: number, isReconnect = false) {
        if (this.terrainMap.get(serializeCoords(x, y)) === Terrain.ICE) return;
        this.iceFormation(x, y, isReconnect);
    }

    private meltdown(sprite: Phaser.GameObjects.Sprite) {
        // Create a meltdown sprite at the same position as the terrain sprite
        const meltdownSprite = this.add.sprite(
            sprite.x,
            sprite.y,
            'meltdown'
        )
            .setDepth(sprite.depth + 0.01)
            .setScale(sprite.scaleX)
            .setOrigin(0.5, 0.5);

        // Hide the original terrain sprite
        sprite.setVisible(false);

        // Play meltdown animation
        meltdownSprite.play('meltdown');

        // When animation completes, destroy both sprites
        meltdownSprite.once('animationcomplete', () => {
            meltdownSprite.destroy();
            sprite.destroy();
        });
    }

    private handleClearTerrain(x: number, y: number, iceRemoval?: TerrainUpdate['iceRemoval']) {
        if (iceRemoval === 'blocked') {
            this.blockedIce(x, y);
            return;
        }
        if (iceRemoval === 'warmth' && this.terrainSpritesMap.has(serializeCoords(x, y))) this.meltedText(x, y);
        this.hexGridManager.setObstacle(x, y, false);
        this.terrainMap.delete(serializeCoords(x, y));
        const terrainsprite = this.terrainSpritesMap.get(serializeCoords(x, y));
        if (terrainsprite) {
            if (iceRemoval === 'shatter') shatterIce(this, terrainsprite);
            else this.meltdown(terrainsprite);
            this.terrainSpritesMap.delete(serializeCoords(x, y));
        }
    }

    private createCharacterAnim(asset: string, key: string, frames: number[], config = {}) {
        this.anims.create({
            key: `${asset}_anim_${key}`,
            frames: this.anims.generateFrameNumbers(asset, { frames }),
            frameRate: BASE_ANIM_FRAME_RATE,
            ...config
        });
    }

    private getAllDarkenableObjects() {
        return [
            ...this.sprites,
            ...Array.from(this.teamsMap.values()).flatMap(team =>
                team.members.map(player => player.sprite)
            )
        ];
    }

    // Add helper methods:
    isPlayerTeam(teamId: number): boolean {
        return teamId === this.playerTeamId;
    }

    isAlly(player: Player): boolean {
        return this.isPlayerTeam(player.team.id);
    }

    hexGridToPixelCoords(gridX, gridY) {
        return this.hexGridManager.hexGridToPixelCoords(gridX, gridY);
    }

    updateTargetHighlight(pointer) {
        if (!this.isInTargetMode || !this.selectedPlayer) return;

        const {gridX, gridY} = this.hoverSource === 'battlefield' && this.hoveredPlayer
            ? this.hoveredPlayer : this.hexGridManager.pointerToHexGrid(pointer);

        // Calculate distance from player to highlight center
        const playerX = this.selectedPlayer.gridX;
        const playerY = this.selectedPlayer.gridY;
        const distance = hexDistance(playerX, playerY, gridX, gridY);

        // Get the current spell
        const spell = this.selectedPlayer?.spells[this.selectedPlayer?.pendingSpell];
        const isAllyTargetingSpell = spell?.targetHighlight === TargetHighlight.ALLY;

        // Check if the target is within range (player's distance + SPELL_RANGE)
        if (this.hexGridManager.isValidGridPosition(gridX, gridY) && distance <= this.selectedPlayer.distance + SPELL_RANGE) {
            // Clear previous spell highlights but keep target range
            this.hexGridManager.clearHighlightOfType(HighlightType.SPELL);

            // Highlight spell area with direct gridMap reference
            this.hexGridManager.highlightSpellRadius(
                gridX,
                gridY,
                this.targetModeSize,
                this.gridMap,
                player => this.isAlly(player),
                isAllyTargetingSpell
            );
        }
    }

    hasObstacle(gridX: number, gridY: number) {
        return this.hexGridManager.hasObstacle(gridX, gridY);
    }
}
