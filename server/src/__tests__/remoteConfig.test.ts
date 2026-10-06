import {expect, test} from 'bun:test';
import {cacheRemoteConfig} from '../remoteConfig';

test('shares concurrent config loads, refreshes after one minute, and retries failures', async () => {
  let now = 0, calls = 0;
  let reject = false;
  const read = cacheRemoteConfig(async () => {
    calls++;
    if (reject) throw new Error('unavailable');
    return {HIGH_DAMAGE: false};
  }, () => now);
  const [a, b] = await Promise.all([read(), read()]);
  expect(a).toBe(b); expect(calls).toBe(1);
  now = 59_999; await read(); expect(calls).toBe(1);
  now = 60_000; await read(); expect(calls).toBe(2);
  now = 120_000; reject = true;
  await expect(read()).rejects.toThrow('unavailable');
  reject = false; await read(); expect(calls).toBe(4);
});
