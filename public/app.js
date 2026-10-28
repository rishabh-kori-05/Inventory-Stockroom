const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const when = s => new Date(s.replace(' ', 'T') + 'Z').toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

async function api(url, method, body) {
  const r = await fetch(url, body === undefined ? {} : {
    method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Something went wrong');
  return d;
}

const refs = { cats: [], sups: [] };
const loadRefs = async () => { [refs.cats, refs.sups] = await Promise.all([api('/api/categories'), api('/api/suppliers')]); };
const options = (list, sel, blank) =>
  `<option value="">${blank}</option>` + list.map(x => `<option value="${x.id}" ${x.id == sel ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
const stockCell = p => {
  const cls = p.qty <= 0 ? 'out' : p.qty <= p.reorder_level ? 'low' : '';
  return `<span class="${cls}">${p.qty}</span> <span class="mute">${esc(p.unit)}</span>`;
};

/* ---------- dialog helper ---------- */
const dlg = $('#dlg');
function openForm(title, body, onSave, label = 'Save') {
  dlg.innerHTML = `<form><h2>${title}</h2>${body}<p class="err" id="err"></p>
    <div class="row end"><button type="button" id="cancel">Cancel</button><button class="primary">${label}</button></div></form>`;
  $('#cancel').onclick = () => dlg.close();
  $('form', dlg).onsubmit = async e => {
    e.preventDefault();
    try { await onSave(Object.fromEntries(new FormData(e.target))); dlg.close(); render(); }
    catch (x) { $('#err').textContent = x.message; }
  };
  dlg.showModal();
}

/* ---------- forms ---------- */
function productForm(p = {}) {
  const isNew = !p.id;
  openForm(isNew ? 'New product' : 'Edit product', `
    <div class="two">
      <label>SKU<input name="sku" value="${esc(p.sku)}" required></label>
      <label>Unit<input name="unit" value="${esc(p.unit || 'pcs')}"></label>
    </div>
    <label>Name<input name="name" value="${esc(p.name)}" required></label>
    <div class="two">
      <label>Category<select name="category_id">${options(refs.cats, p.category_id, 'None')}</select></label>
      <label>Supplier<select name="supplier_id">${options(refs.sups, p.supplier_id, 'None')}</select></label>
      <label>Cost price<input name="cost" type="number" step="0.01" min="0" value="${p.cost ?? ''}"></label>
      <label>Selling price<input name="price" type="number" step="0.01" min="0" value="${p.price ?? ''}"></label>
      <label>Reorder when stock is at<input name="reorder_level" type="number" min="0" value="${p.reorder_level ?? 0}"></label>
      <label>Location<input name="location" value="${esc(p.location)}"></label>
    </div>
    ${isNew ? '<label>Opening stock<input name="qty" type="number" min="0" value="0"></label>' : ''}`,
    d => isNew ? api('/api/products', 'POST', d) : api('/api/products/' + p.id, 'PUT', d));
}

function moveForm(p) {
  openForm(`Stock movement: ${esc(p.name)}`, `
    <p class="mute">Currently ${p.qty} ${esc(p.unit)} in stock.</p>
    <label>Type<select name="type">
      <option value="purchase">Received from supplier</option>
      <option value="sale">Sold</option>
      <option value="return">Customer return</option>
      <option value="damage">Damaged or lost</option>
      <option value="adjust">Stock count (set exact quantity)</option>
    </select></label>
    <label>Quantity<input name="qty" type="number" min="0" step="1" required></label>
    <label>Note<input name="note" placeholder="Bill no., reason, etc."></label>`,
    d => api('/api/movements', 'POST', { ...d, product_id: p.id }), 'Record');
}

/* ---------- views ---------- */
const views = {
  async overview() {
    const s = await api('/api/summary');
    const rows = s.reorder.map(p => `<tr><td>${esc(p.name)}<div class="mute">${esc(p.sku)}</div></td>
      <td>${esc(p.supplier || '')}</td><td class="n">${stockCell(p)}</td><td class="n">${p.reorder_level}</td></tr>`).join('');
    return `<h2>Overview</h2>
      <div class="facts">
        <div><span>Products</span><b>${s.skus}</b></div>
        <div><span>Stock at cost</span><b>${money(s.cost_value)}</b></div>
        <div><span>Stock at selling price</span><b>${money(s.retail_value)}</b></div>
        <div><span>Running low</span><b class="${s.low ? 'low' : ''}">${s.low}</b></div>
        <div><span>Out of stock</span><b class="${s.out ? 'out' : ''}">${s.out}</b></div>
      </div>
      <h3>To reorder</h3>
      ${rows ? `<div class="tbl"><table><tr><th>Item</th><th>Supplier</th><th class="n">In stock</th><th class="n">Reorder at</th></tr>${rows}</table></div>`
             : '<div class="empty">Everything is above its reorder level.</div>'}`;
  },

  async products() {
    const f = views.filters;
    const qs = new URLSearchParams(f).toString();
    const list = await api('/api/products?' + qs);
    views.list = list;
    const rows = list.map(p => `<tr>
      <td>${esc(p.sku)}</td>
      <td>${esc(p.name)}<div class="mute">${esc([p.category, p.location].filter(Boolean).join(', '))}</div></td>
      <td class="n">${stockCell(p)}</td>
      <td class="n">${money(p.qty * p.cost)}</td>
      <td class="n"><button class="link" data-act="move" data-id="${p.id}">Move stock</button>
        <button class="link" data-act="edit" data-id="${p.id}">Edit</button>
        <button class="link del" data-act="del" data-id="${p.id}">Remove</button></td></tr>`).join('');
    return `<h2>Products</h2>
      <div class="bar">
        <input id="q" class="grow" type="search" placeholder="Search name or SKU" value="${esc(f.q)}">
        <select id="cat">${options(refs.cats, f.category, 'All categories')}</select>
        <select id="st">
          <option value="">Any stock level</option>
          <option value="low" ${f.status === 'low' ? 'selected' : ''}>Running low</option>
          <option value="out" ${f.status === 'out' ? 'selected' : ''}>Out of stock</option>
        </select>
        <a href="/api/export/products.csv"><button type="button">Export CSV</button></a>
        <button class="primary" data-act="new">Add product</button>
      </div>
      ${rows ? `<div class="tbl"><table><tr><th>SKU</th><th>Item</th><th class="n">In stock</th><th class="n">Value</th><th></th></tr>${rows}</table></div>`
             : '<div class="empty">No products match. Add one, or clear the filters.</div>'}`;
  },

  async movements() {
    const list = await api('/api/movements');
    const label = { opening: 'Opening stock', purchase: 'Received', sale: 'Sold', return: 'Returned', damage: 'Damaged', adjust: 'Count adjustment' };
    const rows = list.map(m => `<tr><td class="mute">${when(m.created_at)}</td>
      <td>${esc(m.name)}<div class="mute">${esc(m.sku)}</div></td><td>${label[m.type] || m.type}</td>
      <td class="n ${m.qty < 0 ? 'neg' : 'pos'}">${m.qty > 0 ? '+' : ''}${m.qty}</td>
      <td class="n">${m.balance}</td><td class="mute">${esc(m.note)}</td></tr>`).join('');
    return `<h2>Stock ledger</h2>` + (rows
      ? `<div class="tbl"><table><tr><th>When</th><th>Item</th><th>Type</th><th class="n">Change</th><th class="n">Balance</th><th>Note</th></tr>${rows}</table></div>`
      : '<div class="empty">No stock movements yet. Record one from the Products page.</div>');
  },

  async partners() {
    return `<h2>Categories &amp; suppliers</h2>
      <div class="bar"><button data-act="newcat">Add category</button><button data-act="newsup">Add supplier</button></div>
      <h3>Categories</h3>
      ${refs.cats.length ? `<div class="tbl"><table>${refs.cats.map(c => `<tr><td>${esc(c.name)}</td></tr>`).join('')}</table></div>` : '<div class="empty">No categories yet.</div>'}
      <h3>Suppliers</h3>
      ${refs.sups.length ? `<div class="tbl"><table><tr><th>Name</th><th>Phone</th><th>Email</th></tr>${refs.sups.map(s =>
        `<tr><td>${esc(s.name)}</td><td>${esc(s.phone)}</td><td>${esc(s.email)}</td></tr>`).join('')}</table></div>` : '<div class="empty">No suppliers yet.</div>'}`;
  },
  filters: { q: '', category: '', status: '' },
  list: [],
};

/* ---------- router + events ---------- */
async function render() {
  const name = (location.hash.slice(2) || 'overview');
  const key = views[name] ? name : 'overview';
  document.querySelectorAll('aside a').forEach(a => a.classList.toggle('on', a.hash === '#/' + key));
  await loadRefs();
  $('#view').innerHTML = await views[key]();
  if (key === 'products') {
    const again = () => { views.filters = { q: $('#q').value, category: $('#cat').value, status: $('#st').value }; render(); };
    let t; $('#q').oninput = () => { clearTimeout(t); t = setTimeout(again, 250); };
    $('#cat').onchange = again; $('#st').onchange = again;
    if (views.filters.q) { const q = $('#q'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
  }
}

document.addEventListener('click', async e => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const p = views.list.find(x => x.id == b.dataset.id);
  const act = b.dataset.act;
  if (act === 'new') productForm();
  if (act === 'edit') productForm(p);
  if (act === 'move') moveForm(p);
  if (act === 'del' && confirm(`Remove ${p.name}? Items with stock history are archived, not erased.`)) {
    await api('/api/products/' + p.id, 'DELETE', {}); render();
  }
  if (act === 'newcat') openForm('New category', '<label>Name<input name="name" required></label>', d => api('/api/categories', 'POST', d));
  if (act === 'newsup') openForm('New supplier', `<label>Name<input name="name" required></label>
    <div class="two"><label>Phone<input name="phone"></label><label>Email<input name="email" type="email"></label></div>`, d => api('/api/suppliers', 'POST', d));
});

window.addEventListener('hashchange', render);
render();
