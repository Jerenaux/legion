import { events } from '../components/HUD/GameHUD';
import { Arena } from './Arena';

export class Tutorial {
    p1;
    p2;
    p3;
    introFinished = false;
    playerMovedOnce = false;
    playerAttackedOnce = false;

    constructor(game: Arena) {

        events.on('tutorialStarted', async () => {
            const playerTeam = game.teamsMap.get(game.playerTeamId);
            this.p1 = playerTeam.getMember(1);
            this.p2 = playerTeam.getMember(2);
            this.p3 = playerTeam.getMember(3);
            this.p1.talk('Hi!');
            await game.sleep(1000);
            this.p2.talk('Hello!');
            await game.sleep(500);
            this. p3.talk('Hey!');
            await game.sleep(500);
            await game.sleep(this.p1.talk('We\'re your team!'));
            await game.sleep(this.p3.talk('We need to defeat the other team!'));
            await game.sleep(this.p1.talk('Let me show you how to move!'));
            this.p1.talk('Click on me, then click on a yellow tile to move!', true);
            this.introFinished = true;
        });

        events.on('playerMoved', async () => {
            if (!this.introFinished || this.playerMovedOnce || this.playerAttackedOnce) return;
            this.playerMovedOnce = true;
            this.p1.hideBubble();
            await game.sleep(500);
            this.p2.talk('Impressive!');
            await game.sleep(1000);
            await game.sleep(this.p1.talk('Now let\'s see how to attack!'));
            this.p1.talk('Move next to an enemy and click on them to attack!', true);
        });
        
        events.on('playerAttacked', async () => {
            if (!this.introFinished || !this.playerMovedOnce || this.playerAttackedOnce) return;
            this.playerAttackedOnce = true;
            this.p1.hideBubble();
            await game.sleep(500);
            this.p2.talk('Nice hit!');
            await game.sleep(1000);
            await game.sleep(this.p3.talk('Now let\'s see how to use spells!'));
            await game.sleep(this.p3.talk('I\'m a black mage, so I can cast spells!'));
            this.p1.talk('Click on your character, then click on a spell to cast it!', true);
        });


        // Cooldown
    }
}