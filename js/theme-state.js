export function resolveTheme(saved,systemDark=false){return ['light','dark'].includes(saved)?saved:systemDark?'dark':'light';}
