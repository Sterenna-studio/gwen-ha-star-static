const KEY='nested-worlds:codex';
function read(){try{return JSON.parse(localStorage.getItem(KEY))||[]}catch{return[]}}
export function saveDiscovery(entry){if(!entry)return false;const items=read();if(items.some(item=>item.id===entry.id))return false;items.unshift({...entry,foundAt:new Date().toISOString()});localStorage.setItem(KEY,JSON.stringify(items));return true}
export function countDiscoveries(){return read().length}