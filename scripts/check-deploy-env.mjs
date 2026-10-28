import { loadEnv } from 'vite';
const local = loadEnv('production', process.cwd(), 'VITE_');
const url=process.env.VITE_SUPABASE_URL ?? local.VITE_SUPABASE_URL,key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? local.VITE_SUPABASE_PUBLISHABLE_KEY;
if(!url||!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)||!key){console.error('Deployment requires VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY. Configure them in Vercel before deploying.');process.exit(1)}
if(key.startsWith('sb_secret_')){console.error('Use the public publishable key, never a secret key.');process.exit(1)}
if(key.split('.').length===3){try{if(JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()).role!=='anon')throw Error()}catch{console.error('Only an anon/public publishable key may be included in a browser build.');process.exit(1)}}
