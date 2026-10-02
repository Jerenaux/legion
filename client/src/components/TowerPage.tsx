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
import ClassCrest from './HUD/ClassCrest';
import './TowerPage.css';

const previewPortraits = {[Class.WARRIOR]: '1_1', [Class.WHITE_MAGE]: '1_7', [Class.BLACK_MAGE]: '2_3'};
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
  const completed = run?.floor || 0;
  const lessonIcons: Record<string, number> = {rest: 9, ice: 6, thunder: 3, poison: 10, silence: 11, 'fire-plus': 1, frostcraft: 6};

  return <main className={`tower-page ${run && !finished ? 'is-climbing' : 'is-preparing'}`} aria-busy={busy}>
    <div className="tower-layout">
      <header className="tower-heading">
        <Link href="/play" className="tower-back"><span aria-hidden="true">‹</span> Play</Link>
        <div className="tower-title"><img src={towerIcon} alt="" /><h1>Cinder Tower</h1></div>
        {run && !finished ? <section className="tower-progress tower-header-progress" aria-label="Banked rewards"><span>{completed}/6 cleared</span><Rewards reward={run.earned} /></section> : <span className="tower-mode-label">Solo · Untimed</span>}
      </header>
      {error && <div className="tower-error" role="alert"><p>{error}</p><button type="button" disabled={busy} onClick={refresh}>Refresh expedition</button></div>}
      {!progress && !error && <div className="tower-loading" role="status"><img src={towerIcon} alt="" /><p>Preparing your expedition…</p></div>}
      {progress && <div className="tower-expedition">
        {run && !finished && <aside className="tower-ascent" aria-label="Expedition progress">
          <div className="tower-tier">Tier {run.tier}</div>
          <ol className="tower-floors">{Array.from({length: TOWER_FLOORS}, (_, i) => <li key={i} className={run && i < completed ? 'cleared' : i === completed && !finished ? 'current' : ''}
            aria-current={i === completed && !finished ? 'step' : undefined}>
            <span className="tower-floor-number">{run && i < completed ? '✓' : i === 5 ? '♜' : `0${i + 1}`}</span>
            <span className="tower-floor-label">{i === 5 ? 'Warden' : `Floor ${i + 1}`}</span>
          </li>)}</ol>
        </aside>}
        <div className={`tower-main ${run && !finished ? 'active-run' : ''}`}>
          {run && finished && <section className={`tower-progress ${finished ? 'is-finished' : ''}`} aria-label="Banked rewards">
            <div><span className="tower-kicker">{finished ? 'EXPEDITION COMPLETE' : 'ASCENT'}</span><strong>{completed} / 6 cleared</strong></div>
            <div className="tower-bank"><span className="tower-kicker">BANKED</span><Rewards reward={run.earned} /></div>
          </section>}
          {(!run || finished) && <section className="tower-start">
            {finished && <div className={`tower-result ${run.phase}`} role="status">
              <img src={towerIcon} alt="" /><div><h2>{run.phase === 'won' ? 'Tower conquered' : run.phase === 'lost' ? 'Expedition lost' : 'Expedition ended'}</h2>
              <p>{run.phase === 'won' ? (run.tier === TOWER_MAX_TIER ? 'All tiers conquered.' : `Tier ${run.tier + 1} and the Control kit available.`) : 'Your banked rewards are yours to keep.'}</p></div>
            </div>}


            <div className="tower-preparation-heading"><h2>{finished ? 'Next expedition' : 'Choose your squad'}</h2><label className="tower-difficulty"><span>Difficulty</span><span className="tower-difficulty-control"><select value={tier} disabled={busy} onChange={event => setTier(Number(event.currentTarget.value))}>
              {Array.from({length: Math.min(TOWER_MAX_TIER, progress.highestClear + 1)}, (_, i) => <option key={i} value={i + 1}>Tier {i + 1}{i === 0 ? '' : ` · +${i * 15}% enemy power`}</option>)}
            </select><span aria-hidden="true">⌄</span></span></label></div>
            <div className="tower-kits" role="radiogroup" aria-label="Starting kit">
              <label className={`tower-kit ${kit === 'balanced' ? 'selected' : ''}`}><input type="radio" name="tower-kit" value="balanced" checked={kit === 'balanced'} disabled={busy} onChange={() => setKit('balanced')} />
                <img src={shieldIcon} alt="" /><span><strong>Balanced</strong><small>Fire & healing</small></span><span className="tower-kit-check" aria-hidden="true">{kit === 'balanced' ? '✓' : ''}</span></label>
              <label className={`tower-kit ${kit === 'control' ? 'selected' : ''} ${progress.highestClear < 1 ? 'locked' : ''}`}><input type="radio" name="tower-kit" value="control" checked={kit === 'control'} disabled={busy || progress.highestClear < 1} onChange={() => setKit('control')} />
                <ItemIcon type={RewardType.SPELL} id={6} /><span><strong>Control</strong><small>{progress.highestClear < 1 ? 'Clear Tier 1 to unlock' : 'Ice & poison'}</small></span><span className="tower-kit-check" aria-hidden="true">{kit === 'control' ? '✓' : progress.highestClear < 1 ? '◇' : ''}</span></label>
            </div>
            {kit === 'control' && <p className="tower-kit-detail">Black Mage +20 MP · Warrior −30 HP</p>}
          </section>}

          {!finished && <section className="tower-squad" aria-labelledby="tower-squad-title">
            <h3 id="tower-squad-title" className="tower-squad-title">{run && !finished ? 'Your squad' : 'Expedition heroes'}</h3>
            <div className="tower-squad-list">{squad.map(unit => <article key={unit.character.class} className="tower-unit" data-class={unit.character.class}>
              <div className="tower-hero-art" aria-hidden="true"><div className="tower-portrait" style={{backgroundImage: `url(${getSpritePath(run && !finished ? unit.character.portrait : previewPortraits[unit.character.class])})`}} /></div>
              <div className="tower-unit-heading"><span className="tower-crest"><ClassCrest characterClass={unit.character.class} /></span><div><h4>{unit.character.name}</h4><span>{ClassLabels[unit.character.class]}</span></div></div>
              <div className="tower-vitals">
                <div className="tower-resource"><span>HP</span><div className="tower-resource-track"><i style={{width: `${unit.hp / unit.character.stats.hp * 100}%`}} /></div><strong>{unit.hp}<span>/{unit.character.stats.hp}</span></strong></div>
                {unit.character.stats.mp > 0 && <div className="tower-resource mana"><span>MP</span><div className="tower-resource-track"><i style={{width: `${unit.mp / unit.character.stats.mp * 100}%`}} /></div><strong>{unit.mp}<span>/{unit.character.stats.mp}</span></strong></div>}
              </div>
              <div className="tower-loadout"><div className="tower-spells">{unit.character.skills.length ? unit.character.skills.map(id => <span key={id} title={getSpellById(id)?.name}><ItemIcon type={RewardType.SPELL} id={id} /><span>{getSpellById(id)?.name}</span></span>) : <span className="tower-melee"><img src={shieldIcon} alt="" /><span>Melee</span></span>}</div>
                <div className="tower-supplies" title="Supplies">{unit.character.inventory.length ? unit.character.inventory.map((id, index) => <ItemIcon key={index} type={RewardType.CONSUMABLES} id={id} />) : <span>No supplies</span>}</div></div>
            </article>)}</div>

          </section>}

          {run && !finished && <section className="tower-decision">
            {run.phase === 'battle' ? <div className="tower-resume"><img src={towerIcon} alt="" /><div><span className="tower-kicker">FLOOR {run.floor + 1} · IN BATTLE</span><h2>{TOWER_ENCOUNTERS[run.floor].find(encounter => encounter.id === run.path[run.floor])?.name}</h2><button type="button" className="tower-primary" disabled={disabled} onClick={() => route(`/game/${run.gameId}`)}>Continue battle <span aria-hidden="true">→</span></button></div></div> : <>
              <div className="tower-decision-heading"><div><span className="tower-kicker">{run.phase === 'choice' ? `FLOOR ${run.floor} CLEARED` : `FLOOR ${run.floor + 1} OF 6`}</span><h2>{run.phase === 'choice' ? 'Choose one upgrade' : run.floor === 5 ? 'The final battle' : 'Choose your battle'}</h2></div>{run.phase === 'choice' && <Rewards reward={run.lastReward} />}</div>
              <div className={`tower-choices ${run.phase === 'choice' ? 'preparations' : 'encounters'}`}>
                {run.phase === 'choice' ? run.offers.map(id => {
                  const upgrade = TOWER_UPGRADES.find(candidate => candidate.id === id)!;
                  const recovery = ['rest', 'supplies'].includes(id);
                  return <button key={id} type="button" className={`tower-choice tower-upgrade-choice ${recovery ? 'recovery' : 'power'}`} disabled={disabled} onClick={() => act('upgrade', {upgrade: id})}>
                    <span className="tower-choice-art">{id in lessonIcons ? <ItemIcon type={RewardType.SPELL} id={lessonIcons[id]} /> : <img src={id === 'guard' ? shieldIcon : id === 'swift' ? practiceIcon : id === 'focus' ? spellScroll : goldChest} alt="" />}</span>
                    <strong>{upgrade.name}</strong><span className="tower-choice-description">{upgrade.description}</span><span className="tower-choice-action" aria-hidden="true">→</span>
                  </button>;
                }) : TOWER_ENCOUNTERS[run.floor].map(encounter => <button key={encounter.id} type="button" className={`tower-choice tower-encounter ${encounter.elite ? 'elite' : ''} ${run.floor === 5 ? 'boss' : ''}`} disabled={disabled} onClick={() => act('battle', {encounter: encounter.id})}>
                  <span className="tower-encounter-top"><span className="tower-kicker">{run.floor === 5 ? 'BOSS' : encounter.elite ? 'ELITE' : 'STANDARD'}</span>{encounter.elite && <span className="tower-bonus">+25% gold / XP</span>}</span>
                  <span className="tower-enemy-lineup">{encounter.enemies.map((enemy, index) => <span key={index} title={`${enemy.name} · ${ClassLabels[enemy.class]}`}><img src={enemy.boss ? towerIcon : classIcons[enemy.class]} alt="" /><small>{enemy.boss ? 'Warden' : ClassLabels[enemy.class]}</small></span>)}</span>
                  <strong>{encounter.name}</strong>
                  <span className="tower-spoils"><span className="tower-kicker">REWARDS</span><Rewards reward={towerReward(run.floor, run.tier, encounter.elite)} /></span>
                  <span className="tower-choice-action">{run.floor === 5 ? 'Challenge Warden' : 'Fight'} <span aria-hidden="true">→</span></span>
                </button>)}
              </div>

            </>}
          </section>}

        </div>
      </div>}
      {progress && <footer className="tower-command-bar">
          <details name="tower-info" className="tower-rules"><summary>Rules & rewards</summary>
            <p>Entry is free. Every run starts with a temporary squad; your roster and owned items stay untouched. Turns have no time limit. After a victory, each character is brought to at least 30% HP, then restores 15 HP and 15 MP, up to their maximums. Knocked-out allies return; statuses clear. Ice traps thaw after two skipped turns. Supplies stay used until refilled.</p>
            <p>Sanctuary fully restores HP and MP; Quartermaster refills supplies. Defeat ends the run. Banked gold, items, and XP remain yours. XP is shared across your permanent roster. Temporary stats and spells never overwrite it.</p>
            <p>Each tier adds 15% enemy HP and attack power and 20% gold and XP. Clear a tier to unlock the next, up to Tier 5. Tower battles do not count toward ranked results, ELO, or match-count unlocks.</p>
            <p>An internet connection is required. Close Legion between encounters and return later. A short disconnect pauses the battle. If the server can no longer resume it, restart that encounter from its saved entry state with no duplicate rewards.</p>
          </details>
        {(!run || finished) && <><span className="tower-run-length"><span className="tower-run-track" aria-hidden="true">{Array.from({length: TOWER_FLOORS - 1}, (_, i) => <i key={i} />)}<img src={towerIcon} alt="" /></span><span><b>{TOWER_FLOORS}</b> battles</span></span><button type="button" className="tower-primary" disabled={disabled} onClick={() => act('create', {tier, kit})}>{busy ? 'Preparing…' : 'Begin expedition'} <span aria-hidden="true">→</span></button></>}
        {run && !finished && run.upgrades.length > 0 && <details name="tower-info" className="tower-rules tower-build"><summary>Build · {run.upgrades.length}</summary><ul>{run.upgrades.map((id, index) => {
          const upgrade = TOWER_UPGRADES.find(candidate => candidate.id === id)!;
          return <li key={index}><strong>{upgrade.name}</strong><p>{upgrade.description}</p></li>;
        })}</ul></details>}
        {run && !finished && run.phase !== 'battle' && <div className="tower-retire">{confirmRetire ? <><p>End this run? Keep rewards, lose your build.</p><button type="button" disabled={disabled} onClick={() => act('retire')}>End expedition</button><button type="button" disabled={busy} onClick={() => setConfirmRetire(false)}>Keep climbing</button></> : <><span>Progress saved</span><button type="button" disabled={disabled} onClick={() => setConfirmRetire(true)}>End run</button></>}</div>}
      </footer>}
    </div>
  </main>;
}
