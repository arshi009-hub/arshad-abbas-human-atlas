import type {AnatomyFact,EducationProfile,EducationSource} from './education-content';

export const LEARNED_STORAGE_KEY='arshad-anatomy-lab-learned-v1';
export const LEARN_CAMERA_COMMAND={type:'fit',preserveDirection:true} as const;

export interface LearningQuestion {id:'definition'|'function'|'fact'|'location'|'relationship'|'clinical'|'part-of';prompt:string;answer:string}
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

// Plain-language rewrites, longest phrases first. Proper names that contain these words
// (superior vena cava, lateral ventricle, cranial nerve) are left alone by matching only
// adverbs and "<direction> side/surface/end/part" phrases, never bare adjectives.
const SIMPLE_SUBSTITUTIONS:Array<[RegExp,string|((...args:any[])=>string)]>=[
 [/\bwhen laterality is specified\b/gi,'when the name says which side'],
 [/\blaterality\b/gi,'which side of the body'],
 [/\bmiddle mediastinum\b/gi,'central space between the lungs'],
 [/\bmediastinum\b/gi,'central area of the chest'],
 [/\bposterior cranial fossa\b/gi,'lower space at the back of the skull'],
 [/\bcranial cavity\b/gi,'space inside the skull'],
 [/\bcranial bones?\b/gi,match=>match.toLowerCase().endsWith('s')?'skull bones':'skull bone'],
 [/\bthoracic cavity\b/gi,'chest cavity'],
 [/\babdominal cavity\b/gi,'belly cavity'],
 [/\bvertebral canal\b/gi,'tunnel through the spine'],
 [/\bretroperitoneal\b/gi,'behind the abdominal lining'],
 [/\bperitoneum\b/gi,'abdominal lining'],
 [/\banterolateral\b/gi,'front and side'],
 [/\bposterolateral\b/gi,'back and side'],
 [/\banteromedial\b/gi,'front and inner'],
 [/\bposteromedial\b/gi,'back and inner'],
 [/\barticulating (\w+ly )?with\b/gi,'forming a joint $1with'],[/\barticulates (\w+ly )?with\b/gi,'forms a joint $1with'],[/\barticulations\b/gi,'joints'],[/\barticulation\b/gi,'joint'],
 [/\bthe proximal (\w+)/gi,'the end of the $1 nearer the trunk'],
 [/\bthe distal (\w+)/gi,'the end of the $1 farther from the trunk'],
 [/\bproximally\b/gi,'at the end nearer the trunk'],
 [/\bdistally\b/gi,'at the end farther from the trunk'],
 [/\banteriorly\b/gi,'toward the front'],[/\bposteriorly\b/gi,'toward the back'],
 [/\bsuperiorly\b/gi,'upward'],[/\binferiorly\b/gi,'downward'],
 [/\bmedially\b/gi,'toward the midline'],[/\blaterally\b/gi,'away from the midline'],
 [/\b(anterior|posterior|superior|inferior|medial|lateral) (side|surface|end|border|part|aspect|wall)\b/gi,(_m,dir:string,noun:string)=>`${({anterior:'front',posterior:'back',superior:'upper',inferior:'lower',medial:'inner',lateral:'outer'} as Record<string,string>)[dir.toLowerCase()]} ${noun}`],
 [/\bipsilateral\b/gi,'same-side'],[/\bcontralateral\b/gi,'opposite-side'],[/\bbilateral\b/gi,'two-sided'],
 [/\bupper limbs?\b/gi,match=>match.toLowerCase().endsWith('s')?'arms':'arm'],
 [/\blower limbs?\b/gi,match=>match.toLowerCase().endsWith('s')?'legs':'leg'],
 [/\bthorax\b/gi,'chest'],[/\bthoracic\b/gi,'chest'],
 [/\bduodenum\b/gi,'first part of the small intestine'],
 [/\bsesamoid bone\b/gi,'small bone that sits inside a tendon'],
 [/\bfibrocartilage\b/gi,'tough, flexible cartilage'],
 [/\bfibromuscular\b/gi,'muscle-and-fiber'],
 [/\bdistensible\b/gi,'stretchy'],
 [/\blymphatics\b/gi,'lymph vessels'],
 [/\bvasculature\b/gi,'blood vessels'],
 [/\bmusculature\b/gi,'muscles'],
 [/\binnervation\b/gi,'nerve supply'],
 [/\bviscera\b/gi,'internal organs'],
 [/\bvisceral\b/gi,'organ-facing'],
 [/\blumen\b/gi,'inner channel'],
 [/\binspiration\b/gi,'breathing in'],[/\bexpiration\b/gi,'breathing out'],
 [/\bsynthesizes\b/gi,'makes'],[/\bsecretes\b/gi,'releases'],[/\bsecretions\b/gi,'fluids it releases'],
 [/\btransmits\b/gi,'passes on'],[/\bconducts\b/gi,'carries'],[/\bconveys\b/gi,'carries'],
 [/\bfacilitates\b/gi,'helps'],[/\bregulates\b/gi,'controls'],[/\bregulate\b/gi,'control'],
 [/\bcomprising\b/gi,'made up of'],[/\bsituated\b/gi,'located'],[/\bapproximately\b/gi,'about'],
 [/\bsubdivisions?\b/gi,match=>match.toLowerCase().endsWith('s')?'parts':'part'],
 [/\bcanonical\b/gi,'standard'],
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
 for(const [pattern,replacement] of SIMPLE_SUBSTITUTIONS)result=typeof replacement==='string'?result.replace(pattern,replacement):result.replace(pattern,replacement as (...args:string[])=>string);
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
  questions:recallQuestions(profile,functionAnswer,factAnswer),
 };
}

