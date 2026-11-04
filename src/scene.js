import { CONFIG } from './config.js';
import { LEVEL } from './level.js';

const visible=(g,x,w=100)=>x+w>g.cameraX-100&&x<g.cameraX+g.viewWidth+100;
function text(ctx,value,x,y,size=18,color='#fff6d5',align='left'){
 ctx.save();ctx.textAlign=align;ctx.font=`bold ${size}px Pixelify,monospace`;ctx.lineJoin='round';ctx.lineWidth=5;
 ctx.strokeStyle='#102f36';ctx.strokeText(value,x,y);ctx.fillStyle=color;ctx.fillText(value,x,y);ctx.restore();
}
function background(g,ctx,party=false){
 const art=g.art,w=g.viewWidth;
 const name=party?'night':g.backgroundKeyForScreen(Math.floor(g.player.x/CONFIG.world.screenWidth));
 const im=name?art.images[name]:null;
 // Each screen keeps a single fixed composition (never cycled as wind frames); the ruins stretch has no photo yet, so it gets a drawn backdrop instead of a blank frame.
 if(im){const scale=Math.max(w/im.naturalWidth,540/im.naturalHeight);ctx.drawImage(im,(w-im.naturalWidth*scale)/2,(540-im.naturalHeight*scale)/2,im.naturalWidth*scale,im.naturalHeight*scale);}
 else ruinsBackdrop(g,ctx,w);
}
function ruinsBackdrop(g,ctx,w){
 const grad=ctx.createLinearGradient(0,0,0,540);
 grad.addColorStop(0,'#17424d');grad.addColorStop(.6,'#0f2b34');grad.addColorStop(1,'#0a1a20');
 ctx.fillStyle=grad;ctx.fillRect(0,0,w,540);
 const drift=g.cameraX*0.12,t=g.worldTime||0;
 ctx.save();ctx.globalAlpha=.4;
 for(let i=-1;i<Math.ceil(w/150)+1;i++){
  const x=i*150-(drift%150),height=120+(((i*71)%90+90)%90);
  ctx.fillStyle=i%2?'#1c4a54':'#133840';
  ctx.fillRect(x,540-height,86,height);
  ctx.fillStyle='#0a2127';
  ctx.fillRect(x+10,540-height-14,66,16);
 }
 ctx.restore();
 ctx.save();ctx.strokeStyle='#ffe07a';ctx.lineWidth=2;
 for(let i=0;i<3;i++){
  ctx.beginPath();
  const baseY=130+i*90;
  for(let x=0;x<=w;x+=48) ctx.lineTo(x, baseY+Math.sin(x*0.045+i*2+t*1.6)*10);
  ctx.globalAlpha=Math.max(.04,.1+Math.sin(t*2+i)*.05);
  ctx.stroke();
 }
 ctx.restore();
}
export function renderCover(g,ctx){
 const art=g.art,t=g.menuTime||0,w=g.viewWidth;
 const map=art.images.map||art.images.day;
 if(map){const zoom=1.035+Math.sin(t*.12)*.01;const factor=Math.max(w/map.naturalWidth,540/map.naturalHeight)*zoom;const dw=map.naturalWidth*factor,dh=map.naturalHeight*factor;
  ctx.drawImage(map,(w-dw)/2+Math.sin(t*.15)*3,(540-dh)/2,dw,dh);}
 const x=w*.33+Math.sin(t*.5)*7,feet=440;
 art.sprite(ctx,'squirtle_frente',x,feet+Math.sin(t*2)*3,105,Math.floor(t*3)%4);
 art.sprite(ctx,'pikachu',w*.77,230,45,Math.floor(t*3)%4);
 art.sprite(ctx,'eevee',w*.86,240,43,Math.floor(t*3+.6)%4);
 for(let i=0;i<22;i++){
  const xx=(i*131+Math.sin(t*.4+i)*15)%w,yy=100+(i*79)%340+Math.sin(t+i)*6;
  art.sprite(ctx,'drop',xx,yy,5+Math.sin(t+i)*1.5,0,false,.28);
 }
}
export function renderWorld(g,ctx){
 const art=g.art,t=g.worldTime,camera=g.cameraX;
 if(!art?.ready)return;
 if(g.status==='cover'){renderCover(g,ctx);return;}
 background(g,ctx);
 ctx.save();ctx.translate(-camera,0);
 for(const zone of LEVEL.water)if(visible(g,zone.x,zone.w)){
  ctx.save();ctx.globalAlpha=.87;art.tile(ctx,'water',zone.x,zone.y,zone.w,540-zone.y,150);ctx.restore();
 }
 for(const p of g.platforms)if(visible(g,p.x,p.w)){
  if(p.kind==='water-bottom')continue;
  if(p.kind==='floor'){
   art.tile(ctx,'dirt',p.x,p.y+30,p.w,540-p.y,96);
   art.tile(ctx,'grass',p.x,p.y,p.w,96,96);
  }else art.tile(ctx,'wood',p.x,p.y,p.w,Math.max(26,p.h),100);
 }
 for(const cp of LEVEL.checkpoints)if(visible(g,cp.x))art.sprite(ctx,'checkpoint',cp.x,452,50,0,false,g.checkpointIds.has(cp.id)?1:.55);
 for(const hazard of [...LEVEL.hazards,...(LEVEL.emitters||[])])if(visible(g,hazard.x,hazard.w)){
  const phase=(t+hazard.phase)%hazard.period, active=phase>=hazard.period-1,warning=phase>=hazard.period-2;
  art.sprite(ctx,'emitter',hazard.x+hazard.w/2,hazard.y+hazard.h,active?64:50,0,false,warning?1:.7);
  if(warning){text(ctx,active?'¡DESCARGA!':'¡CUIDADO!',hazard.x+hazard.w/2,hazard.y-22,12,'#ffdd70','center');}
 }
 for(const target of LEVEL.targets)if(visible(g,target.x)){
  const done=(g.hitTargets.get(target.id)||0)>=target.hits;
  ctx.save();ctx.translate(target.x,target.y);ctx.rotate(done?t*.9:0);
  art.sprite(ctx,'wheel',0,24,55);ctx.restore();
  if(!done)text(ctx,target.hits===2?`${g.hitTargets.get(target.id)||0}/2`:'J / AGUA',target.x,target.y-35,11,'#ffe388','center');
 }
 for(const gate of LEVEL.gates)if(visible(g,gate.x)){
  const open=gate.requires?g.isActionComplete(gate.requires):g.collectedGifts.has(gate.requiresGift);
  if(!open)art.tile(ctx,'wood',gate.x,gate.y,24,gate.h,50);
 }
 for(const d of LEVEL.drops)if(!g.collectedDrops.has(d.id)&&visible(g,d.x))art.sprite(ctx,'drop',d.x,d.y+10+Math.sin(t*3+d.x)*3,22,0,false,d.optional?.78:1);
 for(const gift of LEVEL.gifts)if(!g.collectedGifts.has(gift.color)&&visible(g,gift.x)){
  art.sprite(ctx,'regalos',gift.x+21,gift.y+42+Math.sin(t*3)*3,51,['rojo','azul','amarillo'].indexOf(gift.color));
 }
 for(const enemy of g.enemies)if(visible(g,enemy.x)){
  const stunned=g.stunnedEnemies.has(enemy.id);
  ctx.save();if(stunned)ctx.globalAlpha=.55;
  const size=enemy.type==='zubat'?48:42;
  ctx.translate(enemy.x,enemy.y);if(enemy.type==='zubat')ctx.scale(1,1+Math.sin(t*14)*.09);
  art.sprite(ctx,enemy.type,0,size/2,size);ctx.restore();
  if(stunned)text(ctx,'z z z',enemy.x,enemy.y-30,12,'#ffecad','center');
 }
 for(const geyser of LEVEL.geysers)if(visible(g,geyser.x))art.sprite(ctx,'geyser',geyser.x+geyser.w/2,geyser.y+geyser.h,75+Math.sin(t*5)*6);
 for(const hoop of LEVEL.hoops)if(visible(g,hoop.x))art.sprite(ctx,'bubble',hoop.x,hoop.y+hoop.r,hoop.r*2,0,false,.65+Math.sin(t*3)*.15);
 for(const jet of g.projectiles)art.sprite(ctx,'jet',jet.x,jet.y+8,20,0,jet.vx<0);
 for(const shot of g.enemyProjectiles||[])art.sprite(ctx,'emitter',shot.x,shot.y+10,22);
 const p=g.player;
 let frame=0;
 if(p.flightActive||!p.onGround&&!p.inWater)frame=p.vy<0?8:10;
 else if(Math.abs(p.vx)>15||p.inWater)frame=4+Math.floor(t*9)%4;
 else frame=Math.floor(t*2)%4;
 const flashing=g.invulnerable>0&&Math.floor(t*10)%2===0;
 if(p.flightActive)art.sprite(ctx,'bubble',p.x+16,p.y+62,86);
 if(!flashing)art.sprite(ctx,'squirtle_lateral',p.x+16,p.y+p.h+4,62,frame,p.facing<0);
 if(g.shieldRemaining>0)art.sprite(ctx,'bubble',p.x+16,p.y+63,86,0,false,.75);
 if(g.lastMessage==='¡Vamooos!'&&g.stageNoticeUntil>t)text(ctx,'¡Vamooos!',p.x+16,p.y-18,18,'#ffe188','center');
 ctx.restore();
 if(g.status==='recovery')text(ctx,'¡Otra ronda!',g.viewWidth/2,250,40,'#ffdf75','center');
 if(g.stageNoticeUntil>t&&g.lastMessage&&g.lastMessage!=='¡Vamooos!')text(ctx,g.lastMessage,g.viewWidth/2,495,14,'#fff1cf','center');
}
export function renderParty(g,ctx){
 const art=g.art,t=g.partyTime,w=g.viewWidth,cx=w/2;
 if(!art?.ready)return;background(g,ctx,true);
 const clap=t>=21, row=clap?8:4;
 const guests=['pikachu','bulbasaur','charmander','eevee','psyduck'];
 const positions=[-.29,-.20,-.11,.13,.23];
 guests.forEach((name,i)=>{
  const bob=clap?0:Math.sin(t*5+i)*3;
  art.sprite(ctx,name,cx+w*positions[i],431+bob,66,row+Math.floor(t*7+i)%4);
 });
 art.sprite(ctx,'sprite_invitado',cx,430+(!clap?Math.sin(t*5)*3:0),87,row+Math.floor(t*7)%4);
 let squirtleX=cx-w*.37,squirtleFeet=460,heroHeight=74;
 if(t<2)squirtleX=-70+(cx-w*.37+70)*Math.min(1,t/2);
 if(t>=10&&t<17){const a=Math.min(1,(t-10)/7);squirtleX+=(cx-squirtleX)*a;squirtleFeet+=a*110;heroHeight+=a*40;}
 if(t<17||t>=23)art.sprite(ctx,'squirtle_frente',t>=23?cx-w*.36:squirtleX,t>=23?463:squirtleFeet,t>=23?74:heroHeight,(t>=10&&t<17?4:row)+Math.floor(t*7)%4);
 if(t>=10&&t<31){
  const progress=Math.min(1,(t-10)/7),cakeHeight=65+progress*190;
  const cakeX=squirtleX+(cx-squirtleX)*progress,feet=440+progress*58;
  art.sprite(ctx,'pastel',cakeX,feet,cakeHeight);
  if(t<21){
   // Ratios measured from the repaired cake, keeping each flame on its wick.
   const cakeWidth=cakeHeight*877/816;
   const flames=[[-.15,.85,'llama_vela_1'],[0,.91,'llama_vela_2'],[.15,.84,'llama_vela_1']];
   for(const [dx,dy,flame]of flames)art.sprite(ctx,flame,cakeX+dx*cakeWidth,feet-dy*cakeHeight,Math.max(13,cakeHeight*.13),Math.floor(t*9)%4);
  }
 }
 if(t>=17&&t<21){text(ctx,'Sopla en',cx,135,32,'#fff6d5','center');if(t>=18)text(ctx,String(3-Math.floor(t-18)),cx,225,72,'#ffdc70','center');}
 else if(t>=23){text(ctx,'¡Feliz cumpleaños,',cx,115,Math.min(38,w/24),'#ffe59c','center');text(ctx,'Sebastián!',cx,165,Math.min(49,w/18),'#fff8dc','center');}
 else if(t>=2&&t<10)text(ctx,'¡Llegaste a tu fiesta!',cx,115,28,'#fff0b9','center');
 if(t>=21)g.drawConfetti(ctx,t);
 if(t>=31&&CONFIG.personalMessage){
  ctx.save();ctx.textAlign='center';ctx.font='18px sans-serif';
  const chars=Array.from(CONFIG.personalMessage),shown=chars.slice(0,Math.floor(chars.length*Math.min(1,(t-31)/9))).join('');
  const lines=[];for(const paragraph of shown.split('\n')){let line='';for(const word of paragraph.split(' ')){if(ctx.measureText(line+' '+word).width>w*.72&&line){lines.push(line);line=word;}else line+=(line?' ':'')+word;}lines.push(line);}
  lines.forEach((line,i)=>text(ctx,line,cx,218+i*25,17,'#fffce7','center'));ctx.restore();
 }
}
