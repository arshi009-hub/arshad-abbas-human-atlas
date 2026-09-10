import type {AnatomyFact,EducationProfile,EducationSource} from './education-content';

export const LEARNED_STORAGE_KEY='arshad-anatomy-lab-learned-v1';
export const LEARN_CAMERA_COMMAND={type:'fit',preserveDirection:true} as const;

export interface LearningQuestion {id:'definition'|'function'|'fact';prompt:string;answer:string}
export interface LearningRelationshipGroup {label:string;items:string[]}
export interface LearningProfile {
 displayName:string;
 pronunciation:string;
 definition:string;
 location?:string;
 partOf?:string;
 mainFunction?:string;
 relationships:LearningRelationshipGroup[];
 identifyInModel:string;
 clinical?:string;
 interestingFact:string;
 sources:EducationSource[];
 relatedStructures:string[];
 questions:LearningQuestion[];
}

export const ORIENTATION_HELP=[
 {term:'Anterior and posterior',explanation:'Anterior means toward the front of the body; posterior means toward the back.'},
 {term:'Superior and inferior',explanation:'Superior means above or toward the head; inferior means below or toward the feet.'},
 {term:'Medial and lateral',explanation:'Medial means closer to the body’s midline; lateral means farther from the midline.'},
 {term:'Proximal and distal',explanation:'On a limb, proximal means nearer its attachment to the trunk; distal means farther from that attachment.'},
 {term:'Sagittal plane',explanation:'A sagittal plane divides the body or an organ into right and left portions.'},
 {term:'Coronal plane',explanation:'A coronal, or frontal, plane divides the body or an organ into front and back portions.'},
 {term:'Transverse plane',explanation:'A transverse plane crosses horizontally and divides the body or an organ into upper and lower portions.'},
] as const;

const EXACT_PRONUNCIATIONS:Record<string,string>={
 'medulla oblongata':'meh-DUL-uh ob-long-GAH-tuh',
 'transverse mesocolon':'trans-VURS mez-oh-KOH-lon',
 'external oblique':'ek-STUR-nul oh-BLEEK',
 'right external oblique':'right ek-STUR-nul oh-BLEEK',
 'left external oblique':'left ek-STUR-nul oh-BLEEK',
 'parietal bone':'puh-RYE-uh-tul bone',
 'right parietal bone':'right puh-RYE-uh-tul bone',
 'left parietal bone':'left puh-RYE-uh-tul bone',
 'first metacarpal bone':'first met-uh-KAR-pul bone',
 'trapezius':'truh-PEE-zee-us',
 'gallbladder':'GAWL-blad-er',
};

const WORD_PRONUNCIATIONS:Record<string,string>={
 abdomen:'AB-doh-men',abdominal:'ab-DOM-ih-nul',anterior:'an-TEER-ee-or',artery:'AR-tuh-ree',atrium:'AY-tree-um',
 biliary:'BILL-ee-air-ee',brain:'brayn',cardiac:'KAR-dee-ak',caudate:'KAW-dayt',cerebellum:'ser-uh-BELL-um',cerebral:'seh-REE-brul',
 colon:'KOH-lon',coronal:'kuh-ROH-nul',cranial:'KRAY-nee-ul',diaphragm:'DYE-uh-fram',distal:'DIS-tul',duodenum:'doo-OD-uh-num',
 epiglottis:'ep-ih-GLAH-tis',femur:'FEE-mer',hepatic:'heh-PAT-ik',hippocampal:'hip-oh-KAM-pul',inferior:'in-FEER-ee-or',
 intestine:'in-TES-tin',kidney:'KID-nee',larynx:'LAIR-inks',lateral:'LAT-er-ul',ligament:'LIG-uh-ment',lobe:'lohb',
 medial:'MEE-dee-ul',mesocolon:'mez-oh-KOH-lon',metacarpal:'met-uh-KAR-pul',muscle:'MUS-ul',nerve:'nerv',oblique:'oh-BLEEK',
 pancreas:'PAN-kree-us',parietal:'puh-RYE-uh-tul',patella:'puh-TELL-uh',posterior:'pos-TEER-ee-or',proximal:'PROK-sih-mul',
 sagittal:'SAJ-ih-tul',spinal:'SPY-nul',stomach:'STUM-uk',superior:'soo-PEER-ee-or',tentorium:'ten-TOR-ee-um',
 thoracic:'thuh-RASS-ik',trapezius:'truh-PEE-zee-us',transverse:'trans-VURS',tributary:'TRIB-yoo-tair-ee',vein:'vayn',ventricle:'VEN-trih-kul',
};

const SIMPLE_SUBSTITUTIONS:Array<[RegExp,string]>=[
 [/\bmiddle mediastinum\b/gi,'central space between the lungs'],
 [/\bmediastinum\b/gi,'central area of the chest'],
 [/\bcranial cavity\b/gi,'space inside the skull'],
 [/\bposterior cranial fossa\b/gi,'lower space at the back of the skull'],
 [/\bretroperitoneal\b/gi,'behind the abdominal lining'],
 [/\banterolateral\b/gi,'front and side'],
 [/\bduodenum\b/gi,'first part of the small intestine'],
 [/\blymphatics\b/gi,'lymph vessels'],
 [/\bviscera\b/gi,'internal organs'],
 [/\bvisceral\b/gi,'organ-facing'],
 [/\bproximally\b/gi,'at the nearer end'],
 [/\bdistally\b/gi,'at the farther end'],
 [/\bprincipal\b/gi,'main'],
 [/\bcontributes to\b/gi,'helps with'],
 [/\bparticipates in\b/gi,'helps with'],
];

