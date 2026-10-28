import { createClient } from '@supabase/supabase-js';
import { measure } from './tracking.mjs';
import './style.css';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const configured = Boolean(url && key && /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url));
const db = configured ? createClient(url, key) : null;
const root = document.querySelector('#app');
const state = { tab: 'Berg', ranking: 'ski', session: null, profile: null, tours: [], visits: [], feed: [], leaders: [], beerLeaders: [], beerReady: false, beerError: '', busy: false, auth: false, loaded: false, error: '', message: '', proof: null, proofUrl: null, active: false, draft: null };
let watcher = null, previous = null, started = 0, timer = null, epoch = 0;
let metrics = { km: 0, ascent: 0, maxSpeed: null, seconds: 0 };
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date = value => new Date(value).toLocaleDateString('de-CH');
const fmt = n => Number(n).toFixed(1);
const btn = (id, text, disabled = false, cls = '') => `<button id="${id}" class="button ${cls}" ${disabled ? 'disabled' : ''}>${text}</button>`;
const blocked = () => state.busy || !state.session || !state.loaded;
const pattern = icon => `<div class="pattern" aria-hidden="true">${Array.from({length:18},(_,i)=>`<span style="left:${(i*37+4)%87}%;top:${18+i*55}px;transform:rotate(${i%2?22:-22}deg)">${icon}</span>`).join('')}</div>`;
function resetProof() { if (state.proofUrl) URL.revokeObjectURL(state.proofUrl); state.proof = null; state.proofUrl = null; }
function authPanel() {
  return `<section class="card auth"><h2>Deine Crew wartet.</h2><form id="login-form"><label>Anzeigename (für Registrierung)<input name="name" autocomplete="nickname" maxlength="32" placeholder="Dein Pistenname"></label><label>E-Mail<input name="email" type="email" required autocomplete="email" placeholder="du@beispiel.ch"></label><label>Passwort<input name="password" type="password" minlength="8" required autocomplete="current-password" placeholder="Mindestens 8 Zeichen"></label>${btn('login','Anmelden',state.busy||!configured)}${btn('signup','Konto erstellen',state.busy||!configured,'outline')}</form>${btn('close-auth','Schließen',state.busy,'text-button')}</section>`;
}
function mountain() {
  const total = state.tours.reduce((n,t)=>n+Number(t.km),0);
  const days = new Set(state.tours.map(t=>date(t.started_at))).size;
  return `<section class="hero"><span class="mountain" aria-hidden="true">◭</span><div class="eyebrow">DEINE AKTUELLE TOUR</div><div class="big"><span id="live-km">${metrics.km.toFixed(2)}</span> <small>km</small></div><div class="row"><span id="live-time">${time()}</span><span id="live-alt">↗ ${Math.round(metrics.ascent)} m</span><span id="live-speed">${metrics.maxSpeed === null ? '–' : fmt(metrics.maxSpeed)} km/h max.</span></div>${btn('track',state.active?'■ Tour beenden & speichern':state.draft?'Tour erneut speichern':'● Tour starten',blocked())}<p class="note">Browser geöffnet lassen. GPS zählt auch Liftfahrten.</p></section><h2>Deine Saison</h2><div class="row"><div class="stat"><b>${days}</b>Skitage</div><div class="stat"><b>${fmt(total)}</b>Kilometer</div><div class="stat"><b>${state.tours.length}</b>Touren</div></div><h2>Letzte Touren</h2>${state.tours.length?state.tours.map(t=>`<article class="card"><strong>${date(t.started_at)} · ${Number(t.km).toFixed(2)} km</strong><p>${Math.round(t.seconds/60)} Min. · ${t.max_speed===null?'–':fmt(t.max_speed)} km/h max.</p></article>`).join(''):'<p>Noch keine Touren.</p>'}`;
}
function rankings() {
  if (state.ranking === 'beer') return beerRanking();
  const apres = state.ranking === 'apres';
  const entries = [...state.leaders].sort((a,b)=>apres ? b.apres_visits-a.apres_visits : b.km-a.km || (b.max_speed??0)-(a.max_speed??0));
  return `<section class="ranking">${pattern(apres?'🍾':'🎿')}<div class="switcher"><button id="ski-tab" aria-pressed="${!apres}" class="${!apres?'selected':''}">🎿 Ski-Rangliste</button><button id="apres-tab" aria-pressed="${apres}" class="${apres?'selected':''}">🍾 Après-Ski</button><button id="beer-tab" aria-pressed="false">🍺 Bier</button></div><div class="card"><h2>${apres?'🍾 Après-Ski':'Deine Bestleistungen'}</h2><table><thead><tr><th>RANG / NAME</th><th>${apres?'BESUCHE 🍾':'KM GESAMT'}</th>${apres?'':'<th>MAX. KM/H</th>'}</tr></thead><tbody>${entries.map((e,i)=>`<tr><td>${String(i+1).padStart(2,'0')} &nbsp; ${escape(e.display_name)}${e.user_id===state.session?.user.id?' · Du':''}</td><td>${apres?e.apres_visits:fmt(e.km)}</td>${apres?'':`<td>${e.max_speed===null?'–':fmt(e.max_speed)}</td>`}</tr>`).join('')||`<tr><td colspan="${apres?2:3}">Noch keine Einträge</td></tr>`}</tbody></table></div>${apres?`<div class="card"><strong>🍾 Ich war beim Après-Ski</strong>${state.proofUrl?`<img class="photo" alt="Ausgewähltes Beweisfoto" src="${escape(state.proofUrl)}">`:''}<label class="button outline file-button">${state.proof?'Beweisfoto wechseln':'+ Beweisfoto hinzufügen'}<input id="proof" type="file" accept="image/jpeg,image/png,image/webp" ${blocked()?'disabled':''}></label>${btn('visit','🍾 Besuch speichern',blocked()||!state.proof)}${state.proof?btn('cancel-proof','Abbrechen',state.busy,'text-button'):''}</div><h2>Deine Après-Momente</h2>${state.visits.map(v=>`<article class="card"><img class="photo" src="${escape(v.url)}" alt="Après-Ski-Beweisfoto"><strong>🍾 ${date(v.created_at)}</strong></article>`).join('')||'<p>Noch keine Besuche</p>'}`:''}</section>`;
}
function beerRanking() {
  const own = state.beerLeaders.find(e => e.user_id === state.session?.user.id)?.beers ?? 0;
  return `<section class="ranking">${pattern('🍺')}<div class="switcher"><button id="ski-tab" aria-pressed="false">🎿 Ski-Rangliste</button><button id="apres-tab" aria-pressed="false">🍾 Après-Ski</button><button id="beer-tab" class="selected" aria-pressed="true">🍺 Bier</button></div><div class="card"><h2>🍺 Bier-Rangliste</h2>${state.beerError ? `<p class="error">${escape(state.beerError)}</p>` : ''}<table><thead><tr><th>RANG / NAME</th><th>BIER GESAMT</th></tr></thead><tbody>${state.beerLeaders.map((e,i)=>`<tr><td>${String(i+1).padStart(2,'0')} &nbsp; ${escape(e.display_name)}${e.user_id===state.session?.user.id?' · Du':''}</td><td>${e.beers}</td></tr>`).join('') || '<tr><td colspan="2">Noch keine Einträge</td></tr>'}</tbody></table></div><div class="card"><h2>Dein Eintrag</h2><div class="beer-count">${own} <span aria-hidden="true">🍺</span></div><div class="row">${btn('beer-minus','− 1 korrigieren',blocked()||!state.beerReady||own===0,'outline')}${btn('beer-plus','+ 1 eintragen',blocked()||!state.beerReady)}</div></div></section>`;
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
function photos() {
  return `<section class="card"><h2>Für deine Crew.</h2><form id="photo-form"><label>Dein Moment<input name="caption" maxlength="180" placeholder="Was war dein Highlight?"></label><label>Foto für alle Mitglieder<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required ${blocked()?'disabled':''}></label>${btn('post','Foto teilen',blocked())}</form></section>${state.feed.map(p=>`<article class="card"><img class="photo" src="${escape(p.url)}" alt="${escape(p.caption||'Bergfoto')}"><strong>${escape(p.caption||'Ein Moment am Berg')}</strong><p>${escape(p.display_name)} · ${date(p.created_at)}</p></article>`).join('')||'<p>Noch keine geteilten Fotos.</p>'}`;
}
function render() {
  const titles={Berg:'Der Berg ruft.',Duell:'Deine Crew. Dein Ranking.',Fotos:'Momente im Schnee.'};
  root.innerHTML=`<main><header><a class="brand" href="/">◭ SKIDUELL</a><button id="account" class="profile" ${state.busy||state.active||state.draft?'disabled':''}>${state.session?'Abmelden':'Anmelden'}</button></header>${!configured?'<div class="setup">Vorschau · Online-Verbindung noch nicht eingerichtet</div>':''}<h1>${titles[state.tab]}</h1><div id="feedback" role="status" aria-live="polite">${state.error?`<p class="error">${escape(state.error)}</p>`:state.message?`<p class="success">${escape(state.message)}</p>`:''}</div>${state.auth?authPanel():''}${state.session?btn('refresh',state.loaded?'↻ Aktualisieren':'Daten erneut laden',state.busy,'text-button'):''}${!state.session&&configured&&!state.auth?btn('join','Anmelden & mitmachen'):''}${state.tab==='Berg'?mountain():state.tab==='Duell'?rankings():photos()}</main><nav aria-label="Hauptnavigation">${[['Berg','◭'],['Duell','⚑'],['Fotos','▧']].map(([t,icon])=>`<button data-tab="${t}" class="${state.tab===t?'active':''}" aria-current="${state.tab===t?'page':'false'}"><span>${icon}</span>${t}</button>`).join('')}</nav>`;
  document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;render();window.scrollTo(0,0)});
  on('account',async()=>{if(state.session) await run(async()=>{const {error}=await db.auth.signOut();if(error)throw error;}); else {state.auth=!state.auth;render()}});
  on('refresh',()=>run(()=>load()));
  on('join',()=>{state.auth=true;render()});on('close-auth',()=>{state.auth=false;render()});
  const form=document.querySelector('#login-form');if(form){form.onsubmit=e=>{e.preventDefault();authenticate(false)};on('signup',e=>{e.preventDefault();if(form.reportValidity())authenticate(true)});}
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
async function authenticate(signup){
  const values=new FormData(document.querySelector('#login-form'));const email=String(values.get('email')).trim(),password=String(values.get('password')),name=String(values.get('name')).trim();
  await run(async()=>{if(signup&&name.length<2)throw Error('Bitte gib einen Anzeigenamen mit mindestens 2 Zeichen ein.');const {error}=signup?await db.auth.signUp({email,password,options:{data:{display_name:name},emailRedirectTo:location.origin}}):await db.auth.signInWithPassword({email,password});if(error)throw error;if(signup)state.message='Konto erstellt. Falls nötig, bestätige deine E-Mail und melde dich danach an.';});
}
async function load(){
  if(!state.session)return;const current=++epoch,userId=state.session.user.id;
  try{
    const responses=await Promise.all([db.from('profiles').select('display_name').eq('id',userId).single(),db.from('tours').select('*').order('started_at',{ascending:false}),db.from('apres_visits').select('*').order('created_at',{ascending:false}),db.from('posts').select('*, profiles(display_name)').order('created_at',{ascending:false}).limit(50),db.rpc('leaderboard')]);
    for(const r of responses)if(r.error)throw r.error;
    const [profile,tours,visits,feed,leaders]=responses.map(r=>r.data);
    const urls=await Promise.all([Promise.all(visits.map(async v=>({...v,url:await signed('apres-proofs',v.proof_path)}))),Promise.all(feed.map(async p=>({...p,display_name:p.profiles?.display_name||'Mitglied',url:await signed('community-photos',p.image_path)})))]);
    if(current!==epoch)return;await loadBeer();if(current!==epoch)return;Object.assign(state,{profile,tours,visits:urls[0],feed:urls[1],leaders,loaded:true});
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
if(db){db.auth.onAuthStateChange((_event,session)=>{epoch++;const changed=state.session?.user.id!==session?.user.id;state.session=session;if(changed){clearWatch();state.active=false;state.draft=null;resetProof();Object.assign(state,{tours:[],visits:[],feed:[],leaders:[],beerLeaders:[],beerReady:false,beerError:'',profile:null,loaded:false});}if(session){state.auth=false;queueMicrotask(()=>load())}render()});setInterval(()=>{if(state.session&&!state.busy&&!state.active)load()},45*60*1000);}
render();
