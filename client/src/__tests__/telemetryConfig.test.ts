import { test, expect } from 'bun:test';
import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {scrubTelemetry} from '../../../shared/telemetryPrivacy';

test('records only a store bundle in the packaged app, never a browser or smoke check', () => {
  const cases = [
    {name: 'Steam/Itch packaged session', expected: true},
    {name: 'local production build', enabled: '', expected: false},
    {name: 'development', nodeEnv: 'development', expected: false},
    {name: 'web build with leaked opt-in', target: 'web', expected: false},
    {name: 'browser preview', url: 'http://localhost:8080/', bridge: false, expected: false},
    {name: 'browser serving store bundle', bridge: false, expected: false},
    {name: 'Electron local preview', url: 'http://localhost:8080/', expected: false},
    {name: 'hosted preview', url: 'https://preview.example/', expected: false},
    {name: 'file preview', url: 'file:///tmp/index.html', expected: false},
    {name: 'other app host', url: 'app://preview/', expected: false},
    {name: 'unpackaged Electron', packaged: false, expected: false},
    {name: 'missing packaged marker', packaged: null, expected: false},
    {name: 'packaged smoke test', smoke: true, expected: false},
  ];
  for (const scenario of cases) {
    const {nodeEnv = 'production', target = 'electron', enabled = 'true', url = 'app://legion/',
      bridge = true, packaged = true, smoke = false} = scenario;
    const result = Bun.spawnSync({
      cmd: [process.execPath, '-e', `
        globalThis.window = {location: new URL(${JSON.stringify(url)}), process: {type: 'renderer'},
          electronAPI: ${JSON.stringify(bridge ? {isPackaged: packaged, smokeTest: smoke} : null)}};
        const {telemetryConfig} = await import('./src/telemetryConfig.ts');
        console.log(telemetryConfig.sentryReplay);
      `],
      cwd: resolve(import.meta.dir, '../..'),
      env: {...process.env, NODE_ENV: nodeEnv, BUILD_TARGET: target, SENTRY_REPLAY_ENABLED: enabled},
      stdout: 'pipe', stderr: 'pipe',
    });
    expect(result.exitCode, scenario.name).toBe(0);
    expect(result.stdout.toString().trim(), scenario.name).toBe(String(scenario.expected));
  }
});

test('only the main store-release workflow can embed the Replay opt-in', () => {
  const configPath = resolve(import.meta.dir, '../../webpack.config.js');
  const storeEnv = {
    NODE_ENV: 'production', BUILD_TARGET: 'electron', SENTRY_REPLAY_ENABLED: 'true',
    GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'workflow_dispatch',
    GITHUB_WORKFLOW_REF: 'Jerenaux/legion/.github/workflows/release-desktop.yml@refs/heads/main',
    API_URL: 'https://api.example', GAME_SERVER_URL: 'https://game.example', MATCHMAKER_URL: 'https://match.example',
  };
  for (const overrides of [{}, {NODE_ENV: 'development'}, {BUILD_TARGET: 'web'},
    {SENTRY_REPLAY_ENABLED: ''}, {SENTRY_REPLAY_ENABLED: 'false'}, {GITHUB_ACTIONS: ''},
    {GITHUB_EVENT_NAME: 'pull_request'}, {GITHUB_WORKFLOW_REF: ''},
    {GITHUB_WORKFLOW_REF: storeEnv.GITHUB_WORKFLOW_REF.replace('main', 'feature')},
    {GITHUB_WORKFLOW_REF: storeEnv.GITHUB_WORKFLOW_REF.replace('Jerenaux', 'fork')},
    {GITHUB_WORKFLOW_REF: storeEnv.GITHUB_WORKFLOW_REF.replace('release-desktop', 'ci')}]) {
    const module = {exports: {plugins: [] as {definitions?: Record<string, string>}[]}};
    runInNewContext(readFileSync(configPath, 'utf8'), {
      module, require: createRequire(configPath), __dirname: resolve(import.meta.dir, '../..'),
      process: {env: {...storeEnv, ...overrides}, platform: 'win32'}, console: {log() {}},
    });
    const defines = module.exports.plugins.find(plugin => plugin.definitions?.['process.env.SENTRY_REPLAY_ENABLED']);
    expect(defines?.definitions?.['process.env.SENTRY_REPLAY_ENABLED']).toBe(JSON.stringify(Object.keys(overrides).length ? '' : 'true'));
  }
  const workflow = Bun.YAML.parse(readFileSync(resolve(import.meta.dir, '../../../.github/workflows/release-desktop.yml'), 'utf8')) as {
    jobs: {build: {steps: {env?: Record<string, string>}[]}};
  };
  expect(workflow.jobs.build.steps.find(step => step.env?.SENTRY_REPLAY_ENABLED)?.env?.SENTRY_REPLAY_ENABLED)
    // biome-ignore lint/suspicious/noTemplateCurlyInString: Literal GitHub Actions expression.
    .toBe("${{ inputs.publish_itch || (inputs.upload_steam && matrix.platform != 'linux') }}");
});

test('redacts telemetry credentials without throwing on complex console arguments', () => {
  const circular: Record<string, unknown> = {count: BigInt(1)};
  circular.self = circular;
  const result = JSON.stringify(scrubTelemetry({circular,
    credential: 'private-credential', accessToken: 'private-token',
    url: 'https://example.test/game?key=private-query#private-fragment',
    message: 'JWT eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature',
  }));
  expect(result).not.toMatch(/private-|eyJ/);
  expect(result).toContain('https://example.test/game');
  expect(result).toContain('[Circular]');
  expect(scrubTelemetry<unknown>({toJSON() {throw new Error('unserializable');}})).toBeNull();
});

test('LogRocket matches replay visibility and removes network credentials', () => {
  const result = Bun.spawnSync({cmd: [process.execPath, '-e', `
    globalThis.window = {location: new URL('app://legion/'), process: {type: 'renderer'}};
    const {logRocketOptions: options} = await import('./src/telemetryConfig.ts');
    const request = options.network.requestSanitizer({url:'https://user:secret@example.test/path?token=secret#secret',headers:{Authorization:'secret'},body:'secret',referrer:'secret'});
    const response = options.network.responseSanitizer({url:'/path?token=secret',headers:{'Set-Cookie':'secret'},body:'secret'});
    console.log(JSON.stringify({dom:options.dom,console:options.console,ip:options.shouldCaptureIP,exceptions:options.shouldDetectExceptions,request,response}));
  `], cwd: resolve(import.meta.dir, '../..')});
  expect(result.exitCode).toBe(0);
  const options = JSON.parse(result.stdout.toString());
  expect(options.dom).toEqual({textSanitizer:false,inputSanitizer:false,imageSanitizer:false});
  expect(options.console).toEqual({isEnabled:false});
  expect(options.ip).toBe(false);
  expect(options.exceptions).toBe(false);
  expect(options.request).toEqual({url:'https://example.test/path',headers:{}});
  expect(options.response).toEqual({url:'app://legion/path',headers:{}});
});
