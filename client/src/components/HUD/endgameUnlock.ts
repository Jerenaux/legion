import {LOCKED_FEATURES} from '@legion/shared/config';
import {LockedFeatures, PlayMode} from '@legion/shared/enums';

export const shouldShowUnlockMessage = (mode: PlayMode, completedGames: number) =>
  mode !== PlayMode.TUTORIAL && completedGames < LOCKED_FEATURES[LockedFeatures.CHARACTER_PURCHASES];
