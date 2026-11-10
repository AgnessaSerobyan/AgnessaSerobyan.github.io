export const defaults=Object.freeze({accent:'#C4B5FD',radius:12,density:'comfortable',textSize:16,mode:'dark'});
export const presets=[{name:'Lavender',hex:'#C4B5FD'},{name:'Pistachio',hex:'#C9DDA8'},{name:'Powder',hex:'#E6B8CB'}];
export function parseHex(value){if(typeof value!=='string')return null;let s=value.trim();if(!/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(s))return null;if(s.length===4)s='#'+[...s.slice(1)].map(x=>x+x).join('');return s.toUpperCase();}
export function theme(value){const v=value&&typeof value==='object'?value:{};return {accent:parseHex(v.accent)||defaults.accent,radius:[4,12,20].includes(v.radius)?v.radius:12,density:['comfortable','compact'].includes(v.density)?v.density:'comfortable',textSize:[14,16,18].includes(v.textSize)?v.textSize:16,mode:['light','dark'].includes(v.mode)?v.mode:'dark'};}
export const initialState=()=>({draft:{...defaults},published:{...defaults},revision:0,publishedAt:null});
export function normalise(value){if(!value||typeof value!=='object')return initialState();return {draft:theme(value.draft),published:theme(value.published),revision:Number.isSafeInteger(value.revision)&&value.revision>=0?value.revision:0,publishedAt:typeof value.publishedAt==='string'&&Number.isFinite(Date.parse(value.publishedAt))?value.publishedAt:null};}
export const isDirty=s=>Object.keys(defaults).some(k=>s.draft[k]!==s.published[k]);
export const version=s=>`1.0.${s.revision}`;
export function publish(s,now=new Date().toISOString()){if(!isDirty(s))return false;s.published={...s.draft};s.revision+=1;s.publishedAt=now;return true;}
export function reset(s){s.draft={...s.published};}
const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
export function luminance(hex){const c=rgb(hex).map(x=>{const v=x/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return c.reduce((n,x,i)=>n+x*[.2126,.7152,.0722][i],0);}
export function contrast(a,b){const [x,y]=[luminance(a),luminance(b)].sort((a,b)=>a-b);return (y+.05)/(x+.05);}
export const onAccent=hex=>{const dark=contrast(hex,'#181923'),light=contrast(hex,'#FFFFFF');return Math.max(dark,light)<4.5?'#000000':dark>=light?'#181923':'#FFFFFF';};
export function accessibleAccent(hex,background,minimum=4.5){if(contrast(hex,background)>=minimum)return hex;const target=luminance(background)<.45?255:0,channels=rgb(hex);for(let n=1;n<=100;n++){const h='#'+channels.map(x=>Math.round(x+(target-x)*n/100).toString(16).padStart(2,'0')).join('');if(contrast(h,background)>=minimum)return h;}return target?'#FFFFFF':'#000000';}
export const projects=[
 {id:'northline',name:'Northline — a new rhythm for hybrid work',description:'Brand campaign · Launch strategy',status:'In review',initials:'N',tone:'lavender',people:[['ML','Maya Laurent'],['NP','Nina Patel']],updated:'Updated 2 hours ago'},
 {id:'fieldwork',name:'Fieldwork / Autumn collection',description:'Seasonal campaign · Creative direction',status:'Approved',initials:'F',tone:'sage',people:[['ER','Elena Ruiz'],['LB','Lena Brooks']],updated:'Updated 4 hours ago'},
 {id:'morrow',name:'Morrow — everyday objects, thoughtfully made',description:'Product launch · Visual storytelling',status:'Draft',initials:'M',tone:'powder',people:[['EM','Eva Morgan'],['ML','Maya Laurent']],updated:'Updated yesterday'},
 {id:'common-ground',name:'Common Ground / A place to belong',description:'Community campaign · Editorial',status:'In review',initials:'C',tone:'sand',people:[['NP','Nina Patel'],['ER','Elena Ruiz']],updated:'Updated yesterday'}
];
export function visibleProjects(items,query,tab){const words=query.toLowerCase().trim().split(/\s+/).filter(Boolean);return items.filter(p=>(tab==='All'||p.status===tab)&&words.every(w=>[p.name,p.description,p.status,...p.people.flat()].join(' ').toLowerCase().includes(w)));}
