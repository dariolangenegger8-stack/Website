import React, { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Tour = { date: string; km: number; ascent: number; minutes: number; maxSpeed?: number };
type Photo = { uri: string; caption: string; date: string };
type ApresVisit = { id: string; date: string; proofUri: string };
type Data = { tours: Tour[]; photos: Photo[]; apres: ApresVisit[] };
const KEY = 'skidu ell-v1'.replace(' ', '');
const distance = (a: Location.LocationObject, b: Location.LocationObject) => {
  const rad = (n: number) => n * Math.PI / 180;
  const lat = rad(b.coords.latitude - a.coords.latitude), lon = rad(b.coords.longitude - a.coords.longitude);
  const h = Math.sin(lat / 2) ** 2 + Math.cos(rad(a.coords.latitude)) * Math.cos(rad(b.coords.latitude)) * Math.sin(lon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
};
export default function App() {
  const [tab, setTab] = useState('Berg');
  const [data, setData] = useState<Data>({ tours: [], photos: [], apres: [] });
  const [loaded, setLoaded] = useState(false);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [km, setKm] = useState(0);
  const [ascent, setAscent] = useState(0);
  const [maxSpeed, setMaxSpeed] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [caption, setCaption] = useState('');
  const [ranking, setRanking] = useState<'ski' | 'apres'>('ski');
  const [proof, setProof] = useState<string | null>(null);
  const watcher = useRef<Location.LocationSubscription | null>(null);
  const previous = useRef<Location.LocationObject | null>(null);
  const started = useRef(0);
  const alive = useRef(true);
  useEffect(() => {
    AsyncStorage.getItem(KEY).then(raw => { if (raw) { const parsed = JSON.parse(raw); if (!Array.isArray(parsed.tours) || !Array.isArray(parsed.photos)) throw Error(); setData({ tours: parsed.tours, photos: parsed.photos, apres: Array.isArray(parsed.apres) ? parsed.apres : [] }); } setLoaded(true); }).catch(() => Alert.alert('Speicher nicht verfügbar', 'Bitte starte die App neu. Deine vorhandenen Daten werden nicht überschrieben.'));
    return () => { alive.current = false; watcher.current?.remove(); };
  }, []);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - started.current) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [active]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => { if (state !== 'active') previous.current = null; });
    return () => sub.remove();
  }, []);
  async function save(next: Data) {
    try { await AsyncStorage.setItem(KEY, JSON.stringify(next)); setData(next); return true; }
    catch { Alert.alert('Nicht gespeichert', 'Dein Gerätespeicher ist momentan nicht verfügbar. Versuche es erneut.'); return false; }
  }
  async function start() {
    if (!loaded || busy) return;
    setBusy(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') { Alert.alert('Standort benötigt', 'Erlaube den Standort in den Einstellungen, um deine Tour aufzuzeichnen.'); return; }
      if (!await Location.hasServicesEnabledAsync()) { Alert.alert('GPS deaktiviert', 'Aktiviere die Standortdienste auf deinem Handy.'); return; }
      previous.current = null;
      const subscription = await Location.watchPositionAsync({ accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 5, timeInterval: 2000 }, point => {
        if ((point.coords.accuracy ?? Infinity) > 30) return;
        const last = previous.current;
        if (last) {
          const delta = distance(last, point), dt = (point.timestamp - last.timestamp) / 1000;
          if (dt > 0 && dt < 30 && delta / dt < 0.06 && delta > 0.003) {
            setKm(n => n + delta);
            // GPS speed is in m/s. Reject missing values and implausible samples.
            const speed = point.coords.speed;
            if (speed !== null && Number.isFinite(speed) && speed >= 0 && speed <= 60) {
              setMaxSpeed(n => Math.max(n, speed * 3.6));
            }
            const gain = (point.coords.altitude ?? 0) - (last.coords.altitude ?? 0);
            if (last.coords.altitude !== null && point.coords.altitude !== null && gain > 3 && gain < 50) setAscent(n => n + gain);
          }
        }
        previous.current = point;
      });
      if (!alive.current) { subscription.remove(); return; }
      watcher.current = subscription; setKm(0); setMaxSpeed(0); setAscent(0); setSeconds(0); started.current = Date.now(); setActive(true);
    } catch { Alert.alert('GPS nicht verfügbar', 'Die Aufnahme konnte nicht gestartet werden. Bitte versuche es erneut.'); }
    finally { setBusy(false); }
  }
  async function stop() {
    if (busy) return;
    setBusy(true); watcher.current?.remove(); watcher.current = null;
    const minutes = (Date.now() - started.current) / 60000;
    const ok = await save({ ...data, tours: [...data.tours, { date: new Date().toISOString(), km, ascent: Math.round(ascent), minutes, maxSpeed }] });
    setActive(false); setBusy(false);
    if (!ok) Alert.alert('Tour nicht gespeichert', 'Die Aufnahme ist beendet. Die letzten Messwerte bleiben auf dem Bildschirm sichtbar.');
  }
  async function photo() {
    if (!loaded || busy) return;
    setBusy(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
      if (!result.canceled) await save({ ...data, photos: [{ uri: result.assets[0].uri, caption: caption.trim() || 'Ein Moment am Berg', date: new Date().toISOString() }, ...data.photos] });
      if (!result.canceled) setCaption('');
    } catch { Alert.alert('Foto nicht verfügbar', 'Das Foto konnte nicht ausgewählt werden.'); }
    finally { setBusy(false); }
  }
  async function chooseProof() {
    if (busy || !loaded) return;
    setBusy(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (!result.canceled) setProof(result.assets[0].uri);
    } catch { Alert.alert('Foto nicht verfügbar', 'Bitte wähle dein Beweisfoto erneut aus.'); }
    finally { setBusy(false); }
  }
  async function checkIn() {
    if (!proof || busy || !loaded) return;
    setBusy(true);
    let destination: string | null = null;
    try {
      if (!FileSystem.documentDirectory) throw Error('Kein Dokumentenspeicher');
      const directory = FileSystem.documentDirectory + 'apres-proofs/';
      await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
      const id = Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8);
      destination = directory + id + '.jpg';
      await FileSystem.copyAsync({ from: proof, to: destination });
      const ok = await save({ ...data, apres: [{ id, date: new Date().toISOString(), proofUri: destination }, ...data.apres] });
      if (ok) { setProof(null); destination = null; }
    } catch { Alert.alert('Check-in nicht gespeichert', 'Dein Beweisfoto konnte nicht gespeichert werden. Bitte versuche es erneut.'); }
    finally {
      if (destination) await FileSystem.deleteAsync(destination, { idempotent: true }).catch(() => {});
      setBusy(false);
    }
  }
  const total = data.tours.reduce((sum, t) => sum + t.km, 0);
  const bestSpeed = data.tours.reduce((best, t) => Math.max(best, t.maxSpeed ?? 0), 0);
  const hasSpeed = data.tours.some(t => (t.maxSpeed ?? 0) > 0);
  const days = new Set(data.tours.map(t => new Date(t.date).toLocaleDateString())).size;
  return <SafeAreaView style={s.root}><StatusBar style="light"/><ScrollView contentContainerStyle={s.content}>
    <View style={s.header}><Text style={s.brand}>◭ SKIDUELL</Text><View style={s.profile}><Text style={s.profileText}>DU</Text></View></View>
    {tab !== 'Duell' && <Text style={s.eyebrow}>THE MOUNTAIN IS YOUR PLAYGROUND</Text>}
    <Text style={s.title}>{tab === 'Berg' ? 'Der Berg ruft.' : tab === 'Duell' ? 'Deine Crew. Dein Ranking.' : 'Momente im Schnee.'}</Text>
    {tab !== 'Duell' && <Text style={s.muted}>{tab === 'Berg' ? 'Mach aus jedem Skitag eine Geschichte.' : 'Für die Aussicht lohnt sich jeder Schwung.'}</Text>}
    {tab === 'Berg' && <>
      <View style={s.hero}><Text style={s.mountain}>◭</Text><Text style={s.eyebrow}>DEINE AKTUELLE TOUR</Text><Text style={s.big}>{km.toFixed(2)} <Text style={s.unit}>km</Text></Text><View style={s.row}><Text style={s.metric}>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}  Zeit</Text><Text style={s.metric}>↗ {Math.round(ascent)} m Aufstieg</Text></View><Text style={s.metric}>Max. Speed: {maxSpeed > 0 ? maxSpeed.toFixed(1) + ' km/h' : '–'}</Text><Text style={s.note}>GPS erfasst Bewegung inklusive Liftfahrten. Aufnahme nur bei geöffneter App; Höhenmeter sind Näherungswerte.</Text><Pressable disabled={busy || !loaded} style={[s.button, (busy || !loaded) && { opacity: 0.5 }]} onPress={active ? stop : start}><Text style={s.buttonText}>{busy ? 'Bitte warten …' : active ? '■  Tour beenden & speichern' : '●  Tour starten'}</Text></Pressable></View>
      <Text style={s.section}>Deine Saison</Text><View style={s.row}><View style={s.stat}><Text style={s.statNumber}>{days}</Text><Text style={s.muted}>Skitage</Text></View><View style={s.stat}><Text style={s.statNumber}>{total.toFixed(1)}</Text><Text style={s.muted}>Kilometer</Text></View><View style={s.stat}><Text style={s.statNumber}>{data.tours.length}</Text><Text style={s.muted}>Touren</Text></View></View>
      <Text style={s.section}>Letzte Touren</Text>{data.tours.length === 0 ? <Text style={s.note}>Noch keine Spuren. Starte deine erste Tour am Berg.</Text> : [...data.tours].reverse().map((t, i) => <View key={i} style={s.card}><Text style={s.white}>{new Date(t.date).toLocaleDateString('de-CH')} · {t.km.toFixed(2)} km</Text><Text style={s.muted}>{Math.round(t.minutes)} Min. · {t.ascent} m Aufstieg</Text></View>)}
    </>}
    {tab === 'Duell' && <View style={s.rankingArea}><View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={s.pattern}>{Array.from({ length: 18 }, (_, i) => <Text key={i} style={[s.patternIcon, { left: `${(i * 37 + 4) % 87}%`, top: 18 + i * 55, transform: [{ rotate: `${i % 2 ? 22 : -22}deg` }] }]}>{ranking === 'ski' ? '🎿' : '🍾'}</Text>)}</View>
      <View style={s.switcher}>{(['ski', 'apres'] as const).map(value => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: ranking === value }} style={[s.switchButton, ranking === value && s.switchActive]} onPress={() => setRanking(value)}><Text style={[s.switchText, ranking === value && s.switchSelected]}>{value === 'ski' ? '🎿  Ski-Rangliste' : '🍾  Après-Ski'}</Text></Pressable>)}</View>
      {ranking === 'ski' ? <View style={[s.card, s.rankingCard]}><Text style={s.section}>Deine Bestleistungen</Text><View style={s.tableHeader}><Text style={[s.tableLabel, { flex: 1 }]}>RANG / NAME</Text><Text style={s.tableLabel}>KM GESAMT</Text><Text style={s.tableLabel}>MAX. KM/H</Text></View><View style={s.tableRow}><Text style={[s.white, { flex: 1 }]}>01  Du</Text><Text style={s.tableValue}>{total.toFixed(1)}</Text><Text style={s.tableValue}>{hasSpeed ? bestSpeed.toFixed(1) : '–'}</Text></View></View> : <>
        <View style={[s.card, s.rankingCard]}><Text style={s.section}>🍾 Après-Ski</Text><View style={s.tableHeader}><Text style={[s.tableLabel, { flex: 1 }]}>RANG / NAME</Text><Text style={s.tableLabel}>BESUCHE 🍾</Text></View><View style={s.tableRow}><Text style={[s.white, { flex: 1 }]}>01  Du</Text><Text style={s.apresValue}>{data.apres.length}</Text></View></View>
        <View style={s.card}><Text style={s.white}>🍾 Ich war beim Après-Ski</Text>{proof && <Image source={{ uri: proof }} style={s.photo} accessibilityLabel="Ausgewähltes Beweisfoto"/>}<Pressable disabled={busy || !loaded} style={[s.outlineButton, (busy || !loaded) && { opacity: 0.5 }]} onPress={chooseProof}><Text style={s.white}>{proof ? 'Beweisfoto wechseln' : '+ Beweisfoto hinzufügen'}</Text></Pressable><Pressable accessibilityState={{ disabled: !proof || busy || !loaded }} disabled={!proof || busy || !loaded} style={[s.apresButton, (!proof || busy || !loaded) && { opacity: 0.4 }]} onPress={checkIn}><Text style={s.buttonText}>{busy ? 'Bitte warten …' : '🍾 Besuch speichern'}</Text></Pressable>{proof && <Pressable disabled={busy} onPress={() => setProof(null)}><Text style={s.cancel}>Abbrechen</Text></Pressable>}</View>
        <Text style={s.section}>Deine Après-Momente</Text>{data.apres.length === 0 ? <Text style={s.muted}>Noch keine Besuche</Text> : data.apres.map(visit => <View key={visit.id} style={s.card}><Image source={{ uri: visit.proofUri }} style={s.photo} accessibilityLabel="Gespeichertes Après-Ski-Beweisfoto"/><Text style={s.white}>🍾 Après-Ski · {new Date(visit.date).toLocaleDateString('de-CH')}</Text></View>)}
      </>}
    </View>}
    {tab === 'Fotos' && <><View style={s.card}><Text style={s.white}>Dein Bergalbum</Text><Text style={s.note}>Fotos bleiben lokal auf diesem Gerät. Öffentliches Teilen ist in dieser ersten Version noch nicht verbunden. Ausgewählte Fotos können bei einer Bereinigung des App-Caches verloren gehen.</Text><TextInput style={s.input} placeholder="Was war dein Highlight?" placeholderTextColor="#819399" value={caption} onChangeText={setCaption} maxLength={180}/><Pressable disabled={busy || !loaded} style={s.button} onPress={photo}><Text style={s.buttonText}>{busy ? 'Bitte warten …' : '+  Foto auswählen'}</Text></Pressable></View>{data.photos.map((p, i) => <View key={i} style={s.card}><Image source={{uri:p.uri}} style={s.photo}/><Text style={s.white}>{p.caption}</Text><Text style={s.note}>{new Date(p.date).toLocaleDateString('de-CH')} · Nur für dich</Text></View>)}</>}
    {tab !== 'Duell' && <Text style={s.footer}>Fahr mit Köpfchen. Bediene die App nur im Stillstand.</Text>}
    </ScrollView><View style={s.nav}>{['Berg','Duell','Fotos'].map((t, i) => <Pressable key={t} onPress={() => setTab(t)} style={s.navItem}><Text style={[s.navIcon,tab === t && s.selected]}>{['◭','⚑','▧'][i]}</Text><Text style={[s.muted,tab === t && s.selected]}>{t}</Text></Pressable>)}</View></SafeAreaView>;
}
const s = StyleSheet.create({
  rankingCard:{backgroundColor:'rgba(17,30,50,0.82)'},rankingArea:{position:'relative',paddingBottom:24},pattern:{...StyleSheet.absoluteFillObject,overflow:'hidden'},patternIcon:{position:'absolute',fontSize:25,opacity:0.11},
  profile:{width:38,height:38,borderRadius:19,backgroundColor:'#bbff72',alignItems:'center',justifyContent:'center'},profileText:{color:'#13251d',fontWeight:'900',fontSize:12},
  switcher:{flexDirection:'row',padding:5,borderRadius:18,backgroundColor:'#152238',marginTop:24,gap:4},switchButton:{flex:1,paddingVertical:14,alignItems:'center',borderRadius:13},switchActive:{backgroundColor:'#bbff72'},switchText:{color:'#9bafb6',fontWeight:'700',fontSize:13},switchSelected:{color:'#13251d'},
  tableHeader:{flexDirection:'row',gap:12,paddingVertical:14,borderBottomWidth:1,borderBottomColor:'#2b3c55',alignItems:'center'},tableLabel:{fontSize:9,color:'#91a3be',letterSpacing:0.5,width:75,textAlign:'right'},tableRow:{flexDirection:'row',gap:12,alignItems:'center',paddingVertical:20},tableValue:{color:'#bbff72',fontSize:22,fontWeight:'800',width:75,textAlign:'right'},apresValue:{color:'#f5bc82',fontSize:30,fontWeight:'900',width:75,textAlign:'right'},
  outlineButton:{padding:16,borderRadius:14,borderWidth:1,borderColor:'#5e728d',alignItems:'center'},apresButton:{backgroundColor:'#f5bc82',padding:17,borderRadius:14,alignItems:'center',marginTop:12},cancel:{color:'#a4b5ca',textAlign:'center',paddingTop:18},
root:{flex:1,backgroundColor:'#080e19'},content:{padding:24,paddingTop:24,paddingBottom:36},header:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:38},brand:{color:'#fff',fontSize:19,fontWeight:'900',letterSpacing:2},badge:{color:'#bbff72',fontSize:9,letterSpacing:1},eyebrow:{color:'#bbff72',fontSize:11,fontWeight:'700',letterSpacing:2,marginBottom:12},title:{color:'#fff',fontSize:38,fontWeight:'800',letterSpacing:-1,marginBottom:10},muted:{color:'#9bafb6',fontSize:13,lineHeight:21},hero:{backgroundColor:'#172943',padding:24,borderRadius:24,marginTop:26,overflow:'hidden'},mountain:{position:'absolute',right:10,top:-38,fontSize:210,color:'#26434b'},big:{fontSize:64,color:'#fff',fontWeight:'800',marginVertical:14},unit:{fontSize:22,color:'#b8c9ce'},row:{flexDirection:'row',gap:12,justifyContent:'space-between'},metric:{fontSize:13,color:'#d4e2e6'},note:{color:'#9bafb6',fontSize:12,lineHeight:19,marginVertical:12},button:{backgroundColor:'#b7f568',padding:17,borderRadius:14,alignItems:'center',marginTop:10},buttonText:{color:'#13251d',fontWeight:'800',fontSize:15},section:{fontSize:20,color:'#fff',fontWeight:'700',marginTop:28,marginBottom:16},stat:{flex:1,backgroundColor:'#111e32',padding:15,borderRadius:18},statNumber:{fontSize:28,fontWeight:'800',color:'#fff',marginBottom:5},card:{backgroundColor:'#111e32',padding:20,borderRadius:24,marginTop:16,borderWidth:1,borderColor:'#26344b'},white:{fontSize:16,color:'#fff',fontWeight:'600',lineHeight:24},input:{borderWidth:1,borderColor:'#34505a',color:'#fff',borderRadius:10,padding:14,marginVertical:10},photo:{width:'100%',height:270,borderRadius:12,marginBottom:16},footer:{color:'#69838d',fontSize:11,textAlign:'center',marginTop:32},nav:{flexDirection:'row',borderTopWidth:1,borderTopColor:'#25404a',paddingVertical:12,backgroundColor:'#0c1626'},navItem:{flex:1,alignItems:'center',gap:3},navIcon:{fontSize:25,color:'#9bafb6'},selected:{color:'#bbff72'}});
