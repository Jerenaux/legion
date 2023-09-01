import { Socket, Server } from 'socket.io';

import { Game } from './Game';
import { ServerPlayer } from './ServerPlayer';
import { AIServerPlayer } from './AIServerPlayer';
import { items } from './Items';
import { spells } from './Spells';

const TICK = 100;
const AI_VS_AI = false;

export class AIGame extends Game {
    constructor(io: Server, sockets: Socket[]) {
        super(io, sockets);

        this.tickTimer = setInterval(this.AItick.bind(this), TICK);
    }

    populateTeams() {
        const playerClass = AI_VS_AI ? AIServerPlayer : ServerPlayer;
        this.teams.get(1)?.addMember(new playerClass(1, 'warrior_1', 18, 4));
        this.teams.get(1)?.addMember(new playerClass(2, 'mage_1', 18, 2));
        this.teams.get(1)?.addMember(new playerClass(3, 'warrior_2', 18, 6));
        this.teams.get(1)?.addMember(new playerClass(4, 'warrior_5', 16, 5));
        this.teams.get(1)?.addMember(new playerClass(5, 'warrior_6', 16, 3));

        this.teams.get(2)?.addMember(new AIServerPlayer(1, 'warrior_3', 1, 4));
        this.teams.get(2)?.addMember(new AIServerPlayer(2, 'mage_2', 1, 2));
        this.teams.get(2)?.addMember(new AIServerPlayer(3, 'warrior_4', 1, 6));
        this.teams.get(2)?.addMember(new AIServerPlayer(4, 'warrior_7', 3, 3));
        // this.teams.get(2)?.addMember(new AIServerPlayer(5, 'warrior_8', 3, 5));

        const fireball = spells[0];
        const heal = spells[1];

        // Iterate over teams
        this.teams.forEach(team => {
            // Iterate over members
            team.getMembers().forEach(player => {
                for (let i = 0; i <= 1; i++) {
                    // Set quantity to random between 0 and 2
                    let qty = Math.floor(Math.random() * 2);
                    if (qty) player.addItem(items[i], qty);
                }
                player.addItem(items[8], 1);
            }, this);
        }, this);

        this.teams.get(1)?.getMember(1).addSpell(fireball);
        this.teams.get(1)?.getMember(1).addSpell(heal);
        this.teams.get(2)?.getMember(1).addSpell(fireball);
        this.teams.get(2)?.getMember(1).addSpell(heal);
    }


    AItick() {
        if (this.gameOver) {
            clearInterval(this.tickTimer!);
            return;
        }

        const AIteams = AI_VS_AI ? [1, 2] : [2];

        AIteams.forEach(teamNum => {
            (this.teams.get(teamNum)?.getMembers() as AIServerPlayer[]).forEach(player => {
                // player.takeAction();
            }, this);
        });
    }
}