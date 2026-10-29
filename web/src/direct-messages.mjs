import {createChat} from './chat.mjs';
export function createDirectMessages({db,getUser,escape,memberButton,onChange,resolveAvatar,avatarMarkup,messageIcon,groupHtml=()=>''}) {
  let root=null,selected=null,threads=[],contacts=[],error='',ready=false,timer=null,version=0,searchTerm='',searchRequest=0,loading=false;
  const chats=new Map();
  function html(){
    if(!getUser())return '<section class="card"><h2>Private Nachrichten</h2><p>Melde dich an, um jemandem zu schreiben.</p></section>';
    if(selected)return `<button id="dm-back" class="button outline">← Nachrichten</button>${chats.get(selected.id).html()}`;
    return `<section class="inbox"><div class="inbox-title"><h2>Nachrichten</h2></div><button id="chat-public" class="conversation-row group-conversation"><span class="message-avatar group-avatar">${messageIcon()}</span><span class="conversation-copy"><strong>Allgemeiner Chat</strong><span>Für alle angemeldeten Mitglieder</span></span><span class="conversation-chevron">›</span></button><form id="dm-search"><label>Person suchen<input name="name" minlength="2" maxlength="32" value="${escape(searchTerm)}" placeholder="Anzeigename" required autocomplete="off"></label><button class="button" type="submit" ${ready?'':'disabled'}>Suchen</button></form><p id="dm-status" role="status"></p><div id="dm-contacts"></div>${groupHtml()}<h3 class="conversation-section">Deine Gespräche</h3><div id="dm-threads"></div></section>`;
  }
  function open(peer){
    if(!getUser()||peer.id===getUser().id)return;
    if(!chats.has(peer.id))chats.set(peer.id,createChat({db,getUser,isAdmin:()=>false,escape,memberButton,getPeer:()=>peer,resolveAvatar}));
    selected=peer;onChange();
  }
  function paint(){
    if(!root||selected||!getUser())return;
    root.querySelector('#dm-status').textContent=error||(!ready?'Gespräche werden geladen …':'');
    const search=root.querySelector('#dm-search button');search.disabled=!ready;
    root.querySelector('#dm-contacts').innerHTML=contacts.map(p=>`<button class="conversation-row" data-dm-contact="${escape(p.id)}">${avatarMarkup(p.display_name,p.avatarUrl)}<span class="conversation-copy"><strong>${escape(p.display_name)}</strong><span>Nachricht schreiben</span></span><span class="conversation-chevron">›</span></button>`).join('');
    root.querySelector('#dm-threads').innerHTML=threads.map(t=>`<button class="conversation-row" data-dm-thread="${escape(t.user_id)}">${avatarMarkup(t.display_name,t.avatarUrl)}<span class="conversation-copy"><strong>${escape(t.display_name)}</strong><span>${escape(t.last_body)}</span></span><time>${escape(new Date(t.last_at).toLocaleString('de-CH',{timeZone:'Europe/Zurich',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}))}</time></button>`).join('')||(ready?'<p class="inbox-empty">Noch keine privaten Gespräche.</p>':'');
    root.querySelectorAll('[data-dm-contact]').forEach(b=>b.onclick=()=>open(contacts.find(p=>p.id===b.dataset.dmContact)));
    root.querySelectorAll('[data-dm-thread]').forEach(b=>b.onclick=()=>{const t=threads.find(p=>p.user_id===b.dataset.dmThread);open({id:t.user_id,display_name:t.display_name,avatarUrl:t.avatarUrl})});
  }
  async function load(){
    if(!getUser()||selected||loading)return;const request=version;loading=true;
    try{const {data,error:failure}=await db.rpc('dm_conversations');if(request!==version)return;if(failure)throw failure;const ids=data.map(t=>t.user_id);const profiles=ids.length?await db.from('profiles').select('id,avatar_path').in('id',ids):{data:[]};const paths=new Map((profiles.data||[]).map(p=>[p.id,p.avatar_path]));const decorated=await Promise.all(data.map(async t=>({...t,avatarUrl:await resolveAvatar(paths.get(t.user_id))})));if(request!==version)return;threads=decorated;ready=true;error='';}
    catch(failure){if(request===version)error=['PGRST202','42883'].includes(failure.code)?'Private Nachrichten müssen noch in Supabase eingerichtet werden.':'Gespräche konnten nicht geladen werden. Bitte erneut öffnen.';}
    finally{if(request===version){loading=false;paint();}}
  }
  async function search(event){
    event.preventDefault();const term=String(new FormData(event.currentTarget).get('name')).trim();searchTerm=term;if(term.length<2||!getUser()||!ready)return;
    const request=version,sequence=++searchRequest;
    try{const {data,error:failure}=await db.from('profiles').select('id,display_name,avatar_path').neq('id',getUser().id).ilike('display_name','%'+term+'%').order('display_name').limit(30);if(request!==version||sequence!==searchRequest)return;if(failure)throw failure;const decorated=await Promise.all(data.map(async p=>({...p,avatarUrl:await resolveAvatar(p.avatar_path)})));if(request!==version||sequence!==searchRequest)return;contacts=decorated;error=data.length?'':'Keine Personen gefunden.';}
    catch{if(request===version)error='Suche fehlgeschlagen. Bitte erneut versuchen.';}
    paint();
  }
  function unmount(){root=null;clearInterval(timer);timer=null;chats.forEach(chat=>chat.unmount());}
  function mount(container){unmount();root=container;if(!getUser())return;if(selected){chats.get(selected.id).mount(root);root.querySelector('#dm-back').onclick=()=>{selected=null;onChange()};return;}root.querySelector('#dm-search').onsubmit=search;root.querySelector('#dm-search input').oninput=e=>searchTerm=e.target.value;paint();load();timer=setInterval(()=>{if(!document.hidden)load()},5000);}
  function reset(){unmount();version++;searchRequest++;chats.forEach(chat=>chat.reset());chats.clear();selected=null;threads=[];contacts=[];error='';ready=false;searchTerm='';loading=false;}
  return {html,open,mount,unmount,reset,showInbox(){selected=null;onChange()}};
}
