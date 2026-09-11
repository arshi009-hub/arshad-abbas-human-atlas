import fs from 'node:fs';
import {
 DISCOVERY_FACTS,
 DEFINITION_FAMILY_RULES,
 EDUCATION_ALIASES,
 EDUCATION_FAMILIES,
 EDUCATION_RECORDS,
 EDUCATION_SOURCES,
 EXACT_DEFINITION_RECORDS,
 FAMILY_DEFINITION_TEMPLATES,
 discoveryFactCollectionFor,
 educationFor,
 normalizeFmaId,
 normalizeStructureName,
 resolveEducationProfile,
} from '../app/education-content.ts';

const atlas=JSON.parse(fs.readFileSync(new URL('../public/models/atlas.json',import.meta.url),'utf8'));
const partsById=new Map(atlas.parts.map(part=>[part.id,part]));
const prohibitedPhrases=[
 'a verified structure-specific explanation is not yet available',
 'verified structure-specific explanation is not yet available',
 'is a named bone',
 'is a named region',
 'is a named structure',
 'is represented in the atlas',
 'is located at the modeled position',
 'is a bony part or grouped skeletal structure',
 'is a named bone, bony part or grouped skeletal structure represented in the atlas',
 'at the modeled position identified by its regional and directional name',
];
const failures=[];
const conceptCounts={exact:0,family:0,classification:0};
const pieceCounts={exact:0,family:0,classification:0};
const conceptDefinitionCounts={'exact-fma':0,canonical:0,family:0,system:0};
const pieceDefinitionCounts={'exact-fma':0,canonical:0,family:0,system:0};
const systemFallbackConcepts=[];
let unresolved=0;
let profilesMissingSources=0,profilesWithProhibitedPhrases=0,definitionsMatchingOverview=0,lateralityConflicts=0;

