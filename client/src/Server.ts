class ServerPlayer {
    frame;
    x;
    y;
    distance;

    constructor(frame, x, y) {
        this.frame = frame;
        this.x = x;
        this.y = y;
        this.distance = 4;
    }

    getPlacementData(includePersonal = false) {
        return {
            'frame': this.frame,
            'x': this.x,
            'y': this.y,
            'distance': includePersonal ? this.distance : 0,
        }
    }

    canMoveTo(x: number, y: number) {
        // Check if (x, y) is within a circle of radius `this.distance` from (this.gridX, this.gridY)
        return Math.pow(x - this.x, 2) + Math.pow(y - this.y, 2) <= Math.pow(this.distance, 2);
    }

    updatePos(x, y) {
        this.x = x;
        this.y = y;
    }
}

export class Server
{
    players: ServerPlayer[] = [];
    opponents: ServerPlayer[] = [];
    gridMap: Map<string, ServerPlayer> = new Map<string, ServerPlayer>();

    constructor() {
        this.players.push(new ServerPlayer('warrior_1', 4, 4));
        this.players.push(new ServerPlayer('mage_1', 18, 2));
        this.players.push(new ServerPlayer('warrior_2', 18, 6));
        this.opponents.push(new ServerPlayer('warrior_3', 3, 4));
        this.opponents.push(new ServerPlayer('mage_2', 1, 2));
        this.opponents.push(new ServerPlayer('warrior_4', 1, 6));

        this.players.forEach(player => {
            this.gridMap.set(`${player.x},${player.y}`, player);
        });
        this.opponents.forEach(player => {
            this.gridMap.set(`${player.x},${player.y}`, player);
        });
    }

    getPlacementData() {
        const data = {
            'player': {
                'team': this.players.map(player => player.getPlacementData(true))
            },
            'opponent': {
                'team': this.opponents.map(player => player.getPlacementData())
            }
        }
        return data;
    }

    isFree(gridX, gridY) {
        const isFree = !this.gridMap[`${gridX},${gridY}`];
        return isFree;
    }

    processMove({tile, num}) {
        if (!this.isFree(tile.x, tile.y)) return;
        const player = this.players[num - 1];
        if (!player.canMoveTo(tile.x, tile.y)) return;
        player.updatePos(tile.x, tile.y);
        return {
            isPlayer: true,
            tile,
            num
        };
    }
}