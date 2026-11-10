import {createState,restoreState,SECTIONS,SECTION_IDS,ANSWER_LABELS,editBlock,applyAnswers,answersDirty,linkedFacts,missingAnswers,emptySections,transformBlock,keepOriginal,undoReplacement,approve,markChanged} from './model.js';
const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const icon=name=>`<i data-icon="${name}" aria-hidden="true"></i>`;
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const preview=new URL(window.location?.href||'https://example.test/studies/brief/').searchParams.has('preview');
const storageKey='interface-studies-brief-v1';
let state=createState();
if(!preview){try{state=restoreState(JSON.parse(localStorage.getItem(storageKey)||'null'));}catch{}}
let pending=null,saveTimer=null,viewTimer=null,workContext=null,approvalAttempted=false;
const editor=id=>$(`#editor-${id}`);
const section=id=>$(`#section-${id}`);
const reduced=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;
const narrow=()=>matchMedia('(max-width:1050px)').matches;
const phone=()=>matchMedia('(max-width:600px)').matches;
function hydrate(root=document){root.querySelectorAll('[data-icon]').forEach(el=>{el.style.setProperty('--icon',`url('/interface-studies/studies/brief/assets/icons/${el.dataset.icon}.svg')`);el.setAttribute('aria-hidden','true');});}
function announce(text){$('#live-announcement').textContent=text;}
function persist(quiet=false){
  if(preview)return;
  try{localStorage.setItem(storageKey,JSON.stringify(state));if(!quiet)$('#save-status').innerHTML=`${icon('check-check')}<span>Saved in this browser</span>`;}
  catch{if(!quiet)$('#save-status').innerHTML=`${icon('circle-help')}<span>Saved for this session</span>`;}
  if(!quiet)hydrate($('#save-status'));
}
function queueSave(){
  clearTimeout(saveTimer);$('#save-status').innerHTML=`${icon('circle')}<span>Saving changes…</span>`;hydrate($('#save-status'));
  saveTimer=setTimeout(()=>persist(),350);
}
function toast(text){
  const host=$$('dialog').filter(d=>d.open).at(-1)||$('#document-notices');
  host.append($('#toast'));$('#toast-text').textContent=text;$('#toast').hidden=false;
  announce(text);
}
function captureWork(id=state.selected){
  const el=editor(id);let range=null;
  const selection=window.getSelection?.();
  if(selection?.rangeCount){const r=selection.getRangeAt(0);if(el?.contains(r.commonAncestorContainer))range=r.cloneRange();}
  return {id,documentTop:$('#document-scroll').scrollTop,windowTop:window.scrollY||0,anchorTop:el?.getBoundingClientRect?.().top??0,range,opener:document.activeElement};
}
function restoreWork(context,focus=false){
  if(!context)return;
  const scroller=$('#document-scroll');
  scroller.scrollTop=context.documentTop;
  if(phone())window.scrollTo?.({top:context.windowTop,behavior:'instant'});
  const el=editor(context.id),delta=(el?.getBoundingClientRect?.().top??context.anchorTop)-context.anchorTop;
  if(phone())window.scrollTo?.({top:(window.scrollY||context.windowTop)+delta,behavior:'instant'});
  else scroller.scrollTop+=delta;
  if(focus&&el){
    el.focus({preventScroll:true});
    if(context.range&&el.contains(context.range.commonAncestorContainer)){try{const selection=window.getSelection();selection.removeAllRanges();selection.addRange(context.range);}catch{}}
  }
}
function renderDocument(){
  $('#document-sections').innerHTML=SECTION_IDS.map((id,index)=>`<section class="doc-section" id="section-${id}" data-section="${id}" aria-labelledby="heading-${id}"><div class="section-heading"><div class="section-title"><span class="section-index">${String(index+1).padStart(2,'0')}</span><h3 id="heading-${id}">${SECTIONS[id].title}</h3></div><button class="section-select" data-select="${id}" aria-label="Select ${SECTIONS[id].title} block">${icon('pencil-line')}Edit</button></div><div class="tool-slot" id="tools-${id}"></div><div class="editor" id="editor-${id}" data-editor="${id}" role="textbox" aria-label="${SECTIONS[id].title}" aria-multiline="true" contenteditable="plaintext-only" spellcheck="true" data-placeholder="Write the ${SECTIONS[id].title.toLowerCase()}…"></div><div class="linked-facts" id="facts-${id}"></div></section>`).join('');
  for(const id of SECTION_IDS)editor(id).textContent=state.blocks[id];
  renderFacts();selectBlock(state.selected,false,false);hydrate();
}
function renderFacts(){
  const context=captureWork();const facts=linkedFacts(state);
  for(const id of SECTION_IDS){
    $(`#facts-${id}`).innerHTML=facts[id].map(f=>`<div class="linked-fact ${f.pending?'pending':''}">${icon(f.pending?'circle-help':'check-check')}<span><strong>${escape(f.label)}</strong><p>${escape(f.text)}</p></span><button class="fact-edit" data-open-question="${f.key}" aria-label="Edit ${ANSWER_LABELS[f.key].toLowerCase()}">${icon('pencil-line')}</button></div>`).join('');
  }
  for(const key of Object.keys(ANSWER_LABELS)){
    const el=$(`#source-${key}`),value=state.answers[key];el.classList.toggle('source-pending',!value);
    if(value)el.textContent=value;else el.innerHTML=`${icon('circle-help')}Not yet confirmed`;
  }
  hydrate();restoreWork(context,false);
}
function selectBlock(id,focus=false,preserve=true){
  if(!SECTION_IDS.includes(id))return;
  const context=preserve?captureWork(id):null;
  state.selected=id;
  $$('.doc-section').forEach(el=>el.classList.toggle('selected',el.dataset.section===id));
  $(`#tools-${id}`).append($('#block-toolbar'));
  $('#block-toolbar').setAttribute('aria-label',`Tools for ${SECTIONS[id].title}`);
  renderToolbar();
  if(context)restoreWork(context,false);
  if(focus)editor(id).focus({preventScroll:true});
  persist(true);
}
function renderToolbar(){
  $('#block-toolbar').classList.toggle('busy',!!pending);$('#tool-status').hidden=!pending;
  if(pending)$('#tool-status').innerHTML=`${icon('loader-circle')}<span>${pending.action==='rewrite'?'Rewriting':'Shortening'} ${SECTIONS[pending.id].title.toLowerCase()}…</span>`;
  $$('[data-transform],#keep-original').forEach(el=>el.disabled=!!pending);
  $('#undo-replacement').disabled=!!pending;
  $('#undo-context').disabled=!!pending;
  $('#undo-context').hidden=!state.history.length||state.history.at(-1).id!==state.selected;
  hydrate($('#block-toolbar'));
}
function renderFrame(){
  const reviewed=state.status==='reviewed',changed=state.hasBeenReviewed&&!reviewed;
  const status=$('#document-status');status.classList.toggle('reviewed',reviewed);status.classList.toggle('changed',changed);
  status.innerHTML=`${icon(reviewed?'circle-check':changed?'pencil-line':'pencil-line')}<span>${reviewed?'Reviewed':'Draft'}</span>`;
  $('#approve-brief').disabled=reviewed||!!pending;
  $('#approve-brief').classList.toggle('is-reviewed',reviewed);
  $('#approve-brief').innerHTML=`${icon(reviewed?'check-check':'check')}<span>${reviewed?'Brief approved':'Approve brief'}</span>`;
  const banner=$('#review-banner');banner.hidden=!state.hasBeenReviewed;
  if(state.hasBeenReviewed){banner.classList.toggle('changed',changed);banner.innerHTML=reviewed?`${icon('circle-check')}<span>Brief reviewed. All required details are confirmed.</span>`:`${icon('pencil-line')}<span>Changed since approval. Review the updated brief again.</span>`;}
  const count=missingAnswers(state).length;
  $('#input-progress-count').textContent=`${2-count} / 2`;
  $('#input-progress-label').textContent=count===2?'Two details to move forward.':count===1?'One more detail to confirm.':'The context is complete.';
  $('#input-progress-fill').style.width=`${(2-count)*50}%`;
  if(count)$('#mobile-input-count').textContent=count;else $('#mobile-input-count').innerHTML=icon('check');
  $('#mobile-input-count').setAttribute('aria-label',count?`${count} required clarifications`:'All details confirmed');
  $('#update-plan').disabled=!answersDirty(state)||!!pending;
  $('#update-plan span').textContent=answersDirty(state)?'Update plan':count===0?'Plan updated':'Update plan';
  $('#answer-save-note').innerHTML=answersDirty(state)?'Unapplied answers.<br>Update the plan, or approve to apply them.':'Your answers become linked context.<br>Your edits stay in place.';
  $('#word-count').textContent=`${Object.values(state.blocks).join(' ').trim().split(/\s+/).filter(Boolean).length} words`;
  $('#undo-replacement').hidden=!state.history.length;
  for(const id of SECTION_IDS){section(id).classList.toggle('empty',approvalAttempted&&!state.blocks[id].trim());editor(id).setAttribute('aria-invalid',approvalAttempted&&!state.blocks[id].trim()?'true':'false');}
  hydrate();renderToolbar();
}
function renderErrors(){
  const keys=missingAnswers(state),empty=emptySections(state);
  $('#approval-errors').hidden=!approvalAttempted||(!keys.length&&!empty.length);
  if(approvalAttempted&&(keys.length||empty.length))$('#approval-errors').innerHTML=`<strong>Before you approve</strong><ul>${keys.map(k=>`<li>${ANSWER_LABELS[k]}</li>`).join('')}${empty.map(id=>`<li>Add text to ${SECTIONS[id].title}</li>`).join('')}</ul>`;
  for(const key of Object.keys(ANSWER_LABELS)){
    const invalid=approvalAttempted&&!state.form[key].trim();$(`#${key}-error`).hidden=!invalid;$(`#${key}-answer`).setAttribute('aria-invalid',invalid?'true':'false');
  }
}
function readEditor(id){return (editor(id).innerText??editor(id).textContent).replace(/\r/g,'').replace(/\u00a0/g,' ');}
function flushEditors(){for(const id of SECTION_IDS)editBlock(state,id,readEditor(id));}
function openSupport(kind,question=null){
  workContext=captureWork();
  const dialog=$(`#${kind==='source'?'source':'input'}-dialog`),panel=$(`#${kind==='source'?'client':'input'}-panel`);
  $(`#${kind==='source'?'source':'input'}-dialog-content`).append(panel);
  document.body.classList.add('modal-open');if(!dialog.open)dialog.showModal();
  if(question)$(`#${question}-answer`).focus({preventScroll:true});
}
function revealQuestion(key){
  if(narrow())openSupport('input',key);
  else{
    const el=$(`#${key}-answer`);el.focus({preventScroll:true});$('#input-panel').scrollTop=Math.max(0,$(`#${key}-question`).offsetTop-22);
    $('#input-panel').classList.add('attention');setTimeout(()=>$('#input-panel').classList.remove('attention'),900);
  }
}
async function runTransform(action){
  if(pending)return;flushEditors();
  const id=state.selected,before=state.blocks[id];pending={id,action};
  editor(id).setAttribute('contenteditable','false');editor(id).setAttribute('aria-busy','true');
  renderFrame();announce(`${action==='rewrite'?'Rewriting':'Shortening'} ${SECTIONS[id].title}.`);
  await new Promise(resolve=>setTimeout(resolve,650));
  let result={changed:false,reason:'changed'};
  if(state.blocks[id]===before)result=transformBlock(state,id,action);
  pending=null;editor(id).setAttribute('contenteditable','plaintext-only');editor(id).setAttribute('aria-busy','false');
  if(result.changed){editor(id).textContent=state.blocks[id];section(id).classList.add('just-updated');setTimeout(()=>section(id).classList.remove('just-updated'),900);toast(`${SECTIONS[id].title} ${action==='rewrite'?'rewritten':'shortened'}. Undo is available below the document.`);}
  else toast(result.reason==='already-short'?'This block is already shorter than the prepared version.':result.reason==='changed'?'Your latest edits were kept. No replacement was made.':'This text is already using that version.');
  renderFrame();renderErrors();queueSave();
}
function applyInputAnswers(){
  flushEditors();const context=captureWork(),changed=applyAnswers(state);
  for(const key of Object.keys(ANSWER_LABELS))$(`#${key}-answer`).value=state.form[key];
  renderFacts();renderFrame();renderErrors();restoreWork(context,false);queueSave();
  if(changed.length)toast('Linked context updated. Your document text is unchanged.');
}
function approveBrief(){
  if(pending)return;flushEditors();approvalAttempted=true;
  const result=approve(state);renderFacts();renderFrame();renderErrors();queueSave();
  if(result.approved){toast('Brief reviewed. Ready for handoff.');announce('Brief approved. Status: Reviewed.');return;}
  if(result.missing.length){toast(`${result.missing.length} required ${result.missing.length===1?'detail is':'details are'} still missing.`);revealQuestion(result.missing[0]);}
  else if(result.empty.length){const id=result.empty[0];selectBlock(id,true);section(id).scrollIntoView({block:'nearest',behavior:reduced()?'instant':'smooth'});toast(`Add text to ${SECTIONS[id].title} before approving.`);}
}
renderDocument();
for(const key of Object.keys(ANSWER_LABELS))$(`#${key}-answer`).value=state.form[key];
renderFrame();renderErrors();
$('#document-sections').addEventListener('focusin',event=>{const id=event.target.closest('[data-editor]')?.dataset.editor;if(id&&id!==state.selected)selectBlock(id,false);});
$('#document-sections').addEventListener('input',event=>{
  const id=event.target.closest('[data-editor]')?.dataset.editor;if(!id)return;
  if(pending?.id===id){editor(id).textContent=state.blocks[id];return;}
  const text=readEditor(id);editBlock(state,id,text);
  if(text.length>6000){editor(id).textContent=state.blocks[id];toast('This block has a 6,000-character limit.');}
  renderFrame();renderErrors();queueSave();
});
$('#document-sections').addEventListener('paste',event=>{
  const el=event.target.closest('[data-editor]');if(!el||!event.clipboardData)return;
  event.preventDefault();if(pending?.id===el.dataset.editor)return;const text=event.clipboardData.getData('text/plain');
  const selection=window.getSelection?.();
  if(selection?.rangeCount&&el.contains(selection.getRangeAt(0).commonAncestorContainer)){
    const range=selection.getRangeAt(0);range.deleteContents();const node=document.createTextNode(text);range.insertNode(node);range.setStartAfter(node);range.collapse(true);selection.removeAllRanges();selection.addRange(range);
  }else el.textContent+=text;
  el.dispatchEvent(new Event('input',{bubbles:true}));
});
$('#document-sections').addEventListener('keydown',event=>{
  if(event.key==='Escape'&&event.target.closest('[data-editor]'))$(`#section-${state.selected} [data-select]`).focus({preventScroll:true});
});
$('#block-toolbar').addEventListener('mousedown',event=>{if(event.target.closest('button'))event.preventDefault();});
$$('[data-transform]').forEach(button=>button.addEventListener('click',()=>runTransform(button.dataset.transform)));
$('#keep-original').addEventListener('click',()=>{
  if(pending)return;flushEditors();const id=state.selected,result=keepOriginal(state,id);
  if(result.changed){editor(id).textContent=state.blocks[id];renderFrame();renderErrors();queueSave();}
  toast(result.changed?'Original text restored. You can undo this replacement.':'Original text kept.');
});
$('#undo-replacement').addEventListener('click',()=>{
  if(pending)return;flushEditors();const result=undoReplacement(state);
  if(result){editor(result.id).textContent=state.blocks[result.id];renderFrame();renderErrors();queueSave();toast(`${SECTIONS[result.id].title} replacement undone.`);}
});
$('#undo-context').addEventListener('click',()=>$('#undo-replacement').click());
$('#clarification-form').addEventListener('input',event=>{
  const key=event.target.name;if(!Object.hasOwn(ANSWER_LABELS,key))return;
  const value=event.target.value;if(state.form[key]!==value){state.form[key]=value;markChanged(state);}
  renderFrame();renderErrors();queueSave();
});
$('#clarification-form').addEventListener('submit',event=>{event.preventDefault();if(!pending)applyInputAnswers();});
$('#approve-brief').addEventListener('click',approveBrief);
$('#open-source').addEventListener('click',()=>openSupport('source'));
$('#open-inputs').addEventListener('click',()=>openSupport('input'));
$('#dismiss-toast').addEventListener('click',()=>$('#toast').hidden=true);
$('#document-sections').addEventListener('click',event=>{
  const target=event.target.closest('[data-select]');if(target)selectBlock(target.dataset.select,true);
  const question=event.target.closest('[data-open-question]')?.dataset.openQuestion;if(question)revealQuestion(question);
});
$$('[data-close]').forEach(button=>button.addEventListener('click',()=>document.getElementById(button.dataset.close).close()));
for(const kind of ['source','input']){
  const dialog=$(`#${kind}-dialog`);
  dialog.addEventListener('close',()=>{
    const panel=$(`#${kind==='source'?'client':'input'}-panel`),slot=$(`#${kind==='source'?'client':'input'}-slot`);slot.prepend(panel);
    $('#document-notices').append($('#toast'));if(!$$('dialog').some(d=>d.open))document.body.classList.remove('modal-open');
    const context=workContext;requestAnimationFrame(()=>restoreWork(context,true));
  });
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
}
matchMedia('(min-width:1051px)').addEventListener('change',event=>{if(event.matches)$$('dialog').filter(d=>d.open).forEach(d=>d.close());});
$('#document-scroll').addEventListener('scroll',()=>{clearTimeout(viewTimer);viewTimer=setTimeout(()=>{state.view.documentTop=$('#document-scroll').scrollTop;persist(true);},200);},{passive:true});
window.addEventListener('scroll',()=>{if(!phone())return;clearTimeout(viewTimer);viewTimer=setTimeout(()=>{state.view.windowTop=window.scrollY||0;persist(true);},200);},{passive:true});
window.addEventListener('pagehide',()=>{clearTimeout(saveTimer);persist(true);});
requestAnimationFrame(()=>{if(phone())window.scrollTo?.({top:state.view.windowTop,behavior:'instant'});else $('#document-scroll').scrollTop=state.view.documentTop;});
persist();
