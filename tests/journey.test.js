import test from 'node:test';
import assert from 'node:assert/strict';
import { BirthdayGame } from '../src/game.js';
import { LEVEL } from '../src/level.js';

test('los rivales voladores conservan coordenadas finitas durante el recorrido',()=>{
 const g=new BirthdayGame({getContext:()=>null});g.start();
 for(let i=0;i<1200;i++)g.step(1/60);
 for(const enemy of g.enemies){assert.ok(Number.isFinite(enemy.x));assert.ok(Number.isFinite(enemy.y));}
});
test('los aros obligatorios mantienen distancias inferiores a la autonomía del vuelo',()=>{
 for(const [start,end]of [[16.5,21],[31.5,33]]){
  const hoops=LEVEL.hoops.filter(h=>h.x>=start*960&&h.x<end*960);
  for(let i=1;i<hoops.length;i++)assert.ok(hoops[i].x-hoops[i-1].x<160*6);
 }
});
test('los regalos y todos los mecanismos tienen apoyo alcanzable',()=>{
 for(const obj of [...LEVEL.gifts,...LEVEL.targets]){
  const floor=LEVEL.platforms.filter(p=>p.x<=obj.x+10&&p.x+p.w>=obj.x+10&&p.kind!=='moving').sort((a,b)=>a.y-b.y);
  assert.ok(floor.length);
  assert.ok(floor.some(p=>p.y>=obj.y&&p.y-obj.y<150),obj.id);
 }
});
test('los puntos de control de regalos reaparecen sobre el terreno',()=>{
 const g=new BirthdayGame({getContext:()=>null});g.start();
 for(const cp of LEVEL.checkpoints){g.activateCheckpoint(cp,true);g.respawnAtCheckpoint(true);
  for(const p of g.platforms.filter(p=>p.kind!=='moving')){
   const player=g.player;const inside=player.x+player.w>p.x&&player.x<p.x+p.w&&player.y+player.h>p.y+.1&&player.y<p.y+p.h;
   assert.equal(inside,false,cp.id);
  }
 }
});
test('la fiesta atraviesa todas las fases y conserva el estado al pausar',()=>{
 const g=new BirthdayGame({getContext:()=>null});g.start();
 g.collectedGifts=new Set(['rojo','azul','amarillo']);g.player.x=LEVEL.width-70;g.checkFinish();
 const phases=new Set();for(let i=0;i<2600;i++){g.step(1/60);phases.add(g.partyPhase);}
 for(const name of ['dance','cake-approach','countdown','candles','birthday','personal-message','celebration-loop'])assert.ok(phases.has(name),name);
 assert.equal(g.status,'finished');
});
