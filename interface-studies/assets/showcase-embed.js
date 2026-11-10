// A fixed presentation canvas. Only embedded documents are adapted; source study pages stay intact.
export const SHOWCASE_CANVAS=Object.freeze({width:1440,height:1000});
export function canvasFit(width,height){const scale=Math.min(width/SHOWCASE_CANVAS.width,height/SHOWCASE_CANVAS.height);return {width:SHOWCASE_CANVAS.width,height:SHOWCASE_CANVAS.height,scale,left:(width-SHOWCASE_CANVAS.width*scale)/2,top:(height-SHOWCASE_CANVAS.height*scale)/2};}
export function adaptEmbeddedStudy(doc,slug){
 if(doc.getElementById('showcase-embed-style'))return;
 doc.documentElement.dataset.showcaseStudy=slug;
 const move=(selector,target,before=null)=>{const node=doc.querySelector(selector),destination=doc.querySelector(target);if(node&&destination)destination.insertBefore(node,before?destination.querySelector(before):null);return node;};
 if(slug==='brief')move('.workspace-actions','.document-header');
 if(slug==='queue')move('.search-field','.inbox-header','#status-filters');
 if(slug==='archive')move('.topbar nav','.library-heading');
 if(slug==='tokens'){
  const meta=doc.createElement('div');meta.className='showcase-theme-meta';doc.querySelector('.workspace-heading>div')?.append(meta);
  move('.theme-identity','.showcase-theme-meta');move('#save-state','.showcase-theme-meta');move('.header-actions','.workspace-heading');
 }
 if(slug==='frame')for(const link of doc.querySelectorAll('.hero a[href="#workflow"]'))link.addEventListener('click',event=>{event.preventDefault();doc.getElementById('stage-brief')?.click();});
 const css={
 signal:'.masthead{display:none!important}.app{padding-top:24px!important}',
 slot:'.topline{display:none!important}.calendar-masthead{margin-top:14px}.calendar-scroll{max-height:none!important}.app-footer{display:none!important}',
 brief:'.workspace-bar,.study-return,.collection-link{display:none!important}.workspace{margin-top:24px!important}.document-panel{height:952px!important}.document-header .workspace-actions{margin-top:18px;justify-content:flex-end;gap:12px}',
 archive:'.with-details .asset-grid{grid-template-columns:repeat(4,minmax(0,1fr))!important;row-gap:18px!important}.asset-thumbnail{aspect-ratio:1.6!important}.grid-footer,.app-footer{display:none!important}.topbar{display:none!important}.library-toolbar{margin-top:26px!important}.library-heading nav{display:flex;gap:8px;margin-top:14px}.profile-wrap{display:none!important}',
 queue:'.topbar{display:none!important}.workspace{margin-top:0!important;height:952px!important}.inbox-header .search-field{width:100%;max-width:none;margin:15px 0 18px}.app-footer{display:none!important}',
 pass:'.site-bar{display:none!important}.page{padding-top:24px!important}',
 tokens:'.editor-header{display:none!important}.workspace-heading{padding-top:26px!important}.workspace-heading>#about-open{display:none!important}.showcase-theme-meta{display:flex;align-items:center;gap:18px;margin-top:12px}.workspace-heading .header-actions{margin-left:auto}.editor-footer{display:none!important}',
 frame:'.site-header,.workflow-section,.pricing-section,.final-section,.site-footer{display:none!important}.hero{padding-top:38px!important}'
 };
 const style=doc.createElement('style');style.id='showcase-embed-style';style.textContent=`html,body{overflow:hidden!important;overscroll-behavior:none!important;scrollbar-width:none!important}html{height:1000px!important;max-height:1000px!important}body{height:1000px!important;max-height:1000px!important}*{scrollbar-width:none!important}*::-webkit-scrollbar{display:none!important}.skip,.skip-link{display:none!important}${css[slug]||''}`;doc.head.append(style);
 // Reset any restored page scroll before display. Internal product regions/dialogs retain their normal behavior.
 doc.defaultView?.scrollTo?.(0,0);
}
