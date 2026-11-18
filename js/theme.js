import {resolveTheme} from './theme-state.js';
export function initializeTheme(){
 const button=document.querySelector('#theme-toggle'),system=matchMedia('(prefers-color-scheme: dark)');
 let saved;try{saved=localStorage.getItem('store-theme');}catch{}
 function apply(value){
  const theme=resolveTheme(value,system.matches);document.documentElement.dataset.theme=theme;
  const mode=['light','dark','system'].includes(value)?value:'light';
  button?.setAttribute('aria-label',`Appearance: ${mode}. Switch to ${mode==='light'?'dark':mode==='dark'?'system':'light'} mode`);
  button?.setAttribute('aria-pressed',String(theme==='dark'));
  if(button)button.title=`Appearance: ${mode}`;
  document.querySelectorAll('select[data-theme-mode]').forEach(select=>select.value=mode);
  document.documentElement.dataset.themeMode=mode;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='dark'?'#0c0d0f':'#ffffff');
 }
 apply(saved);
 function choose(value){saved=value;try{localStorage.setItem('store-theme',saved);}catch{}apply(saved);}
 button?.addEventListener('click',()=>{const mode=document.documentElement.dataset.themeMode;choose(mode==='light'?'dark':mode==='dark'?'system':'light');});
 document.querySelectorAll('select[data-theme-mode]').forEach(select=>select.addEventListener('change',()=>choose(select.value)));
 system.addEventListener('change',()=>{if(saved==='system')apply(saved);});
 window.addEventListener('storage',event=>{if(event.key==='store-theme'){saved=event.newValue;apply(saved);}});
}
