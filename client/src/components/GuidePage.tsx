import {t, i18n, localizedAsset} from '../i18n/core';
import {Trans} from '../i18n/Trans';
import { h } from 'preact';
import { Link } from 'preact-router/match';
import { ENABLE_CINDER_TOWER, LOCKED_FEATURES, MAX_CHARACTERS, NB_START_CHARACTERS, TURN_DURATION } from '@legion/shared/config';
import { LockedFeatures } from '@legion/shared/enums';
import {defaultGameSettings} from '../settings';
import battleOriginal from '@assets/guide/battle.jpg';
import actionsOriginal from '@assets/guide/actions.jpg';
import turnOrderOriginal from '@assets/guide/turn-order.jpg';
import inspectionOriginal from '@assets/guide/inspection.jpg';
import loadoutOriginal from '@assets/guide/loadout.jpg';
import towerOriginal from '@assets/guide/tower.jpg';
import './GuidePage.css';

const sections = [
  ['first-match', "Matches & modes"],
  ...(ENABLE_CINDER_TOWER ? [['tower', "The Cinder Tower"]] : []),
  ['combat', "Taking your turn"],
  ['magic', "Magic & terrain"],
  ['team', "Build your team"],
  ['progression', "Rewards & leagues"],
  ['controls', "Controls & quick help"],
];

// Keep section jumps inside the scrollable guide, without creating router paths.
function jumpToSection(event: h.JSX.TargetedMouseEvent<HTMLAnchorElement>) {
  event.preventDefault();
  const heading = document.getElementById(event.currentTarget.hash.slice(1));
  heading?.focus({preventScroll: true});
  heading?.scrollIntoView({block: 'start'});
}

