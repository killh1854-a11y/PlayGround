(() => {
  'use strict';
  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const ui = { altitude: $('altitudeValue'), remaining: $('remainingValue'), gems: $('crystalValue'), fill: $('altFill'), stamina: $('staminaFill'), hint: $('staminaHint'), intro: $('introScreen'), result: $('resultScreen'), resultTitle: $('resultTitle'), resultKicker: $('resultKicker'), resultCopy: $('resultCopy'), resultAlt: $('resultAltitude'), resultGems: $('resultGems'), best: $('bestRun'), toast: $('toast') };
  const MAX_Y = 1000;
  let W = 0, H = 0, dpr = 1, last = 0, toastTimer = 0, state = 'intro', muted = false, audio = null;
  let run = freshRun();
  const input = { left: false, right: false, climb: false };
  const rand = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  function freshRun() { return { y: 0, lane: 0, stamina: 100, gems: 0, shake: 0, flash: 0, steps: 0, collected: new Set(), hit: new Set(), particles: [], startAt: 0, checkpoint: 0 }; }
  function resize() { const r = canvas.getBoundingClientRect(); W = r.width; H = r.height; dpr = Math.min(window.devicePixelRatio || 1, 2); canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  window.addEventListener('resize', resize); resize();
  function ground(y) { return y * .65 + Math.sin(y * .047) * .22 + Math.sin(y * .013) * .45; }
  function route(y) { return Math.sin(y * .0105) * 4.2 + Math.sin(y * .027 + .8) * 1.4; }
  function camera() { return { y: run.y - 12, z: ground(run.y) + 7.6 }; }
  function project(x, y, z) {
    const c = camera();
    const dep = 13.2 + (y - c.y) * .84 + (z - c.z) * .54;
    if (dep < 1) return { x: -10000, y: -10000, s: 0, d: dep };
    const s = H * .83 / dep;
    const up = (y - c.y) * .54 + (z - c.z) * .84;
    return { x: W * .5 + x * s, y: H * .48 - up * s, s, d: dep };
  }
  function pathPoint(lane, y, z = ground(y) + .08) { return [route(y) + lane, y, z]; }
  const obstacles = [], crystals = [];
  for (let y = 24, i = 0; y < 1020; y += 20 + rand(i + 9) * 13, i++) {
    if (rand(i + 3) > .3) obstacles.push({ y, lane: (rand(i + 11) - .5) * 7.5, type: rand(i + 33) > .45 ? 'rock' : 'ice', id: 'o' + i, size: .8 + rand(i + 41) * .5 });
    if (i % 2 === 0 || rand(i + 88) > .57) crystals.push({ y: y + 8 + rand(i + 55) * 6, lane: (rand(i + 66) - .5) * 6.3, id: 'g' + i });
  }
  function drawPoly(points, fill, stroke = null, line = 1) { ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = line; ctx.stroke(); } }
  function gradientSky() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#7da8bb'); g.addColorStop(.38, '#b8d2d3'); g.addColorStop(.69, '#e8d9bf'); g.addColorStop(1, '#a7b9b1');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(W * .73, H * .19, 0, W * .73, H * .19, H * .52);
    glow.addColorStop(0, '#fff3d4a3'); glow.addColorStop(.22, '#fff1d444'); glow.addColorStop(1, '#fff3d400'); ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
    const sun = ctx.createRadialGradient(W * .73, H * .19, 2, W * .73, H * .19, 28); sun.addColorStop(0, '#fff8df'); sun.addColorStop(.32, '#ffedc5d9'); sun.addColorStop(1, '#ffedc500'); ctx.fillStyle = sun; ctx.beginPath(); ctx.arc(W * .73, H * .19, 28, 0, Math.PI * 2); ctx.fill();
    drawDistantMountains();
  }
  function drawDistantMountains() {
    const horizon = H * .51;
    for (let layer = 0; layer < 3; layer++) {
      const base = horizon + layer * H * .048;
      const pts = [{ x: 0, y: H }];
      for (let i = 0; i <= 12; i++) {
        const x = i * W / 12;
        let peak = base - H * (.18 + rand(i + layer * 17) * .21);
        if (i % 3 === layer) peak -= H * .12;
        pts.push({ x, y: peak });
        pts.push({ x: x + W / 24, y: peak + H * (.08 + rand(i + layer * 29) * .1) });
      }
      pts.push({ x: W, y: H });
      drawPoly(pts, ['#839e9e','#758c8e','#65797d'][layer]);
      // Snow facets on the ridges.
      ctx.globalAlpha = .65 - layer * .12;
      for (let i = 0; i < 12; i += 3) {
        const x = i * W / 12, peak = base - H * (.18 + rand(i + layer * 17) * .21) - (i % 3 === layer ? H * .12 : 0);
        drawPoly([{x,y:peak},{x:x+W/24,y:peak+H*.09},{x:x+W/24+W/36,y:peak+H*.03}], '#e5e8dc');
      }
      ctx.globalAlpha = 1;
    }
    const mist = ctx.createLinearGradient(0, horizon - 40, 0, horizon + H * .12); mist.addColorStop(0, '#e9e4d400'); mist.addColorStop(.68, '#e8e4d977'); mist.addColorStop(1, '#e8e4d900'); ctx.fillStyle = mist; ctx.fillRect(0, horizon - 40, W, H * .2);
  }
  function terrainHeight(offset, y) {
    const p = ground(y);
    const fall = Math.max(0, Math.abs(offset) - 4.5) * .39;
    return p - fall + Math.sin(y * .16 + offset * .43) * .13 + Math.cos(offset * .32 + y * .09) * .16;
  }
  function drawTerrain() {
    const strips = [-34,-25,-18,-12,-8,-4.5,0,4.5,8,12,18,25,34];
    const cells = [];
    const start = Math.floor((run.y - 36) / 5) * 5;
    for (let y = start; y < run.y + 60; y += 5) {
      for (let j = 0; j < strips.length - 1; j++) {
        const a = strips[j], b = strips[j + 1], cy = y + 2.5;
        const coords = [[a,y],[b,y],[b,y+5],[a,y+5]];
        const ps = coords.map(([off, yy]) => { const z = terrainHeight(off, yy); return project(route(yy) + off, yy, z); });
        const d = ps.reduce((v,p)=>v+p.d,0)/4;
        const off = (a+b)/2;
        let col;
        const n = Math.sin(y * .23 + j * 2.1) + Math.cos(y * .08 - j * 1.3);
        if (Math.abs(off) < 4.55) col = n > .55 ? '#a9a89a' : n < -.9 ? '#777f7b' : '#92948b';
        else if (Math.abs(off) < 9) col = n > .35 ? '#727c79' : '#626f70';
        else col = n > .5 ? '#687779' : '#536368';
        cells.push({ ps, d, col, off, y });
      }
    }
    cells.sort((a,b)=>b.d-a.d);
    cells.forEach(cell => {
      // Crackle each quad into subtle facets to keep the slope dimensional.
      const p=cell.ps, shade=(Math.sin(cell.y*.51+cell.off*2)*.5);
      drawPoly([p[0],p[1],p[2]], cell.col);
      drawPoly([p[0],p[2],p[3]], shade > .1 ? cell.col : '#536367');
      if (Math.abs(cell.off) < 4.55 && rand(Math.floor(cell.y*2)+Math.floor(cell.off*5)) > .84) {
        const q = p[0], r = p[2]; ctx.strokeStyle='#d5cec0';ctx.globalAlpha=.22;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(q.x,q.y);ctx.lineTo((q.x+r.x)/2+4,(q.y+r.y)/2+1);ctx.stroke();ctx.globalAlpha=1;
      }
    });
    // Snow shelves tucked into the upper rock faces.
    for (let y = start; y < run.y + 48; y += 14) {
      for (const side of [-1,1]) {
        if (rand(y + side * 4) < .42) continue;
        const off = side * (11 + rand(y + side * 21) * 13), yy = y + rand(y + 1) * 5;
        const pts = [[off,yy],[off+side*2,yy+1.8],[off-side*1.2,yy+2.6]].map(([o,v])=>project(route(v)+o,v,terrainHeight(o,v)+.06));
        drawPoly(pts, '#d6d9cd');
      }
    }
    drawTrailEdges(start);
  }
  function drawTrailEdges(start) {
    for (const side of [-1,1]) {
      const pts=[];
      for(let y=start;y<run.y+63;y+=3){const off=side*4.5;pts.push(project(route(y)+off,y,ground(y)+.095));}
      if(pts.length>1){ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);pts.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));ctx.strokeStyle='#c6bda8a0';ctx.lineWidth=Math.max(1,H/750);ctx.stroke();}
    }
  }
  function drawTree(x,y,scale) {
    const z=terrainHeight(x-route(y),y), base=project(x,y,z), s=base.s*scale;
    if(s<2||base.y>H+100||base.y<-200)return;
    const h=s*1.55, w=s*.6;
    ctx.fillStyle='#594d3f';ctx.fillRect(base.x-s*.055,base.y-h*.27,s*.11,h*.31);
    drawPoly([{x:base.x,y:base.y-h},{x:base.x-w*.67,y:base.y-h*.46},{x:base.x-w*.34,y:base.y-h*.48},{x:base.x-w,y:base.y-h*.11},{x:base.x+w,y:base.y-h*.11},{x:base.x+w*.36,y:base.y-h*.48},{x:base.x+w*.64,y:base.y-h*.47}], '#334e4c');
    drawPoly([{x:base.x,y:base.y-h},{x:base.x-w*.67,y:base.y-h*.46},{x:base.x,y:base.y-h*.53}], '#78918a');
    drawPoly([{x:base.x,y:base.y-h*.66},{x:base.x-w*.98,y:base.y-h*.11},{x:base.x,y:base.y-h*.2}], '#49655f');
  }
  function drawScenery() {
    const near=Math.floor((run.y-35)/6)*6;
    for(let y=near;y<run.y+56;y+=6){for(const side of [-1,1]){
      const key=Math.floor(y/6)+side*30;
      if(rand(key*2.7+side*9)>.45){const off=side*(8+rand(key+5)*22), xx=route(y)+off;drawTree(xx,y, .58+rand(key+7)*.65);}
      if(rand(key+52)>.55){const off=side*(7+rand(key+14)*23), z=terrainHeight(off,y); const p=project(route(y)+off,y,z);const s=p.s*(.24+rand(key+78)*.3); if(s>1&&p.y<H+40){ctx.fillStyle='#64716e';ctx.beginPath();ctx.ellipse(p.x,p.y-s*.15,s,s*.45,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#87928a';ctx.beginPath();ctx.ellipse(p.x-s*.18,p.y-s*.22,s*.54,s*.2,-.25,0,Math.PI*2);ctx.fill();}}
    }}
  }
  function drawRock(o) {
    const [x,y,z]=pathPoint(o.lane,o.y), p=project(x,y,z), s=p.s*o.size;
    if(p.d<0||p.y>H+120||p.y<-180)return;
    const shadow=project(x,y,z+.03);ctx.fillStyle='#26363b55';ctx.beginPath();ctx.ellipse(shadow.x,shadow.y,s*1.25,s*.37,0,0,Math.PI*2);ctx.fill();
    drawPoly([{x:p.x-s*.88,y:p.y},{x:p.x-s*.83,y:p.y-s*.48},{x:p.x-s*.34,y:p.y-s*.84},{x:p.x+s*.26,y:p.y-s*.76},{x:p.x+s*.83,y:p.y-s*.37},{x:p.x+s*.92,y:p.y-s*.06}], o.type==='ice'?'#9db9b5':'#596568', '#c4c6b8', Math.max(1,p.s*.025));
    drawPoly([{x:p.x-s*.34,y:p.y-s*.84},{x:p.x+s*.26,y:p.y-s*.76},{x:p.x+s*.83,y:p.y-s*.37},{x:p.x+s*.17,y:p.y-s*.45}], o.type==='ice'?'#d0e0d5':'#858e89');
    drawPoly([{x:p.x-s*.83,y:p.y-s*.48},{x:p.x-s*.34,y:p.y-s*.84},{x:p.x+s*.17,y:p.y-s*.45},{x:p.x-s*.28,y:p.y-s*.33}], o.type==='ice'?'#b9d1cc':'#707a77');
    if(o.type==='ice'){ctx.strokeStyle='#eff4e5';ctx.globalAlpha=.7;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(p.x-s*.18,p.y-s*.65);ctx.lineTo(p.x+s*.28,p.y-s*.15);ctx.stroke();ctx.globalAlpha=1;}
  }
  function drawGem(g) {
    const [x,y,z]=pathPoint(g.lane,g.y,ground(g.y)+.4+Math.sin(performance.now()*.003+g.y)*.13), p=project(x,y,z), s=p.s*.23;
    if(p.y>H+60||p.y<-100||p.d<0)return;
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.sin(performance.now()*.002+g.y)*.12);ctx.shadowColor='#ffe28b';ctx.shadowBlur=s*1.5;
    drawPoly([{x:0,y:-s},{x:s*.7,y:-s*.2},{x:s*.4,y:s*.72},{x:-s*.4,y:s*.72},{x:-s*.7,y:-s*.2}], '#f5d17b','#fff1bb',Math.max(1,s*.06));
    drawPoly([{x:0,y:-s},{x:0,y:s*.72},{x:-s*.7,y:-s*.2}], '#fff0bd');ctx.restore();
  }
  function drawPlayer(time) {
    const y=run.y, lane=run.lane, x=route(y)+lane, z=ground(y)+.1, p=project(x,y,z), s=p.s;
    const wobble=Math.sin(time*.009)*Math.min(1,run.steps*.2), gait=state==='playing'&&input.climb?Math.sin(time*.017)*.15:Math.sin(time*.003)*.025;
    if(p.y>H+200)return;
    ctx.fillStyle='#1f303a55';ctx.beginPath();ctx.ellipse(p.x,p.y+2,s*.3,s*.12,0,0,Math.PI*2);ctx.fill();
    // Backpack silhouette
    const bodyH=s*1.02, bodyW=s*.34, head=s*.13;
    const shoulderY=p.y-bodyH*.62, hipY=p.y-bodyH*.22;
    // Legs, drawn as hiking trousers and boots.
    ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#273943';ctx.lineWidth=Math.max(2,s*.12);
    ctx.beginPath();ctx.moveTo(p.x-s*.07,hipY);ctx.lineTo(p.x-s*.13+gait*s, p.y-s*.02);ctx.lineTo(p.x-s*.22+gait*s,p.y);ctx.stroke();
    ctx.beginPath();ctx.moveTo(p.x+s*.07,hipY);ctx.lineTo(p.x+s*.13-gait*s,p.y-s*.04);ctx.lineTo(p.x+s*.22-gait*s,p.y);ctx.stroke();
    ctx.strokeStyle='#d8d2c3';ctx.lineWidth=Math.max(2,s*.105);ctx.beginPath();ctx.moveTo(p.x-s*.2+gait*s,p.y);ctx.lineTo(p.x-s*.09+gait*s,p.y);ctx.moveTo(p.x+s*.13-gait*s,p.y-s*.04);ctx.lineTo(p.x+s*.25-gait*s,p.y-s*.04);ctx.stroke();
    // torso, pack and shoulders
    drawPoly([{x:p.x-bodyW*.56,y:shoulderY+s*.04},{x:p.x-bodyW*.34,y:p.y-bodyH*.32},{x:p.x-bodyW*.25,y:hipY},{x:p.x+bodyW*.29,y:hipY},{x:p.x+bodyW*.42,y:p.y-bodyH*.38},{x:p.x+bodyW*.54,y:shoulderY}], '#e97955');
    drawPoly([{x:p.x+s*.1,y:shoulderY+s*.03},{x:p.x+s*.33,y:shoulderY+s*.14},{x:p.x+s*.29,y:p.y-bodyH*.27},{x:p.x+s*.11,y:p.y-bodyH*.3}], '#344c50');
    ctx.strokeStyle='#ebd9b8';ctx.lineWidth=Math.max(2,s*.08);
    const armLift=input.climb?Math.cos(time*.01)*s*.13:0;
    ctx.beginPath();ctx.moveTo(p.x-bodyW*.47,shoulderY+s*.08);ctx.lineTo(p.x-s*.42,shoulderY+s*.24-armLift);ctx.lineTo(p.x-s*.48,shoulderY+s*.04-armLift);ctx.moveTo(p.x+bodyW*.43,shoulderY+s*.08);ctx.lineTo(p.x+s*.4,shoulderY+s*.29+armLift);ctx.lineTo(p.x+s*.45,shoulderY+s*.11+armLift);ctx.stroke();
    ctx.fillStyle='#d9b992';ctx.beginPath();ctx.arc(p.x,shoulderY-head*.25,head,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#34494c';ctx.beginPath();ctx.arc(p.x,shoulderY-head*.43,head*1.04,Math.PI,Math.PI*2);ctx.lineTo(p.x+head*.8,shoulderY-head*.25);ctx.lineTo(p.x-head*.8,shoulderY-head*.25);ctx.fill();
    if(run.flash>0){ctx.strokeStyle=`rgba(255,235,180,${run.flash})`;ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y-bodyH*.45,s*.54,0,Math.PI*2);ctx.stroke();}
  }
  function drawParticles(dt) {
    for(let i=run.particles.length-1;i>=0;i--){const a=run.particles[i];a.life-=dt;a.x+=a.vx*dt;a.y+=a.vy*dt;if(a.life<=0){run.particles.splice(i,1);continue;}ctx.globalAlpha=Math.min(1,a.life*1.5);ctx.fillStyle=a.color;ctx.beginPath();ctx.arc(a.x,a.y,a.size,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}
    if(Math.random()<.1){run.particles.push({x:Math.random()*W,y:Math.random()*H*.8,vx:-10-Math.random()*16,vy:-2+Math.random()*4,life:1.2+Math.random(),size:Math.random()*1.5+.4,color:'#fff7dd'});}
  }
  function render(time, dt) {
    ctx.clearRect(0,0,W,H);ctx.save();
    if(run.shake>0){ctx.translate((Math.random()-.5)*run.shake*7,(Math.random()-.5)*run.shake*5);run.shake=Math.max(0,run.shake-dt*3);}
    gradientSky();drawTerrain();drawScenery();
    const activeObs=obstacles.filter(o=>Math.abs(o.y-run.y)<55).sort((a,b)=>b.y-a.y);activeObs.forEach(drawRock);
    crystals.filter(g=>Math.abs(g.y-run.y)<50&&!run.collected.has(g.id)).sort((a,b)=>b.y-a.y).forEach(drawGem);
    drawPlayer(time);drawParticles(dt);ctx.restore();
    if(run.flash>0)run.flash=Math.max(0,run.flash-dt*1.4);
  }
  function start() {
    run=freshRun();run.startAt=performance.now();state='playing';$('gameShell').classList.add('playing');ui.intro.classList.add('hidden');ui.result.classList.add('hidden');$('hud').style.opacity='1';$('staminaWrap').style.opacity='1';
    $('controls').style.opacity='1'; showToast('FIND YOUR RHYTHM · WATCH THE TRAIL'); updateHud();
  }
  function showToast(text) { ui.toast.textContent=text;ui.toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>ui.toast.classList.remove('show'),2100); }
  function finish(won) {
    state='result';input.climb=input.left=input.right=false;$('gameShell').classList.remove('playing');
    const best=Number(localStorage.getItem('peakBest')||0);if(run.y>best)localStorage.setItem('peakBest',String(Math.floor(run.y)));
    ui.resultKicker.textContent=won?'THE SUMMIT':'THE MOUNTAIN';ui.resultTitle.textContent=won?'YOU MADE IT.':'TAKE A BREATH.';ui.resultCopy.textContent=won?'The whole world, held in a single breath.':'Every climb leaves you a little higher. The peak is still there.';ui.resultAlt.textContent=`${Math.floor(run.y).toLocaleString()} M`;ui.resultGems.textContent=run.gems;ui.result.classList.remove('hidden');updateBest();
  }
  function updateBest() { const b=Number(localStorage.getItem('peakBest')||0);ui.best.innerHTML=`BEST ASCENT <b>${b?b.toLocaleString()+' M':'—'}</b>`; }
  function updateHud() { const alt=Math.floor(run.y);ui.altitude.textContent=alt.toLocaleString();ui.remaining.innerHTML=`${Math.max(0,MAX_Y-alt).toLocaleString()} <small>M</small>`;ui.gems.textContent=run.gems;ui.fill.style.width=`${Math.min(100,run.y/MAX_Y*100)}%`;ui.stamina.style.width=`${run.stamina}%`;ui.stamina.style.background=run.stamina<25?'#ed8069':'#f2d189';ui.hint.textContent=run.stamina<20?'REST A MOMENT':input.climb?'KEEP MOVING':'HOLD TO CLIMB'; }
  function update(dt,time) {
    if(state==='playing'){
      const steerdir=(input.right?1:0)-(input.left?1:0);run.lane=Math.max(-4.05,Math.min(4.05,run.lane+steerdir*dt*5.2));
      if(input.climb&&run.stamina>0){const power=.3+.7*run.stamina/100;run.y+=dt*10.8*power;run.stamina=Math.max(0,run.stamina-dt*10.8);run.steps+=dt*7;}
      else run.stamina=Math.min(100,run.stamina+dt*(run.stamina<100?17:0));
      run.lane*=Math.max(0,1-dt*.3);
      for(const o of obstacles){if(Math.abs(o.y-run.y)<1.15&&Math.abs(o.lane-run.lane)<o.size+0.35&&!run.hit.has(o.id)){run.hit.add(o.id);run.stamina=Math.max(0,run.stamina-24);run.y=Math.max(0,run.y-2.7);run.shake=.9;run.flash=1;showToast(o.type==='ice'?'SLIPPERY! · FIND YOUR FOOTING':'ROCKFALL! · KEEP YOUR BALANCE');sound(120,.09);}}
      for(const g of crystals){if(Math.abs(g.y-run.y)<1.35&&Math.abs(g.lane-run.lane)<1.25&&!run.collected.has(g.id)){run.collected.add(g.id);run.gems++;run.stamina=Math.min(100,run.stamina+9);showToast('ALPINE CRYSTAL +1');sound(660,.08);}}
      if(Math.floor(run.y/250)>run.checkpoint){run.checkpoint=Math.floor(run.y/250);if(run.checkpoint>0)showToast('CHECKPOINT · '+run.y.toFixed(0)+' M');}
      if(run.y>=MAX_Y){run.y=MAX_Y;finish(true);}
      updateHud();
    }
    render(time,dt);
  }
  function loop(t){const dt=Math.min(.04,(t-last)/1000||0);last=t;update(dt,t);requestAnimationFrame(loop);}requestAnimationFrame(loop);
  function bindHold(id,key){const el=$(id);const down=e=>{e.preventDefault();input[key]=true;el.classList.add('pressed');try{el.setPointerCapture(e.pointerId);}catch(_){}};const up=e=>{if(e)e.preventDefault();input[key]=false;el.classList.remove('pressed');};el.addEventListener('pointerdown',down);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);el.addEventListener('lostpointercapture',up);}
  bindHold('leftBtn','left');bindHold('rightBtn','right');bindHold('climbBtn','climb');
  window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k))e.preventDefault();if(k==='arrowleft'||k==='a')input.left=true;if(k==='arrowright'||k==='d')input.right=true;if(k==='arrowup'||k==='w'||k===' ')input.climb=true;if(k==='enter'&&state!=='playing')start();});
  window.addEventListener('keyup',e=>{const k=e.key.toLowerCase();if(k==='arrowleft'||k==='a')input.left=false;if(k==='arrowright'||k==='d')input.right=false;if(k==='arrowup'||k==='w'||k===' ')input.climb=false;});
  $('startBtn').addEventListener('click',start);$('againBtn').addEventListener('click',start);
  $('soundBtn').addEventListener('click',()=>{muted=!muted;$('soundBtn').textContent=muted?'×':'♫';if(!muted)sound(440,.07);});
  function sound(freq,duration){if(muted)return;try{audio=audio||new(window.AudioContext||window.webkitAudioContext)();const osc=audio.createOscillator(),gain=audio.createGain();osc.type='sine';osc.frequency.value=freq;gain.gain.setValueAtTime(.035,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);osc.connect(gain);gain.connect(audio.destination);osc.start();osc.stop(audio.currentTime+duration);}catch(_){}}
  updateBest();
})();
