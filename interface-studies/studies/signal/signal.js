import { PROJECTS, PERIODS, DAYS, METRICS, TARGET_CPA, summarize, totals, series, isAboveTarget } from './data.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const money = (n, decimals = 0) => new Intl.NumberFormat('en-IE', { style:'currency', currency:'EUR', minimumFractionDigits:decimals, maximumFractionDigits:decimals }).format(n);
const number = n => new Intl.NumberFormat('en-IE').format(n);
const percent = n => `${Math.abs(n).toFixed(1)}%`;
const escape = value => String(value).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon = name => `<i data-icon="${name}" aria-hidden="true"></i>`;
let reviews = {};
try { const saved = JSON.parse(localStorage.getItem('signal-reviews-v1') || '{}'); if (saved && typeof saved === 'object' && !Array.isArray(saved)) reviews = saved; } catch {}
const state = { project:'nora', period:'week', metric:'cpa', selected:'social', filter:'all' };
let undo = null;
let reviewCampaign = null;
let plotData = [];
let plotPositions = [];
let tableOpener = null;
const project = () => PROJECTS.find(p=>p.id===state.project);
const period = () => PERIODS.find(p=>p.id===state.period);
const campaigns = () => project().campaigns.map(c=>summarize(c,period()));
const selected = () => campaigns().find(c=>c.id===state.selected);
const visibleCampaigns = () => campaigns().filter(c=>state.filter==='all'||(state.filter==='warning'?isAboveTarget(c):!isAboveTarget(c)));
const reviewKey = id => `${state.project}:${id}`;
const formatMetric = (value, metric=state.metric) => metric==='conversions'?number(value):money(value,metric==='cpa'?2:0);
const status = c => isAboveTarget(c)
  ? `<span class="status-pill warning">${icon('triangle-alert')}Above target</span>`
  : `<span class="status-pill good">${icon('circle-check')}On target</span>`;

