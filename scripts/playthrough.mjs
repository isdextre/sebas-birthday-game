import {BirthdayGame} from '../src/game.js';
import {LEVEL} from '../src/level.js';
const g=new BirthdayGame({getContext:()=>null});g.start();
let previous=0,stuck=0,last=0,activeGift=null,activeAction=null;
for(let i=0;i<120000 && g.status!=='party';i++){
 const p=g.player;
 const gate=LEVEL.gates.find(v=>v.x>p.x-35&&v.x<p.x+440&&(v.requires?!g.isActionComplete(v.requires):!g.collectedGifts.has(v.requiresGift)));
 let axis=1,jump=p.onGround||p.vy<0;
 if(gate?.requires) activeAction=gate.requires;
 if(activeAction && g.isActionComplete(activeAction)) activeAction=null;
 if(activeAction){
  const target=LEVEL.targets.filter(t=>t.action===activeAction&&(g.hitTargets.get(t.id)||0)<t.hits).sort((a,b)=>Math.abs(a.x-p.x)-Math.abs(b.x-p.x))[0];
  if(target){
   const dx=target.x-(p.x+16);
   if(Math.abs(dx)<290){axis=Math.sign(dx);if(Math.abs(dx)<130)axis=0; p.facing=Math.sign(dx)||1;
    jump=(target.y<p.y-15&&p.onGround)||p.vy<0;
   }else axis=Math.sign(dx);
  }
 }
 if(gate?.requiresGift)activeGift=gate.requiresGift;
 if(activeGift&&g.collectedGifts.has(activeGift))activeGift=null;
 if(activeGift){const gift=LEVEL.gifts.find(v=>v.color===activeGift);const dx=gift.x+21-(p.x+16);axis=Math.abs(dx)>8?Math.sign(dx):0;jump=p.y+42>gift.y+42&&(p.onGround||p.vy<0);}
 g.setInput('left',axis<0);g.setInput('right',axis>0);
 g.setInput('jump',p.flightActive?p.y>240:jump || p.inWater);
 g.setInput('water',i%24===0);g.setInput('shield',i%500===0);
 g.step(1/60);
 if(i%600===0){console.log(Math.round(i/60),Math.floor(p.x/960),Math.round(p.x),Math.round(p.y),'gifts',g.collectedGifts.size);if(Math.abs(p.x-last)<50)stuck++;else stuck=0;last=p.x;if(stuck>3)break;}
}
console.log('RESULT',g.status,'screen',g.player.x/960,'gifts',[...g.collectedGifts],'mechanisms',[...g.hitTargets]);
process.exitCode=g.status==='party'?0:1;
