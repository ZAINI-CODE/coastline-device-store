import {resolveTheme} from './theme-state.js';
let saved;
try{saved=localStorage.getItem('store-theme');}catch{}
document.documentElement.dataset.theme=resolveTheme(saved,matchMedia('(prefers-color-scheme: dark)').matches);
