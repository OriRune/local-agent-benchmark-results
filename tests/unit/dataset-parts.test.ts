import {expect,it} from 'vitest';
import {readDataset} from '../../src/lib/dataset-parts.mjs';
it('reconstructs split facts and preserves inline editions',async()=>{
 const descriptor={format:'dataset-parts-v1',metadata:{dataset_revision_id:'same'},parts:{attempts:['a'],trials:['t']}};
 const values:Record<string,unknown>={root:descriptor,a:[{id:'attempt'}],t:[{id:'trial'}]};
 const release={dataset_object_id:'root',objects:Object.keys(values).map(id=>({id,media_type:'application/json',bytes:100}))};
 expect(await readDataset(release,async(id:string)=>values[id])).toEqual({dataset_revision_id:'same',attempts:[{id:'attempt'}],trials:[{id:'trial'}]});
 values.root={dataset_revision_id:'inline',attempts:[],trials:[]};expect(await readDataset(release,async(id:string)=>values[id])).toEqual(values.root);
 values.root=descriptor;descriptor.parts.trials=['missing'];await expect(readDataset(release,async(id:string)=>values[id])).rejects.toThrow('missing');
});
it('rejects duplicate parts and excessive decoded size',async()=>{
 const root={format:'dataset-parts-v1',metadata:{},parts:{attempts:['a'],trials:['a']}},release={dataset_object_id:'root',objects:[{id:'root',bytes:100,media_type:'application/json'},{id:'a',bytes:512*1024**2,media_type:'application/json'}]};
 await expect(readDataset(release,async()=>root)).rejects.toThrow('Duplicate');root.parts.trials=[];await expect(readDataset(release,async()=>root)).rejects.toThrow('budget');
});
