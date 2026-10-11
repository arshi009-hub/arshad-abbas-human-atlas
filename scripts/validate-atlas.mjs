import fs from 'node:fs';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {MeshoptDecoder} from 'meshoptimizer/decoder';
await MeshoptDecoder.ready;
const filename=process.argv[2]??'atlas.json';
const base=new URL('../public/models/',import.meta.url),atlas=JSON.parse(fs.readFileSync(new URL(filename,base)));
assert.equal(atlas.parts.length,2234);assert.equal(atlas.concepts.length,3432);
const ids=new Set(atlas.parts.map(p=>p.id));assert.equal(ids.size,2234);
const encoded=atlas.encoding==='meshopt-v1';
const files=atlas.chunks.map(c=>{
 const b=fs.readFileSync(new URL(c.url.split('/').pop(),base));assert.equal(b.length,c.bytes);
 if(c.gzip){const gz=fs.readFileSync(new URL(c.gzip.split('/').pop(),base));assert.equal(gz.length,c.gzipBytes);assert.ok(gunzipSync(gz).equals(b),`${c.gzip} does not match ${c.url}`);}
 return b;
});
if(encoded){
 // Every chunk is tagged with a priority; the systems seen from outside download first.
 assert.ok(atlas.chunks.every(c=>c.priority===0||c.priority===1),'Every chunk needs a download priority.');
 const firstSecondary=atlas.chunks.findIndex(c=>c.priority===1);assert.ok(firstSecondary>0&&atlas.chunks.slice(firstSecondary).every(c=>c.priority===1),'Primary chunks must come first.');
}
let tris=0;
for(const p of atlas.parts){
 assert.ok(p.name.trim()&&p.name!=='-'&&!p.name.includes('Bounds('));assert.ok(p.conceptId!=='-');assert.ok(p.system);const b=files[p.chunk];
 let pos,indices;
 if(encoded){
  assert.ok(p.positions+p.positionsBytes<=b.length&&p.normals+p.normalsBytes<=b.length&&p.indices+p.indicesBytes<=b.length,`${p.id}: buffer range`);
  assert.equal(p.quantization.length,4);assert.ok(p.quantization.every(Number.isFinite)&&p.quantization[3]>0,`${p.id}: quantization`);
  const q=new Uint16Array(p.vertexCount*4),n=new Int8Array(p.vertexCount*4);indices=new Uint32Array(p.indexCount);
  MeshoptDecoder.decodeVertexBuffer(new Uint8Array(q.buffer),p.vertexCount,8,b.subarray(p.positions,p.positions+p.positionsBytes));
  MeshoptDecoder.decodeVertexBuffer(new Uint8Array(n.buffer),p.vertexCount,4,b.subarray(p.normals,p.normals+p.normalsBytes));
  MeshoptDecoder.decodeIndexBuffer(new Uint8Array(indices.buffer),p.indexCount,4,b.subarray(p.indices,p.indices+p.indicesBytes));
  const [x,y,z,s]=p.quantization;pos=new Float32Array(p.vertexCount*3);for(let v=0;v<p.vertexCount;v++){pos[v*3]=x+q[v*4]*s;pos[v*3+1]=y+q[v*4+1]*s;pos[v*3+2]=z+q[v*4+2]*s;}
  // Decoded vertices stay inside the part's recorded bounds (allowing half a grid step).
  for(let v=0;v<p.vertexCount;v++)for(let a=0;a<3;a++)assert.ok(pos[v*3+a]>=p.bounds[0][a]-s&&pos[v*3+a]<=p.bounds[1][a]+s,`${p.id}: vertex outside bounds`);
 }else{
  assert.ok(p.indices+p.indexCount*4<=b.length);pos=new Float32Array(b.buffer,b.byteOffset+p.positions,p.vertexCount*3);indices=new Uint32Array(b.buffer,b.byteOffset+p.indices,p.indexCount);
 }
 assert.ok(indices.length>=3&&indices.length%3===0);for(const i of indices)assert.ok(i<p.vertexCount,`${p.id}: invalid vertex`);for(const value of pos)assert.ok(Number.isFinite(value));tris+=p.indexCount/3;
}
for(const c of atlas.concepts){assert.ok(c.elements.length);for(const id of c.elements)assert.ok(ids.has(id),`${c.id}: missing ${id}`);}
assert.equal(tris,atlas.triangles);
const download=atlas.chunks.reduce((n,c)=>n+(c.gzipBytes??c.bytes),0);
console.log(`Verified ${ids.size} individually indexed meshes, ${atlas.concepts.length} complete concept mappings, ${tris.toLocaleString()} triangles, and every ${encoded?'meshopt-encoded ':''}binary buffer (${(download/1e6).toFixed(1)} MB download).`);
