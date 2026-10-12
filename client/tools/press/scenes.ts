// Capture data only: imported by the local guide preview, never the release entry point.
import {NewCharacter} from '../../../shared/NewCharacter';
import {Class, League, PlayMode, StatusEffect, Terrain} from '../../../shared/enums';
import type {GameData} from '../../../shared/interfaces';
import {MOVEMENT_RANGE} from '../../../shared/config';

export function pressScene(index: number) {
  const variant = Math.max(0, Math.min(2, index - 1));
  const portraits = [
    ['1_1', '1_7', '1_5', '3_2', '4_5', '3_1'],
    ['1_3', '3_3', '4_5', '7_3', '4_7', '1_6'],
    ['3_8', '4_6', '5_7', '7_6', '5_6', '6_8'],
  ][variant];
  const classes = [Class.WARRIOR, Class.WHITE_MAGE, Class.BLACK_MAGE,
    variant === 1 ? Class.WHITE_MAGE : Class.BLACK_MAGE,
    variant === 0 ? Class.BLACK_MAGE : variant === 1 ? Class.WARRIOR : Class.WHITE_MAGE,
    variant === 1 ? Class.BLACK_MAGE : Class.WARRIOR];
  const names = [['Roland','Luna','Ember','Vex','Sable','Iris'], ['Aldric','Mira','Orin','Lyra','Bram','Faye'], ['Ronan','Nia','Ash','Vale','Eira','Gareth']][variant];
  const characters = classes.map((kind, i) => {
    const character = new NewCharacter(kind, 20).getCharacterData();
    return {...character, id: `press-${i}`, name: names[i], portrait: portraits[i], level: 20, sp: 2,
      stats: {hp: kind === Class.WARRIOR ? 310 : 230, mp: kind === Class.WARRIOR ? 0 : 190,
        atk: kind === Class.WARRIOR ? 46 : 13, def: 28, spatk: 52, spdef: 32, speed: 35},
      skills: kind === Class.BLACK_MAGE ? [2, 8, 5] : kind === Class.WHITE_MAGE ? [9, 10, 12] : [],
      inventory: kind === Class.WARRIOR ? [2, 6, 8] : [2, 3, 6], carrying_capacity: 3,
      equipment: {...character.equipment, weapon: kind === Class.WARRIOR ? 31 : 23, armor: kind === Class.WARRIOR ? 19 : 26,
        helmet: kind === Class.WARRIOR ? 18 : 24, belt: 4, gloves: 27, boots: 28, left_ring: 21, necklace: 22},
    };
  });
  const profile = {playerName: ['Enlil', 'Apeiron', 'Zanza'][variant], playerAvatar: ['4','7','12'][variant],
    teamName: '', playerLevel: 20, playerRank: [16,43,24][variant], playerLeague: League.GOLD, completedGames: 120,
    engagementStats: {completedGames: 120, everMoved: true, everAttacked: true, everUsedSpell: true, everUsedItem: true, everSawFlames: true, everSawIce: true}};
  const statuses = Object.fromEntries(Object.values(StatusEffect).map(key => [key, 0]));
  const positions = [[[6,7],[5,3],[4,5],[4,8],[3,3]], [[6,5],[5,3],[4,6],[3,4]], [[6,6],[7,3],[4,6],[4,8],[5,3]]][variant];
  const enemyPositions = [[[8,6],[9,3],[12,8]], [[5,5],[9,3],[12,8],[10,6]], [[5,6],[10,3],[12,8],[8,6]]][variant];
  const unit = (i: number, position: number[]) => ({...characters[i], x: position[0], y: position[1],
    hp: characters[i].stats.hp - i * 8, maxHP: characters[i].stats.hp,
    mp: Math.max(0, characters[i].stats.mp - (i ? 25 : 0)), maxMP: characters[i].stats.mp,
    distance: MOVEMENT_RANGE, spells: characters[i].skills, statuses: {...statuses}});
  const team = positions.map((position, i) => unit(i, position));
  if(index<10) {
    if(variant===0) team[1].statuses[StatusEffect.MUTE]=4;
    if(variant===1) {team[0].statuses[StatusEffect.POISON]=5;team[1].statuses[StatusEffect.POISON]=8;}
    if(variant===2) {team[0].statuses[StatusEffect.POISON]=5;team[3].statuses[StatusEffect.FREEZE]=2;}
  }
  const enemy = enemyPositions.map((position,i) => ({...unit(i, position), name: ['Garrick','Selene','Kestrel','Tamsin'][i], portrait: ['7_4','2_8','1_6','3_3'][i]}));
  const terrain: GameData['terrain'] = [];
  const patch = (cx: number,cy: number,radius: number,type: Terrain) => {
    for(let y=cy-radius;y<=cy+radius;y++) for(let x=cx-radius;x<=cx+radius;x++) {
      if(Math.abs(x-cx)+Math.abs(y-cy)<=radius+1 && x>=1 && x<15 && y>=1 && y<10 &&
        ![...team,...enemy].some(unit=>unit.x===x && unit.y===y)) terrain.push({x,y,terrain:type});
    }
  };
  if(variant===0) {patch(10,4,2,Terrain.ICE);patch(5,8,1,Terrain.FIRE);patch(8,7,1,Terrain.FIRE);}
  if(variant===1) {patch(4,8,2,Terrain.ICE);patch(11,7,2,Terrain.FIRE);patch(9,3,1,Terrain.ICE);}
  if(variant===2) {patch(10,6,1,Terrain.FIRE);patch(5,8,1,Terrain.ICE);patch(8,2,1,Terrain.FIRE);}
  const queue = team.flatMap((_,i)=>[{num:i+1,team:1},...(enemy[i]?[{num:i+1,team:2}]:[])]).map((entry,position)=>({...entry,position}));
  const battle = {general:{reconnect:true,combatStarted:true,spectator:false,mode:PlayMode.RANKED},
    player:{teamId:1,player:profile,team,score:0},opponent:{teamId:2,player:{...profile,
      playerName:['Temporal Harpy','Shimmering Fury','Unyielding Rogue'][variant],playerAvatar:['2','8','16'][variant],playerRank:[14,28,38][variant]},team:enemy,score:0},
    queue,turnee:{num:variant===1?2:variant===2?1:3,team:1,turnDuration:7,timeLeft:7,turnNumber:18},terrain,holes:[] } as GameData;
  if (index >= 10) {
    battle.player.player = {...profile, playerName: 'Enlil', playerAvatar: '4'};
    battle.opponent.player = {...profile, playerName: 'Temporal Harpy', playerAvatar: '2', playerRank: 14};
    const ownPositions = [[6,5],[4,3],[5,7],[6,3],[7,5]];
    const rivalPositions = [[10,5],[11,3],[10,7],[11,5],[12,8],[9,5]];
    battle.player.team = ownPositions.map((position,i)=>unit(i,position));
    battle.opponent.team = rivalPositions.map((position,i)=>({...unit(i,position), name:['Garrick','Selene','Kestrel','Tamsin','Corin','Wren'][i]}));
    battle.terrain = [];
    const addPatch = (cx:number,cy:number,radius:number,type:Terrain) => {
      for(let y=cy-radius;y<=cy+radius;y++) for(let x=cx-radius;x<=cx+radius;x++)
        if(Math.abs(x-cx)+Math.abs(y-cy)<=radius && ![...battle.player.team,...battle.opponent.team].some(u=>u.x===x&&u.y===y))
          battle.terrain.push({x,y,terrain:type});
    };
    if(index===10) {addPatch(11,3,2,Terrain.ICE);addPatch(7,6,1,Terrain.FIRE);}
    if(index===12) {addPatch(5,3,2,Terrain.ICE);addPatch(6,6,1,Terrain.FIRE);}
    if(index===13 || index===15) addPatch(5,6,1,Terrain.FIRE);
    if(index===15 || index===16) addPatch(11,3,2,Terrain.FIRE);
    if(index===16) addPatch(8,7,2,Terrain.ICE);
    battle.turnee = {...battle.turnee,num:3};
    battle.queue = battle.player.team.flatMap((_,i)=>[{num:i+1,team:1},{num:i+1,team:2}]).map((entry,position)=>({...entry,position}));
  }
  return {characters,profile,battle,inventory:{consumables:[0,1,2,3,4,5,6,7,8,9,10,11,12,13],spells:[0,1,2,3,5,6,8,9,11,12],equipment:[0,1,2,4,6,9,16,18,19,21,22,23,24,26,28,33]}};
}
