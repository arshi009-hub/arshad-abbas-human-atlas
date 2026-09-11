import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createExplosionLayout,explosionOffsetFor} from '../app/explosion-layout.ts';
import {PointerTap} from '../app/pointer-tap.ts';
import {atlasTools} from '../app/agent-tools.ts';
import {DISCOVERY_FACTS,discoveryFactCollectionFor,normalizeStructureName,resolveEducationProfile,sourcesFor} from '../app/education-content.ts';
import {buildLearningProfile,LEARN_CAMERA_COMMAND,ORIENTATION_HELP,ORIENTATION_SOURCE,parseLearnedIds,pronunciationFor,serializeLearnedIds,toSimpleEnglish,toggleLearnedId} from '../app/learning-content.ts';

for (const file of ['atlas.json']) {
  const atlas=JSON.parse(await readFile(new URL(`../public/models/${file}`,import.meta.url)));
  const groups=[atlas.parts,...[...new Set(atlas.parts.map(p=>p.system))].map(system=>atlas.parts.filter(p=>p.system===system))];
  for(const group of groups) for(const aspect of [.46,1,1.7]) {
    const layout=createExplosionLayout(group,aspect),cells=[...layout.cells.values()];
    assert.equal(cells.length,group.length);
    for(let i=0;i<cells.length;i++) {
      const a=cells[i];
      assert.ok(Math.abs(a.x)+a.width/2<=layout.width/2+1e-8);
      assert.ok(Math.abs(a.y)+a.height/2<=layout.height/2+1e-8);
      for(let j=i+1;j<cells.length;j++) {
        const b=cells[j];
        assert.ok(Math.abs(a.x-b.x)>=(a.width+b.width)/2-1e-8 || Math.abs(a.y-b.y)>=(a.height+b.height)/2-1e-8,'Exploded pieces overlap');
      }
    }
  }
  let selected=null;
  const [find,inspect]=atlasTools(atlas,c=>{selected=c;});
  const results=find.execute({query:'femur'});
  assert.ok(results.length>0);
  inspect.execute({id:results[0].id});
  const previous=selected;
  assert.throws(()=>inspect.execute({id:'nonexistent-structure'}));
  assert.equal(selected,previous);
  assert.throws(()=>find.execute({query:' '}));
  const partsById=new Map(atlas.parts.map(part=>[part.id,part]));
  for(const concept of atlas.concepts){
    const selectedParts=concept.elements.map(id=>partsById.get(id)).filter(Boolean),profile=resolveEducationProfile(concept,selectedParts),factCollection=discoveryFactCollectionFor({name:concept.name,fmaId:profile.fmaId,system:profile.system,familyId:profile.familyId}),fact=factCollection.facts[0]??DISCOVERY_FACTS[0],learning=buildLearningProfile(profile,fact,profile.system,sourcesFor(profile.sourceIds));
    assert.equal(learning.definition,profile.definition,`${concept.id} learn definition changed`);
    assert.ok(learning.identifyInModel.includes(profile.displayName),`${concept.id} model guide lost the selected name`);
    assert.equal(learning.questions.length,3,`${concept.id} does not have a three-question check`);
    const supportedAnswers=new Set([profile.definition,profile.mainFunction,...profile.facts,fact.text].filter(Boolean).map(normalizeStructureName));
    for(const question of learning.questions)assert.ok(supportedAnswers.has(normalizeStructureName(question.answer)),`${concept.id} knowledge check contains an unsupported answer`);
    assert.ok(learning.sources.length>0&&learning.sources.every(source=>source.name&&new URL(source.url).protocol==='https:'),`${concept.id} learn sources are invalid`);
    if(learning.clinical)assert.equal(learning.clinical,profile.clinical,`${concept.id} introduced new clinical copy`);
  }
  console.log(`${file}: packing at desktop/mobile aspect ratios and search/inspection contracts passed.`);
}
assert.deepEqual(LEARN_CAMERA_COMMAND,{type:'fit',preserveDirection:true});
for(const orientation of ['front','back','side'])assert.equal(LEARN_CAMERA_COMMAND.preserveDirection,true,`Learn mode must preserve ${orientation} orientation`);
assert.equal(ORIENTATION_HELP.length,7);
for(const required of ['anterior','posterior','superior','inferior','medial','lateral','proximal','distal','sagittal','coronal','transverse'])assert.ok(ORIENTATION_HELP.some(item=>`${item.term} ${item.explanation}`.toLowerCase().includes(required)),`Orientation help is missing ${required}`);
assert.equal(new URL(ORIENTATION_SOURCE.url).protocol,'https:');
assert.equal(pronunciationFor('medulla oblongata'),'meh-DUL-uh ob-long-GAH-tuh');
const standard='The Medulla oblongata lies within the cranial cavity and contributes to neural pathways.';
const simplified=toSimpleEnglish(standard,'Medulla oblongata');
assert.ok(simplified.includes('Medulla oblongata')&&simplified.includes('space inside the skull')&&simplified!==standard);
const learnedOnce=toggleLearnedId([],'FMA:7088'),learnedTwice=toggleLearnedId(learnedOnce,'FMA7088');
assert.deepEqual(parseLearnedIds(serializeLearnedIds(learnedOnce)),['FMA7088']);
assert.deepEqual(learnedTwice,[]);
assert.deepEqual(parseLearnedIds('{not valid'),[]);
console.log('Learn mode content, source, camera-preservation, orientation-help, and local-progress contracts passed.');
const tap=new PointerTap();
tap.down(1,10,10,7,0);assert.equal(tap.up(1,12,11,200),true);
tap.down(1,10,10,7,0);tap.move(1,40,10);assert.equal(tap.up(1,10,10,200),false);
tap.down(1,10,10,7,0);tap.down(2,20,20,7,10);assert.equal(tap.up(2,20,20,100),false);assert.equal(tap.up(1,10,10,110),false);
tap.down(1,10,10,7,0);tap.cancel(1);assert.equal(tap.up(1,10,10,100),false);
tap.down(1,10,10,7,0);tap.blockFromControls();assert.equal(tap.up(1,10,10,100),false);
tap.down(1,10,10,7,0);assert.equal(tap.up(1,10,10,600),false);
tap.down(1,10,10,7,0);assert.equal(tap.up(1,10,10,100),true);
for(const system of ['cardiac','sensory','muscular'])assert.deepEqual(explosionOffsetFor(system,{x:9,y:-7,z:12},{x:-50,y:80,z:30},0),{x:0,y:0,z:0});
assert.equal(createExplosionLayout([]).cells.size,0);
console.log('Tap, drag, OrbitControls movement, long-press, multitouch, exact assembled transforms, cancellation, and empty-view checks passed.');
