interface VFXConfig {
  frameRate?: number;
  yoffset?: number;
  xoffset?: number;
  scale: number;
  shake?: boolean;
  stretch?: boolean;
  extraStretch?: boolean;
}

export const VFXconfig: Record<string, VFXConfig> = {
  fire_1_explosion: {
    frameRate: 30,
    yoffset: 100,
    scale: 1,
  },
  fire_2_explosion: {
    yoffset: 100,
    frameRate: 30,
    xoffset: -25,
    scale: 1,
  },
  fire_3_explosion: {
    frameRate: 30,
    shake: true,
    yoffset: 100,
    scale: 1,
  },
  fireball_1: {
    scale: 0.2,
    frameRate: 30,
  },
  fireball_2: {
    scale: 0.2,
    frameRate: 30,
  },
  fireball_3: {
    scale: 0.2,
    frameRate: 30,
  },
  ice_1: {
    frameRate: 40,
    yoffset: 50,
    scale: 1,
  },
  ice_2: {
    frameRate: 30,
    yoffset: 50,
    scale: 1,
  },
  ice_3: {
    frameRate: 60,
    yoffset: 400,
    scale: 4,
  },
  thunder_1: {
    frameRate: 30,
    scale: 0.5,
    yoffset: 50,
    stretch: true,
  },
  thunder_2: {
    frameRate: 30,
    yoffset: 400,
    stretch: true,
    extraStretch: true,
    scale: 1,
  },
  thunder_3: {
    frameRate: 40,
    scale: 1,
    stretch: true,
    extraStretch: true,
    yoffset: 400,
  },
  heal_1: {
    frameRate: 15,
    scale: 1,
  },
  heal_2: {
    frameRate: 40,
    scale: 0.5,
    yoffset: 50,
  },
  heal_3: {
    frameRate: 40,
    scale: 0.5,
    yoffset: 100,
  },
  potion_heal: {
    scale: 2,
  },
};

export const fireLevels = [1, 2, 3];
export const iceLevels = [1, 2, 3];
export const thunderLevels = [1, 2, 3];
export const healLevels = [1, 2, 3];
export const terrainFireLevels = [1];
export const chargedFireLevels = [1, 2];
export const chargedIceLevels = [1, 2];
export const chargedThunderLevels = [1, 2];
