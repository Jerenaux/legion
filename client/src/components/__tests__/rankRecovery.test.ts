import {expect, test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

const parse = (path: string) => ts.createSourceFile(path, readFileSync(new URL(path, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
const pageSource = parse('../RankPage.tsx');
const pageCode = ts.transpileModule(`${pageSource.statements.find(ts.isClassDeclaration)!.getText(pageSource)}\nRankPage;`, {
  compilerOptions: {target: ts.ScriptTarget.ESNext, jsx: ts.JsxEmit.React},
}).outputText;
const apiSource = parse('../../services/apiService.tsx');
const apiCode = ts.transpileModule(apiSource.statements
  .filter(node => !ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)
    && !(ts.isFunctionDeclaration(node) && node.name?.text === 'getFirebaseIdToken'))
  .map(node => node.getText(apiSource)).join('\n') + '\napiFetch;', {
  compilerOptions: {target: ts.ScriptTarget.ESNext},
}).outputText;

function page(apiFetch: (...args: unknown[]) => Promise<unknown>) {
  const Page = runInNewContext(pageCode, {
    Component: class {
      context = {player: {league: 0}};
      state = {};
      setState(state: object, callback?: () => void) {Object.assign(this.state, state); callback?.();}
    },
    PlayerContext: {}, apiFetch, Error,
  });
  return new Page();
}

function realApi(fetch: () => Promise<Response>) {
  return runInNewContext(apiCode, {
    process: {env: {API_URL: 'https://fixture.invalid', NODE_ENV: 'production'}},
    Headers, Error, fetch, getFirebaseIdToken: async () => 'fixture-token',
    captureException() {}, errorToast() {},
    // Exercise the real timeout/retry logic without waiting ten seconds per attempt.
    setTimeout: (callback: () => void) => setTimeout(callback, 0),
  });
}

const result = {league: 0, ranking: [], highlights: [], playerRank: 1};

test('Rank retries a timed-out read once and displays its successful response', async () => {
  let attempts = 0;
  const rank = page(realApi(async () => {
    if (++attempts === 1) return new Promise(() => {});
    return Response.json(result);
  }));
  await expect(rank.fetchLeaderboard()).resolves.toBeUndefined();
  expect(attempts).toBe(2);
  expect(rank.state.isLoading).toBe(false);
  expect(rank.state.leaderboardData).toEqual(result);
});

test('Rank stops loading after two timeouts and can recover through Retry', async () => {
  let attempts = 0;
  let available = false;
  const rank = page(realApi(async () => {
    attempts++;
    return available ? Response.json(result) : new Promise(() => {});
  }));
  await expect(rank.fetchLeaderboard()).resolves.toBeUndefined();
  expect(attempts).toBe(2);
  expect(rank.state.isLoading).toBe(false);
  expect(rank.state.loadFailed).toBe(true);
  available = true;
  const retry = rank.fetchLeaderboard();
  expect(rank.state.loadFailed).toBe(false);
  expect(rank.state.isLoading).toBe(true);
  await retry;
  expect(rank.state.leaderboardData).toEqual(result);
  expect(rank.state.isLoading).toBe(false);
});

for (const staleFailure of [false, true]) {
  test(`old ${staleFailure ? 'failure' : 'response'} cannot overwrite the selected league or an unmounted page`, async () => {
    const requests: {resolve: (data: unknown) => void; reject: (error: Error) => void}[] = [];
    const rank = page(() => new Promise((resolve, reject) => requests.push({resolve, reject})));
    const first = rank.fetchLeaderboard();
    rank.state.curr_tab = 1;
    const second = rank.fetchLeaderboard();
    requests[1].resolve({...result, league: 1});
    await second;
    if (staleFailure) requests[0].reject(new Error('Request timed out'));
    else requests[0].resolve(result);
    await first;
    expect(rank.state.leaderboardData.league).toBe(1);
    expect(rank.state.loadFailed).toBe(false);
    const last = rank.fetchLeaderboard();
    rank.componentWillUnmount();
    rank.setState = () => {throw new Error('Updated an unmounted page');};
    requests[2].resolve(result);
    await expect(last).resolves.toBeUndefined();
  });
}
