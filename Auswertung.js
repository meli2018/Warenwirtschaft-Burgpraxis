// Burgpraxis: Einkäufe aus bereits gespeicherten Artikeln.
headings.ausgaben='Ausgaben';
pages.ausgaben=function(){
  const kaufjahrFeld=db.fields.find(f=>String(f.label||'').trim().toLowerCase()==='kaufjahr');
  const heute=new Date().getFullYear();
  const jahreInDaten=kaufjahrFeld?db.products.map(p=>Number(p.custom?.[kaufjahrFeld.id]))
    .filter(j=>Number.isInteger(j)&&j>=2000&&j<=2100):[];
  const auswahl=Number(sessionStorage.getItem('warenpilot-ausgaben-jahr')||heute);
  const jahr=Number.isInteger(auswahl)&&auswahl>=2000&&auswahl<=2100?auswahl:heute;
  const erstes=Math.min(2024,jahr,...jahreInDaten);
  const letztes=Math.max(heute+5,jahr,...jahreInDaten);
  const jahre=Array.from({length:letztes-erstes+1},(_,i)=>erstes+i);
  const imJahr=db.products.filter(p=>kaufjahrFeld&&Number(p.custom?.[kaufjahrFeld.id])===jahr);
  const requested=String(sessionStorage.getItem('warenpilot-ausgaben-artikel')||'');
  const selected=imJahr.find(p=>String(p.id)===requested);
  const ausgewaehlt=selected?[selected]:imJahr;
  const summe=ausgewaehlt.reduce((s,p)=>s+(Number(p.price)||0),0);
  const kategorien=[...new Set(ausgewaehlt.map(p=>p.category))];
  const gespeicherteMenge=p=>{
    const n=qty(p.id),unit=String(p.stockUnit||'stück').toLowerCase();
    return n+' '+(unit==='packung'?(n===1?'Packung':'Packungen'):'Stück');
  };
  return `<div class="toolbar"><h1>Einkäufe pro Artikel</h1></div>
  <div class="card">
    <label>Jahr auswählen<select id="ausgabenJahr">${jahre.map(y=>`<option value="${y}" ${y===jahr?'selected':''}>${y}</option>`).join('')}</select></label>
    <label>Artikel auswählen<select id="ausgabenArtikel">
      <option value="">Alle Artikel</option>
      ${imJahr.map(p=>`<option value="${esc(p.id)}" ${selected&&p.id===selected.id?'selected':''}>${esc(p.name)}</option>`).join('')}
    </select></label>
  </div>
  <div class="card"><h2>Einkaufskosten ${jahr}</h2>
    <div class="metric">${money(summe)}</div>
    <p class="muted">Der bereits eingetragene Gesamtpreis wird pro Artikel nur einmal gezählt.</p>
  </div>
  <div class="card scroll"><h2>Gespeicherte Einkäufe ${jahr}</h2>
    ${ausgewaehlt.length?`<table><tr><th>Artikel</th><th>Gespeicherte Menge</th><th>Gesamtpreis</th></tr>
      ${ausgewaehlt.map(p=>`<tr><td>${esc(p.name)}</td><td>${esc(gespeicherteMenge(p))}</td><td>${money(Number(p.price)||0)}</td></tr>`).join('')}
    </table>`:'<p>Für dieses Jahr ist noch kein Artikel mit Kaufjahr gespeichert.</p>'}
    <p class="muted">Die Menge entspricht dem aktuell gespeicherten Bestand, nicht einem errechneten Verbrauch.</p>
  </div>
  ${kategorien.length?`<div class="card scroll"><h2>Ausgaben nach Kategorie</h2>
    <table><tr><th>Kategorie</th><th>Gesamtpreis</th></tr>
      ${kategorien.map(k=>`<tr><td>${esc(k)}</td><td>${money(ausgewaehlt.filter(p=>p.category===k).reduce((s,p)=>s+(Number(p.price)||0),0))}</td></tr>`).join('')}
    </table></div>`:''}
  ${!kaufjahrFeld?'<p class="muted">Ohne Artikelfeld Kaufjahr ist keine Zuordnung nach Jahr möglich.</p>':''}`;
};
document.addEventListener('change',e=>{
  if(e.target.id==='ausgabenJahr'){
    sessionStorage.setItem('warenpilot-ausgaben-jahr',e.target.value);
    sessionStorage.removeItem('warenpilot-ausgaben-artikel');
    render();
  }else if(e.target.id==='ausgabenArtikel'){
    sessionStorage.setItem('warenpilot-ausgaben-artikel',e.target.value);
    render();
  }
});
render();
