export class GameAudio {
 constructor(url,volume=.35){this.music=new Audio(url);this.music.loop=true;this.volume=volume;this.gain=1;this.fade=null;this.failed=false;this.apply();}
 apply(){this.music.volume=this.volume*this.gain;if(this.birthday)this.birthday.volume=this.volume;}
 async start(){try{this.context ||= new (window.AudioContext||window.webkitAudioContext)();await this.context.resume();await this.music.play();this.failed=false;return true;}catch{this.failed=true;return false;}}
 setVolume(v){this.volume=Math.max(0,Math.min(1,v));this.apply();}
 pause(){this.music.pause();this.birthday?.pause();this.context?.suspend();}
 async resume(){try{await this.context?.resume();if(this.inParty&&this.birthday&&!this.birthday.ended)await this.birthday.play();else await this.music.play();return true;}catch{return false;}}
 fadeTo(target,duration=1.4){this.fade={start:this.gain,target:this.volume?Math.max(0,Math.min(1,target/this.volume)):0,elapsed:0,duration};}
 update(dt){if(!this.fade)return;this.fade.elapsed+=dt;const p=Math.min(1,this.fade.elapsed/this.fade.duration);this.gain=this.fade.start+(this.fade.target-this.fade.start)*p;this.apply();if(p===1){this.fade=null;if(this.gain===0)this.music.pause();}}
 party(url){this.inParty=true;this.fade=null;if(url){this.music.pause();this.birthday=new Audio(url);this.birthday.onended=()=>{this.gain=.3;this.apply();this.music.play().catch(()=>{});};this.apply();this.birthday.play().catch(()=>{});}else{this.gain=.5;this.apply();this.music.play().catch(()=>{});}}
 effect(kind){const c=this.context;if(!c||c.state!=='running'||!this.volume)return;const now=c.currentTime;if(kind==='drop'&&now-(this.lastDrop||-10)<.08)return;if(kind==='drop')this.lastDrop=now;
 const [from,to,duration]=({jump:[440,760,.11],drop:[880,1320,.1],gift:[660,1320,.35],water:[550,140,.15],shield:[330,880,.25],hit:[180,70,.2]})[kind]||[520,780,.08];
 const o=c.createOscillator(),gain=c.createGain();o.type=kind==='water'?'triangle':'square';o.frequency.setValueAtTime(from,now);o.frequency.exponentialRampToValueAtTime(to,now+duration);gain.gain.setValueAtTime(.055*this.volume,now);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);o.connect(gain);gain.connect(c.destination);o.start(now);o.stop(now+duration);}
}
