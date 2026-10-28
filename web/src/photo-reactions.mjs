export function createPhotoReactions({db,getUser,isAdmin,escape,memberButton}) {
  let root=null,postIds=[],stats=new Map(),comments=new Map(),drafts=new Map(),expanded=new Set(),busy=new Set(),pending=new Map(),errors=new Map(),ready=false,loadError='',version=0,statsRequest=0;
  const moment=value=>new Date(value).toLocaleString('de-CH',{timeZone:'Europe/Zurich',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
  function html(id){
    if(!getUser())return '';
    const counts=stats.get(id)||{likes:0,liked:false,comments:0},disabled=busy.has(id)||!ready;
    const list=comments.get(id);
    return `<div class="reaction-actions"><button data-like="${escape(id)}" class="like-button ${counts.liked?'liked':''}" aria-pressed="${counts.liked}" ${disabled?'disabled':''}>${counts.liked?'❤️':'♡'} ${counts.likes} <span>Gefällt mir</span></button><button data-comments="${escape(id)}" aria-expanded="${expanded.has(id)}" ${!ready?'disabled':''}>💬 ${counts.comments} Kommentare</button></div>${loadError?`<p class="error">${escape(loadError)}</p>`:''}${errors.has(id)?`<p class="error" role="status">${escape(errors.get(id))}</p>`:''}${expanded.has(id)?`<section class="photo-comments" aria-label="Kommentare">${list?list.map(c=>`<div class="photo-comment" data-comment="${escape(c.id)}"><div class="comment-meta">${memberButton(c.user_id,c.profiles?.display_name||'Mitglied')}<time datetime="${escape(c.created_at)}">${escape(moment(c.created_at))}</time></div><p>${escape(c.body)}</p>${c.user_id===getUser().id||isAdmin()?`<button class="comment-delete" data-comment-delete="${escape(c.id)}" data-post="${escape(id)}" ${disabled?'disabled':''}>Kommentar löschen</button>`:''}</div>`).join('')||'<p>Noch keine Kommentare.</p>':'<p>Kommentare werden geladen …</p>'}<form data-comment-form="${escape(id)}"><label>Dein Kommentar<textarea name="body" maxlength="500" rows="2" required placeholder="Schreib einen Kommentar …">${escape(drafts.get(id)||'')}</textarea></label><button class="button" type="submit" ${disabled?'disabled':''}>Kommentieren</button></form></section>`:''}`;
  }
  function update(id){
    if(!root)return;const box=[...root.querySelectorAll('[data-reactions]')].find(el=>el.dataset.reactions===id);if(!box)return;
    const active=box.contains(document.activeElement)&&document.activeElement?.tagName==='TEXTAREA';
    const selection=active?[document.activeElement.selectionStart,document.activeElement.selectionEnd]:null;
    box.innerHTML=html(id);bindBox(box);
    if(active){const field=box.querySelector('textarea');field?.focus({preventScroll:true});if(field)field.setSelectionRange(...selection);}
  }
  function updateAll(){postIds.forEach(update);}
  async function loadStats(){
    if(!getUser()||!postIds.length)return;
    const request=version,sequence=++statsRequest,userId=getUser().id;
    try{const {data,error}=await db.rpc('photo_reaction_counts',{post_ids:postIds});if(request!==version||getUser()?.id!==userId||sequence!==statsRequest)return;if(error)throw error;stats=new Map(data.map(s=>[s.post_id,s]));ready=true;loadError='';}
    catch(error){if(request!==version||sequence!==statsRequest)return;ready=false;loadError=['PGRST202','42883'].includes(error.code)?'Likes und Kommentare müssen noch in Supabase eingerichtet werden.':'Reaktionen konnten nicht geladen werden. Bitte die Seite aktualisieren.';}
    updateAll();
  }
  async function loadComments(id){
    const request=version,userId=getUser()?.id;if(!userId)return;
    const {data,error}=await db.from('photo_comments').select('id,post_id,user_id,body,created_at,profiles(display_name)').eq('post_id',id).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(50);
    if(request!==version||getUser()?.id!==userId)return;
    if(error)throw error;comments.set(id,data.slice().reverse());update(id);
  }
  async function action(id,fn){
    if(!getUser()||busy.has(id)||!ready)return;
    const request=version;busy.add(id);errors.delete(id);update(id);
    try{await fn();}catch(error){if(request===version)errors.set(id,error.message||'Aktion fehlgeschlagen. Bitte erneut versuchen.');}
    finally{if(request===version){busy.delete(id);update(id);}}
  }
  async function toggleLike(id){
    const userId=getUser()?.id,liked=stats.get(id)?.liked;
    await action(id,async()=>{const {error}=liked?await db.from('photo_likes').delete().eq('post_id',id).eq('user_id',userId):await db.from('photo_likes').insert({post_id:id,user_id:userId});if(error&&error.code!=='23505')throw Error('Like konnte nicht gespeichert werden. Bitte erneut versuchen.');await loadStats()});
  }
  async function sendComment(id,form){
    const text=String(new FormData(form).get('body')).trim(),userId=getUser()?.id,request=version;if(!text||text.length>500||!userId)return;
    await action(id,async()=>{
      if(!pending.has(id)||pending.get(id).body!==text)pending.set(id,{id:crypto.randomUUID(),post_id:id,user_id:userId,body:text});
      const {error}=await db.from('photo_comments').insert(pending.get(id));if(request!==version)return;
      if(error&&error.code!=='23505')throw Error('Kommentar konnte nicht gespeichert werden. Dein Text bleibt erhalten.');
      if((drafts.get(id)||'').trim()===text)drafts.set(id,'');pending.delete(id);await Promise.all([loadStats(),loadComments(id)]);
    });
  }
  async function deleteComment(id,commentId){
    const comment=comments.get(id)?.find(c=>c.id===commentId);if(!comment||(comment.user_id!==getUser()?.id&&!isAdmin()))return;
    if(!window.confirm('Diesen Kommentar endgültig löschen?'))return;
    await action(id,async()=>{const {data,error}=await db.from('photo_comments').delete().eq('id',commentId).select('id');if(error||!data?.length)throw Error('Kommentar konnte nicht gelöscht werden.');await Promise.all([loadStats(),loadComments(id)]);});
  }
  function bindBox(box){
    box.querySelector('[data-like]')?.addEventListener('click',event=>toggleLike(event.currentTarget.dataset.like));
    box.querySelector('[data-comments]')?.addEventListener('click',async event=>{const id=event.currentTarget.dataset.comments;if(expanded.has(id)){expanded.delete(id);update(id);}else{expanded.add(id);update(id);try{await loadComments(id)}catch{errors.set(id,'Kommentare konnten nicht geladen werden. Bitte erneut öffnen.');update(id)}}});
    const form=box.querySelector('[data-comment-form]');if(form){const id=form.dataset.commentForm;form.querySelector('textarea').oninput=event=>drafts.set(id,event.target.value);form.onsubmit=event=>{event.preventDefault();sendComment(id,form)}}
    box.querySelectorAll('[data-comment-delete]').forEach(button=>button.onclick=()=>deleteComment(button.dataset.post,button.dataset.commentDelete));
    box.querySelectorAll('[data-member]').forEach(button=>button.onclick=()=>root?.dispatchEvent(new CustomEvent('reaction-member',{detail:button.dataset.member})));
  }
  function unmount(){root=null;}
  function mount(container,ids){root=container;postIds=ids;root.querySelectorAll('[data-reactions]').forEach(bindBox);loadStats();for(const id of ids)if(expanded.has(id))loadComments(id).catch(()=>{errors.set(id,'Kommentare konnten nicht geladen werden.');update(id)});}
  function reset(){version++;statsRequest++;root=null;postIds=[];stats.clear();comments.clear();drafts.clear();expanded.clear();busy.clear();pending.clear();errors.clear();ready=false;loadError='';}
  return {html,mount,unmount,reset};
}
