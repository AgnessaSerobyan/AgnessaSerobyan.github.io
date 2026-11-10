export const TARGET_CPA = 25;
export const DAYS = ['8 Oct', '9 Oct', '10 Oct', '11 Oct', '12 Oct', '13 Oct', '14 Oct'];
export const METRICS = {
  spend: { label: 'Spend', short: 'Spend', unit: 'EUR', decimals: 0 },
  conversions: { label: 'Conversions', short: 'Conversions', unit: 'conversions', decimals: 0 },
  cpa: { label: 'Cost per conversion', short: 'CPA', unit: 'EUR / conversion', decimals: 2 },
};
const campaigns = [
  { id: 'search', name: 'Search', description: 'High-intent search', channel: 'Google Ads', icon: 'search', spend: [820,840,880,900,910,950,900], conversions: [42,43,44,45,44,46,46] },
  { id: 'social', name: 'Social', description: 'Prospecting · Autumn collection', channel: 'Meta Ads', icon: 'mouse-pointer-2', spend: [700,730,780,820,880,940,950], conversions: [29,29,28,28,26,25,25] },
  { id: 'display', name: 'Display', description: 'Always-on retargeting', channel: 'Google Display', icon: 'monitor', spend: [470,480,490,520,530,550,560], conversions: [18,18,18,17,17,16,16] },
  { id: 'video', name: 'Video', description: 'Product stories', channel: 'YouTube', icon: 'play', spend: [360,370,390,400,420,430,430], conversions: [15,15,16,16,17,18,19] },
];
export const PROJECTS = [
  { id: 'nora', name: 'Nora Studio', initials: 'NS', campaigns },
  { id: 'fieldwork', name: 'Fieldwork', initials: 'FW', campaigns: campaigns.map(c => ({...c, spend: c.spend.map(n => Math.round(n * .72 / 10) * 10), conversions: c.conversions.map(n => Math.round(n * .85))})) },
];
export const PERIODS = [
  { id:'week', label:'8–14 Oct 2026', start:0, end:7 },
  { id:'recent', label:'12–14 Oct 2026', start:4, end:7 },
];
export const sum = list => list.reduce((a,b) => a+b,0);
export const cpa = (spend, conversions) => conversions ? spend / conversions : 0;
export const isAboveTarget = campaign => campaign.cpa > TARGET_CPA + .000001;
export function summarize(campaign, period) {
  const spend = sum(campaign.spend.slice(period.start,period.end));
  const conversions = sum(campaign.conversions.slice(period.start,period.end));
  return {...campaign, totalSpend:spend, totalConversions:conversions, cpa:cpa(spend,conversions)};
}
export function totals(campaigns) {
  const spend = sum(campaigns.map(c=>c.totalSpend));
  const conversions = sum(campaigns.map(c=>c.totalConversions));
  return {spend, conversions, cpa:cpa(spend,conversions)};
}
export function series(campaigns, metric, period) {
  return DAYS.slice(period.start,period.end).map((day,i) => {
    const index = period.start+i;
    const spend = sum(campaigns.map(c=>c.spend[index]));
    const conversions = sum(campaigns.map(c=>c.conversions[index]));
    return {day,spend,conversions,value:metric === 'cpa' ? cpa(spend,conversions) : metric === 'spend' ? spend : conversions};
  });
}
