import {interfaceIcon as icon} from './interface-icons.js';

const pageNames={shop:'Collection',cart:'Your bag',checkout:'Checkout',account:'Your account',admin:'Owner workspace',deals:'Offers',about:'Our story',contact:'Contact',faq:'Help centre',shipping:'Delivery',returns:'Returns & exchanges',warranty:'Warranty',payment:'Payments',privacy:'Privacy',terms:'Terms',credits:'Photography',connection:'Connection', 'catalogue-review':'Catalogue review','iphone-prices':'Price review'};
let paymentObserver;

// Presentation only: retain the original forms, event handlers and commerce data.
export function designPage(root,path){
 paymentObserver?.disconnect();
 const key=path.split('/')[1]||'home';
 root.dataset.page=key;
 const page=root.querySelector(':scope > .page');
 if(!page)return;
 page.classList.add('experience-page',`${key}-experience`);
 const title=page.querySelector(':scope > h1');
 if(title){
  const hero=document.createElement('div');hero.className='page-heading';
  const eyebrow=title.previousElementSibling?.classList.contains('eyebrow')?title.previousElementSibling:null;
  title.before(hero);if(eyebrow)hero.append(eyebrow);hero.append(title);
  while(hero.nextElementSibling?.matches('p.intro'))hero.append(hero.nextElementSibling);
  const mark=document.createElement('span');mark.className='heading-mark';mark.setAttribute('aria-hidden','true');
  mark.innerHTML=icon(({shop:'phone',cart:'package',checkout:'shield',contact:'mail',about:'pc',deals:'check',account:'shield',admin:'pc'})[key]||'shield');hero.append(mark);
 }
 if(key!=='home'){
  const crumb=document.createElement('nav');crumb.className='breadcrumbs';crumb.setAttribute('aria-label','Breadcrumb');
  const home=document.createElement('a');home.href='#/';home.textContent='Home';
  const current=document.createElement('span');current.textContent=pageNames[key]||'Product';current.setAttribute('aria-current','page');crumb.append(home,document.createTextNode(' / '),current);page.prepend(crumb);
 }
 if(key==='product'){
  const grid=page.querySelector('.detail-grid');
  const specifications=page.querySelector('#product-specifications');
  const extra=page.querySelector('#variant-specs');
  if(grid&&specifications){grid.after(specifications);if(extra)specifications.after(extra);}
  const sections=document.createElement('nav');sections.className='product-sections';sections.setAttribute('aria-label','Product sections');
  const destinations=[['Overview',grid],['Specifications',specifications],['Customer reviews',[...page.querySelectorAll('h2')].find(h=>h.textContent==='Customer reviews')]];
  for(const [label,target] of destinations){if(!target)continue;const button=document.createElement('button');button.type='button';button.textContent=label;button.onclick=()=>target.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});sections.append(button);}
  grid?.before(sections);
  const reviews=[...page.querySelectorAll(':scope > .review')];
  if(reviews.length){const list=document.createElement('div');list.className='review-grid';reviews[0].before(list);reviews.forEach(review=>list.append(review));}
 }
 if(key==='account'){
  if(page.querySelector('#login')){
   page.classList.add('auth-experience');
   for(const [id,label] of [['login','01 / WELCOME BACK'],['register','02 / JOIN THE COASTLINE']]){
    const form=page.querySelector('#'+id);if(form){const tag=document.createElement('span');tag.className='eyebrow';tag.textContent=label;form.prepend(tag);}
   }
  }else if(page.querySelector('.profile-overview')){
   if(sessionStorage.getItem('passwordRecovery')==='1'){
    const security=page.querySelector('.account-security');if(security){security.open=true;const title=document.createElement('h2');title.textContent='Choose your new password';security.querySelector('summary').after(title);page.querySelector('.profile-overview').before(security);}
   }
   const nav=document.createElement('nav');nav.className='account-navigation';nav.setAttribute('aria-label','Account sections');
   const headings=[...page.querySelectorAll(':scope > h2')];
   const targets=[['Overview',page.querySelector('.profile-overview')],['Edit profile',page.querySelector('.profile-editor')],['Orders',page.querySelector('#order-history')],['Addresses',headings.find(h=>/Saved addresses/.test(h.textContent))],['Reviews',headings.find(h=>/Your reviews/.test(h.textContent))],['Security',page.querySelector('.account-security')]];
   for(const [label,target]of targets){if(!target)continue;const button=document.createElement('button');button.type='button';button.textContent=label;button.onclick=()=>{if(target.tagName==='DETAILS')target.open=true;target.scrollIntoView({block:'start',behavior:'instant'});};nav.append(button);}
   page.querySelector('.profile-overview').before(nav);
  }
 }
 if(key==='checkout'){
  const payment=page.querySelector('#payment');
  if(payment){const sync=()=>{const submitted=Boolean(payment.querySelector('.payment-submitted'));const stages=[...page.querySelectorAll('.checkout-steps>span')];if(submitted&&stages.length===3){stages.forEach((stage,index)=>{stage.classList.toggle('current',index===2);if(index===2)stage.setAttribute('aria-current','step');else stage.removeAttribute('aria-current');});}};
   paymentObserver=new MutationObserver(sync);paymentObserver.observe(payment,{childList:true,subtree:true});sync();
  }
 }
 if(page.querySelector('.policy-sections')){
  const sections=[...page.querySelectorAll('.policy-section')];
  if(sections.length){const nav=document.createElement('nav');nav.className='policy-contents';nav.setAttribute('aria-label','On this page');
   for(const section of sections){const heading=section.querySelector('h2');if(!heading)continue;const button=document.createElement('button');button.type='button';button.textContent=heading.textContent;button.onclick=()=>section.scrollIntoView({block:'start',behavior:'instant'});nav.append(button);}
   page.querySelector('.policy-sections').before(nav);
  }
 }
 for(const empty of page.querySelectorAll('.empty'))if(!empty.querySelector('svg'))empty.insertAdjacentHTML('afterbegin',`<span class="state-icon">${icon('package')}</span>`);
 for(const table of page.querySelectorAll('table')){
  const scroll=document.createElement('div');scroll.className='table-scroll';scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label','Scrollable records');table.before(scroll);scroll.append(table);
 }
 for(const form of page.querySelectorAll('form')){
  // Native invalid events do not bubble. The capture listener decorates, not replaces, validation.
  form.addEventListener('invalid',event=>event.target.setAttribute('aria-invalid','true'),true);
  form.addEventListener('input',event=>{if(event.target.validity?.valid)event.target.removeAttribute('aria-invalid');});
 }
}

