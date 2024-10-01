import { events } from '../components/HUD/GameHUD';
import { Arena } from './Arena';

export class Tutorial {
    p1;
    p2;
    p3;
    introFinished = false;
    playerMovedOnce = false;
    playerAttackedOnce = false;
    playerSpellCastedOnce = false;

    constructor(game: Arena) {

        events.on('tutorialStarted', async () => {
            const playerTeam = game.teamsMap.get(game.playerTeamId);
            this.p1 = playerTeam.getMember(1);
            this.p2 = playerTeam.getMember(2);
            this.p3 = playerTeam.getMember(3);
            this.p1.talk('Hi!');
            await game.sleep(1000);
            this.p2.talk('Hello!');
            await game.sleep(750);
            this. p3.talk('Hey!');
            await game.sleep(1000);
            await game.sleep(await this.p1.talk('We\'re your team!'));
            await game.sleep(await this.p3.talk('We need to defeat the other team!'));
            await game.sleep(await this.p2.talk('Your team members are marked in blue, the enemies in red!'));
            await game.sleep(await this.p1.talk('Let me show you how to move!'));
            this.p1.talk('Click on me, then click on a yellow tile to move!', true);
            this.introFinished = true;
        });

        events.on('playerMoved', async () => {
            if (!this.introFinished || this.playerMovedOnce || this.playerAttackedOnce || this.playerSpellCastedOnce) return;
            this.playerMovedOnce = true;
            this.p1.hideBubble();
            await game.sleep(500);
            this.p2.talk('Impressive!');
            await game.sleep(1000);
            await game.sleep(await this.p1.talk('See the yellow bar filling up in the top menu?'));
            await game.sleep(await this.p1.talk('It\'s my cooldown bar. After each action, I need to wait for it to fill up before I can act again!'));
            await game.sleep(await this.p1.talk('The red bar is my HP. If it goes to 0, I\'m dead!'));
            await game.sleep(await this.p1.talk('On the side of the screen, you can see the cooldown bars for all your characters, in yellow!'));
            await game.sleep(await this.p1.talk('You can also see their HP bars in red!'));
            await game.sleep(await this.p1.talk('Keep an eye there to see which characters are alive and ready to act!'));
            // await game.sleep(await this.p1.talk('You can also see there which of your characters are dead, they will be marked in grey!'));
            await game.sleep(await this.p1.talk('Now let\'s see how to attack!'));
            this.p1.talk('Move me next to an enemy and click on them to attack!', true);
        });
        
        events.on('playerAttacked', async () => {
            if (!this.introFinished || !this.playerMovedOnce || this.playerAttackedOnce || this.playerSpellCastedOnce) return;
            this.playerAttackedOnce = true;
            this.p1.hideBubble();
            await game.sleep(500);
            this.p2.talk('Nice hit!');
            await game.sleep(1000);
            await game.sleep(await this.p3.talk('Now let\'s see how to use spells!'));
            await game.sleep(await this.p3.talk('I\'m a mage, so I can cast spells!'));
            this.p3.talk('Select me, click on the fireball in the top menu, and click where you want to launch it!', true);
        });

        events.on('playerCastSpell', async () => {
            if (!this.introFinished || !this.playerMovedOnce || !this.playerAttackedOnce || this.playerSpellCastedOnce) return;
            this.playerSpellCastedOnce = true;
            this.p3.hideBubble();
            await game.sleep(2000);
            this.p2.talk('Great job!');
            await game.sleep(1500);
            await game.sleep(await this.p3.talk('Casting spells costs MP! That\'s the blue bar in the top menu!'));
            await game.sleep(await this.p3.talk('If I run out of MP, I can\'t cast spells anymore!'));
            await game.sleep(await this.p2.talk('The fireball created a flame on the ground!'));
            await game.sleep(await this.p2.talk('If a character stands on a flame, they lose HP over time!'));
            await game.sleep(await this.p2.talk('If you character gets in that situation, make sure to move them away!'));
            await game.sleep(await this.p2.talk('Now you know the basics!'));
            await game.sleep(await this.p2.talk('The enemy wasn\'t reacting, but in normal games they will attack you!'));
            await game.sleep(await this.p2.talk('Now the enemy will start attacking! Use what you just learned to defeat them!'));
            await game.sleep(await this.p2.talk('Good luck!'));
            await game.sleep(3000);
            game.endTutorial();
        });

    }
}