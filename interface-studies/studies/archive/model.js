import { assets, collectionDefinitions, initialCollections } from './data.js';
export const defaultFilters = () => ({query:'',type:'all',project:'all',rights:'all',sort:'newest'});
export const fileSize = bytes => bytes >= 1000000 ? `${(bytes/1000000).toFixed(1)} MB` : `${Math.max(1,Math.round(bytes/1000))} KB`;
export const uniqueSaved = collections => new Set(Object.values(collections).flat());
export function cleanCollections(input) {
  const valid = new Set(assets.map(a=>a.id));
  return Object.fromEntries(collectionDefinitions.map(c=>[c.id, Array.isArray(input?.[c.id]) ? [...new Set(input[c.id])].filter(id=>valid.has(id)) : [...initialCollections[c.id]]]));
}
export function selectAssets(filters, view='library', collection='all', collections=initialCollections) {
  const saved = collection==='all' ? uniqueSaved(collections) : new Set(collections[collection] || []);
  const words=filters.query.toLocaleLowerCase('en').trim().split(/\s+/).filter(Boolean);
  const filtered=assets.filter(a=> {
    const text=`${a.title} ${a.project} ${a.type} ${a.kind} ${a.tags.join(' ')}`.toLocaleLowerCase('en');
    return (view!=='collections'||saved.has(a.id)) && words.every(w=>text.includes(w)) &&
      (filters.type==='all'||a.type===filters.type) && (filters.project==='all'||a.project===filters.project) &&
      (filters.rights==='all'||a.rights===filters.rights);
  });
  return filtered.sort((a,b)=>filters.sort==='name'?a.title.localeCompare(b.title,'en'):filters.sort==='size'?b.bytes-a.bytes:b.added.localeCompare(a.added));
}
export function activeFilterEntries(f) {
  return [f.query.trim()&&['query',`Search: ${f.query.trim()}`],f.type!=='all'&&['type',f.type],f.project!=='all'&&['project',f.project],f.rights!=='all'&&['rights',f.rights==='licensed'?'License listed':'Check source terms']].filter(Boolean);
}