function percentage(count,total){return `${(count/total*100).toFixed(2)}%`;}
function profileText(profile){return JSON.stringify(profile);}
function hasWord(value,word){return ` ${normalizeStructureName(value)} `.includes(` ${word} `);}
function comparableText(value){return normalizeStructureName(value).replace(/\bthe\b/g,'').replace(/\s+/g,' ').trim();}
function sentenceCount(value){return (value.match(/[.!?](?:\s|$)/g)??[]).length||1;}
function validateProfile(profile,name,reference,kind){
 if(!profile){unresolved++;failures.push(`${kind} ${reference} (${name}) produced no profile.`);return;}
 if(profile.selectedName!==name)failures.push(`${kind} ${reference} did not preserve the selected name.`);
 if(profile.fmaId!==normalizeFmaId(reference))failures.push(`${kind} ${reference} did not preserve its canonical FMA identifier.`);
 const normalizedProfileText=profileText(profile).toLowerCase(),matchedProhibited=prohibitedPhrases.find(phrase=>normalizedProfileText.includes(phrase));
 if(matchedProhibited){profilesWithProhibitedPhrases++;failures.push(`${kind} ${reference} contains prohibited generic copy: ${matchedProhibited}.`);}
 for(const field of ['definition','definitionResolution','definitionRuleId','identification','selectedName','fmaId'])if(typeof profile[field]!=='string'||!profile[field].trim())failures.push(`${kind} ${reference} has an empty ${field}.`);
 for(const field of ['familyName','location','mainFunction','clinical'])if(field in profile&&(typeof profile[field]!=='string'||!profile[field].trim()))failures.push(`${kind} ${reference} has an empty visible ${field}.`);
 for(const field of ['laterality','region'])if(profile[field]!==undefined&&(typeof profile[field]!=='string'||!profile[field].trim()))failures.push(`${kind} ${reference} has an invalid optional ${field}.`);
 if(!Array.isArray(profile.facts)||!profile.facts.length||profile.facts.some(fact=>typeof fact!=='string'||!fact.trim()))failures.push(`${kind} ${reference} has invalid facts.`);
 if(!Array.isArray(profile.sourceIds)||!profile.sourceIds.length||profile.sourceIds.some(id=>!EDUCATION_SOURCES[id])){profilesMissingSources++;failures.push(`${kind} ${reference} has invalid sources.`);}
 if(!Array.isArray(profile.definitionSourceIds)||!profile.definitionSourceIds.length||profile.definitionSourceIds.some(id=>!EDUCATION_SOURCES[id]))failures.push(`${kind} ${reference} has invalid definition sources.`);
 else if(profile.definitionSourceIds.some(id=>!profile.sourceIds.includes(id)))failures.push(`${kind} ${reference} does not expose every definition source in the profile source list.`);
 const definitionRecord=EXACT_DEFINITION_RECORDS.find(record=>record.id===profile.definitionRuleId),definitionFamily=EDUCATION_FAMILIES.some(family=>family.id===profile.definitionRuleId)||DEFINITION_FAMILY_RULES.some(rule=>rule.id===profile.definitionRuleId);
 if(profile.definitionResolution==='exact-fma'&&(!definitionRecord||!definitionRecord.fmaIds.map(normalizeFmaId).includes(normalizeFmaId(reference))))failures.push(`${kind} ${reference} has an untraceable exact definition.`);
 if(profile.definitionResolution==='canonical'&&(!definitionRecord||!definitionRecord.canonicalNames.map(normalizeStructureName).includes(normalizeStructureName(name))))failures.push(`${kind} ${reference} has an untraceable canonical definition.`);
 if(profile.definitionResolution==='family'&&!definitionFamily)failures.push(`${kind} ${reference} has an untraceable family definition.`);
 if(profile.definitionResolution==='system'&&profile.definitionRuleId!==`system-${profile.system}`)failures.push(`${kind} ${reference} has an untraceable system definition.`);
 if(typeof profile.definition==='string'){
  if(profile.definition.trim().split(/\s+/).length<10)failures.push(`${kind} ${reference} has an underdeveloped definition.`);
  const sentences=sentenceCount(profile.definition);if(sentences<1||sentences>3)failures.push(`${kind} ${reference} definition has ${sentences} sentences; expected 1-3.`);
  if(!comparableText(profile.definition).includes(comparableText(profile.displayName)))failures.push(`${kind} ${reference} definition does not name the selected structure.`);
  if(comparableText(profile.definition)===comparableText(profile.identification)){definitionsMatchingOverview++;failures.push(`${kind} ${reference} definition duplicates its overview.`);}
  const definitionText=profile.definition.toLowerCase(),selected=normalizeStructureName(name),allowsBothSides=/\b(?:right and left|left and right|paired)\b/.test(definitionText);
  if(hasWord(selected,'right')&&!allowsBothSides&&/\b(?:left-sided|on the left|left side)\b/.test(definitionText)){lateralityConflicts++;failures.push(`${kind} ${reference} has a right/left definition conflict.`);}
  if(hasWord(selected,'left')&&!allowsBothSides&&/\b(?:right-sided|on the right|right side)\b/.test(definitionText)){lateralityConflicts++;failures.push(`${kind} ${reference} has a left/right definition conflict.`);}
 }
 for(const field of ['articulations','attachments','relatedStructures'])if(profile[field]!==undefined&&(!Array.isArray(profile[field])||!profile[field].length||profile[field].some(value=>typeof value!=='string'||!value.trim())))failures.push(`${kind} ${reference} has invalid ${field}.`);
 if(profile.quality==='family'&&(!profile.familyId||!EDUCATION_FAMILIES.some(family=>family.id===profile.familyId)))failures.push(`${kind} ${reference} has an invalid family match.`);
}

for(const concept of atlas.concepts){
 const selectedParts=concept.elements.map(id=>partsById.get(id)).filter(Boolean);
 const profile=resolveEducationProfile(concept,selectedParts);
 validateProfile(profile,concept.name,concept.id,'Concept');
 if(profile){conceptCounts[profile.quality]++;conceptDefinitionCounts[profile.definitionResolution]++;if(profile.definitionResolution==='system')systemFallbackConcepts.push(`${concept.id} ${concept.name}`);}
}

for(const part of atlas.parts){
 const profile=resolveEducationProfile({id:part.conceptId,name:part.name,elements:[part.id]},[part]);
 validateProfile(profile,part.name,part.conceptId,'Piece');
 if(profile){pieceCounts[profile.quality]++;pieceDefinitionCounts[profile.definitionResolution]++;}
}

