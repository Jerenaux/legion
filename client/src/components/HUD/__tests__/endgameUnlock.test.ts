import {expect, test} from 'bun:test';
import {PlayMode} from '@legion/shared/enums';
import {shouldShowUnlockMessage} from '../endgameUnlock';

test('shows the unlock message only after post-tutorial games that grant an unlock', () => {
  expect(shouldShowUnlockMessage(PlayMode.TUTORIAL, 0)).toBe(false);
  expect(shouldShowUnlockMessage(PlayMode.PRACTICE, 0)).toBe(true);
  expect(shouldShowUnlockMessage(PlayMode.CASUAL, 11)).toBe(true);
  expect(shouldShowUnlockMessage(PlayMode.RANKED, 12)).toBe(false);
});
