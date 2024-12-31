import {Class, Stat, StatFields} from "@legion/shared/enums";
import { apiFetch } from '../services/apiService';
import { guide } from './tips';
import { LeaguesNames } from "@legion/shared/enums";

import guideIcon from '@assets/guide.png';
import successIcon from '@assets/svg/success.svg';
import errorIcon from '@assets/svg/error.svg';

import freezeIcon from '@assets/HUD/freeze_icon.png';
import muteIcon from '@assets/HUD/mute_icon.png';
import paralyzeIcon from '@assets/HUD/paralyze_icon.png';
import blindIcon from '@assets/HUD/blind_icon.png';
import sleepIcon from '@assets/HUD/sleep_icon.png';
import poisonIcon from '@assets/HUD/poison_icon.png';
import burnIcon from '@assets/HUD/burn_icon.png';
import hasteIcon from '@assets/HUD/haste_icon.png';

import Toastify from 'toastify-js'

const spriteContext = require.context('@assets/sprites', false, /\.(png|jpe?g|svg)$/);
export const avatarContext = require.context('@assets/avatars', false, /\.(png|jpe?g|svg)$/);
const leagueIconContext = require.context('@assets/icons', false, /_rank\.png$/);

export function classEnumToString(characterClass: Class) {
    const classToName: { [key in Class]?: string } = {};
    classToName[Class.WARRIOR] = "Warrior";
    classToName[Class.WHITE_MAGE] = "White Mage";
    classToName[Class.BLACK_MAGE] = "Black Mage";
    classToName[Class.THIEF] = "Thief";
    return classToName[characterClass];
}

export const statStrings: string[] = Object.keys(Stat)
  .filter(key => isNaN(Number(key)))
  .filter(key => key !== 'NONE')
  .map(key => key.toLowerCase());

interface ExtraStyle {
  background?: string;
  backgroundSize?: string;
}

function showToast(text: string, duration: number = 3000, avatar: string) {
  Toastify({
    text,
    duration,
    close: true,
    gravity: "bottom", // `top` or `bottom`
    position: "center", // `left`, `center` or `right`
    stopOnFocus: true, // Prevents dismissing of toast on hover
    className: "toast",
    avatar,
    style: {
      background: "#242b37",
    }
    // onClick: function(){} // Callback after click
  }).showToast();
}

export function showGuideToast(text: string, destination: string, duration: number = 4000) {
  Toastify({
    text,
    duration,
    close: true,
    gravity: "bottom", // `top` or `bottom`
    position: "center", // `left`, `center` or `right`
    stopOnFocus: true, // Prevents dismissing of toast on hover
    className: "toast",
    destination,
    style: {
      background: `#242b37 url(${guideIcon}) 12px center no-repeat`,
      maxWidth: '300px',
      backgroundRepeat: "no-repeat",
      backgroundPosition: "12px center",
      backgroundSize: "24px",
      paddingLeft: "44px",
      borderRadius: "5px",
    },
  }).showToast();
}

export function successToast(text: string, duration: number = 3000) {
  showToast(text, duration, successIcon);
}

export function silentErrorToast(text: string, duration: number = -1) {
  showToast(text, duration, errorIcon);
}

export function errorToast(text: string, duration: number = -1) {
  console.error(text);
  showToast(text, duration, errorIcon);
}
 
export function mapFrameToCoordinates(frame: number) {
  const width = 10;
  return {
    x: (frame % width) * 32,
    y: Math.floor(frame / width) * 32
  }
}

export function playSoundEffect(src: string, volume: number = 1.0) {
  let sfxVolume = 1.0;
  const settingsString = localStorage.getItem('gameSettings');
  if (settingsString) {
      const settings = JSON.parse(settingsString);
      sfxVolume = settings.sfxVolume;
  }
  const audio = new Audio(src);
  audio.volume = Math.min(Math.max(volume * sfxVolume, 0), 1); // Adjust volume based on SFX setting
  audio.play().catch(error => console.error('Error playing sound:', error));
}

