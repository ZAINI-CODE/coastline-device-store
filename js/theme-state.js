export function resolveTheme(saved,systemDark=false){return saved==='system'?(systemDark?'dark':'light'):['light','dark'].includes(saved)?saved:'light';}
