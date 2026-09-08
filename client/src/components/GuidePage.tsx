import { h } from 'preact';
import { Link } from 'preact-router/match';
import { LOCKED_FEATURES, MAX_CHARACTERS, NB_START_CHARACTERS, TURN_DURATION } from '@legion/shared/config';
import { LockedFeatures } from '@legion/shared/enums';
import battle from '@assets/guide/battle.jpg';
import actions from '@assets/guide/actions.jpg';
import turnOrder from '@assets/guide/turn-order.jpg';
import loadout from '@assets/guide/loadout.jpg';
import './GuidePage.css';

const sections = [
  ['first-match', 'Matches & modes'],
  ['combat', 'Taking your turn'],
  ['magic', 'Magic & terrain'],
  ['team', 'Build your team'],
  ['progression', 'Rewards & leagues'],
  ['controls', 'Controls & quick help'],
];

// Keep section jumps inside the scrollable guide, without creating router paths.
function jumpToSection(event: h.JSX.TargetedMouseEvent<HTMLAnchorElement>) {
  event.preventDefault();
  const heading = document.getElementById(event.currentTarget.hash.slice(1));
  heading?.focus({preventScroll: true});
  heading?.scrollIntoView({block: 'start'});
}

export default function GuidePage({onClose}: {onClose?: () => void}) {
  return (
    <main className="guide-page" aria-labelledby="guide-title">
      <div className="guide-layout">
        <nav className="guide-index" aria-label="Guide chapters">
          {onClose ? (
            <button type="button" className="guide-return" onClick={onClose} data-desktop-cancel>← Back to queue</button>
          ) : (
            <Link className="guide-return" href="/play" data-desktop-cancel>← Back to Play</Link>
          )}
          <ol>
            {sections.map(([id, label]) => (
              <li key={id}><a href={`#${id}`} onClick={jumpToSection}>{label}</a></li>
            ))}
          </ol>
        </nav>

        <article className="guide-article">
          <header className="guide-intro">
            <h1 id="guide-title" tabIndex={-1}>How to play Legion</h1>
            <p className="guide-lead">Plan your turns, prepare your team, and compete in the weekly leagues.</p>
            <p>Use the chapters to look up combat rules, equipment, rewards, or controls between matches. You can reopen this guide from the top-right menu.</p>
            {onClose && <p role="status">Matchmaking continues while you read. Your match will open automatically.</p>}
            <figure>
              <img src={battle} width="840" height="405" alt="The hex arena with a selected Black Mage, blue movement tiles, opposing characters, fire, and an ice block." />
              <figcaption>The battlefield: use the highlighted tiles to plan your position, and keep an eye on hazards between the teams.</figcaption>
            </figure>
          </header>

          <section aria-labelledby="first-match">
            <h2 id="first-match" tabIndex={-1}>Matches & modes</h2>
            <p>Legion is a turn-based battle between two teams on a hexagonal arena. <strong>Defeat every opposing character to win.</strong> You begin with {NB_START_CHARACTERS} characters; your roster can eventually grow to {MAX_CHARACTERS}.</p>
            <p>Before queuing, visit <strong>Team</strong> to spend stat points and equip items. Then open <strong>Play</strong> and choose a mode.</p>
            <h3>Game modes</h3>
            <dl className="guide-definitions">
              <div><dt>Practice</dt><dd>Fight AI and learn your loadout. Reduced XP and gold; no item rewards or ELO changes. Equipped consumables are still used up.</dd></div>
              <div><dt>Casual</dt><dd>Play against other players for normal rewards without putting your ELO or league record on the line.</dd></div>
              <div><dt>Ranked</dt><dd>Play against other players for higher rewards, with results counting toward ELO and the weekly league. Unlocks after {LOCKED_FEATURES[LockedFeatures.RANKED_MODE]} completed games.</dd></div>
            </dl>
          </section>

          <section aria-labelledby="combat">
            <h2 id="combat" tabIndex={-1}>Make your turn count</h2>
            <p>When it is your turn, the active character is selected for you. The blue tiles show where they can move. Choose <strong>one action</strong>: move, attack, cast a spell, use an item, or pass. You do not move and then attack in the same turn.</p>
            <p>The standard turn timer is <strong>{TURN_DURATION} seconds</strong>. Plan while other characters act and watch the hourglass for your remaining time. If the timer runs out, you lose that opportunity to act.</p>
            <figure className="guide-figure-compact">
              <img src={turnOrder} width="460" height="90" loading="lazy" alt="The turn-order portraits along the bottom of the arena, showing the sequence of characters about to act." />
              <figcaption>The turn order is your planning tool. Speed and the recovery time of each action affect when a character acts again.</figcaption>
            </figure>
            <dl className="guide-definitions">
              <div><dt>Move</dt><dd>Click an empty blue tile. Moving uses your action, so pick a position that sets up your next turn or gets a vulnerable character out of danger.</dd></div>
              <div><dt>Attack</dt><dd>Click an adjacent enemy for a melee attack. Clicking a distant enemy moves you toward them instead; it does not grant a free attack.</dd></div>
              <div><dt>Cast</dt><dd>Choose a spell in the bottom action bar, check its highlighted area, then click a valid target or tile. Casting spends MP.</dd></div>
              <div><dt>Use an item</dt><dd>Click an equipped consumable. Self-use items such as Potion and Ether activate immediately; targeted items ask you to choose a target.</dd></div>
              <div><dt>Pass</dt><dd>Click <strong>Pass Turn</strong> beside the hourglass timer or press <kbd>E</kbd> / <kbd>End</kbd> to give up this action. A deliberate pass recovers sooner than a timeout.</dd></div>
            </dl>
            <p>Clicks outside the targeting range are ignored. Choose another target, or press <kbd>Esc</kbd> to cancel targeting and move or pass instead.</p>
            <figure>
              <img src={actions} width="960" height="110" loading="lazy" alt="The selected mage’s action bar with HP, MP, equipped Potion and Ether, learned spells, keyboard shortcuts, and the pass-turn hourglass." />
              <figcaption>Green is HP (health); blue is MP (magic). The bar shows what this character can use, not everything in your shared inventory.</figcaption>
            </figure>
            <h3>A reliable opening plan</h3>
            <p>Let sturdy fighters approach first. Keep your healer out of easy melee range, leave space between allies against area spells, and concentrate damage on a vulnerable enemy.</p>
            <p>Check the order before committing: can an enemy finish your injured character before your healer acts? Sometimes a Potion now is worth more than another attack.</p>
          </section>

          <section aria-labelledby="magic">
            <h2 id="magic" tabIndex={-1}>Magic changes the battlefield</h2>
            <p>Read item and spell details in Team or Shop before a match: check the effect, MP cost, and action speed. Fast actions bring your next turn around sooner than slow ones. A bigger spell is not always the better choice.</p>
            <p><strong>Check the whole target area.</strong> Area spells can affect allies as well as enemies, and healing can help an opponent caught in the area. Aim carefully before confirming.</p>
            <dl className="guide-definitions">
              <div><dt>Fire</dt><dd>Leaves burning ground. Crossing flames or remaining on them causes damage. Move out of the fire; an ice spell can extinguish it.</dd></div>
              <div><dt>Ice</dt><dd>Creates obstacles and can freeze a character in place. Break the ice with a melee attack from another character or melt it with fire. Attacking an occupied ice tile can also hurt its captive.</dd></div>
              <div><dt>Poison</dt><dd>Deals damage over time. Cure it with an equipped Antidote or Remedy instead of letting repeated damage pile up.</dd></div>
              <div><dt>Silence</dt><dd>Prevents spellcasting. A Bocca or Remedy removes it; a silenced mage can still move, attack, or use an item.</dd></div>
              <div><dt>Paralysis</dt><dd>Prevents actions while it lasts. Thunder spells can inflict it. Protect the affected character until they can act again.</dd></div>
            </dl>
            <p>At zero HP, a character is knocked out and cannot act. A revival item such as Clover targets a fallen character; ordinary healing is not a substitute. The battle ends if your entire team is down, so revive before that happens.</p>
          </section>

          <section aria-labelledby="team">
            <h2 id="team" tabIndex={-1}>Build a team that works together</h2>
            <p>Open <strong>Team</strong> in the top navigation and select a character’s portrait. Their sheet shows stats, equipment, carried consumables, and learned spells. Your shared inventory sits beside it.</p>
            <figure>
              <img src={loadout} width="1045" height="428" loading="lazy" alt="The Team screen: Ember’s character stats and equipment slots on the left, equipped consumables and spells below, and the shared inventory on the right." />
              <figcaption>Owning an item is not enough: assign it to the character who needs it before queuing.</figcaption>
            </figure>
            <h3>Know your roles</h3>
            <p><strong>Warriors</strong> are sturdy melee fighters. <strong>White Mages</strong> start with healing magic and support the team. <strong>Black Mages</strong> start with offensive magic and can use damage, terrain, and status effects to disrupt an opponent. Check each character’s actual stats and spells before choosing their job.</p>
            <h3>Three different kinds of preparation</h3>
            <ol className="guide-steps">
              <li><strong>Equip consumables.</strong> Select a character, click a consumable in the shared inventory, then choose <strong>Equip</strong>. It fills a free carried-item slot. A Potion restores HP; Ether restores MP. Each use consumes one item. Refill after battles.</li>
              <li><strong>Teach spells deliberately.</strong> Select the intended character, click a compatible scroll in the shared inventory, and choose <strong>Learn</strong>. You need a free spell slot. Learning consumes the scroll and is permanent: you cannot unlearn it or transfer it to another character. Casting the learned spell only costs MP.</li>
              <li><strong>Fit equipment.</strong> With your character selected, click equipment in the shared inventory and choose <strong>Equip</strong>. Check class and level requirements. Equipment adds passive bonuses and can be swapped between battles.</li>
            </ol>
            <h3>Spend your stat points</h3>
            <p>Characters earn XP and level up, improving their stats and gaining <strong>SP</strong> (stat points). Use the <strong>+</strong> beside a stat on the character sheet to spend them. These choices are permanent.</p>
            <dl className="guide-definitions">
              <div><dt>HP / MP</dt><dd>Health and spellcasting resources. One SP adds 10 to either.</dd></div>
              <div><dt>ATK / DEF</dt><dd>Physical attack power and physical defense. One SP adds 1.</dd></div>
              <div><dt>SP.ATK / SP.DEF</dt><dd>Magic power and magic defense. One SP adds 1.</dd></div>
              <div><dt>Speed</dt><dd>Affects turn order and recovery between actions. One SP adds 1.</dd></div>
            </dl>
            <p>HP and MP are restored for the next battle, and knocked-out characters return. You do not need to heal your roster between matches.</p>
          </section>

          <section aria-labelledby="progression">
            <h2 id="progression" tabIndex={-1}>Rewards, unlocks & weekly leagues</h2>
            <p>The results screen shows your performance grade, XP, gold, and any rewards. Open reward chests to inspect their contents. Spend gold in <strong>Shop</strong>, then return to Team to put purchases to use.</p>
            <h3>What unlocks when?</h3>
            <p>Unlocks use <strong>completed games, not just wins</strong>. Locked buttons tell you how many more games you need.</p>
            <dl className="guide-definitions guide-unlocks">
              <div><dt>{LOCKED_FEATURES[LockedFeatures.CONSUMABLES_BATCH_1]} game</dt><dd>Shop and the first consumables.</dd></div>
              <div><dt>{LOCKED_FEATURES[LockedFeatures.SPELLS_BATCH_1]} games</dt><dd>The first spell purchases.</dd></div>
              <div><dt>{LOCKED_FEATURES[LockedFeatures.EQUIPMENT_BATCH_1]} games</dt><dd>The first equipment purchases.</dd></div>
              <div><dt>{LOCKED_FEATURES[LockedFeatures.RANKED_MODE]} games</dt><dd>Ranked mode and the league leaderboard.</dd></div>
              <div><dt>{LOCKED_FEATURES[LockedFeatures.DAILY_LOOT]} games</dt><dd>Daily loot. Check its keys and countdowns on Play.</dd></div>
              <div><dt>{LOCKED_FEATURES[LockedFeatures.CHARACTER_PURCHASES]} games</dt><dd>Character purchases to expand your roster.</dd></div>
            </dl>
            <p>More consumables, spells, and equipment unlock along the way.</p>
            <h3>Your league is not your ELO</h3>
            <p><strong>ELO</strong> changes with ranked results and measures your rating. The <strong>weekly league</strong> is a separate competition: current-season ranked wins determine the order, with fewer losses breaking ties.</p>
            <p>Promotion, demotion, and podium rewards happen <strong>Friday at 19:00 UTC</strong>. Check Rank for your position and the promotion/demotion zones. Only players who participated in that season’s ranked games are considered; sitting out a season does not demote you. Crossing an ELO threshold does not change your league immediately.</p>
          </section>

          <section aria-labelledby="controls">
            <h2 id="controls" tabIndex={-1}>Controls & quick help</h2>
            <dl className="guide-definitions">
              <div><dt>Mouse</dt><dd>Click tiles to move, enemies to attack, and action icons to use items or select spells.</dd></div>
              <div><dt>Action letters</dt><dd>Use the letters printed on the item and spell icons. Choose QWERTY or AZERTY in Settings; follow the labels for your layout.</dd></div>
              <div><dt><kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd></dt><dd>Select your first three living characters. <kbd>Tab</kbd> / <kbd>Shift</kbd> + <kbd>Tab</kbd> cycle through living allies. Selection does not let a character act out of turn.</dd></div>
              <div><dt><kbd>E</kbd> / <kbd>End</kbd></dt><dd>Pass the active turn.</dd></div>
              <div><dt><kbd>Esc</kbd></dt><dd>Cancel spell targeting or selection in combat; close supported dialogs. From this guide, return to {onClose ? 'the queue' : 'Play'}.</dd></div>
              <div><dt><kbd>P</kbd></dt><dd>Open the combat menu. <strong>The match keeps running:</strong> opening Settings does not pause the opponent or the turn timer.</dd></div>
              <div><dt>Menus</dt><dd><kbd>Tab</kbd> or arrow keys move focus; <kbd>Enter</kbd> or <kbd>Space</kbd> activates a focused control. You can use the mouse wheel to scroll this guide.</dd></div>
            </dl>
            <h3>“Why can’t I act?”</h3>
            <p>Check whose turn it is, whether the timer expired, and whether your character is frozen or paralyzed. For spells, also check MP, silence, and target range. A spell in your shared inventory is not yet learned; a consumable there is not yet equipped.</p>
            <h3>“Can I leave a battle?”</h3>
            <p>The combat menu offers <strong>Abandon Game</strong> and asks for confirmation. Leaving counts as a loss.</p>
            <h3>Before you queue again</h3>
            <p>Spend spare SP. Refill consumables. Check your spells. Then pick one thing to practice in the next fight: protect your healer, avoid clustering, or use the turn order to secure a knockout.</p>
            {onClose ? (
              <button type="button" className="guide-finish" onClick={onClose}>Back to queue →</button>
            ) : (
              <Link className="guide-finish" href="/play">Back to Play →</Link>
            )}
          </section>
        </article>
      </div>
    </main>
  );
}