const duplicateValues=list=>[...new Set(list.filter((value,index)=>list.indexOf(value)!==index))];
const recordIds=EDUCATION_RECORDS.flatMap(record=>record.fmaIds.map(normalizeFmaId));
const recordNames=EDUCATION_RECORDS.flatMap(record=>record.names.map(normalizeStructureName));
const duplicateIds=[...duplicateValues(recordIds),...duplicateValues(EDUCATION_FAMILIES.map(family=>family.id)),...duplicateValues(DISCOVERY_FACTS.map(fact=>fact.id))];
const duplicateNames=duplicateValues(recordNames);
const duplicateFactTexts=duplicateValues(DISCOVERY_FACTS.map(fact=>normalizeStructureName(fact.text)));
const exactDefinitionIds=EXACT_DEFINITION_RECORDS.flatMap(record=>record.fmaIds.map(normalizeFmaId));
const exactDefinitionNames=EXACT_DEFINITION_RECORDS.flatMap(record=>record.canonicalNames.map(normalizeStructureName));
const duplicateDefinitionIds=duplicateValues(exactDefinitionIds);
const duplicateDefinitionNames=duplicateValues(exactDefinitionNames);
const duplicateDefinitionRuleIds=duplicateValues([...EXACT_DEFINITION_RECORDS.map(record=>record.id),...DEFINITION_FAMILY_RULES.map(rule=>rule.id)]);
if(duplicateIds.length)failures.push(`Duplicate content IDs: ${duplicateIds.join(', ')}`);
if(duplicateNames.length)failures.push(`Duplicate exact names: ${duplicateNames.join(', ')}`);
if(duplicateFactTexts.length)failures.push(`Duplicate fact texts: ${duplicateFactTexts.join(', ')}`);
if(duplicateDefinitionIds.length)failures.push(`Duplicate canonical definition IDs: ${duplicateDefinitionIds.join(', ')}`);
if(duplicateDefinitionNames.length)failures.push(`Conflicting canonical definition names: ${duplicateDefinitionNames.join(', ')}`);
if(duplicateDefinitionRuleIds.length)failures.push(`Duplicate definition rule IDs: ${duplicateDefinitionRuleIds.join(', ')}`);
for(const record of EXACT_DEFINITION_RECORDS){
 if(!record.template.includes('{name}'))failures.push(`Exact definition ${record.id} does not interpolate the selected structure name.`);
 if(!record.sourceIds.length||record.sourceIds.some(id=>!EDUCATION_SOURCES[id]))failures.push(`Exact definition ${record.id} has invalid sources.`);
}
for(const family of EDUCATION_FAMILIES)if(!FAMILY_DEFINITION_TEMPLATES[family.id])failures.push(`Family ${family.id} has no definition template.`);
for(const familyId of Object.keys(FAMILY_DEFINITION_TEMPLATES))if(!EDUCATION_FAMILIES.some(family=>family.id===familyId))failures.push(`Definition template ${familyId} has no anatomical family.`);
for(const rule of DEFINITION_FAMILY_RULES)if(!rule.template.includes('{name}')||!rule.sourceIds.length||rule.sourceIds.some(id=>!EDUCATION_SOURCES[id]))failures.push(`Definition family rule ${rule.id} is invalid.`);
for(const [id,source] of Object.entries(EDUCATION_SOURCES))try{if(new URL(source.url).protocol!=='https:')failures.push(`Education source ${id} is not HTTPS.`);}catch{failures.push(`Education source ${id} has an invalid URL.`);}
for(const [alias,familyId] of Object.entries(EDUCATION_ALIASES))if(!alias.trim()||!EDUCATION_FAMILIES.some(family=>family.id===familyId))failures.push(`Alias ${alias} points to unknown family ${familyId}.`);

