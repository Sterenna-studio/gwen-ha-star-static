const KEY='nested-worlds:codex';
function read(){try{return JSON.parse(localStorage.getItem(KEY))||[]}catch{return[]}}
function write(items){localStorage.setItem(KEY,JSON.stringify(items))}
export function saveDiscovery(entry){if(!entry)return false;const items=read();if(items.some(item=>item.id===entry.id))return false;items.unshift({...entry,foundAt:new Date().toISOString()});write(items);return true}
export function listDiscoveries(){return read()}
export function countDiscoveries(){return read().length}
export function clearDiscoveries(){localStorage.removeItem(KEY)}