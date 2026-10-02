import {h, Fragment} from 'preact';
import {useEffect, useState, useMemo} from 'preact/hooks';
import {Link, route} from 'preact-router';
import {apiFetch} from '../services/apiService';
import {Class, ClassLabels, RewardType} from '@legion/shared/enums';
import {getSpellById} from '@legion/shared/Spells';
import {getConsumableById} from '@legion/shared/Items';
import {getEquipmentById} from '@legion/shared/Equipments';
import {TOWER_ENCOUNTERS, TOWER_UPGRADES, TOWER_MAX_TIER, TOWER_FLOORS, TowerProgress, TowerKit, TowerReward, createTowerRun, towerTerminal, towerReward} from '@legion/shared/tower';
import {getSpritePath, getRewardBgImage, mapFrameToCoordinates} from './utils';
import towerIcon from '@assets/tower_icon.png';
import practiceIcon from '@assets/practice_icon.png';
import shieldIcon from '@assets/casual_icon.png';
import spellScroll from '@assets/shop/spells_icon.png';
import goldChest from '@assets/shop/gold_chest.png';
import goldIcon from '@assets/gold_icon.png';
import xpIcon from '@assets/game_end/XP_icon.png';
import warriorIcon from '@assets/warrior.png';
import whiteMageIcon from '@assets/whitemage.png';
import blackMageIcon from '@assets/blackmage.png';
import './TowerPage.css';

const classIcons = {[Class.WARRIOR]: warriorIcon, [Class.WHITE_MAGE]: whiteMageIcon, [Class.BLACK_MAGE]: blackMageIcon};
function ItemIcon({type, id}: {type: RewardType; id: number}) {
  const item = type === RewardType.SPELL ? getSpellById(id) : type === RewardType.EQUIPMENT ? getEquipmentById(id) : getConsumableById(id);
  const {x, y} = mapFrameToCoordinates(item.frame);
  return <span className="tower-item-icon" role="img" aria-label={item.name} title={item.name} style={{backgroundImage: `url(${getRewardBgImage(type)})`, backgroundPosition: `-${x}px -${y}px`}} />;
}
function Rewards({reward}: {reward: TowerReward}) {
  return <span className="tower-rewards"><span><img src={goldIcon} alt="" /><b>{reward.gold}</b> gold</span><span><img src={xpIcon} alt="" /><b>{reward.xp}</b> XP</span>{reward.items.map((item, index) => <ItemIcon key={index} type={item.type} id={item.id} />)}</span>;
}

