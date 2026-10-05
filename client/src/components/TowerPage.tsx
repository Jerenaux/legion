import {LOCKED_FEATURES} from '@legion/shared/config';
import {PlayerContext} from '../contexts/PlayerContext';
import {t, formatNumber} from '../i18n/core';
import {Trans} from '../i18n/Trans';
import {h, Fragment} from 'preact';
import {useEffect, useState, useMemo, useContext} from 'preact/hooks';
import {Link, route} from 'preact-router';
import {apiFetch} from '../services/apiService';
import {Class, ClassLabels, RewardType, LockedFeatures} from '@legion/shared/enums';
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
  return <span className="tower-item-icon" role="img" aria-label={t(item.name)} title={t(item.name)} style={{backgroundImage: `url(${getRewardBgImage(type)})`, backgroundPosition: `-${x}px -${y}px`}} />;
}
function Rewards({reward}: {reward: TowerReward}) {
  return <span className="tower-rewards"><span><img src={goldIcon} alt="" /><Trans i18nKey="<0>{{amount}}</0> gold" values={{amount: reward.gold}} components={[<b />]} /></span><span><img src={xpIcon} alt="" /><Trans i18nKey="<0>{{amount}}</0> XP" values={{amount: reward.xp}} components={[<b />]} /></span>{reward.items.map((item, index) => <ItemIcon key={index} type={item.type} id={item.id} />)}</span>;
}

