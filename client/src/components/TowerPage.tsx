import {h, Fragment} from 'preact';
import {useEffect, useState} from 'preact/hooks';
import {Link, route} from 'preact-router';
import {apiFetch} from '../services/apiService';
import {ClassLabels} from '@legion/shared/enums';
import {getSpellById} from '@legion/shared/Spells';
import {getConsumableById} from '@legion/shared/Items';
import {getEquipmentById} from '@legion/shared/Equipments';
import {TOWER_ENCOUNTERS, TOWER_UPGRADES, TOWER_MAX_TIER, TOWER_FLOORS, TowerProgress, TowerKit, towerTerminal, towerReward} from '@legion/shared/tower';
import {getSpritePath} from './utils';
import './TowerPage.css';

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
  const itemName = (item: {type: string; id?: number}) => item.type === 'spell' ? `${getSpellById(item.id)?.name} scroll` :
    item.type === 'equipment' ? getEquipmentById(item.id)?.name : getConsumableById(item.id)?.name;

  return <main className="tower-page" aria-busy={busy}>
    <div className="tower-layout">
      <header className="tower-heading">
        <Link href="/play" className="tower-back">← Play modes</Link>
        <p className="tower-eyebrow">Solo expedition · Online</p>
        <h1>The Cinder Tower</h1>
        <p>Build a squad for this climb. Choose your route, survive six encounters, and face the Warden.</p>
      </header>
      {error && <div className="tower-error" role="alert"><p>{error}</p><button type="button" disabled={busy} onClick={refresh}>Refresh expedition</button></div>}
      {!progress && !error && <p role="status">Loading your saved expedition…</p>}
      {progress && <>
        {run && <section className="tower-progress" aria-label="Expedition progress">
          <ol className="tower-floors">{Array.from({length: TOWER_FLOORS}, (_, i) => <li key={i} className={i < run.floor ? 'cleared' : i === run.floor && !finished ? 'current' : ''}
            aria-current={i === run.floor && !finished ? 'step' : undefined}>
            <span>{i < run.floor ? '✓' : i + 1}</span>{i === 5 ? 'Warden' : `Floor ${i + 1}`}
          </li>)}</ol>
          <p>Tier {run.tier} · {run.floor}/6 cleared · <strong>{run.earned.gold} gold + {run.earned.xp} XP banked</strong></p>
          {run.earned.items.length > 0 && <p>Added to your inventory: {run.earned.items.map(itemName).join(', ')}.</p>}
        </section>}

        {(!run || finished) && <section className="tower-start">
          {finished && <div role="status">
            <h2>{run.phase === 'won' ? 'The summit is yours' : run.phase === 'lost' ? 'The expedition has ended' : 'Back at camp'}</h2>
            <p>{run.phase === 'won' ? (run.tier === TOWER_MAX_TIER ? 'You conquered the highest tier. All rewards are banked.' : 'Your victory unlocked the next available tier and the Control starting kit.') : 'All banked rewards are yours to keep. A fresh squad is ready for another approach.'}</p>
          </div>}
          <h2>{run ? 'Begin another climb' : 'Prepare your expedition'}</h2>
          <div className="tower-start-options">
            <label>Difficulty<select value={tier} disabled={busy} onChange={event => setTier(Number(event.currentTarget.value))}>
              {Array.from({length: Math.min(TOWER_MAX_TIER, progress.highestClear + 1)}, (_, i) => <option key={i} value={i + 1}>Tier {i + 1}{i === 0 ? ' · First ascent' : ` · +${i * 15}% enemy HP / power`}</option>)}
            </select></label>
            <label>Starting kit<select value={kit} disabled={busy} onChange={event => setKit(event.currentTarget.value as TowerKit)}>
              <option value="balanced">Balanced · Fire, Heal, sturdy Warrior</option>
              <option value="control" disabled={progress.highestClear < 1}>Control · Ice + Poison{progress.highestClear < 1 ? ' (clear Tier 1 to unlock)' : ''}</option>
            </select></label>
          </div>
          <p>{kit === 'control' ? 'Your Black Mage starts with Ice, Poison, and 20 extra MP. Your Warrior starts with 30 less HP.' : 'A Warrior, White Mage, and Black Mage start with standardized stats and their own supplies.'}</p>
          <button type="button" className="tower-primary" disabled={busy || !!error} onClick={() => act('create', {tier, kit})}>{busy ? 'Preparing…' : 'Begin expedition'}</button>
          <p className="tower-note">No entry cost. Owned items are never consumed. Temporary upgrades reset after the run.</p>
        </section>}

        {run && !finished && <>
          <section className="tower-squad" aria-labelledby="tower-squad-title">
            <h2 id="tower-squad-title">Your expedition squad</h2>
            <div className="tower-squad-list">{run.squad.map(unit => <article key={unit.character.class} className="tower-unit">
              <div className="tower-portrait" style={{backgroundImage: `url(${getSpritePath(unit.character.portrait)})`}} />
              <div><h3>{unit.character.name} <small>{ClassLabels[unit.character.class]}</small></h3>
                <p>HP <strong>{unit.hp}/{unit.character.stats.hp}</strong> · MP <strong>{unit.mp}/{unit.character.stats.mp}</strong></p>
                <p className="tower-note">{unit.character.skills.map(id => getSpellById(id)?.name).join(' · ') || 'Melee specialist'}</p>
                <p className="tower-note">Supplies: {unit.character.inventory.map(id => getConsumableById(id)?.name).join(', ') || 'None'}</p>
              </div>
            </article>)}</div>
            {run.upgrades.length > 0 && <p className="tower-note">Chosen this run: {run.upgrades.map(id => TOWER_UPGRADES.find(upgrade => upgrade.id === id)?.name).join(' · ')}</p>}
          </section>
          {run.phase === 'battle' ? <section className="tower-decision"><h2>Your encounter is waiting</h2>
            <p>{TOWER_ENCOUNTERS[run.floor].find(encounter => encounter.id === run.path[run.floor])?.name}. Return to the arena to finish this floor.</p>
            <button type="button" className="tower-primary" disabled={busy} onClick={() => route(`/game/${run.gameId}`)}>Continue battle</button>
          </section> : <section className="tower-decision">
            {run.phase === 'choice' ? <>
              <p className="tower-eyebrow">Floor cleared · +{run.lastReward.gold} gold · +{run.lastReward.xp} XP</p>
              <h2>Choose one preparation</h2><p>Recover now, refill your supplies, or change the way your squad fights.</p>
              <div className="tower-choices">{run.offers.map(id => {
                const upgrade = TOWER_UPGRADES.find(candidate => candidate.id === id)!;
                return <button key={id} type="button" className="tower-choice" disabled={busy || !!error} onClick={() => act('upgrade', {upgrade: id})}>
                  <strong>{upgrade.name}</strong><span>{upgrade.description}</span><span className="tower-choice-action">Choose →</span>
                </button>;
              })}</div>
            </> : <>
              <h2>{run.floor === 5 ? 'The summit awaits' : `Choose your route to floor ${run.floor + 1}`}</h2>
              <div className="tower-choices">{TOWER_ENCOUNTERS[run.floor].map(encounter => {
                const reward = towerReward(run.floor, run.tier, encounter.elite);
                return <button key={encounter.id} type="button" className="tower-choice" disabled={busy || !!error} onClick={() => act('battle', {encounter: encounter.id})}>
                  <span className="tower-eyebrow">{run.floor === 5 ? 'Boss encounter' : encounter.elite ? 'Dangerous route · +25% rewards' : 'Standard route'}</span>
                  <strong>{encounter.name}</strong><span>{encounter.description}</span>
                  <span className="tower-note">{reward.gold} gold · {reward.xp} XP{reward.items.length ? ` · ${reward.items.map(itemName).join(', ')}` : ''}</span>
                  <span className="tower-choice-action">Enter encounter →</span>
                </button>;
              })}</div>
            </>}
            <div className="tower-retire">{confirmRetire ? <>
              <p>End this climb? Keep banked rewards; temporary upgrades and supplies will be lost.</p>
              <button type="button" disabled={busy} onClick={() => act('retire')}>End expedition</button>
              <button type="button" disabled={busy} onClick={() => setConfirmRetire(false)}>Keep climbing</button>
            </> : <><p>You can leave this screen. Progress is saved between encounters.</p><button type="button" disabled={busy} onClick={() => setConfirmRetire(true)}>Retire this expedition</button></>}</div>
          </section>}
        </>}
      </>}
      <details className="tower-rules"><summary>Recovery, rewards, and saving</summary>
        <p>Turns have no time limit. After a victory, each character is brought to at least 30% HP, then restores 15 HP and 15 MP, up to their maximums. Knocked-out allies return; statuses clear. In Tower battles, ice traps thaw after two skipped turns. Supplies stay used until refilled.</p>
        <p>Choose Sanctuary for full recovery, or Quartermaster for supplies. Defeat ends the run. Banked gold, items, and XP remain yours. XP is shared across your permanent roster; temporary stats and spells never overwrite it.</p>
        <p>Higher floors pay more. Each tier adds 15% enemy HP and attack power and 20% account rewards. Clearing a tier unlocks the next, up to Tier 5. Tower battles do not count toward ranked results, ELO, or match-count unlocks.</p>
        <p>An internet connection is required. Between encounters, you can close Legion and return later. A short disconnect pauses the battle. If the server can no longer resume it, you restart that encounter from its saved entry state, with no duplicate rewards.</p>
      </details>
    </div>
  </main>;
}
