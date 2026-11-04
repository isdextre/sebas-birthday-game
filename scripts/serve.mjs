import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();
const index=process.argv.indexOf('--port');
const port=Number(process.env.PORT || (index>=0?process.argv[index+1]:5000));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg','.mp3':'audio/mpeg','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8'};
http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');const pathname=decodeURIComponent(url.pathname);
  if(pathname.split('/').some(part=>part.startsWith('.'))){res.writeHead(403);return res.end();}
  if(pathname!=='/'&&!/^\/(assets|src|tests)\//.test(pathname)&&!['/index.html','/styles.css','/favicon.svg'].includes(pathname)){res.writeHead(404);return res.end();}
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  const data=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(data);
 }catch{res.writeHead(404);res.end('Archivo no encontrado');}
}).listen(port,'0.0.0.0',()=>console.log(`Juego en http://localhost:${port}`));
