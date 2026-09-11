import {useEffect,useRef} from 'react';
import * as T from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {createExplosionLayout,explosionOffsetFor} from './explosion-layout';
import {decodeModelResponse} from './model-download';
import {PointerTap} from './pointer-tap';
import {SYSTEMS,type Atlas,type SceneState} from './anatomy';
import {systemForPart} from './system-classification.mjs';
export interface CameraSnapshot {position:[number,number,number];target:[number,number,number];viewOffset?:{fullWidth:number;fullHeight:number;offsetX:number;offsetY:number;width:number;height:number}}
export interface CameraCommand {id:number;type:'fit'|'restore';snapshot?:CameraSnapshot;preserveDirection?:boolean}
export type CameraOrientation='three-quarter'|'front'|'side'|'back'|'free';
interface Props {atlas:Atlas;state:SceneState;layoutKey:string;cameraCommand:CameraCommand|null;onCameraChange:(snapshot:CameraSnapshot)=>void;onOrientationChange:(orientation:CameraOrientation)=>void;onSelect:(id:string)=>void;onProgress:(loaded:number,total:number)=>void;onError:(s:string)=>void}
export default function AnatomyScene({atlas,state,layoutKey,cameraCommand,onCameraChange,onOrientationChange,onSelect,onProgress,onError}:Props){
 const host=useRef<HTMLDivElement>(null),latest=useRef(state),select=useRef(onSelect),uiLayout=useRef(layoutKey),command=useRef(cameraCommand),cameraChange=useRef(onCameraChange),orientationChange=useRef(onOrientationChange);
 latest.current=state;select.current=onSelect;uiLayout.current=layoutKey;command.current=cameraCommand;cameraChange.current=onCameraChange;orientationChange.current=onOrientationChange;
 useEffect(()=>{
  const el=host.current!;let disposed=false,frame=0,dirty=true,ready=false,lastView='',lastReset=-1,lastUiLayout='',lastCommand=-1,layoutKey='',amount=0;
  let cameraTransition:{started:number;duration:number;fromPosition:T.Vector3;toPosition:T.Vector3;fromTarget:T.Vector3;toTarget:T.Vector3}|null=null,pendingRestore:CameraSnapshot|null=null;
  let lastState:SceneState|null=null,cameraInitialized=false;
  const abort=new AbortController();
  let renderer:T.WebGLRenderer;
  try{renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});}catch{onError('This browser could not start the 3D viewer. Please try a browser with WebGL enabled.');return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<768?1.5:2));renderer.setClearColor('#061224');renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;el.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-label','Interactive human anatomy. Drag to orbit, pinch or scroll to zoom, and tap a structure to inspect it.');
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(34,1,.005,100),controls=new OrbitControls(camera,renderer.domElement),tap=new PointerTap();
  const directionFor=(view:string)=>view==='front'?new T.Vector3(0,.02,1).normalize():view==='back'?new T.Vector3(0,.02,-1).normalize():view==='side'?new T.Vector3(1,.02,0).normalize():new T.Vector3(.35,.06,1).normalize();
  const orientationFor=(direction:T.Vector3):CameraOrientation=>{let match:CameraOrientation='free',best=.985;for(const view of ['three-quarter','front','side','back'] as const){const score=direction.dot(directionFor(view));if(score>best){best=score;match=view;}}return match;};
  const cameraSnapshot=():CameraSnapshot=>{const view=camera.view;return {position:camera.position.toArray() as [number,number,number],target:controls.target.toArray() as [number,number,number],viewOffset:view?.enabled?{fullWidth:view.fullWidth,fullHeight:view.fullHeight,offsetX:view.offsetX,offsetY:view.offsetY,width:view.width,height:view.height}:undefined};};
  let controlStartPosition=new T.Vector3(),controlStartTarget=new T.Vector3();
  camera.position.set(0,.92,3.6);controls.target.set(0,.85,0);controls.enableDamping=true;controls.dampingFactor=.085;controls.minDistance=.07;controls.maxDistance=40;controls.maxPolarAngle=Math.PI*.96;if('zoomToCursor' in controls)controls.zoomToCursor=false;
  controls.addEventListener('change',()=>{dirty=true;if(tap.hasActivePointer()&&(camera.position.distanceToSquared(controlStartPosition)>1e-8||controls.target.distanceToSquared(controlStartTarget)>1e-8))tap.blockFromControls();const direction=camera.position.clone().sub(controls.target).normalize();orientationChange.current(orientationFor(direction));cameraChange.current(cameraSnapshot());});
  controls.addEventListener('start',()=>{cameraTransition=null;controlStartPosition.copy(camera.position);controlStartTarget.copy(controls.target);});
  const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment(),env=pmrem.fromScene(room,.04);scene.environment=env.texture;room.dispose();pmrem.dispose();
  scene.add(new T.HemisphereLight(0xffffff,0xa7acb2,1.05));
  const key=new T.DirectionalLight(0xfffaf4,2.3);key.position.set(-2,4,3);scene.add(key);
  const rim=new T.DirectionalLight(0xe9f0ff,1.8);rim.position.set(2,2,-3);scene.add(rim);
  const ground=new T.Mesh(new T.CircleGeometry(30,96),new T.MeshBasicMaterial({color:0x061224,transparent:true,opacity:0,depthWrite:false}));ground.rotation.x=-Math.PI/2;ground.position.y=-.019;scene.add(ground);
  const platform=new T.Mesh(new T.CylinderGeometry(.68,.7,.028,100),new T.MeshStandardMaterial({color:0x092038,metalness:.22,roughness:.58}));platform.position.y=-.016;scene.add(platform);
  const ring=new T.Mesh(new T.RingGeometry(.63,.632,128),new T.MeshBasicMaterial({color:0x22d3ee,transparent:true,opacity:.46,side:T.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.001;scene.add(ring);
  const innerRing=new T.Mesh(new T.RingGeometry(.55,.551,128),new T.MeshBasicMaterial({color:0x34d399,transparent:true,opacity:.18,side:T.DoubleSide}));innerRing.rotation.x=-Math.PI/2;innerRing.position.y=.001;scene.add(innerRing);
  const width=T.MathUtils.ceilPowerOfTwo(atlas.parts.length),data=new Float32Array(width*4),partTexture=new T.DataTexture(data,width,1,T.RGBAFormat,T.FloatType);partTexture.needsUpdate=true;
  const selectedData=new Uint8Array(width*4),selectionTexture=new T.DataTexture(selectedData,width,1);selectionTexture.needsUpdate=true;
  const materials:T.Material[]=[],geometries:T.BufferGeometry[]=[],pickers:(T.Mesh|undefined)[]=[],centers=atlas.parts.map(p=>new T.Vector3().fromArray(p.bounds[0]).add(new T.Vector3().fromArray(p.bounds[1])).multiplyScalar(.5));
  // Source vertices are already in atlas/world space. Keep an immutable identity transform
  // for every picker so an assembled frame never inherits a prior explosion transform.
  const baseTransforms=atlas.parts.map(()=>Object.freeze({position:new T.Vector3(),quaternion:new T.Quaternion(),scale:new T.Vector3(1,1,1)}));
  const offsets:T.Vector3[]=[],bounds=atlas.parts.map(p=>new T.Box3(new T.Vector3().fromArray(p.bounds[0]),new T.Vector3().fromArray(p.bounds[1])));
  let packingWidth=1,packingHeight=1;
  const markerPositions=new Float32Array(atlas.parts.length*3),markerGeometry=new T.BufferGeometry();markerGeometry.setAttribute('position',new T.BufferAttribute(markerPositions,3));
  const markerMaterial=new T.PointsMaterial({color:0x64748b,size:5,sizeAttenuation:false,transparent:true,opacity:.72,depthTest:false});
  markerMaterial.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif (distance(gl_PointCoord, vec2(0.5)) > 0.5) discard;');};
  const markers=new T.Points(markerGeometry,markerMaterial);markers.frustumCulled=false;markers.renderOrder=10;markers.visible=false;scene.add(markers);
  const hover=document.createElement('div');hover.className='part-hover';hover.setAttribute('role','tooltip');hover.hidden=true;el.appendChild(hover);
  type Target={index:number;x:number;y:number;left:number;right:number;top:number;bottom:number};let targets:Target[]=[];
  const projected=new T.Vector3();
  const findTarget=(x:number,y:number,radius:number)=>{
   let best=-1,score=Infinity;
   for(const t of targets){const dx=Math.max(t.left-x,0,x-t.right),dy=Math.max(t.top-y,0,y-t.bottom),distance=Math.hypot(dx,dy);if(distance>radius)continue;const candidate=distance+Math.hypot(t.x-x,t.y-y)*.025;if(candidate<score){score=candidate;best=t.index;}}
   return best;
  };
  const materialFor=(system:string)=>{
   const m=new T.MeshStandardMaterial({color:SYSTEMS.find(s=>s.id===system)?.color??'#aebbb8',metalness:.08,roughness:.53,side:T.DoubleSide,transparent:system==='integumentary',opacity:system==='integumentary'?.1:1,depthWrite:system!=='integumentary'});
   m.onBeforeCompile=shader=>{
    shader.uniforms.partState={value:partTexture};shader.uniforms.selectionState={value:selectionTexture};shader.uniforms.stateWidth={value:width};
    shader.vertexShader='attribute float partIndex; uniform sampler2D partState; uniform sampler2D selectionState; uniform float stateWidth; varying float partVisible; varying float partSelected;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvec2 stateUv = vec2((partIndex + 0.5) / stateWidth, 0.5); vec4 state = texture2D(partState, stateUv); transformed += state.xyz; partVisible = state.w; partSelected = texture2D(selectionState, stateUv).r;');
    shader.fragmentShader='varying float partVisible; varying float partSelected;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif (partVisible < 0.5) discard;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.85, 0.78), partSelected * 0.75);');
   };materials.push(m);return m;
  };
  const mats=new Map(SYSTEMS.map(s=>[s.id,materialFor(s.id)]));
  let loaded=0;
  const loadChunk=async(ci:number)=>{
   const chunk=atlas.chunks[ci],compressed=!!chunk.gzip&&typeof DecompressionStream!=='undefined';const response=await fetch(compressed?chunk.gzip!:chunk.url,{signal:abort.signal});const buffer=await decodeModelResponse(response,chunk.bytes,compressed);if(disposed)return;
   const groups=new Map<string,T.BufferGeometry[]>();
   atlas.parts.forEach((p,i)=>{
    if(p.chunk!==ci)return;
    const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(buffer,p.positions,p.vertexCount*3),3));
    // GPU normalized signed-short normals keep the complete atlas compact in memory.
    g.setAttribute('normal',new T.BufferAttribute(new Int16Array(buffer,p.normals,p.vertexCount*3),3,true));g.setIndex(new T.BufferAttribute(new Uint32Array(buffer,p.indices,p.indexCount),1));
    g.boundingBox=bounds[i].clone();g.computeBoundingSphere();const pick=new T.Mesh(g);pick.matrixAutoUpdate=false;pickers[i]=pick;geometries.push(g);
    g.setAttribute('partIndex',new T.BufferAttribute(new Float32Array(p.vertexCount).fill(i),1));
    const effectiveSystem=systemForPart(p),list=groups.get(effectiveSystem)??[];list.push(g);groups.set(effectiveSystem,list);
   });
   groups.forEach((gs,system)=>{const geometry=mergeGeometries(gs,false);if(!geometry)throw new Error('Could not assemble anatomy geometry.');geometries.push(geometry);const mesh=new T.Mesh(geometry,mats.get(system as never));mesh.frustumCulled=false;scene.add(mesh);});
   lastState=null;loaded++;onProgress(loaded,atlas.chunks.length);dirty=true;
  };
  (async()=>{try{let cursor=0;await Promise.all(Array.from({length:3},async()=>{while(cursor<atlas.chunks.length){const i=cursor++;await loadChunk(i);}}));if(!disposed){ready=true;dirty=true;}}catch(e){if(!disposed)onError(e instanceof Error?e.message:'Could not load the anatomy.');}})();
  const visibleElement=(selector:string)=>{const node=document.querySelector<HTMLElement>(selector);if(!node)return null;const style=getComputedStyle(node);if(style.display==='none'||style.visibility==='hidden')return null;const rect=node.getBoundingClientRect();return rect.width>0&&rect.height>0?rect:null;};
  const safeRegion=()=>{
   const w=el.clientWidth,h=el.clientHeight,margin=Math.max(12,Math.min(24,w*.018));let left=margin,right=w-margin,top=margin,bottom=h-margin;
   const header=visibleElement('.identity'),systems=visibleElement('.layers-panel'),details=visibleElement('.detail-sheet')??visibleElement('.learn-sheet'),toolbar=visibleElement('.view-controls'),dock=visibleElement('.bottom-dock'),discovery=visibleElement('.discovery-card');
   if(header)top=Math.max(top,Math.min(header.bottom+14,h*.28));
   if(systems&&systems.right<w*.58)left=Math.max(left,systems.right+18);
   if(details){if(details.left>w*.35)right=Math.min(right,details.left-18);else if(details.width>w*.7&&details.top>h*.28)bottom=Math.min(bottom,details.top-16);}
   if(toolbar){if(toolbar.left>w*.5)right=Math.min(right,toolbar.left-14);else if(toolbar.top<h*.42)top=Math.max(top,toolbar.bottom+12);}
   if(dock)bottom=Math.min(bottom,dock.top-16);
   if(discovery&&discovery.left>w*.48)right=Math.min(right,discovery.left-14);
   if(right-left<Math.min(160,w*.34)){left=margin;right=w-margin;}
   if(bottom-top<Math.min(140,h*.32)){top=margin;bottom=h-margin;}
   return {left,right,top,bottom};
  };
  const fitBounds=(s:SceneState)=>{
    const box=new T.Box3(),selection=new Set(s.selected),preferSelection=selection.size>0&&!!s.inspectorOpen,visible=new Set(s.visible);
   atlas.parts.forEach((p,i)=>{const intended=preferSelection?selection.has(p.id):s.isolate?selection.has(p.id):visible.has(systemForPart(p))||selection.has(p.id);if(!intended)return;box.union(bounds[i].clone().translate(new T.Vector3(data[i*4],data[i*4+1],data[i*4+2])));});
   return box;
  };
  const applyViewOffset=(snapshot?:CameraSnapshot)=>{const w=el.clientWidth,h=el.clientHeight;if(snapshot?.viewOffset){const saved=snapshot.viewOffset,sx=w/saved.fullWidth,sy=h/saved.fullHeight;camera.setViewOffset(w,h,saved.offsetX*sx,saved.offsetY*sy,w,h);return;}const region=safeRegion();camera.setViewOffset(w,h,w/2-(region.left+region.right)/2,h/2-(region.top+region.bottom)/2,w,h);};
  const moveCamera=(position:T.Vector3,target:T.Vector3,smooth=true)=>{
   if(!position.toArray().every(Number.isFinite)||!target.toArray().every(Number.isFinite))return;
   const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
   if(!smooth||reduce){cameraTransition=null;camera.position.copy(position);controls.target.copy(target);controls.update();cameraChange.current(cameraSnapshot());dirty=true;return;}
   cameraTransition={started:performance.now(),duration:680,fromPosition:camera.position.clone(),toPosition:position.clone(),fromTarget:controls.target.clone(),toTarget:target.clone()};dirty=true;
  };
  const fitSubjectToSafeViewport=(s:SceneState,options:{view?:string;smooth?:boolean;preserveDirection?:boolean}={})=>{
   scene.updateMatrixWorld(true);const box=fitBounds(s);if(box.isEmpty())return false;
   const center=box.getCenter(new T.Vector3()),region=safeRegion(),w=el.clientWidth,h=el.clientHeight,availableWidth=Math.max(120,region.right-region.left),availableHeight=Math.max(100,region.bottom-region.top),currentDirection=camera.position.clone().sub(controls.target),direction=options.preserveDirection&&cameraInitialized&&currentDirection.lengthSq()>1e-8?currentDirection.normalize():directionFor(options.view??s.view),right=new T.Vector3().crossVectors(camera.up,direction).normalize(),up=new T.Vector3().crossVectors(direction,right).normalize();
   let halfWidth=0,halfHeight=0,halfDepth=0;const corner=new T.Vector3();
   for(let i=0;i<8;i++){corner.set((i&1)?box.max.x:box.min.x,(i&2)?box.max.y:box.min.y,(i&4)?box.max.z:box.min.z).sub(center);halfWidth=Math.max(halfWidth,Math.abs(corner.dot(right)));halfHeight=Math.max(halfHeight,Math.abs(corner.dot(up)));halfDepth=Math.max(halfDepth,Math.abs(corner.dot(direction)));}
   const tanVertical=Math.tan(T.MathUtils.degToRad(camera.fov/2)),tanHorizontal=tanVertical*camera.aspect,widthDistance=halfWidth/Math.max(.001,tanHorizontal)*(w/availableWidth),heightDistance=halfHeight/Math.max(.001,tanVertical)*(h/availableHeight),isHome=s.visible.length===SYSTEMS.length&&!s.isolate&&!s.inspectorOpen&&amount===0,fitPadding=isHome?1.55:1.18,rawDistance=Math.max(.08,(halfDepth+Math.max(widthDistance,heightDistance))*fitPadding),currentDistance=camera.position.distanceTo(controls.target),selectionFloor=s.inspectorOpen&&!s.isolate?currentDistance*.68:0,distance=Math.max(rawDistance,selectionFloor);
   if(!Number.isFinite(distance))return false;
   controls.minDistance=Math.max(.025,Math.min(distance*.08,.5));controls.maxDistance=Math.max(12,distance*12);applyViewOffset();moveCamera(center.clone().addScaledVector(direction,distance),center,options.smooth??true);cameraInitialized=true;return true;
  };
  const restoreCamera=(snapshot:CameraSnapshot)=>{const position=new T.Vector3().fromArray(snapshot.position),target=new T.Vector3().fromArray(snapshot.target);if(!position.toArray().every(Number.isFinite)||!target.toArray().every(Number.isFinite)||position.distanceToSquared(target)<1e-8){fitSubjectToSafeViewport(latest.current);return;}applyViewOffset(snapshot);const distance=position.distanceTo(target);controls.minDistance=Math.max(.025,Math.min(distance*.08,.5));controls.maxDistance=Math.max(12,distance*12);moveCamera(position,target,true);};
  const resize=()=>{if(cameraTransition){camera.position.copy(cameraTransition.toPosition);controls.target.copy(cameraTransition.toTarget);cameraTransition=null;}const preserveDirection=cameraInitialized;layoutKey='';lastState=null;renderer.setPixelRatio(Math.min(devicePixelRatio,el.clientWidth<768||el.clientHeight<600?1.5:2));camera.aspect=el.clientWidth/el.clientHeight;camera.updateProjectionMatrix();renderer.setSize(el.clientWidth,el.clientHeight);fitSubjectToSafeViewport(latest.current,{smooth:false,preserveDirection});};const observer=new ResizeObserver(resize);observer.observe(el);
  const raycaster=new T.Raycaster(),pointer=new T.Vector2(),worldBox=new T.Box3(),hitPoint=new T.Vector3(),explosionOffset=new T.Vector3();
  const down=(e:PointerEvent)=>{hover.hidden=true;tap.down(e.pointerId,e.clientX,e.clientY,7);};
  const move=(e:PointerEvent)=>{tap.move(e.pointerId,e.clientX,e.clientY);if(e.buttons||amount<.5||e.pointerType==='touch'){hover.hidden=true;return;}const rect=el.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top,index=findTarget(x,y,12);hover.hidden=index<0;renderer.domElement.style.cursor=index<0?'grab':'pointer';if(index>=0){hover.textContent=atlas.parts[index].name;hover.style.left=`${Math.max(8,Math.min(x+14,el.clientWidth-260))}px`;hover.style.top=`${Math.max(8,Math.min(y+18,el.clientHeight-55))}px`;}};
  const cancel=(e:PointerEvent)=>tap.cancel(e.pointerId);
  const up=(e:PointerEvent)=>{
   const validTap=tap.up(e.pointerId,e.clientX,e.clientY);if(!validTap||!ready)return;const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
   let nearest=Infinity,found=-1;const hasSolid=atlas.parts.some((p,i)=>systemForPart(p)!=='integumentary'&&data[i*4+3]>.5);
   pickers.forEach((mesh,i)=>{if(!mesh||data[i*4+3]<.5||(hasSolid&&systemForPart(atlas.parts[i])==='integumentary'))return;worldBox.copy(bounds[i]).translate(mesh.position);if(!raycaster.ray.intersectBox(worldBox,hitPoint))return;const hits=raycaster.intersectObject(mesh,false);if(hits[0]&&hits[0].distance<nearest){nearest=hits[0].distance;found=i;}});
   if(found<0&&amount>.45)found=findTarget(e.clientX-rect.left,e.clientY-rect.top,e.pointerType==='touch'?24:16);if(found>=0){hover.hidden=true;select.current(atlas.parts[found].id);}
  };
  renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointermove',move);renderer.domElement.addEventListener('pointerup',up);renderer.domElement.addEventListener('pointercancel',cancel);
  const clock=new T.Clock();let lastExtent=-1;
  const animate=()=>{
   if(disposed)return;frame=requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05),s=latest.current;
   const visibilityChanged=lastState?.visible!==s.visible||lastState?.isolate!==s.isolate,selectionChanged=lastState?.selected!==s.selected,changed=visibilityChanged||selectionChanged;
   if(changed){amount=s.explode;cameraTransition=null;}
   let moving=Math.abs(amount-s.explode)>.0001;
   if(moving){amount=T.MathUtils.damp(amount,s.explode,8,dt);if(s.explode===0&&amount<.002)amount=0;moving=Math.abs(amount-s.explode)>.0001;dirty=true;}
   if(changed||moving||lastExtent<0){
    const visible=new Set(s.visible),selection=new Set(s.selected);
    const visibleParts=atlas.parts.filter(p=>s.isolate?selection.has(p.id):visible.has(systemForPart(p))||selection.has(p.id));
    const nextLayoutKey=visibleParts.map(p=>p.id).join(',')+':'+camera.aspect.toFixed(3);
    if(nextLayoutKey!==layoutKey){const layout=createExplosionLayout(visibleParts,camera.aspect);packingWidth=layout.width;packingHeight=layout.height;atlas.parts.forEach((p,i)=>{const cell=layout.cells.get(p.id);offsets[i]=cell?new T.Vector3(cell.x,cell.y+.85,0):centers[i].clone();});layoutKey=nextLayoutKey;}

     atlas.parts.forEach((p,i)=>{
      const c=centers[i],destination=offsets[i],base=baseTransforms[i],effectiveSystem=systemForPart(p),offset=explosionOffsetFor(effectiveSystem,c,destination,amount),{x:dx,y:dy,z:dz}=offset;
      const selected=selection.has(p.id);data.set([dx,dy,dz,(s.isolate?selected:visible.has(effectiveSystem)||selected)?1:0],i*4);selectedData[i*4]=selected?255:0;
      markerPositions.set(data[i*4+3]>.5?[c.x+dx,c.y+dy,c.z+dz]:[10000,10000,10000],i*3);const mesh=pickers[i];if(mesh){mesh.position.copy(base.position).add(explosionOffset.set(dx,dy,dz));mesh.quaternion.copy(base.quaternion);mesh.scale.copy(base.scale);mesh.updateMatrix();mesh.updateMatrixWorld(true);}
     });partTexture.needsUpdate=true;selectionTexture.needsUpdate=true;markerGeometry.attributes.position.needsUpdate=true;lastState=s;lastExtent=amount;dirty=true;
    }
    const viewChanged=s.view!==lastView,resetChanged=s.reset!==lastReset,uiChanged=uiLayout.current!==lastUiLayout,nextCommand=command.current,commandChanged=!!nextCommand&&nextCommand.id!==lastCommand;
    if(commandChanged){lastCommand=nextCommand.id;if(nextCommand.type==='restore'&&nextCommand.snapshot)pendingRestore=nextCommand.snapshot;else fitSubjectToSafeViewport(s,{view:s.view,smooth:true,preserveDirection:nextCommand.preserveDirection});}
    if(!pendingRestore&&!commandChanged){if(viewChanged||resetChanged)fitSubjectToSafeViewport(s,{view:s.view,smooth:true});else if(changed||uiChanged)fitSubjectToSafeViewport(s,{smooth:true,preserveDirection:true});}
    if(moving)fitSubjectToSafeViewport(s,{smooth:false,preserveDirection:true});else if(pendingRestore){restoreCamera(pendingRestore);pendingRestore=null;}
   lastView=s.view;lastReset=s.reset;lastUiLayout=uiLayout.current;
   if(cameraTransition){const t=Math.min(1,(performance.now()-cameraTransition.started)/cameraTransition.duration),eased=t*t*(3-2*t);camera.position.lerpVectors(cameraTransition.fromPosition,cameraTransition.toPosition,eased);controls.target.lerpVectors(cameraTransition.fromTarget,cameraTransition.toTarget,eased);if(t>=1)cameraTransition=null;dirty=true;}
   controls.enableRotate=amount<.8;controls.mouseButtons.LEFT=amount<.8?T.MOUSE.ROTATE:T.MOUSE.PAN;controls.touches.ONE=amount<.8?T.TOUCH.ROTATE:T.TOUCH.PAN;ground.visible=platform.visible=ring.visible=innerRing.visible=amount<.5&&!s.isolate;markers.visible=amount>.75;controls.autoRotate=s.rotate&&!s.isolate&&amount<.4;controls.autoRotateSpeed=.65;controls.update();if(controls.autoRotate)dirty=true;
   if(dirty){renderer.render(scene,camera);targets=[];if(amount>.45){const hasSolid=atlas.parts.some((p,i)=>systemForPart(p)!=='integumentary'&&data[i*4+3]>.5);atlas.parts.forEach((p,i)=>{if(data[i*4+3]<.5||(hasSolid&&systemForPart(p)==='integumentary'))return;let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;for(let corner=0;corner<8;corner++){projected.set(p.bounds[(corner&1)?1:0][0]+data[i*4],p.bounds[(corner&2)?1:0][1]+data[i*4+1],p.bounds[(corner&4)?1:0][2]+data[i*4+2]).project(camera);const x=(projected.x+1)*el.clientWidth/2,y=(1-projected.y)*el.clientHeight/2;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}projected.copy(centers[i]).add(new T.Vector3(data[i*4],data[i*4+1],data[i*4+2])).project(camera);if(projected.z< -1||projected.z>1)return;targets.push({index:i,x:(projected.x+1)*el.clientWidth/2,y:(1-projected.y)*el.clientHeight/2,left,right,top,bottom});});}dirty=false;}

  };animate();
  const contextLost=(e:Event)=>{e.preventDefault();onError('The 3D session was paused by your device. Reload to continue.');};renderer.domElement.addEventListener('webglcontextlost',contextLost);
  return()=>{disposed=true;abort.abort();cancelAnimationFrame(frame);observer.disconnect();controls.dispose();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());scene.traverse(o=>{if(o instanceof T.Mesh&&!geometries.includes(o.geometry)){o.geometry.dispose();const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>m.dispose());}});env.dispose();partTexture.dispose();selectionTexture.dispose();markerGeometry.dispose();markerMaterial.dispose();hover.remove();renderer.dispose();renderer.domElement.remove();};
 },[atlas]);
 return <div className="scene" ref={host}/>;
}
