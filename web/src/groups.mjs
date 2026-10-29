import {createChat} from './chat.mjs';
export function createGroups({db,getUser,escape,memberButton,resolveAvatar,messageIcon,onChange,onOpen,onBack}) {
 let root=null,groups=[],selected=null,members=[],contacts=[],chosen=new Map(),name='',term='',creating=false,busy=false,ready=false,error='',timer=null,version=0,pendingId=null;
 let controlsOpen=false;
 const chats=new Map();
 const owner=()=>selected?.owner_id===getUser()?.id;
 function picker(){return `<form id="group-search"><label>Mitglieder suchen<input name="term" value="${escape(term)}" minlength="2" maxlength="32" required placeholder="Anzeigename"></label><button class="button outline" ${busy?'disabled':''}>Suchen</button></form><div class="group-contacts">${contacts.map(p=>`<button type="button" class="group-person" data-group-pick="${escape(p.id)}" ${busy?'disabled':''}>${escape(p.display_name)} ${selected?'Hinzufügen':chosen.has(p.id)?'✓':'+'}</button>`).join('')}</div>`;}
 function listHtml(){
  if(!getUser())return '';
  return `<section id="group-area"><div class="group-title"><h3>Deine Gruppen</h3><button id="group-new" class="text-button" ${busy||!ready?'disabled':''}>+ Neue Gruppe</button></div><p class="group-error" role="status">${escape(error)}</p>${creating?`<section class="card"><h2>Gruppe erstellen</h2><label>Gruppenname<input id="group-name" maxlength="60" minlength="2" value="${escape(name)}" placeholder="Zum Beispiel: Skiwochenende"></label>${picker()}<div class="group-selected">${[...chosen.values()].map(p=>`<button data-group-unpick="${escape(p.id)}" ${busy?'disabled':''}>${escape(p.display_name)} ×</button>`).join('')}</div><button class="button" id="group-create" ${busy?'disabled':''}>Gruppe erstellen</button><button class="button text-button" id="group-cancel" ${busy?'disabled':''}>Abbrechen</button></section>`:''}<div id="group-list">${groups.map(g=>`<button class="conversation-row" data-group-open="${escape(g.id)}"><span class="message-avatar group-avatar">${messageIcon()}</span><span class="conversation-copy"><strong>${escape(g.name)}</strong><span>Privater Gruppenchat${g.owner_id===getUser().id?' · Von dir erstellt':''}</span></span><span class="conversation-chevron">›</span></button>`).join('')||'<p class="inbox-empty">Noch keine eigenen Gruppen.</p>'}</div></section>`;
 }
 function conversationHtml(){
  if(!selected||!getUser())return '<p>Gruppe wird geladen …</p>';
  return `<button id="group-back" class="chat-back">← Nachrichten</button><section class="group-controls"><details ${controlsOpen?'open':''}><summary>Mitglieder (${members.length})</summary><div>${members.map(p=>`<div class="group-member">${memberButton(p.user_id,p.profiles?.display_name||'Mitglied')} ${p.user_id===selected.owner_id?'<span>Ersteller</span>':owner()?`<button data-group-remove="${escape(p.user_id)}" ${busy?'disabled':''}>Entfernen</button>`:''}</div>`).join('')}</div>${owner()?picker():''}<button id="group-exit" class="delete-button" ${busy?'disabled':''}>${owner()?'Gruppe löschen':'Gruppe verlassen'}</button></details><p class="group-error" role="status">${escape(error)}</p></section>${chats.get(selected.id).html()}`;
 }
 function ensureChat(group){if(!chats.has(group.id))chats.set(group.id,createChat({db,getUser,isAdmin:()=>group.owner_id===getUser()?.id,escape,memberButton,resolveAvatar,getGroup:()=>group}));}
 function open(group){selected=group;members=[];contacts=[];error='';controlsOpen=false;ensureChat(group);onOpen();}
 async function load(){
  if(!getUser())return;const request=version;
  const {data,error:failure}=await db.from('chat_groups').select('*').order('created_at',{ascending:false});
  if(request!==version)return;
  if(failure){ready=false;error=['PGRST205','42P01'].includes(failure.code)?'Eigene Gruppen müssen noch in Supabase eingerichtet werden.':'Gruppen konnten nicht geladen werden.';}
  else{ready=true;groups=data;error='';}
  paintList();
 }
 function paintList(){if(!root||selected||creating)return;const area=root.querySelector('#group-area');if(!area)return;area.outerHTML=listHtml();bind();}
 async function loadMembers(){
  if(!selected||!getUser())return;const id=selected.id,request=version;
  const {data,error:failure}=await db.from('chat_groups').select('*').eq('id',id).maybeSingle();
  if(request!==version||selected?.id!==id)return;
  if(failure)throw failure;
  if(!data){chats.get(id)?.reset();selected=null;members=[];onBack();return;}
  const response=await db.from('group_members').select('group_id,user_id,profiles:profiles!group_members_user_id_fkey(display_name)').eq('group_id',id);
  if(request!==version||selected?.id!==id)return;if(response.error)throw response.error;
  const changed=JSON.stringify(members)!==JSON.stringify(response.data);members=response.data;
  if(changed)onChange();
 }
 async function action(fn){if(busy||!getUser())return;const request=version;busy=true;error='';onChange();try{await fn()}catch(e){if(request===version)error=e.message||'Aktion fehlgeschlagen.'}finally{if(request===version){busy=false;onChange()}}}
 async function search(event){event.preventDefault();term=String(new FormData(event.currentTarget).get('term')).trim();if(term.length<2)return;await action(async()=>{const {data,error:failure}=await db.from('profiles').select('id,display_name').neq('id',getUser().id).ilike('display_name','%'+term+'%').order('display_name').limit(30);if(failure)throw failure;contacts=data.filter(p=>!members.some(m=>m.user_id===p.id));});}
 async function create(){
  const title=name.trim();if(title.length<2||title.length>60){error='Bitte einen Gruppennamen mit 2–60 Zeichen eingeben.';onChange();return;}
  if(!pendingId)pendingId=crypto.randomUUID();
  await action(async()=>{const {data,error:failure}=await db.rpc('create_group',{group_name:title,member_ids:[...chosen.keys()],new_group:pendingId});if(failure)throw failure;const group={id:data,name:title,owner_id:getUser().id};pendingId=null;creating=false;chosen.clear();name='';contacts=[];open(group);});
 }
 async function changeMember(id,add){await action(async()=>{const {error:failure}=await db.rpc('set_group_member',{target_group:selected.id,target_user:id,add_member:add});if(failure)throw failure;contacts=[];await loadMembers()});}
 function bind(){
  if(!root)return;
  const details=root.querySelector('.group-controls details');if(details)details.ontoggle=()=>controlsOpen=details.open;
  const on=(id,fn)=>{const el=root.querySelector('#'+id);if(el)el.onclick=fn};
  on('group-new',()=>{creating=true;selected=null;error='';onChange()});on('group-cancel',()=>{creating=false;contacts=[];chosen.clear();name='';pendingId=null;onChange()});on('group-create',create);
  const field=root.querySelector('#group-name');if(field)field.oninput=e=>{name=e.target.value;pendingId=null};const searchForm=root.querySelector('#group-search');if(searchForm){searchForm.onsubmit=search;searchForm.querySelector('input').oninput=e=>term=e.target.value;}
  root.querySelectorAll('[data-group-open]').forEach(b=>b.onclick=()=>open(groups.find(g=>g.id===b.dataset.groupOpen)));
  root.querySelectorAll('[data-group-pick]').forEach(b=>b.onclick=()=>{const person=contacts.find(p=>p.id===b.dataset.groupPick);if(selected)changeMember(person.id,true);else{if(chosen.has(person.id))chosen.delete(person.id);else if(chosen.size<49)chosen.set(person.id,person);pendingId=null;onChange()}});
  root.querySelectorAll('[data-group-unpick]').forEach(b=>b.onclick=()=>{chosen.delete(b.dataset.groupUnpick);pendingId=null;onChange()});
  root.querySelectorAll('[data-group-remove]').forEach(b=>b.onclick=()=>{if(window.confirm('Dieses Mitglied aus der Gruppe entfernen?'))changeMember(b.dataset.groupRemove,false)});
  on('group-back',()=>{selected=null;members=[];contacts=[];error='';onBack()});
  on('group-exit',()=>{if(!selected||!window.confirm(owner()?'Gruppe und alle Nachrichten endgültig löschen?':'Diese Gruppe verlassen?'))return;action(async()=>{const id=selected.id;const result=owner()?await db.from('chat_groups').delete().eq('id',id).select('id'):await db.rpc('leave_group',{target_group:id});if(result.error)throw result.error;chats.get(id)?.reset();selected=null;members=[];onBack()})});
  root.querySelectorAll('.group-member [data-member]').forEach(b=>b.onclick=()=>root?.dispatchEvent(new CustomEvent('chat-member',{detail:b.dataset.member})));
 }
 function unmount(){const details=root?.querySelector('.group-controls details');if(details){controlsOpen=details.open;details.ontoggle=null;}root=null;clearInterval(timer);timer=null;chats.forEach(c=>c.unmount())}
 function mount(container,conversation=false){unmount();root=container;if(!getUser())return;if(conversation&&selected){ensureChat(selected);chats.get(selected.id).mount(root);loadMembers().catch(e=>{error=e.message});timer=setInterval(()=>{if(!document.hidden&&!busy)loadMembers().catch(()=>{})},10000);}else if(root.querySelector('#group-area')){selected=null;members=[];load();timer=setInterval(()=>{if(!document.hidden&&!busy&&!creating)load()},10000);}bind();}
 function reset(){unmount();version++;chats.forEach(c=>c.reset());chats.clear();groups=[];selected=null;members=[];contacts=[];chosen.clear();name='';term='';creating=false;busy=false;ready=false;error='';pendingId=null;}
 return {listHtml,conversationHtml,mount,unmount,reset};
}
