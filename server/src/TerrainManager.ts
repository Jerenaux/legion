import {FIRE_POTENCY, supportAmount} from '@legion/shared/combatBalance';
import {Stat} from '@legion/shared/enums';
import type {ServerPlayer} from './ServerPlayer';
import { Game } from "./Game";
import { Spell } from "./Spell";
import { TerrainUpdate } from '@legion/shared/interfaces';
import { Terrain } from '@legion/shared/enums';
import { getTilesInHexRadius, isSkip } from '@legion/shared/utils';

class TerrainIncompatibility {
    private incompatibilities: Map<Terrain, Terrain[]>;


    constructor() {
        this.incompatibilities = new Map();
    }

    addIncompatibility(terrain1: Terrain, terrain2: Terrain): void {
        this.addOneWayIncompatibility(terrain1, terrain2);
        this.addOneWayIncompatibility(terrain2, terrain1);
    }

    private addOneWayIncompatibility(from: Terrain, to: Terrain): void {
        if (!this.incompatibilities.has(from)) {
            this.incompatibilities.set(from, []);
        }
        const incompatibles = this.incompatibilities.get(from)!;
        if (!incompatibles.includes(to)) {
            incompatibles.push(to);
        }
    }

    getIncompatibleTerrains(terrain: Terrain): Terrain[] {
        return this.incompatibilities.get(terrain) || [];
    }
}

export class TerrainManager {
    game: Game;
    fireDamage = new Map<string, number>();
    previousTerrainMap = new Map<string, Terrain>();
    terrainMap = new Map<string, Terrain>();
    warmZones: {tiles: Set<string>, caster: ServerPlayer, turns: number}[] = [];
    incompatibility = new TerrainIncompatibility();
    updates: TerrainUpdate[];

    constructor(game: Game) {
        this.game = game;
        this.incompatibility.addIncompatibility(Terrain.FIRE, Terrain.ICE);
        this.updates = [];
    }

    updateTerrainFromSpell(spell: Spell, x: number, y: number, caster?: ServerPlayer) {
        this.updates = [];

        const tilesInRadius = getTilesInHexRadius(x, y, spell.radius - 1).filter(tile => !isSkip(tile.x, tile.y));
        // Warmth is judged before the cast, so extinguishing a flame doesn't let ice form beside it.
        const warm = new Set(tilesInRadius.filter(tile => this.isWarm(tile.x, tile.y)).map(tile => `${tile.x},${tile.y}`));

        for (const tile of tilesInRadius) {
            const occupant = this.game.getPlayerAt(tile.x, tile.y);
            const before = this.getTerrain(tile.x, tile.y);
            // Ice still puts out flames, but can't form on other warm tiles or around immune characters.
            if (spell.terrain === Terrain.ICE && before !== Terrain.FIRE) {
                if (warm.has(`${tile.x},${tile.y}`)) {
                    // Clients show the ice forming and melting at once.
                    this.updates.push({...this.getTerrainUpdate(tile.x, tile.y), iceRemoval: 'blocked'});
                    continue;
                }
                if (occupant?.isFreezeImmune()) {
                    if (occupant.isAlive()) occupant.resistFreeze();
                    continue;
                }
            }

            this.determineTerrain(spell.terrain, tile.x, tile.y);
            if (spell.terrain === Terrain.FIRE && before === Terrain.ICE) this.updates[this.updates.length - 1].iceRemoval = 'warmth';
            if (this.getTerrain(tile.x, tile.y) === Terrain.FIRE) this.fireDamage.set(`${tile.x},${tile.y}`,
                caster ? supportAmount(FIRE_POTENCY, caster.level, caster.getStat(Stat.SPATK)) : FIRE_POTENCY);
            this.postProcessing(tile.x, tile.y);
        }
        // New flames warm their surroundings, which melts any ice there.
        if (spell.terrain === Terrain.FIRE) {
            for (const tile of getTilesInHexRadius(x, y, spell.radius)) {
                if (this.isWarm(tile.x, tile.y)) this.meltIce(tile.x, tile.y, 'warmth');
            }
        }

        return this.updates;
    }

    postProcessing(x: number, y: number) {
        const previousTerrain = this.getPreviousTerrain(x, y);
        const newTerrain = this.getTerrain(x, y);
        const player = this.game.getPlayerAt(x, y);
        if (player) {
            if (previousTerrain === Terrain.NONE && newTerrain !== Terrain.NONE) {
                player.setUpTerrainEffect(newTerrain);
            }
            if (previousTerrain !== Terrain.NONE && newTerrain === Terrain.NONE) {
                player.removeTerrainEffect(previousTerrain);
            }
        }
    }

