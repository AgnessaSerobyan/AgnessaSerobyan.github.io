// Edit these two values to change the rhythm of the portfolio showcase.
export const SHOWCASE_SETTINGS = Object.freeze({ intervalMs: 1000, transitionMs: 300 });
export const showcaseStudies = [
  {
    slug: "signal",
    name: "SIGNAL",
    type: "Campaign analytics dashboard",
    task: "Find an underperforming campaign and check what is driving its cost.",
    focus: "Comparing cost with a target",
    reason:
      "I placed the CPA target beside the result and used warning labels to lead into campaign details.",
  },
  {
    slug: "slot",
    name: "SLOT",
    type: "Creative team calendar",
    task: "Schedule a review and find a time when everyone is free.",
    focus: "Seeing time and overlap",
    reason:
      "The weekly grid shows event duration and overlapping bookings. Moving an event checks participants’ availability and suggests a free slot.",
  },
  {
    slug: "brief",
    name: "BRIEF",
    type: "AI-assisted campaign workspace",
    task: "Turn a client brief into an editable plan and fill in missing details.",
    focus: "Facts beside AI suggestions",
    reason:
      "Source details and unanswered questions sit beside the plan. Clarifications update linked facts while keeping edits made elsewhere.",
  },
  {
    slug: "archive",
    name: "ARCHIVE",
    type: "Creative asset library",
    task: "Find a reference, check its source, and save it to a collection.",
    focus: "Room for the images",
    reason:
      "I kept image previews large and put filters, source credits, and usage details in the surrounding tools and side panel.",
  },
  {
    slug: "queue",
    name: "QUEUE",
    type: "Customer support workspace",
    task: "Read a customer conversation, edit a draft reply, and add an internal note.",
    focus: "Replies and private notes",
    reason:
      "Replies and internal notes have different labels, backgrounds, and actions. Each keeps its own draft.",
  },
  {
    slug: "pass",
    name: "PASS",
    type: "Conference ticket checkout",
    task: "Choose a pass, add attendee details, and review a sample order.",
    focus: "The price before confirmation",
    reason:
      "Ticket cost, discount, and service fee stay visible in the order summary as the total changes. This is a demo checkout.",
  },
  {
    slug: "tokens",
    name: "TOKENS",
    type: "Product theme editor",
    task: "Change a theme, check its component states, and save a local version.",
    focus: "An editor that stays familiar",
    reason:
      "The editor controls keep their own style while accent colour, corner radius, spacing, and type change inside the product preview.",
  },
  {
    slug: "frame",
    name: "FRAME",
    type: "Collaborative product landing page",
    task: "Follow a campaign from the brief through feedback to the approved creative.",
    focus: "One project, three stages",
    reason:
      "The Brief, Review, and Deliver tabs update the same campaign. Its headline, version, and approval state change as the project moves along.",
  },
];

// Independent playback state: blockers never overwrite the visitor's Play/Pause choice.
// A fresh full interval starts whenever the last temporary blocker leaves.
export function createShowcasePlayer({count,prepare,display,settle=()=>{},changed=()=>{},failed=()=>{},settings=SHOWCASE_SETTINGS,setTimer=setTimeout,clearTimer=clearTimeout}){
 let current=0,hasFrame=false,wantsPlay=true,reduced=false,transitioning=false,waiting=false,pendingAutomatic=false,token=0,timer=null,finishTimer=null,destroyed=false;
 const blocks=new Set(['offscreen']);
 const snapshot=()=>({current,hasFrame,wantsPlay,reduced,transitioning,waiting,blocked:[...blocks],playing:wantsPlay&&!reduced&&!blocks.size&&hasFrame&&!waiting&&!transitioning});
 const emit=()=>changed(snapshot());
 const clear=()=>{if(timer!==null)clearTimer(timer);timer=null;};
 function arm(delay=settings.intervalMs){clear();const s=snapshot();if(!destroyed&&s.playing)timer=setTimer(()=>{timer=null;void select((current+1)%count,{automatic:true});},delay);emit();}
 function finish({natural=false}={}){if(finishTimer!==null)clearTimer(finishTimer);finishTimer=null;if(transitioning){transitioning=false;settle(current);}arm(natural?Math.max(0,settings.intervalMs-settings.transitionMs):settings.intervalMs);}
 async function select(index,{automatic=false,initial=false}={}){
  if(destroyed)return;
  index=((index%count)+count)%count;
  if(!automatic&&!initial)wantsPlay=false;
  if(transitioning)finish();
  clear();const request=++token;waiting=true;pendingAutomatic=automatic;emit();
  try{await prepare(index);}catch(error){if(destroyed||request!==token)return;waiting=false;wantsPlay=false;failed(index,error);emit();return;}
  if(destroyed||request!==token)return;
  waiting=false;
  if(automatic&&(blocks.size||!wantsPlay||reduced)){arm();return;}
  const previous=hasFrame?current:null;
  if(previous===index){arm();return;}
  current=index;hasFrame=true;transitioning=previous!==null&&!reduced&&settings.transitionMs>0;
  display(index,previous,{animate:transitioning});emit();
  if(transitioning)finishTimer=setTimer(()=>finish({natural:true}),settings.transitionMs);else{settle(current);arm();}
 }
 function setBlock(reason,value){if(destroyed)return;const before=blocks.has(reason);if(before===value)return;if(value){blocks.add(reason);clear();if(waiting&&pendingAutomatic){++token;waiting=false;}if(transitioning)finish();else emit();}else{blocks.delete(reason);arm();}}
 return {
  start:()=>select(0,{initial:true}),select:index=>select(index),next:()=>select(current+1),previous:()=>select(current-1),
  setBlock,
  play(){wantsPlay=true;arm();},pause(){wantsPlay=false;clear();if(waiting&&pendingAutomatic){++token;waiting=false;}if(transitioning)finish();else emit();},
  setReduced(value){reduced=!!value;if(reduced){clear();if(waiting&&pendingAutomatic){++token;waiting=false;}if(transitioning)finish();else emit();}else arm();},
  snapshot,
  destroy(){destroyed=true;++token;clear();if(finishTimer!==null)clearTimer(finishTimer);}
 };
}
