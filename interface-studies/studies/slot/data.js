export const TODAY='2026-10-16';
export const NOW=630; // A fixed 10:30 studio-time clock makes this demo reproducible.
export const ZONE='Asia/Yerevan';
export const members=[
 {id:'maya',name:'Maya Laurent',initials:'ML',role:'Producer'},
 {id:'nina',name:'Nina Patel',initials:'NP',role:'Design lead'},
 {id:'lena',name:'Lena Brooks',initials:'LB',role:'Designer'},
 {id:'eva',name:'Eva Morgan',initials:'EM',role:'Strategist'}
];
export const calendars=[{id:'studio',name:'Studio',description:'Team meetings'},{id:'clients',name:'Clients',description:'External reviews'},{id:'focus',name:'Focus',description:'Protected work'}];
const e=(id,date,start,end,title,calendar,people,location,notes)=>({id,date,start,end,title,calendar,members:people,location,notes,rev:0});
export const seedEvents=[
 e('mon-planning','2026-10-12',540,570,'Week planning','studio',['maya','nina','lena','eva'],'Studio · Table 01','Set priorities for the Common Ground launch and protect time for production.'),
 e('mon-critique','2026-10-12',600,660,'Design critique','studio',['nina','lena'],'Studio · Table 01','Review the visual direction for Common Ground. Bring two headline options.'),
 e('mon-prep','2026-10-12',600,645,'Client review prep','clients',['maya','eva'],'Video call','Align the campaign story and the decisions needed from the client.'),
 e('mon-focus','2026-10-12',810,930,'Focus time','focus',['lena'],'Desk time','Build the first set of social campaign layouts. No meetings, please.'),
 e('mon-scope','2026-10-12',960,1005,'Campaign planning','studio',['maya','eva'],'Studio · Table 01','Confirm scope, deliverables and the review schedule.'),
 e('tue-research','2026-10-13',540,630,'Research synthesis','studio',['eva','nina'],'Studio · Table 01','Turn audience interviews into a clear creative brief.'),
 e('tue-focus','2026-10-13',660,750,'Focus time','focus',['lena'],'Desk time','Develop typography and motion direction for the launch.'),
 e('tue-client','2026-10-13',780,840,'Client review','clients',['maya','nina'],'Video call','Present the first creative direction to Common Ground and agree the next revision.'),
 e('tue-versions','2026-10-13',900,945,'Version check / Common Ground launch','studio',['lena','maya'],'Studio · Table 01','Check the latest files, naming and delivery formats.'),
 e('wed-focus','2026-10-14',540,660,'Focus time','focus',['nina'],'Desk time','Refine the campaign narrative and prepare design feedback.'),
 e('wed-critique','2026-10-14',690,750,'Design critique','studio',['nina','lena','eva'],'Studio · Table 01','Review the revised key visual, accessibility and message hierarchy.'),
 e('wed-shoot','2026-10-14',840,960,'Art direction / Autumn collection shoot','studio',['lena','eva'],'Photo studio','Plan composition and shot requirements for the autumn collection.'),
 e('wed-check','2026-10-14',990,1005,'Production check-in','studio',['maya','lena'],'Studio · Table 01','A quick handoff check before the next production day.'),
 e('thu-client','2026-10-15',570,630,'Client review','clients',['maya','nina'],'Video call','Review the updated campaign and capture the final content decisions.'),
 e('thu-focus','2026-10-15',660,780,'Focus time','focus',['lena','eva'],'Desk time','Produce launch-ready assets and final copy.'),
 e('thu-plan','2026-10-15',840,900,'Campaign planning','studio',['maya','nina','eva'],'Studio · Table 01','Confirm channel priorities and the handoff schedule.'),
 e('thu-focus-nina','2026-10-15',960,1050,'Focus time','focus',['nina'],'Desk time','Review the brand guidelines before final approval.'),
 e('fri-focus-lena','2026-10-16',540,630,'Focus time','focus',['lena'],'Desk time','Finish the hero asset and social crops for delivery.'),
 e('fri-check','2026-10-16',570,600,'Production check-in','studio',['maya','nina'],'Studio · Table 01','Check the remaining production tasks and review notes.'),
 e('fri-client','2026-10-16',600,660,'Client review','clients',['maya','eva'],'Video call','Review the launch copy and agree the final client changes.'),
 e('fri-focus-nina','2026-10-16',630,690,'Focus time','focus',['nina'],'Desk time','Prepare notes for the next design critique.'),
 e('fri-critique','2026-10-16',660,720,'Design critique','studio',['lena','eva'],'Studio · Table 01','A final check of layout, type and the campaign message.'),
 e('fri-handoff','2026-10-16',735,750,'Handoff check-in','studio',['maya','lena'],'Studio · Table 01','Confirm the file owner and the next review deadline.'),
 e('fri-plan','2026-10-16',840,930,'Campaign planning','studio',['maya','nina','eva'],'Studio · Table 01','Build the next week around production priorities and review decisions.'),
 e('fri-focus-afternoon','2026-10-16',960,1020,'Focus time','focus',['lena'],'Desk time','Final export and file organisation.'),
 e('fri-followup','2026-10-16',960,990,'Client follow-up','clients',['nina','eva'],'Video call','Confirm which feedback is included in the final handoff.'),
 e('next-mon','2026-10-19',540,585,'Week planning','studio',['maya','nina','lena','eva'],'Studio · Table 01','Plan the next production week.'),
 e('next-review','2026-10-20',780,840,'Client review','clients',['maya','nina'],'Video call','Review the next round of campaign assets.'),
 e('previous-critique','2026-10-09',660,720,'Design critique','studio',['nina','lena'],'Studio · Table 01','Review the first campaign references.')
];