let tipLock = false;
export function fetchGuideTip() {
  if (tipLock) return;
  tipLock = true;
  apiFetch('fetchGuideTip', {
      method: 'GET',

  }, 1, 300, true)
  .then((data) => {
      if (data.guideId == -1) return;
      showGuideToast(guide[data.guideId], data.route);
      tipLock = false;
  })
  // .catch(error => console.error(`Fetching tip error: ${error}`));
}

export function getSpritePath(fileName: string) {
  try {
    return spriteContext(`./${fileName}.png`);
  } catch (error) {
    console.error(`Failed to load sprite: ${fileName}.png`, error);
    return '';
  }
}

export function loadAvatar(avatar) {
  if (avatar != '0') {
      try {
          return avatarContext(`./${avatar}.png`);
      } catch (error) {
          console.error(`Failed to load avatar: ${avatar}.png`, error);
      }
  }
}

export function getLeagueIcon(leagueName: string | number | undefined): string {
  if (leagueName === undefined) return '';
  if (typeof leagueName === 'number') {
    leagueName = LeaguesNames[leagueName];
  }
  const iconName = `${leagueName.toLowerCase()}_rank.png`;
  return leagueIconContext(`./${iconName}`);
}

export function cropFrame(
  spriteSheetUrl: string,
  x: number,
  y: number,
  width: number,
  height: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // img.crossOrigin = 'anonymous'; // Necessary if the image is hosted on a different domain
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Draw the specific frame onto the canvas
        ctx.drawImage(img, -x, -y);
        // Get the Data URL of the canvas content
        const dataUrl = canvas.toDataURL();
        resolve(dataUrl);
      } else {
        reject(new Error('Could not get canvas context'));
      }
    };
    img.onerror = (err) => reject(err);
    img.src = spriteSheetUrl;
  });
}

export const statusIcons = {
  'Freeze': freezeIcon,
  'Mute': muteIcon,
  'Paralyze': paralyzeIcon,
  'Blind': blindIcon,
  'Sleep': sleepIcon,
  'Poison': poisonIcon,
  'Burn': burnIcon,
  'Haste': hasteIcon,
};

interface ActionDetails {
  message: string;
  isMobile: boolean;
}

async function recordPlayerAction(actionType: string, details: string) {
  try {
    await apiFetch('recordPlayerAction', {
      method: 'POST',
      body: {
        actionType,
        details: {
        message: details,
          isMobile: isMobileDevice()
        },
      },
    }, 1, 300, true);
  } catch (error) {
    console.error(`Error recording player action: ${error}`);
  }
}

export function recordCompletedGame() {
  recordPlayerAction('completedGame', '');
}

export function recordLoadingStep(step: string) {
  recordPlayerAction('loadGame', step);
}

export function recordPageView(page: string) {
  recordPlayerAction('pageView', page);
}

export function isMobileDevice(): boolean {
  // Check if running in browser environment
  if (typeof window === 'undefined') return false;
  
  return (
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      // Include tablet detection
      (navigator.maxTouchPoints && navigator.maxTouchPoints > 2 && /MacIntel/.test(navigator.platform)) ||
      // Alternative method using screen size for devices that might spoof user agent
      window.innerWidth <= 768
  );
}

// You can also add a more specific check if needed
export function isTabletDevice(): boolean {
  if (typeof window === 'undefined') return false;
  
  const userAgent = navigator.userAgent.toLowerCase();
  return (
      /(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk|(puffin(?!.*(IP|AP|WP))))/i.test(userAgent) ||
      (navigator.maxTouchPoints && navigator.maxTouchPoints > 2 && /MacIntel/.test(navigator.platform))
  );
}

// Convert stat key string to Stat enum value
export const getStatEnum = (key: string): Stat => {
  return Object.entries(StatFields).find(([_, value]) => value === key)?.[0] as unknown as Stat;
}