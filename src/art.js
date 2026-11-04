const actors = ['squirtle_lateral','squirtle_frente','sprite_invitado','pikachu','bulbasaur','charmander','eevee','psyduck','pastel','regalos','llama_vela_1','llama_vela_2'];
const effects = ['zubat','voltorb','drop','bubble','wheel','emitter','geyser','jet','checkpoint'];
const backgrounds = ['day','forest-1','forest-2','forest-3','forest-4','night','party-1','party-2','party-3','party-4'];
export class Art {
  constructor() { this.images={}; this.meta={}; this.ready=false; }
  async load() {
    const response=await fetch(new URL('../assets/art/atlas.json',import.meta.url));
    if(!response.ok) throw Error('No se pudo cargar el atlas de personajes');
    this.meta=(await response.json()).assets;
    const urls={map:'./assets/mapa-aventura.png'};
    for(const name of actors) urls[name]=`./assets/art/${name}.png`;
    for(const name of effects) urls[name]=`./assets/effects/${name}.png`;
    for(const name of ['grass','dirt','wood','water']) urls[name]=`./assets/art/terrain-${name}.png`;
    for(const name of backgrounds) urls[name]=`./assets/backgrounds/${name}.png`;
    await Promise.all(Object.entries(urls).map(([name,url])=>new Promise((resolve,reject)=>{
      const image=new Image();image.onload=()=>{this.images[name]=image;resolve();};
      image.onerror=()=>name==='map'?resolve():reject(Error(`Falta el recurso ${name}`));image.src=new URL(url.replace('./assets/','../assets/'),import.meta.url).href;
    })));
    this.ready=true;
  }
  sprite(ctx,name,x,feet,height,frame=0,flip=false,alpha=1) {
    const image=this.images[name];if(!image)return;
    const meta=this.meta[name];
    const [cw,ch]=meta?.frame_size || [image.naturalWidth,image.naturalHeight];
    const columns=meta?.columns || 1; const count=(meta?.rows||1)*columns;
    frame=((Math.floor(frame)%count)+count)%count;
    const width=height*cw/ch;
    ctx.save();ctx.globalAlpha*=alpha;ctx.imageSmoothingEnabled=false;
    ctx.translate(x,feet);if(flip)ctx.scale(-1,1);
    ctx.drawImage(image,(frame%columns)*cw,Math.floor(frame/columns)*ch,cw,ch,-width/2,-height,width,height);
    ctx.restore();
  }
  image(ctx,name,x,y,w,h) { const im=this.images[name];if(im)ctx.drawImage(im,x,y,w,h); }
  tile(ctx,name,x,y,w,h,size=80) {
    const image=this.images[name];if(!image||w<=0||h<=0)return;
    ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.imageSmoothingEnabled=false;
    const th=size*image.naturalHeight/image.naturalWidth;
    for(let xx=x;xx<x+w;xx+=size)for(let yy=y;yy<y+h;yy+=th)ctx.drawImage(image,xx,yy,size,th);
    ctx.restore();
  }
}
