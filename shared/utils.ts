import { DailyLootAllAPIData, DailyLootAllDBData, PlayerInventory } from "./interfaces";
import { ChestColor, StatusEffect } from "./enums";

function specialRound(num: number): number {
    if (num >= 0) {
        return Math.round(num);
    } else {
        return -Math.round(-num);
    }
}

export function serializeCoords(x: number, y: number): string {
    return `${x},${y}`;
}  

// Convert offset coordinates to cube coordinates
export function offsetToCube(col: number, row: number): { x: number, y: number, z: number } {
    // For odd-r offset system
    const x = col - Math.floor(row / 2);
    const z = row;
    const y = -x - z;
    return { x, y, z };
}

// Convert cube coordinates back to offset coordinates
export function cubeToOffset(x, y, z, centerRow) {
    const row = z;
    const col = centerRow % 2 === 0 
        ? x + Math.floor((z + 1) / 2)
        : x + Math.floor(z / 2);
    return { col, row };
}


// Interpolate between two cube coordinates
function cubeLinearInterpolation(a: { x: number, y: number, z: number }, 
                                b: { x: number, y: number, z: number }, 
                                t: number) {
    return {
        x: a.x * (1 - t) + b.x * t,
        y: a.y * (1 - t) + b.y * t,
        z: a.z * (1 - t) + b.z * t
    };
}

// Round cube coordinates to the nearest valid hex
function roundCube(cube: { x: number, y: number, z: number }) {
    let rx = Math.round(cube.x);
    let ry = Math.round(cube.y);
    let rz = Math.round(cube.z);

    const xDiff = Math.abs(rx - cube.x);
    const yDiff = Math.abs(ry - cube.y);
    const zDiff = Math.abs(rz - cube.z);

    // Adjust the coordinate with the largest rounding error
    if (xDiff > yDiff && xDiff > zDiff) {
        rx = -ry - rz;
    } else if (yDiff > zDiff) {
        ry = -rx - rz;
    } else {
        rz = -rx - ry;
    }

    return { x: rx, y: ry, z: rz };
}

export function lineOfSight(startX: number, startY: number, endX: number, endY: number, isFree: Function): boolean {
    // Same cell check
    if (startX === endX && startY === endY) {
        return true;
    }
    const cells = listCellsOnTheWay(startX, startY, endX, endY);
    console.log(`[lineOfSight] cells on the way: ${JSON.stringify(Array.from(cells))}`);
    for (const cell of cells) {
        // Split the cell string into x and y coordinates
        const [x, y] = cell.split(',').map(Number);
        console.log(`[lineOfSight] cell ${cell} is free: ${isFree(x, y)}`);
        if (!isFree(x, y)) {
            return false;
        }
    }
    return true;
}

export function listCellsOnTheWay(startX: number, startY: number, endX: number, endY: number): Set<string> {
    function offsetToCube(col: number, row: number): { x: number, y: number, z: number } {
        // For even-r offset system (pointy-top hexes)
        const x = col - Math.floor(row / 2);
        const z = row;
        const y = -x - z;
        return { x, y, z };
    }
    
    // Convert cube coordinates back to offset coordinates
    function cubeToOffset(x, y, z, centerRow) {
        const row = z;
        const col = centerRow % 2 === 0 
            ? x + Math.floor(z / 2)
            : x + Math.floor((z + 1) / 2);
        return { col, row };
    }
    
    // Convert to cube coordinates
    const startCube = offsetToCube(startX, startY);
    const endCube = offsetToCube(endX, endY);
    
    // Calculate the cube distance
    const distance = Math.max(
        Math.abs(endCube.x - startCube.x),
        Math.abs(endCube.y - startCube.y),
        Math.abs(endCube.z - startCube.z)
    );

    // Calculate the number of steps
    const steps = Math.max(1, distance);
    
    const cells = new Set<string>();
    // cells.add(serializeCoords(startX, startY));
    
    // Track each point along the line
    for (let i = 1; i <= steps; i++) {
        // Interpolate in cube coordinates
        const t = i / steps;
        const interpolated = cubeLinearInterpolation(startCube, endCube, t);
        const rounded = roundCube(interpolated);
        
        // Convert back to offset coordinates
        const { col, row } = cubeToOffset(rounded.x, rounded.y, rounded.z, rounded.z);
        
        // Add this position to the list
        cells.add(serializeCoords(col, row));
    }

    return cells;
}

export function inventorySize(inventory: PlayerInventory): number {
    return Object.values(inventory)
    .filter(Array.isArray)
    .map(arr => arr.length)
    .reduce((acc, curr) => acc + curr, 0);
}

export async function sendMessageToAdmin(client: any, message: string) {
    const adminUser = await client.users.fetch('272906141728505867');
    adminUser.send(message);
}

export const paralyzingStatuses = [StatusEffect.FREEZE, StatusEffect.PARALYZE, StatusEffect.SLEEP];

export const transformDailyLoot = (dailyloot: DailyLootAllDBData): DailyLootAllAPIData => {
    const now = Date.now() / 1000;
    const transformedChests: DailyLootAllAPIData = {
      [ChestColor.BRONZE]: { hasKey: false, countdown: 0 },
      [ChestColor.SILVER]: { hasKey: false, countdown: 0 },
      [ChestColor.GOLD]: { hasKey: false, countdown: 0 },
    };
    for (const color of Object.values(ChestColor)) {
      const chest = dailyloot[color];
      const timeLeft = chest.time - now;
      transformedChests[color] = {
        hasKey: chest.hasKey,
        countdown: timeLeft > 0 ? timeLeft : 0,
      };
    }
    return transformedChests;
  };

/**
 * Calculate the distance between two points on a pointy hex grid
 * using cube coordinates
 * 
 * @param x1 First point x coordinate
 * @param y1 First point y coordinate
 * @param x2 Second point x coordinate
 * @param y2 Second point y coordinate
 * @returns The hex distance between the two points
 */
export function hexDistance(x1: number, y1: number, x2: number, y2: number): number {
    // Convert to cube coordinates (x,y,z)
    const q1 = x1;
    const r1 = y1;
    const s1 = -q1 - r1;
    
    const q2 = x2;
    const r2 = y2;
    const s2 = -q2 - r2;
    
    // Calculate hex distance using maximum of the absolute differences
    return Math.max(
        Math.abs(q1 - q2),
        Math.abs(r1 - r2),
        Math.abs(s1 - s2)
    );
}