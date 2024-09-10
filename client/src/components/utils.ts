import {Class, Stat} from "@legion/shared/enums";
import { apiFetch } from '../services/apiService';
import { guide } from './tips';
import { startTour } from './tours';  
import { LeaguesNames } from "@legion/shared/enums";

import guideIcon from '@assets/guide.png';
import successIcon from '@assets/svg/success.svg';
import errorIcon from '@assets/svg/error.svg';

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
      paddingLeft: "44px"
    },
  }).showToast();
}

export function successToast(text: string, duration: number = 3000) {
  showToast(text, duration, successIcon);
}

export function errorToast(text: string, duration: number = 3000) {
  showToast(text, duration, errorIcon);
}
 
export function mapFrameToCoordinates(frame: number) {
  const width = 10;
  return {
    x: (frame % width) * 32,
    y: Math.floor(frame / width) * 32
  }
}

export function playSoundEffect(src: string) {
  const audio = new Audio(src);
  audio.play().catch(error => console.error('Error playing sound:', error));
}

export function manageHelp(page: string, context: any) {
  const todoTours = context.player.tours;
  if (todoTours.includes(page)) {
    startTour(page);
    context.setPlayerInfo({ tours: todoTours.filter(tour => tour !== page) });
  } else {
    fetchGuideTip();
  }
}

let tipLock = false;
function fetchGuideTip() {
  if (tipLock) return;
  tipLock = true;
  apiFetch('fetchGuideTip', {
      method: 'GET',
  })
  .then((data) => {
      if (data.guideId == -1) return;
      showGuideToast(guide[data.guideId], data.route);
      tipLock = false;
  })
  .catch(error => console.error(`Fetching tip error: ${error}`));
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