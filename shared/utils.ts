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

export function lineOfSight(startX: number, startY: number, endX: number, endY: number, isFree: Function): boolean {
    // Get the distance between the start and end points
    let distance = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2);

    // Calculate the number of steps to check, based on the distance
    let steps = Math.ceil(distance);

    // console.log(`Line of sight from (${startX}, ${startY}) to (${endX}, ${endY})`);
    for (let i = 1; i < steps; i++) {
        // Calculate the current position along the line
        const xInc = specialRound(i / steps * (endX - startX));
        const yInc = specialRound(i / steps * (endY - startY));
        let currentX = Math.round(startX + xInc);
        let currentY = Math.round(startY + yInc);
        if (currentX == startX && currentY == startY) continue;

        // Check if this position is occupied
        if (!isFree(currentX, currentY)) {
            // console.log(`Line of sight blocked at (${currentX}, ${currentY})`);
            // If the position is occupied, return false
            return false;
        }
    }

    // If no occupied positions were found, return true
    return true;
}

export function listCellsOnTheWay(startX: number, startY: number, endX: number, endY: number): Set<string> {
    // Get the distance between the start and end points
    let distance = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2);

    // Calculate the number of steps to check, based on the distance
    let steps = Math.ceil(distance);

    const cells = new Set<string>();
    for (let i = 1; i < steps; i++) {
        // Calculate the current position along the line
        const xInc = specialRound(i / steps * (endX - startX));
        const yInc = specialRound(i / steps * (endY - startY));
        let currentX = Math.round(startX + xInc);
        let currentY = Math.round(startY + yInc);
        if (currentX == startX && currentY == startY) continue;

        // Add this position to the list
        cells.add(serializeCoords(currentX, currentY));
    }

    return cells;
}