'use strict';
const KEY='warenpilot-data-v1',CFG='warenpilot-cloud-v1';
const blank=()=>({products:[],warehouses:[{id:'main',name:'Hauptlager'}],categories:['Allgemein'],fields:[],movements:[],views:[],workflows:[]});
let db=load(), page='dashboard',config=JSON.parse(localStorage.getItem(CFG)||'{}'),session=null,scanStream=null;
function load(){try{return {...blank(),...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{return blank()}}
const id=()=>crypto.randomUUID(),esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function save(){localStorage.setItem(KEY,JSON.stringify(db));document.getElementById('syncState').textContent=session?'Ungesendet · synchronisieren':'Lokal gespeichert';render()}
function modal(html){document.getElementById('dialogContent').innerHTML=html;document.getElementById('dialog').showModal()}
function close(){stopScan();document.getElementById('dialog').close()}
function notice(s){alert(s)}
const qty=(p,w)=>db.movements.filter(m=>m.productId===p&&(w?m.warehouseId===w:true)).reduce((n,m)=>n+Number(m.delta),0);
const money=n=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(n||0);
const field=(name,label,value='',type='text',required=false)=>`<label>${esc(label)}<input name="${esc(name)}" type="${type}" value="${esc(value)}" ${required?'required':''}></label>`;
const sel=(name,label,opts,chosen='')=>`<label>${esc(label)}<select name="${esc(name)}">${opts.map(o=>`<option value="${esc(o.value)}" ${String(o.value)===String(chosen)?'selected':''}>${esc(o.label)}</option>`).join('')}</select></label>`;
const opt=a=>a.map(x=>({value:x.id,label:x.name}));
function formData(form){return Object.fromEntries(new FormData(form).entries())}
function button(text,act,cl='secondary'){return `<button class="${cl}" data-action="${act}">${text}</button>`}
const headings={dashboard:'Übersicht',products:'Artikel',warehouses:'Lagerorte',movements:'Buchungen',inventory:'Inventur',reports:'Auswertungen',designer:'Gestalten',settings:'Einstellungen'};
function render(){document.getElementById('nav').innerHTML=Object.entries(headings).map(([k,v])=>`<button data-page="${k}" class="${page===k?'active':''}">${v}</button>`).join('');document.getElementById('app').innerHTML=pages[page]();}
const pages={
 dashboard(){let value=db.products.reduce((s,p)=>s+qty(p.id)*Number(p.price||0),0);return `<div class="toolbar"><h1>Übersicht</h1>${button('+ Neuer Artikel','new-product','')}</div><div class="grid">${[['Artikel',db.products.length],['Lagerorte',db.warehouses.length],['Gesamtbestand',db.products.reduce((s,p)=>s+qty(p.id),0)],['Warenwert',money(value)]].map(([l,v])=>`<div class="card"><div class="muted">${l}</div><div class="metric">${esc(v)}</div></div>`).join('')}</div><div class="card"><h2>Schnellzugriff</h2><div class="actions">${button('Wareneingang','new-movement','')}${button('Warenausgang','new-movement')}${button('Inventur','inventory-page')}${button('Daten exportieren','export-json')}</div></div><div class="card"><h2>Letzte Buchungen</h2>${movementTable(db.movements.slice(-5).reverse())}</div>`},
 products(){return `<div class="toolbar"><h1>Artikel</h1>${button('+ Artikel erstellen','new-product','')}</div><div class="card"><label>Artikel suchen<input id="search" placeholder="Name, SKU, Barcode ..."></label></div><div class="card scroll"><table><thead><tr><th>Artikel</th><th>SKU / Barcode</th><th>Kategorie</th><th>Bestand</th><th>Preis</th><th>Aktionen</th></tr></thead><tbody id="productRows">${productRows()}</tbody></table></div>`},
 warehouses(){return `<div class="toolbar"><h1>Lagerorte</h1>${button('+ Lagerort','new-warehouse','')}</div><div class="card scroll"><table><tr><th>Lager</th><th>Artikelpositionen</th><th>Aktion</th></tr>${db.warehouses.map(w=>`<tr><td>${esc(w.name)}</td><td>${db.products.filter(p=>qty(p.id,w.id)!==0).length}</td><td>${button('Bearbeiten','edit-warehouse:'+w.id)}</td></tr>`).join('')}</table></div>`},
 movements(){return `<div class="toolbar"><h1>Wareneingang & Warenausgang</h1>${button('+ Buchung','new-movement','')}</div><div class="card scroll">${movementTable([...db.movements].reverse())}</div>`},
 inventory(){return `<div class="toolbar"><h1>Inventur</h1></div><div class="notice">Eine Inventur setzt den gezählten Bestand durch eine nachvollziehbare Korrekturbuchung.</div><div class="card"><form id="inventoryForm" class="fields">${sel('productId','Artikel',opt(db.products))}${sel('warehouseId','Lagerort',opt(db.warehouses))}${field('count','Gezählte Menge',0,'number',true)}<button>Bestand korrigieren</button></form></div>`},
 reports(){return `<div class="toolbar"><h1>Auswertungen & Export</h1><div class="actions">${button('Artikel-CSV','export-products')}${button('Buchungen-CSV','export-movements')}${button('Vollständige Sicherung (JSON)','export-json','')}</div></div><div class="card scroll"><h2>Bestände nach Artikel</h2><table><tr><th>Artikel</th><th>Bestand</th><th>Warenwert</th></tr>${db.products.map(p=>`<tr><td>${esc(p.name)}</td><td>${qty(p.id)}</td><td>${money(qty(p.id)*Number(p.price||0))}</td></tr>`).join('')}</table></div>`},
 designer(){return `<div class="toolbar"><h1>Selbst gestalten</h1></div><div class="two"><div class="card"><h2>Kategorien</h2><div class="actions">${db.categories.map(c=>`<span class="pill">${esc(c)}</span>`).join('')}</div><p>${button('+ Kategorie','new-category')}</p></div><div class="card"><h2>Eigene Artikelfelder</h2>${db.fields.map(f=>`<p>${esc(f.label)} <span class="pill">${esc(f.type)}</span> ${button('Löschen','delete-field:'+f.id)}</p>`).join('')}<p>${button('+ Feld','new-field')}</p></div><div class="card"><h2>Eigene Tabellenansichten</h2><p class="muted">Wähle sichtbare Artikelspalten.</p>${db.views.map(v=>`<p>${esc(v.name)} ${button('Öffnen','view:'+v.id)} ${button('Löschen','delete-view:'+v.id)}</p>`).join('')}${button('+ Ansicht','new-view')}</div><div class="card"><h2>Eigene Arbeitsabläufe</h2><p class="muted">Lege Buchungsvorlagen an, z. B. „Retoure“ oder „Verkauf“.</p>${db.workflows.map(w=>`<p>${esc(w.name)} (${w.delta>0?'+':''}${w.delta}) ${button('Ausführen','run-workflow:'+w.id)} ${button('Löschen','delete-workflow:'+w.id)}</p>`).join('')}${button('+ Ablauf','new-workflow')}</div></div>`},
 settings(){return `<div class="toolbar"><h1>Einstellungen & Synchronisierung</h1></div><div class="notice">Cloud ist optional. Daten liegen zunächst lokal auf diesem Gerät. Bei Synchronisierung gilt: Letzte Speicherung gewinnt. Gleichzeitige Änderungen auf mehreren Geräten können sich überschreiben.</div><div class="card"><h2>Supabase-Verbindung</h2><form id="cloudConfig" class="fields">${field('url','Projekt-URL (https://...supabase.co)',config.url||'','url',true)}${field('key','Publishable / anon key (niemals service_role!)',config.key||'','text',true)}<button>Verbindung speichern</button></form><p class="muted">Das Konto gehört dir. Keine Zugangsdaten in den Quellcode schreiben. Die SQL-Datei im Paket aktiviert Zugriffsschutz pro Benutzer.</p></div><div class="card"><h2>${session?'Angemeldet':'Anmelden / Konto erstellen'}</h2>${session?`<p>${esc(session.user.email)}</p><div class="actions">${button('Cloud-Daten laden','cloud-pull')}${button('Lokale Daten hochladen','cloud-push','')}${button('Abmelden','logout')}</div>`:`<form id="authForm" class="fields">${field('email','E-Mail','','email',true)}${field('password','Passwort (mindestens 6 Zeichen)','','password',true)}<div class="actions"><button name="mode" value="login">Anmelden</button><button name="mode" value="signup" class="secondary">Konto erstellen</button></div></form>`}</div><div class="card"><h2>Datensicherung</h2><div class="actions">${button('JSON exportieren','export-json')}${button('JSON importieren','import-json')}</div><input type="file" id="importFile" accept=".json,application/json" hidden><p class="muted">Vor einem Gerätewechsel zuerst exportieren oder synchronisieren.</p></div>`}
};
function productRows(search=''){return db.products.filter(p=>[p.name,p.sku,p.barcode].join(' ').toLowerCase().includes(search.toLowerCase())).map(p=>`<tr><td><b>${esc(p.name)}</b></td><td>${esc(p.sku)}<br><small>${esc(p.barcode)}</small></td><td>${esc(p.category)}</td><td>${qty(p.id)}</td><td>${money(p.price)}</td><td>${button('Bearbeiten','edit-product:'+p.id)} ${button('Buchen','book-product:'+p.id)}</td></tr>`).join('')||'<tr><td colspan="6" class="empty">Keine Artikel vorhanden</td></tr>'}
function movementTable(arr){return `<table><tr><th>Datum</th><th>Artikel</th><th>Lager</th><th>Menge</th><th>Grund</th></tr>${arr.map(m=>`<tr><td>${esc(new Date(m.date).toLocaleString('de-DE'))}</td><td>${esc(db.products.find(p=>p.id===m.productId)?.name||'Gelöscht')}</td><td>${esc(db.warehouses.find(w=>w.id===m.warehouseId)?.name||'Gelöscht')}</td><td>${m.delta>0?'+':''}${m.delta}</td><td>${esc(m.reason)}</td></tr>`).join('')}</table>`}
function productModal(p){p=p||{id:'',name:'',sku:'',barcode:'',category:db.categories[0],price:0,custom:{}};modal(`<h2>${p.id?'Artikel bearbeiten':'Neuer Artikel'}</h2><form id="productForm" class="fields"><input name="id" value="${esc(p.id)}" hidden>${field('name','Artikelname',p.name,'text',true)}${field('sku','Artikelnummer / SKU',p.sku)}${field('barcode','Barcode oder QR-Inhalt',p.barcode)}${button('📷 Barcode scannen','scan','secondary')}${sel('category','Kategorie',db.categories.map(c=>({value:c,label:c})),p.category)}${field('price','Einzelpreis in EUR',p.price,'number')}${db.fields.map(f=>field('custom_'+f.id,f.label,p.custom?.[f.id]||'',f.type)).join('')}<button>Artikel speichern</button></form><div id="scanner"></div>${p.id?button('Artikel löschen','delete-product:'+p.id,'danger'):''}`)}
function movementModal(productId='',delta=''){if(!db.products.length)return notice('Bitte zuerst einen Artikel erstellen.');modal(`<h2>Bestandsbuchung</h2><form id="movementForm" class="fields">${sel('productId','Artikel',opt(db.products),productId)}${sel('warehouseId','Lagerort',opt(db.warehouses))}${field('delta','Menge (+ Eingang, − Ausgang)',delta,'number',true)}${field('reason','Grund / Notiz','Wareneingang')}<button>Buchung speichern</button></form>`)}
function download(name,content,mime){const blob=new Blob([content],{type:mime});const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
const csv=(rows)=>rows.map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')).join('\r\n');
function exportFile(type){if(type==='json')return download('warenpilot-backup.json',JSON.stringify(db,null,2),'application/json');if(type==='products')return download('artikel.csv',csv([['Name','SKU','Barcode','Kategorie','Preis','Bestand'],...db.products.map(p=>[p.name,p.sku,p.barcode,p.category,p.price,qty(p.id)])]),'text/csv;charset=utf-8');download('buchungen.csv',csv([['Datum','Artikel-ID','Lager-ID','Menge','Grund'],...db.movements.map(m=>[m.date,m.productId,m.warehouseId,m.delta,m.reason])]),'text/csv;charset=utf-8')}
function addMovement(v){const delta=Number(v.delta);if(!Number.isFinite(delta)||delta===0)throw Error('Menge muss ungleich null sein.');if(!db.products.some(p=>p.id===v.productId)||!db.warehouses.some(w=>w.id===v.warehouseId))throw Error('Artikel oder Lagerort fehlt.');db.movements.push({id:id(),date:new Date().toISOString(),productId:v.productId,warehouseId:v.warehouseId,delta,reason:v.reason||'Buchung'})}
function handleAction(a){let [cmd,arg]=a.split(':');if(cmd==='new-product')productModal();if(cmd==='edit-product')productModal(db.products.find(p=>p.id===arg));if(cmd==='book-product')movementModal(arg);if(cmd==='new-movement')movementModal();if(cmd==='inventory-page'){page='inventory';render()}if(cmd==='new-warehouse'||cmd==='edit-warehouse'){let w=db.warehouses.find(x=>x.id===arg);modal(`<h2>Lagerort</h2><form id="warehouseForm" class="fields"><input name="id" value="${esc(w?.id||'')}" hidden>${field('name','Name',w?.name||'','text',true)}<button>Speichern</button></form>`)}if(cmd==='new-category')modal(`<h2>Kategorie hinzufügen</h2><form id="categoryForm" class="fields">${field('name','Name','','text',true)}<button>Speichern</button></form>`);if(cmd==='new-field')modal(`<h2>Eigenes Artikelfeld</h2><form id="fieldForm" class="fields">${field('label','Feldbezeichnung','','text',true)}${sel('type','Typ',[{value:'text',label:'Text'},{value:'number',label:'Zahl'},{value:'date',label:'Datum'}])}<button>Hinzufügen</button></form>`);if(cmd==='delete-field'){if(confirm('Feld und gespeicherte Feldwerte entfernen?')){db.fields=db.fields.filter(f=>f.id!==arg);db.products.forEach(p=>delete p.custom[arg]);save()}}if(cmd==='new-view')modal(`<h2>Neue Tabellenansicht</h2><form id="viewForm" class="fields">${field('name','Ansichtsname','','text',true)}${['name','sku','barcode','category','price','stock'].map(x=>`<label><input type="checkbox" name="columns" value="${x}" checked> ${x}</label>`).join('')}<button>Ansicht speichern</button></form>`);if(cmd==='view'){let v=db.views.find(x=>x.id===arg);modal(`<h2>${esc(v.name)}</h2><div class="scroll"><table><tr>${v.columns.map(c=>`<th>${esc(c)}</th>`).join('')}</tr>${db.products.map(p=>`<tr>${v.columns.map(c=>`<td>${esc(c==='stock'?qty(p.id):p[c])}</td>`).join('')}</tr>`).join('')}</table></div>`)}if(cmd==='delete-view'){db.views=db.views.filter(v=>v.id!==arg);save()}if(cmd==='new-workflow')modal(`<h2>Buchungsvorlage</h2><form id="workflowForm" class="fields">${field('name','Name (z. B. Retoure)','','text',true)}${field('delta','Standardmenge (+ / −)',1,'number',true)}<button>Speichern</button></form>`);if(cmd==='run-workflow'){let w=db.workflows.find(x=>x.id===arg);movementModal('',w.delta)}if(cmd==='delete-workflow'){db.workflows=db.workflows.filter(w=>w.id!==arg);save()}if(cmd==='delete-product'){if(confirm('Artikel löschen? Frühere Buchungen bleiben im Protokoll.')){db.products=db.products.filter(p=>p.id!==arg);close();save()}}if(cmd.startsWith('export-'))exportFile(cmd.slice(7));if(cmd==='import-json')document.getElementById('importFile').click();if(cmd==='scan')startScan();if(cmd==='cloud-pull')cloudPull();if(cmd==='cloud-push')cloudPush();if(cmd==='logout'){session=null;sessionStorage.removeItem('wp-session');render()}}
document.addEventListener('click',e=>{let b=e.target.closest('[data-page],[data-action]');if(!b)return;if(b.dataset.page){page=b.dataset.page;render()}else handleAction(b.dataset.action)});
document.addEventListener('input',e=>{if(e.target.id==='search')document.getElementById('productRows').innerHTML=productRows(e.target.value)});
document.addEventListener('submit',async e=>{const f=e.target;if(!f.id)return;e.preventDefault();let v=formData(f);try{if(f.id==='productForm'){let p=db.products.find(x=>x.id===v.id),custom={};db.fields.forEach(x=>custom[x.id]=v['custom_'+x.id]||'');let data={id:p?.id||id(),name:v.name.trim(),sku:v.sku,barcode:v.barcode,category:v.category,price:Number(v.price)||0,custom};if(p)Object.assign(p,data);else db.products.push(data);close();save()}if(f.id==='warehouseForm'){let w=db.warehouses.find(x=>x.id===v.id);if(w)w.name=v.name;else db.warehouses.push({id:id(),name:v.name});close();save()}if(f.id==='categoryForm'){if(!db.categories.includes(v.name))db.categories.push(v.name);close();save()}if(f.id==='fieldForm'){db.fields.push({id:id(),label:v.label,type:v.type});close();save()}if(f.id==='viewForm'){db.views.push({id:id(),name:v.name,columns:[...new FormData(f).getAll('columns')]});close();save()}if(f.id==='workflowForm'){db.workflows.push({id:id(),name:v.name,delta:Number(v.delta)});close();save()}if(f.id==='movementForm'){addMovement(v);close();save()}if(f.id==='inventoryForm'){let current=qty(v.productId,v.warehouseId),delta=Number(v.count)-current;if(delta)addMovement({...v,delta,reason:'Inventurkorrektur'});save();notice('Inventur erfasst.')}if(f.id==='cloudConfig'){let u=new URL(v.url);if(u.protocol!=='https:'||!u.hostname.endsWith('.supabase.co'))throw Error('Bitte gültige Supabase-Projekt-URL verwenden.');config={url:u.origin,key:v.key.trim()};localStorage.setItem(CFG,JSON.stringify(config));render();notice('Verbindung gespeichert.')}if(f.id==='authForm'){let mode=e.submitter?.value||'login';await authenticate(v.email,v.password,mode)}}catch(err){notice(err.message)}});
document.addEventListener('change',async e=>{if(e.target.id==='importFile'){let file=e.target.files[0];if(!file)return;try{let d=JSON.parse(await file.text());if(!Array.isArray(d.products)||!Array.isArray(d.movements)||!Array.isArray(d.warehouses))throw Error('Ungültige Sicherungsdatei');if(confirm('Alle lokalen Daten durch die Sicherung ersetzen?')){db={...blank(),...d};save()}}catch(err){notice(err.message)}}});
async function startScan(){if(!('BarcodeDetector'in window)||!navigator.mediaDevices?.getUserMedia){notice('Kamera-Barcode-Erkennung wird hier nicht unterstützt. Barcode bitte manuell eingeben.');return}try{scanStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});let box=document.getElementById('scanner');box.innerHTML='<video autoplay playsinline muted></video><p class="muted">Barcode vor die Kamera halten.</p>';let video=box.querySelector('video');video.srcObject=scanStream;let detector=new BarcodeDetector();let active=scanStream;async function tick(){if(scanStream!==active)return;try{let codes=await detector.detect(video);if(codes.length){document.querySelector('[name=barcode]').value=codes[0].rawValue;stopScan();box.textContent='Code erkannt: '+codes[0].rawValue;return}}catch{}setTimeout(tick,350)}tick()}catch(err){notice('Kamera konnte nicht geöffnet werden: '+err.message)}}
function stopScan(){if(scanStream){scanStream.getTracks().forEach(t=>t.stop());scanStream=null}}
document.getElementById('dialog').addEventListener('close',stopScan);
function api(path,options={}){if(!config.url||!config.key)throw Error('Bitte zuerst Supabase-Projekt-URL und Publishable Key speichern.');return fetch(config.url+path,{...options,headers:{apikey:config.key,'Content-Type':'application/json',...(session?{Authorization:'Bearer '+session.access_token}:{}),...(options.headers||{})}}).then(async r=>{let t=await r.text(),d=t?JSON.parse(t):null;if(!r.ok)throw Error(d?.msg||d?.message||d?.error_description||'Cloud-Fehler '+r.status);return d})}
async function authenticate(email,password,mode){if(mode==='signup'){await api('/auth/v1/signup',{method:'POST',body:JSON.stringify({email,password})});notice('Konto angelegt. Falls E-Mail-Bestätigung aktiv ist, bitte die E-Mail bestätigen und danach anmelden.');return}session=await api('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})});sessionStorage.setItem('wp-session',JSON.stringify(session));render();notice('Angemeldet. Wähle „Cloud-Daten laden“ oder „Lokale Daten hochladen“.')}
async function cloudPull(){try{let rows=await api('/rest/v1/user_documents?select=content&limit=1');if(!rows.length)return notice('In der Cloud sind noch keine Daten. Nutze „Lokale Daten hochladen“.');if(!confirm('Lokale Daten mit dem Cloud-Stand überschreiben?'))return;db={...blank(),...rows[0].content};save();document.getElementById('syncState').textContent='Cloud geladen';notice('Cloud-Daten geladen.')}catch(e){notice(e.message)}}
async function cloudPush(){try{if(!confirm('Cloud-Daten mit dem aktuellen lokalen Stand überschreiben?'))return;await api('/rest/v1/user_documents?on_conflict=user_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({user_id:session.user.id,content:db,updated_at:new Date().toISOString()})});document.getElementById('syncState').textContent='Cloud gespeichert';notice('Cloud-Daten gespeichert. Auf anderen Geräten bitte „Cloud-Daten laden“ wählen.')}catch(e){notice(e.message)}}
try{session=JSON.parse(sessionStorage.getItem('wp-session')||'null')}catch{};
if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});
render();


document.addEventListener('click', function(e) {
  const b = e.target.closest('button');
  if (!b || b.textContent.trim() !== 'Artikel speichern') return;
  e.preventDefault();
  e.stopImmediatePropagation();

  const d = document.getElementById('dialogContent');
  const get = n => d.querySelector('[name="' + n + '"]')?.value || '';
  if (!get('name').trim()) {
    alert('Bitte Artikelname eingeben');
    return;
  }

  const old = db.products.find(p => p.id === get('id'));
  const custom = {};
  db.fields.forEach(f => custom[f.id] = get('custom_' + f.id));
  const data = {
    id: old?.id || id(),
    name: get('name').trim(),
    sku: get('sku'),
    barcode: get('barcode'),
    category: get('category'),
    price: Number(get('price')) || 0,
    custom: custom
  };

  if (old) Object.assign(old, data);
  else db.products.push(data);
  close();
  save();
}, true);

const originalProductModal = productModal;

productModal = function(p) {
  originalProductModal(p);

  const dialog = document.getElementById('dialogContent');
  const form = dialog.querySelector('#productForm');
  if (!form) return;

  for (const name of ['sku', 'barcode']) {
    const input = form.querySelector(`[name="${name}"]`);
    if (input) {
      const wrapper = input.closest('label');
      if (wrapper) wrapper.style.display = 'none';
      else input.style.display = 'none';
    }
  }

  dialog.querySelectorAll('button').forEach(button => {
    if (button.textContent.includes('Barcode scannen')) {
      button.style.display = 'none';
    }
  });
};
  
