export function createChat({db,getUser,isAdmin,escape,memberButton}) {
  let messages=[],draft='',ready=false,error='',sending=false,pending=null,container=null,timer=null,version=0,loading=false;
  const getTime=value=>new Date(value).toLocaleString('de-CH',{timeZone:'Europe/Zurich',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
  function html(){
    if(!getUser())return '<section class="card"><h2>Deine Crew im Chat.</h2><p>Melde dich an, um mitzuschreiben.</p></section>';
    return `<section class="card chat-card"><div class="chat-heading"><h2>💬 Crew-Chat</h2><button id="chat-refresh" class="text-button">↻ Laden</button></div><p id="chat-status" role="status"></p><div id="chat-messages" class="chat-messages" role="log" aria-label="Gemeinsamer Chat" aria-live="polite"></div><form id="chat-form"><label for="chat-body">Deine Nachricht</label><textarea id="chat-body" name="body" maxlength="1000" rows="3" placeholder="Was geht am Berg?">${escape(draft)}</textarea><button id="chat-send" class="button" type="submit">Senden</button></form></section>`;
  }
  function update(){
    if(!container||!getUser())return;
    const box=container.querySelector('#chat-messages'),status=container.querySelector('#chat-status'),send=container.querySelector('#chat-send');
    if(!box)return;
    status.textContent=error||(!ready?'Chat wird geladen …':'');status.className=error?'error':'';
    send.disabled=sending||!ready||!draft.trim();send.textContent=sending?'Wird gesendet …':'Senden';
    const content=messages.map(message=>`<article class="chat-message ${message.user_id===getUser().id?'chat-own':''}" data-message-id="${escape(message.id)}"><div class="chat-meta">${memberButton(message.user_id,message.profiles?.display_name||'Mitglied')}<time datetime="${escape(message.created_at)}">${escape(getTime(message.created_at))}</time></div><p class="chat-body">${escape(message.body)}</p>${message.user_id===getUser().id||isAdmin()?`<button class="chat-delete" data-chat-delete="${escape(message.id)}" ${sending?'disabled':''}>Nachricht löschen</button>`:''}</article>`).join('')||'<p>Noch keine Nachrichten. Schreib deiner Crew!</p>';
    if(box.innerHTML!==content){const atBottom=box.scrollHeight-box.scrollTop-box.clientHeight<60,previous=box.scrollTop;box.innerHTML=content;if(atBottom)box.scrollTop=box.scrollHeight;else box.scrollTop=previous;}
    box.querySelectorAll('[data-chat-delete]').forEach(button=>button.onclick=()=>remove(button.dataset.chatDelete));
    box.querySelectorAll('[data-member]').forEach(button=>button.onclick=()=>container.dispatchEvent(new CustomEvent('chat-member',{detail:button.dataset.member})));
  }
  async function load(){
    if(!getUser()||loading||!container)return;
    const request=version,userId=getUser().id;loading=true;
    try{
      const {data,error:failure}=await db.from('chat_messages').select('id,user_id,body,created_at,profiles(display_name)').order('created_at',{ascending:false}).order('id',{ascending:false}).limit(100);
      if(request!==version||getUser()?.id!==userId)return;
      if(failure)throw failure;
      messages=data.slice().reverse();ready=true;error='';
    }catch(failure){if(request!==version)return;error=['PGRST205','42P01'].includes(failure.code)?'Der Chat muss noch in Supabase eingerichtet werden.':'Chat konnte nicht geladen werden. Bitte erneut laden.';}
    finally{if(request===version){loading=false;update();}}
  }
  async function send(event){
    event.preventDefault();if(sending||!ready||!getUser())return;
    const text=draft.trim();if(!text||text.length>1000)return;
    const userId=getUser().id,request=version;
    if(!pending||pending.body!==text)pending={id:crypto.randomUUID(),user_id:userId,body:text};
    sending=true;error='';update();
    try{
      const {error:failure}=await db.from('chat_messages').insert(pending);
      if(request!==version||getUser()?.id!==userId)return;
      // A retry of the same UUID may find the message already saved.
      if(failure&&failure.code!=='23505')throw failure;
      if(draft.trim()===text){draft='';const field=container?.querySelector('#chat-body');if(field)field.value='';}
      pending=null;await load();
    }catch{if(request===version)error='Nachricht konnte nicht gesendet werden. Dein Text bleibt erhalten; versuche es erneut.';}
    finally{if(request===version){sending=false;update();}}
  }
  async function remove(id){
    if(sending||!getUser())return;
    const message=messages.find(m=>m.id===id);if(!message||(message.user_id!==getUser().id&&!isAdmin()))return;
    if(!window.confirm('Diese Nachricht endgültig löschen?'))return;
    const request=version;sending=true;update();
    try{const {data,error:failure}=await db.from('chat_messages').delete().eq('id',id).select('id');if(request!==version)return;if(failure||!data?.length)throw failure||Error();messages=messages.filter(m=>m.id!==id);error='';await load();}
    catch{if(request===version)error='Nachricht konnte nicht gelöscht werden. Bitte erneut versuchen.';}
    finally{if(request===version){sending=false;update();}}
  }
  function unmount(){clearInterval(timer);timer=null;container=null;}
  function mount(root){
    unmount();if(!getUser()||!root.querySelector('#chat-form'))return;
    container=root;const field=container.querySelector('#chat-body');field.oninput=()=>{draft=field.value;update()};
    container.querySelector('#chat-form').onsubmit=send;container.querySelector('#chat-refresh').onclick=()=>load();
    update();load();timer=setInterval(()=>{if(!document.hidden&&!sending)load()},5000);
  }
  function reset(){unmount();version++;messages=[];draft='';ready=false;error='';sending=false;pending=null;loading=false;}
  return {html,mount,unmount,reset};
}
