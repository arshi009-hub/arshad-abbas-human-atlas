// Re-encodes the optimized atlas geometry for download size.
// - Positions are quantized on a uniform grid of 0.02% of each structure's largest extent,
//   a tenth of the simplification error; normals use 8-bit octahedral encoding.
// - Triangles and vertices are reordered, then compressed with the meshoptimizer codecs.
// - Chunks are regrouped by anatomical system so the viewer can download the systems
//   that are visible from outside first and stream the rest afterwards.
// Run after scripts/optimize-anatomy.mjs; the gzip pass in this script replaces compress-models.mjs.
import fs from 'node:fs';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {MeshoptEncoder} from 'meshoptimizer/encoder';
import {systemForPart} from '../app/system-classification.mjs';

await MeshoptEncoder.ready;
const dir=new URL('../public/models/',import.meta.url),name=process.argv[2]??'atlas.json',manifestPath=new URL(name,dir);
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
if(manifest.encoding)throw new Error(`${name} is already encoded (${manifest.encoding}).`);

// Systems seen from outside on first view come first; deep vessels and nerves stream last.
const PRIMARY_SYSTEMS=['muscular','skeletal','integumentary'];
const ORDER=[...PRIMARY_SYSTEMS,'cardiac','sensory','respiratory','digestive','urinary','reproductive','endocrine','lymphatic','connective','nervous','venous','arterial'];
const TARGET_CHUNK_BYTES=1_000_000,POSITION_PRECISION=.0002;

const source=manifest.chunks.map(c=>fs.readFileSync(new URL(c.url.split('/').pop(),dir)));
const oldFiles=manifest.chunks.flatMap(c=>[c.url,c.gzip].filter(Boolean).map(u=>u.split('/').pop()));
const prefix='anatomy';
const chunks=[];let segments=[],bytes=0,chunkSystems=new Set(),chunkPriority=0,rawBytes=0;

const flush=()=>{
 if(!bytes)return;
 // Content-hashed names let the host cache chunks forever; atlas.json alone is revalidated.
 const buffer=Buffer.concat(segments),hash=createHash('sha256').update(buffer).digest('hex').slice(0,10),url=`/models/${prefix}-${chunks.length}.${hash}.bin`,compressed=gzipSync(buffer,{level:9});
 fs.writeFileSync(new URL(url.split('/').pop(),dir),buffer);fs.writeFileSync(new URL(url.split('/').pop()+'.gz',dir),compressed);
 chunks.push({url,bytes:buffer.length,gzip:url+'.gz',gzipBytes:compressed.length,priority:chunkPriority,systems:[...chunkSystems]});
 segments=[];bytes=0;chunkSystems=new Set();
};
const append=data=>{const padding=(4-bytes%4)%4;if(padding){segments.push(Buffer.alloc(padding));bytes+=padding;}const offset=bytes;segments.push(Buffer.from(data.buffer,data.byteOffset,data.byteLength));bytes+=data.byteLength;return offset;};

const sorted=manifest.parts.map((part,index)=>({part,index})).sort((a,b)=>ORDER.indexOf(systemForPart(a.part))-ORDER.indexOf(systemForPart(b.part))||a.index-b.index);
for(const {part:p} of sorted){
 const system=systemForPart(p),priority=PRIMARY_SYSTEMS.includes(system)?0:1;
 if(bytes&&(priority!==chunkPriority||bytes>TARGET_CHUNK_BYTES))flush();
 chunkPriority=priority;chunkSystems.add(system);
 const b=source[p.chunk];
 const pos=new Float32Array(b.buffer,b.byteOffset+p.positions,p.vertexCount*3);
 const normal=new Int16Array(b.buffer,b.byteOffset+p.normals,p.vertexCount*3);
 const indices=new Uint32Array(b.buffer,b.byteOffset+p.indices,p.indexCount).slice();
 rawBytes+=pos.byteLength+normal.byteLength+indices.byteLength;

 // Reorder triangles for cache locality and vertices for fetch order; both shrink the encoded stream.
 const [remap,unique]=MeshoptEncoder.reorderMesh(indices,true,false);
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 for(let v=0;v<p.vertexCount;v++)for(let a=0;a<3;a++){const x=pos[v*3+a];if(x<min[a])min[a]=x;if(x>max[a])max[a]=x;}
 // One uniform grid step per structure: 0.02% of its largest extent, a tenth of the 0.2%
 // simplification error already accepted, and never coarser than 16 bits allow.
 const extent=Math.max(max[0]-min[0],max[1]-min[1],max[2]-min[2]),step=+Math.max(extent/65535,extent*POSITION_PRECISION,1e-9).toPrecision(6);
 const origin=min.map(v=>+v.toPrecision(9));
 const qpos=new Uint16Array(unique*4),qnorm=new Int8Array(unique*4);
 for(let old=0;old<p.vertexCount;old++){
  const n=remap[old];if(n===0xffffffff)continue;
  for(let a=0;a<3;a++)qpos[n*4+a]=Math.max(0,Math.min(65535,Math.round((pos[old*3+a]-origin[a])/step)));
  // Octahedral normal encoding: two signed bytes per vertex.
  let x=normal[old*3],y=normal[old*3+1],z=normal[old*3+2];const l=Math.abs(x)+Math.abs(y)+Math.abs(z)||1;x/=l;y/=l;z/=l;
  if(z<0){const ox=x;x=(1-Math.abs(y))*(ox>=0?1:-1);y=(1-Math.abs(ox))*(y>=0?1:-1);}
  qnorm[n*4]=Math.round(x*127);qnorm[n*4+1]=Math.round(y*127);
 }
 const encPos=MeshoptEncoder.encodeVertexBuffer(new Uint8Array(qpos.buffer),unique,8);
 const encNorm=MeshoptEncoder.encodeVertexBuffer(new Uint8Array(qnorm.buffer),unique,4);
 const encIdx=MeshoptEncoder.encodeIndexBuffer(new Uint8Array(indices.buffer),indices.length,4);
 p.chunk=chunks.length;p.vertexCount=unique;
 p.positions=append(encPos);p.positionsBytes=encPos.byteLength;
 p.normals=append(encNorm);p.normalsBytes=encNorm.byteLength;
 p.indices=append(encIdx);p.indicesBytes=encIdx.byteLength;
 p.quantization=[...origin,step];
}
flush();

manifest.chunks=chunks;
manifest.encoding='meshopt-v1';
manifest.encodingDetails={positions:'uint16 on a per-part uniform grid [originX,originY,originZ,step], stride 8',normals:'int8 octahedral, stride 4',indices:'meshopt index codec, uint32',primarySystems:PRIMARY_SYSTEMS};
fs.writeFileSync(manifestPath,JSON.stringify(manifest));
for(const file of oldFiles)if(!chunks.some(c=>c.url.endsWith('/'+file)||c.gzip.endsWith('/'+file)))fs.rmSync(new URL(file,dir),{force:true});
const gz=chunks.reduce((n,c)=>n+c.gzipBytes,0),primary=chunks.filter(c=>c.priority===0).reduce((n,c)=>n+c.gzipBytes,0);
console.log(JSON.stringify({chunks:chunks.length,rawMB:+(rawBytes/1e6).toFixed(1),encodedMB:+(chunks.reduce((n,c)=>n+c.bytes,0)/1e6).toFixed(2),downloadMB:+(gz/1e6).toFixed(2),primaryDownloadMB:+(primary/1e6).toFixed(2),primaryChunks:chunks.filter(c=>c.priority===0).length}));