function hydrateIcons(root=document) {
  root.querySelectorAll('[data-icon]').forEach(el=> {
    el.style.setProperty('--icon', `url('/interface-studies/studies/signal/assets/icons/${el.dataset.icon}.svg')`);
    el.setAttribute('aria-hidden','true');
  });
}
function announce(message) { $('#live-announcement').textContent=message; }
function chartCampaigns() { return state.selected ? project().campaigns.filter(c=>c.id===state.selected) : project().campaigns; }
function selectCampaign(id, openMobile=true) {
  tableOpener=document.activeElement;
  state.selected = id;
  render();
  const c=selected();
  if(c)announce(`${c.name}: CPA ${money(c.cpa,2)}, ${isAboveTarget(c)?'above':'on'} target.`);
  if(c && openMobile && matchMedia('(max-width:1240px)').matches) {
    if(!$('#mobile-details').open) $('#mobile-details').showModal();
  }
}
function renderMetrics(all) {
  const total=totals(all);
  $('#total-spend').textContent=money(total.spend);
  $('#total-conversions').textContent=number(total.conversions);
  $('#total-cpa').textContent=money(total.cpa,2);
  $('#spend-period').textContent=period().label;
  const above=all.filter(isAboveTarget);
  $('#attention-count').textContent=`${above.length} ${above.length===1?'campaign':'campaigns'}`;
  $('#attention-bar').hidden=!above.length;
  $$('.metric').forEach(el=>{
    const active=el.dataset.metric===state.metric;
    el.classList.toggle('selected',active);
    el.setAttribute('aria-pressed',active);
    el.setAttribute('aria-label',`${METRICS[el.dataset.metric].label}: ${formatMetric(total[el.dataset.metric],el.dataset.metric)}. Show ${METRICS[el.dataset.metric].short} trend and campaign values.`);
  });
}
function renderTable() {
  const visible=visibleCampaigns();
  $('#campaign-count').textContent=visible.length;
  $('#table-summary').textContent=`${visible.length} of ${campaigns().length} campaigns · EUR`;
  $('#campaign-rows').innerHTML=visible.map(c=>`<tr class="${state.selected===c.id?'selected':''}" data-campaign="${c.id}">
    <td><button class="campaign-name" data-campaign="${c.id}" aria-label="View ${c.name} details${state.selected===c.id?', selected':''}"><span class="channel-icon">${icon(c.icon)}</span>${c.name}</button></td>
    <td class="channel-column">${c.channel}</td><td class="numeric">${money(c.totalSpend)}</td><td class="numeric">${number(c.totalConversions)}</td><td class="numeric ${isAboveTarget(c)?'cpa-warning':''}">${money(c.cpa,2)}</td><td>${status(c)}</td></tr>`).join('');
  $('#mobile-campaigns').innerHTML=visible.map(c=>{
    const value=state.metric==='spend'?c.totalSpend:state.metric==='conversions'?c.totalConversions:c.cpa;
    return `<button class="mobile-campaign ${state.selected===c.id?'selected':''}" data-campaign="${c.id}" aria-label="View ${c.name}, ${METRICS[state.metric].short} ${formatMetric(value)}, ${isAboveTarget(c)?'above target':'on target'}"><span class="mobile-campaign-left"><span class="channel-icon">${icon(c.icon)}</span><span><span class="mobile-campaign-name">${c.name}</span><span class="mobile-campaign-channel">${c.channel}</span>${status(c)}</span></span><span class="mobile-campaign-right"><span><strong class="${state.metric==='cpa'&&isAboveTarget(c)?'cpa-warning':''}">${formatMetric(value)}</strong><small>${METRICS[state.metric].short}</small></span>${icon('chevron-right')}</span></button>`;
  }).join('');
  $('#filter-empty').hidden=!!visible.length;
  $('#mobile-campaigns').hidden=!visible.length;
  $('.table-wrap').hidden=!visible.length;
}
function detailMarkup(c,mobile=false) {
  if(!c)return `<div class="detail-empty">${icon('mouse-pointer-2')}<h2>A closer look</h2><p>Select a campaign to see its performance, understand its CPA, and plan your next step.</p></div>`;
  const warning=isAboveTarget(c), delta=(c.cpa/TARGET_CPA-1)*100;
  const daily=series([c],'cpa',period());
  const first=daily[0],last=daily.at(-1);
  const spendChange=(last.spend/first.spend-1)*100;
  const conversionChange=(last.conversions/first.conversions-1)*100;
  const saved=reviews[reviewKey(c.id)];
  const savedMarkup=saved?`<div class="saved-review"><div>${icon('check-check')}Review saved</div><p>${escape(saved.nextStep)}</p>${saved.note?`<small>${escape(saved.note)}</small>`:''}</div>`:'';
  let diagnosis,recommendation;
  if(warning) {
    diagnosis=`CPA is <strong class="insight-number">${percent(delta)} above the ${money(TARGET_CPA)} target.</strong> Spend ${spendChange>=0?'rose':'fell'} ${percent(spendChange)}, while conversions ${conversionChange>=0?'rose':'fell'} ${percent(conversionChange)} from ${first.day} to ${last.day}.`;
    recommendation='Check audience targeting and creative performance before adjusting spend.';
  } else {
    diagnosis=`CPA is <strong>${percent(delta)} ${delta<=0?'below':'above'} the ${money(TARGET_CPA)} target.</strong> ${number(c.totalConversions)} conversions from ${money(c.totalSpend)} in spend. This campaign is within the target for this period.`;
    recommendation='Keep monitoring daily efficiency before increasing the budget.';
  }
  return `<div class="detail-topline"><span class="detail-eyebrow">CAMPAIGN DETAILS</span><button class="icon-button" data-action="close-details" aria-label="Close campaign details">${icon('x')}</button></div>
    <div class="detail-title-row"><span class="detail-channel-icon">${icon(c.icon)}</span><div><h2 ${mobile?'id="mobile-details-title"':''}>${c.name}</h2><p>${c.channel} <span aria-hidden="true">·</span> ${project().name}</p></div></div>
    <p class="detail-description">${c.description}</p><div class="detail-status">${status(c)}</div>
    <dl class="detail-numbers"><div><dt>Spend</dt><dd>${money(c.totalSpend)}</dd></div><div><dt>Conversions</dt><dd>${number(c.totalConversions)}</dd></div><div><dt>Cost per conversion</dt><dd><span class="primary-number ${warning?'cpa-warning':''}">${money(c.cpa,2)}</span><span class="target-number">Target ${money(TARGET_CPA,2)}</span></dd></div></dl>
    <div class="diagnosis"><h3 class="diagnosis-title ${warning?'':'positive'}">${icon(warning?'triangle-alert':'circle-check')}${warning?'Why this needs attention':'Within your target'}</h3><p>${diagnosis}</p><div class="mini-comparison"><div><span>${first.day} CPA</span><strong>${money(first.value,2)}</strong></div><div><span>${last.day} CPA</span><strong class="${last.value>TARGET_CPA?'cpa-warning':''}">${money(last.value,2)}</strong></div></div></div>
    <div class="recommendation"><p class="recommendation-label">SUGGESTED NEXT STEP</p><p>${recommendation}</p><button class="primary-button" data-action="review">${saved?'Update review':'Review campaign'}${icon('arrow-up-right')}</button><div class="detail-note">${PERIODS.find(p=>p.id===state.period).label} · EUR</div></div>${savedMarkup}`;
}
function renderDetails() {
  $('#campaign-details').innerHTML=detailMarkup(selected());
  $('#mobile-details-content').innerHTML=detailMarkup(selected(),true);
}
function niceStep(raw) {
  const magnitude=10**Math.floor(Math.log10(Math.max(raw,.001)));
  const n=raw/magnitude;
  return (n<=1?1:n<=2?2:n<=2.5?2.5:n<=5?5:10)*magnitude;
}
function renderChart() {
  const chosen=selected(),metric=METRICS[state.metric],rows=chartCampaigns();
  const aggregate=totals(rows.map(c=>summarize(c,period())));
  const name=chosen?chosen.name:'All campaigns';
  $('#chart-title').textContent=metric.label;
  $('#chart-subtitle').textContent=`${chosen?`${name} campaign`:name} · Daily ${state.metric==='cpa'?'average':'total'}`;
  $('#chart-campaign').value=state.selected||'all';
  $('#chart-value').textContent=formatMetric(aggregate[state.metric]);
  $('#chart-period').textContent=`${8+period().start}–${7+period().end} Oct`;
  $('#legend-label').textContent=`${name} ${metric.short}`;
  $('.target-legend').hidden=state.metric!=='cpa';
  const badge=$('#chart-change');
  if(state.metric==='cpa'){
    const delta=(aggregate.cpa/TARGET_CPA-1)*100;
    badge.className=`trend-badge ${delta>.00001?'warning':'good'}`;
    badge.innerHTML=`${icon(delta>0?'arrow-up-right':'circle-check')}${Math.abs(delta)<.00001?'At target':`${percent(delta)} ${delta>0?'above':'below'} target`}`;
  }else{
    badge.className='trend-badge neutral';badge.textContent='Period total';
  }
  plotData=series(rows,state.metric,period());
  const width=Math.max($('#chart').clientWidth,280),height=$('#chart').clientHeight||204;
  const left=52,right=18,top=24,bottom=32,plotWidth=width-left-right,plotHeight=height-top-bottom;
  const maxValue=Math.max(...plotData.map(d=>d.value),state.metric==='cpa'?TARGET_CPA:0);
  const step=niceStep(maxValue/4),max=Math.ceil(maxValue/step)*step;
  const x=i=>left+i*plotWidth/Math.max(1,plotData.length-1),y=v=>top+plotHeight-v/max*plotHeight;
  plotPositions=plotData.map((d,i)=>({x:x(i),y:y(d.value)}));
  const path=plotPositions.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
  const area=`${path} L${x(plotData.length-1)},${y(0)} L${x(0)},${y(0)} Z`;
  let grid='';
  for(let value=0;value<=max+.0001;value+=step){
    const label=state.metric==='conversions'?number(value):value>=1000?`€${value/1000}k`:`€${number(value)}`;
    grid+=`<line class="grid-line" x1="${left}" y1="${y(value)}" x2="${width-right}" y2="${y(value)}"/><text class="axis-label" x="${left-10}" y="${y(value)+4}" text-anchor="end">${label}</text>`;
  }
  const target=state.metric==='cpa'?`<line class="target-line" x1="${left}" y1="${y(TARGET_CPA)}" x2="${width-right}" y2="${y(TARGET_CPA)}"/><rect x="${width-86}" y="${y(TARGET_CPA)-16}" width="73" height="14" fill="white" opacity=".9"/><text class="target-label" x="${width-right}" y="${y(TARGET_CPA)-5}" text-anchor="end">€25 target</text><path d="${path}" class="chart-line" style="stroke:#A57435" clip-path="url(#above-target)"/>`:'';
  const points=plotData.map((d,i)=>`<circle class="chart-point" cx="${x(i)}" cy="${y(d.value)}" r="3.5" ${state.metric==='cpa'&&d.value>TARGET_CPA?'style="stroke:#A57435"':''} tabindex="0" role="img" aria-label="${d.day}: ${metric.label} ${formatMetric(d.value)}" data-point="${i}"/><text class="axis-label" x="${x(i)}" y="${height-7}" text-anchor="${i===0?'start':i===plotData.length-1?'end':'middle'}">${d.day}</text>`).join('');
  $('#chart').innerHTML=`<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="group" aria-labelledby="plot-title plot-description"><title id="plot-title">${name}: daily ${metric.label.toLowerCase()}</title><desc id="plot-description">${period().label}. Vertical axis starts at zero. ${state.metric==='cpa'?'Dashed line marks the €25 target. Amber shows values above target.':''} Focus a point for its exact value, or open View daily data.</desc><defs><linearGradient id="area-gradient" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#B7EF75" stop-opacity=".24"/><stop offset="1" stop-color="#B7EF75" stop-opacity=".02"/></linearGradient><clipPath id="above-target"><rect x="${left}" y="${top}" width="${plotWidth}" height="${Math.max(0,y(TARGET_CPA)-top)}"/></clipPath></defs><text class="unit-label" x="${left}" y="10">${metric.unit}</text>${grid}<path d="${area}" fill="url(#area-gradient)"/><path d="${path}" class="chart-line"/>${target}${points}</svg>`;
  hideTooltip();
  if(!matchMedia('(prefers-reduced-motion:reduce)').matches && $('#chart').animate) $('#chart').animate([{opacity:.35},{opacity:1}],{duration:200,easing:'ease-out'});
  hydrateIcons($('.chart-panel'));
}
function showTooltip(index) {
  const d=plotData[index],p=plotPositions[index];if(!d||!p)return;
  const tooltip=$('#chart-tooltip');
  tooltip.innerHTML=`<small>${d.day} 2026</small><strong>${formatMetric(d.value)}</strong><span>${METRICS[state.metric].label}</span>`;
  tooltip.hidden=false;
  const half=tooltip.offsetWidth/2;
  tooltip.style.left=`${Math.max(half+4,Math.min(p.x,$('#chart').clientWidth-half-4))}px`;
  tooltip.style.top=`${Math.max(78,p.y-9)}px`;
}
function hideTooltip(){ $('#chart-tooltip').hidden=true; }
function render() {
  renderMetrics(campaigns());renderTable();renderDetails();renderChart();hydrateIcons();
}
function closeDetails() {
  if($('#mobile-details').open)$('#mobile-details').close();
  else{state.selected=null;render();announce('Showing all campaigns.');$('#chart-campaign').focus();}
}
function openReview() {
  const c=selected();if(!c)return;
  reviewCampaign={project:state.project,id:c.id,name:c.name};
  $('#review-title').textContent=`Review ${c.name}`;
  $('#review-intro').textContent=`${c.name} has a CPA of ${money(c.cpa,2)} for ${period().label}. Choose a next step for your review.`;
  $('#review-form').reset();$('#review-error').hidden=true;
  const saved=reviews[reviewKey(c.id)];
  if(saved){const radio=$$('input[name="nextStep"]').find(el=>el.value===saved.nextStep);if(radio)radio.checked=true;$('#review-note').value=typeof saved.note==='string'?saved.note:'';}
  $('#review-dialog').showModal();
}
function saveReviews() {
  try{localStorage.setItem('signal-reviews-v1',JSON.stringify(reviews));return true;}catch{return false;}
}
function showToast(message,canUndo=false){const toast=$('#toast');($('#mobile-details').open?$('#mobile-details'):document.body).append(toast);$('#toast-text').textContent=message;$('#undo-review').hidden=!canUndo;toast.hidden=false;}
function showDaily(){
  const name=selected()?.name||'All campaigns';
  $('#data-title').textContent=`${name} · Daily data`;$('#data-period').textContent=`${period().label} · Target CPA ${money(TARGET_CPA,2)}`;
  $('#daily-rows').innerHTML=series(chartCampaigns(),'cpa',period()).map(d=>`<tr><td>${d.day}</td><td class="numeric">${money(d.spend)}</td><td class="numeric">${number(d.conversions)}</td><td class="numeric ${d.value>TARGET_CPA?'cpa-warning':''}">${money(d.value,2)}</td></tr>`).join('');
  $('#data-dialog').showModal();
}
function showReport(){
  const all=campaigns(),t=totals(all),above=all.filter(isAboveTarget).sort((a,b)=>b.cpa-a.cpa);
  $('#report-title').textContent=state.period==='week'?'Weekly snapshot':'Three-day snapshot';
  $('#report-period').textContent=`${project().name} · ${period().label}`;
  $('#report-content').innerHTML=`<div class="report-summary"><div><span>Spend</span><strong>${money(t.spend)}</strong></div><div><span>Conversions</span><strong>${number(t.conversions)}</strong></div><div><span>Blended CPA</span><strong>${money(t.cpa,2)}</strong></div></div><p class="report-warning">${above.length?`<strong>${above.length} campaigns exceed the ${money(TARGET_CPA)} target.</strong> ${above.map(c=>`${c.name} (${money(c.cpa,2)})`).join(' and ')} ${above.length===1?'needs':'need'} attention. ${above[0].name} has the highest cost per conversion.`:`All campaigns are within the ${money(TARGET_CPA)} CPA target for this period.`}</p>`;
  $('#reports-dialog').showModal();
}
function downloadReport(){
  const rows=[['Project',project().name],['Period',period().label],['Currency','EUR'],[],['Campaign','Channel','Spend EUR','Conversions','CPA EUR','Status'],...campaigns().map(c=>[c.name,c.channel,c.totalSpend,c.totalConversions,c.cpa.toFixed(2),isAboveTarget(c)?'Above target':'On target'])];
  const csv=rows.map(row=>row.map(value=>`"${String(value).replaceAll('"','""')}"`).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'}));
  const link=document.createElement('a');link.href=url;link.download=`signal-${state.project}-${state.period}-2026-10-14.csv`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  announce('Campaign report downloaded as CSV.');
}
document.addEventListener('click',event=>{
  const campaign=event.target.closest('[data-campaign]');if(campaign){selectCampaign(campaign.dataset.campaign);return;}
  const action=event.target.closest('[data-action]')?.dataset.action;
  if(action==='close-details')closeDetails();
  if(action==='review')openReview();
  const closer=event.target.closest('[data-close]');if(closer)document.getElementById(closer.dataset.close).close();
});
$$('.metric').forEach(el=>el.addEventListener('click',()=>{state.metric=el.dataset.metric;renderMetrics(campaigns());renderTable();renderChart();hydrateIcons();announce(`Showing ${METRICS[state.metric].label.toLowerCase()}.`);}));
$('#project-select').addEventListener('change',event=>{state.project=event.target.value;$('#project-initials').textContent=project().initials;state.filter='all';$('#status-filter').value='all';state.selected=campaigns().sort((a,b)=>b.cpa-a.cpa)[0].id;render();announce(`${project().name} loaded. All metrics updated.`);});
$('#period-select').addEventListener('change',event=>{state.period=event.target.value;render();announce(`Showing ${period().label}. Totals, chart, statuses, and campaign details updated.`);});
$('#chart-campaign').addEventListener('change',event=>selectCampaign(event.target.value==='all'?null:event.target.value,false));
$('#status-filter').addEventListener('change',event=>{state.filter=event.target.value;const visible=visibleCampaigns();if(!visible.some(c=>c.id===state.selected))state.selected=visible[0]?.id||null;render();announce(`${visible.length} campaigns match ${event.target.options[event.target.selectedIndex].text}.`);});
$('#clear-filter').addEventListener('click',()=>{state.filter='all';$('#status-filter').value='all';render();});
$('#review-highest').addEventListener('click',()=>{const worst=campaigns().filter(isAboveTarget).sort((a,b)=>b.cpa-a.cpa)[0];if(!worst)return;state.filter='all';$('#status-filter').value='all';selectCampaign(worst.id);if(!matchMedia('(max-width:1240px)').matches)$('#campaign-details [data-action="review"]').focus();});
$('#chart').addEventListener('pointermove',event=>{const point=event.target.closest('[data-point]');if(point)showTooltip(Number(point.dataset.point));else{const rect=$('#chart').getBoundingClientRect();const nearest=plotPositions.reduce((best,p,i)=>Math.abs(p.x-(event.clientX-rect.left))<Math.abs(plotPositions[best].x-(event.clientX-rect.left))?i:best,0);showTooltip(nearest);}});
$('#chart').addEventListener('pointerleave',hideTooltip);
$('#chart').addEventListener('focusin',event=>{if(event.target.dataset.point)showTooltip(Number(event.target.dataset.point));});
$('#chart').addEventListener('focusout',hideTooltip);
$('#chart').addEventListener('keydown',event=>{if(event.key==='Escape')hideTooltip();const i=Number(event.target.dataset.point);if(Number.isInteger(i)&&['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();const next=Math.max(0,Math.min(plotData.length-1,i+(event.key==='ArrowRight'?1:-1)));$(`#chart [data-point="${next}"]`).focus();}});
$('#review-form').addEventListener('change',()=>$('#review-error').hidden=true);
$('#review-form').addEventListener('submit',event=>{
  event.preventDefault();const value=new FormData(event.target).get('nextStep');
  if(!value){$('#review-error').hidden=false;$('input[name="nextStep"]').focus();return;}
  if(!reviewCampaign)return;
  const key=`${reviewCampaign.project}:${reviewCampaign.id}`;
  undo={key,previous:reviews[key]};
  reviews[key]={nextStep:value,note:$('#review-note').value.trim(),reviewedAt:new Date().toISOString()};
  const persisted=saveReviews();$('#review-dialog').close();renderDetails();hydrateIcons();
  showToast(`${reviewCampaign.name} review saved${persisted?'':' for this session'}.`,true);
  if($('#mobile-details').open) $('#mobile-details [data-action="review"]').focus(); else $('#campaign-details [data-action="review"]')?.focus();
  announce('Review saved. Campaign status still reflects its CPA.');
});
$('#undo-review').addEventListener('click',()=>{if(!undo)return;if(undo.previous)reviews[undo.key]=undo.previous;else delete reviews[undo.key];saveReviews();undo=null;renderDetails();hydrateIcons();showToast('Review change undone.');});
$('#dismiss-toast').addEventListener('click',()=>$('#toast').hidden=true);
$('#view-daily').addEventListener('click',showDaily);$('#download-report').addEventListener('click',downloadReport);
$$('[data-nav]').forEach(el=>el.addEventListener('click',()=>{
  if(el.dataset.nav==='reports'){showReport();return;}
  $$('[data-nav]').forEach(n=>{n.classList.toggle('active',n===el);if(n===el)n.setAttribute('aria-current',n.dataset.nav==='campaigns'?'location':'page');else n.removeAttribute('aria-current');});
  const target=el.dataset.nav==='campaigns'?$('#campaigns'):$('#main');target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'start'});
}));
$$('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}}));
$('#mobile-details').addEventListener('close',()=>{document.body.append($('#toast'));if(tableOpener?.isConnected && tableOpener!==document.body)tableOpener.focus();else $(`[data-campaign="${state.selected}"] button,button[data-campaign="${state.selected}"]`)?.focus();});
matchMedia('(min-width:1241px)').addEventListener('change',event=>{if(event.matches&&$('#mobile-details').open)$('#mobile-details').close();});
let chartWidth=0;
new ResizeObserver(entries=>{const width=entries[0].contentRect.width;if(width>0&&Math.abs(width-chartWidth)>1){chartWidth=width;renderChart();}}).observe($('#chart'));
render();