export default function TowerPage() {
  const {loaded, canAccessFeature, getCompletedGames, refreshPlayerData} = useContext(PlayerContext);
  const unlocked = canAccessFeature(LockedFeatures.TOWER_MODE);
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
    try { setProgress(await apiFetch('tower')); refreshPlayerData(); }
    catch { setError('Could not load your expedition. Your saved progress is safe.'); }
    finally { setBusy(false); }
  };
  useEffect(() => { if (loaded && unlocked) void refresh(); }, [loaded, unlocked]);

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

  if (!loaded) return <main className="tower-page" role="status">{t("Preparing your expedition…")}</main>;
  if (!unlocked) return <main className="tower-page"><section className="tower-start tower-locked">
    <img src={towerIcon} alt="" /><h1>{t("Cinder Tower")}</h1>
    <p>{t("Unlocks after {{required}} completed matches · {{completed}}/{{required}}", {required: LOCKED_FEATURES[LockedFeatures.TOWER_MODE], completed: getCompletedGames()})}</p>
    <Link href="/play" className="tower-primary">{t("Play")}</Link>
  </section></main>;

  return <main className={`tower-page ${run && !finished ? 'is-climbing' : 'is-preparing'}`} aria-busy={busy}>
    <div className="tower-layout">
      <header className="tower-heading">
        <Link href="/play" className="tower-back"><span aria-hidden="true">‹</span>{t("Play")}</Link>
        <div className="tower-title"><img src={towerIcon} alt="" /><h1>{t("Cinder Tower")}</h1></div>
        {run && !finished ? <section className="tower-progress tower-header-progress" aria-label={t("Banked rewards")}><span>{t('{{count}} / {{total}} cleared', {count: completed, total: TOWER_FLOORS})}</span><Rewards reward={run.earned} /></section> : <span className="tower-mode-label">{t("Solo · Untimed")}</span>}
      </header>
      {error && <div className="tower-error" role="alert"><p>{t(error)}</p><button type="button" disabled={busy} onClick={refresh}>{t("Refresh expedition")}</button></div>}
      {!progress && !error && <div className="tower-loading" role="status"><img src={towerIcon} alt="" /><p>{t("Preparing your expedition…")}</p></div>}
      {progress && <div className="tower-expedition">
        {run && !finished && <aside className="tower-ascent" aria-label={t("Expedition progress")}>
          <div className="tower-tier">{t('Tier {{tier}}', {tier: run.tier})}</div>
          <ol className="tower-floors">{Array.from({length: TOWER_FLOORS}, (_, i) => <li key={i} className={run && i < completed ? 'cleared' : i === completed && !finished ? 'current' : ''}
            aria-current={i === completed && !finished ? 'step' : undefined}>
            <span className="tower-floor-number">{run && i < completed ? '✓' : i === 5 ? '♜' : formatNumber(i + 1, {minimumIntegerDigits: 2})}</span>
            <span className="tower-floor-label">{i === 5 ? t('Warden') : t('Floor {{floor}}', {floor: i + 1})}</span>
          </li>)}</ol>
        </aside>}
        <div className={`tower-main ${run && !finished ? 'active-run' : ''}`}>
          {run && finished && <section className={`tower-progress ${finished ? 'is-finished' : ''}`} aria-label={t("Banked rewards")}>
            <div><span className="tower-kicker">{t(finished ? 'EXPEDITION COMPLETE' : 'ASCENT')}</span><strong>{t('{{count}} / {{total}} cleared', {count: completed, total: TOWER_FLOORS})}</strong></div>
            <div className="tower-bank"><span className="tower-kicker">{t("BANKED")}</span><Rewards reward={run.earned} /></div>
          </section>}
          {(!run || finished) && <section className="tower-start">
            {finished && <div className={`tower-result ${run.phase}`} role="status">
              <img src={towerIcon} alt="" /><div><h2>{t(run.phase === 'won' ? 'Tower conquered' : run.phase === 'lost' ? 'Expedition lost' : 'Expedition ended')}</h2>
              <p>{run.phase === 'won' ? (run.tier === TOWER_MAX_TIER ? t('All tiers conquered.') : t('Tier {{tier}} and the Control kit available.', {tier: run.tier + 1})) : t('Your banked rewards are yours to keep.')}</p></div>
            </div>}


            {!run && <p className="tower-introduction">{t("Lead a temporary squad. Your roster stays untouched. HP, MP and supplies carry between floors; turns have no time limit.")}</p>}
            <div className="tower-preparation-heading"><h2>{t(finished ? 'Next expedition' : 'Choose your squad')}</h2><label className="tower-difficulty"><span>{t("Difficulty")}</span><span className="tower-difficulty-control"><select value={tier} disabled={busy} onChange={event => setTier(Number(event.currentTarget.value))}>
              {Array.from({length: Math.min(TOWER_MAX_TIER, progress.highestClear + 1)}, (_, i) => <option key={i} value={i + 1}>{i === 0 ? t('Tier {{tier}}', {tier: i + 1}) : t('Tier {{tier}} · +{{power}} enemy power', {tier: i + 1, power: formatNumber(i * .15, {style: 'percent'})})}</option>)}
            </select><span aria-hidden="true">⌄</span></span></label></div>
            <div className="tower-kits" role="radiogroup" aria-label={t("Starting kit")}>
              <label className={`tower-kit ${kit === 'balanced' ? 'selected' : ''}`}><input type="radio" name="tower-kit" value="balanced" checked={kit === 'balanced'} disabled={busy} onChange={() => setKit('balanced')} />
                <img src={shieldIcon} alt="" /><span><strong>{t("Balanced")}</strong><small>{t("Fire & healing")}</small></span><span className="tower-kit-check" aria-hidden="true">{kit === 'balanced' ? '✓' : ''}</span></label>
              <label className={`tower-kit ${kit === 'control' ? 'selected' : ''} ${progress.highestClear < 1 ? 'locked' : ''}`}><input type="radio" name="tower-kit" value="control" checked={kit === 'control'} disabled={busy || progress.highestClear < 1} onChange={() => setKit('control')} />
                <ItemIcon type={RewardType.SPELL} id={6} /><span><strong>{t("Control")}</strong><small>{t(progress.highestClear < 1 ? 'Clear Tier 1 to unlock' : 'Ice & poison')}</small></span><span className="tower-kit-check" aria-hidden="true">{kit === 'control' ? '✓' : progress.highestClear < 1 ? '◇' : ''}</span></label>
            </div>
            {kit === 'control' && <p className="tower-kit-detail">{t("Black Mage +20 MP · Warrior −30 HP")}</p>}
          </section>}

          {!finished && <section className="tower-squad" aria-labelledby="tower-squad-title">
            <h3 id="tower-squad-title" className="tower-squad-title">{t(run && !finished ? 'Your squad' : 'Expedition heroes')}</h3>
            <div className="tower-squad-list">{squad.map(unit => <article key={unit.character.class} className="tower-unit" data-class={unit.character.class}>
              <div className="tower-hero-art" aria-hidden="true"><div className="tower-portrait" style={{backgroundImage: `url(${getSpritePath(run && !finished ? unit.character.portrait : previewPortraits[unit.character.class])})`}} /></div>
              <div className="tower-unit-heading"><span className="tower-crest"><ClassCrest characterClass={unit.character.class} /></span><div><h4>{unit.character.name}</h4><span>{t(ClassLabels[unit.character.class])}</span></div></div>
              <div className="tower-vitals">
                <div className="tower-resource"><span>{t("HP")}</span><div className="tower-resource-track"><i style={{width: `${unit.hp / unit.character.stats.hp * 100}%`}} /></div><strong>{formatNumber(unit.hp)}<span>/{formatNumber(unit.character.stats.hp)}</span></strong></div>
                {unit.character.stats.mp > 0 && <div className="tower-resource mana"><span>{t("MP")}</span><div className="tower-resource-track"><i style={{width: `${unit.mp / unit.character.stats.mp * 100}%`}} /></div><strong>{formatNumber(unit.mp)}<span>/{formatNumber(unit.character.stats.mp)}</span></strong></div>}
              </div>
              <div className="tower-loadout"><div className="tower-spells">{unit.character.skills.length ? unit.character.skills.map(id => <span key={id} title={t(getSpellById(id)?.name)}><ItemIcon type={RewardType.SPELL} id={id} /><span>{t(getSpellById(id)?.name)}</span></span>) : <span className="tower-melee"><img src={shieldIcon} alt="" /><span>{t("Melee")}</span></span>}</div>
                <div className="tower-supplies" title={t("Supplies")}>{unit.character.inventory.length ? unit.character.inventory.map((id, index) => <ItemIcon key={index} type={RewardType.CONSUMABLES} id={id} />) : <span>{t("No supplies")}</span>}</div></div>
            </article>)}</div>

          </section>}

          {run && !finished && <section className="tower-decision">
            {run.phase === 'choice' && run.floor === 1 && <p className="tower-introduction">{t("Choose one preparation for this expedition. Restore your squad, refill supplies or learn a spell before the next floor.")}</p>}
            {run.phase === 'battle' ? <div className="tower-resume"><img src={towerIcon} alt="" /><div><span className="tower-kicker">{t('FLOOR {{floor}} · IN BATTLE', {floor: run.floor + 1})}</span><h2>{t(TOWER_ENCOUNTERS[run.floor].find(encounter => encounter.id === run.path[run.floor])?.name || '')}</h2><button type="button" className="tower-primary" disabled={disabled} onClick={() => route(`/game/${run.gameId}`)}>{t("Continue battle")}<span aria-hidden="true">→</span></button></div></div> : <>
              <div className="tower-decision-heading"><div><span className="tower-kicker">{run.phase === 'choice' ? t('FLOOR {{floor}} CLEARED', {floor: run.floor}) : t('FLOOR {{floor}} OF {{total}}', {floor: run.floor + 1, total: TOWER_FLOORS})}</span><h2>{t(run.phase === 'choice' ? 'Choose one upgrade' : run.floor === 5 ? 'The final battle' : 'Choose your battle')}</h2></div>{run.phase === 'choice' && <Rewards reward={run.lastReward} />}</div>
              <div className={`tower-choices ${run.phase === 'choice' ? 'preparations' : 'encounters'}`}>
                {run.phase === 'choice' ? run.offers.map(id => {
                  const upgrade = TOWER_UPGRADES.find(candidate => candidate.id === id)!;
                  const recovery = ['rest', 'supplies'].includes(id);
                  return <button key={id} type="button" className={`tower-choice tower-upgrade-choice ${recovery ? 'recovery' : 'power'}`} disabled={disabled} onClick={() => act('upgrade', {upgrade: id})}>
                    <span className="tower-choice-art">{id in lessonIcons ? <ItemIcon type={RewardType.SPELL} id={lessonIcons[id]} /> : <img src={id === 'guard' ? shieldIcon : id === 'swift' ? practiceIcon : id === 'focus' ? spellScroll : goldChest} alt="" />}</span>
                    <strong>{t(upgrade.name)}</strong><span className="tower-choice-description">{t(upgrade.description)}</span><span className="tower-choice-action" aria-hidden="true">→</span>
                  </button>;
                }) : TOWER_ENCOUNTERS[run.floor].map(encounter => <button key={encounter.id} type="button" className={`tower-choice tower-encounter ${encounter.elite ? 'elite' : ''} ${run.floor === 5 ? 'boss' : ''}`} disabled={disabled} onClick={() => act('battle', {encounter: encounter.id})}>
                  <span className="tower-encounter-top"><span className="tower-kicker">{t(run.floor === 5 ? 'BOSS' : encounter.elite ? 'ELITE' : 'STANDARD')}</span>{encounter.elite && <span className="tower-bonus">{t("+25% gold / XP")}</span>}</span>
                  <span className="tower-enemy-lineup">{encounter.enemies.map((enemy, index) => <span key={index} title={`${t(enemy.name)} · ${t(ClassLabels[enemy.class])}`}><img src={enemy.boss ? towerIcon : classIcons[enemy.class]} alt="" /><small>{t(enemy.boss ? 'Warden' : ClassLabels[enemy.class])}</small></span>)}</span>
                  <strong>{t(encounter.name)}</strong>
                  <span className="tower-spoils"><span className="tower-kicker">{t("REWARDS")}</span><Rewards reward={towerReward(run.floor, run.tier, encounter.elite)} /></span>
                  <span className="tower-choice-action">{t(run.floor === 5 ? 'Challenge Warden' : 'Fight')} <span aria-hidden="true">→</span></span>
                </button>)}
              </div>

            </>}
          </section>}

        </div>
      </div>}
      {progress && <footer className="tower-command-bar">
          <details name="tower-info" className="tower-rules"><summary>{t("Rules & rewards")}</summary>
            <p>{t("Entry is free. Every run starts with a temporary squad; your roster and owned items stay untouched. Turns have no time limit. After a victory, each character is brought to at least 30% HP, then restores 15 HP and 15 MP, up to their maximums. Knocked-out allies return; statuses clear. Ice traps thaw after two skipped turns. Supplies stay used until refilled.")}</p>
            <p>{t("Sanctuary fully restores HP and MP; Quartermaster refills supplies. Defeat ends the run. Banked gold, items, and XP remain yours. XP is shared across your permanent roster. Temporary stats and spells never overwrite it.")}</p>
            <p>{t("Each tier adds 15% enemy HP and attack power and 20% gold and XP. Clear a tier to unlock the next, up to Tier 5. One finished expedition, won or lost, counts as one match toward unlocks. Retiring or giving up does not count. Tower never changes ranked results or ELO.")}</p>
            <p>{t("An internet connection is required. Close Legion between encounters and return later. A short disconnect pauses the battle. If the server can no longer resume it, restart that encounter from its saved entry state with no duplicate rewards.")}</p>
          </details>
        {(!run || finished) && <><span className="tower-run-length"><span className="tower-run-track" aria-hidden="true">{Array.from({length: TOWER_FLOORS - 1}, (_, i) => <i key={i} />)}<img src={towerIcon} alt="" /></span><span><Trans i18nKey="towerBattles" count={TOWER_FLOORS} components={[<b />]} /></span></span><button type="button" className="tower-primary" disabled={disabled} onClick={() => act('create', {tier, kit})}>{t(busy ? 'Preparing…' : 'Begin expedition')} <span aria-hidden="true">→</span></button></>}
        {run && !finished && run.upgrades.length > 0 && <details name="tower-info" className="tower-rules tower-build"><summary>{t('Build · {{count}}', {count: run.upgrades.length})}</summary><ul>{run.upgrades.map((id, index) => {
          const upgrade = TOWER_UPGRADES.find(candidate => candidate.id === id)!;
          return <li key={index}><strong>{t(upgrade.name)}</strong><p>{t(upgrade.description)}</p></li>;
        })}</ul></details>}
        {run && !finished && run.phase !== 'battle' && <div className="tower-retire">{confirmRetire ? <><p>{t("End this run? Keep rewards, lose your build.")}</p><button type="button" disabled={disabled} onClick={() => act('retire')}>{t("End expedition")}</button><button type="button" disabled={busy} onClick={() => setConfirmRetire(false)}>{t("Keep climbing")}</button></> : <><span>{t("Progress saved")}</span><button type="button" disabled={disabled} onClick={() => setConfirmRetire(true)}>{t("End run")}</button></>}</div>}
      </footer>}
    </div>
  </main>;
}
