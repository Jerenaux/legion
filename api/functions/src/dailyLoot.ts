import {ChestColor} from "@legion/shared/enums";
import type {DailyLootAllDBData} from "@legion/shared/interfaces";

export const chestsDelays = {
  [ChestColor.BRONZE]: 6 * 60 * 60,
  [ChestColor.SILVER]: 12 * 60 * 60,
  [ChestColor.GOLD]: 24 * 60 * 60,
};

export function getDefaultDailyLoot(): DailyLootAllDBData {
  const now = Date.now() / 1000;
  return {
    [ChestColor.BRONZE]: {
      time: now + chestsDelays[ChestColor.BRONZE],
      hasKey: false,
    },
    [ChestColor.SILVER]: {
      time: now + chestsDelays[ChestColor.SILVER],
      hasKey: false,
    },
    [ChestColor.GOLD]: {
      time: now + chestsDelays[ChestColor.GOLD],
      hasKey: false,
    },
  };
}
