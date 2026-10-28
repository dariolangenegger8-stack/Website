const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5189','--strictPort'],{env:{...process.env,VITE_SUPABASE_URL:'https://skidu-test.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'},stdio:'pipe'});
let serverError='';server.stderr.on('data',chunk=>serverError+=chunk);server.stdout.resume();
(async()=>{
 let ready=false;for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error('Test server failed: '+serverError);try{const r=await fetch('http://127.0.0.1:5189');if(r.ok){ready=true;break}}catch{}await new Promise(resolve=>setTimeout(resolve,100));}if(!ready)throw Error('Test server not ready');
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH} : {}),args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const uid='11111111-1111-4111-8111-111111111111',tours=[],visits=[],posts=[];
 const user={id:uid,aud:'authenticated',role:'authenticated',email:'ski@example.test',app_metadata:{provider:'email'},user_metadata:{display_name:'Dario'},created_at:new Date().toISOString()};
 const token=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:uid,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.test';
 await page.route('https://skidu-test.supabase.co/**',async route=>{const req=route.request(),url=new URL(req.url()),path=url.pathname;let data=null,status=200;const body=()=>req.postDataJSON();
  if(req.method()==='OPTIONS'){await route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});return}
  if(path.includes('/auth/v1/token'))data={access_token:token,refresh_token:'test-refresh',token_type:'bearer',expires_in:3600,user};
  else if(path.includes('/auth/v1/user'))data=user;
  else if(path.includes('/auth/v1/logout'))status=204;
  else if(path.endsWith('/profiles'))data={display_name:'Dario'};
  else if(path.endsWith('/rpc/leaderboard'))data=[{user_id:uid,display_name:'Dario',km:tours.reduce((s,t)=>s+t.km,0),max_speed:tours.length?Math.max(...tours.map(t=>t.max_speed||0)):null,apres_visits:visits.length}];
  else if(path.endsWith('/tours')){if(req.method()==='POST'){const t=body();tours.push(t);status=201}else data=tours}
  else if(path.endsWith('/apres_visits')){if(req.method()==='POST'){visits.push({...body(),created_at:new Date().toISOString()});status=201}else data=visits}
  else if(path.endsWith('/posts')){if(req.method()==='POST'){posts.push({...body(),created_at:new Date().toISOString(),profiles:{display_name:'Dario'}});status=201}else data=posts}
  else if(path.includes('/storage/v1/object/sign/'))data={signedURL:'/object/sign/community-photos/test.jpg?token=test'};
  else if(path.includes('/storage/v1/object/'))data={Key:'test'};
  else throw Error('Unexpected API '+path);
  await route.fulfill({status,headers:{'access-control-allow-origin':'*'},contentType:'application/json',body:status===204?'':JSON.stringify(data)});
 });
 await page.addInitScript(()=>{navigator.geolocation.watchPosition=(callback)=>{window.gps=callback;return 1};navigator.geolocation.clearWatch=()=>{};});
 await page.goto('http://127.0.0.1:5189');await page.getByRole('button',{name:'Anmelden',exact:true}).click();await page.locator('[name=email]').fill('ski@example.test');await page.locator('[name=password]').fill('test-password');await page.locator('#login').click();await page.getByRole('button',{name:'Abmelden',exact:true}).waitFor();await page.locator('#track:not([disabled])').waitFor();
 await page.locator('#track').click();await page.evaluate(()=>{const now=Date.now();window.gps({timestamp:now,coords:{latitude:47,longitude:8,accuracy:5,speed:10,altitude:1000}});window.gps({timestamp:now+2000,coords:{latitude:47.0002,longitude:8,accuracy:5,speed:10,altitude:1010}})});assert.equal(await page.locator('#live-speed').innerText(),'36.0 km/h max.');await page.locator('#track').click();await page.locator('#track:not([disabled])').waitFor();assert.equal(tours.length,1);assert(tours[0].km>0.02);assert.equal(tours[0].max_speed,36);
 await page.locator('[data-tab=Duell]').click();assert((await page.locator('tbody').innerText()).includes('36.0'));await page.locator('#apres-tab').click();assert(await page.locator('#visit').isDisabled());
 const png=await page.screenshot();await page.locator('#proof').setInputFiles({name:'proof.png',mimeType:'image/png',buffer:png});assert.equal(visits.length,0);await page.locator('#cancel-proof').click();assert(await page.locator('#visit').isDisabled());await page.locator('#proof').setInputFiles({name:'proof.png',mimeType:'image/png',buffer:png});await page.locator('#visit').click();await page.getByText('🍾 Besuch gespeichert.',{exact:true}).waitFor();assert.equal(visits.length,1);assert.equal(await page.locator('tbody tr td').last().innerText(),'1');
 await page.locator('[data-tab=Fotos]').click();await page.locator('[name=caption]').fill('<img src=x onerror=alert(1)>');await page.locator('[name=photo]').setInputFiles({name:'snow.png',mimeType:'image/png',buffer:png});await page.locator('#post').click();await page.getByText('Foto mit allen Mitgliedern geteilt.',{exact:true}).waitFor();assert.equal(posts.length,1);assert.equal(await page.locator('article strong').innerText(),'<img src=x onerror=alert(1)>');assert.equal(await page.locator('article strong img').count(),0);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);await page.screenshot({path:'/tmp/skidu-website.png',fullPage:true});await page.locator('#account').click();await page.getByRole('button',{name:'Anmelden',exact:true}).waitFor();assert.equal(await page.locator('article').count(),0);
 console.log('PASS: web login, GPS distance/speed, tour persistence, leaderboard, required proof, cancel, check-in, photo upload/feed, escaped captions, mobile layout, logout clearing data (mocked Supabase HTTP).');await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>server.kill());
