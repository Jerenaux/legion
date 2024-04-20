import {Class, Stat} from "@legion/shared/enums";

import Toastify from 'toastify-js'
import "toastify-js/src/toastify.css"

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

function showToast(text: string, duration: number = 3000, extraStyle?: any) {
  Toastify({
    text,
    duration,
    close: true,
    gravity: "bottom", // `top` or `bottom`
    position: "center", // `left`, `center` or `right`
    stopOnFocus: true, // Prevents dismissing of toast on hover
    style: {
      borderRadius: "15px",
      ...extraStyle
    }
    // onClick: function(){} // Callback after click
  }).showToast();
}

export function successToast(text: string, duration: number = 3000) {
  showToast(text, duration);
}

export function errorToast(text: string, duration: number = 3000) {
  showToast(text, duration, {background: "#ff4d4d"});
}
 
export interface PlayerData {
    name: string;
    lvl: number;
    gold: number;
    elo: number;
}