export default function TowerPage() {
  const [progress, setProgress] = useState<TowerProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tier, setTier] = useState(1);
  const [kit, setKit] = useState<TowerKit>('balanced');
  const [confirmRetire, setConfirmRetire] = useState(false);
  const run = progress?.run;
  const finished = run && towerTerminal(run);

  const refresh = async () => {
    setBusy(true); setError('');
    try { setProgress(await apiFetch('tower')); }
    catch { setError('Could not load your expedition. Your saved progress is safe.'); }
    finally { setBusy(false); }
  };
  useEffect(() => { void refresh(); }, []);

  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const next: TowerProgress = await apiFetch('tower', {method: 'POST', body: {
        action, runId: run?.id, revision: run?.revision, ...extra,
      }});
      setProgress(next); setConfirmRetire(false);
      if (action === 'battle' && next.run?.gameId) route(`/game/${next.run.gameId}`);
    } catch {
      setError('Could not confirm that choice. Refresh your expedition before trying again.');
    } finally { setBusy(false); }
  };
  const preview = useMemo(() => createTowerRun('preview', tier, kit).squad, [tier, kit]);
  const squad = run && !finished ? run.squad : preview;
  const disabled = busy || !!error;
  const chapterNames = ['The foothold', 'Divided paths', 'Trial by fire', 'The ascent', 'The last watch', 'Cinder Warden'];
  const completed = run?.floor || 0;
  const lessonIcons: Record<string, number> = {rest: 9, ice: 6, thunder: 3, poison: 10, silence: 11, 'fire-plus': 1, frostcraft: 6};

  return <main className="tower-page" aria-busy={busy}>
    <div className="tower-layout">
      <header className="tower-heading">
        <div><Link href="/play" className="tower-back">← Play modes</Link><h1>The Cinder Tower</h1></div>
        <div className="tower-heading-note"><span>SOLO EXPEDITION</span><small>Take your time. Make every choice count.</small></div>
      </header>
      {error && <div className="tower-error" role="alert"><p>{error}</p><button type="button" disabled={busy} onClick={refresh}>Refresh expedition</button></div>}
      {!progress && !error && <div className="tower-loading" role="status"><img src={towerIcon} alt="" /><p>Preparing your expedition…</p></div>}
      {progress && <div className="tower-expedition">
        <aside className="tower-ascent" aria-label="Expedition progress">
          <div className="tower-emblem"><img src={towerIcon} alt="Golden chess rook" /></div>
          <div className="tower-tier">TIER {run && !finished ? run.tier : tier} <span>{run && !finished ? 'IN PROGRESS' : 'THE CINDER ASCENT'}</span></div>
          <ol className="tower-floors">{Array.from({length: TOWER_FLOORS}, (_, i) => <li key={i} className={run && i < completed ? 'cleared' : i === completed && !finished ? 'current' : ''}
            aria-current={i === completed && !finished ? 'step' : undefined}>
            <span className="tower-floor-number">{run && i < completed ? '✓' : i === 5 ? '♜' : `0${i + 1}`}</span>
            <div><small>{i === 5 ? 'THE SUMMIT' : `FLOOR ${i + 1}`}</small><strong>{chapterNames[i]}</strong></div>
          </li>)}</ol>
          <p className="tower-ascent-note">Six encounters.<br />One chance at the summit.</p>
        </aside>
        <div className={`tower-main ${run && !finished ? 'active-run' : ''}`}>
          {run && <section className={`tower-progress ${finished ? 'is-finished' : ''}`} aria-label="Banked rewards">
            <div><span className="tower-kicker">{run.phase === 'won' ? 'SUMMIT CONQUERED' : finished ? 'EXPEDITION COMPLETE' : 'YOUR CLIMB'}</span><strong>{completed}/6 cleared <span>· Tier {run.tier}</span></strong></div>
            <div className="tower-bank"><span className="tower-kicker">YOURS TO KEEP</span><Rewards reward={run.earned} /></div>
          </section>}
          {(!run || finished) && <section className="tower-start">
            <div className="tower-start-title" role={finished ? 'status' : undefined}>
              <span className="tower-kicker">{finished ? 'EVERY CLIMB TELLS A STORY' : 'A DIFFERENT KIND OF BATTLE'}</span>
              <h2>{finished ? run.phase === 'won' ? 'The summit is yours.' : run.phase === 'lost' ? 'Regroup. Rise again.' : 'Live to climb another day.' : 'Forge your path to the summit.'}</h2>
              <p>{finished ? run.phase === 'won' ? (run.tier === TOWER_MAX_TIER ? 'The highest tier is conquered. Try a new build on your next ascent.' : 'A higher tier awaits. The Control starting kit is now available.') : 'Your banked rewards are safe. Start fresh with a new squad and a new approach.' : 'Lead three champions through six battles. Choose your opponents, shape your build, and challenge the Cinder Warden.'}</p>
            </div>
            <div className="tower-promises"><span><img src={practiceIcon} alt="" />Untimed tactics</span><span><img src={spellScroll} alt="" />Run-changing upgrades</span><span><img src={goldChest} alt="" />Permanent rewards</span></div>
            <div className="tower-preparation-heading"><h3>Choose your starting kit</h3><label>Difficulty <select value={tier} disabled={busy} onChange={event => setTier(Number(event.currentTarget.value))}>
              {Array.from({length: Math.min(TOWER_MAX_TIER, progress.highestClear + 1)}, (_, i) => <option key={i} value={i + 1}>Tier {i + 1}{i === 0 ? ' · First ascent' : ` · +${i * 15}% enemy power`}</option>)}
            </select></label></div>
            <div className="tower-kits" role="radiogroup" aria-label="Starting kit">
              <label className={`tower-kit ${kit === 'balanced' ? 'selected' : ''}`}><input type="radio" name="tower-kit" value="balanced" checked={kit === 'balanced'} disabled={busy} onChange={() => setKit('balanced')} />
                <img src={shieldIcon} alt="" /><span><strong>Balanced</strong><small>Fire & healing. A sturdy frontline.</small></span><span className="tower-kit-check" aria-hidden="true">{kit === 'balanced' ? '✓' : ''}</span></label>
              <label className={`tower-kit ${kit === 'control' ? 'selected' : ''} ${progress.highestClear < 1 ? 'locked' : ''}`}><input type="radio" name="tower-kit" value="control" checked={kit === 'control'} disabled={busy || progress.highestClear < 1} onChange={() => setKit('control')} />
                <ItemIcon type={RewardType.SPELL} id={6} /><span><strong>Control</strong><small>{progress.highestClear < 1 ? 'Unlock: clear Tier 1' : 'Ice & poison. More mana, less HP.'}</small></span><span className="tower-kit-check" aria-hidden="true">{kit === 'control' ? '✓' : progress.highestClear < 1 ? '◇' : ''}</span></label>
            </div>
            <p className="tower-kit-detail">{kit === 'control' ? '+20 MP for your Black Mage; −30 HP for your Warrior. Control the battlefield before it controls you.' : 'A resilient Warrior, a White Mage with Heal, and a Black Mage with Fire. Everyone brings their own supplies.'}</p>
          </section>}

          {(!run || finished) && <div className="tower-launch"><div><strong>Free entry. A fresh squad for every climb.</strong><span>Bank gold, items and XP. Temporary upgrades reset after each run.</span></div><button type="button" className="tower-primary" disabled={disabled} onClick={() => act('create', {tier, kit})}>{busy ? 'Preparing…' : 'Begin expedition'} <span aria-hidden="true">→</span></button></div>}

          <section className="tower-squad" aria-labelledby="tower-squad-title">
            <div className="tower-section-heading"><h3 id="tower-squad-title">{run && !finished ? 'Your expedition squad' : 'Your starting squad'}</h3><span>Temporary squad · Your roster stays yours</span></div>
            <div className="tower-squad-list">{squad.map(unit => <article key={unit.character.class} className="tower-unit">
              <div className="tower-unit-heading">{run && !finished ? <div className="tower-portrait" style={{backgroundImage: `url(${getSpritePath(unit.character.portrait)})`}} /> : <img className="tower-preview-portrait" src={classIcons[unit.character.class]} alt="" />}<div><small>{ClassLabels[unit.character.class]}</small><h4>{unit.character.name}</h4></div></div>
              <div className="tower-resource"><span>HP</span><div className="tower-resource-track"><i style={{width: `${unit.hp / unit.character.stats.hp * 100}%`}} /></div><strong>{unit.hp}/{unit.character.stats.hp}</strong></div>
              {unit.character.stats.mp > 0 && <div className="tower-resource mana"><span>MP</span><div className="tower-resource-track"><i style={{width: `${unit.mp / unit.character.stats.mp * 100}%`}} /></div><strong>{unit.mp}/{unit.character.stats.mp}</strong></div>}
              <div className="tower-loadout"><div className="tower-spells">{unit.character.skills.length ? unit.character.skills.map(id => <span key={id} title={getSpellById(id)?.name}><ItemIcon type={RewardType.SPELL} id={id} /><small>{getSpellById(id)?.name}</small></span>) : <span className="tower-melee"><img src={shieldIcon} alt="" /><small>Melee specialist</small></span>}</div>
                <div className="tower-supplies" title="Supplies">{unit.character.inventory.length ? unit.character.inventory.map((id, index) => <ItemIcon key={index} type={RewardType.CONSUMABLES} id={id} />) : <small>No supplies</small>}</div></div>
            </article>)}</div>
            {run && !finished && run.upgrades.length > 0 && <div className="tower-upgrades"><span>YOUR BUILD</span>{run.upgrades.map((id, index) => <span key={index} title={TOWER_UPGRADES.find(upgrade => upgrade.id === id)?.description}>{TOWER_UPGRADES.find(upgrade => upgrade.id === id)?.name}</span>)}</div>}
          </section>

          {run && !finished && <section className="tower-decision">
            {run.phase === 'battle' ? <div className="tower-resume"><img src={towerIcon} alt="" /><div><span className="tower-kicker">FLOOR {run.floor + 1} · ENCOUNTER IN PROGRESS</span><h2>{TOWER_ENCOUNTERS[run.floor].find(encounter => encounter.id === run.path[run.floor])?.name}</h2><p>Your squad is waiting. Pick up where you left off.</p><button type="button" className="tower-primary" disabled={disabled} onClick={() => route(`/game/${run.gameId}`)}>Continue battle <span aria-hidden="true">→</span></button></div></div> : <>
              <div className="tower-decision-heading"><div><span className="tower-kicker">{run.phase === 'choice' ? `FLOOR ${run.floor} CLEARED · PREPARE FOR THE NEXT` : `FLOOR ${run.floor + 1} OF 6`}</span><h2>{run.phase === 'choice' ? 'Claim your next advantage.' : run.floor === 5 ? 'Face the Cinder Warden.' : 'Choose your route.'}</h2></div>{run.phase === 'choice' && <Rewards reward={run.lastReward} />}</div>
              <p className="tower-decision-hint">{run.phase === 'choice' ? 'Take one preparation. Recover, resupply, or build a new advantage.' : run.floor === 5 ? 'Watch the marked tiles. Time your escape. Claim the summit.' : 'Two paths, different threats. Victory spoils are banked immediately.'}</p>
              <div className={`tower-choices ${run.phase === 'choice' ? 'preparations' : 'encounters'}`}>
                {run.phase === 'choice' ? run.offers.map(id => {
                  const upgrade = TOWER_UPGRADES.find(candidate => candidate.id === id)!;
                  const recovery = ['rest', 'supplies'].includes(id);
                  return <button key={id} type="button" className={`tower-choice tower-upgrade-choice ${recovery ? 'recovery' : 'power'}`} disabled={disabled} onClick={() => act('upgrade', {upgrade: id})}>
                    <span className="tower-choice-art">{id in lessonIcons ? <ItemIcon type={RewardType.SPELL} id={lessonIcons[id]} /> : <img src={id === 'guard' ? shieldIcon : id === 'swift' ? practiceIcon : id === 'focus' ? spellScroll : goldChest} alt="" />}</span>
                    <span className="tower-kicker">{recovery ? 'SUSTAIN YOUR SQUAD' : 'SHAPE YOUR BUILD'}</span><strong>{upgrade.name}</strong><span className="tower-choice-description">{upgrade.description}</span><span className="tower-choice-action">Choose preparation <span aria-hidden="true">→</span></span>
                  </button>;
                }) : TOWER_ENCOUNTERS[run.floor].map(encounter => <button key={encounter.id} type="button" className={`tower-choice tower-encounter ${encounter.elite ? 'elite' : ''} ${run.floor === 5 ? 'boss' : ''}`} disabled={disabled} onClick={() => act('battle', {encounter: encounter.id})}>
                  <span className="tower-encounter-top"><span className="tower-kicker">{run.floor === 5 ? 'THE FINAL CHALLENGE' : encounter.elite ? 'DANGEROUS PATH' : 'STANDARD PATH'}</span>{encounter.elite && <span className="tower-bonus">+25% spoils</span>}</span>
                  <span className="tower-enemy-lineup">{encounter.enemies.map((enemy, index) => <span key={index} title={`${enemy.name} · ${ClassLabels[enemy.class]}`}><img src={enemy.boss ? towerIcon : classIcons[enemy.class]} alt="" /><small>{enemy.boss ? 'Warden' : ClassLabels[enemy.class]}</small></span>)}</span>
                  <strong>{encounter.name}</strong><span className="tower-choice-description">{encounter.description}</span>
                  <span className="tower-spoils"><span className="tower-kicker">VICTORY SPOILS</span><Rewards reward={towerReward(run.floor, run.tier, encounter.elite)} /></span>
                  <span className="tower-choice-action">{run.floor === 5 ? 'Challenge the Warden' : 'Enter encounter'} <span aria-hidden="true">→</span></span>
                </button>)}
              </div>
              <div className="tower-retire">{confirmRetire ? <><p>End this climb? Banked rewards stay yours. Your temporary build will be lost.</p><button type="button" disabled={disabled} onClick={() => act('retire')}>End expedition</button><button type="button" disabled={busy} onClick={() => setConfirmRetire(false)}>Keep climbing</button></> : <><span>Progress saved. Return to this climb whenever you like.</span><button type="button" disabled={disabled} onClick={() => setConfirmRetire(true)}>Retire expedition</button></>}</div>
            </>}
          </section>}
          <details className="tower-rules"><summary>Expedition rules <span>Recovery, rewards & saving</span></summary>
            <p>Turns have no time limit. After a victory, each character is brought to at least 30% HP, then restores 15 HP and 15 MP, up to their maximums. Knocked-out allies return; statuses clear. Ice traps thaw after two skipped turns. Supplies stay used until refilled.</p>
            <p>Sanctuary fully restores HP and MP; Quartermaster refills supplies. Defeat ends the run. Banked gold, items, and XP remain yours. XP is shared across your permanent roster. Temporary stats and spells never overwrite it.</p>
            <p>Each tier adds 15% enemy HP and attack power and 20% gold and XP. Clear a tier to unlock the next, up to Tier 5. Tower battles do not count toward ranked results, ELO, or match-count unlocks.</p>
            <p>An internet connection is required. Close Legion between encounters and return later. A short disconnect pauses the battle. If the server can no longer resume it, restart that encounter from its saved entry state with no duplicate rewards.</p>
          </details>
        </div>
      </div>}
    </div>
  </main>;
}
