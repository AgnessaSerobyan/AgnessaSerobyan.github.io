import {initialState,normaliseState,tickets,event,totals,money,validateDetails,validPromo} from './model.js';
const $=id=>document.getElementById(id),key='interface-studies-pass-v1',preview=new URLSearchParams(location.search).get('preview')==='1';
let state=initialState(),step='edit',attempted=false,previousTotal;
if(!preview){try{state=normaliseState(JSON.parse(localStorage.getItem(key)));}catch{}}
const save=()=>{if(!preview){try{localStorage.setItem(key,JSON.stringify(state));}catch{}}};
function announce(message){$('order-announcement').textContent=message;}
function showError(id,message,input){$(id).textContent=message||'';$(id).hidden=!message;$(input).setAttribute('aria-invalid',message?'true':'false');}
function detailsErrors(){const errors=validateDetails(state);showError('name-error',errors.name,'attendee-name');showError('email-error',errors.email,'attendee-email');return errors;}
function syncInputs(){
  $('attendee-name').value=state.name;$('attendee-email').value=state.email;$('quantity').value=state.quantity;
  for(const id of ['day','full']){ $('ticket-'+id).checked=state.ticket===id;$('choice-'+id).classList.toggle('selected',state.ticket===id); }
}
function renderSummary({notify=false}={}){
  const t=tickets[state.ticket],sum=totals(state),total=money(sum.total);
  $('order-item-name').textContent=t.name;$('order-item-detail').textContent=`${state.quantity} ${state.quantity===1?'ticket':'tickets'} · ${t.date}`;
  $('order-unit-price').textContent=`${money(t.price)}${state.quantity>1?' each':''}`;
  $('order-multiplier').textContent=`× ${state.quantity}`;$('subtotal').textContent=money(sum.subtotal);
  $('fee-calculation').textContent=`${money(event.fee)} × ${state.quantity}`;$('fee').textContent=money(sum.fee);
  $('discount-row').hidden=!state.promo;$('discount').textContent=`−${money(sum.discount)}`;
  $('total').textContent=total;$('button-total').textContent=total;$('finish-total').textContent=total;
  $('promo-form').hidden=state.promo;$('promo-applied').hidden=!state.promo;
  $('quantity-minus').disabled=state.quantity<=1;$('quantity-plus').disabled=state.quantity>=5;
  $('details-hint').textContent=state.quantity===1?'One contact for your order.':`One contact for all ${state.quantity} tickets in this order.`;
  if(notify){announce(`${state.quantity} ${t.name.toLowerCase()} ${state.quantity===1?'ticket':'tickets'}. ${state.promo?'STUDIO10 applied. ':''}Total ${total}, including ${money(sum.fee)} in service fees.`);if(previousTotal!==sum.total){$('total').classList.remove('total-pulse');requestAnimationFrame(()=>$('total').classList.add('total-pulse'));}}
  previousTotal=sum.total;
}
function setQuantity(value){
  const n=Number(value);if(!Number.isInteger(n)||n<1||n>5){showError('quantity-error','Choose between 1 and 5 tickets.','quantity');$('quantity').value=state.quantity;return;}
  showError('quantity-error','','quantity');state.quantity=n;$('quantity').value=n;save();renderSummary({notify:true});
}
function setStep(next){
  step=next;$('checkout-layout').dataset.step=next;
  $('edit-view').hidden=next!=='edit';$('review-view').hidden=next!=='review';$('complete-view').hidden=next!=='complete';
  $('review-order').hidden=next!=='edit';$('finish-demo').hidden=next!=='review';$('promo-area').hidden=next!=='edit';
  $('payment-note').textContent=next==='edit'?'Check your order next. No payment yet.':next==='review'?'Demo only. This will not charge your card.':'Demo complete · No payment made.';
  if(next==='review'){
    $('review-ticket-name').textContent=tickets[state.ticket].name;$('review-quantity').textContent=`× ${state.quantity}`;
    $('review-includes').textContent=tickets[state.ticket].includes;$('review-date').textContent=`${tickets[state.ticket].date} 2026`;
    $('review-name').textContent=state.name.trim();$('review-email').textContent=state.email.trim();
  }
  const heading=$(next==='edit'?'checkout-title':next==='review'?'review-title':'complete-title');
  heading.focus({preventScroll:true});heading.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
}
for(const id of ['day','full'])$('ticket-'+id).addEventListener('change',()=>{if(!$('ticket-'+id).checked)return;state.ticket=id;syncTicketChoices();save();renderSummary({notify:true});});
function syncTicketChoices(){for(const id of ['day','full'])$('choice-'+id).classList.toggle('selected',state.ticket===id);}
$('quantity-minus').addEventListener('click',()=>setQuantity(state.quantity-1));$('quantity-plus').addEventListener('click',()=>setQuantity(state.quantity+1));$('quantity').addEventListener('change',e=>setQuantity(e.target.value));
for(const [id,field]of [['attendee-name','name'],['attendee-email','email']]){
  $(id).addEventListener('input',e=>{state[field]=e.target.value;save();if(attempted)detailsErrors();});
  $(id).addEventListener('blur',()=>{if(state[field].trim())showError(field+'-error',validateDetails(state)[field],id);});
}
$('checkout-form').addEventListener('submit',e=>{
  e.preventDefault();attempted=true;
  // Read live form values as well as input events, including browser autofill.
  state.name=$('attendee-name').value;state.email=$('attendee-email').value;save();
  const raw=$('quantity').value,n=Number(raw);if(!Number.isInteger(n)||n<1||n>5){setQuantity(raw);$('quantity').focus();return;}showError('quantity-error','','quantity');if(n!==state.quantity)setQuantity(raw);
  const errors=detailsErrors();if(Object.keys(errors).length){$(errors.name?'attendee-name':'attendee-email').focus();return;}
  setStep('review');announce(`Review your order. Total ${money(totals(state).total)}. No payment has been made.`);
});
$('promo-form').addEventListener('submit',e=>{e.preventDefault();if(!validPromo($('promo-code').value)){showError('promo-error',$('promo-code').value.trim()?'That code isn’t valid. Try STUDIO10.':'Enter a promo code. Try STUDIO10.','promo-code');return;}state.promo=true;showError('promo-error','','promo-code');save();renderSummary({notify:true});$('promo-remove').focus();});
$('promo-code').addEventListener('input',()=>showError('promo-error','','promo-code'));
$('promo-remove').addEventListener('click',()=>{state.promo=false;$('promo-code').value='';save();renderSummary({notify:true});$('promo-code').focus();});
$('back-edit').addEventListener('click',()=>setStep('edit'));
$('complete-edit').addEventListener('click',()=>setStep('edit'));
$('finish-demo').addEventListener('click',()=>{setStep('complete');announce('Demo complete. No payment was made. No ticket has been issued.');});
$('about-open').addEventListener('click',()=>$('about-dialog').showModal());$('about-close').addEventListener('click',()=>$('about-dialog').close());
$('about-dialog').addEventListener('click',e=>{if(e.target===$('about-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
$('clear-draft').addEventListener('click',()=>{state=initialState();attempted=false;save();syncInputs();showError('name-error','','attendee-name');showError('email-error','','attendee-email');showError('promo-error','','promo-code');showError('quantity-error','','quantity');$('promo-code').value='';renderSummary();$('about-dialog').close();setStep('edit');announce('Saved PASS order details cleared. One Full pass selected. Total €164.');});
syncInputs();renderSummary();
