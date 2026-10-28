import { createPhotoReactions } from './photo-reactions.mjs';
import { createChat } from './chat.mjs';
import { createClient } from '@supabase/supabase-js';
import { deleteOwnEntry, deletionDefinition, removeImage } from './deletion.mjs';
import { bindPhotoViewer, closePhotoViewer } from './photo-viewer.mjs';
import { measure } from './tracking.mjs';
import './style.css';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const configured = Boolean(url && key && /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url));
const db = configured ? createClient(url, key) : null;
const root = document.querySelector('#app');
const state = { tab: 'Berg', ranking: 'ski', session: null, profile: null, viewedProfile: null, profileEditor: null, profileError: '', admin: false, adminKind: 'photo', adminEntries: [], adminPage: 0, adminMore: false, adminLoaded: false, tours: [], visits: [], feed: [], leaders: [], beerLeaders: [], beerReady: false, beerError: '', mixLeaders: [], mixReady: false, mixError: '', busy: false, auth: false, loaded: false, error: '', message: '', proof: null, proofUrl: null, active: false, draft: null };
let watcher = null, previous = null, started = 0, timer = null, epoch = 0;
let metrics = { km: 0, ascent: 0, maxSpeed: null, seconds: 0 };
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date = value => new Date(value).toLocaleDateString('de-CH');
const fmt = n => Number(n).toFixed(1);
const btn = (id, text, disabled = false, cls = '') => `<button id="${id}" class="button ${cls}" ${disabled ? 'disabled' : ''}>${text}</button>`;
const photoButton = (src, alt) => `<button type="button" class="photo-trigger" aria-label="${escape(alt)} – groß ansehen"><img class="photo" src="${escape(src)}" alt="${escape(alt)}" loading="lazy"></button>`;
const deleteButton = (kind, entry) => entry.user_id === state.session?.user.id ? `<button class="delete-button" data-delete-kind="${kind}" data-delete-id="${escape(entry.id)}" ${blocked()?'disabled':''}>${kind==='photo'?'Foto':kind==='visit'?'Eintrag':'Tour'} löschen</button>` : '';
const blocked = () => state.busy || !state.session || !state.loaded;
const pattern = icon => `<div class="pattern" aria-hidden="true">${Array.from({length:18},(_,i)=>`<span style="left:${(i*37+4)%87}%;top:${18+i*55}px;transform:rotate(${i%2?22:-22}deg)">${icon}</span>`).join('')}</div>`;
const reactions=createPhotoReactions({db,getUser:()=>state.session?.user,isAdmin:()=>state.admin,escape,memberButton});
root.addEventListener('reaction-member',event=>openMember(event.detail));
const chat=createChat({db,getUser:()=>state.session?.user,isAdmin:()=>state.admin,escape,memberButton});
root.addEventListener('chat-member',event=>openMember(event.detail));
function resetProof() { if (state.proofUrl) URL.revokeObjectURL(state.proofUrl); state.proof = null; state.proofUrl = null; }
function authPanel() {
  return `<section class="card auth"><h2>Willkommen bei SkiDuell.</h2><form id="login-form"><label>Anzeigename (für Registrierung)<input name="name" autocomplete="nickname" maxlength="32" placeholder="Dein Pistenname"></label><label>E-Mail<input name="email" type="email" required autocomplete="email" placeholder="du@beispiel.ch"></label><label>Passwort<input name="password" type="password" minlength="8" required autocomplete="current-password" placeholder="Mindestens 8 Zeichen"></label>${btn('login','Anmelden',state.busy||!configured)}${btn('signup','Konto erstellen',state.busy||!configured,'outline')}</form>${btn('close-auth','Schließen',state.busy,'text-button')}</section>`;
}
function mountain() {
  const total = state.tours.reduce((n,t)=>n+Number(t.km),0);
  const days = new Set(state.tours.map(t=>date(t.started_at))).size;
  return `<section class="hero"><span class="mountain" aria-hidden="true">◭</span><div class="eyebrow">DEINE AKTUELLE TOUR</div><div class="big"><span id="live-km">${metrics.km.toFixed(2)}</span> <small>km</small></div><div class="row"><span id="live-time">${time()}</span><span id="live-alt">↗ ${Math.round(metrics.ascent)} m</span><span id="live-speed">${metrics.maxSpeed === null ? '–' : fmt(metrics.maxSpeed)} km/h max.</span></div>${btn('track',state.active?'■ Tour beenden & speichern':state.draft?'Tour erneut speichern':'● Tour starten',blocked())}<p class="note">Browser geöffnet lassen. GPS zählt auch Liftfahrten.</p></section><h2>Deine Saison</h2><div class="row"><div class="stat"><b>${days}</b>Skitage</div><div class="stat"><b>${fmt(total)}</b>Kilometer</div><div class="stat"><b>${state.tours.length}</b>Touren</div></div><h2>Letzte Touren</h2>${state.tours.length?state.tours.map(t=>`<article class="card"><strong>${date(t.started_at)} · ${Number(t.km).toFixed(2)} km</strong><p>${Math.round(t.seconds/60)} Min. · ${t.max_speed===null?'–':fmt(t.max_speed)} km/h max.</p>${deleteButton('tour',t)}</article>`).join(''):'<p>Noch keine Touren.</p>'}`;
}
function rankingTabs() {
  return `<div class="switcher">${[['ski','🎿 Ski'],['apres','🍾 Après-Ski'],['beer','🍺 Bier'],['mix','🍹 Mischen']].map(([id,label])=>`<button id="${id}-tab" aria-pressed="${state.ranking===id}" class="${state.ranking===id?'selected':''}">${label}</button>`).join('')}</div>`;
}
function rankings() {
  if (state.ranking === 'beer' || state.ranking === 'mix') return beerRanking();
  const apres = state.ranking === 'apres';
  const entries = [...state.leaders].sort((a,b)=>apres ? b.apres_visits-a.apres_visits : b.km-a.km || (b.max_speed??0)-(a.max_speed??0));
  return `<section class="ranking">${pattern(apres?'🍾':'🎿')}${rankingTabs()}<div class="card"><h2>${apres?'🍾 Après-Ski':'Deine Bestleistungen'}</h2><table><thead><tr><th>RANG / NAME</th><th>${apres?'BESUCHE 🍾':'KM GESAMT'}</th>${apres?'':'<th>MAX. KM/H</th>'}</tr></thead><tbody>${entries.map((e,i)=>`<tr><td>${String(i+1).padStart(2,'0')} &nbsp; ${memberButton(e.user_id,e.display_name)}${e.user_id===state.session?.user.id?' · Du':''}</td><td>${apres?e.apres_visits:fmt(e.km)}</td>${apres?'':`<td>${e.max_speed===null?'–':fmt(e.max_speed)}</td>`}</tr>`).join('')||`<tr><td colspan="${apres?2:3}">Noch keine Einträge</td></tr>`}</tbody></table></div>${apres?`<div class="card"><strong>🍾 Ich war beim Après-Ski</strong>${state.proofUrl?`${photoButton(state.proofUrl,'Ausgewähltes Beweisfoto')}`:''}<label class="button outline file-button">${state.proof?'Beweisfoto wechseln':'+ Beweisfoto hinzufügen'}<input id="proof" type="file" accept="image/jpeg,image/png,image/webp" ${blocked()?'disabled':''}></label>${btn('visit','🍾 Besuch speichern',blocked()||!state.proof)}${state.proof?btn('cancel-proof','Abbrechen',state.busy,'text-button'):''}</div><h2>Deine Après-Momente</h2>${state.visits.map(v=>`<article class="card">${photoButton(v.url,'Après-Ski-Beweisfoto')}<strong>🍾 ${date(v.created_at)}</strong>${deleteButton('visit',v)}</article>`).join('')||'<p>Noch keine Besuche</p>'}`:''}</section>`;
}
function beerRanking() {
  const mix = state.ranking === 'mix';
  const icon = mix ? '🍹' : '🍺';
  const leaders = mix ? state.mixLeaders : state.beerLeaders;
  const ready = mix ? state.mixReady : state.beerReady;
  const error = mix ? state.mixError : state.beerError;
  const kind = mix ? 'mix' : 'beer';
  const own = leaders.find(e => e.user_id === state.session?.user.id)?.[mix ? 'mixes' : 'beers'] ?? 0;
  return `<section class="ranking">${pattern(icon)}${rankingTabs()}<div class="card"><h2>${mix ? '🍹 Mischen' : '🍺 Bier-Rangliste'}</h2>${error ? `<p class="error">${escape(error)}</p>` : ''}<table><thead><tr><th>RANG / NAME</th><th>${mix ? 'MISCHEN GESAMT' : 'BIER GESAMT'}</th></tr></thead><tbody>${leaders.map((e,i)=>`<tr><td>${String(i+1).padStart(2,'0')} &nbsp; ${memberButton(e.user_id,e.display_name)}${e.user_id===state.session?.user.id?' · Du':''}</td><td>${e[mix ? 'mixes' : 'beers']}</td></tr>`).join('') || '<tr><td colspan="2">Noch keine Einträge</td></tr>'}</tbody></table></div><div class="card"><h2>Dein Eintrag</h2><div class="beer-count">${own} <span aria-hidden="true">${icon}</span></div><div class="row">${btn(kind+'-minus','− 1 korrigieren',blocked()||!ready||own===0,'outline')}${btn(kind+'-plus','+ 1 eintragen',blocked()||!ready)}</div></div></section>`;
}
async function loadBeer() {
  if (!state.session) return;
  const userId = state.session.user.id;
  const {data,error} = await db.rpc('beer_leaderboard');
  if (state.session?.user.id !== userId) return;
  state.beerReady = !error;
  state.beerError = error ? (error.code === 'PGRST202' || error.code === '42883' ? 'Die Bier-Tabelle muss noch in Supabase eingerichtet werden.' : 'Bier-Rangliste konnte nicht geladen werden. Bitte erneut aktualisieren.') : '';
  state.beerLeaders = error ? [] : data;
}
async function adjustBeer(delta) {
  if (blocked() || !state.beerReady) return;
  await run(async()=>{const {error}=await db.rpc('adjust_beer',{delta});if(error)throw error;await loadBeer();});
}
async function loadMix() {
  if (!state.session) return;
  const userId = state.session.user.id;
  const {data,error} = await db.rpc('mix_leaderboard');
  if (state.session?.user.id !== userId) return;
  state.mixReady = !error;
  state.mixError = error ? (error.code === 'PGRST202' || error.code === '42883' ? 'Die Mischen-Tabelle muss noch in Supabase eingerichtet werden.' : 'Mischen-Rangliste konnte nicht geladen werden. Bitte erneut aktualisieren.') : '';
  state.mixLeaders = error ? [] : data;
}
async function adjustMix(delta) {
  if (blocked() || !state.mixReady) return;
  await run(async()=>{const {error}=await db.rpc('adjust_mix',{delta});if(error)throw error;await loadMix();});
}
function photos() {
  return `<section class="card"><h2>Foto teilen</h2><form id="photo-form"><label>Dein Moment<input name="caption" maxlength="180" placeholder="Was war dein Highlight?"></label><label>Foto für alle Mitglieder<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required ${blocked()?'disabled':''}></label>${btn('post','Foto teilen',blocked())}</form></section>${state.feed.map(p=>`<article class="card">${photoButton(p.url,p.caption||'Bergfoto')}<strong>${escape(p.caption||'Ein Moment am Berg')}</strong><p>${memberButton(p.user_id,p.display_name)} · ${date(p.created_at)}</p><div data-reactions="${escape(p.id)}">${reactions.html(p.id)}</div>${deleteButton('photo',p)}</article>`).join('')||'<p>Noch keine geteilten Fotos.</p>'}`;
}
function memberButton(id,name) {
  return `<button class="member-link" data-member="${escape(id)}">${escape(name)}</button>`;
}
function resetProfileEditor() {
  for (const field of ['avatar','banner']) if(state.profileEditor?.[field+'Preview']) URL.revokeObjectURL(state.profileEditor[field+'Preview']);
  state.profileEditor=null;
}
function profilePage() {
  if (!state.session) return `<section class="card"><h2>Dein eigenes Profil</h2><p>Melde dich an, um dein Profil zu gestalten.</p></section>`;
  const profile=state.viewedProfile||state.profile;
  if (!profile) return '<p>Profil wird geladen …</p>';
  const own=profile.id===state.session.user.id;
  const editor=own?state.profileEditor:null;
  const ready='bio' in profile;
  const avatar=editor?.avatarPreview || (editor?.removeAvatar?null:profile.avatarUrl);
  const banner=editor?.bannerPreview || (editor?.removeBanner?null:profile.bannerUrl);
  return `<section class="profile-card"><div class="profile-banner">${banner?photoButton(banner,'Profilbanner'):'<span aria-hidden="true">◭</span>'}</div><div class="profile-details"><div class="profile-avatar">${avatar?photoButton(avatar,'Profilbild'):`<span>${escape((profile.display_name||'?').slice(0,2).toUpperCase())}</span>`}</div><h2>${escape(editor?.name??profile.display_name)}</h2><p class="profile-bio">${escape(editor?.bio??profile.bio??'')}</p>${state.profileError?`<p class="error">${escape(state.profileError)}</p>`:''}${!ready?'<p>Profilgestaltung muss noch in Supabase eingerichtet werden.</p>':''}${own&&!editor?btn('edit-profile','Profil bearbeiten',blocked()||!ready):''}</div></section>${editor?`<section class="card"><h2>Dein Profil gestalten</h2><form id="profile-form"><label>Anzeigename<input name="display_name" value="${escape(editor.name)}" required minlength="2" maxlength="32" autocomplete="nickname"></label><label>Profilbeschreibung<textarea name="bio" rows="4" maxlength="500" placeholder="Erzähl etwas über dich …">${escape(editor.bio)}</textarea></label><label>Profilbild auswählen<input id="avatar-file" type="file" accept="image/jpeg,image/png,image/webp" ${state.busy?'disabled':''}></label>${avatar?btn('remove-avatar','Profilbild entfernen',state.busy,'text-button'):''}<label>Banner auswählen<input id="banner-file" type="file" accept="image/jpeg,image/png,image/webp" ${state.busy?'disabled':''}></label>${banner?btn('remove-banner','Banner entfernen',state.busy,'text-button'):''}${btn('save-profile','Profil speichern',blocked())}${btn('cancel-profile','Abbrechen',state.busy,'text-button')}</form></section>`:''}`;
}
async function profileImages(profile) {
  let failed=false;
  const resolve=async path=>{if(!path)return null;try{return await signed('profile-media',path)}catch{failed=true;return null}};
  const [avatarUrl,bannerUrl]=await Promise.all([resolve(profile.avatar_path),resolve(profile.banner_path)]);
  return {...profile,avatarUrl,bannerUrl,mediaFailed:failed};
}
async function openMember(id) {
  if(blocked())return;
  if(id===state.session.user.id){state.viewedProfile=null;state.tab='Profil';render();return;}
  await run(async()=>{const {data,error}=await db.from('profiles').select('*').eq('id',id).single();if(error)throw error;state.viewedProfile=await profileImages(data);state.profileError=state.viewedProfile.mediaFailed?'Profilbilder konnten nicht geladen werden. Bitte aktualisieren.':'';state.tab='Profil';});
}
function bindProfileEditor() {
  on('edit-profile',()=>{state.profileEditor={name:state.profile.display_name,bio:state.profile.bio||'',avatar:null,banner:null,removeAvatar:false,removeBanner:false};render()});
  on('cancel-profile',e=>{e.preventDefault();resetProfileEditor();render()});
  const form=document.getElementById('profile-form');
  if(!form)return;
  form.querySelector('[name=display_name]').oninput=e=>state.profileEditor.name=e.target.value;
  form.querySelector('[name=bio]').oninput=e=>state.profileEditor.bio=e.target.value;
  form.onsubmit=e=>{e.preventDefault();saveProfile()};
  for(const field of ['avatar','banner']){
    const file=document.getElementById(field+'-file');
    file.onchange=()=>{const selected=file.files[0];if(!selected)return;const editor=state.profileEditor;if(editor[field+'Preview'])URL.revokeObjectURL(editor[field+'Preview']);editor[field]=selected;editor[field+'Preview']=URL.createObjectURL(selected);editor['remove'+(field==='avatar'?'Avatar':'Banner')]=false;render()};
    on('remove-'+field,e=>{e.preventDefault();const editor=state.profileEditor;if(editor[field+'Preview'])URL.revokeObjectURL(editor[field+'Preview']);editor[field+'Preview']=null;editor[field]=null;editor['remove'+(field==='avatar'?'Avatar':'Banner')]=true;render()});
  }
}
async function saveProfile() {
  if(blocked()||!state.profileEditor)return;
  const editor=state.profileEditor,old=state.profile;
  await run(async()=>{
    const name=editor.name.trim();if(name.length<2||name.length>32)throw Error('Der Anzeigename muss 2 bis 32 Zeichen haben.');
    const uploaded=[];
    const changes={display_name:name,bio:editor.bio.trim(),avatar_path:editor.removeAvatar?null:old.avatar_path,banner_path:editor.removeBanner?null:old.banner_path};
    try {
      for(const field of ['avatar','banner'])if(editor[field]){const path=await upload('profile-media',editor[field],crypto.randomUUID());uploaded.push(path);changes[field+'_path']=path;}
      const {data,error}=await db.from('profiles').update(changes).eq('id',state.session.user.id).select('*').single();
      if(error)throw error;
      state.profile=await profileImages(data);state.viewedProfile=null;
    } catch(error) {
      for(const path of uploaded)try{await removeImage(db,{userId:state.session.user.id,bucket:'profile-media',path},state.session.user.id)}catch{try{savePendingImages([...pendingImages(),{userId:state.session.user.id,bucket:'profile-media',path}])}catch{}}
      throw error;
    }
    resetProfileEditor();
    const obsolete=['avatar','banner'].map(field=>old[field+'_path']).filter(path=>path&&path!==changes.avatar_path&&path!==changes.banner_path);
    let cleanupFailed=false;
    try {savePendingImages([...pendingImages(),...obsolete.map(path=>({userId:state.session.user.id,bucket:'profile-media',path}))]);await cleanImages()}catch{cleanupFailed=true}
    await load();state.message='Profil gespeichert.';
    if(cleanupFailed)state.error='Profil gespeichert. Alte Bilddateien konnten noch nicht entfernt werden. Bitte Bilddateien erneut löschen.';
  });
}
async function loadAdminStatus() {
  if(!state.session)return;
  const userId=state.session.user.id;
  const {data,error}=await db.rpc('is_admin');
  if(state.session?.user.id!==userId)return;
  state.admin=!error&&data===true;
  if(!state.admin){state.adminEntries=[];state.adminLoaded=false;if(state.tab==='Admin')state.tab='Berg';}
}
function adminPage() {
  if(!state.admin)return '';
  return `<section class="card"><h2>Einträge verwalten</h2><div class="switcher">${[['photo','Fotos'],['visit','Après-Ski'],['tour','Skitouren'],['beer','🍺 Bier'],['mix','🍹 Mischen']].map(([kind,label])=>`<button data-admin-kind="${kind}" class="${state.adminKind===kind?'selected':''}" ${state.busy?'disabled':''}>${label}</button>`).join('')}</div>${!state.adminLoaded?'<p>Einträge laden …</p>':state.adminEntries.map(entry=>`<article class="admin-entry">${entry.url?photoButton(entry.url,state.adminKind==='visit'?'Après-Ski-Beweisfoto':entry.caption||'Bergfoto'):''}<strong>${escape(entry.profiles?.display_name||'Mitglied')}</strong><p>${date(entry.created_at||entry.started_at||entry.updated_at)}${['beer','mix'].includes(state.adminKind)?' · '+entry.count+' gesamt':state.adminKind==='tour'?' · '+Number(entry.km).toFixed(2)+' km':entry.caption?' · '+escape(entry.caption):''}</p>${['beer','mix'].includes(state.adminKind)?`<form class="counter-correction" data-admin-counter="${escape(entry.user_id)}"><label>Menge abziehen<input name="amount" type="number" inputmode="numeric" min="1" max="2147483647" step="1" value="1" required ${state.busy||entry.count===0?'disabled':''}></label><button class="delete-button" type="submit" ${state.busy||entry.count===0?'disabled':''}>Menge abziehen</button></form>`:`<button class="delete-button" data-admin-delete="${escape(entry.id)}" ${state.busy?'disabled':''}>Eintrag löschen</button>`}</article>`).join('')||'<p>Keine Einträge</p>'}<div class="row">${btn('admin-prev','Zurück',state.busy||state.adminPage===0,'outline')}${btn('admin-next','Weiter',state.busy||!state.adminMore,'outline')}</div></section>`;
}
async function loadAdminEntries() {
  if(!state.admin||!state.session)return;
  const currentUser=state.session.user.id,kind=state.adminKind,page=state.adminPage;
  const definition=deletionDefinition(kind);
  const {data,error}=await db.from(definition.table).select('*, profiles(display_name)').order(kind==='tour'?'started_at':definition.idField?'updated_at':'created_at',{ascending:false}).range(page*25,page*25+25);
  if(error)throw error;
  const entries=await Promise.all(data.slice(0,25).map(async entry=>({...entry,id:entry[definition.idField||'id'],url:definition.bucket?await signed(definition.bucket,entry[definition.imageField]):null})));
  if(state.session?.user.id!==currentUser||!state.admin||state.adminKind!==kind||state.adminPage!==page)return;
  state.adminEntries=entries;state.adminMore=data.length>25;state.adminLoaded=true;
}
async function changeAdminList(kind,page=0) {
  if(blocked()||!state.admin)return;
  state.adminKind=kind;state.adminPage=page;state.adminEntries=[];state.adminLoaded=false;
  await run(()=>loadAdminEntries());
}
async function deleteAdminEntry(id) {
  if(blocked()||!state.admin)return;
  const definition=deletionDefinition(state.adminKind),entry=state.adminEntries.find(e=>e.id===id);
  if(definition.idField||!entry||!window.confirm(`${definition.label} von „${entry.profiles?.display_name||'Mitglied'}“ ${definition.idField?'auf 0 zurücksetzen':'endgültig löschen'}?`))return;
  await run(async()=>{
    // The UI flag never grants rights: Supabase RLS checks the admin role on every request.
    const image=await deleteOwnEntry(db,state.adminKind,entry,state.session.user.id,true);
    let cleanupFailed=false;
    if(image)try{savePendingImages([...pendingImages(),image]);await cleanImages()}catch{cleanupFailed=true}
    await load();
    state.message=definition.idField?'Gesamtzähler auf 0 gesetzt.':'Eintrag gelöscht.';
    if(cleanupFailed)state.error='Eintrag gelöscht. Bitte Bilddateien erneut löschen.';
  });
}
async function reduceAdminCounter(form) {
  if(blocked()||!state.admin||!['beer','mix'].includes(state.adminKind))return;
  const entry=state.adminEntries.find(e=>e.user_id===form.dataset.adminCounter);
  const amount=Number(new FormData(form).get('amount'));
  if(!entry||entry.count===0||!Number.isSafeInteger(amount)||amount<1||amount>2147483647)return;
  const kind=state.adminKind,label=kind==='beer'?'Bier':'Mischen';
  if(!window.confirm(`${amount} bei ${label} von „${entry.profiles?.display_name||'Mitglied'}“ abziehen?`))return;
  await run(async()=>{
    const {data,error}=await db.rpc('admin_reduce_counter',{counter_kind:kind,target_user:entry.user_id,amount});
    if(error)throw error;
    await load();state.message=`Zähler korrigiert. Neuer Stand: ${data}.`;
  });
}
function render() {
  reactions.unmount();
  chat.unmount();
  closePhotoViewer();
  const titles={Berg:'Der Berg ruft.',Duell:'Deine Ranglisten.',Fotos:'Momente im Schnee.',Profil:'Dein Profil.',Admin:'Administration.',Chat:'Gemeinsamer Chat.'};
  root.innerHTML=`<main><header><a class="brand" href="/">◭ SKIDUELL</a><button id="account" class="profile" ${state.busy||state.active||state.draft?'disabled':''}>${state.session?'Abmelden':'Anmelden'}</button></header>${!configured?'<div class="setup">Vorschau · Online-Verbindung noch nicht eingerichtet</div>':''}<h1>${titles[state.tab]}</h1><div id="feedback" role="status" aria-live="polite">${state.error?`<p class="error">${escape(state.error)}</p>`:state.message?`<p class="success">${escape(state.message)}</p>`:''}</div>${state.session&&pendingImages().length?btn('retry-images','Bilddateien erneut löschen',state.busy,'outline'):''}${state.auth?authPanel():''}${state.session?btn('refresh',state.loaded?'↻ Aktualisieren':'Daten erneut laden',state.busy,'text-button'):''}${!state.session&&configured&&!state.auth?btn('join','Anmelden & mitmachen'):''}${state.tab==='Berg'?mountain():state.tab==='Duell'?rankings():state.tab==='Profil'?profilePage():state.tab==='Admin'?adminPage():state.tab==='Chat'?chat.html():photos()}</main><nav aria-label="Hauptnavigation">${[['Berg','◭'],['Duell','⚑'],['Fotos','▧'],['Chat','💬'],['Profil','◉'],...(state.admin?[['Admin','⚙']]:[])].map(([t,icon])=>`<button data-tab="${t}" class="${state.tab===t?'active':''}" aria-current="${state.tab===t?'page':'false'}"><span>${icon}</span>${t}</button>`).join('')}</nav>`;
  if(state.tab==='Chat')chat.mount(root);
  if(state.tab==='Fotos')reactions.mount(root,state.feed.map(post=>post.id));
  bindPhotoViewer(root);
  bindProfileEditor();
  document.querySelectorAll('[data-admin-kind]').forEach(button=>button.onclick=()=>changeAdminList(button.dataset.adminKind));
  document.querySelectorAll('[data-admin-counter]').forEach(form=>form.onsubmit=event=>{event.preventDefault();if(form.reportValidity())reduceAdminCounter(form)});
  document.querySelectorAll('[data-admin-delete]').forEach(button=>button.onclick=()=>deleteAdminEntry(button.dataset.adminDelete));
  on('admin-prev',()=>changeAdminList(state.adminKind,Math.max(0,state.adminPage-1)));on('admin-next',()=>changeAdminList(state.adminKind,state.adminPage+1));
  document.querySelectorAll('[data-member]').forEach(button=>button.onclick=()=>openMember(button.dataset.member));
  document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{if(state.busy)return;resetProfileEditor();state.viewedProfile=null;state.profileError='';state.tab=b.dataset.tab;render();window.scrollTo(0,0);if(state.tab==='Admin')run(()=>loadAdminEntries())});
  document.querySelectorAll('[data-delete-kind]').forEach(button=>button.onclick=()=>deleteEntry(button.dataset.deleteKind,button.dataset.deleteId));
  on('retry-images',()=>run(async()=>{await cleanImages();state.message='Bilddateien gelöscht.'}));
  on('account',async()=>{if(state.session) await run(async()=>{const {error}=await db.auth.signOut();if(error)throw error;}); else {state.auth=!state.auth;render()}});
  on('refresh',()=>run(()=>load()));
  on('join',()=>{state.auth=true;render()});on('close-auth',()=>{state.auth=false;render()});
  const form=document.querySelector('#login-form');if(form){form.onsubmit=e=>{e.preventDefault();authenticate(false)};on('signup',e=>{e.preventDefault();if(form.reportValidity())authenticate(true)});}
  on('mix-tab',()=>{state.ranking='mix';render()});on('mix-plus',()=>adjustMix(1));on('mix-minus',()=>adjustMix(-1));
  on('beer-tab',()=>{state.ranking='beer';render()});on('beer-plus',()=>adjustBeer(1));on('beer-minus',()=>adjustBeer(-1));
  on('ski-tab',()=>{state.ranking='ski';render()});on('apres-tab',()=>{state.ranking='apres';render()});
  on('track',()=>state.active?stop():state.draft?persistTour():start());on('cancel-proof',()=>{resetProof();render()});
  const proof=document.querySelector('#proof');if(proof)proof.onchange=()=>{const f=proof.files[0];if(f){resetProof();state.proof=f;state.proofUrl=URL.createObjectURL(f);render()}};
  on('visit',()=>visit());const photoForm=document.querySelector('#photo-form');if(photoForm)photoForm.onsubmit=e=>{e.preventDefault();postPhoto(photoForm)};
}
function on(id,handler){const el=document.getElementById(id);if(el)el.onclick=handler;}
async function run(fn) {
  if(state.busy)return;state.busy=true;state.error='';state.message='';render();
  try{await fn()}catch(error){state.error=error.message||'Etwas ist schiefgegangen. Bitte erneut versuchen.'}finally{state.busy=false;render()}
}
function pendingImages() {
  if (!state.session) return [];
  try { const items=JSON.parse(localStorage.getItem('skiduell-delete-images-'+state.session.user.id)||'[]');return Array.isArray(items)?items:[]; } catch { return []; }
}
function savePendingImages(images) {
  localStorage.setItem('skiduell-delete-images-'+state.session.user.id,JSON.stringify(images));
}
async function cleanImages() {
  for (const image of pendingImages()) {
    await removeImage(db,image,state.session.user.id,state.admin);
    savePendingImages(pendingImages().filter(i=>i.path!==image.path||i.bucket!==image.bucket));
  }
}
async function deleteEntry(kind,id) {
  if (blocked()) return;
  const definition=deletionDefinition(kind);
  const entry=definition && state[definition.collection].find(e=>e.id===id);
  if (!entry || entry.user_id!==state.session.user.id) return;
  if (!window.confirm(`${definition.label} wirklich endgültig löschen?`)) return;
  await run(async()=>{
    const image=await deleteOwnEntry(db,kind,entry,state.session.user.id);
    let cleanupFailed=false;
    if (image) {
      try { savePendingImages([...pendingImages(),image]);await cleanImages(); }
      catch { cleanupFailed=true; }
    }
    await load();
    if(cleanupFailed) state.error='Eintrag gelöscht. Die Bilddatei konnte noch nicht entfernt werden. Bitte „Bilddateien erneut löschen“ wählen; falls der Button fehlt, melde dich für die Bereinigung.';
    else state.message=definition.label+' gelöscht.';
  });
}
async function authenticate(signup){
  const values=new FormData(document.querySelector('#login-form'));const email=String(values.get('email')).trim(),password=String(values.get('password')),name=String(values.get('name')).trim();
  await run(async()=>{if(signup&&name.length<2)throw Error('Bitte gib einen Anzeigenamen mit mindestens 2 Zeichen ein.');const {error}=signup?await db.auth.signUp({email,password,options:{data:{display_name:name},emailRedirectTo:location.origin}}):await db.auth.signInWithPassword({email,password});if(error)throw error;if(signup)state.message='Konto erstellt. Falls nötig, bestätige deine E-Mail und melde dich danach an.';});
}
async function load(){
  if(!state.session)return;const current=++epoch,userId=state.session.user.id;
  try{
    const responses=await Promise.all([db.from('profiles').select('*').eq('id',userId).single(),db.from('tours').select('*').eq('user_id',userId).order('started_at',{ascending:false}),db.from('apres_visits').select('*').eq('user_id',userId).order('created_at',{ascending:false}),db.from('posts').select('*, profiles(display_name)').order('created_at',{ascending:false}).limit(50),db.rpc('leaderboard')]);
    for(const r of responses)if(r.error)throw r.error;
    const [rawProfile,tours,visits,feed,leaders]=responses.map(r=>r.data);
    const profile=await profileImages(rawProfile);
    const urls=await Promise.all([Promise.all(visits.map(async v=>({...v,url:await signed('apres-proofs',v.proof_path)}))),Promise.all(feed.map(async p=>({...p,display_name:p.profiles?.display_name||'Mitglied',url:await signed('community-photos',p.image_path)})))]);
    if(current!==epoch)return;await Promise.all([loadBeer(),loadMix(),loadAdminStatus()]);if(current!==epoch)return;Object.assign(state,{profile,tours,visits:urls[0],feed:urls[1],leaders,loaded:true});if(state.tab==='Admin'&&state.admin)await loadAdminEntries();
  }catch(e){if(current===epoch){state.error='Daten konnten nicht geladen werden: '+e.message;state.loaded=false;}}
  if(current===epoch)render();
}
async function signed(bucket,path){const {data,error}=await db.storage.from(bucket).createSignedUrl(path,3600);if(error)throw error;return data.signedUrl;}
async function imageBlob(file){
  if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Bitte wähle ein JPG-, PNG- oder WebP-Foto.');
  if(file.size>20*1024*1024)throw Error('Das Foto darf höchstens 20 MB groß sein.');
  const bitmap=await createImageBitmap(file);try{const ratio=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);return await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Foto konnte nicht verarbeitet werden.')),'image/jpeg',0.85));}finally{bitmap.close()}
}
async function upload(bucket,file,id){const blob=await imageBlob(file);const path=`${state.session.user.id}/${id}.jpg`;const {error}=await db.storage.from(bucket).upload(path,blob,{contentType:'image/jpeg',upsert:false});if(error)throw error;return path;}
async function visit(){if(blocked()||!state.proof)return;const file=state.proof,id=crypto.randomUUID();await run(async()=>{const path=await upload('apres-proofs',file,id);const {error}=await db.from('apres_visits').insert({id,user_id:state.session.user.id,proof_path:path});if(error){await db.storage.from('apres-proofs').remove([path]);throw error}resetProof();state.message='🍾 Besuch gespeichert.';await load()});}
async function postPhoto(form){if(blocked())return;const values=new FormData(form),file=values.get('photo'),caption=String(values.get('caption')).trim(),id=crypto.randomUUID();await run(async()=>{const path=await upload('community-photos',file,id);const {error}=await db.from('posts').insert({id,user_id:state.session.user.id,image_path:path,caption});if(error){await db.storage.from('community-photos').remove([path]);throw error}state.message='Foto mit allen Mitgliedern geteilt.';await load()});}
function time(){return `${Math.floor(metrics.seconds/60)}:${String(metrics.seconds%60).padStart(2,'0')}`;}
function updateMetrics(){for(const [id,text] of [['live-km',metrics.km.toFixed(2)],['live-time',time()],['live-alt',`↗ ${Math.round(metrics.ascent)} m`],['live-speed',`${metrics.maxSpeed===null?'–':fmt(metrics.maxSpeed)} km/h max.`]]){const el=document.getElementById(id);if(el)el.textContent=text}}
function start(){
  if(blocked()||state.active||state.draft)return;if(!navigator.geolocation){state.error='Dein Browser unterstützt keine Standortmessung.';render();return}
  metrics={km:0,ascent:0,maxSpeed:null,seconds:0};previous=null;started=Date.now();state.active=true;state.error='';
  watcher=navigator.geolocation.watchPosition(point=>{if(document.hidden||point.coords.accuracy>30){previous=null;return}const delta=measure(previous,point);if(delta){metrics.km+=delta.km;metrics.ascent+=delta.ascent;if(delta.maxSpeed!==null)metrics.maxSpeed=Math.max(metrics.maxSpeed??0,delta.maxSpeed)}previous=point;updateMetrics()},error=>{clearWatch();state.active=false;state.draft={id:crypto.randomUUID(),user_id:state.session.user.id,started_at:new Date(started).toISOString(),km:metrics.km,max_speed:metrics.maxSpeed,ascent:Math.round(metrics.ascent),seconds:Math.round((Date.now()-started)/1000)};state.error=error.code===1?'Standortzugriff verweigert. Du kannst die bisherige Tour speichern.':'GPS unterbrochen. Du kannst die bisherige Tour speichern.';render()},{enableHighAccuracy:true,maximumAge:0,timeout:20000});
  timer=setInterval(()=>{metrics.seconds=Math.floor((Date.now()-started)/1000);updateMetrics()},1000);render();
}
function clearWatch(){if(watcher!==null)navigator.geolocation.clearWatch(watcher);watcher=null;clearInterval(timer);timer=null;previous=null;}
async function stop(){if(blocked())return;clearWatch();state.active=false;state.draft={id:crypto.randomUUID(),user_id:state.session.user.id,started_at:new Date(started).toISOString(),km:metrics.km,max_speed:metrics.maxSpeed,ascent:Math.round(metrics.ascent),seconds:Math.round((Date.now()-started)/1000)};await persistTour()}
async function persistTour(){if(blocked()||!state.draft)return;await run(async()=>{const {error}=await db.from('tours').upsert(state.draft,{onConflict:'id'});if(error)throw error;state.draft=null;state.message='Tour gespeichert.';await load()})}
document.addEventListener('visibilitychange',()=>{previous=null;if(document.hidden&&state.active)state.message='Browser-Aufzeichnung kann bei gesperrtem Bildschirm aussetzen.';else if(state.active)render()});
window.addEventListener('beforeunload',event=>{if(state.active||state.draft){event.preventDefault();event.returnValue=''}});
if(db){db.auth.onAuthStateChange((_event,session)=>{epoch++;const changed=state.session?.user.id!==session?.user.id;state.session=session;if(changed){clearWatch();state.active=false;state.draft=null;resetProof();resetProfileEditor();chat.reset();reactions.reset();Object.assign(state,{tours:[],visits:[],feed:[],leaders:[],beerLeaders:[],beerReady:false,beerError:'',mixLeaders:[],mixReady:false,mixError:'',profile:null,viewedProfile:null,profileError:'',admin:false,adminEntries:[],adminPage:0,adminMore:false,adminLoaded:false,loaded:false});}if(session){state.auth=false;queueMicrotask(()=>load())}render()});setInterval(()=>{if(state.session&&!state.busy&&!state.active)load()},45*60*1000);}
render();
