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
}

export class Server
{
    players: ServerPlayer[] = [];
    opponents: ServerPlayer[] = [];

    constructor() {
        this.players.push(new ServerPlayer('warrior_1', 4, 4));
        this.players.push(new ServerPlayer('mage_1', 18, 2));
        this.players.push(new ServerPlayer('warrior_2', 18, 6));
        this.opponents.push(new ServerPlayer('warrior_3', 3, 4));
        this.opponents.push(new ServerPlayer('mage_2', 1, 2));
        this.opponents.push(new ServerPlayer('warrior_4', 1, 6));
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

    processMove({tile, num}) {
        
    }
}