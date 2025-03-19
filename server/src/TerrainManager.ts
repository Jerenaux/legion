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
    previousTerrainMap = new Map<string, Terrain>();
    terrainMap = new Map<string, Terrain>();
    incompatibility = new TerrainIncompatibility();
    updates: TerrainUpdate[];

    constructor(game: Game) {
        this.game = game;
        this.incompatibility.addIncompatibility(Terrain.FIRE, Terrain.ICE);
        this.updates = [];
    }

    updateTerrainFromSpell(spell: Spell, x: number, y: number) {
        this.updates = [];
        
        const tilesInRadius = getTilesInHexRadius(x, y, spell.size - 1);
        
        for (const tile of tilesInRadius) {
            if (isSkip(tile.x, tile.y)) continue;
            
            this.determineTerrain(spell.terrain, tile.x, tile.y);
            this.postProcessing(tile.x, tile.y);
        }
        
        return this.updates;
    }

    postProcessing(x: number, y: number) {
        const previousTerrain = this.getPreviousTerrain(x, y);
        const newTerrain = this.getTerrain(x, y);
        const player = this.game.getPlayerAt(x, y);
        if (player) {
            if (previousTerrain == Terrain.NONE && newTerrain != Terrain.NONE) {
                player.setUpTerrainEffect(newTerrain);
            }
            if (previousTerrain != Terrain.NONE && newTerrain == Terrain.NONE) {
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

    removeIce(x: number, y: number) {
        this.updates = [];
        if (this.getTerrain(x, y) === Terrain.ICE) {
            this.updateTerrainMap(Terrain.NONE, x, y);
            this.postProcessing(x, y);
        }
        return this.updates;
    }
}