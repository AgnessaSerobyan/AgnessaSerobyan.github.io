export const PROJECT = { name:'Aural', product:'Wireless headphones launch', budget:24000, weeks:4 };
export const SECTION_IDS = ['objective','audience','message','channels','deliverables'];
export const SECTIONS = {
  objective:{title:'Objective', text:'Introduce Aural’s wireless headphones to hybrid workers over four weeks. Use the €24,000 campaign budget to build awareness and drive qualified visits to the product page. Measure reach, click-through rate and cost per visit.'},
  audience:{title:'Audience', text:'People who split their working week between home, the office and shared spaces. Focus on the routines that connect these settings: getting ready, commuting and settling into work. This is an audience hypothesis to validate, not a confirmed customer segment.'},
  message:{title:'Key message', text:'AI proposal: “Find your rhythm, wherever work takes you.” Position the headphones around the changing workday. This is a creative direction, not a claim about sound quality, battery life or noise cancellation.'},
  channels:{title:'Channels', text:'AI proposal: €12,000 for paid social to test creative, €8,000 for paid search to capture active interest, and €4,000 for retargeting to reconnect with product-page visitors. Validate audience reach, language and media costs before launch.'},
  deliverables:{title:'Deliverables', text:'AI proposal: four social concepts with two variants each, three search ad groups, retargeting adaptations and one landing-page outline. Review performance weekly throughout the four-week campaign. Check every product claim against client-approved facts before publication.'},
};
export const VARIANTS = {
  objective:{rewrite:'Launch Aural’s wireless headphones with a four-week campaign for hybrid workers. Put €24,000 behind awareness and qualified product-page traffic, using reach, click-through rate and cost per visit to guide the review.',shorten:'Build awareness and qualified product-page traffic for Aural’s wireless headphones. Run for four weeks with €24,000, tracking reach, click-through rate and cost per visit.'},
  audience:{rewrite:'Start with the workday, not a demographic: people moving between home, offices and shared workspaces. Explore the moments that shape their listening routines, then validate this audience hypothesis with campaign learning.',shorten:'Hybrid workers moving between home, offices and shared spaces. Test a message built around their changing daily routines; validate the audience hypothesis.'},
  message:{rewrite:'AI proposal: “A new rhythm for the way you work.” Build the creative around the transitions in a hybrid workday. Keep all performance promises out of the copy until the client confirms the supporting product facts.',shorten:'AI proposal: “Find your rhythm, wherever work takes you.” A creative direction for hybrid work; product performance claims require client confirmation.'},
  channels:{rewrite:'AI proposal: test creative through paid social (€12,000), meet existing interest through paid search (€8,000), and follow up with product-page visitors through retargeting (€4,000). Check reach, language and costs for the confirmed market.',shorten:'AI proposal: paid social €12,000; paid search €8,000; retargeting €4,000. Validate reach, language and local media costs before launch.'},
  deliverables:{rewrite:'AI proposal: produce eight social ads from four concepts, three search ad groups, retargeting adaptations and a landing-page outline. Schedule four weekly performance reviews. Use only client-approved product claims in launch materials.',shorten:'AI proposal: eight social ads, three search ad groups, retargeting adaptations, a landing-page outline and four weekly reviews. Fact-check all product claims before publishing.'},
};
export const ANSWER_LABELS = {benefits:'Confirmed product benefits',geography:'Campaign geography'};
export function createState(){
  return {version:1,blocks:Object.fromEntries(SECTION_IDS.map(id=>[id,SECTIONS[id].text])),answers:{benefits:'',geography:''},form:{benefits:'',geography:''},originals:Object.fromEntries(SECTION_IDS.map(id=>[id,null])),history:[],selected:'message',status:'draft',hasBeenReviewed:false,reviewedAt:null,view:{documentTop:0,windowTop:0}};
}
export function restoreState(raw){
  const state=createState();
  if(!raw||raw.version!==1)return state;
  for(const id of SECTION_IDS){if(typeof raw.blocks?.[id]==='string')state.blocks[id]=raw.blocks[id].slice(0,6000);if(typeof raw.originals?.[id]==='string')state.originals[id]=raw.originals[id].slice(0,6000);}
  for(const key of Object.keys(ANSWER_LABELS)){
    const limit=key==='benefits'?1200:180;
    if(typeof raw.answers?.[key]==='string')state.answers[key]=raw.answers[key].slice(0,limit);
    state.form[key]=typeof raw.form?.[key]==='string'?raw.form[key].slice(0,limit):state.answers[key];
  }
  if(SECTION_IDS.includes(raw.selected))state.selected=raw.selected;
  state.hasBeenReviewed=raw.hasBeenReviewed===true;
  state.reviewedAt=typeof raw.reviewedAt==='string'?raw.reviewedAt:null;
  if(raw.status==='reviewed'&&state.hasBeenReviewed&&!missingAnswers(state).length&&!emptySections(state).length)state.status='reviewed';
  if(raw.view){state.view.documentTop=Math.max(0,Number(raw.view.documentTop)||0);state.view.windowTop=Math.max(0,Number(raw.view.windowTop)||0);}
  return state;
}
export function markChanged(state){state.status='draft';}
export function editBlock(state,id,text){
  if(!SECTION_IDS.includes(id)||state.blocks[id]===text)return false;
  state.blocks[id]=String(text).slice(0,6000);state.originals[id]=null;
  state.history=state.history.filter(item=>item.id!==id);
  markChanged(state);return true;
}
export const missingAnswers = state => Object.keys(ANSWER_LABELS).filter(key=>!state.answers[key].trim());
export const emptySections = state => SECTION_IDS.filter(id=>!state.blocks[id].trim());
export const answersDirty = state => Object.keys(ANSWER_LABELS).some(key=>state.answers[key]!==state.form[key].trim());
export function applyAnswers(state){
  const changed=[];
  for(const key of Object.keys(ANSWER_LABELS)){
    const value=state.form[key].trim();
    if(state.answers[key]!==value){state.answers[key]=value;state.form[key]=value;changed.push(key);}
  }
  if(changed.length)markChanged(state);
  return changed;
}
export function linkedFacts(state){
  const {benefits,geography}=state.answers;
  const benefitFact=benefits?{key:'benefits',label:'Client-confirmed benefits',text:benefits,pending:false}:{key:'benefits',label:'Product claims need confirmation',text:'No performance claims are approved yet.',pending:true};
  const geographyFact=geography?{key:'geography',label:'Confirmed market',text:geography,pending:false}:{key:'geography',label:'Market needs confirmation',text:'Confirm where the campaign will run.',pending:true};
  return {objective:[],audience:[geographyFact],message:[benefitFact],channels:[geography?{...geographyFact,text:`${geography}. Check local reach, language and media costs.`}:geographyFact],deliverables:[benefits?{key:'benefits',label:'Creative fact-check',text:`Use only these approved benefits: ${benefits}`,pending:false}:benefitFact]};
}
function replace(state,id,text,kind,originalAfter){
  const before=state.blocks[id];if(before===text)return {changed:false,reason:'same'};
  const originalBefore=state.originals[id];
  state.history.push({id,before,after:text,kind,originalBefore,originalAfter});state.history=state.history.slice(-15);
  state.blocks[id]=text;state.originals[id]=originalAfter;markChanged(state);
  return {changed:true,id,kind};
}
export function transformBlock(state,id,action){
  if(!SECTION_IDS.includes(id)||!['rewrite','shorten'].includes(action))return {changed:false,reason:'invalid'};
  const text=VARIANTS[id][action];
  if(action==='shorten'&&state.blocks[id].length<=text.length)return {changed:false,reason:'already-short'};
  return replace(state,id,text,action,state.originals[id]??state.blocks[id]);
}
export function keepOriginal(state,id){
  if(state.originals[id]===null)return {changed:false,reason:'original'};
  return replace(state,id,state.originals[id],'restore',null);
}
export function undoReplacement(state){
  while(state.history.length){
    const item=state.history.pop();
    if(state.blocks[item.id]!==item.after)continue;
    state.blocks[item.id]=item.before;state.originals[item.id]=item.originalBefore;markChanged(state);
    return item;
  }
  return null;
}
export function approve(state){
  applyAnswers(state);
  const missing=missingAnswers(state),empty=emptySections(state);
  if(missing.length||empty.length)return {approved:false,missing,empty};
  state.status='reviewed';state.hasBeenReviewed=true;state.reviewedAt=new Date().toISOString();
  return {approved:true,missing:[],empty:[]};
}
