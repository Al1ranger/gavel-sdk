const $ = id => document.getElementById(id);
let markets = [], generated;
async function request(path, options) {
  const response = await fetch(path, { ...options, signal: AbortSignal.timeout(35000) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}
function quote(p) {
  const format = $('format').value;
  if (format === 'probability') return `${(p * 100).toFixed(1)}%`;
  if (p === 0) return 'No finite odds';
  if (format === 'decimal') return (1 / p).toFixed(2);
  if (p === 1) return 'Certain / no finite line';
  return p > .5 ? String(Math.round(-100 * p / (1-p))) : `+${Math.round(100 * (1-p) / p)}`;
}
function render() {
  $('market-list').replaceChildren();
  const visible = markets.filter(m => m.question.toLowerCase().includes($('search').value.toLowerCase()));
  for (const market of visible) {
    const article = document.createElement('article'); article.className = 'market';
    const summary = document.createElement('div');
    const title = document.createElement('h3'); title.textContent = market.question;
    const id = document.createElement('small'); id.textContent = `Polymarket ${market.id}`;
    summary.append(title, id);
    const prices = document.createElement('div');
    for (const entry of market.odds.probabilities) {
      const row = document.createElement('div'); row.className = 'quote';
      const label = document.createElement('span'); label.textContent = market.outcomes.find(o => o.id === entry.outcomeId).label;
      const value = document.createElement('strong'); value.textContent = quote(entry.probability);
      row.append(label, value); prices.append(row);
    }
    article.append(summary, prices); $('market-list').append(article);
  }
  if (!visible.length) { const empty = document.createElement('p'); empty.textContent = 'No markets match this view.'; $('market-list').append(empty); }
}
async function loadMarkets() {
  $('refresh').disabled = true; $('market-status').textContent = 'Loading public market quotes…';
  try { const data = await request('/api/markets'); markets = data.markets; render(); $('market-status').textContent = `${data.source}: ${markets.length} markets. Observed ${new Date(data.observedAt).toLocaleString()}.`; }
  catch (error) { $('market-status').textContent = `Quotes unavailable: ${error.message}${markets.length ? ' Previous observations remain displayed.' : ''}`; }
  finally { $('refresh').disabled = false; }
}
$('refresh').onclick = loadMarkets; $('search').oninput = render; $('format').onchange = render;
$('build-form').oninput = () => { generated = null; $('download').disabled = $('download-spec').disabled = true; $('output').textContent = 'Specification changed. Generate again to review current inputs.'; };
$('build-form').onsubmit = async event => {
  event.preventDefault(); const button = event.submitter; button.disabled = true;
  $('build-status').textContent = 'Validating the specification…';
  const input = Object.fromEntries(new FormData(event.target)); input.deadline += ':00Z';
  try { generated = await request('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }); $('output').textContent = JSON.stringify(generated.spec, null, 2); $('download').disabled = $('download-spec').disabled = false; $('build-status').textContent = 'Contract generated. Review the specification before deploying.'; }
  catch (error) { $('build-status').textContent = error.message; }
  finally { button.disabled = false; }
};
function download(text, name, type) { const url = URL.createObjectURL(new Blob([text], { type })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
$('download').onclick = () => generated && download(generated.contract.source, generated.contract.filename, 'text/x-python');
$('download-spec').onclick = () => generated && download(JSON.stringify(generated.spec, null, 2), 'market-spec.json', 'application/json');
$('check').onclick = async () => {
  $('check').disabled = true; $('protocol-status').textContent = 'Checking configured resolver…';
  try { const data = await request('/api/resolver'); $('protocol-status').textContent = data.message; $('protocol-output').textContent = JSON.stringify(data, null, 2); }
  catch (error) { $('protocol-status').textContent = `Resolver unavailable: ${error.message}`; }
  finally { $('check').disabled = false; }
};
loadMarkets();
