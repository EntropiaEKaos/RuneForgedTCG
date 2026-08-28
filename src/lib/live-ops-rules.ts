export type LiveOpsValidation = { passed:boolean; errors:string[]; warnings:string[] };
export function validateLiveOps(resource:string,row:any):LiveOpsValidation{
  const errors:string[]=[],warnings:string[]=[];
  if(!["events","promotions"].includes(resource)) return {passed:true,errors,warnings};
  if(row.startsAt&&row.endsAt&&new Date(row.endsAt)<=new Date(row.startsAt)) errors.push("End time must be after start time.");
  if(resource==="events"){
    if(!row.rules||typeof row.rules!=="object") errors.push("Event rules must be an object.");
    if(!Array.isArray(row.rewards)) errors.push("Event rewards must be an array.");
    const missions=row.rules?.missions;if(missions&&!Array.isArray(missions))errors.push("Event missions must be an array.");
    if(row.status==="published"&&!row.rules?.mode)warnings.push("Published event has no explicit game mode.");
  }else{
    if(!row.conditions||typeof row.conditions!=="object") errors.push("Promotion conditions must be an object.");
    if(!Array.isArray(row.offers)) errors.push("Promotion offers must be an array.");
    if(row.status==="published"&&!row.conditions?.audience)warnings.push("Published promotion has no explicit audience.");
    const offers=row.offers||[]; for(const [i,o] of offers.entries()){if(!o||typeof o!=="object")errors.push(`Offer ${i+1} is invalid.`);if(o?.price!==undefined&&Number(o.price)<0)errors.push(`Offer ${i+1} has a negative price.`);}
  }
  return {passed:errors.length===0,errors,warnings};
}
