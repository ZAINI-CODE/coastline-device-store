import {resolveTheme} from './theme-state.js';
export function initializeTheme(){
 const button=document.querySelector('#theme-toggle'),system=matchMedia('(prefers-color-scheme: dark)');
 let saved;try{saved=localStorage.getItem('store-theme');}catch{}
 function apply(value){
  const theme=resolveTheme(value,system.matches);document.documentElement.dataset.theme=theme;
  button?.setAttribute('aria-label',`Switch to ${theme==='dark'?'light':'dark'} theme`);
  button?.setAttribute('aria-pressed',String(theme==='dark'));
  if(button)button.title=theme==='dark'?'Switch to light theme':'Switch to dark theme';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='dark'?'#0c0d0f':'#ffffff');
 }
 apply(saved);
 button?.addEventListener('click',()=>{saved=document.documentElement.dataset.theme==='dark'?'light':'dark';try{localStorage.setItem('store-theme',saved);}catch{}apply(saved);});
 system.addEventListener('change',()=>{if(!['light','dark'].includes(saved))apply();});
 window.addEventListener('storage',event=>{if(event.key==='store-theme'){saved=event.newValue;apply(saved);}});
}
