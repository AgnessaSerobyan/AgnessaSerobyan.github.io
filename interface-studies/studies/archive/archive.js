import {assets, collectionDefinitions, initialCollections} from './data.js';
import {defaultFilters, fileSize, uniqueSaved, cleanCollections, selectAssets, activeFilterEntries} from './model.js';
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=name=>`<img class="icon" src="./assets/icons/${name}.svg" alt="">`;
const preview=new URLSearchParams(location.search).has('preview');
const storageKey='interface-studies-archive-v3';
const mobile=matchMedia('(max-width:700px)');
const reduced=matchMedia('(prefers-reduced-motion:reduce)');
let saved;
try {saved=!preview&&JSON.parse(localStorage.getItem(storageKey));} catch {}
const state={filters:defaultFilters(),view:'library',collection:'all',collections:cleanCollections(saved||initialCollections),selected:'pastel-architecture',detailsOpen:!mobile.matches,zoom:null};
let visible=[],toastTimer,undoAction=null,collectionAsset=null,detailOpener=null,lastZoomFocus=null;
const persist=()=>{if(!preview)try{localStorage.setItem(storageKey,JSON.stringify(state.collections));}catch{notify('Saved for this visit. Browser storage is unavailable.');}};
function showDialog(id){const d=$(`#${id}`);if(!d.open)d.showModal();}
function closeDialog(id){const d=$(`#${id}`);if(d.open)d.close();}
function notify(message,undo=null){const host=$('#detail-dialog').open?$('#detail-dialog'):document.body;if($('#toast').parentElement!==host)host.append($('#toast'));clearTimeout(toastTimer);undoAction=undo;$('#toast-text').textContent=message;$('#toast-undo').hidden=!undo;$('#toast').hidden=false;toastTimer=setTimeout(()=>{$('#toast').hidden=true;undoAction=null;},undo?14000:6500);}
function assetById(id){return assets.find(a=>a.id===id);}
function savedNames(id){return collectionDefinitions.filter(c=>state.collections[c.id].includes(id)).map(c=>c.name);}
function renderCollectionBar(){
 const all=uniqueSaved(state.collections).size;
 $('#saved-count').textContent=all;
 $('#collection-bar').hidden=state.view!=='collections';
 $('#collection-bar').innerHTML=[{id:'all',name:'All saved'},...collectionDefinitions].map(c=>`<button class="collection-pill ${state.collection===c.id?'is-active':''}" data-collection="${c.id}" aria-pressed="${state.collection===c.id}">${icon('folder')} ${c.name} <span>${c.id==='all'?all:state.collections[c.id].length}</span></button>`).join('');
}
function renderChips(){const entries=activeFilterEntries(state.filters);$('#active-filters').hidden=!entries.length;$('#active-filters').innerHTML=entries.map(([key,label])=>`<button class="filter-chip" data-remove-filter="${key}" aria-label="Remove ${escape(label)} filter"><span>${escape(label)}</span>${icon('x')}</button>`).join('')+(entries.length?'<button class="clear-link" data-clear>Clear all</button>':'');$('#filter-count').hidden=!entries.length;$('#filter-count').textContent=entries.length;}
function card(a){const saved=savedNames(a.id);return `<article class="asset-card"><button class="asset-button" id="asset-${a.id}" data-asset="${a.id}" aria-pressed="${state.detailsOpen&&state.selected===a.id}" aria-label="View ${escape(a.title)}, ${escape(a.kind)}, ${escape(a.project)}"><div class="asset-thumbnail"><img src="${a.thumb}" alt="${escape(a.alt)}" width="${a.width}" height="${a.height}" style="object-position:${a.position};object-fit:${a.fit||'contain'}" loading="${visible.indexOf(a)<6?'eager':'lazy'}"><span class="selection-mark">${icon('check')}</span>${saved.length?`<span class="saved-mark">${icon('folder')} Saved</span>`:''}</div><div class="asset-caption"><h3>${escape(a.title)}</h3><p><span>${escape(a.kind)}</span><span class="file-dot">·</span><span class="file-format">${escape(a.publisher)}</span></p></div></button></article>`;}
function renderGrid({animate=false}={}){
 const before=animate&&!reduced.matches?new Map($$('.asset-card').map(el=>[el.querySelector('[data-asset]').dataset.asset,el.getBoundingClientRect()])):null;
 visible=selectAssets(state.filters,state.view,state.collection,state.collections);
 if(!visible.some(a=>a.id===state.selected)){state.selected=null;state.detailsOpen=false;}
 $('#asset-grid').innerHTML=visible.map(card).join('');
 $('#empty-state').hidden=!!visible.length;
 $('#result-count').textContent=`${visible.length} ${visible.length===1?'asset':'assets'}`;
 $('#scope-label').textContent=state.view==='collections'?(state.collection==='all'?'Across your collections':collectionDefinitions.find(c=>c.id===state.collection).name):`${new Set(visible.map(a=>a.project)).size} creative ${new Set(visible.map(a=>a.project)).size===1?'project':'projects'}`;
 $('#filters-apply').textContent=`Show ${visible.length} ${visible.length===1?'asset':'assets'}`;
 renderChips();renderCollectionBar();syncDetails();
 if(before)requestAnimationFrame(()=>{$$('.asset-card').forEach(el=>{const b=before.get(el.querySelector('[data-asset]').dataset.asset);if(!b)return;const n=el.getBoundingClientRect();if((b.left!==n.left||b.top!==n.top)&&typeof el.animate==='function')el.animate([{transform:`translate(${b.left-n.left}px,${b.top-n.top}px)`},{transform:'translate(0,0)'}],{duration:300,easing:'cubic-bezier(.2,.7,.2,1)'});});});
}
function detailMarkup(a){const names=savedNames(a.id);return `
 <div class="detail-top"><span>REFERENCE DETAILS</span><button id="detail-close" class="icon-button" aria-label="Close asset details">${icon('x')}</button></div>
 <button class="detail-preview" data-zoom="${a.id}" aria-label="Enlarge ${escape(a.title)}"><img src="${a.preview}" alt="${escape(a.alt)}" width="${a.width}" height="${a.height}" style="object-fit:contain"><span class="zoom-bubble">${icon('maximize-2')}</span></button>
 <div class="detail-name"><p>${escape(a.kind)}</p><h2 id="detail-title">${escape(a.title)}</h2><div class="detail-project">${escape(a.creator)}</div></div>
 <section class="detail-usage" aria-label="Reference usage"><h3>Usage</h3><div class="usage-label">${icon('info')}Reference preview</div><p>Saved for inspiration. Open the original for files, availability and usage terms.</p></section>
 <div class="detail-actions"><button class="primary" id="add-collection" data-id="${a.id}">${icon('folder-plus')}Add to collection</button><a class="secondary" href="${a.source}" target="_blank" rel="noopener">${icon('external-link')}View original</a></div>
 ${names.length?`<p class="saved-to">Saved in ${escape(names.join(' · '))}</p>`:''}
 <p class="detail-description">${escape(a.description)}</p>
 <dl class="asset-facts"><dt>Project folder</dt><dd>${escape(a.project)}</dd><dt>Preview format</dt><dd>JPEG image</dd><dt>Preview size</dt><dd>${a.width.toLocaleString('en')} × ${a.height.toLocaleString('en')} px</dd><dt>Provider</dt><dd>${escape(a.publisher)}</dd><dt>Source terms</dt><dd>${escape(a.license)}</dd></dl>
 <section class="detail-source"><h3>Source &amp; credits</h3><p class="source-name">${escape(a.creator)}</p><div class="source-links"><a href="${a.source}" target="_blank" rel="noopener">Original project ${icon('external-link')}</a><a href="${a.licenseUrl}" target="_blank" rel="noopener">${a.rights==='licensed'?'License':'Terms & files'} ${icon('external-link')}</a></div><p class="source-disclaimer">Work by the credited creator. Included here as a visual reference; editable source files are not bundled.</p></section>`;}