export function initializeNavigation(cartMarkup){
 const header=document.querySelector('body > header'),search=document.querySelector('#search');
 const makeDialog=(name,heading)=>{
  const dialog=document.createElement('dialog');dialog.className=`store-dialog ${name}-dialog`;dialog.setAttribute('aria-label',heading);
  dialog.innerHTML=`<div class="dialog-top"><h2>${heading}</h2><button type="button" class="dialog-close" aria-label="Close ${heading.toLowerCase()}">×</button></div><div class="dialog-content"></div>`;
  dialog.querySelector('.dialog-close').onclick=()=>dialog.close();
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
  dialog.addEventListener('close',()=>document.documentElement.classList.remove('overlay-open'));
  document.body.append(dialog);return dialog;
 };
 const searchDialog=makeDialog('search','Find your next connection');
 if(search){
  const trigger=document.createElement('button');trigger.type='button';trigger.className='search-launch';trigger.innerHTML=icon('search')+'<span>Search the collection</span><kbd>⌘ K</kbd>';trigger.setAttribute('aria-label','Open product search');
  search.before(trigger);searchDialog.querySelector('.dialog-content').append(search);
  searchDialog.querySelector('.dialog-content').insertAdjacentHTML('beforeend','<p class="field-help">Search by product, brand or model.</p><a class="text-link" href="#/shop">Browse the complete collection →</a>');
  const open=()=>{document.documentElement.classList.add('overlay-open');searchDialog.showModal();search.querySelector('input').focus();};trigger.onclick=open;
  document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();if(!document.querySelector('dialog[open]'))open();}});
  search.addEventListener('submit',()=>searchDialog.close());
 }
 const cartLink=header?.querySelector('a[href="#/cart"]'),drawer=makeDialog('bag','Your bag');
 cartLink?.addEventListener('click',event=>{
  if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();
  const content=drawer.querySelector('.dialog-content');content.innerHTML=cartMarkup();
  content.querySelectorAll('.cart-quantity').forEach(input=>{const text=document.createElement('span');text.textContent=input.value;input.replaceWith(text);});
  content.querySelectorAll('.remove,.breadcrumbs,.heading-mark').forEach(el=>el.remove());
  content.insertAdjacentHTML('beforeend','<a class="button" href="#/cart">View and edit bag →</a>');
  drawer.showModal();document.documentElement.classList.add('overlay-open');
 });
 const close=()=>{for(const dialog of [searchDialog,drawer])if(dialog.open)dialog.close();};
 document.addEventListener('click',event=>{if(event.target.closest('dialog a[href]'))close();});
 window.addEventListener('hashchange',close);
 const sentinel=document.createElement('span');sentinel.className='header-sentinel';sentinel.setAttribute('aria-hidden','true');header?.before(sentinel);
 if(header&&'IntersectionObserver'in window)new IntersectionObserver(([entry])=>header.classList.toggle('is-stuck',!entry.isIntersecting)).observe(sentinel);
}