const atlasFmaIds=new Set(atlas.concepts.map(concept=>normalizeFmaId(concept.id))),atlasNames=new Set(atlas.concepts.map(concept=>normalizeStructureName(concept.name))),familyIds=new Set(EDUCATION_FAMILIES.map(family=>family.id));
const factCounts={general:0};
for(const fact of DISCOVERY_FACTS){
 const bucket=fact.system??'general';factCounts[bucket]=(factCounts[bucket]??0)+1;
 for(const field of ['id','text','category','sourceId','sourceName','sourceUrl'])if(typeof fact[field]!=='string'||!fact[field].trim())failures.push(`Fact ${fact.id||'(missing ID)'} has an empty ${field}.`);
 if(!EDUCATION_SOURCES[fact.sourceId])failures.push(`Fact ${fact.id} references an unknown source.`);
 else if(fact.sourceName!==EDUCATION_SOURCES[fact.sourceId].name||fact.sourceUrl!==EDUCATION_SOURCES[fact.sourceId].url)failures.push(`Fact ${fact.id} does not carry its resolved source metadata.`);
 try{if(new URL(fact.sourceUrl).protocol!=='https:')failures.push(`Fact ${fact.id} source is not HTTPS.`);}catch{failures.push(`Fact ${fact.id} has an invalid source URL.`);}
 if(fact.fmaIds?.some(id=>!atlasFmaIds.has(normalizeFmaId(id))))failures.push(`Fact ${fact.id} references an FMA identifier outside this atlas.`);
 if(fact.familyIds?.some(id=>!familyIds.has(id)))failures.push(`Fact ${fact.id} references an unknown anatomical family.`);
 if((fact.fmaIds?.length||fact.structures?.length)&&![...(fact.fmaIds??[]).map(id=>atlasFmaIds.has(normalizeFmaId(id))),...(fact.structures??[]).map(name=>atlasNames.has(normalizeStructureName(name)))].some(Boolean))failures.push(`Fact ${fact.id} has no related structure represented in the atlas.`);
}
if(DISCOVERY_FACTS.length<150)failures.push(`Fact catalogue has only ${DISCOVERY_FACTS.length} facts; at least 150 are required.`);
if(factCounts.general<20)failures.push(`General anatomy has only ${factCounts.general} facts; at least 20 are required.`);
for(const system of [...new Set(atlas.parts.map(part=>part.system))])if((factCounts[system]??0)<8)failures.push(`${system} has only ${factCounts[system]??0} facts; at least 8 are required.`);

const externalFactCollection=discoveryFactCollectionFor({name:'right external oblique',fmaId:'FMA13336',system:'muscular',familyId:'external-oblique'});
if(externalFactCollection.scope!=='exact'||!externalFactCollection.facts.some(fact=>fact.id==='muscular-08'))failures.push('Right external oblique does not prioritize its exact linked fact.');

for(const record of EDUCATION_RECORDS)for(const id of record.fmaIds){
 const digits=normalizeFmaId(id).replace('FMA',''),variants=[`FMA${digits}`,`FMA:${digits}`,`fma${digits}`,digits];
 for(const variant of variants)if(educationFor(variant)!==record)failures.push(`Exact record ${id} is unreachable through variant ${variant}.`);
}

const summaries=new Map();
for(const record of EDUCATION_RECORDS){const previous=summaries.get(record.summary);if(previous&&previous.system!==record.system)failures.push(`Unrelated exact records ${previous.displayName} and ${record.displayName} share an exact description.`);else summaries.set(record.summary,record);}

const required={
 'right external oblique':['right external oblique'],
 'left external oblique':['left external oblique'],
 brain:['brain'],cerebellum:['cerebellum'],'spinal cord':['spinal cord'],heart:['heart'],'left lung':['left lung'],'right lung':['right lung'],liver:['liver'],gallbladder:['gallbladder'],stomach:['stomach'],pancreas:['pancreas'],spleen:['spleen'],'transverse colon':['transverse colon'],'transverse mesocolon':['transverse mesocolon'],'left kidney':['left kidney'],'right kidney':['right kidney'],'urinary bladder':['urinary bladder'],femur:['femur'],skull:['skull'],'thyroid gland':['thyroid gland'],'eye':['left eyeball','right eyeball','eye'],'vagus nerve':['vagus nerve'],'aorta':['aorta'],'great saphenous vein':['great saphenous vein'],diaphragm:['diaphragm'],skin:['skin'],ligament:['long plantar ligament','stylohyoid ligament','cricothyroid ligament'],
};
const absentRequired=[];
for(const [label,candidates] of Object.entries(required)){
 const concept=atlas.concepts.find(item=>candidates.some(candidate=>normalizeStructureName(item.name)===normalizeStructureName(candidate)||normalizeStructureName(item.name).includes(normalizeStructureName(candidate))));
 if(!concept){absentRequired.push(label);continue;}
 const profile=resolveEducationProfile(concept,concept.elements.map(id=>partsById.get(id)).filter(Boolean));
 if(profile.quality==='classification')failures.push(`Required represented sample ${label} only received classification content.`);
}

