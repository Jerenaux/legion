// Run the local guide preview first; captures only real UI, with local staged accounts.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const fs = require('node:fs');
const path = require('node:path');
const output = path.resolve(process.argv[2]);
fs.mkdirSync(output, {recursive:true});
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
    if(process.env.CAPTURE_LOCALE) await page.addInitScript(locale=>localStorage.setItem('legion.language',locale),process.env.CAPTURE_LOCALE);
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    page.on('pageerror',error=>console.error(error));
    const visit = async (route) => {await page.goto('http://127.0.0.1:8084'+route);await page.waitForTimeout(3500);await page.evaluate(()=>document.fonts.ready);}
    const save = async (name,selector) => {await page.mouse.move(1910,1060);await page.waitForTimeout(400);await (selector?page.locator(selector):page).screenshot({path:path.join(output,name+'.png')});console.log('Captured',name);}
    for(let i=1;i<=3;i++) {
      await visit('/game/press?press='+i);
      await save(`Emberhall-Gameplay-0${i}-1920x1080`);

    }
    await visit('/team?press=1');
    await save('Emberhall-Squad-And-Inventory-1920x1080');
    await save('Emberhall-UI-Inventory-And-Equipment','.character-inventory-container');
    await save('Emberhall-UI-Character-Stats','.team-content-card-container');
    await visit('/shop/spells?press=1');
    await save('Emberhall-Spell-Shop-1920x1080');
    await visit('/team?press=1&roster=3');
    await save('Emberhall-UI-Starter-Team','.party-hall');
    await visit('/team?press=1&roster=4');
    await save('Emberhall-UI-Four-Character-Team','.party-hall');
    await page.setViewportSize({width:1920,height:1600});
    await visit('/shop/spells?press=1');
    await save('Emberhall-UI-Elemental-Spell-Cards','.spells-section:first-child');
    await page.locator('.spells-section').last().scrollIntoViewIfNeeded();
    const clip=await page.locator('.spells-section').evaluateAll(sections=>{
      const first=sections[1].getBoundingClientRect(),last=sections.at(-1).getBoundingClientRect();
      return {x:first.x,y:first.y,width:first.width,height:last.bottom-first.top};
    });
    await page.screenshot({path:path.join(output,'Emberhall-UI-Support-Spell-Cards.png'),clip});
    await page.setViewportSize({width:1920,height:1080});
    await visit('/play?press=1');
    while(await page.getByRole('button',{name:'Dismiss',exact:true}).isVisible().catch(()=>false)) {
      await page.getByRole('button',{name:'Dismiss',exact:true}).click();await page.waitForTimeout(300);
    }
    const modesClip=await page.locator('.playModesRow').evaluate(row=>{
      const rects=[...row.querySelectorAll('.buttonContainer,.mode-icon')].map(el=>el.getBoundingClientRect());
      const x=Math.min(...rects.map(r=>r.left))-8,y=Math.min(...rects.map(r=>r.top))-8;
      return {x,y,width:Math.max(...rects.map(r=>r.right))-x+8,height:Math.max(...rects.map(r=>r.bottom))-y+8};
    });
    await page.screenshot({path:path.join(output,'Emberhall-UI-Game-Modes.png'),clip:modesClip});
    await visit('/rank?press=1&ranking');await save('Emberhall-UI-Leaderboard');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
