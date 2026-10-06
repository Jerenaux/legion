import {getRemoteConfig} from 'firebase-admin/remote-config';

type Config = Record<string, string | boolean | undefined>;

export function cacheRemoteConfig(load: () => Promise<Config>, now = Date.now) {
  let cached: Config | undefined;
  let expires = 0;
  let pending: Promise<Config> | undefined;
  return () => {
    if (cached && now() < expires) return Promise.resolve(cached);
    if (!pending) pending = load().then(value => {
      cached = value;
      expires = now() + 60_000;
      return value;
    }).finally(() => {pending = undefined;});
    return pending;
  };
}

export const loadRemoteConfig = cacheRemoteConfig(async () => {
  const template = await getRemoteConfig().getTemplate();
  return Object.fromEntries(Object.entries(template.parameters).map(([key, parameter]) => {
    const value = parameter.defaultValue && 'value' in parameter.defaultValue ? parameter.defaultValue.value : undefined;
    return [key, value === 'true' ? true : value === 'false' ? false : value];
  }));
});
