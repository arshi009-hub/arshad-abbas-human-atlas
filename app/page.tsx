import {flushSync} from 'react-dom';
import {registerAtlasTools} from './agent-tools';
import {useEffect,useMemo,useRef,useState,type ReactElement} from 'react';
import {Activity,ArrowLeft,ArrowRight,ArrowUpRight,BookOpenCheck,Check,ChevronRight,Compass,Focus,Info,Layers3,Maximize2,Minimize2,MousePointer2,Move3D,Pause,RotateCcw,RotateCw,Search,ZoomIn,X} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Badge} from '@/components/ui/badge';
import {Slider} from '@/components/ui/slider';
import {Switch} from '@/components/ui/switch';
import {Sheet,SheetContent,SheetTitle,SheetDescription} from '@/components/ui/sheet';
import {Combobox,ComboboxInput,ComboboxContent,ComboboxList,ComboboxItem,ComboboxEmpty} from '@/components/ui/combobox';
import {Tooltip,TooltipContent,TooltipProvider,TooltipTrigger} from '@/components/ui/tooltip';
import AnatomyScene,{type CameraCommand,type CameraOrientation,type CameraSnapshot} from './scene';
import AnatomyLogo from './anatomy-logo';
import {SYSTEMS,type Atlas,type Concept,type SceneState,type SystemId,type View} from './anatomy';
import {DISCOVERY_FACTS,discoveryFactCollectionFor,normalizeFmaId,normalizeStructureName,resolveEducationProfile,sourcesFor} from './education-content';
import {buildLearningProfile,LEARN_CAMERA_COMMAND,LEARNED_STORAGE_KEY,ORIENTATION_HELP,ORIENTATION_SOURCE,parseLearnedIds,serializeLearnedIds,toSimpleEnglish,toggleLearnedId} from './learning-content';
import {systemForPart} from './system-classification.mjs';

const ALL_VISIBLE=SYSTEMS.map(system=>system.id);
const initial:SceneState={explode:0,visible:[...ALL_VISIBLE],selected:[],isolate:false,view:'front',rotate:false,reset:0};
const SEARCH_ALIASES:Record<string,string>={
 'brain':'FMA50801','encephalon':'FMA50801','heart':'FMA7088','stomach':'FMA7148','kneecap':'FMA24485','patella':'FMA24485','skull':'FMA46565','urinary bladder':'FMA15900',
};
const SUGGESTED_SEARCH_IDS=['FMA7088','FMA50801','FMA7197','FMA7148','FMA7196','FMA7198','FMA15900','FMA7394'];
type OpeningStage='loading'|'ready'|'hidden';
interface SavedAtlasState {visible:SystemId[];explode:number;view:View;camera:CameraSnapshot|null}

function ControlTip({label,children,side='top'}:{label:string;children:ReactElement;side?:'top'|'right'|'bottom'|'left'}){
 return <Tooltip><TooltipTrigger render={children}/><TooltipContent side={side}>{label}</TooltipContent></Tooltip>;
}

