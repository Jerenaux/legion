const {communityFromArguments, createCommunityInvite} = require('../communities');

test('reads community codes from the protocol and the launch switch only', () => {
  expect(communityFromArguments(['app', '--legion-community=Kestrel'])).toBe('kestrel');
  expect(communityFromArguments(['legion://community/iron-wolves'])).toBe('iron-wolves');
  for (const input of ['legion://gift/kestrel', 'https://community/kestrel', 'legion://community/kestrel?run=bad',
    '--legion-community=../bad', '--legion-community=a', 'legion://community/-bad-']) {
    expect(communityFromArguments([input])).toBeNull();
  }
});

test('keeps the latest invitation until the renderer acknowledges it', () => {
  const notify = jest.fn();
  const invite = createCommunityInvite(notify);
  invite.add('KESTREL');
  invite.add('kestrel');
  expect(invite.peek()).toBe('kestrel');
  expect(notify).toHaveBeenCalledTimes(1);
  invite.acknowledge('other');
  expect(invite.peek()).toBe('kestrel');
  invite.acknowledge('kestrel');
  expect(invite.peek()).toBeNull();
  invite.add(null);
  expect(invite.peek()).toBeNull();
});
