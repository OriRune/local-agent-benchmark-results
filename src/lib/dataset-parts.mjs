/** Reconstruct facts only for offline validation or an explicit full-inventory request. */
export async function readDataset(release, read) {
  const value = await read(release.dataset_object_id);
  if (!value || !Object.hasOwn(value, 'format')) return value;
  if (value.format !== 'dataset-parts-v1' || Object.keys(value).sort().join(',') !== 'format,metadata,parts' || !value.metadata || !value.parts || Object.keys(value.parts).sort().join(',') !== 'attempts,trials' || ['attempts','trials'].some(k=>Object.hasOwn(value.metadata,k))) throw new Error('Unsupported dataset parts descriptor');
  if (!['attempts','trials'].every(k=>Array.isArray(value.parts[k])&&value.parts[k].every(id=>typeof id==='string'))) throw new Error('Invalid dataset part IDs');
  const ids=[...value.parts.attempts,...value.parts.trials], records=new Map(release.objects.map(o=>[o.id,o]));
  if (ids.length>1000 || new Set(ids).size!==ids.length || ids.some(id=>records.get(id)?.media_type!=='application/json')) throw new Error('Duplicate or missing dataset part');
  if ([release.dataset_object_id,...ids].reduce((n,id)=>n+(records.get(id)?.bytes??Infinity),0)>512*1024**2) throw new Error('Dataset parts exceed total decoded budget');
  const result={...value.metadata};
  for(const group of ['attempts','trials']) {
    result[group]=[];
    for(const id of value.parts[group]) {
      const rows=await read(id);
      if(!Array.isArray(rows)||rows.length>1000) throw new Error('Invalid dataset rows part');
      result[group].push(...rows);
    }
  }
  return result;
}
