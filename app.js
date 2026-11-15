'use strict';
const KEY='warenpilot-data-v1',CFG='warenpilot-cloud-v1';
const blank=()=>({products:[],warehouses:[{id:'main',name:'Hauptlager'}],categories:['Allgemein'],fields:[],movements:[],views:[],workflows:[],usageLog:[],annualUsage:[]});
const CLOUD_URL='https://gkuqlmowzpvklhdkblpl.supabase.co';
const CLOUD_KEY="sb_publishable_jU8rAk-DsuRUDJAwy7sGwA_rdyRt8EI"; // Öffentlicher, für Browser vorgesehener Supabase-Schlüssel.
let db=load(),page='dashboard',config={url:CLOUD_URL,key:CLOUD_KEY},session=null,scanStream=null;
let shared=null,shareDirty=false,shareBusy=false,shareConflict=false,shareStarting=false;
function load(){try{return {...blank(),...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{return blank()}}
const id=()=>crypto.randomUUID(),esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function save(){
  localStorage.setItem(KEY,JSON.stringify(db));
  if(shared){
    shareDirty=true;
    document.getElementById('syncState').textContent='Gemeinsam · Speichern …';
    void flushShared();
  }else{
    document.getElementById('syncState').textContent='Lokal gespeichert';
  }
  render();
}
function modal(html){document.getElementById('dialogContent').innerHTML=html;document.getElementById('dialog').showModal()}
function close(){stopScan();document.getElementById('dialog').close()}
function notice(s){alert(s)}
// Neuer Bestand wird direkt am Artikel gespeichert. Ältere Daten bleiben lesbar.
function qty(productId,warehouseId){
  const product=db.products.find(p=>String(p.id)===String(productId));
  const mainId=db.warehouses?.[0]?.id;
  const mainOnly=warehouseId===undefined||warehouseId===null||String(warehouseId)===String(mainId);
  const stock=product?.stock;
  if(stock!==undefined&&stock!==null&&stock!==''&&Number.isFinite(Number(stock))&&Number(stock)>=0){
    if(mainOnly)return Number(stock);
    return 0;
  }
  const movements=(db.movements||[]).filter(m=>String(m.productId)===String(productId));
  if(movements.length){
    return movements.filter(m=>warehouseId===undefined||warehouseId===null||String(m.warehouseId)===String(warehouseId))
      .reduce((n,m)=>n+(Number(m.delta)||0),0);
  }
  if(!product||!mainOnly)return 0;
  const countField=db.fields.find(f=>String(f.label||'').trim().toLowerCase()==='stück');
  const oldValue=countField?product.custom?.[countField.id]:undefined;
  return oldValue!==undefined&&oldValue!==''&&Number.isFinite(Number(oldValue))&&Number(oldValue)>=0
    ?Number(oldValue):0;
}
const money=n=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(n||0);
const field=(name,label,value='',type='text',required=false)=>`<label>${esc(label)}<input name="${esc(name)}" type="${type}" ${type==='number'?'step="any"':''} value="${esc(value)}" ${required?'required':''}></label>`;
const sel=(name,label,opts,chosen='')=>`<label>${esc(label)}<select name="${esc(name)}">${opts.map(o=>`<option value="${esc(o.value)}" ${String(o.value)===String(chosen)?'selected':''}>${esc(o.label)}</option>`).join('')}</select></label>`;
const opt=a=>a.map(x=>({value:x.id,label:x.name}));
function formData(form){return Object.fromEntries(new FormData(form).entries())}
function button(text,act,cl='secondary'){return `<button class="${cl}" data-action="${act}">${text}</button>`}
const headings={dashboard:'Übersicht',products:'Artikel',movements:'Buchungen',reports:'Auswertungen',designer:'Gestalten',settings:'Einstellungen'};
function render(){document.getElementById('nav').innerHTML=Object.entries(headings).map(([k,v])=>`<button data-page="${k}" class="${page===k?'active':''}">${v}</button>`).join('');document.getElementById('app').innerHTML=pages[page]();}
const pages={
 dashboard(){
  const kaufjahrFeld=db.fields.find(f=>String(f.label||'').trim().toLowerCase()==='kaufjahr');
  const diesesJahr=new Date().getFullYear();
  const auswahl=Number(sessionStorage.getItem('warenpilot-ausgaben-jahr')||diesesJahr);
  const jahre=Array.from({length:Math.max(diesesJahr+5,auswahl,2024)-2024+1},(_,i)=>2024+i);
  const jahreswert=db.products.reduce((sum,p)=>{
    if(!kaufjahrFeld||Number(p.custom?.[kaufjahrFeld.id])!==auswahl)return sum;
    return sum+(Number(p.price)||0);
  },0);
  return `<div class="toolbar"><h1>Übersicht</h1>${button('+ Neuer Artikel','new-product','')}</div>
    <div class="grid">
      <div class="card"><div class="muted">Artikel</div><div class="metric">${db.products.length}</div></div>
      <div class="card">
        <label>Einkaufsjahr
          <select id="ausgabenJahr">${jahre.map(y=>`<option value="${y}" ${y===auswahl?'selected':''}>${y}</option>`).join('')}</select>
        </label>
        <div class="muted">Einkaufskosten ${auswahl}</div>
        <div class="metric">${money(jahreswert)}</div>
      </div>
    </div>
    <div class="card"><h2>Schnellzugriff</h2><div class="actions">${button('Einkäufe pro Artikel','purchases-page')}${button('Daten exportieren','export-json')}</div></div>`;
 },

 products(){return `<div class="toolbar"><h1>Artikel</h1>${button('+ Artikel erstellen','new-product','')}</div><div class="card"><label>Artikel suchen<input id="search" placeholder="Name, SKU, Barcode ..."></label></div><div class="card scroll"><table><thead><tr><th>Artikel</th><th>SKU / Barcode</th><th>Kategorie</th><th>Bestand</th><th>Preis</th><th>Aktionen</th></tr></thead><tbody id="productRows">${productRows()}</tbody></table></div>`},
 warehouses(){return `<div class="toolbar"><h1>Lagerorte</h1>${button('+ Lagerort','new-warehouse','')}</div><div class="card scroll"><table><tr><th>Lager</th><th>Artikelpositionen</th><th>Aktion</th></tr>${db.warehouses.map(w=>`<tr><td>${esc(w.name)}</td><td>${db.products.filter(p=>qty(p.id,w.id)!==0).length}</td><td>${button('Bearbeiten','edit-warehouse:'+w.id)}</td></tr>`).join('')}</table></div>`},
 movements(){return `<div class="toolbar"><h1>Wareneingang & Warenausgang</h1>${button('+ Buchung','new-movement','')}</div><div class="card scroll">${movementTable([...db.movements].reverse())}</div>`},
 inventory(){return `<div class="toolbar"><h1>Inventur</h1></div><div class="notice">Eine Inventur setzt den gezählten Bestand durch eine nachvollziehbare Korrekturbuchung.</div><div class="card"><form id="inventoryForm" class="fields">${sel('productId','Artikel',opt(db.products))}${sel('warehouseId','Lagerort',opt(db.warehouses))}${field('count','Gezählte Menge',0,'number',true)}<button>Bestand korrigieren</button></form></div>`},
 reports(){return `<div class="toolbar"><h1>Auswertungen & Export</h1><div class="actions">${button('Artikel-CSV','export-products')}${button('Vollständige Sicherung (JSON)','export-json','')}</div></div><div class="card scroll"><h2>Bestände nach Artikel</h2><table><tr><th>Artikel</th><th>Bestand</th><th>Warenwert</th></tr>${db.products.map(p=>`<tr><td>${esc(p.name)}</td><td>${qty(p.id)}</td><td>${money(qty(p.id)*Number(p.price||0))}</td></tr>`).join('')}</table></div>`},
 designer(){return `<div class="toolbar"><h1>Selbst gestalten</h1></div><div class="two"><div class="card"><h2>Kategorien</h2><div class="actions">${db.categories.map(c=>`<span class="pill">${esc(c)}</span>`).join('')}</div><p>${button('+ Kategorie','new-category')}</p></div><div class="card"><h2>Eigene Artikelfelder</h2>${db.fields.map(f=>`<p>${esc(f.label)} <span class="pill">${esc(f.type)}</span> ${button('Löschen','delete-field:'+f.id)}</p>`).join('')}<p>${button('+ Feld','new-field')}</p></div><div class="card"><h2>Eigene Tabellenansichten</h2><p class="muted">Wähle sichtbare Artikelspalten.</p>${db.views.map(v=>`<p>${esc(v.name)} ${button('Öffnen','view:'+v.id)} ${button('Löschen','delete-view:'+v.id)}</p>`).join('')}${button('+ Ansicht','new-view')}</div><div class="card"><h2>Eigene Arbeitsabläufe</h2><p class="muted">Lege Buchungsvorlagen an, z. B. „Retoure“ oder „Verkauf“.</p>${db.workflows.map(w=>`<p>${esc(w.name)} (${w.delta>0?'+':''}${w.delta}) ${button('Ausführen','run-workflow:'+w.id)} ${button('Löschen','delete-workflow:'+w.id)}</p>`).join('')}${button('+ Ablauf','new-workflow')}</div></div>`},
 settings(){
  const invitation=inviteFromUrl();
  return `<div class="toolbar"><h1>Einstellungen</h1></div>
    <div class="card">
      <h2>Gemeinsame Burgpraxis 💙</h2>
      <p>${shared?'Verbunden mit der gemeinsamen Burgpraxis. Änderungen werden automatisch gesichert.':'Deine Artikel sind weiterhin auf deinem Handy gespeichert, bis du die gemeinsame Burgpraxis selbst startest.'}</p>
      ${!session?'<p>Bitte einmal anmelden. Danach bleibt dein Zugang gespeichert.</p>':''}
      ${session?'<p class="muted">Angemeldet: '+esc(session.user?.email||'')+'</p>':''}
      ${session&&shared?'<p class="muted">Status: '+(shareConflict?'Änderungen müssen geprüft werden':shareDirty?'Lokale Änderungen noch nicht synchronisiert':'Gemeinsam synchronisiert')+'</p>':''}
      <div class="actions">
        ${session&&!shared&&!invitation?button('Gemeinsam starten','shared-start'):''}
        ${session&&shared&&String(shared.ownerId)===String(session.user?.id)?button('Partner einladen','shared-invite'):''}
        ${session&&invitation&&!shared?button('Einladung annehmen','shared-join'):''}
        ${session&&shared?button('Aktuellen Stand laden','shared-reload'):''}
      </div>
      ${invitation&&!shared?'<p>Du hast einen Einladungslink erhalten. Melde dich mit deinem eigenen Konto an und tippe auf „Einladung annehmen“.</p>':''}
      ${shareConflict?'<p>Die andere Person hat zwischenzeitlich etwas geändert. Deine lokalen Änderungen wurden NICHT überschrieben. Bitte zuerst JSON exportieren, bevor du die neuesten Cloud-Daten lädst.</p>':''}
      <p class="muted">Bei gleichzeitiger Bearbeitung werden Änderungen nicht heimlich überschrieben. Falls ein Konflikt entsteht, bleibt deine lokale Version erhalten.</p>
    </div>
    ${session?'':`<div class="card"><h2>Anmelden oder Konto erstellen</h2>
      <form id="authForm" class="fields">
        ${field('email','E-Mail','','email',true)}
        ${field('password','Passwort (mindestens 6 Zeichen)','','password',true)}
        <div class="actions"><button name="mode" value="login">Anmelden</button><button name="mode" value="signup" class="secondary">Konto erstellen</button></div>
      </form>
      <p class="muted">Bei der ersten Anmeldung kann eine Bestätigung per E-Mail nötig sein.</p>
    </div>`}
    ${session?`<div class="card"><div class="actions">${button('Abmelden','logout')}</div></div>`:''}
    <div class="card"><h2>Datensicherung</h2><div class="actions">
      ${button('JSON exportieren','export-json')}${button('JSON importieren','import-json')}
    </div><input type="file" id="importFile" accept=".json,application/json" hidden>
    <p class="muted">Eine JSON-Sicherung ist auch mit gemeinsamer Cloud sinnvoll. Ein Import ersetzt nur auf ausdrückliche Bestätigung gespeicherte Daten.</p></div>`;
 }
};
function productRows(search=''){return db.products.filter(p=>[p.name,p.sku,p.barcode].join(' ').toLowerCase().includes(search.toLowerCase())).map(p=>`<tr><td><b>${esc(p.name)}</b></td><td>${esc(p.sku)}<br><small>${esc(p.barcode)}</small></td><td>${esc(p.category)}</td><td>${qty(p.id)}</td><td>${money(p.price)}</td><td>${button('Bearbeiten','edit-product:'+p.id)}</td></tr>`).join('')||'<tr><td colspan="6" class="empty">Keine Artikel vorhanden</td></tr>'}
function movementTable(arr){return `<table><tr><th>Datum</th><th>Artikel</th><th>Lager</th><th>Menge</th><th>Grund</th></tr>${arr.map(m=>`<tr><td>${esc(new Date(m.date).toLocaleString('de-DE'))}</td><td>${esc(db.products.find(p=>p.id===m.productId)?.name||'Gelöscht')}</td><td>${esc(db.warehouses.find(w=>w.id===m.warehouseId)?.name||'Gelöscht')}</td><td>${m.delta>0?'+':''}${m.delta}</td><td>${esc(m.reason)}</td></tr>`).join('')}</table>`}
function productModal(p){
  p=p||{id:'',name:'',sku:'',barcode:'',category:db.categories[0],price:0,custom:{}};
  const currentYear=new Date().getFullYear();
  const customFields=db.fields.map(f=>{
    const key='custom_'+f.id, label=String(f.label||'').trim().toLowerCase();
    if(label==='stück'||label==='packung'){
      const active=String(p.stockUnit||'').toLowerCase();
      const menge=!p.id?'':(active===label||(!active&&label==='stück')?qty(p.id):(p.custom?.[f.id]??''));
      return `<label>${esc(f.label)}<input data-stock-kind="${label}" name="${esc(key)}" type="number" inputmode="numeric" min="0" step="1" value="${esc(menge)}"></label>`;
    }
    if(label==='kaufjahr'){
      const saved=String(p.custom?.[f.id]||currentYear);
      const maxYear=Math.max(currentYear+5,Number(saved)||currentYear);
      const minYear=Math.min(2024,Number(saved)||2024);
      const years=Array.from({length:maxYear-minYear+1},(_,i)=>({value:String(minYear+i),label:String(minYear+i)}));
      return sel(key,f.label,years,saved);
    }
    return field(key,f.label,p.custom?.[f.id]??'',f.type);
  }).join('');
  modal(`<h2>${p.id?'Artikel bearbeiten':'Neuer Artikel'}</h2>
    <form id="productForm" class="fields" novalidate>
      <input type="hidden" name="id" value="${esc(p.id)}">
      ${field('name','Artikelname',p.name,'text',true)}
      <input type="hidden" name="sku" value="${esc(p.sku)}">
      <input type="hidden" name="barcode" value="${esc(p.barcode)}">
      ${sel('category','Kategorie',db.categories.map(c=>({value:c,label:c})),p.category)}
      <label>Gesamtpreis in EUR<input name="price" type="text" inputmode="decimal" value="${esc(p.price)}"></label>
      ${customFields}
      <button type="button" data-action="save-product">Artikel speichern</button>
    </form>
    <div id="scanner"></div>
    ${p.id?button('Artikel löschen','delete-product:'+p.id,'danger'):''}`);
}
function movementModal(productId='',delta=''){if(!db.products.length)return notice('Bitte zuerst einen Artikel erstellen.');modal(`<h2>Bestandsbuchung</h2><form id="movementForm" class="fields">${sel('productId','Artikel',opt(db.products),productId)}${sel('warehouseId','Lagerort',opt(db.warehouses))}${field('delta','Menge (+ Eingang, − Ausgang)',delta,'number',true)}${field('reason','Grund / Notiz','Wareneingang')}<button>Buchung speichern</button></form>`)}
function download(name,content,mime){const blob=new Blob([content],{type:mime});const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
const csv=(rows)=>rows.map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')).join('\r\n');
function exportFile(type){if(type==='json')return download('warenpilot-backup.json',JSON.stringify(db,null,2),'application/json');if(type==='products')return download('artikel.csv',csv([['Name','SKU','Barcode','Kategorie','Preis','Bestand'],...db.products.map(p=>[p.name,p.sku,p.barcode,p.category,p.price,qty(p.id)])]),'text/csv;charset=utf-8');download('buchungen.csv',csv([['Datum','Artikel-ID','Lager-ID','Menge','Grund'],...db.movements.map(m=>[m.date,m.productId,m.warehouseId,m.delta,m.reason])]),'text/csv;charset=utf-8')}
function addMovement(v){const delta=Number(v.delta);if(!Number.isFinite(delta)||delta===0)throw Error('Menge muss ungleich null sein.');if(!db.products.some(p=>p.id===v.productId)||!db.warehouses.some(w=>w.id===v.warehouseId))throw Error('Artikel oder Lagerort fehlt.');db.movements.push({id:id(),date:new Date().toISOString(),productId:v.productId,warehouseId:v.warehouseId,delta,reason:v.reason||'Buchung'})}
function saveProductDirect(f){
  f=f||document.getElementById('productForm');
  if(!f)return notice('Artikel-Formular nicht gefunden.');
  const v=formData(f);
  try{
    const name=String(v.name||'').trim();
  if(!name)throw Error('Bitte einen Artikelnamen eingeben.');
  const rawPrice=String(v.price??'').trim().replace(/\s/g,'').replace(',','.');
  if(rawPrice!==''&&(!Number.isFinite(Number(rawPrice))||Number(rawPrice)<0))
    throw Error('Bitte einen gültigen Preis eingeben, zum Beispiel 6,32.');
  const price=rawPrice===''?0:Number(rawPrice);
  const p=db.products.find(x=>String(x.id)===String(v.id)),custom={};
  db.fields.forEach(x=>custom[x.id]=v['custom_'+x.id]||'');
  const quantityFields=db.fields.filter(x=>['stück','packung'].includes(String(x.label||'').trim().toLowerCase()));
  const valueFor=x=>v['custom_'+x.id];
  const filled=x=>x&&valueFor(x)!==undefined&&String(valueFor(x)).trim()!=='';
  const pack=quantityFields.find(x=>String(x.label).trim().toLowerCase()==='packung');
  const stueck=quantityFields.find(x=>String(x.label).trim().toLowerCase()==='stück');
  // The last quantity field edited determines the article's stock. Only one quantity counts.
  const edited=String(f.dataset.stockKind||'').toLowerCase();
  const former=String(p?.stockUnit||'').toLowerCase();
  let kind=['stück','packung'].includes(edited)?edited:former;
  if(!kind){
    kind=filled(pack)&&(!filled(stueck)||Number(valueFor(stueck))===0)&&Number(valueFor(pack))>0?'packung':'stück';
  }
  let activeField=kind==='packung'?pack:stueck;
  if(!activeField){activeField=pack||stueck;kind=activeField?String(activeField.label).trim().toLowerCase():'';}
  let neuerBestand=null;
  if(activeField&&filled(activeField)){
    neuerBestand=Number(valueFor(activeField));
    if(!Number.isInteger(neuerBestand)||neuerBestand<0)
      throw Error('Bitte bei '+activeField.label+' eine ganze Zahl ab 0 eingeben.');
  } else if(activeField&&p&&p.stock!==undefined){
    neuerBestand=Number(p.stock);
  } else if(activeField&&filled(kind==='packung'?stueck:pack)){
    activeField=kind==='packung'?stueck:pack;
    kind=String(activeField.label).trim().toLowerCase();
    neuerBestand=Number(valueFor(activeField));
    if(!Number.isInteger(neuerBestand)||neuerBestand<0)
      throw Error('Bitte bei '+activeField.label+' eine ganze Zahl ab 0 eingeben.');
  }
  const data={id:p?.id||id(),name,sku:v.sku,barcode:v.barcode,category:v.category,price,custom};
  if(neuerBestand!==null){data.stock=neuerBestand;data.stockUnit=kind;}
  if(p)Object.assign(p,data);else db.products.push(data);
  close();
  save();
    const gespeichert=db.products.find(x=>String(x.id)===String(v.id))||db.products[db.products.length-1];
    const units=gespeichert.stockUnit==='packung'?(qty(gespeichert.id)===1?'Packung':'Packungen'):'Stück';
    notice('Artikel gespeichert. Bestand: '+qty(gespeichert.id)+' '+units+'.');
  }catch(err){
    notice('Artikel konnte nicht gespeichert werden: '+err.message);
  }
}
function handleAction(a){let [cmd,arg]=a.split(':');if(cmd==='save-product'){saveProductDirect();return;}
  if(cmd==='shared-start'){void startShared();return;}
  if(cmd==='shared-invite'){void createInvite();return;}
  if(cmd==='shared-join'){void joinShared();return;}
  if(cmd==='shared-reload'){void loadShared(true);return;}if(cmd==='purchases-page'){page='ausgaben';render();return;}if(cmd==='new-product')productModal();if(cmd==='edit-product')productModal(db.products.find(p=>p.id===arg));if(cmd==='book-product')movementModal(arg);if(cmd==='new-movement')movementModal();if(cmd==='inventory-page'){page='inventory';render()}if(cmd==='new-warehouse'||cmd==='edit-warehouse'){let w=db.warehouses.find(x=>x.id===arg);modal(`<h2>Lagerort</h2><form id="warehouseForm" class="fields"><input name="id" value="${esc(w?.id||'')}" hidden>${field('name','Name',w?.name||'','text',true)}<button>Speichern</button></form>`)}if(cmd==='new-category')modal(`<h2>Kategorie hinzufügen</h2><form id="categoryForm" class="fields">${field('name','Name','','text',true)}<button>Speichern</button></form>`);if(cmd==='new-field')modal(`<h2>Eigenes Artikelfeld</h2><form id="fieldForm" class="fields">${field('label','Feldbezeichnung','','text',true)}${sel('type','Typ',[{value:'text',label:'Text'},{value:'number',label:'Zahl'},{value:'date',label:'Datum'}])}<button>Hinzufügen</button></form>`);if(cmd==='delete-field'){if(confirm('Feld und gespeicherte Feldwerte entfernen?')){db.fields=db.fields.filter(f=>f.id!==arg);db.products.forEach(p=>delete p.custom[arg]);save()}}if(cmd==='new-view')modal(`<h2>Neue Tabellenansicht</h2><form id="viewForm" class="fields">${field('name','Ansichtsname','','text',true)}${['name','sku','barcode','category','price','stock'].map(x=>`<label><input type="checkbox" name="columns" value="${x}" checked> ${x}</label>`).join('')}<button>Ansicht speichern</button></form>`);if(cmd==='view'){let v=db.views.find(x=>x.id===arg);modal(`<h2>${esc(v.name)}</h2><div class="scroll"><table><tr>${v.columns.map(c=>`<th>${esc(c)}</th>`).join('')}</tr>${db.products.map(p=>`<tr>${v.columns.map(c=>`<td>${esc(c==='stock'?qty(p.id):p[c])}</td>`).join('')}</tr>`).join('')}</table></div>`)}if(cmd==='delete-view'){db.views=db.views.filter(v=>v.id!==arg);save()}if(cmd==='new-workflow')modal(`<h2>Buchungsvorlage</h2><form id="workflowForm" class="fields">${field('name','Name (z. B. Retoure)','','text',true)}${field('delta','Standardmenge (+ / −)',1,'number',true)}<button>Speichern</button></form>`);if(cmd==='run-workflow'){let w=db.workflows.find(x=>x.id===arg);movementModal('',w.delta)}if(cmd==='delete-workflow'){db.workflows=db.workflows.filter(w=>w.id!==arg);save()}if(cmd==='delete-product'){if(confirm('Artikel löschen? Frühere Buchungen bleiben im Protokoll.')){db.products=db.products.filter(p=>p.id!==arg);close();save()}}if(cmd.startsWith('export-'))exportFile(cmd.slice(7));if(cmd==='import-json')document.getElementById('importFile').click();if(cmd==='scan')startScan();if(cmd==='cloud-pull')cloudPull();if(cmd==='cloud-push')cloudPush();if(cmd==='logout'){session=null;shared=null;shareDirty=false;shareConflict=false;sessionStorage.removeItem('wp-session');document.getElementById('syncState').textContent='Lokal';render()}}
document.addEventListener('click',e=>{let b=e.target.closest('[data-page],[data-action]');if(!b)return;if(b.dataset.page){page=b.dataset.page;render()}else handleAction(b.dataset.action)});
document.addEventListener('input',e=>{
  const unit=e.target?.dataset?.stockKind;
  if(unit&&e.target.closest('#productForm'))e.target.closest('#productForm').dataset.stockKind=unit;
});
document.addEventListener('input',e=>{if(e.target.id==='search')document.getElementById('productRows').innerHTML=productRows(e.target.value)});

document.addEventListener('submit',async e=>{const f=e.target;const formId=f.getAttribute('id');if(!formId)return;e.preventDefault();let v=formData(f);try{if(formId==='productForm'){saveProductDirect(f);return;}if(formId==='warehouseForm'){let w=db.warehouses.find(x=>x.id===v.id);if(w)w.name=v.name;else db.warehouses.push({id:id(),name:v.name});close();save()}if(formId==='categoryForm'){if(!db.categories.includes(v.name))db.categories.push(v.name);close();save()}if(formId==='fieldForm'){db.fields.push({id:id(),label:v.label,type:v.type});close();save()}if(formId==='viewForm'){db.views.push({id:id(),name:v.name,columns:[...new FormData(f).getAll('columns')]});close();save()}if(formId==='workflowForm'){db.workflows.push({id:id(),name:v.name,delta:Number(v.delta)});close();save()}if(formId==='movementForm'){addMovement(v);close();save()}if(formId==='inventoryForm'){
  const gezählt=Number(v.count),produkt=db.products.find(p=>String(p.id)===String(v.productId));
  if(!produkt||!Number.isInteger(gezählt)||gezählt<0)throw Error('Bitte gültige Stückzahl eingeben.');
  const ist=qty(v.productId,v.warehouseId),delta=gezählt-ist;
  if(delta)addMovement({...v,delta,reason:'Inventurkorrektur'});
  if(String(v.warehouseId)===String(db.warehouses[0]?.id)){
    produkt.stock=gezählt;
    const stueckFeld=db.fields.find(x=>String(x.label||'').trim().toLowerCase()==='stück');
    if(stueckFeld){produkt.custom=produkt.custom||{};produkt.custom[stueckFeld.id]=String(gezählt);}
  }
  save();notice('Inventur erfasst.');
}if(formId==='cloudConfig'){let u=new URL(v.url);if(u.protocol!=='https:'||!u.hostname.endsWith('.supabase.co'))throw Error('Bitte gültige Supabase-Projekt-URL verwenden.');config={url:u.origin,key:v.key.trim()};localStorage.setItem(CFG,JSON.stringify(config));render();notice('Verbindung gespeichert.')}if(formId==='authForm'){let mode=e.submitter?.value||'login';await authenticate(v.email,v.password,mode)}}catch(err){notice(err.message)}});
document.addEventListener('change',async e=>{if(e.target.id==='importFile'){let file=e.target.files[0];if(!file)return;try{let d=JSON.parse(await file.text());if(!Array.isArray(d.products)||!Array.isArray(d.movements)||!Array.isArray(d.warehouses))throw Error('Ungültige Sicherungsdatei');if(confirm('Alle lokalen Daten durch die Sicherung ersetzen?')){db={...blank(),...d};save()}}catch(err){notice(err.message)}}});
async function startScan(){if(!('BarcodeDetector'in window)||!navigator.mediaDevices?.getUserMedia){notice('Kamera-Barcode-Erkennung wird hier nicht unterstützt. Barcode bitte manuell eingeben.');return}try{scanStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});let box=document.getElementById('scanner');box.innerHTML='<video autoplay playsinline muted></video><p class="muted">Barcode vor die Kamera halten.</p>';let video=box.querySelector('video');video.srcObject=scanStream;let detector=new BarcodeDetector();let active=scanStream;async function tick(){if(scanStream!==active)return;try{let codes=await detector.detect(video);if(codes.length){document.querySelector('[name=barcode]').value=codes[0].rawValue;stopScan();box.textContent='Code erkannt: '+codes[0].rawValue;return}}catch{}setTimeout(tick,350)}tick()}catch(err){notice('Kamera konnte nicht geöffnet werden: '+err.message)}}
function stopScan(){if(scanStream){scanStream.getTracks().forEach(t=>t.stop());scanStream=null}}
document.getElementById('dialog').addEventListener('close',stopScan);

function inviteFromUrl(){
  const match=location.hash.match(/(?:^#|&)invite=([a-f0-9-]{36})(?:&|$)/i);
  return match?match[1]:null;
}
function clearInvite(){
  if(inviteFromUrl())history.replaceState(null,'',location.pathname+location.search);
}
async function api(path,options={}){
  if(session?.refresh_token&&session.expires_at&&session.expires_at<=Date.now()/1000+90
      &&!path.startsWith('/auth/v1/')){
    const response=await fetch(CLOUD_URL+'/auth/v1/token?grant_type=refresh_token',{
      method:'POST',headers:{apikey:CLOUD_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({refresh_token:session.refresh_token})
    });
    if(!response.ok)throw Error('Anmeldung abgelaufen. Bitte unter Einstellungen erneut anmelden.');
    session=await response.json();
    sessionStorage.setItem('wp-session',JSON.stringify(session));
  }
  const response=await fetch(CLOUD_URL+path,{
    ...options,
    headers:{apikey:CLOUD_KEY,'Content-Type':'application/json',
      ...(session?{Authorization:'Bearer '+session.access_token}:{}),
      ...(options.headers||{})}
  });
  const txt=await response.text();
  let value=null;
  if(txt){try{value=JSON.parse(txt)}catch{value=txt}}
  if(!response.ok)throw Error(value?.message||value?.msg||value?.error_description||value?.error||'Cloud-Fehler '+response.status);
  return value;
}
async function authenticate(email,password,mode){
  if(mode==='signup'){
    const signup=await api('/auth/v1/signup',{method:'POST',body:JSON.stringify({email,password})});
    if(signup?.access_token){
      session=signup;
      sessionStorage.setItem('wp-session',JSON.stringify(session));
      await loadShared(false);
      render();
      notice('Konto angelegt und angemeldet.');
    }else notice('Konto angelegt. Bitte die Bestätigungs-E-Mail öffnen und danach hier anmelden.');
    return;
  }
  session=await api('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})});
  sessionStorage.setItem('wp-session',JSON.stringify(session));
  await loadShared(false);
  render();
  notice('Angemeldet. Du kannst jetzt die gemeinsame Burgpraxis verwenden.');
}
async function sharedDocument(){
  if(!session)return null;
  const records=await api('/rest/v1/bp_shared_documents?select=owner_id,content,revision,updated_at&limit=1');
  return records?.[0]||null;
}
async function loadShared(manual=false){
  if(!session||shareBusy)return;
  try{
    const remote=await sharedDocument();
    if(!remote){
      if(manual)notice('Noch keine gemeinsame Burgpraxis vorhanden.');
      return;
    }
    const initial=!shared||String(shared.ownerId)!==String(remote.owner_id);
    const newer=!initial&&Number(remote.revision)>Number(shared.revision);
    if(shareDirty||shareConflict){
      if(manual)notice('Deine Änderungen sind noch nicht synchronisiert. Bitte erst eine JSON-Sicherung erstellen.');
      return;
    }
    if(initial||newer){
      const localHasProducts=db.products.length>0;
      const different=JSON.stringify(db)!==JSON.stringify({...blank(),...remote.content});
      if(localHasProducts&&different&&initial&&!confirm('Gemeinsame Artikel aus der Cloud laden? Deine lokalen Artikel bleiben nur erhalten, wenn du vorher eine JSON-Sicherung erstellt hast.')){
        return;
      }
      db={...blank(),...remote.content};
      localStorage.setItem(KEY,JSON.stringify(db));
    }
    shared={ownerId:remote.owner_id,revision:Number(remote.revision)};
    shareDirty=false;
    shareConflict=false;
    document.getElementById('syncState').textContent='Gemeinsam gespeichert';
    render();
    if(manual)notice('Gemeinsamer Stand geladen.');
  }catch(error){
    if(manual)notice('Laden fehlgeschlagen: '+error.message);
  }
}
async function startShared(){
  if(!session)return notice('Bitte zuerst anmelden.');
  if(!db.products.length)return notice('Du hast auf diesem Gerät noch keine Artikel. Bitte zuerst die richtige Burgpraxis mit deinen Artikeln öffnen.');
  if(shareStarting)return;
  if(!confirm('Deine '+db.products.length+' vorhandenen Artikel jetzt in die gemeinsame Burgpraxis kopieren? Deine lokalen Daten bleiben erhalten.'))return;
  shareStarting=true;
  try{
    const result=await api('/rest/v1/rpc/bp_start',{method:'POST',body:JSON.stringify({p_content:db})});
    if(result?.created){
      shared={ownerId:result.owner_id,revision:1};
      shareDirty=false;
      shareConflict=false;
      document.getElementById('syncState').textContent='Gemeinsam gespeichert';
      render();
      notice('Deine '+db.products.length+' Artikel sind in der gemeinsamen Burgpraxis. Jetzt kannst du deinen Partner einladen!');
    }else{
      notice('Es gibt bereits eine gemeinsame Burgpraxis. Wir überschreiben nichts. Bitte den vorhandenen Stand laden.');
      await loadShared(false);
    }
  }catch(e){notice('Gemeinsamer Start fehlgeschlagen: '+e.message)}
  finally{shareStarting=false}
}
async function createInvite(){
  if(!session||!shared||shared.ownerId!==session.user?.id)return notice('Bitte zuerst die gemeinsame Burgpraxis starten.');
  try{
    const result=await api('/rest/v1/rpc/bp_make_invite',{method:'POST',body:'{}'});
    const link=location.origin+location.pathname+'#invite='+encodeURIComponent(result.code);
    if(navigator.clipboard?.writeText){
      await navigator.clipboard.writeText(link);
      notice('Einladungslink kopiert! Schicke ihn deinem Partner. Der Link gilt 7 Tage und kann nur einmal verwendet werden.');
    }else{
      modal('<h2>Link für deinen Partner</h2><p>Bitte diesen Link kopieren:</p><textarea readonly rows="4">'+esc(link)+'</textarea><p class="muted">Der Link gilt 7 Tage und kann einmal verwendet werden.</p>');
    }
  }catch(e){notice('Einladung fehlgeschlagen: '+e.message)}
}
async function joinShared(){
  const code=inviteFromUrl();
  if(!code)return notice('Bitte zuerst den Einladungslink öffnen.');
  if(!session)return notice('Bitte unter Einstellungen anmelden oder ein Konto erstellen.');
  try{
    await api('/rest/v1/rpc/bp_join',{method:'POST',body:JSON.stringify({p_code:code})});
    clearInvite();
    await loadShared(false);
    notice('Du bist jetzt mit der gemeinsamen Burgpraxis verbunden.');
  }catch(e){notice('Einladung konnte nicht angenommen werden: '+e.message)}
}
async function flushShared(){
  if(shareBusy||!shared||!shareDirty||shareConflict||!session)return;
  shareBusy=true;
  try{
    const snapshot=JSON.stringify(db);
    const result=await api('/rest/v1/rpc/bp_save',{
      method:'POST',
      body:JSON.stringify({p_owner_id:shared.ownerId,p_revision:shared.revision,p_content:JSON.parse(snapshot)})
    });
    if(!result?.ok){
      shareConflict=true;
      document.getElementById('syncState').textContent='Konflikt · lokal erhalten';
      notice('Die andere Person hat ebenfalls etwas geändert. Deine Änderungen bleiben auf diesem Handy. Bitte unter Einstellungen zuerst eine JSON-Sicherung erstellen.');
    }else{
      shared.revision=Number(result.revision);
      shareDirty=JSON.stringify(db)!==snapshot;
      document.getElementById('syncState').textContent=shareDirty?'Gemeinsam · Speichern …':'Gemeinsam gespeichert';
    }
  }catch(e){
    document.getElementById('syncState').textContent='Offline · lokal gespeichert';
  }finally{
    shareBusy=false;
    if(shared&&shareDirty&&!shareConflict&&document.getElementById('syncState').textContent!=='Offline · lokal gespeichert'){
      void flushShared();
    }
  }
}
async function checkSharedUpdates(){
  if(!session||!shared)return;
  if(shareDirty){
    if(!shareBusy&&!shareConflict)await flushShared();
    return;
  }
  if(shareBusy||shareConflict)return;
  try{await loadShared(false)}catch{}
}
// Auch beim Wechsel zwischen Geräten bleiben lokale Daten erhalten.
async function initCloud(){
  if(!session)return;
  try{await loadShared(false)}catch{}
}
try{session=JSON.parse(sessionStorage.getItem('wp-session')||'null')}catch{}
if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});
setInterval(()=>{if(!document.hidden)void checkSharedUpdates()},12000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void checkSharedUpdates()});
window.addEventListener('online',()=>{void checkSharedUpdates()});
void initCloud();

render();
