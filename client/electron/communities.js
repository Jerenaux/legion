// Community invitation links: `legion://community/CODE`, `--legion-community=CODE` and the Steam
// `?community=CODE` launch parameter. Only the latest code is kept; the renderer asks to join.
const CODE = /^[a-z0-9][a-z0-9-]{1,22}[a-z0-9]$/;

function normalizeCode(value) {
  if (typeof value !== 'string') return null;
  const code = value.trim().toLowerCase();
  return CODE.test(code) ? code : null;
}

function communityFromArguments(args) {
  for (const value of args) {
    if (typeof value !== 'string') continue;
    if (value.startsWith('--legion-community=')) {
      const code = normalizeCode(value.slice('--legion-community='.length));
      if (code) return code;
    }
    const match = /^legion:\/\/community\/([A-Za-z0-9-]+)\/?$/.exec(value);
    if (match && normalizeCode(match[1])) return normalizeCode(match[1]);
  }
  return null;
}

function createCommunityInvite(notify) {
  let pending = null;
  return {
    peek: () => pending,
    add(value) {
      const code = normalizeCode(value);
      if (!code || code === pending) return;
      pending = code; notify();
    },
    acknowledge(value) {
      if (normalizeCode(value) === pending) pending = null;
    },
  };
}

module.exports = {communityFromArguments, createCommunityInvite, normalizeCode};
