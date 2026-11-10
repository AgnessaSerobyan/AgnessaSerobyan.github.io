export const event = Object.freeze({name:'FORM / Design Gathering',city:'Berlin',dates:'14–15 November 2026',fee:400,promo:'STUDIO10',discountPercent:10});
export const tickets = Object.freeze({
  day:{name:'Day pass',price:9500,date:'14 November',includes:'Talks on Saturday, 14 November.'},
  full:{name:'Full pass',price:16000,date:'14–15 November',includes:'Both days of talks + the workshop programme.'}
});
export const initialState = () => ({ticket:'full',quantity:1,name:'',email:'',promo:false});
export function normaliseState(value){
  const s=initialState(); if(!value||typeof value!=='object')return s;
  s.ticket=Object.hasOwn(tickets,value.ticket)?value.ticket:'full';
  s.quantity=Number.isInteger(value.quantity)?Math.min(5,Math.max(1,value.quantity)):1;
  s.name=typeof value.name==='string'?value.name.slice(0,100):'';
  s.email=typeof value.email==='string'?value.email.slice(0,254):'';
  s.promo=value.promo===true; return s;
}
export function totals(state){
  const s=normaliseState(state),subtotal=tickets[s.ticket].price*s.quantity;
  const discount=s.promo?Math.round(subtotal*event.discountPercent/100):0;
  const fee=event.fee*s.quantity;return {subtotal,discount,fee,total:subtotal-discount+fee};
}
export const money = cents => new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',minimumFractionDigits:cents%100?2:0,maximumFractionDigits:2}).format(cents/100);
export function validateDetails(state){
  const errors={};
  if((state.name.trim().match(/\p{L}/gu)||[]).length<2)errors.name='Enter your name (at least two letters).';
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email.trim()))errors.email='Enter a valid email, like alex@example.com.';
  return errors;
}
export const validPromo = value => typeof value==='string'&&value.trim().toUpperCase()===event.promo;
