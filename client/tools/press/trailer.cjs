// Staged real renderer captures. Music is added from the original master in the edit.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const fs=require('node:fs');
const path=require('node:path');
const output=path.resolve(process.argv[2]);fs.mkdirSync(output,{recursive:true});
// Original trailer cuts, measured in 60 fps frames; end card begins at frame 1810.
const shots=[
 ['opening',0,350,'/game/press?press=10'],
 ['team-warrior',350,450,'/team?press=1&character=0'],
 ['team-mage',450,615,'/team?press=1&character=1'],
 ['spells',615,681,'/shop/spells?press=1'],
 ['equipment',681,738,'/shop/equipments?press=1'],
 ['items',738,793,'/shop/consumables?press=1'],
 ['rank',793,854,'/rank?press=1&ranking'],
 ['fire',854,992,'/game/press?press=11'],
 ['ice-wall',992,1082,'/game/press?press=12'],
 ['lightning',1082,1190,'/game/press?press=13'],
 ['heal',1190,1272,'/game/press?press=14'],
 ['melee-kill',1272,1349,'/game/press?press=15'],
 ['terrain',1349,1423,'/game/press?press=16'],
 ['freeze',1423,1486,'/game/press?press=17'],
 ['sword',1486,1574,'/game/press?press=18'],
 ['ice-kill',1574,1662,'/game/press?press=19'],
 ['final-fire',1662,1810,'/game/press?press=20'],
];
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 for(const [name,start,end,route] of shots) {
  if(process.env.SHOT && !process.env.SHOT.split(',').includes(name))continue;
  if(process.env.RESUME && fs.existsSync(path.join(output,name+'.mp4')))continue;
  const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('console',message=>{if(/Missing animation|Texture.*(?:not found|has no frame)|Frame.*(?:not found|not exist)/.test(message.text()))errors.push(message.text());});
  await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  await page.clock.install();
  await page.goto('http://127.0.0.1:8084'+route);await page.waitForTimeout(4000);await page.evaluate(()=>document.fonts.ready);
  if(route.startsWith('/game/')) {
    await page.waitForFunction(()=>window.combatCheck?.arena?.gameInitialized);
    await page.evaluate(()=>{
      const a=combatCheck.arena;
      for(const team of a.teamsMap.values())for(const member of team.members)for(const spell of member.spells)
        for(const key of [spell.vfx,spell.charge].filter(Boolean))
          if(!a.textures.exists(key)||!a.anims.exists(key))throw new Error('Unprepared capture asset: '+key);
    });
  }
  
  await page.mouse.move(1900,1060);
  await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+100)));
  await page.evaluate(name=>{
    window.pressAction=(frame)=>{
      if(['spells','equipment','items'].includes(name)) {
        const container=document.querySelector('.shop-items-container');
        if(container)container.scrollTop=Math.max(0,frame-8)*9;
      }
      const arena=window.combatCheck?.arena;if(!arena)return;
      const effect=(id,x,y,kill=false,team=1,num=3)=>{const caster=arena.getPlayer(team,num);arena.processLocalAnimation({fromX:caster.gridX,fromY:caster.gridY,toX:x,toY:y,id,isKill:kill});};
      const rival=arena.getPlayer(2,1),secondRival=arena.getPlayer(2,2),ally=arena.getPlayer(1,3);
      const melee=()=>{const victim=arena.getPlayer(1,5);arena.processMove({team:2,num:1,tile:{x:victim.gridX+1,y:victim.gridY}});turn(2,1);};
      const damage=(team,num,value,kill=false)=>arena.processHPChange({team,num,hp:kill?0:Math.max(1,arena.getPlayer(team,num).hp-value),damage:-value});
      const patch=(x,y,radius,type)=>{const cells=[];for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++)if(Math.abs(dx)+Math.abs(dy)<=radius)cells.push({x:x+dx,y:y+dy,terrain:type});arena.processTerrain(cells);};
      const turn=(team,num,n=19)=>arena.processTurnee({team,num,turnDuration:7,timeLeft:7,turnNumber:n});
      const cast=(id)=>arena.processCast(true,{team:1,num:3,id});
      const endcast=(id)=>arena.processCast(false,{team:1,num:3,id});
      if(name==='opening') {
        if(frame===0)cast(2);
        if(frame===94){endcast(2);effect(2,8,5,true);patch(8,5,2,1);damage(2,1,247,true);damage(2,6,173,true);}
        if(frame===274){arena.resetCamera();}
        if(frame===292){arena.killCamActive=false;arena.displayGEN(1);turn(2,2);}
      }
      if(name==='fire') {
        if(frame===0)cast(1);
        if(frame===38){endcast(1);effect(1,rival.gridX,rival.gridY);patch(rival.gridX,rival.gridY,1,1);damage(2,1,47);damage(2,4,39);arena.displayGEN(2);}
      }
      if(name==='ice-wall' && frame===0)turn(2,2);
      if(name==='lightning') {
        if(frame===0)cast(5);
        if(frame===65){endcast(5);effect(5,secondRival.gridX,secondRival.gridY);damage(2,2,96);}
      }
      if(name==='heal') {
        if(frame===0)turn(2,2);
        if(frame===25){effect(9,rival.gridX,rival.gridY,false,2,2);arena.processHPChange({team:2,num:1,hp:rival.maxHP,damage:63});}
      }
      if(name==='melee-kill') {
        if(frame===0){melee();}
        if(frame===14){arena.processAttack({team:2,num:1,target:5,hp:0,isKill:true,sameTeam:false});}
      }
      if(name==='terrain' && frame===0) {turn(2,2);arena.processCast(true,{team:2,num:2,id:9});}
      if(name==='freeze') {
        if(frame===0)turn(2,3);
        if(frame===12){effect(6,ally.gridX,ally.gridY,false,2,3);patch(ally.gridX,ally.gridY,0,2);arena.displayGEN(4);}
      }
      if(name==='sword') {
        if(frame===0){melee();}
        if(frame===27){arena.processAttack({team:2,num:1,target:5,hp:132,isKill:false,sameTeam:false});}
      }
      if(name==='ice-kill') {
        if(frame===0)cast(8);
        if(frame===20){endcast(8);effect(8,rival.gridX,rival.gridY,true);patch(rival.gridX,rival.gridY,2,2);damage(2,1,374,true);damage(2,4,533,true);damage(2,6,187,true);}
      }
      if(name==='final-fire') {
        if(frame===0)cast(2);
        if(frame===12){endcast(2);effect(2,rival.gridX,rival.gridY,true);patch(rival.gridX,rival.gridY,2,1);damage(2,1,237,true);damage(2,4,349,true);damage(2,6,173,true);}
      }
    };
  },name);
  const destination=path.join(output,name+'.mp4');
  const encoder=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','image2pipe','-framerate','60','-vcodec','mjpeg','-i','pipe:0','-an','-c:v','libx264','-preset','fast','-crf','16','-pix_fmt','yuv420p',destination],{stdio:['pipe','inherit','inherit']});
  const completed=once(encoder,'close');
  try {
  for(let frame=0;frame<end-start;frame++) {
    await page.evaluate(frame=>window.pressAction(frame),frame);
    if(name==='team-mage' && frame===70) {const item=page.locator('[data-item-icon="equipment-23"]').first();if(await item.count())await item.hover();}
    await page.clock.runFor(Math.floor((frame+1)*1000/60)-Math.floor(frame*1000/60));
    const missing=await page.evaluate(()=>{
      const bad=[];const visit=(object,parentVisible=true)=>{
        const visible=parentVisible&&object.visible!==false&&object.alpha!==0;
        if(visible&&object.texture?.key==='__MISSING')bad.push({name:object.name,x:object.x,y:object.y,animation:object.anims?.currentAnim?.key});
        for(const child of object.list||[])visit(child,visible);
      };
      for(const object of window.combatCheck?.arena?.children.list||[])visit(object);return bad;
    });
    if(missing.length||errors.length)throw new Error(JSON.stringify({shot:name,frame,missing,errors}));
    const image=await page.screenshot({type:'jpeg',quality:96});
    if([0,25,50,75,100].includes(frame))fs.writeFileSync(path.join(output,name+'-'+frame+'.jpg'),image);
    if(!encoder.stdin.write(image))await once(encoder.stdin,'drain');
  }
  encoder.stdin.end();const [code]=await completed;if(code!==0)throw new Error('Encoder failed: '+name);
  }finally{if(!encoder.stdin.writableEnded){encoder.stdin.destroy();encoder.kill();}}
  fs.writeFileSync(path.join(output,name+'-audit.json'),JSON.stringify({name,frames:end-start,missingFrames:0,errors},null,2));
  await page.close();console.log('Recorded',name,start,end,'errors:',errors);
 }
 fs.writeFileSync(path.join(output,'timeline.json'),JSON.stringify(shots,null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
