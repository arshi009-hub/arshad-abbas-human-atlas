import type {Part} from './anatomy';

/** Static hosts may serve .gz as a compressed response or as a gzip file.
 * Fetch already decodes Content-Encoding; inspect the payload to avoid decoding twice.
 */
export async function decodeModelResponse(response:Response,expectedBytes:number,compressed:boolean):Promise<ArrayBuffer>{
 if(!response.ok)throw new Error('An anatomy file could not be loaded.');
 const payload=await response.arrayBuffer(),signature=new Uint8Array(payload,0,Math.min(2,payload.byteLength));
 const gzip=compressed&&signature[0]===0x1f&&signature[1]===0x8b;
 const buffer=gzip?await new Response(new Blob([payload]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer():payload;
 if(buffer.byteLength!==expectedBytes)throw new Error('An anatomy file was incomplete. Please reload the viewer.');
 return buffer;
}

export interface DecodedPart {positions:Float32Array;normals:Int8Array;indices:Uint32Array}

let decoderPromise:Promise<typeof import('meshoptimizer/decoder').MeshoptDecoder>|null=null;
/** The meshopt decoder (a small WebAssembly module) is loaded only when encoded geometry arrives. */
export function meshoptDecoder(){
 decoderPromise??=import('meshoptimizer/decoder').then(async({MeshoptDecoder})=>{await MeshoptDecoder.ready;return MeshoptDecoder;});
 return decoderPromise;
}

/** Decodes one structure from a meshopt-v1 chunk: uint16 grid positions, octahedral int8 normals, uint32 indices. */
export function decodeMeshoptPart(decoder:Awaited<ReturnType<typeof meshoptDecoder>>,buffer:ArrayBuffer,p:Part):DecodedPart{
 const count=p.vertexCount,q=new Uint16Array(count*4),n=new Int8Array(count*4),indices=new Uint32Array(p.indexCount);
 decoder.decodeVertexBuffer(new Uint8Array(q.buffer),count,8,new Uint8Array(buffer,p.positions,p.positionsBytes!));
 decoder.decodeVertexBuffer(new Uint8Array(n.buffer),count,4,new Uint8Array(buffer,p.normals,p.normalsBytes!));
 decoder.decodeIndexBuffer(new Uint8Array(indices.buffer),p.indexCount,4,new Uint8Array(buffer,p.indices,p.indicesBytes!));
 const [x0,y0,z0,step]=p.quantization!,positions=new Float32Array(count*3),normals=new Int8Array(count*3);
 for(let v=0;v<count;v++){
  positions[v*3]=x0+q[v*4]*step;positions[v*3+1]=y0+q[v*4+1]*step;positions[v*3+2]=z0+q[v*4+2]*step;
  let x=n[v*4]/127,y=n[v*4+1]/127,z=1-Math.abs(x)-Math.abs(y);const t=Math.max(-z,0);x+=x>=0?-t:t;y+=y>=0?-t:t;
  const length=Math.hypot(x,y,z)||1;normals[v*3]=Math.round(x/length*127);normals[v*3+1]=Math.round(y/length*127);normals[v*3+2]=Math.round(z/length*127);
 }
 return {positions,normals,indices};
}
