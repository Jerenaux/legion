import {Class, Stat} from "@legion/shared/enums";
import { apiFetch } from '../services/apiService';
import { guide } from './tips';
import { startTour } from './tours';  

import Toastify from 'toastify-js'

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

export function showGuideToast(text: string, destination: string, duration: number = 10000) {
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
      background: "#242b37 url('guide.png') 12px center no-repeat",
      maxWidth: '300px',
      backgroundRepeat: "no-repeat",
      backgroundPosition: "12px center",
      backgroundSize: "24px",
      paddingLeft: "44px"
    },
  }).showToast();
}

export function successToast(text: string, duration: number = 3000) {
  showToast(text, duration, 'svg/success.svg');
}

export function errorToast(text: string, duration: number = 3000) {
  showToast(text, duration, 'svg/error.svg');
}

export function guideToast(text: string, duration: number = 3000) {
  showToast(text, duration, 'svg/guide.svg');
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

export function manageHelp(page: string, todoTours: string[]) {
  if (todoTours.includes(page)) {
    startTour(page);
  } else {
    fetchGuideTip();
  }
}

function fetchGuideTip() {
  apiFetch('fetchGuideTip', {
      method: 'GET',
  })
  .then((data) => {
      if (data.guideId == -1) return;
      showGuideToast(guide[data.guideId], data.route);
  })
  .catch(error => console.error(`Fetching tip error: ${error}`));
}