const external=atlas.concepts.find(concept=>normalizeStructureName(concept.name)==='right external oblique');
if(external){const profile=resolveEducationProfile(external,external.elements.map(id=>partsById.get(id)).filter(Boolean)),combined=`${profile.identification} ${profile.location} ${profile.mainFunction}`.toLowerCase();for(const phrase of ['right-sided external oblique','superficial anterolateral abdominal wall','trunk movement','abdominal compression','stabilization','opposite side'])if(!combined.includes(phrase))failures.push(`Right external oblique profile is missing: ${phrase}.`);}

for(const [name,id] of Object.entries({'left patella':'FMA24487','right parietal bone':'FMA52788','right first metacarpal bone':'FMA24464','ascending part of right trapezius':'FMA33581'})){
 const concept=atlas.concepts.find(candidate=>candidate.id===id),profile=concept&&resolveEducationProfile(concept,concept.elements.map(element=>partsById.get(element)).filter(Boolean));
 if(!profile||profile.quality!=='exact')failures.push(`${name} (${id}) does not resolve to structure-specific information.`);
}

const representativeDefinitions={
 'medulla oblongata':{id:'FMA62004',resolution:'exact-fma',terms:['lowest part of the brainstem','pons','spinal cord','breathing','heart-rate','blood-pressure']},
 'right patella':{id:'FMA24486',resolution:'exact-fma',terms:['right patella','sesamoid bone','quadriceps tendon','knee']},
 'left patella':{id:'FMA24487',resolution:'exact-fma',terms:['left patella','sesamoid bone','quadriceps tendon','knee']},
 'right external oblique':{id:'FMA13336',resolution:'exact-fma',terms:['right external oblique','anterolateral abdominal wall','abdominal contents','trunk']},
 'right parietal bone':{id:'FMA52788',resolution:'exact-fma',terms:['right parietal bone','cranial bone','skull','brain']},
 'first metacarpal bone':{id:'FMA23899',resolution:'exact-fma',terms:['first metacarpal bone','thumb','trapezium','proximal phalanx']},
 'ascending trapezius':{id:'FMA32555',resolution:'exact-fma',terms:['inferior fiber division','scapula']},
 'transverse trapezius':{id:'FMA32556',resolution:'exact-fma',terms:['middle fiber division','retract']},
 'descending trapezius':{id:'FMA32557',resolution:'exact-fma',terms:['superior fiber division','elevation']},
 brain:{id:'FMA50801',resolution:'exact-fma',terms:['central organ','nervous system','spinal cord']},
 heart:{id:'FMA7088',resolution:'exact-fma',terms:['muscular organ','middle mediastinum','pump']},
 stomach:{id:'FMA7148',resolution:'exact-fma',terms:['digestive tract','esophagus','duodenum']},
 gallbladder:{id:'FMA7202',resolution:'exact-fma',terms:['biliary organ','liver','bile']},
 'transverse mesocolon':{id:'FMA14647',resolution:'exact-fma',terms:['peritoneum','transverse colon','posterior abdominal wall']},
 nerve:{id:'FMA52677',resolution:'family',terms:['peripheral neural structure','sensory','motor']},
 artery:{id:'FMA50029',resolution:'family',terms:['artery','away from the heart']},
 vein:{id:'FMA50735',resolution:'family',terms:['vein','drains blood','heart']},
 'sensory organ':{id:'FMA54449',resolution:'exact-fma',terms:['visual sensory organ','bony orbit','retina']},
};
for(const [label,expectation] of Object.entries(representativeDefinitions)){
 const concept=atlas.concepts.find(candidate=>normalizeFmaId(candidate.id)===expectation.id),profile=concept&&resolveEducationProfile(concept,concept.elements.map(element=>partsById.get(element)).filter(Boolean));
 if(!profile){failures.push(`Representative definition ${label} (${expectation.id}) is not selectable.`);continue;}
 if(profile.definitionResolution!==expectation.resolution)failures.push(`Representative definition ${label} resolved as ${profile.definitionResolution}, expected ${expectation.resolution}.`);
 const text=profile.definition.toLowerCase();for(const term of expectation.terms)if(!text.includes(term))failures.push(`Representative definition ${label} is missing “${term}”.`);
}

