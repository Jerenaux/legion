// Real Functions, Firestore and migration CLI; no generated scores count as participation.
import {strict as assert} from 'node:assert';
import {execFileSync} from 'node:child_process';
import {currentSeasonId} from '../../shared/leagueRanking';
import {PlayMode} from '../../shared/enums';

export async function checkRankedParticipation({db, http, login, api, run}) {
  const newcomer = await login(`rank-new-${run}`);
  const ref = db.collection('players').doc(newcomer.uid);
  const fresh = (await ref.get()).data();
  const seasonId = currentSeasonId();
  const previous = currentSeasonId(new Date(Date.now() - 7 * 86400_000));
  await ref.update({league: 1});
  const legacy = db.collection('players').doc(`legacy-real-${run}`);
  const generated = db.collection('players').doc(`legacy-generated-${run}`);
  const zero = db.collection('players').doc(`legacy-zero-${run}`);
  const stale = db.collection('players').doc(`legacy-stale-${run}`);
  const oldGenerated = db.collection('players').doc(`legacy-old-generated-${run}`);
  const {hasRankedResult: _flag, ...empty} = fresh.leagueStats;
  const realStats = {...empty, seasonId, nbGames: 3, wins: 2, losses: 1, winStreak: 1};
  const syntheticStats = {...empty, seasonId, nbGames: 50, wins: 45, losses: 5};
  const fixtures = [
    [legacy, realStats], [generated, syntheticStats], [zero, {...empty, seasonId}],
    [stale, {...realStats, seasonId: previous}], [oldGenerated, {...syntheticStats, seasonId: previous}],
  ];
  for (const [document, leagueStats] of fixtures) await document.set({...fresh, league: 1, leagueStats});
  const cli = (...args: string[]) => JSON.parse(execFileSync('bun', [
    new URL('./backfill-ranked-participation.ts', import.meta.url).pathname, ...args,
  ], {env: process.env, encoding: 'utf8'}));
  try {
    assert.equal((await http('fetchLeaderboard?tab=1', undefined, newcomer.token)).ranking.length, 0);
    assert.equal((await http('bootstrapPlayer', undefined, newcomer.token)).player.rank, 0);
    cli();
    assert.equal((await legacy.get()).data().leagueStats.hasRankedResult, undefined, 'Dry run cannot write');
    cli('--apply');
    const migrated = await legacy.get();
    cli('--apply');
    assert(migrated.updateTime.isEqual((await legacy.get()).updateTime), 'Backfill must be idempotent');
    assert.equal((await stale.get()).data().leagueStats.hasRankedResult, true, 'Preserve last-season rollover participants');
    assert.equal((await generated.get()).data().leagueStats.hasRankedResult, undefined);
    assert.equal((await oldGenerated.get()).data().leagueStats.hasRankedResult, undefined);
    assert.equal((await zero.get()).data().leagueStats.hasRankedResult, undefined);
    let board = await http('fetchLeaderboard?tab=1', undefined, newcomer.token);
    assert.deepEqual(board.ranking.map(row => row.playerId), [legacy.id]);
    assert.equal(board.playerRank, null);
    for (const document of [ref, generated, zero, stale]) {
      const profile = await http(`getProfileData?playerId=${document.id}`);
      assert.equal(profile.leagueStats.rank, 0);
      assert.equal(profile.leagueStats.wins, 0);
    }
    const result = (uid: string, mode: PlayMode, id: string) => ({uid, resultId: `${run}-${id}`, mode,
      stayedUntilTheEnd: true, engagement: {}, outcomes: {
        isWinner: false, xp: 0, gold: 0, elo: 0, characters: [], key: null, chests: [],
      }});
    for (const mode of [PlayMode.PRACTICE, PlayMode.CASUAL]) {
      await http('postGameUpdate', result(newcomer.uid, mode, String(mode)));
      assert.equal((await http('fetchLeaderboard?tab=1', undefined, newcomer.token)).playerRank, null);
    }
    const ranked = result(newcomer.uid, PlayMode.RANKED, 'first-ranked');
    await Promise.all([http('postGameUpdate', ranked), http('postGameUpdate', ranked)]);
    const stats = (await ref.get()).data().leagueStats;
    assert.equal(stats.hasRankedResult, true);
    assert.equal(stats.nbGames, 1);
    assert.equal(stats.wins, 0);
    assert.equal(stats.losses, 1, 'One ranked loss is sufficient; repeated result is not counted twice');
    board = await http('fetchLeaderboard?tab=1', undefined, newcomer.token);
    assert.equal(board.playerRank, 2);
    assert.deepEqual(new Set(board.ranking.map(row => row.playerId)), new Set([legacy.id, ref.id]));
    // Returning to a synthetic record starts genuine seasonal results from zero.
    await http('postGameUpdate', result(generated.id, PlayMode.RANKED_VS_AI, 'return-ranked'));
    const returned = (await generated.get()).data().leagueStats;
    assert.equal(returned.hasRankedResult, true);
    assert.equal(returned.nbGames, 1);
    assert.equal(returned.wins, 0);
    assert.equal(returned.losses, 1);
    await ref.update({'leagueStats.seasonId': previous});
    assert.equal((await http('bootstrapPlayer', undefined, newcomer.token)).player.rank, 0);
    assert.equal((await ref.get()).data().league, 1);
    // Real scheduled rollover excludes historical synthetic/new records too.
    const rollover = await fetch(`${api}/leaguesUpdate-0`, {method: 'POST', headers: {
      'X-CloudScheduler-ScheduleTime': `${seasonId}T19:00:00.000Z`,
    }});
    assert(rollover.ok, await rollover.text());
    assert.equal((await stale.get()).data().league, 2);
    assert.equal((await oldGenerated.get()).data().league, 1);
    assert.equal((await zero.get()).data().league, 1);
    assert.equal((await oldGenerated.get()).data().lastLeagueRolloverSeason, undefined);
    console.log('Ranked participation: migration, empty/new/synthetic records, casual/practice exclusion, first loss, duplicate result, season reset and rollover pass');
  } finally {
    await Promise.all([ref, ...fixtures.map(([document]) => document)].map(document => document.delete()));
  }
}