/** Three recall questions built from the structure's own sourced fields, so they differ between
 * structures and ask about place, relationships and relevance rather than restating the definition. */
function recallQuestions(profile:EducationProfile,functionAnswer:string,factAnswer:string):LearningQuestion[]{
 const name=profile.displayName.length?profile.displayName[0].toLowerCase()+profile.displayName.slice(1):profile.displayName,the=`the ${name}`;
 const articulation=profile.articulations?.[0],attachment=profile.attachments?.[0];
 const candidates:Array<LearningQuestion|undefined>=[
  profile.location?{id:'location',prompt:`Where in the body is ${the} found?`,answer:profile.location}:undefined,
  articulation?{id:'relationship',prompt:`Name one structure that ${the} forms a joint with.`,answer:articulation}:attachment?{id:'relationship',prompt:`Name one attachment of ${the}.`,answer:attachment}:undefined,
  profile.mainFunction?{id:'function',prompt:`What does ${the} do?`,answer:profile.mainFunction}:undefined,
  profile.clinical?{id:'clinical',prompt:`Why does ${the} matter in clinical practice?`,answer:profile.clinical}:undefined,
  profile.partOf?{id:'part-of',prompt:`Which larger structure or system is ${the} part of?`,answer:profile.partOf}:undefined,
  {id:'definition',prompt:`In one sentence, what is ${the}?`,answer:profile.definition},
  {id:'fact',prompt:profile.mainFunction?`What is one fact about ${the} beyond its function?`:`What helps place ${the} in context?`,answer:profile.mainFunction?factAnswer:functionAnswer},
 ];
 const chosen:LearningQuestion[]=[],answers=new Set<string>();
 for(const question of candidates){if(!question||chosen.length===3)continue;const key=normalizeStructureName(question.answer);if(!key||answers.has(key))continue;answers.add(key);chosen.push(question);}
 for(const fallback of [{id:'fact' as const,prompt:`What is one useful fact to remember about ${the}?`,answer:factAnswer},{id:'definition' as const,prompt:`How would you define ${the}?`,answer:profile.definition}])if(chosen.length<3)chosen.push(fallback);
 return chosen.slice(0,3);
}

// Spaced repetition: a learned structure comes back for review after 1, 3, 7, 14 and 30 days.
export const LEARNING_RECORDS_KEY='arshad-anatomy-lab-learning-v2';
export const REVIEW_INTERVAL_DAYS=[1,3,7,14,30] as const;
export interface LearningRecord {learnedAt:number;reviewedAt:number;stage:number}
export type LearningRecords=Record<string,LearningRecord>;
const DAY=86_400_000;
export function parseLearningRecords(v2:string|null,legacyV1:string|null,now=Date.now()):LearningRecords{
 const records:LearningRecords={};
 if(v2)try{const parsed:unknown=JSON.parse(v2);if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))for(const [id,value] of Object.entries(parsed as Record<string,unknown>)){const key=normalizeFmaId(id),record=value as Partial<LearningRecord>;if(/^FMA\d+$/.test(key)&&typeof record?.learnedAt==='number'&&typeof record.reviewedAt==='number'&&typeof record.stage==='number')records[key]={learnedAt:record.learnedAt,reviewedAt:record.reviewedAt,stage:Math.max(0,Math.min(REVIEW_INTERVAL_DAYS.length,Math.floor(record.stage)))};}}catch{/* fall back to the legacy list */}
 for(const id of parseLearnedIds(legacyV1))records[id]??={learnedAt:now,reviewedAt:now,stage:0};
 return records;
}
export function serializeLearningRecords(records:LearningRecords){return JSON.stringify(records);}
export function toggleLearningRecord(records:LearningRecords,id:string,now=Date.now()):LearningRecords{
 const key=normalizeFmaId(id),next={...records};
 if(next[key])delete next[key];else next[key]={learnedAt:now,reviewedAt:now,stage:0};
 return next;
}
export function reviewDueAt(record:LearningRecord){return record.stage>=REVIEW_INTERVAL_DAYS.length?Infinity:record.reviewedAt+REVIEW_INTERVAL_DAYS[record.stage]*DAY;}
export function dueForReview(records:LearningRecords,now=Date.now()){return Object.entries(records).filter(([,record])=>reviewDueAt(record)<=now).sort((a,b)=>reviewDueAt(a[1])-reviewDueAt(b[1])).map(([id])=>id);}
export function markReviewed(records:LearningRecords,id:string,remembered:boolean,now=Date.now()):LearningRecords{
 const key=normalizeFmaId(id),record=records[key];if(!record)return records;
 return {...records,[key]:{...record,reviewedAt:now,stage:remembered?Math.min(record.stage+1,REVIEW_INTERVAL_DAYS.length):0}};
}

export const ORIENTATION_SOURCE:EducationSource={name:'OpenStax Anatomy and Physiology 2e - Anatomical Terminology',url:'https://openstax.org/books/anatomy-and-physiology-2e/pages/1-6-anatomical-terminology'};
