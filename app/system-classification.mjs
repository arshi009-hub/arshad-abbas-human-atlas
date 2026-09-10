/** @typedef {import('./anatomy').SystemId} SystemId */

// A few catalogue meshes carry a UI-system label that conflicts with their FMA identity.
// Correct only presentation grouping; source IDs, geometry and atlas data remain unchanged.
/** @type {Readonly<Record<string,SystemId>>} */
const SYSTEM_OVERRIDES=Object.freeze({
 FMA75351:'nervous', // interventricular foramen of the brain
 FMA78449:'nervous',
 FMA78450:'nervous',
 FMA78454:'nervous',
 FMA78469:'nervous',
 FMA61934:'nervous', // choroid plexus of the cerebral hemisphere
 FMA40120:'connective',
 FMA40121:'connective',
});

/** @param {{conceptId:string,system:SystemId}} part @returns {SystemId} */
export function systemForPart(part){
 const canonicalId=`FMA${part.conceptId.replace(/[^0-9]/g,'')}`;
 return SYSTEM_OVERRIDES[canonicalId]??part.system;
}

export {SYSTEM_OVERRIDES};
