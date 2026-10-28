export function createAvatarLoader(db) {
  const cache=new Map();let generation=0;
  async function resolve(path){
    if(!path)return null;
    const existing=cache.get(path);if(existing&&existing.expires>Date.now())return existing.promise;
    const request=generation;
    const promise=db.storage.from('profile-media').createSignedUrl(path,3600).then(({data,error})=>{if(error){if(request===generation)cache.delete(path);return null;}return data.signedUrl;}).catch(()=>{if(request===generation)cache.delete(path);return null;});
    cache.set(path,{promise,expires:Date.now()+50*60*1000});return promise;
  }
  return {resolve,reset(){generation++;cache.clear()}};
}
export function avatarMarkup(name,url,escape){
  const initials=String(name||'?').trim().split(/\s+/).map(s=>s[0]).slice(0,2).join('').toUpperCase();
  return `<span class="message-avatar" aria-hidden="true">${url?`<img src="${escape(url)}" alt="" loading="lazy">`:`<span>${escape(initials)}</span>`}</span>`;
}
export function messageIcon(){return '<svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11.5a7.7 7.7 0 0 1-8 7.5 9.5 9.5 0 0 1-3-.5L4 20l1.4-4A7.1 7.1 0 0 1 4 11.5 7.7 7.7 0 0 1 12 4a7.7 7.7 0 0 1 8 7.5Z"/><path d="M8 10h8M8 13h5"/></svg>';}