const uniqueText=(values:Array<string|undefined>)=>{
 const seen=new Set<string>();
 return values.filter((value):value is string=>{
  if(!value?.trim())return false;
  const key=normalizeStructureName(value);
  if(seen.has(key))return false;
  seen.add(key);return true;
 });
};

const normalizeStructureName=(name:string)=>name.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const normalizeFmaId=(reference:string)=>{const compact=reference.trim().replace(/\s+/g,''),match=compact.match(/^(?:FMA:?)?(\d+)$/i);return match?`FMA${match[1]}`:compact.toUpperCase();};
const escapeRegExp=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

export function pronunciationFor(name:string){
 const normalized=normalizeStructureName(name),exact=EXACT_PRONUNCIATIONS[normalized];
 if(exact)return exact;
 return normalized.split(' ').map(word=>WORD_PRONUNCIATIONS[word]??word).join(' ');
}

export function toSimpleEnglish(text:string,protectedName=''){
 if(!text)return text;
 const marker='__SELECTED_STRUCTURE__',namePattern=protectedName?new RegExp(escapeRegExp(protectedName),'gi'):null,matches=namePattern?text.match(namePattern):null;
 let result=namePattern?text.replace(namePattern,marker):text;
 for(const [pattern,replacement] of SIMPLE_SUBSTITUTIONS)result=result.replace(pattern,replacement);
 if(matches?.length)for(const match of matches)result=result.replace(marker,match);
 return result;
}

export function parseLearnedIds(value:string|null){
 if(!value)return [];
 try{
  const parsed:unknown=JSON.parse(value);
  if(!Array.isArray(parsed))return [];
  return [...new Set(parsed.filter((id):id is string=>typeof id==='string').map(normalizeFmaId).filter(id=>/^FMA\d+$/.test(id)))];
 }catch{return [];}
}

export function toggleLearnedId(ids:string[],id:string){
 const normalized=normalizeFmaId(id),current=new Set(ids.map(normalizeFmaId));
 if(current.has(normalized))current.delete(normalized);else current.add(normalized);
 return [...current].sort((a,b)=>Number(a.slice(3))-Number(b.slice(3)));
}

export function serializeLearnedIds(ids:string[]){return JSON.stringify([...new Set(ids.map(normalizeFmaId).filter(id=>/^FMA\d+$/.test(id)))]);}

export function buildLearningProfile(profile:EducationProfile,fact:AnatomyFact,systemName:string,profileSources:EducationSource[]):LearningProfile{
 const facts=uniqueText(profile.facts),functionAnswer=profile.mainFunction??facts[0]??profile.definition,factAnswer=facts.find(item=>normalizeStructureName(item)!==normalizeStructureName(functionAnswer))??fact.text;
 const relationships:LearningRelationshipGroup[]=[
  {label:'Articulations',items:uniqueText(profile.articulations??[])},
  {label:'Attachments',items:uniqueText(profile.attachments??[])},
 ].filter(group=>group.items.length>0);
 const sourceMap=new Map<string,EducationSource>();
 for(const source of [...profileSources,{name:fact.sourceName,url:fact.sourceUrl}])sourceMap.set(source.url,source);
 const sideGuide=profile.laterality?` Its canonical name identifies the ${profile.laterality.toLowerCase()} side.`:'';
 return {
  displayName:profile.displayName,
  pronunciation:pronunciationFor(profile.displayName),
  definition:profile.definition,
  location:profile.location,
  partOf:profile.partOf,
  mainFunction:profile.mainFunction,
  relationships,
  identifyInModel:`Look for ${profile.displayName} highlighted in cyan in the 3D view. The current selection contains ${profile.pieceCount.toLocaleString()} modeled ${profile.pieceCount===1?'piece':'pieces'} within the ${systemName.toLowerCase()} layer.${sideGuide} Rotate the model or use Isolate structure to inspect its visible boundaries.`,
  clinical:profile.clinical,
  interestingFact:fact.text,
  sources:[...sourceMap.values()],
  relatedStructures:uniqueText(profile.relatedStructures??[]),
  questions:[
   {id:'definition',prompt:`How would you define ${profile.displayName}?`,answer:profile.definition},
   {id:'function',prompt:profile.mainFunction?`What is the main function of ${profile.displayName}?`:`What source-supported point helps place ${profile.displayName} in context?`,answer:functionAnswer},
   {id:'fact',prompt:`What is one useful fact to remember about ${profile.displayName}?`,answer:factAnswer},
  ],
 };
}

export const ORIENTATION_SOURCE:EducationSource={name:'OpenStax Anatomy and Physiology 2e - Anatomical Terminology',url:'https://openstax.org/books/anatomy-and-physiology-2e/pages/1-6-anatomical-terminology'};