const enrichedPieces=pieceCounts.exact+pieceCounts.family;
if(enrichedPieces/atlas.parts.length<.9)failures.push(`Exact plus family piece coverage is below 90%: ${percentage(enrichedPieces,atlas.parts.length)}.`);
if(unresolved)failures.push(`Unresolved profile count is ${unresolved}.`);
if(Object.values(conceptDefinitionCounts).reduce((sum,count)=>sum+count,0)!==atlas.concepts.length)failures.push('Definition coverage does not equal the selectable canonical concept count.');

const examples=[];
for(const system of [...new Set(atlas.parts.map(part=>part.system))]){
 const part=atlas.parts.find(candidate=>candidate.system===system),profile=resolveEducationProfile({id:part.conceptId,name:part.name,elements:[part.id]},[part]);
 examples.push(`${system}: ${part.name} (${profile.fmaId}) -> ${profile.quality}${profile.familyName?` / ${profile.familyName}`:''}`);
}

console.log(`Total concepts tested: ${atlas.concepts.length.toLocaleString()}`);
console.log(`Total pieces tested: ${atlas.parts.length.toLocaleString()}`);
console.log(`Concept exact profiles: ${conceptCounts.exact.toLocaleString()} (${percentage(conceptCounts.exact,atlas.concepts.length)})`);
console.log(`Concept family profiles: ${conceptCounts.family.toLocaleString()} (${percentage(conceptCounts.family,atlas.concepts.length)})`);
console.log(`Concept classification profiles: ${conceptCounts.classification.toLocaleString()} (${percentage(conceptCounts.classification,atlas.concepts.length)})`);
console.log(`Selectable canonical structures with definitions: ${Object.values(conceptDefinitionCounts).reduce((sum,count)=>sum+count,0).toLocaleString()}`);
console.log(`Canonical definition resolution: exact FMA ${conceptDefinitionCounts['exact-fma'].toLocaleString()}, canonical name ${conceptDefinitionCounts.canonical.toLocaleString()}, family ${conceptDefinitionCounts.family.toLocaleString()}, system fallback ${conceptDefinitionCounts.system.toLocaleString()}`);
console.log(`Piece exact profiles: ${pieceCounts.exact.toLocaleString()} (${percentage(pieceCounts.exact,atlas.parts.length)})`);
console.log(`Piece family profiles: ${pieceCounts.family.toLocaleString()} (${percentage(pieceCounts.family,atlas.parts.length)})`);
console.log(`Piece classification profiles: ${pieceCounts.classification.toLocaleString()} (${percentage(pieceCounts.classification,atlas.parts.length)})`);
console.log(`Piece definition resolution: exact FMA ${pieceDefinitionCounts['exact-fma'].toLocaleString()}, canonical name ${pieceDefinitionCounts.canonical.toLocaleString()}, family ${pieceDefinitionCounts.family.toLocaleString()}, system fallback ${pieceDefinitionCounts.system.toLocaleString()}`);
if(systemFallbackConcepts.length)console.log(`System-fallback concepts for expert review: ${systemFallbackConcepts.join('; ')}`);
console.log(`Unresolved count: ${unresolved}`);
console.log(`Duplicate-ID count: ${duplicateIds.length}`);
console.log(`Duplicate canonical-name count: ${duplicateNames.length}`);
console.log(`Duplicate definition-ID count: ${duplicateDefinitionIds.length}`);
console.log(`Conflicting definition-name count: ${duplicateDefinitionNames.length}`);
console.log(`Profiles missing sources: ${profilesMissingSources}`);
console.log(`Profiles containing prohibited generic phrases: ${profilesWithProhibitedPhrases}`);
console.log(`Definitions matching overview text: ${definitionsMatchingOverview}`);
console.log(`Laterality conflicts: ${lateralityConflicts}`);
console.log(`Verified fact count: ${DISCOVERY_FACTS.length.toLocaleString()}`);
console.log(`Facts by collection: ${Object.entries(factCounts).map(([key,value])=>`${key} ${value}`).join(', ')}`);
console.log('Ten cross-system examples:');
examples.slice(0,10).forEach(example=>console.log(`- ${example}`));
if(absentRequired.length)console.log(`Requested examples not represented by this atlas catalogue: ${absentRequired.join(', ')}`);

if(failures.length){console.error(`Education validation failed with ${failures.length} issue(s):`);failures.slice(0,50).forEach(failure=>console.error(`- ${failure}`));process.exit(1);}
console.log('Education coverage and resolver validation passed.');