export default function GuidePage({onClose}: {onClose?: () => void}) {
  const battle = localizedAsset('guide/battle.jpg', battleOriginal);
  const actions = localizedAsset('guide/actions.jpg', actionsOriginal);
  const turnOrder = localizedAsset('guide/turn-order.jpg', turnOrderOriginal);
  const inspection = localizedAsset('guide/inspection.jpg', inspectionOriginal);
  const loadout = localizedAsset('guide/loadout.jpg', loadoutOriginal);
  const tower = localizedAsset('guide/tower.jpg', towerOriginal);
  return (
    <main className="guide-page" aria-labelledby="guide-title">
      <div className="guide-layout">
        <nav className="guide-index" aria-label={t("Guide chapters")}>
          {onClose ? (
            <button type="button" className="guide-return" onClick={onClose} data-desktop-cancel>{t("← Back to queue")}</button>
          ) : (
            <Link className="guide-return" href="/play" data-desktop-cancel>{t("← Back to Play")}</Link>
          )}
          <ol>
            {sections.map(([id, label]) => (
              <li key={id}><a href={`#${id}`} onClick={jumpToSection}>{t(label)}</a></li>
            ))}
          </ol>
        </nav>

        <article className="guide-article">
          <header className="guide-intro">
            <h1 id="guide-title" tabIndex={-1}>{t("How to play Legion")}</h1>
            <p className="guide-lead">{t("Plan your turns, prepare your team, and compete in the weekly leagues.")}</p>
            <p>{t("Use the chapters to look up combat rules, equipment, rewards, or controls between matches. You can reopen this guide from the top-right menu.")}</p>
            {onClose && <p role="status">{t("Matchmaking continues while you read. Your match will open automatically.")}</p>}
            <figure>
              <img src={battle} width="840" height="405" alt={t("The hex arena with a selected Black Mage, blue movement tiles, opposing characters, fire, and an ice block.")} />
              <figcaption>{t("The battlefield: use the highlighted tiles to plan your position, and keep an eye on hazards between the teams.")}</figcaption>
            </figure>
          </header>

          <section aria-labelledby="first-match">
            <h2 id="first-match" tabIndex={-1}>{t("Matches & modes")}</h2>
            <p><Trans i18n={i18n} i18nKey={"Legion is a turn-based battle between two teams on a hexagonal arena. <0>Defeat every opposing character to win.</0> You begin with {{value0}} characters; your roster can eventually grow to {{value1}}."} components={[<strong />]} values={{value0: NB_START_CHARACTERS, value1: MAX_CHARACTERS}} /></p>
            <p><Trans i18n={i18n} i18nKey={"Before queuing, visit <0>Team</0> to spend stat points and equip items. Then open <1>Play</1> and choose a mode."} components={[<strong />, <strong />]} /></p>
            <h3>{t("Game modes")}</h3>
            <dl className="guide-definitions">
              <div><dt>{t("Practice")}</dt><dd>{t("Fight AI and learn your loadout. Reduced XP and gold; no item rewards or ELO changes. Equipped consumables are still used up.")}</dd></div>
              <div><dt>{t("Casual")}</dt><dd>{t("Play against other players for normal rewards without putting your ELO or league record on the line.")}</dd></div>
              <div><dt>{t("Ranked")}</dt><dd>{t("Play against other players for higher rewards, with results counting toward ELO and the weekly league.")}<br />{t("Unlocks after {{required}} completed games.", {required: LOCKED_FEATURES[LockedFeatures.RANKED_MODE]})}</dd></div>
            </dl>
          </section>

          {ENABLE_CINDER_TOWER && <section aria-labelledby="tower">
            <h2 id="tower" tabIndex={-1}>{t("The Cinder Tower")}</h2>
            <p>{t("Unlocks after {{required}} completed games.", {required: LOCKED_FEATURES[LockedFeatures.TOWER_MODE]})}</p>
            <p>{t("On Play, choose the golden rook to the right of Ranked. Choose Balanced or Control, set the difficulty, and use Begin expedition in the bottom bar. Rules & rewards opens the full rules.")}</p>
            <p><Trans i18n={i18n} i18nKey={"Choose <0>The Cinder Tower</0> on Play for an online solo expedition. A temporary Warrior, White Mage, and Black Mage climb six floors, ending with the Cinder Warden. Turns have no deadline, so the combat dock shows no timer. Enemies have boosted health, mana, attack, defenses, and speed. Your main roster and owned consumables are separate from this squad."} components={[<strong />]} /></p>
            <figure><img src={tower} width="1600" height="840" loading="lazy" alt={t("The tower route screen with the expedition squad, banked rewards, and a choice between the Broken Gate and the more dangerous Ember Approach.")} /><figcaption>{t("Follow your ascent on the left. Check your squad, compare the enemy lineups, and choose your next encounter. Dangerous paths award 25% more gold and XP.")}</figcaption></figure>
            <p>{t("After each victory, choose one preparation: recover, refill supplies, or take an upgrade. Spell lessons fill up to three slots and replace the oldest spell when full. Upgrades last only for this expedition. Sculptor of Ice makes Ice cost 15 less MP but halves its damage; Light Footwork gives the Warrior an extra movement tile and 12 Speed.")}</p>
            <p>{t("Between victories, each ally is brought to at least 30% HP, then restores 15 HP and 15 MP, capped at their maximums. Knocked-out allies return and statuses clear. Sanctuary fully restores HP and MP; Quartermaster refills supplies. During Tower battles, ice traps thaw after two skipped turns, so a frozen squad can recover.")}</p>
            <p>{t("The combat badge shows your current floor. In Ember Approach, two fire mages stand beyond a wall of flame spanning the arena. Cast across it, or extinguish a section with Ice to cross safely.")}</p>
            <p>{t("The Warden marks tiles before its next turn. Move away from those warning symbols before the blast. It leaves fire behind; the turn order shows when it will act.")}</p>
            <p>{t("Gold, XP, and milestone items are banked after each victory. XP is shared across your permanent roster. Defeat or retirement ends the run but keeps everything already banked. Higher floors pay more. Clearing a tier unlocks the next, up to Tier 5; each tier adds 15% enemy HP and attack power and 20% account rewards. Your first clear also unlocks the Control starting kit.")}</p>
            <p>{t("One finished expedition, won or lost, counts as one match toward unlocks. Retiring or giving up does not count. Tower never changes ranked results or ELO. There is no entry fee or daily limit. You can leave and return between encounters. A short disconnect pauses combat; if the battle can no longer resume, it restarts from that encounter’s saved entry state. An internet connection is required.")}</p>
          </section>}

          <section aria-labelledby="combat">
            <h2 id="combat" tabIndex={-1}>{t("Make your turn count")}</h2>
            <p><Trans i18n={i18n} i18nKey={"When it is your turn, the active character is selected for you. The blue tiles show where they can move. Choose <0>one action</0>: move, attack, cast a spell, use an item, or pass. You do not move and then attack in the same turn."} components={[<strong />]} /></p>
            <p><Trans i18n={i18n} i18nKey={ENABLE_CINDER_TOWER
              ? "Outside the Tower, the standard turn timer is <0>{{value0}} seconds</0>. Plan while other characters act and watch the hourglass for your remaining time. If the timer runs out, you lose that opportunity to act."
              : "The standard turn timer is <0>{{value0}} seconds</0>. Plan while other characters act and watch the hourglass for your remaining time. If the timer runs out, you lose that opportunity to act."} components={[<strong />]} values={{value0: TURN_DURATION}} /></p>
            <p>{t("Combat starts once everyone has loaded the arena and both teams’ spell and item effects. Practice matches pause if your connection drops and resume after the arena is ready again, keeping your remaining turn time. Once a match against another player has started, its clock keeps running if you disconnect.")}</p>
            <figure className="guide-figure-compact">
              <img src={turnOrder} width="570" height="70" loading="lazy" alt={t("The turn-order portraits along the bottom of the arena, showing the sequence of characters about to act.")} />
              <figcaption>{t("The turn order is your planning tool. Speed and the recovery time of each action affect when a character acts again.")}</figcaption>
            </figure>
            <p>{t("Class crests appear on both side rosters and the turn order: an amber sword for Warriors, a mint cross for White Mages, and a violet flame for Black Mages.")}</p>
            <p>{t("Hover a character on the battlefield, either side roster, or the turn order to highlight the same character in all three places. Their side card and turn-order portrait brighten and grow slightly, while their battlefield sprite glows. The inspection card shows their class, current and maximum HP and MP rounded to whole numbers, and active status effects with their remaining duration (∞ means permanent). You can also focus the side cards or turn-order portraits with the arrow keys or controller. Press Escape to dismiss the card.")}</p>
            <figure className="guide-figure-compact">
              <img src={inspection} width="390" height="255" loading="lazy" alt={t("A highlighted Black Mage beside an inspection card showing their class and exact HP and MP values.")} />
              <figcaption>{t("Inspect characters without changing your selected unit or spending an action.")}</figcaption>
            </figure>
            <dl className="guide-definitions">
              <div><dt>{t("Move")}</dt><dd>{t("Click an empty blue tile. Moving uses your action, so pick a position that sets up your next turn or gets a vulnerable character out of danger.")}</dd></div>
              <div><dt>{t("Attack")}</dt><dd>{t("Click an adjacent enemy for a melee attack. Clicking a distant enemy moves you toward them instead; it does not grant a free attack.")}</dd></div>
              <div><dt>{t("Cast")}</dt><dd>{t("Choose a spell in the centre of the bottom command dock, check its highlighted area, then click a valid target or tile. Each spell shows its MP cost; casting spends MP.")}</dd></div>
              <div><dt>{t("Use an item")}</dt><dd>{t("Click an equipped consumable. Self-use items such as Potion and Ether activate immediately; targeted items ask you to choose a target.")}</dd></div>
              <div><dt>{t("Pass")}</dt><dd><Trans i18n={i18n} i18nKey={"Click <0>Pass Turn</0> beside the hourglass timer or press <1>End</1> to give up this action. A deliberate pass recovers sooner than a timeout."} components={[<strong />, <kbd />]} /></dd></div>
            </dl>
            <p><kbd>{t("Esc")}</kbd> — {t("Abandon Game!")}</p>
            <figure>
              <img src={actions} width="800" height="100" loading="lazy" alt={t("The selected mage’s command dock with compact HP and MP, central spell and item buttons, MP costs, keyboard shortcuts, and the pass-turn hourglass.")} />
              <figcaption>{t("Green is HP (health); blue is MP (magic). The dock shows the named character’s equipped items on the left and learned spells on the right, matching the keyboard shortcut order. Hover over or focus an action for its details. During enemy turns, the dock displays an Enemy Turn banner. Silenced and unaffordable spells remain visible with unavailable styling.")}</figcaption>
            </figure>
            <p>{t("Blue mana bars show remaining MP for both teams. Watch enemy mana to judge which spells they can still afford; casting spends MP and Ether restores it.")}</p>
            <h3>{t("A reliable opening plan")}</h3>
            <p>{t("Let sturdy fighters approach first. Keep your healer out of easy melee range, leave space between allies against area spells, and concentrate damage on a vulnerable enemy.")}</p>
            <p>{t("Check the order before committing: can an enemy finish your injured character before your healer acts? Sometimes a Potion now is worth more than another attack.")}</p>
          </section>

          <section aria-labelledby="magic">
            <h2 id="magic" tabIndex={-1}>{t("Magic changes the battlefield")}</h2>
            <p>{t("Read item and spell details in Team or Shop before a match: check the effect, MP cost, and action speed. Fast actions bring your next turn around sooner than slow ones. A bigger spell is not always the better choice.")}</p>
            <p><Trans i18n={i18n} i18nKey={"<0>Check the whole target area.</0> Area spells can affect allies as well as enemies, and healing can help an opponent caught in the area. Aim carefully before confirming."} components={[<strong />]} /></p>
            <p>{t("Fire hits a tile, even if it is empty, and leaves flames behind. Crossing flames or standing in them causes damage.")}</p>
            <dl className="guide-definitions">
              <div><dt>{t("Fire")}</dt><dd>{t("Leaves burning ground. Crossing flames or remaining on them causes damage. Move out of the fire; an ice spell can extinguish it.")}</dd></div>
              <div><dt>{t("Ice")}</dt><dd>{t("Creates obstacles and can freeze a character in place. Break the ice with a melee attack from another character or melt it with fire. Attacking an occupied ice tile can also hurt its captive.")}</dd></div>
              <div><dt>{t("Poison")}</dt><dd>{t("Deals damage over time. Cure it with an equipped Antidote or Remedy instead of letting repeated damage pile up.")}</dd></div>
              <div><dt>{t("Silence")}</dt><dd>{t("Prevents spellcasting. A Bocca or Remedy removes it; a silenced mage can still move, attack, or use an item.")}</dd></div>
              <div><dt>{t("Paralysis")}</dt><dd>{t("Prevents actions while it lasts. Thunder spells can inflict it. Protect the affected character until they can act again.")}</dd></div>
            </dl>
            <p>{t("At zero HP, a character is knocked out and cannot act. A revival item such as Clover targets a fallen character; ordinary healing is not a substitute. The battle ends if your entire team is down, so revive before that happens.")}</p>
          </section>

          <section aria-labelledby="team">
            <h2 id="team" tabIndex={-1}>{t("Build a team that works together")}</h2>
            <p>{t("Roster cards show each character’s class, name, level and unspent SP.")}</p>
            <p><Trans i18n={i18n} i18nKey={"Open <0>Team</0> in the top navigation and select a character’s portrait. Their sheet shows stats, equipment, carried consumables, and learned spells. Your shared inventory sits beside it. Hover over or focus any item or learned spell, in your inventory or on the character sheet, for an instant preview of its effects, casting cost, and requirements. Hover over a stat label to learn what it does."} components={[<strong />]} /></p>
            <figure>
              <img src={loadout} width="1052" height="660" loading="lazy" alt={t("The Team screen: Ember’s character stats and equipment slots on the left, equipped consumables and spells below, and the shared inventory on the right.")} />
              <figcaption>{t("Owning an item is not enough: assign it to the character who needs it before queuing.")}</figcaption>
            </figure>
            <h3>{t("Grow your team")}</h3>
            <p><Trans i18n={i18n} i18nKey={"The next recruit’s place in Team shows how your roster can grow to {{value0}} characters. Recruitment unlocks after {{value1}} completed games, win or lose. Track your progress below the roster; once unlocked, choose <0>Recruit character</0> to buy a new teammate with gold in Shop."} components={[<strong />]} values={{value0: MAX_CHARACTERS, value1: LOCKED_FEATURES[LockedFeatures.CHARACTER_PURCHASES]}} /></p>
            <h3>{t("Know your roles")}</h3>
            <p><Trans i18n={i18n} i18nKey={"<0>Warriors</0> are sturdy melee fighters. <1>White Mages</1> start with healing magic and support the team. <2>Black Mages</2> start with offensive magic and can use damage, terrain, and status effects to disrupt an opponent. Check each character’s actual stats and spells before choosing their job."} components={[<strong />, <strong />, <strong />]} /></p>
            <h3>{t("Three different kinds of preparation")}</h3>
            <ol className="guide-steps">
              <li><Trans i18n={i18n} i18nKey={"<0>Equip consumables.</0> Select a character, click a consumable in the shared inventory, then choose <1>Equip</1>. It fills a free carried-item slot. A Potion restores HP; Ether restores MP. Each use consumes one item. Refill after battles."} components={[<strong />, <strong />]} /></li>
              <li><Trans i18n={i18n} i18nKey={"<0>Teach spells deliberately.</0> Select the intended character, click a compatible scroll in the shared inventory, and choose <1>Learn</1>. You need a free spell slot. Learning consumes the scroll and is permanent: you cannot unlearn it or transfer it to another character. Casting the learned spell only costs MP."} components={[<strong />, <strong />]} /></li>
              <li><Trans i18n={i18n} i18nKey={"<0>Fit equipment.</0> With your character selected, click equipment in the shared inventory and choose <1>Equip</1>. Check class and level requirements. Equipment adds passive bonuses and can be swapped between battles."} components={[<strong />, <strong />]} /></li>
            </ol>
            <h3>{t("Spend your stat points")}</h3>
            <p><Trans i18n={i18n} i18nKey={"Characters earn XP and level up, improving their stats and gaining <0>SP</0> (stat points). Use the <1>+</1> beside a stat on the character sheet to spend them. These choices are permanent."} components={[<strong />, <strong />]} /></p>
            <dl className="guide-definitions">
              <div><dt>{t("HP / MP")}</dt><dd>{t("Health and spellcasting resources. One SP adds 10 to either.")}</dd></div>
              <div><dt>{t("ATK / DEF")}</dt><dd>{t("Physical attack power and physical defense. One SP adds 1.")}</dd></div>
              <div><dt>{t("SP.ATK / SP.DEF")}</dt><dd>{t("Magic power and magic defense. One SP adds 1.")}</dd></div>
              <div><dt>{t("Speed")}</dt><dd>{t("Affects turn order and recovery between actions. One SP adds 1.")}</dd></div>
            </dl>
            <p>{t("HP and MP are restored for the next battle, and knocked-out characters return. You do not need to heal your roster between matches.")}</p>
          </section>

          <section aria-labelledby="progression">
            <h2 id="progression" tabIndex={-1}>{t("Rewards, unlocks & weekly leagues")}</h2>
            <p>{t('Received a personal gift link? Install Legion first, then open the link to launch the game and claim your gift. Gifts go to the account currently playing and can only be claimed once. Find your gear in Team; normal equipment requirements still apply.')}</p>
            <p>{t('Hover over or focus a reward to inspect it. Equip your gear in Team.')}</p>
            <p><Trans i18n={i18n} i18nKey={"The results screen shows your performance grade, XP, gold, and any rewards. Open reward chests to inspect their contents. Spend gold in <0>Shop</0>, then return to Team to put purchases to use."} components={[<strong />]} /></p>
            <h3>{t("What unlocks when?")}</h3>
            <p><Trans i18n={i18n} i18nKey={"Unlocks use <0>completed games, not just wins</0>. Hover over or focus a locked Shop tab to see how many more games you need."} components={[<strong />]} /></p>
            <dl className="guide-definitions guide-unlocks">
              <div><dt>{t("gameCount", {count: LOCKED_FEATURES[LockedFeatures.CONSUMABLES_BATCH_1]})}</dt><dd>{t("Shop and the first consumables.")}</dd></div>
              <div><dt>{t("gameCount", {count: LOCKED_FEATURES[LockedFeatures.SPELLS_BATCH_1]})}</dt><dd>{t("The first spell purchases.")}</dd></div>
              <div><dt>{t("gameCount", {count: LOCKED_FEATURES[LockedFeatures.EQUIPMENT_BATCH_1]})}</dt><dd>{t("The first equipment purchases.")}</dd></div>
              <div><dt>{t("gameCount", {count: LOCKED_FEATURES[LockedFeatures.RANKED_MODE]})}</dt><dd>{t("Ranked mode and the league leaderboard.")}</dd></div>
              {ENABLE_CINDER_TOWER && <div><dt>{t("gameCount", {count: LOCKED_FEATURES[LockedFeatures.TOWER_MODE]})}</dt><dd>{t("The Cinder Tower")}</dd></div>}
              <div><dt>{t("gameCount", {count: LOCKED_FEATURES[LockedFeatures.DAILY_LOOT]})}</dt><dd>{t("Daily loot. Check its keys and countdowns on Play.")}</dd></div>
              <div><dt>{t("gameCount", {count: LOCKED_FEATURES[LockedFeatures.CHARACTER_PURCHASES]})}</dt><dd>{t("Character purchases to expand your roster.")}</dd></div>
            </dl>
            <p>{t("More consumables, spells, and equipment unlock along the way.")}</p>
            <h3>{t("Your league is not your ELO")}</h3>
            <p><Trans i18n={i18n} i18nKey={"<0>ELO</0> changes with ranked results and measures your rating. The <1>weekly league</1> is a separate competition: current-season ranked wins determine the order, with fewer losses breaking ties."} components={[<strong />, <strong />]} /></p>
            <p><Trans i18n={i18n} i18nKey={"Promotion, demotion, and podium rewards happen <0>Friday at 19:00 UTC</0>. Check Rank for your position and the promotion/demotion zones. Only players who participated in that season’s ranked games are considered; sitting out a season does not demote you. Crossing an ELO threshold does not change your league immediately."} components={[<strong />]} /></p>
            <h3>{t("Creator communities")}</h3>
            <p><Trans i18n={i18n} i18nKey={"Creators share a code or link. Enter the code under <0>Join a community</0> on your profile, or open the link to launch Legion. You can belong to one community, and joining is permanent."} components={[<strong />]} /></p>
            <p>{t("The community’s sigil appears beside your name in matches, on your profile and in leaderboards. Your ranked wins add to its weekly total in the Communities tab of Rank, which resets with the leagues. Communities have no effect in combat.")}</p>
          </section>

          <section aria-labelledby="controls">
            <h2 id="controls" tabIndex={-1}>{t("Controls & quick help")}</h2>
            <p>{t("Combat tips respond to unfamiliar actions and hazards. Switch them on or off before battle.")}</p>
            <p><Trans i18n={i18n} i18nKey={"Open <0>Combat tips</0> on your turn for guidance about the current character and available actions. Hide the tips whenever you like. Tips pause during enemy turns. If a target or move is invalid, a short explanation appears without spending your action."} components={[<strong />]} /></p>
            <p>{t("Change language on the title screen or in Settings. Text and artwork update immediately. During a match, replay, queue, or lobby, return to the main menu first.")}</p>
            <p>{t("On Steam, your Steam language is used by default. A language you choose in the game takes priority.")}</p>
            <p><Trans i18n={i18n} i18nKey={"Use <0>Settings → Text size</0> to choose Standard (100%), Large (115%), or Extra large (130%). Menu, dialog, and combat HUD text update immediately, and the setting is saved for future sessions."} components={[<strong />]} /></p>
            <p><Trans i18n={i18n} i18nKey={"Music starts while connecting and loops through the title screen. A separate track loops across the menus. Music fades out over two seconds before switching from the title screen to menus or from menus to combat, with a short fade-in for the next track. Music starts at {{value0}}%. Open <0>Settings</0> to adjust it from 0 (muted) to 100 (full volume). Your chosen volume is saved for future sessions."} components={[<strong />]} values={{value0: defaultGameSettings.musicVolume}} /></p>
            <p><Trans i18n={i18n} i18nKey={"<0>Mute</0> beside each volume slider silences music or sound effects and restores the same level when pressed again. <1>Colorblind mode</1> replaces green and red on the battlefield with blue and orange."} components={[<strong />, <strong />]} /></p>
            <dl className="guide-definitions">
              <div><dt>{t("Mouse")}</dt><dd>{t("Click tiles to move, enemies to attack, and action icons to use items or select spells.")}</dd></div>
              <div><dt>{t("Action letters")}</dt><dd>{t("Use the keys printed on the item and spell icons. Change any key or controller button in Settings, under Controls.")}</dd></div>
              <div><dt><kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd></dt><dd><Trans i18n={i18n} i18nKey={"Select your first three living characters. <0>Tab</0> / <1>Shift</1> + <2>Tab</2> cycle through living allies. Selection does not let a character act out of turn."} components={[<kbd />, <kbd />, <kbd />]} /></dd></div>
              <div><dt><kbd>{t("Space")}</kbd> / <kbd>{t("End")}</kbd></dt><dd>{t("Pass the active turn.")}</dd></div>
              <div><dt><kbd>{t("Esc")}</kbd></dt><dd>{t("In combat, open the game menu, with Settings and Abandon Game; close supported dialogs. Click a selected spell or item again to cancel targeting. From this guide, return to {{value0}}.", {value0: onClose ? 'the queue' : 'Play'})} {t("With nothing to close outside combat, Esc or the controller Menu button opens the game menu, with Settings and Quit game.")}</dd></div>
              <div><dt><kbd>F11</kbd> / <kbd>{t("Alt")}</kbd> + <kbd>{t("Enter")}</kbd></dt><dd>{t("Switch between fullscreen and a window. Legion reopens in the mode you used last. On Mac, use Control + Command + F.")}</dd></div>
              <div><dt><kbd>{t("P")}</kbd></dt><dd><Trans i18n={i18n} i18nKey={"Open the combat menu. <0>The match keeps running:</0> opening Settings does not pause the opponent or the turn timer."} components={[<strong />]} /></dd></div>
              <div><dt>{t("Controller")}</dt><dd>{t("A confirms, B cancels, Y passes the turn, LB and RB switch characters, and Menu opens the game menu. The D-pad or left stick moves focus.")}</dd></div>
              <div><dt>{t("Menus")}</dt><dd><Trans i18n={i18n} i18nKey={"<0>Tab</0> or arrow keys move focus; <1>Enter</1> or <2>Space</2> activates a focused control. You can use the mouse wheel to scroll this guide."} components={[<kbd />, <kbd />, <kbd />]} /></dd></div>
            </dl>
            <h3>{t("“Why can’t I act?”")}</h3>
            <p>{t("Check whose turn it is, whether the timer expired, and whether your character is frozen or paralyzed. For spells, also check MP, silence, and target range. A spell in your shared inventory is not yet learned; a consumable there is not yet equipped.")}</p>
            <h3>{t("“Can I leave a battle?”")}</h3>
            <p><Trans i18n={i18n} i18nKey={"The combat menu offers <0>Abandon Game</0> and asks for confirmation. Leaving counts as a loss."} components={[<strong />]} /></p>
            <h3>{t("Before you queue again")}</h3>
            <p><Trans i18n={i18n} i18nKey={"If Rank cannot load, it retries once automatically. If it still fails, check your connection and choose <0>Retry</0>, or select another league tab."} components={[<strong />]} /></p>
            <p><Trans i18n={i18n} i18nKey={"If loading fails or the game is interrupted, choose <0>Reload game</0> to reconnect if your match is still running. Temporary connection losses reconnect automatically."} components={[<strong />]} /></p>
            <p>{t("If Legion reports that it cannot start game graphics, try reloading, then restart Legion and update your graphics driver. Make sure Steam or Itch has installed the latest Legion update. Legion automatically uses a simpler renderer when WebGL is unavailable; if graphics still cannot start, it shows a recovery screen instead of continuing to load.")}</p>
            <p><Trans i18n={i18n} i18nKey={"Something not working as expected? Choose <0>Report a problem</0> in the top-right menu and describe what happened. The bottom of that menu shows your build version. Reports include your game version and player ID, but do not ask for passwords or contact details."} components={[<strong />]} /></p>
            <p>{t("Spend spare SP. Refill consumables. Check your spells. Then pick one thing to practice in the next fight: protect your healer, avoid clustering, or use the turn order to secure a knockout.")}</p>
            {onClose ? (
              <button type="button" className="guide-finish" onClick={onClose}>{t("Back to queue →")}</button>
            ) : (
              <Link className="guide-finish" href="/play">{t("Back to Play →")}</Link>
            )}
          </section>
        </article>
      </div>
    </main>
  );
}
