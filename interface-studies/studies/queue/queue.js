import {specialist} from './data.js';
import {statuses,initialState,normaliseState,byId,counts,visibleTickets,selectTicket,setDraft,addMessage,changeStatus,undoStatus,applyAI,undoAI,lastPreview,paymentSummary} from './model.js';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=n=>`<img class="icon" src="./assets/icons/${n}.svg" alt="">`;
const initials=name=>name.split(' ').map(s=>s[0]).slice(0,2).join('');
const shortDate=at=>new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(at));
const fullDate=at=>new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(at));
const clock=at=>new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'UTC'}).format(new Date(at));
const dayLabel=at=>new Intl.DateTimeFormat('en-GB',{weekday:'long',day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(at));
const listTime=at=>at.startsWith('2026-10-16')?clock(at):at.startsWith('2026-10-15')?'Yesterday':shortDate(at);
const preview=new URLSearchParams(location.search).has('preview');
const storageKey='interface-studies-queue-v1';
const mobile=matchMedia('(max-width:760px)'),inlineContext=matchMedia('(min-width:1181px)'),reduced=matchMedia('(prefers-reduced-motion:reduce)');
let saved;try{saved=!preview&&JSON.parse(localStorage.getItem(storageKey));}catch{}
let state=normaliseState(saved),mobileView='inbox',pendingAI=null,replaceTarget=null,lastAI=null,toastUndo=null,toastTimer=null,storageWarned=false;
const threadPositions=new Map(),editorPositions=new Map();
const active=()=>byId(state,state.selected);
function persist(){if(preview)return;try{localStorage.setItem(storageKey,JSON.stringify(state));}catch{if(!storageWarned){storageWarned=true;notify('Changes stay in this tab; browser storage is unavailable.');}}}
function openDialog(id){const d=$(`#${id}`);if(!d.open)d.showModal();}
function closeDialog(id){const d=$(`#${id}`);if(d.open)d.close();}
function notify(text,undo=null){clearTimeout(toastTimer);toastUndo=undo;const host=$$('dialog[open]').at(-1)||document.body;if($('#toast').parentElement!==host)host.append($('#toast'));$('#toast-text').textContent=text;$('#toast-undo').hidden=!undo;$('#toast').hidden=false;toastTimer=setTimeout(()=>{$('#toast').hidden=true;toastUndo=null;},undo?14000:6500);}
function rememberWork(){const t=active();if(!t)return;threadPositions.set(t.id,$('#thread').scrollTop);editorPositions.set(`${t.id}:${t.mode}`,{start:$('#reply-text').selectionStart||0,end:$('#reply-text').selectionEnd||0,scroll:$('#reply-text').scrollTop||0});}
function renderInbox(){
 const c=counts(state),visible=visibleTickets(state);$('#inbox-total').textContent=state.tickets.length;
 for(const s of statuses){$(`#count-${s.toLowerCase()}`).textContent=c[s];const b=$(`[data-filter="${s}"]`);b.classList.toggle('active',state.filter===s);b.setAttribute('aria-pressed',String(state.filter===s));}
 $('#list-heading').textContent={Open:'Needs a reply',Waiting:'Waiting on a customer',Resolved:'Completed conversations'}[state.filter];$('#list-count').textContent=`${visible.length} ${visible.length===1?'conversation':'conversations'}`;
 $('#ticket-list').innerHTML=visible.map(t=>{const p=lastPreview(t);return `<button class="ticket-row ${state.selected===t.id?'selected':''} ${t.unread?'unread':''}" id="ticket-${t.id}" data-ticket="${t.id}" aria-pressed="${state.selected===t.id}" aria-label="${esc(t.subject)}, ${esc(t.customer.name)}, ${t.status}${t.unread?', unread':''}"><div class="ticket-top"><span class="avatar ${t.customer.colour}">${t.customer.initials}</span><span class="ticket-person">${esc(t.customer.name)}</span>${t.unread?'<span class="unread-dot" aria-label="Unread"></span>':''}<time datetime="${t.updatedAt}" title="${fullDate(t.updatedAt)}, ${clock(t.updatedAt)} UTC">${listTime(t.updatedAt)}</time></div><h2 class="ticket-subject">${esc(t.subject)}</h2><p class="ticket-preview">${esc(p.text)}</p><div class="ticket-bottom"><span class="ticket-status ${t.status.toLowerCase()}"><i aria-hidden="true"></i>${t.status}</span><span class="ticket-assignee">${icon('user-round')}${esc(t.assignee.split(' ')[0])}</span></div></button>`;}).join('');
 $('#ticket-list').hidden=!visible.length;$('#inbox-empty').hidden=!!visible.length;$('#clear-search').hidden=!state.query;
 $('#empty-description').textContent=state.query?`No ${state.filter.toLowerCase()} conversations match “${state.query}”. Try another status or clear your search.`:`There are no ${state.filter.toLowerCase()} conversations in this demo. Choose another status to continue.`;
 $('#show-matches').hidden=!statuses.some(s=>s!==state.filter&&c[s]>0);$('#show-matches').textContent=state.query?'Show matching conversations':'Explore another status';
 $('#inbox-footer-text').textContent=state.query?`${Object.values(c).reduce((a,b)=>a+b,0)} matches across all statuses`:'Replies and notes are saved locally.';
}
function renderHeader(){const t=active();$('#ticket-number').textContent=`CONVERSATION / ${t.id}`;$('#conversation-category').textContent=t.category;$('#conversation-title').textContent=t.subject;$('#conversation-customer').textContent=t.customer.name;$('#conversation-company').textContent=t.customer.company;$('#conversation-status').value=t.status;$('#status-control').className=`status-control ${t.status.toLowerCase()}`;renderViewNotice();}
function renderViewNotice(){const t=active();$('#view-notice').hidden=t.status===state.filter;$('#view-notice-text').textContent=`This conversation is ${t.status.toLowerCase()}.`;$('#view-status').innerHTML=`View in ${t.status}${icon('chevron-right')}`;}
function messageHTML(m,t,newId){
 if(m.kind==='status')return `<div class="message status ${m.id===newId?'new-message':''}" data-message="${m.id}">${icon('circle-check')}<span>${esc(m.text)}</span><time datetime="${m.at}" title="${fullDate(m.at)} UTC">${clock(m.at)}</time></div>`;
 const isCustomer=m.kind==='customer',name=isCustomer?t.customer.name:m.author||specialist.name;
 const meta=m.kind==='note'?`${icon('lock-keyhole')}<strong>Internal note</strong><span class="message-kind">${esc(name)}</span>`:`<span class="avatar ${isCustomer?t.customer.colour:'agent'}">${isCustomer?t.customer.initials:initials(name)}</span><strong>${esc(name)}</strong>${!isCustomer?'<span class="message-kind">Reply</span>':''}`;
 return `<article class="message ${m.kind} ${m.id===newId?'new-message':''}" data-message="${m.id}" aria-label="${m.kind==='note'?'Internal note, visible only to your team':isCustomer?'Customer message':'Reply'} from ${esc(name)}"><header class="message-meta">${meta}<time datetime="${m.at}" title="${fullDate(m.at)}, ${clock(m.at)} UTC">${clock(m.at)}</time></header><p class="message-body">${esc(m.text)}</p></article>`;
}
function renderThread({newId=null,change=false,bottom=false}={}){
 const t=active();let date='';$('#messages').innerHTML=t.messages.map(m=>{const key=m.at.slice(0,10);let divider='';if(key!==date){date=key;divider=`<div class="day-divider">${dayLabel(m.at)}</div>`;}return divider+messageHTML(m,t,newId);}).join('');
 if(change){$('#messages').classList.remove('conversation-content-enter');requestAnimationFrame(()=>$('#messages').classList.add('conversation-content-enter'));}
 requestAnimationFrame(()=>{const top=bottom||!threadPositions.has(t.id)?$('#thread').scrollHeight:threadPositions.get(t.id);$('#thread').scrollTop=top;});
}
function renderComposer(){
 const t=active(),mode=t.mode,editor=$('#reply-text');$('#composer').dataset.mode=mode;$('#composer').setAttribute('aria-label',mode==='note'?'Internal note editor':'Reply editor');
 for(const m of ['reply','note']){const b=$(`#mode-${m}`);b.classList.toggle('active',m===mode);b.setAttribute('aria-selected',String(m===mode));b.tabIndex=m===mode?0:-1;}
 $('#editor-region').setAttribute('aria-labelledby',`mode-${mode}`);
 if(editor.value!==t.drafts[mode])editor.value=t.drafts[mode];
 const pos=editorPositions.get(`${t.id}:${mode}`);if(pos){editor.setSelectionRange(Math.min(pos.start,editor.value.length),Math.min(pos.end,editor.value.length));editor.scrollTop=pos.scroll;}
 $('#reply-label').textContent=mode==='note'?'Internal note, visible only to your team':`Reply to ${t.customer.name}`;
 editor.setAttribute('aria-label',$('#reply-label').textContent);editor.placeholder=mode==='note'?'Add context for your team. This note stays internal.':`Write a reply to ${t.customer.name.split(' ')[0]}…`;
 $('#editor-audience').innerHTML=mode==='note'?`${icon('lock-keyhole')}Only visible to your team`:`${icon('mail')}Reply to ${esc(t.customer.name)}`;
 $('#send-label').textContent=mode==='note'?'Add note':'Send reply';$('#send-icon').src=`./assets/icons/${mode==='note'?'notebook-pen':'send'}.svg`;
 $('#composer-hint').innerHTML=mode==='note'?'<span class="local-dot"></span>Internal note · Never sent to the customer':'<span class="local-dot"></span>Demo workspace · Replies are simulated';
 $('#keyboard-hint').textContent=mode==='note'?'⌘ / Ctrl + Enter to add note':'⌘ / Ctrl + Enter to send';
 $('#insert-ai').hidden=mode==='note';$('#composer-error').hidden=true;editor.removeAttribute('aria-invalid');updateDraftMeta();
}
function updateDraftMeta(){const t=active(),processing=pendingAI?.ticketId===t.id&&t.mode==='reply';const label=t.mode==='note'?'Internal draft':t.draftKinds.reply==='ai'?'AI draft · Review before sending':t.drafts.reply?'Edited draft':'Your reply draft';$('#draft-label').textContent=processing?'Preparing a local suggestion…':label;$('#insert-ai').disabled=!!pendingAI;$('#insert-ai').setAttribute('aria-busy',String(!!pendingAI));$('#insert-ai span').textContent=processing?'Preparing…':'Insert AI draft';$('#reply-text').readOnly=!!processing;$('#reply-text').setAttribute('aria-busy',String(!!processing));$('#send-message').disabled=!!processing||!t.drafts[t.mode].trim();$('#undo-ai').hidden=!(t.mode==='reply'&&lastAI?.ticketId===t.id&&t.drafts.reply===lastAI.after&&lastAI.before!==lastAI.after);}
function renderContext(){const t=active(),c=t.customer,summary=paymentSummary(t);const eventHTML=c.events.map(e=>`<div class="account-event"><div class="event-left">${esc(e.title)}<span>${shortDate(e.at)} · ${clock(e.at)} UTC</span></div><div class="event-right">${typeof e.amount==='number'?`<span class="event-amount">€${e.amount.toFixed(2)}</span>`:''}<span class="event-status ${e.status.toLowerCase()}"><i aria-hidden="true"></i>${e.status}</span></div></div>`).join('');
 $('#context-content').innerHTML=`<section class="identity-card"><span class="avatar ${c.colour}">${c.initials}</span><h3>${esc(c.name)}</h3><p class="customer-email">${esc(c.email)}</p><p class="customer-company">${icon('user-round')}${esc(c.company)}</p></section>
 <section class="context-section"><h3>ACCOUNT ${icon('credit-card')}</h3><dl class="account-facts"><dt>Plan</dt><dd><span class="plan-name">${esc(c.plan)}</span><span class="plan-price">${esc(c.price)}</span></dd><dt>Subscription since</dt><dd>${c.subscriptionStart?fullDate(c.subscriptionStart):'Not started'}</dd><dt>Status</dt><dd><span class="account-active"><i aria-hidden="true"></i>${esc(c.accountStatus)}</span></dd></dl></section>
 <section class="context-section"><h3>ASSIGNED SPECIALIST</h3><div class="assigned-person"><span class="avatar agent">${initials(t.assignee)}</span><div><strong>${esc(t.assignee)}${t.assignee===specialist.name?' <span class="you-label">(you)</span>':''}</strong><span>Customer care</span></div></div></section>
 <section class="context-section"><h3>RECENT EVENTS ${icon('clock-3')}</h3><div class="event-list">${eventHTML||'<p class="no-history">No payment events recorded.</p>'}</div>${summary.paid||summary.pending?`<p class="payment-summary">${icon('info')}${summary.paid} paid${summary.pending?` · ${summary.pending} pending, not settled`:''}</p>`:''}</section>
 <section class="context-section"><h3>PREVIOUS CONVERSATION</h3>${c.previous?`<button class="previous-ticket" data-previous="${t.id}"><strong>${esc(c.previous.subject)}</strong><span>${icon('circle-check')}Resolved · ${shortDate(c.previous.closed)}<span class="sr-only">. Open previous conversation</span></span></button>`:'<p class="no-history">This is the customer’s first conversation.</p>'}</section><p class="context-note">${esc(c.context)}</p>`;
}
function syncLayout(){const isMobile=mobile.matches;$('#workspace').dataset.mobileView=mobileView;$('.search-field').hidden=isMobile&&mobileView==='conversation';if(inlineContext.matches&&$('#context-dialog').open)closeDialog('context-dialog');}
function renderAll({change=false}={}){renderInbox();renderHeader();renderThread({change});renderComposer();renderContext();syncLayout();}
function chooseTicket(id){rememberWork();if(!selectTicket(state,id))return;mobileView='conversation';renderAll({change:true});persist();requestAnimationFrame(()=>$('#conversation-title').focus({preventScroll:true}));}
function setFilter(status){state.filter=status;renderInbox();renderViewNotice();persist();}
function setMode(mode,{focus=true}={}){if(!['reply','note'].includes(mode))return;rememberWork();active().mode=mode;renderComposer();persist();if(focus)$('#reply-text').focus({preventScroll:true});}
function submitMessage(){const t=active();if(pendingAI?.ticketId===t.id&&t.mode==='reply')return;const result=addMessage(state,t.id,t.mode);if(!result.ok){$('#composer-error').textContent=result.error;$('#composer-error').hidden=false;$('#reply-text').setAttribute('aria-invalid','true');$('#reply-text').focus();return;}
 editorPositions.delete(`${t.id}:${t.mode}`);if(lastAI?.ticketId===t.id&&t.mode==='reply')lastAI=null;renderInbox();renderThread({newId:result.message.id,bottom:true});renderComposer();persist();$('#reply-text').focus({preventScroll:true});notify(t.mode==='note'?'Internal note added. Only your team can see it.':'Reply added to the demo conversation.');}
function beginAI(id){if(pendingAI)return;const t=byId(state,id);if(!t)return;const operation={ticketId:id,expected:t.drafts.reply,token:Symbol('local-ai')};pendingAI=operation;updateDraftMeta();setTimeout(()=>{if(pendingAI!==operation)return;const action=applyAI(state,id,operation.expected);pendingAI=null;if(action){lastAI=action;persist();if(state.selected===id)renderComposer();else updateDraftMeta();notify(`AI reply draft ready for ${t.customer.name.split(' ')[0]}.`,action.before!==action.after?()=>restoreAI(action):null);}else{updateDraftMeta();notify('Your newer edits were kept. Insert the suggestion again when ready.');}},reduced.matches?260:650);}
function restoreAI(action){if(undoAI(state,action)){if(lastAI===action)lastAI=null;persist();if(state.selected===action.ticketId)renderComposer();notify('Previous reply draft restored.');}else notify('The draft has newer edits, so they were kept.');}
function requestAI(){const t=active();if(t.mode!=='reply'||pendingAI)return;if(t.drafts.reply.trim()&&t.drafts.reply!==t.aiDraft){replaceTarget=t.id;openDialog('replace-dialog');}else beginAI(t.id);}
function setStatus(status){const t=active(),action=changeStatus(state,t.id,status);if(!action)return;renderInbox();renderHeader();renderThread({newId:action.eventId,bottom:true});persist();notify(`Conversation marked ${status.toLowerCase()}.`,()=>{if(undoStatus(state,action)){renderInbox();if(state.selected===action.ticketId){renderHeader();renderThread({bottom:true});}persist();notify(`Status restored to ${action.from.toLowerCase()}.`);}else notify('A newer status change was kept.');});}
function openContext(){rememberWork();const d=$('#context-dialog');if($('#customer-context').parentElement!==d)d.append($('#customer-context'));openDialog('context-dialog');$('#context-close').focus({preventScroll:true});}
function openPrevious(){const t=active(),p=t.customer.previous;if(!p)return;$('#previous-content').innerHTML=`<h2 id="previous-title">${esc(p.subject)}</h2><p class="previous-state">${icon('circle-check')}#${p.id} · Resolved ${fullDate(p.closed)}</p><article class="message customer"><div class="message-meta"><strong>${esc(t.customer.name)}</strong></div><p class="message-body">${esc(p.question)}</p></article><article class="message reply"><div class="message-meta"><strong>Customer care</strong></div><p class="message-body">${esc(p.answer)}</p></article>`;openDialog('previous-dialog');}
function showInbox({focus=false}={}){rememberWork();mobileView='inbox';syncLayout();if(focus)requestAnimationFrame(()=>($(`#ticket-${state.selected}`)||$('#search')).focus({preventScroll:true}));}
$('#ticket-list').addEventListener('click',e=>{const b=e.target.closest('[data-ticket]');if(b)chooseTicket(b.dataset.ticket);});
$('#ticket-list').addEventListener('keydown',e=>{if(!['ArrowDown','ArrowUp'].includes(e.key))return;const rows=$$('[data-ticket]'),i=rows.indexOf(e.target.closest('[data-ticket]'));if(i<0)return;e.preventDefault();rows[Math.max(0,Math.min(rows.length-1,i+(e.key==='ArrowDown'?1:-1)))].focus();});
$('#search').addEventListener('input',e=>{state.query=e.target.value.slice(0,250);renderInbox();persist();});
$$('[data-filter]').forEach(b=>b.addEventListener('click',()=>setFilter(b.dataset.filter)));
$('#clear-search').addEventListener('click',()=>{state.query='';$('#search').value='';renderInbox();persist();$('#search').focus();});
$('#show-matches').addEventListener('click',()=>{const c=counts(state),next=statuses.find(s=>c[s]>0);if(next)setFilter(next);});
$('#view-status').addEventListener('click',()=>setFilter(active().status));
$('#conversation-status').addEventListener('change',e=>setStatus(e.target.value));
$$('[data-mode]').filter(b=>b.tagName==='BUTTON').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
$('.mode-tabs').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const mode=active().mode==='reply'?'note':'reply';setMode(mode,{focus:false});$(`#mode-${mode}`).focus();});
$('#reply-text').addEventListener('input',e=>{const t=active(),kind=t.mode==='reply'&&t.draftKinds.reply==='ai'?'edited':'manual';setDraft(state,t.id,t.mode,e.target.value,kind);$('#composer-error').hidden=true;e.target.removeAttribute('aria-invalid');updateDraftMeta();persist();});
$('#reply-text').addEventListener('blur',rememberWork);
$('#reply-text').addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){e.preventDefault();submitMessage();}});
$('#composer').addEventListener('submit',e=>{e.preventDefault();submitMessage();});
$('#insert-ai').addEventListener('click',requestAI);
$('#replace-confirm').addEventListener('click',()=>{const id=replaceTarget;closeDialog('replace-dialog');replaceTarget=null;beginAI(id);});
$('#undo-ai').addEventListener('click',()=>{if(lastAI)restoreAI(lastAI);});
$('#context-open').addEventListener('click',openContext);$('#context-open-mobile').addEventListener('click',openContext);$('#context-close').addEventListener('click',()=>closeDialog('context-dialog'));
$('#context-dialog').addEventListener('close',()=>{if($('#customer-context').parentElement!==$('#context-home'))$('#context-home').append($('#customer-context'));if(!inlineContext.matches)(mobile.matches?$('#context-open-mobile'):$('#context-open')).focus({preventScroll:true});});
$('#context-content').addEventListener('click',e=>{if(e.target.closest('[data-previous]'))openPrevious();});
$('#back-inbox').addEventListener('click',()=>showInbox({focus:true}));
for(const id of ['about-open','context-about'])$(`#${id}`).addEventListener('click',()=>{$('#profile-menu').open=false;openDialog('about-dialog');});
$('#reset-open').addEventListener('click',()=>{$('#profile-menu').open=false;openDialog('reset-dialog');});
$('#reset-confirm').addEventListener('click',()=>{pendingAI=null;lastAI=null;replaceTarget=null;toastUndo=null;clearTimeout(toastTimer);$$('dialog[open]').forEach(d=>d.close());state=initialState();threadPositions.clear();editorPositions.clear();mobileView=mobile.matches?'inbox':'conversation';$('#search').value='';renderAll({change:true});persist();notify('Fresh workspace ready.');});
$$('[data-close]').forEach(b=>b.addEventListener('click',()=>closeDialog(b.dataset.close)));
$$('dialog').forEach(d=>{d.addEventListener('close',()=>{if($('#toast').parentElement===d)document.body.append($('#toast'));});d.addEventListener('click',e=>{if(e.target!==d)return;const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();});});
$('#toast-undo').addEventListener('click',()=>{const undo=toastUndo;toastUndo=null;if(undo)undo();});
$('#toast-close').addEventListener('click',()=>{$('#toast').hidden=true;toastUndo=null;clearTimeout(toastTimer);});
document.addEventListener('keydown',e=>{if(e.key==='/'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!$$('dialog[open]').length&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)){e.preventDefault();if(mobile.matches)showInbox();$('#search').focus();}if(e.key==='Escape'&&!$$('dialog[open]').length&&$('#profile-menu').open)$('#profile-menu').open=false;});
document.addEventListener('click',e=>{if($('#profile-menu').open&&!e.target.closest('#profile-menu'))$('#profile-menu').open=false;});
mobile.addEventListener('change',()=>{if(mobile.matches)mobileView='conversation';syncLayout();});inlineContext.addEventListener('change',syncLayout);
let maxViewport=window.visualViewport?.height||window.innerHeight||844;
function syncViewport(){const height=window.visualViewport?.height||window.innerHeight||844;if(mobile.matches){maxViewport=Math.max(maxViewport,height);document.documentElement.style.setProperty('--app-height',`${Math.round(height)}px`);document.body.classList.toggle('keyboard-open',height<maxViewport*.78);}else{document.documentElement.style.removeProperty('--app-height');document.body.classList.remove('keyboard-open');}}
window.visualViewport?.addEventListener('resize',syncViewport);window.addEventListener('resize',syncViewport);
$('#search').value=state.query;renderAll();syncViewport();
