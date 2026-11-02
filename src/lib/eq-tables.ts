/** Shared accessible sorting for all EQ tables, including mobile card layouts. */
export function installTableSorting(root: ParentNode = document) {
 for (const table of root.querySelectorAll<HTMLTableElement>('.eq table')) {
  if (table.dataset.sortReady) continue;
  const head=table.tHead?.rows[0], body=table.tBodies[0];
  if (!head || !body) continue;
  table.dataset.sortReady='true';
  const headers=Array.from(head.cells);
  const controls=document.createElement('div'); controls.className='table-sort-controls';
  const label=document.createElement('label'); label.append('Sort by ');
  const select=document.createElement('select'); select.setAttribute('aria-label',`Sort ${table.dataset.tableLabel || table.caption?.textContent || 'table'}`);
  const initial=document.createElement('option'); initial.value='';initial.textContent='Original order';select.append(initial);
  const direction=document.createElement('button'); direction.type='button'; direction.textContent='Descending';direction.disabled=true;direction.setAttribute('aria-label','Reverse sort direction');
  const live=document.createElement('span');live.className='sr-only';live.setAttribute('aria-live','polite');
  label.append(select);controls.append(label,direction,live);
  table.parentElement!.insertBefore(controls,table);
  let column=-1,descending=true;
  const original=Array.from(body.rows);
  const text=(cell:HTMLTableCellElement)=>cell.dataset.sort ?? cell.textContent?.trim() ?? '';
  const missing=(value:string)=>!value || /^(—|Not scored|In progress|Pending)$/i.test(value);
  const sort=()=>{
   const rows=Array.from(body.rows), numeric=headers[column]?.dataset.type==='number' || rows.every(r=>missing(text(r.cells[column])) || /^-?\d+(\.\d+)?$/.test(text(r.cells[column])));
   rows.sort((a,b)=>{
    const x=text(a.cells[column]),y=text(b.cells[column]);
    if(missing(x)||missing(y)) return Number(missing(x))-Number(missing(y));
    const result=numeric ? Number(x)-Number(y) : x.localeCompare(y,undefined,{numeric:true,sensitivity:'base'});
    return (descending ? -result : result) || original.indexOf(a)-original.indexOf(b);
   });
   rows.forEach(r=>body.append(r));
   headers.forEach((h,i)=>h.setAttribute('aria-sort',i===column ? descending ? 'descending' : 'ascending' : 'none'));
   select.value=String(column);direction.disabled=false;direction.textContent=descending ? 'Descending' : 'Ascending';
   live.textContent=`Sorted by ${headers[column].textContent}, ${descending ? 'descending' : 'ascending'}. Missing values last.`;
  };
  headers.forEach((header,index)=>{
   const button=document.createElement('button');button.type='button';button.className='table-sort-button';
   while(header.firstChild) button.append(header.firstChild);
   button.setAttribute('aria-label',`Sort by ${button.textContent}`);
   header.append(button);header.scope='col';header.setAttribute('aria-sort','none');
   const option=document.createElement('option');option.value=String(index);option.textContent=button.textContent;select.append(option);
   button.addEventListener('click',()=>{descending=column===index ? !descending : header.dataset.type==='number' || index>0;column=index;sort();});
   // Radar comparison headings change with the selected model.
   new MutationObserver(()=>{option.textContent=button.textContent;button.setAttribute('aria-label',`Sort by ${button.textContent}`);}).observe(button,{childList:true,subtree:true,characterData:true});
  });
  select.addEventListener('change',()=>{
   if(select.value===''){original.forEach(r=>body.append(r));headers.forEach(h=>h.setAttribute('aria-sort','none'));column=-1;direction.disabled=true;return;}
   column=Number(select.value);descending=headers[column].dataset.type==='number' || column>0;sort();
  });
  direction.addEventListener('click',()=>{descending=!descending;sort();});
  table.addEventListener('eq:values-changed',()=>{if(column>=0) sort();});
 }
}
installTableSorting();


const search=document.querySelector<HTMLInputElement>('[data-model-search]');
search?.addEventListener('input',()=>{
 let visible=0;
 for(const row of document.querySelectorAll<HTMLTableRowElement>('[data-search]')){row.hidden=!row.dataset.search!.includes(search.value.trim().toLowerCase());if(!row.hidden) visible++;}
 document.querySelector<HTMLElement>('[data-filter-empty]')!.hidden=visible>0;
});
