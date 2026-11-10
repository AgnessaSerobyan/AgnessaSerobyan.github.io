import {tickets,demoNow,specialist} from './data.js';
export const statuses=['Open','Waiting','Resolved'];
export const modes=['reply','note'];
const clone=x=>JSON.parse(JSON.stringify(x));
export function initialState(){return {selected:'1048',filter:'Open',query:'',tickets:tickets.map(t=>({...clone(t),mode:'reply',drafts:{reply:t.initialDraft?t.aiDraft:'',note:''},draftKinds:{reply:t.initialDraft?'ai':'manual',note:'manual'},statusRevision:0})),clock:Date.parse(demoNow),serial:0};}
export function normaliseState(input){
 const fresh=initialState();if(!input||typeof input!=='object')return fresh;
 fresh.selected=fresh.tickets.some(t=>t.id===input.selected)?input.selected:fresh.selected;
 fresh.filter=statuses.includes(input.filter)?input.filter:fresh.filter;fresh.query=typeof input.query==='string'?input.query.slice(0,250):'';
 fresh.clock=Number.isFinite(input.clock)?Math.max(fresh.clock,input.clock):fresh.clock;fresh.serial=Number.isInteger(input.serial)&&input.serial>=0?input.serial:0;
 for(const t of fresh.tickets){const old=Array.isArray(input.tickets)&&input.tickets.find(x=>x?.id===t.id);if(!old)continue;
  if(statuses.includes(old.status))t.status=old.status;t.unread=old.unread===true;t.mode=modes.includes(old.mode)?old.mode:'reply';
  for(const m of modes){t.drafts[m]=typeof old.drafts?.[m]==='string'?old.drafts[m].slice(0,6000):t.drafts[m];t.draftKinds[m]=['ai','edited','manual'].includes(old.draftKinds?.[m])?old.draftKinds[m]:t.draftKinds[m];}
  if(typeof old.updatedAt==='string'&&Number.isFinite(Date.parse(old.updatedAt)))t.updatedAt=old.updatedAt;
  t.statusRevision=Number.isInteger(old.statusRevision)?old.statusRevision:0;
  // Seed messages are authoritative. Only locally-created messages are restored.
  const extra=Array.isArray(old.messages)?old.messages.filter(m=>m&&typeof m.id==='string'&&m.id.startsWith('local-')&&['reply','note','status'].includes(m.kind)&&typeof m.text==='string'&&m.text.trim()&&m.text.length<=6000&&typeof m.at==='string'&&Number.isFinite(Date.parse(m.at))).slice(-100).map(m=>({id:m.id,kind:m.kind,text:m.text,at:m.at,author:specialist.name})):[];
  t.messages.push(...extra);
 }
 const localMessages=fresh.tickets.flatMap(t=>t.messages).filter(m=>m.id.startsWith('local-'));
 fresh.serial=Math.max(fresh.serial,0,...localMessages.map(m=>Number(m.id.match(/^local-(\d+)$/)?.[1])||0));
 fresh.clock=Math.max(fresh.clock,...localMessages.map(m=>Date.parse(m.at)+60000));
 return fresh;
}
export const byId=(state,id)=>state.tickets.find(t=>t.id===id);
export function matches(t,query){const words=query.trim().toLowerCase().split(/\s+/).filter(Boolean);const hay=`${t.subject} ${t.id} ${t.customer.name} ${t.customer.email} ${t.customer.company} ${t.category} ${t.messages.filter(m=>m.kind!=='status').map(m=>m.text).join(' ')}`.toLowerCase();return words.every(w=>hay.includes(w));}
export const counts=(state)=>Object.fromEntries(statuses.map(s=>[s,state.tickets.filter(t=>t.status===s&&matches(t,state.query)).length]));
export const visibleTickets=(state)=>state.tickets.filter(t=>t.status===state.filter&&matches(t,state.query)).sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt));
export function selectTicket(state,id){const t=byId(state,id);if(!t)return false;state.selected=id;t.unread=false;return true;}
export function setDraft(state,id,mode,text,kind='manual'){const t=byId(state,id);if(!t||!modes.includes(mode))return false;t.drafts[mode]=String(text).slice(0,6000);t.draftKinds[mode]=kind;return true;}
function stamp(state){const at=new Date(state.clock).toISOString();state.clock+=60000;return at;}
function localId(state){return `local-${++state.serial}`;}
export function addMessage(state,id,mode){const t=byId(state,id);if(!t||!modes.includes(mode))return {ok:false,error:'Choose a conversation first.'};const text=t.drafts[mode].trim();if(!text)return {ok:false,error:mode==='note'?'Write a note before adding it.':'Write a reply before sending it.'};
 const message={id:localId(state),at:stamp(state),kind:mode,text,author:specialist.name};t.messages.push(message);t.updatedAt=message.at;t.drafts[mode]='';t.draftKinds[mode]='manual';return {ok:true,message};}
export function changeStatus(state,id,status){const t=byId(state,id);if(!t||!statuses.includes(status)||status===t.status)return null;const from=t.status;t.status=status;t.statusRevision++;const event={id:localId(state),at:stamp(state),kind:'status',author:specialist.name,text:`${specialist.name} marked this conversation as ${status}.`};t.messages.push(event);t.updatedAt=event.at;return {ticketId:id,from,to:status,eventId:event.id,revision:t.statusRevision};}
export function undoStatus(state,action){const t=byId(state,action?.ticketId);if(!t||t.statusRevision!==action.revision||t.status!==action.to)return false;t.status=action.from;t.statusRevision++;t.messages=t.messages.filter(m=>m.id!==action.eventId);t.updatedAt=t.messages.at(-1)?.at||t.updatedAt;return true;}
export function applyAI(state,id,expected){const t=byId(state,id);if(!t||t.drafts.reply!==expected)return null;const action={ticketId:id,before:t.drafts.reply,beforeKind:t.draftKinds.reply,after:t.aiDraft};t.drafts.reply=t.aiDraft;t.draftKinds.reply='ai';return action;}
export function undoAI(state,action){const t=byId(state,action?.ticketId);if(!t||t.drafts.reply!==action.after)return false;t.drafts.reply=action.before;t.draftKinds.reply=action.beforeKind;return true;}
export function lastPreview(t){const m=[...t.messages].reverse().find(m=>m.kind!=='status');return m?{text:(m.kind==='note'?'Note: ':m.kind==='reply'?(m.author===specialist.name?'You: ':`${m.author.split(' ')[0]}: `):'')+m.text,at:t.updatedAt}: {text:'No messages yet.',at:t.updatedAt};}
export const paymentSummary=t=>({paid:t.customer.events.filter(e=>e.status==='Paid'&&typeof e.amount==='number').length,pending:t.customer.events.filter(e=>e.status==='Pending'&&typeof e.amount==='number').length});