export default function Home(){
 const detailTitle=useRef<HTMLHeadingElement>(null),learnTitle=useRef<HTMLHeadingElement>(null),cameraSnapshot=useRef<CameraSnapshot|null>(null),searchStartCamera=useRef<CameraSnapshot|null>(null),savedAtlas=useRef<SavedAtlasState|null>(null),searchIsolatedRef=useRef(false),chooseSearchRef=useRef<(c:Concept)=>void>(()=>{}),cameraCommandId=useRef(0),searchSelectionId=useRef(0);
 const [atlas,setAtlas]=useState<Atlas|null>(null),[state,setState]=useState(initial),[loadedChunks,setLoadedChunks]=useState(0),[totalChunks,setTotalChunks]=useState(0),[error,setError]=useState(''),[panel,setPanel]=useState<'layers'|'search'|null>(null),[details,setDetails]=useState(false),[learn,setLearn]=useState(false),[simpleEnglish,setSimpleEnglish]=useState(false),[learnedIds,setLearnedIds]=useState<string[]>([]),[progressReady,setProgressReady]=useState(false),[about,setAbout]=useState(false),[query,setQuery]=useState(''),[chosen,setChosen]=useState<Concept|null>(null),[searchIsolated,setSearchIsolated]=useState(false),[opening,setOpening]=useState<OpeningStage>('loading'),[loadAttempt,setLoadAttempt]=useState(0),[factIndex,setFactIndex]=useState(0),[notice,setNotice]=useState(''),[cameraCommand,setCameraCommand]=useState<CameraCommand|null>(null),[orientation,setOrientation]=useState<CameraOrientation>('front'),[presentation,setPresentation]=useState(false);

 useEffect(()=>{const abort=new AbortController();setLoadedChunks(0);setTotalChunks(0);setError('');setAtlas(null);setChosen(null);setDetails(false);setOpening('loading');setState(s=>({...initial,visible:[...ALL_VISIBLE],reset:s.reset+1}));fetch('/models/atlas.json',{signal:abort.signal}).then(r=>{if(!r.ok)throw new Error('The anatomy catalogue could not be loaded.');return r.json();}).then(data=>{const next=data as Atlas;setTotalChunks(next.chunks.length);setAtlas(next);}).catch(e=>{if(e.name!=='AbortError')setError(e instanceof Error?e.message:'The anatomy catalogue could not be loaded.');});return()=>abort.abort();},[loadAttempt]);
 useEffect(()=>{if(opening!=='ready')return;const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;const timer=window.setTimeout(()=>setOpening('hidden'),reduce?120:820);return()=>window.clearTimeout(timer);},[opening]);
 useEffect(()=>{const fullscreen=()=>setPresentation(!!document.fullscreenElement);document.addEventListener('fullscreenchange',fullscreen);return()=>document.removeEventListener('fullscreenchange',fullscreen);},[]);
 useEffect(()=>{try{setLearnedIds(parseLearnedIds(window.localStorage.getItem(LEARNED_STORAGE_KEY)));}catch{setLearnedIds([]);}finally{setProgressReady(true);}},[]);
 useEffect(()=>{if(!progressReady)return;try{window.localStorage.setItem(LEARNED_STORAGE_KEY,serializeLearnedIds(learnedIds));}catch{/* Keep in-memory progress when browser storage is unavailable. */}},[learnedIds,progressReady]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='/'&&!(e.target instanceof HTMLInputElement)&&!(e.target instanceof HTMLTextAreaElement)){e.preventDefault();if(!searchIsolatedRef.current)searchStartCamera.current=cameraSnapshot.current;setLearn(false);setPanel('search');setDetails(false);}else if(e.key==='Escape'&&panel){e.preventDefault();searchStartCamera.current=null;setPanel(null);if(chosen)setDetails(true);}else if(e.key==='Escape'&&learn){e.preventDefault();setLearn(false);if(chosen)setDetails(true);}else if(e.key==='Escape'&&presentation&&!document.fullscreenElement){setPresentation(false);}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[panel,chosen,learn,presentation]);

 const parts=useMemo(()=>new Map(atlas?.parts.map(p=>[p.id,p])),[atlas]);
 const counts=useMemo(()=>Object.fromEntries(SYSTEMS.map(s=>[s.id,atlas?.parts.filter(p=>systemForPart(p)===s.id).length??0])),[atlas]);
 const activeSystems=SYSTEMS.filter(s=>counts[s.id]>0);
 const selectedParts=state.selected.map(id=>parts.get(id)).filter(p=>!!p),selected=selectedParts[0];
 const profile=chosen?resolveEducationProfile(chosen,selectedParts):undefined,system=SYSTEMS.find(s=>s.id===(profile?.system??selected?.system));
 const visibleCount=atlas?.parts.filter(p=>state.isolate?state.selected.includes(p.id):state.visible.includes(systemForPart(p))||state.selected.includes(p.id)).length??0;
 const results=useMemo(()=>{if(!atlas)return[];const byId=new Map(atlas.concepts.map(concept=>[normalizeFmaId(concept.id),concept])),term=normalizeStructureName(query);if(!term)return SUGGESTED_SEARCH_IDS.map(id=>byId.get(id)).filter((item):item is Concept=>!!item);const canonicalId=SEARCH_ALIASES[term],canonical=canonicalId?byId.get(canonicalId):atlas.concepts.find(concept=>normalizeStructureName(concept.name)===term);if(canonical)return[canonical];return atlas.concepts.filter(concept=>normalizeStructureName(concept.name).includes(term)||normalizeFmaId(concept.id).includes(term.replaceAll(':','').toUpperCase())).sort((a,b)=>a.name.length-b.name.length||a.id.localeCompare(b.id)).slice(0,80);},[atlas,query]);
 const contextSystem=chosen?(profile?.system??(selected?systemForPart(selected):undefined)):!state.isolate&&state.visible.length===1?state.visible[0]:undefined;
 const factCollection=useMemo(()=>discoveryFactCollectionFor({name:chosen?.name,fmaId:profile?.fmaId,system:contextSystem,familyId:profile?.familyId}),[chosen?.name,profile?.fmaId,profile?.familyId,contextSystem]);
 const factPool=factCollection.facts;
 const currentFact=factPool.length?factPool[factIndex%factPool.length]:DISCOVERY_FACTS[0];
 const factConcept=useMemo(()=>{if(!atlas||!currentFact)return undefined;const ids=new Set(currentFact.fmaIds?.map(normalizeFmaId)??[]),names=new Set(currentFact.structures?.map(normalizeStructureName)??[]);return atlas.concepts.find(concept=>ids.has(normalizeFmaId(concept.id)))??atlas.concepts.find(concept=>names.has(normalizeStructureName(concept.name)));},[atlas,currentFact]);
 const learning=profile&&currentFact?buildLearningProfile(profile,currentFact,system?.name??profile.system,sourcesFor(profile.sourceIds)):undefined,learnedId=profile?.fmaId??'',isLearned=!!learnedId&&learnedIds.includes(learnedId);
 const learnText=(value:string)=>simpleEnglish&&learning?toSimpleEnglish(value,learning.displayName):value;
 const loadPercent=totalChunks?Math.round(loadedChunks/totalChunks*100):0;

 const endSearchIsolation=()=>{searchSelectionId.current++;savedAtlas.current=null;searchIsolatedRef.current=false;setSearchIsolated(false);};
 const requestCamera=(command:Omit<CameraCommand,'id'>)=>setCameraCommand({id:++cameraCommandId.current,...command});
 const chooseSearch=(c:Concept)=>{
  const selectionId=++searchSelectionId.current;
  const valid=c.elements.filter(id=>parts.has(id));
  if(!valid.length){setNotice(`No viewable geometry is available for ${c.name}.`);return;}
  if(!savedAtlas.current)savedAtlas.current={visible:[...state.visible],explode:state.explode,view:state.view,camera:searchStartCamera.current??cameraSnapshot.current};
  searchStartCamera.current=null;
  searchIsolatedRef.current=true;setSearchIsolated(true);setNotice('');setLearn(false);setDetails(false);setChosen(null);setQuery(c.name);setState(s=>({...s,selected:[],isolate:true,explode:0,rotate:false}));
  window.requestAnimationFrame(()=>{if(selectionId!==searchSelectionId.current)return;setChosen({...c,elements:valid});setFactIndex(0);setState(s=>({...s,selected:valid,isolate:true,explode:0,rotate:false}));setDetails(true);setPanel(null);requestCamera({type:'fit',preserveDirection:true});});
 };
 chooseSearchRef.current=chooseSearch;
 useEffect(()=>{if(!atlas)return;return registerAtlasTools(atlas,c=>flushSync(()=>chooseSearchRef.current(c)));},[atlas]);

 const choosePart=(id:string)=>{const p=parts.get(id);if(!p)return;setLearn(false);setChosen({id:p.conceptId,name:p.name,elements:[id]});setFactIndex(0);setState(s=>({...s,selected:[id],isolate:searchIsolatedRef.current,rotate:false}));setDetails(true);setPanel(null);};
 const clearSelection=()=>{if(searchIsolatedRef.current){returnToAtlas();return;}setLearn(false);setState(s=>({...s,selected:[],isolate:false}));setChosen(null);setDetails(false);setFactIndex(0);};
 const returnToAtlas=()=>{const saved=savedAtlas.current;setState(s=>saved?{...s,visible:[...saved.visible],selected:[],isolate:false,explode:saved.explode,view:saved.view,rotate:false}:{...s,selected:[],isolate:false,explode:0,rotate:false});if(saved?.camera)requestCamera({type:'restore',snapshot:saved.camera});endSearchIsolation();setLearn(false);setQuery('');setChosen(null);setDetails(false);setPanel(null);setNotice('');setFactIndex(0);};
 const home=()=>{endSearchIsolation();setLearn(false);setQuery('');setChosen(null);setDetails(false);setPanel(null);setAbout(false);setNotice('');setFactIndex(0);setOrientation('front');setState(s=>({...initial,visible:[...ALL_VISIBLE],reset:s.reset+1}));requestCamera({type:'fit'});};
 const applySystems=(visible:SystemId[])=>{endSearchIsolation();setLearn(false);setQuery('');setChosen(null);setDetails(false);setFactIndex(0);setState(s=>({...s,visible:[...visible],selected:[],isolate:false,rotate:false}));};
 const toggle=(id:SystemId)=>{const next=state.visible.includes(id)?state.visible.filter(x=>x!==id):[...state.visible,id];applySystems(next);};
 const openPanel=(next:'layers'|'search')=>{const closing=panel===next;if(next==='search'){if(closing)searchStartCamera.current=null;else if(!searchIsolatedRef.current)searchStartCamera.current=cameraSnapshot.current;}setLearn(false);setPanel(closing?null:next);setDetails(closing&&!!chosen);};
 const updateQuery=(value:string)=>{setQuery(value);if(searchIsolatedRef.current&&!value.trim())returnToAtlas();};
 const moveFact=(delta:number)=>setFactIndex(index=>(index+delta+factPool.length)%factPool.length);
 const retry=()=>{endSearchIsolation();setLearn(false);setQuery('');setPanel(null);setNotice('');setLoadAttempt(value=>value+1);};
 const handleProgress=(loaded:number,total:number)=>{setLoadedChunks(loaded);setTotalChunks(total);setError('');if(total>0&&loaded>=total)setOpening('ready');};
 const handleDetailsOpen=(open:boolean)=>{if(open){setDetails(true);return;}if(searchIsolatedRef.current)returnToAtlas();else setDetails(false);};
 const openLearn=()=>{if(!learning)return;setPanel(null);setAbout(false);setDetails(false);setLearn(true);setState(s=>({...s,rotate:false}));window.requestAnimationFrame(()=>requestCamera(LEARN_CAMERA_COMMAND));};
 const handleLearnOpen=(open:boolean)=>{if(open){setLearn(true);return;}setLearn(false);if(chosen)setDetails(true);};
 const toggleLearnIsolation=()=>{setState(s=>({...s,isolate:!s.isolate,explode:0,rotate:false}));window.requestAnimationFrame(()=>requestCamera(LEARN_CAMERA_COMMAND));};
 const resetLearnView=()=>{setState(s=>({...s,explode:0,rotate:false,reset:s.reset+1}));window.requestAnimationFrame(()=>requestCamera(LEARN_CAMERA_COMMAND));};
 const toggleLearned=()=>{if(learnedId)setLearnedIds(ids=>toggleLearnedId(ids,learnedId));};
 const togglePresentation=async()=>{if(presentation){if(document.fullscreenElement&&document.exitFullscreen)await document.exitFullscreen().catch(()=>{});setPresentation(false);return;}setLearn(false);setPanel(null);setDetails(false);setAbout(false);setPresentation(true);try{if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else setNotice('Presentation layout enabled. Fullscreen is not available in this browser.');}catch{setNotice('Presentation layout enabled. Your browser kept the current window size.');}};

 return <TooltipProvider delay={320}><main className={`studio opening-${error?'error':opening} ${presentation?'presentation-mode':''}`}>
  {atlas&&<AnatomyScene key={loadAttempt} atlas={atlas} state={{...state,inspectorOpen:(details||learn)&&selectedParts.length>0}} layoutKey={`${panel??'none'}:${details}:${learn}:${about}:${opening}:${presentation}`} cameraCommand={cameraCommand} onCameraChange={snapshot=>{cameraSnapshot.current=snapshot;}} onOrientationChange={setOrientation} onSelect={choosePart} onProgress={handleProgress} onError={setError}/>}
  <div className="vignette" aria-hidden="true"/>

  <div className="atlas-interface">
   <header className="identity">
    <h1 className="sr-only">Arshad Abbas Human Anatomy Lab 3D</h1>
    <button type="button" className="brand-home" onClick={home} aria-label="Return to atlas home">
     <AnatomyLogo/>
     <span className="brand-copy">
      <span className="brand-owner"><span className="status-dot"/>ARSHAD ABBAS</span>
      <span className="brand-title">Human Anatomy Lab <Badge variant="outline" className="edition">3D</Badge></span>
      <span className="brand-subtitle">Interactive 3D Learning Platform</span>
      <span className="identity-meta"><span>{atlas?atlas.parts.length.toLocaleString():'2,234'} anatomical pieces</span><i/><span>BodyParts3D reference</span></span>
     </span>
    </button>
   </header>

   <nav className="top-actions" aria-label="Explorer panels">
    <Button variant="ghost" className={`search-trigger ${panel==='search'?'active':''}`} onClick={()=>openPanel('search')} aria-label="Search anatomy" title="Search anatomy"><Search size={19}/><span>Find a structure</span><kbd>/</kbd></Button>
    <ControlTip label={presentation?'Exit Presentation Mode':'Enter Presentation Mode'} side="bottom"><Button variant="ghost" className={`presentation-trigger ${presentation?'active':''}`} onClick={togglePresentation} aria-label={presentation?'Exit Presentation Mode':'Enter Presentation Mode'} title={presentation?'Exit Presentation Mode':'Enter Presentation Mode'}>{presentation?<Minimize2 size={19}/>:<Maximize2 size={19}/>}<span>{presentation?'Exit':'Present'}</span></Button></ControlTip>
    {presentation&&<ControlTip label="Open anatomical systems" side="bottom"><Button variant="ghost" className="presentation-systems" onClick={()=>openPanel('layers')} aria-label="Open anatomical systems" title="Open anatomical systems"><Layers3 size={19}/></Button></ControlTip>}
    <Button variant="ghost" className="icon-button" aria-label="About, sources and disclaimer" title="About, sources and disclaimer" onClick={()=>{setLearn(false);setPanel(null);setAbout(true);}}><Info size={20}/></Button>
   </nav>

   <section className={`layers-panel glass ${panel==='layers'?'mobile-open':''}`} aria-label="Anatomical systems">
    <div className="panel-heading"><div className="panel-title-block"><span className="panel-kicker">Anatomical index</span><h2>Systems</h2></div><Button variant="ghost" className="mobile-only icon-button" onClick={()=>{setPanel(null);if(chosen)setDetails(true);}} aria-label="Close systems" title="Close systems"><X size={19}/></Button><Badge variant="secondary" className="desktop-only small-number">{activeSystems.length}</Badge></div>
    <div className="layer-presets" aria-label="System presets">
     <Button variant="ghost" aria-pressed={state.visible.length===ALL_VISIBLE.length&&ALL_VISIBLE.every(id=>state.visible.includes(id))&&!state.isolate} onClick={()=>applySystems(ALL_VISIBLE)}>All</Button>
     <Button variant="ghost" aria-pressed={state.visible.length===1&&state.visible[0]==='skeletal'&&!state.isolate} onClick={()=>applySystems(['skeletal'])}>Skeleton</Button>
     <Button variant="ghost" aria-pressed={state.visible.length===6&&['cardiac','respiratory','digestive','urinary','endocrine','reproductive'].every(id=>state.visible.includes(id as SystemId))&&!state.isolate} onClick={()=>applySystems(['cardiac','respiratory','digestive','urinary','endocrine','reproductive'])}>Organs</Button>
    </div>
    <div className="system-list">{activeSystems.map(s=><div className={`system-row ${state.visible.includes(s.id)&&!state.isolate?'enabled':''}`} key={s.id}><Button variant="ghost" className="system-name" title={`Show only ${s.name.toLowerCase()}`} onClick={()=>applySystems([s.id])}><span className="system-dot" style={{background:s.color}}/><span>{s.name}</span><span className="system-count">{counts[s.id]}</span></Button><Switch checked={state.visible.includes(s.id)&&!state.isolate} onCheckedChange={()=>toggle(s.id)} aria-label={`Show ${s.name.toLowerCase()}`}/></div>)}</div>
    <div className="panel-foot"><span><strong>{visibleCount.toLocaleString()}</strong> {visibleCount===1?'piece':'pieces'} visible</span><Button variant="ghost" onClick={()=>applySystems([])}>Hide all</Button></div>
   </section>

   {panel==='search'&&<section className="search-panel glass" aria-label="Find anatomy">
    <div className="panel-heading"><div className="panel-title-block"><span className="panel-kicker">Atlas search</span><h2>Find a structure</h2></div><Button variant="ghost" className="icon-button" onClick={()=>{setPanel(null);if(chosen)setDetails(true);}} aria-label="Close search" title="Close search"><X size={19}/></Button></div>
    <Combobox<Concept> items={results} value={null} onValueChange={value=>{if(value)chooseSearch(value);}} inputValue={query} onInputValueChange={updateQuery} itemToStringLabel={c=>c.name} filter={null} open onOpenChange={open=>{if(!open){setPanel(null);if(chosen)setDetails(true);}}}>
     <ComboboxInput autoFocus placeholder="Heart, femur, cranial nerve..." aria-label="Search named anatomical structures" showTrigger={false}/>
     <ComboboxContent className="anatomy-search-results"><ComboboxEmpty>No structures match your search.</ComboboxEmpty><ComboboxList>{(c:Concept)=><ComboboxItem key={c.id} value={c}><span className="search-result-name">{c.name}</span><span className="small-number">{c.elements.length} {c.elements.length===1?'piece':'pieces'}</span></ComboboxItem>}</ComboboxList></ComboboxContent>
    </Combobox>
    <p className="search-note">{query?'Choose a result to replace the current view and isolate it.':'Start with a major organ, or search every named structure.'}</p>
   </section>}

   <nav className="view-controls glass" aria-label="Camera controls"><span className="control-rail-label desktop-only">{orientation==='free'?'FREE':orientation==='three-quarter'?'3/4':orientation.toUpperCase()}</span>{(['three-quarter','front','side','back'] as View[]).map((v,i)=><ControlTip key={v} label={`${v} camera view`} side="left"><Button variant="ghost" className={orientation===v?'active':''} aria-pressed={orientation===v} disabled={state.explode>.8&&v!=='front'} onClick={()=>{setOrientation(v);setState(s=>({...s,view:v,reset:s.reset+1,rotate:false}));}} aria-label={`${v} view`} title={`${v} camera view`}><span>{['3/4','F','S','B'][i]}</span></Button></ControlTip>)}<i/><ControlTip label={state.rotate?'Pause automatic rotation':'Rotate the body automatically'} side="left"><Button variant="ghost" disabled={state.explode>=.4} aria-label={state.rotate?'Pause rotation':'Rotate body'} title={state.rotate?'Pause automatic rotation':'Rotate the body automatically'} className={state.rotate?'active':''} onClick={()=>setState(s=>({...s,rotate:!s.rotate}))}>{state.rotate?<Pause size={18}/>:<RotateCw size={19}/>}</Button></ControlTip><ControlTip label="Reset view, layers and selection" side="left"><Button variant="ghost" aria-label="Reset view and layers" title="Reset view, layers and selection" onClick={home}><RotateCcw size={18}/></Button></ControlTip></nav>

   <div className="scene-caption" aria-live="polite"><span className="caption-line"/><span className="caption-index">01</span><span>{state.isolate?(chosen?.name??'SELECTED STRUCTURE'):state.explode>.95?'ANATOMICAL INVENTORY':state.explode>.05?'SEPARATED STRUCTURES':'ADULT HUMAN - MALE'}</span><span className="caption-line"/></div>

   {!chosen&&opening==='hidden'&&currentFact&&<aside className="discovery-card glass" aria-label="Anatomy Discovery"><div className="discovery-heading"><div><span className="panel-kicker">Anatomy Discovery</span><h2>Did you know?</h2><span className="fact-category">{currentFact.category}</span></div><span className="fact-count">{factIndex%factPool.length+1}/{factPool.length}</span></div><p key={currentFact.id}>{currentFact.text}</p><div className="discovery-actions"><div className="fact-links"><a href={currentFact.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Source: ${currentFact.sourceName}`}>Verified source <ArrowUpRight size={13}/></a>{factConcept&&<Button variant="ghost" className="fact-explore" onClick={()=>chooseSearch(factConcept)}><Focus size={13}/>Explore in 3D</Button>}</div><div className="fact-nav"><ControlTip label="Previous fact"><Button variant="ghost" onClick={()=>moveFact(-1)} aria-label="Previous anatomy fact" title="Previous fact"><ArrowLeft size={17}/></Button></ControlTip><ControlTip label="Next fact"><Button variant="ghost" onClick={()=>moveFact(1)} aria-label="Next anatomy fact" title="Next fact"><ArrowRight size={17}/></Button></ControlTip></div></div></aside>}

   <div className="bottom-dock glass"><Button variant="ghost" className="mobile-only dock-layers" onClick={()=>openPanel('layers')} aria-label="Open system layers"><Layers3 size={21}/><span>Systems</span></Button><div className="explode-control"><div className="explode-label"><div><span className="dock-kicker">Spatial view</span><label id="explode-label">Explode anatomy</label></div><output>{Math.round(state.explode*100)}<span>%</span></output></div><Slider aria-labelledby="explode-label" min={0} max={100} step={1} value={[state.explode*100]} onValueChange={v=>setState(s=>({...s,explode:(Array.isArray(v)?v[0]:v)/100,rotate:false}))} onValueCommitted={()=>requestCamera({type:'fit',preserveDirection:true})}/><div className="slider-endpoints"><span>Assembled</span><span>Every piece</span></div></div><Button variant="ghost" className="dock-reset" onClick={home} aria-label="Assemble and reset"><RotateCcw size={19}/><span>Reset</span></Button></div>

   <footer className="studio-footer"><div className="footer-credit"><span className="footer-pulse"/>Customized and developed by <strong>Arshad Abbas</strong></div><span className="interaction-hint">{state.explode>.8?'Drag to pan':'Drag to orbit'} <b>-</b> Pinch to zoom <b>-</b> Tap to inspect</span><Button variant="ghost" aria-label="Open sources and medical disclaimer" title="Sources and medical disclaimer" onClick={()=>{setLearn(false);setPanel(null);setAbout(true);}}>Sources & disclaimer <ArrowUpRight size={13}/></Button></footer>

   {notice&&<div className="atlas-notice" role="status"><span>{notice}</span><Button variant="ghost" className="icon-button" onClick={()=>setNotice('')} aria-label="Dismiss message" title="Dismiss message"><X size={17}/></Button></div>}
  </div>

  {(opening!=='hidden'||error)&&<section className={`opening-screen ${opening==='ready'&&!error?'is-ready':''} ${error?'has-error':''}`} role={error?'alert':'status'} aria-live="polite">
   <div className="opening-grid" aria-hidden="true"/><div className="scan-line" aria-hidden="true"/><div className="diagnostic-rings" aria-hidden="true"><i/><i/><i/></div>
   <div className="opening-content"><AnatomyLogo size="opening"/><div className="opening-owner">ARSHAD ABBAS</div><div className="opening-title">HUMAN ANATOMY LAB <strong>3D</strong></div><p>Interactive 3D Learning Platform</p>{error?<div className="opening-error"><strong>Atlas could not be prepared</strong><span>{error}</span><Button onClick={retry}>Retry</Button></div>:opening==='ready'?<div className="ready-state"><span className="ready-dot"/><span><strong>100%</strong> ATLAS READY</span></div>:<div className="opening-progress"><div><span>Preparing anatomical structures</span><output>{loadPercent}%</output></div><div className="opening-track"><i style={{width:`${loadPercent}%`}}/></div><small>{atlas&&totalChunks?`${loadedChunks} of ${totalChunks} model packages loaded`:'Loading anatomy catalogue'}</small></div>}</div>
  </section>}

  <Sheet open={details&&selectedParts.length>0} modal={false} disablePointerDismissal onOpenChange={handleDetailsOpen}>
   <SheetContent initialFocus={detailTitle} className={`detail-sheet glass ${state.isolate?'is-isolated':''}`} showCloseButton={true}>
    <div className="detail-header"><div className="detail-accent" style={{background:system?.color}}/><div className="panel-kicker">{system?.name??'ANATOMY'} - STRUCTURE PROFILE</div><SheetTitle ref={detailTitle} tabIndex={-1} className="structure-title">{profile?.displayName??chosen?.name}</SheetTitle>{profile&&<span className={`content-level level-${profile.quality}`}>{profile.quality==='exact'?'Structure-specific information':profile.quality==='family'?'Related anatomical information':'System overview'}</span>}</div>
    <div className="detail-scroll" key={`${chosen?.id}-${state.isolate}`}>
     <div className="structure-meta"><span>Atlas reference<strong>{profile?.fmaId??chosen?.id}</strong></span><span>Selected pieces<strong>{state.selected.length.toLocaleString()}</strong></span></div>
     {profile&&<div className={`education-content quality-${profile.quality}`}>
      <section className="definition-section" aria-labelledby="structure-definition-heading"><div className="definition-heading"><h3 id="structure-definition-heading">Definition</h3><span>{profile.definitionResolution==='exact-fma'?'Canonical structure definition':profile.definitionResolution==='canonical'?'Canonical concept definition':profile.definitionResolution==='family'?'Source-supported family definition':'Source-supported system definition'}</span></div><p>{profile.definition}</p></section>
      <section><h3>{profile.quality==='classification'?'Scope':'Overview'}</h3><p>{profile.identification}</p></section>
      {profile.partOf&&<section><h3>Part of</h3><p>{profile.partOf}</p></section>}
      {profile.familyName&&<section><h3>Related anatomy</h3><p>{profile.familyName}</p></section>}
      {profile.location&&<section><h3>Location</h3><p>{profile.location}</p></section>}
      {profile.mainFunction&&<section><h3>Function</h3><p>{profile.mainFunction}</p></section>}
      {profile.articulations?.length&&<section><h3>Articulations</h3><ul>{profile.articulations.map(item=><li key={item}>{item}</li>)}</ul></section>}
      {profile.attachments?.length&&<section><h3>Attachments</h3><ul>{profile.attachments.map(item=><li key={item}>{item}</li>)}</ul></section>}
      {profile.relatedStructures?.length&&<section><h3>Related structures</h3><ul>{profile.relatedStructures.map(item=><li key={item}>{item}</li>)}</ul></section>}
      {profile.facts.length>0&&<section><h3>{profile.quality==='family'?`About the ${profile.familyName} family`:'Did you know?'}</h3><ul>{profile.facts.map(fact=><li key={fact}>{fact}</li>)}</ul></section>}
      {profile.clinical&&<section><h3>Clinical relevance</h3><p>{profile.clinical}</p></section>}
      <section className="atlas-details"><h3>Atlas details</h3><dl><div><dt>System</dt><dd>{system?.name??profile.system}</dd></div><div><dt>Profile level</dt><dd>{profile.quality==='exact'?'Exact structure':profile.quality==='family'?'Verified family':'Atlas classification'}</dd></div>{profile.laterality&&<div><dt>Side</dt><dd>{profile.laterality}</dd></div>}{profile.region&&<div><dt>Region terms</dt><dd>{profile.region}</dd></div>}<div><dt>Resolution</dt><dd>{profile.resolution.replaceAll('-',' ')}</dd></div></dl></section>
      <section className="education-sources"><h3>Sources</h3>{sourcesFor(profile.sourceIds).map(source=><a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.name}<ArrowUpRight size={13}/></a>)}</section>
     </div>}
     {currentFact&&<section className="detail-fact"><div className="fact-heading"><div><span className="panel-kicker">{factCollection.label}</span><span className="fact-category">{currentFact.category}</span></div><span>{factIndex%factPool.length+1}/{factPool.length}</span></div><p key={currentFact.id}>{currentFact.text}</p><div className="detail-fact-actions"><div className="fact-links"><a href={currentFact.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Source: ${currentFact.sourceName}`}>Fact source <ArrowUpRight size={12}/></a>{factConcept&&factConcept.id!==chosen?.id&&<Button variant="ghost" className="fact-explore" onClick={()=>chooseSearch(factConcept)}><Focus size={13}/>Explore in 3D</Button>}</div><div className="fact-nav"><ControlTip label="Previous related fact"><Button variant="ghost" onClick={()=>moveFact(-1)} aria-label="Previous related fact" title="Previous related fact"><ArrowLeft size={16}/></Button></ControlTip><ControlTip label="Next related fact"><Button variant="ghost" onClick={()=>moveFact(1)} aria-label="Next related fact" title="Next related fact"><ArrowRight size={16}/></Button></ControlTip></div></div></section>}
     {selectedParts.length>1&&<div className="member-list"><h3>Included structures</h3>{selectedParts.slice(0,50).map(p=><Button variant="ghost" key={p.id} onClick={()=>choosePart(p.id)}><span>{p.name}</span><ChevronRight size={14}/></Button>)}{selectedParts.length>50&&<p>And {selectedParts.length-50} more modeled pieces.</p>}</div>}
     <a className="source-link" href="https://lifesciencedb.jp/bp3d/" target="_blank" rel="noreferrer">View BodyParts3D anatomical source <ArrowUpRight size={14}/></a>
     <p className="education-disclaimer">Educational information only - not medical advice.</p>
    </div>
    <div className="detail-actions"><Button className="learn-action" onClick={openLearn}><BookOpenCheck size={18}/><span>Learn this structure</span><ChevronRight size={16}/></Button>{searchIsolated?<Button className="primary-action active" onClick={returnToAtlas}><ArrowLeft size={18}/>Return to atlas</Button>:<Button className={`primary-action ${state.isolate?'active':''}`} onClick={()=>setState(s=>({...s,isolate:!s.isolate,explode:0}))}><Focus size={18}/>{state.isolate?'Show surrounding anatomy':'Isolate structure'}<ChevronRight size={16}/></Button>}<Button variant="ghost" className="secondary-action" onClick={clearSelection}>{searchIsolated?'Restore previous atlas view':'Clear selection'}</Button></div>
   </SheetContent>
  </Sheet>

  <Sheet open={learn&&selectedParts.length>0} modal={false} disablePointerDismissal onOpenChange={handleLearnOpen}>
   <SheetContent initialFocus={learnTitle} className={`learn-sheet glass ${state.isolate?'is-isolated':''}`} showCloseButton={true}>
    {learning&&<>
     <header className="learn-header"><div className="learn-accent"><BookOpenCheck size={17}/><span>LEARN THIS STRUCTURE</span></div><SheetTitle ref={learnTitle} tabIndex={-1} className="learn-title">{learning.displayName}</SheetTitle><div className="learn-meta"><span>{learning.pronunciation}</span><span className="learn-progress" aria-live="polite"><Check size={13}/>{learnedIds.length.toLocaleString()} / {atlas?.concepts.length.toLocaleString()??'0'} learned</span></div></header>
     <div className="learn-toolbar"><label htmlFor="simple-english"><span>Simple English</span><small>{simpleEnglish?'Plain-language explanations':'Standard anatomical language'}</small></label><Switch id="simple-english" checked={simpleEnglish} onCheckedChange={setSimpleEnglish} aria-label="Use simple English"/></div>
     <div className="learn-scroll">
      <section className="learn-card learn-definition"><h3>Definition</h3><p>{learnText(learning.definition)}</p></section>
      <div className="learn-grid">
       {learning.location&&<section className="learn-card"><h3>Location</h3><p>{learnText(learning.location)}</p></section>}
       {learning.partOf&&<section className="learn-card"><h3>Part of</h3><p>{learnText(learning.partOf)}</p></section>}
       {learning.mainFunction&&<section className="learn-card"><h3>Main function</h3><p>{learnText(learning.mainFunction)}</p></section>}
      </div>
      {learning.relationships.length>0&&<section className="learn-card"><h3>Important anatomical relationships</h3>{learning.relationships.map(group=><div className="relationship-group" key={group.label}><h4>{group.label}</h4><ul>{group.items.map(item=><li key={item}>{learnText(item)}</li>)}</ul></div>)}</section>}
      <section className="learn-card model-guide"><div><h3>Identify it in the 3D model</h3><Badge variant="outline">Atlas guide</Badge></div><p>{learnText(learning.identifyInModel)}</p></section>
      {learning.clinical&&<section className="learn-card clinical-card"><h3>Clinical relevance</h3><p>{learnText(learning.clinical)}</p></section>}
      <section className="learn-card fact-card"><h3>Interesting fact</h3><p>{learnText(learning.interestingFact)}</p></section>
      {learning.relatedStructures.length>0&&<section className="learn-card"><h3>Related structures</h3><ul>{learning.relatedStructures.map(item=><li key={item}>{learnText(item)}</li>)}</ul></section>}
      <details className="orientation-help"><summary><span><Compass size={17}/>Anatomical Orientation</span><small>Directional terms and body planes</small></summary><div className="orientation-grid">{ORIENTATION_HELP.map(item=><section key={item.term}><h3>{item.term}</h3><p>{item.explanation}</p></section>)}</div><a href={ORIENTATION_SOURCE.url} target="_blank" rel="noreferrer">Orientation source: {ORIENTATION_SOURCE.name}<ArrowUpRight size={13}/></a></details>
      <section className="knowledge-check"><div className="knowledge-heading"><span className="panel-kicker">THREE-QUESTION RECALL</span><h3>Knowledge check</h3><p>Try each question before revealing the source-supported answer.</p></div>{learning.questions.map((question,index)=><details className="quiz-item" key={question.id}><summary><span>{index+1}</span>{question.prompt}</summary><p>{learnText(question.answer)}</p></details>)}</section>
      <section className="learn-sources"><h3>Source references</h3>{learning.sources.map(source=><a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.name}<ArrowUpRight size={13}/></a>)}</section>
      <p className="education-disclaimer">Educational information only - not medical advice.</p>
     </div>
     <div className="learn-actions"><div className="learn-view-actions"><Button variant="ghost" onClick={toggleLearnIsolation} aria-label={state.isolate?'Show surrounding anatomy':'Isolate structure'}><Focus size={17}/>{state.isolate?'Show context':'Isolate structure'}</Button><Button variant="ghost" onClick={resetLearnView} aria-label="Reset learning view"><RotateCcw size={17}/>Reset view</Button></div><Button className={`mark-learned ${isLearned?'is-learned':''}`} aria-pressed={isLearned} onClick={toggleLearned}><Check size={18}/>{isLearned?'Marked as learned':'Mark as learned'}</Button></div>
    </>}
   </SheetContent>
  </Sheet>

  <Sheet open={about} onOpenChange={setAbout}><SheetContent className="about-sheet glass"><div className="about-brand"><AnatomyLogo/><div><span>ARSHAD ABBAS</span><strong>Human Anatomy Lab <b>3D</b></strong><small>Interactive 3D Learning Platform</small></div></div><div className="panel-kicker">SOURCE, CREDIT & SCOPE</div><SheetTitle className="structure-title">Anatomy with context.</SheetTitle><SheetDescription>Explore an adult male reference anatomy interactively in three dimensions.</SheetDescription><div className="about-copy"><p className="credit-line">Customized and developed by <strong>Arshad Abbas</strong>.</p><h3>Quick controls</h3><div className="help-grid"><div><Move3D size={18}/><span><strong>Drag</strong> to rotate</span></div><div><ZoomIn size={18}/><span><strong>Pinch or wheel</strong> to zoom</span></div><div><MousePointer2 size={18}/><span><strong>Tap a structure</strong> to inspect</span></div><div><Focus size={18}/><span><strong>Use Isolate</strong> to view it alone</span></div><div><RotateCcw size={18}/><span><strong>Home or Reset</strong> restores the atlas</span></div></div><h3>Anatomical source</h3><p><strong>BodyParts3D</strong> supplies the anatomical geometry and metadata: {atlas?.parts.length.toLocaleString()??'2,234'} individual meshes and {atlas?.concepts.length.toLocaleString()??'3,432'} named concepts from an adult male reference anatomy. Arshad Abbas is credited for customization and interface development, not for creating the anatomical models.</p><p>This reference does not contain every human structure or variation. Named concepts can contain multiple pieces; each source mesh is rendered once.</p><div className="disclaimer"><span>Medical disclaimer</span><p>Colors, system groupings and concise explanations are provided for general educational exploration. This atlas is not a diagnostic, clinical or surgical tool and does not replace professional medical advice.</p></div><p className="license-copy">BodyParts3D, (c) The Database Center for Life Science, licensed under CC Attribution 4.0 International.</p><div className="source-links"><a href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html" target="_blank" rel="noreferrer">Dataset license <ArrowUpRight size={14}/></a><a href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html" target="_blank" rel="noreferrer">Original geometry & metadata <ArrowUpRight size={14}/></a><a href="https://academic.oup.com/nar/article/37/suppl_1/D782/1000752" target="_blank" rel="noreferrer">Source publication <ArrowUpRight size={14}/></a></div></div></SheetContent></Sheet>
 </main></TooltipProvider>;
}