    determineTerrain(newTerrain: Terrain, x: number, y: number) {
        const existingTerrain = this.terrainMap.get(`${x},${y}`);
        // If incompatile terrains, they cancel each other
        if (existingTerrain && this.incompatibility.getIncompatibleTerrains(existingTerrain).includes(newTerrain)) {
            newTerrain = Terrain.NONE;
        }
        this.updateTerrainMap(newTerrain, x, y);
    }

    updateTerrainMap(terrain: Terrain, x: number, y: number) {
        this.previousTerrainMap.set(`${x},${y}`, this.terrainMap.get(`${x},${y}`) || Terrain.NONE);
        this.terrainMap.set(`${x},${y}`, terrain);
        if (terrain !== Terrain.FIRE) this.fireDamage.delete(`${x},${y}`);
        this.updates.push(this.getTerrainUpdate(x, y));
    }

    getNbBurning(): number {
        let count = 0;
        this.terrainMap.forEach((terrain) => {
            if (terrain === Terrain.FIRE) {
                count++;
            }
        });
        return count;
    }

    getPreviousTerrain(x: number, y: number): Terrain {
        return this.previousTerrainMap.get(`${x},${y}`) || Terrain.NONE;
    }

    getTerrain(x: number, y: number): Terrain {
        return this.terrainMap.get(`${x},${y}`) || Terrain.NONE;
    }

    getTerrainUpdate(x: number, y: number): TerrainUpdate {
        return {
            x,
            y,
            terrain: this.getTerrain(x, y),
        };
    }

    /** Warms the tiles within `radius` of a cell for `turns` of the caster's turns, melting their ice. */
    warm(x: number, y: number, radius: number, turns: number, caster: ServerPlayer) {
        this.updates = [];
        const tiles = getTilesInHexRadius(x, y, radius).filter(tile => !isSkip(tile.x, tile.y));
        // The casting turn ends first, so it doesn't count.
        this.warmZones.push({tiles: new Set(tiles.map(tile => `${tile.x},${tile.y}`)), caster, turns: turns + 1});
        for (const tile of tiles) this.meltIce(tile.x, tile.y, 'warmth');
        return this.updates;
    }

    /** Counts down the caster's Warmth zones at the end of each of their turns. Returns whether any faded. */
    tickWarmth(caster: ServerPlayer) {
        const before = this.warmZones.length;
        for (const zone of this.warmZones) if (zone.caster === caster) zone.turns--;
        this.warmZones = this.warmZones.filter(zone => zone.turns > 0);
        return this.warmZones.length !== before;
    }

    /** A knocked-out caster's Warmth fades at once. Returns whether any faded. */
    dropWarmth(caster: ServerPlayer) {
        const before = this.warmZones.length;
        this.warmZones = this.warmZones.filter(zone => zone.caster !== caster);
        return this.warmZones.length !== before;
    }

    /** Warm tiles are inside a Warmth zone or next to a flame; ice can't form or stay on them. */
    isWarm(x: number, y: number) {
        const key = `${x},${y}`;
        if (this.warmZones.some(zone => zone.tiles.has(key))) return true;
        return getTilesInHexRadius(x, y, 1).some(tile => (tile.x !== x || tile.y !== y) && this.getTerrain(tile.x, tile.y) === Terrain.FIRE);
    }

    /** Every warm tile that isn't itself on fire, for the clients' warm glow. */
    getWarmTiles(): {x: number, y: number}[] {
        const keys = new Set<string>();
        for (const zone of this.warmZones) for (const key of zone.tiles) keys.add(key);
        this.terrainMap.forEach((terrain, key) => {
            if (terrain !== Terrain.FIRE) return;
            const [x, y] = key.split(',').map(Number);
            for (const tile of getTilesInHexRadius(x, y, 1)) if (!isSkip(tile.x, tile.y)) keys.add(`${tile.x},${tile.y}`);
        });
        return [...keys]
            .filter(key => this.terrainMap.get(key) !== Terrain.FIRE)
            .map(key => key.split(',').map(Number))
            .map(([x, y]) => ({x, y}));
    }

    private meltIce(x: number, y: number, iceRemoval?: TerrainUpdate['iceRemoval']) {
        if (this.getTerrain(x, y) !== Terrain.ICE) return;
        this.updateTerrainMap(Terrain.NONE, x, y);
        if (iceRemoval) this.updates[this.updates.length - 1].iceRemoval = iceRemoval;
        this.postProcessing(x, y);
    }

    removeIce(x: number, y: number) {
        this.updates = [];
        this.meltIce(x, y);
        return this.updates;
    }
}