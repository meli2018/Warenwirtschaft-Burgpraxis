
// WarenPilot – Ausgaben nach Kaufjahr und Kategorie
headings.ausgaben = 'Ausgaben';

pages.ausgaben = function() {
  const jahresfeld = db.fields.find(f =>
    f.label.trim().toLowerCase() === 'kaufjahr'
  );

  const aktuellesJahr = new Date().getFullYear();
  const jahre = Array.from(
    {length: aktuellesJahr + 6 - 2024},
    (_, i) => 2024 + i
  );

  const jahr = Number(
    sessionStorage.getItem('warenpilot-ausgaben-jahr') ||
    aktuellesJahr
  );

  const artikel = db.products.filter(p =>
    jahresfeld && Number(p.custom?.[jahresfeld.id]) === jahr
  );

  const gesamt = artikel.reduce(
    (summe, p) => summe + Number(p.price || 0), 0
  );

  const kategorien = [...new Set([
    ...db.categories,
    ...artikel.map(p => p.category)
  ])];

  return `
    <div class="toolbar"><h1>Ausgaben</h1></div>
    <div class="card">
      <label>Jahr auswählen
        <select id="ausgabenJahr">
          ${jahre.map(j => `
            <option value="${j}" ${j === jahr ? 'selected' : ''}>
              ${j}
            </option>
          `).join('')}
        </select>
      </label>
    </div>
    <div class="card">
      <h2>Gesamtausgaben ${jahr}</h2>
      <div class="metric">${money(gesamt)}</div>
    </div>
    <div class="card scroll">
      <h2>Ausgaben nach Kategorie</h2>
      <table>
        <tr><th>Kategorie</th><th>Gesamtpreis</th></tr>
        ${kategorien.map(k => `
          <tr>
            <td>${esc(k)}</td>
            <td>${money(artikel.filter(p => p.category === k)
              .reduce((s, p) => s + Number(p.price || 0), 0))}</td>
          </tr>
        `).join('')}
      </table>
    </div>
  `;
};

document.addEventListener('change', function(e) {
  if (e.target.id === 'ausgabenJahr') {
    sessionStorage.setItem(
      'warenpilot-ausgaben-jahr', e.target.value
    );
    render();
  }
});

render();