function renderDetail(){const a=assetById(state.selected);if(a)$('#detail-content').innerHTML=detailMarkup(a);}
function syncDetails(){
 const panel=$('#detail-panel'),dialog=$('#detail-dialog');
 $('#browser-layout').classList.toggle('with-details',state.detailsOpen&&!mobile.matches);
 if(state.detailsOpen&&state.selected){
  renderDetail();panel.hidden=false;
  if(mobile.matches){if(panel.parentElement!==dialog)dialog.append(panel);showDialog('detail-dialog');}
  else{if(dialog.open)dialog.close();if(panel.parentElement!==$('#detail-home'))$('#detail-home').append(panel);$('#detail-home').hidden=false;}
 }else{
  if(dialog.open)dialog.close();$('#detail-home').hidden=true;panel.hidden=true;
 }
}
function chooseAsset(id,opener){state.selected=id;state.detailsOpen=true;detailOpener=opener||$(`#asset-${id}`);renderGrid({animate:true});if(!mobile.matches)requestAnimationFrame(()=>$('#detail-close')?.focus({preventScroll:true}));}
function closeDetails({focus=true}={}){const id=state.selected;state.detailsOpen=false;if($('#detail-dialog').open)$('#detail-dialog').close();renderGrid({animate:true});if(focus)requestAnimationFrame(()=>($(`#asset-${id}`)||detailOpener)?.focus({preventScroll:true}));}
function changeFilters(){renderGrid({animate:true});}
function resetFilters(){state.filters=defaultFilters();$('#search').value='';for(const k of ['type','project','rights'])$(`#filter-${k}`).value='all';$('#sort').value='newest';if(state.view==='collections'&&!selectAssets(state.filters,state.view,state.collection,state.collections).length)state.collection='all';changeFilters();}
function openZoom(id){state.zoom=id;lastZoomFocus=document.activeElement;renderZoom();showDialog('zoom-dialog');}
function renderZoom(){const a=assetById(state.zoom);if(!a)return;$('#zoom-title').textContent=a.title;$('#zoom-image').src=a.preview||a.thumb;$('#zoom-image').alt=a.alt;$('#zoom-caption').textContent=`${a.kind} · Preview ${a.width} × ${a.height} · By ${a.creator}`;const i=visible.findIndex(x=>x.id===a.id);$('#zoom-pagination').textContent=`${i+1} / ${visible.length}`;$('#zoom-prev').disabled=i<=0;$('#zoom-next').disabled=i>=visible.length-1;}
function stepZoom(delta){const i=visible.findIndex(x=>x.id===state.zoom);if(visible[i+delta]){state.zoom=visible[i+delta].id;renderZoom();}}
function openCollection(id){collectionAsset=id;$('#collection-asset-name').textContent=`Choose a home for “${assetById(id).title}”.`;$('#collection-options').innerHTML=collectionDefinitions.map((c,i)=>{const has=state.collections[c.id].includes(id);return `<label class="collection-option"><input type="radio" name="collection" value="${c.id}" ${has?'disabled':''} ${!has&&collectionDefinitions.find(x=>!state.collections[x.id].includes(id))?.id===c.id?'checked':''}><span>${icon('folder')}</span><span><strong>${c.name}</strong><small>${has?'Already added':`${state.collections[c.id].length} assets · ${c.description}`}</small></span>${has?icon('check'):''}</label>`;}).join('');$('#collection-submit').disabled=collectionDefinitions.every(c=>state.collections[c.id].includes(id));showDialog('collection-dialog');}
function openSources(){$('#profile-menu').open=false;showDialog('sources-dialog');}
function openFilters(){const panel=$('#filter-panel');$('#filters-dialog').append(panel);showDialog('filters-dialog');}
function switchView(view){state.view=view;state.collection='all';state.detailsOpen=false;$$('[data-view]').forEach(b=>{const active=b.dataset.view===view;b.classList.toggle('is-active',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});$('#page-title').innerHTML=view==='library'?'Asset library<span class="title-dot">.</span>':'Your collections<span class="title-dot">.</span>';$('#page-description').textContent=view==='library'?'Your team’s artwork, assets and working files.':'Keep ideas close. Give the next campaign a head start.';renderGrid({animate:true});}
$('#search').addEventListener('input',e=>{state.filters.query=e.target.value;changeFilters();});
for(const key of ['type','project','rights'])$(`#filter-${key}`).addEventListener('change',e=>{state.filters[key]=e.target.value;changeFilters();});
$('#sort').addEventListener('change',e=>{state.filters.sort=e.target.value;changeFilters();});
$('#active-filters').addEventListener('click',e=>{const b=e.target.closest('[data-remove-filter]');if(b){const key=b.dataset.removeFilter;state.filters[key]=key==='query'?'':'all';$(key==='query'?'#search':`#filter-${key}`).value=state.filters[key];changeFilters();$('#search').focus({preventScroll:true});}if(e.target.closest('[data-clear]')){resetFilters();$('#search').focus({preventScroll:true});}});
$('#empty-reset').addEventListener('click',()=>{resetFilters();$('#search').focus({preventScroll:true});});
$('#sheet-reset').addEventListener('click',resetFilters);
$('#asset-grid').addEventListener('click',e=>{const b=e.target.closest('[data-asset]');if(b)chooseAsset(b.dataset.asset,b);});
$('#detail-panel').addEventListener('click',e=>{if(e.target.closest('#detail-close'))closeDetails();const zoom=e.target.closest('[data-zoom]');if(zoom)openZoom(zoom.dataset.zoom);const add=e.target.closest('#add-collection');if(add)openCollection(add.dataset.id);});
$('#collection-form').addEventListener('submit',e=>{e.preventDefault();const c=$('#collection-options input:checked');if(!c||c.disabled)return;const id=collectionAsset,key=c.value;if(state.collections[key].includes(id))return;state.collections[key].push(id);persist();closeDialog('collection-dialog');renderGrid();requestAnimationFrame(()=>$('#add-collection')?.focus({preventScroll:true}));const name=collectionDefinitions.find(x=>x.id===key).name;notify(`Added to ${name}.`,()=>{state.collections[key]=state.collections[key].filter(x=>x!==id);persist();renderGrid();notify('Removed from collection.');});});
$('#toast-undo').addEventListener('click',()=>{if(undoAction){const undo=undoAction;undoAction=null;undo();}});
$('#toast-close').addEventListener('click',()=>{$('#toast').hidden=true;clearTimeout(toastTimer);undoAction=null;});
$$('[data-view]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
$('#collection-bar').addEventListener('click',e=>{const b=e.target.closest('[data-collection]');if(b){state.collection=b.dataset.collection;renderGrid({animate:true});}});
$('#zoom-close').addEventListener('click',()=>closeDialog('zoom-dialog'));
$('#zoom-dialog').addEventListener('close',()=>{state.zoom=null;if(lastZoomFocus?.isConnected)lastZoomFocus.focus({preventScroll:true});});
$('#zoom-prev').addEventListener('click',()=>stepZoom(-1));$('#zoom-next').addEventListener('click',()=>stepZoom(1));
$('#zoom-dialog').addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){e.preventDefault();stepZoom(-1);}if(e.key==='ArrowRight'){e.preventDefault();stepZoom(1);}});
$('#detail-dialog').addEventListener('close',()=>{if($('#toast').parentElement===$('#detail-dialog'))document.body.append($('#toast'));});
$('#detail-dialog').addEventListener('cancel',e=>{e.preventDefault();closeDetails();});
$('#filters-open').addEventListener('click',openFilters);$('#filters-close').addEventListener('click',()=>closeDialog('filters-dialog'));$('#filters-apply').addEventListener('click',()=>closeDialog('filters-dialog'));
$('#filters-dialog').addEventListener('close',()=>{if($('#filter-panel').parentElement!==$('#filter-home'))$('#filter-home').append($('#filter-panel'));$('#filters-open').focus({preventScroll:true});});
for(const id of ['sources-open','footer-sources'])$(`#${id}`).addEventListener('click',openSources);
$$('[data-close]').forEach(b=>b.addEventListener('click',()=>closeDialog(b.dataset.close)));
for(const d of $$('.small-dialog,.sources-dialog,.zoom-dialog'))d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}});
$('#source-list').innerHTML=assets.map(a=>`<li><a href="${a.source}" target="_blank" rel="noopener">${escape(a.title)} ↗</a><span>${escape(a.creator)} · ${escape(a.publisher)}</span></li>`).join('');
mobile.addEventListener('change',()=>{if($('#filters-dialog').open)closeDialog('filters-dialog');if(mobile.matches&&state.detailsOpen){state.detailsOpen=false;}renderGrid({animate:true});});
document.addEventListener('keydown',e=>{if(e.key==='/'&&!$$('dialog[open]').length&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)){e.preventDefault();$('#search').focus();}if(e.key==='Escape'&&!$$('dialog[open]').length){if($('#profile-menu').open)$('#profile-menu').open=false;else if(state.detailsOpen)closeDetails();}});
renderGrid();
