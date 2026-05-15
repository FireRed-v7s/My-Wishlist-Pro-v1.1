/* =============================================
   MY WISHLIST PRO — script.js
   Full wishlist logic: CRUD, search, sort,
   localStorage persistence, toast, modals
   ============================================= */

'use strict';

/* ─── STATE ─── */
let items   = [];           // master array
let editId  = null;         // id of item being edited
let deleteId = null;        // id pending deletion
let searchQ  = '';
let sortMode = 'newest';

/* ─── STORAGE HELPERS ─── */
const STORAGE_KEY = 'wishlist_pro_v1';

function loadItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    items = raw ? JSON.parse(raw) : [];
  } catch { items = []; }
}

function saveItems() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

/* ─── DOM REFS ─── */
const cardsGrid    = document.getElementById('cardsGrid');
const emptyState   = document.getElementById('emptyState');
const itemCounter  = document.getElementById('itemCounter');
const searchInput  = document.getElementById('searchInput');
const sortSelect   = document.getElementById('sortSelect');
const fabBtn       = document.getElementById('fabBtn');

// Add/Edit modal
const modalOverlay = document.getElementById('modalOverlay');
const modalTitle   = document.getElementById('modalTitle');
const modalClose   = document.getElementById('modalClose');
const cancelBtn    = document.getElementById('cancelBtn');
const saveBtn      = document.getElementById('saveBtn');
const fieldName    = document.getElementById('fieldName');
const fieldPrice   = document.getElementById('fieldPrice');
const fieldModel   = document.getElementById('fieldModel');
const fieldShop    = document.getElementById('fieldShop');
const fieldDesc    = document.getElementById('fieldDesc');
const editIdInput  = document.getElementById('editId');

// Delete modal
const deleteOverlay     = document.getElementById('deleteOverlay');
const deleteCancelBtn   = document.getElementById('deleteCancelBtn');
const deleteConfirmBtn  = document.getElementById('deleteConfirmBtn');

const fieldImage    = document.getElementById('fieldImage');
const imgUploadArea = document.getElementById('imgUploadArea');
const imgPlaceholder= document.getElementById('imgPlaceholder');
const imgPreview    = document.getElementById('imgPreview');
const imgRemoveBtn  = document.getElementById('imgRemoveBtn');

/* ─── IMAGE HELPERS ─── */
let currentImageB64 = null;   // base64 string or null for current edit session

function setImagePreview(b64) {
  if (b64) {
    currentImageB64 = b64;
    imgPreview.src = b64;
    imgPreview.style.display = 'block';
    imgPlaceholder.style.display = 'none';
    imgRemoveBtn.style.display = 'block';
  } else {
    clearImagePreview();
  }
}

function clearImagePreview() {
  currentImageB64 = null;
  imgPreview.src = '';
  imgPreview.style.display = 'none';
  imgPlaceholder.style.display = 'flex';
  imgRemoveBtn.style.display = 'none';
  fieldImage.value = '';
}

// Click on upload area triggers file input
imgUploadArea.addEventListener('click', (e) => {
  if (e.target === imgRemoveBtn) return;
  fieldImage.click();
});

imgRemoveBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  clearImagePreview();
});

fieldImage.addEventListener('change', () => {
  const file = fieldImage.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    showToast('⚠️ Image must be under 5 MB');
    fieldImage.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => setImagePreview(e.target.result);
  reader.readAsDataURL(file);
});


const STATUS_META = {
  available: { emoji: '🟢', label: 'Available', cls: 'available' },
  thinking:  { emoji: '🟡', label: 'Thinking',  cls: 'thinking'  },
  noturgent: { emoji: '🔴', label: 'Not Urgent', cls: 'noturgent' },
};

function getStatusRadioValue() {
  const checked = document.querySelector('input[name="status"]:checked');
  return checked ? checked.value : 'thinking';
}

function setStatusRadio(val) {
  const el = document.querySelector(`input[name="status"][value="${val}"]`);
  if (el) el.checked = true;
}

/* ─── RENDER ─── */
function getFilteredSorted() {
  let list = items.slice();

  // Search
  if (searchQ) {
    const q = searchQ.toLowerCase();
    list = list.filter(it =>
      it.name.toLowerCase().includes(q) ||
      (it.shop  || '').toLowerCase().includes(q) ||
      (it.model || '').toLowerCase().includes(q) ||
      (it.desc  || '').toLowerCase().includes(q)
    );
  }

  // Sort
  if (sortMode === 'price-asc') {
    list.sort((a, b) => parseFloat(a.price || 0) - parseFloat(b.price || 0));
  } else if (sortMode === 'price-desc') {
    list.sort((a, b) => parseFloat(b.price || 0) - parseFloat(a.price || 0));
  } else if (sortMode === 'status') {
    const order = { available: 0, thinking: 1, noturgent: 2 };
    list.sort((a, b) => (order[a.status] ?? 1) - (order[b.status] ?? 1));
  } else {
    // newest first (default)
    list.sort((a, b) => b.createdAt - a.createdAt);
  }

  return list;
}

function renderCards() {
  const list = getFilteredSorted();
  itemCounter.textContent = `${items.length} item${items.length !== 1 ? 's' : ''}`;

  // Empty state logic
  if (items.length === 0) {
    emptyState.classList.add('visible');
    cardsGrid.innerHTML = '';
    return;
  }
  emptyState.classList.remove('visible');

  if (list.length === 0) {
    cardsGrid.innerHTML = '<p class="no-results">No items match your search.</p>';
    return;
  }

  cardsGrid.innerHTML = list.map(it => buildCardHTML(it)).join('');

  // Attach toggle-desc listeners
  cardsGrid.querySelectorAll('.toggle-desc').forEach(btn => {
    btn.addEventListener('click', e => {
      const card = e.target.closest('.card');
      const descBlock = card.querySelector('.card-desc');
      const isExpanded = descBlock.classList.toggle('expanded');
      btn.textContent = isExpanded ? 'Show less' : 'Show more';
    });
  });

  // Attach edit / delete listeners
  cardsGrid.querySelectorAll('.card-btn.edit').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.id));
  });
  cardsGrid.querySelectorAll('.card-btn.delete').forEach(btn => {
    btn.addEventListener('click', () => openDeleteModal(btn.dataset.id));
  });
}

function buildCardHTML(it) {
  const sm = STATUS_META[it.status] || STATUS_META.thinking;
  const hasLongDesc = it.desc && it.desc.length > 120;

  const pricePart = it.price
    ? `<div class="card-price">${escHtml(it.price)}</div>` : '';

  const metaTags = [it.model, it.shop]
    .filter(Boolean)
    .map(t => `<span class="card-tag">${escHtml(t)}</span>`)
    .join('');

  const descPart = it.desc ? `
    <div class="card-desc">
      <div class="desc-text">${escHtml(it.desc)}</div>
      ${hasLongDesc ? '<button class="toggle-desc">Show more</button>' : ''}
    </div>` : '';

  const imagePart = it.image
    ? `<img class="card-image" src="${it.image}" alt="${escHtml(it.name)}" loading="lazy" />` : '';

  return `
  <article class="card" data-id="${it.id}">
    ${imagePart}
    <h2 class="card-name">${escHtml(it.name)}</h2>
    ${pricePart}
    ${metaTags ? `<div class="card-meta">${metaTags}</div>` : ''}
    ${descPart}
    <div class="card-actions">
      <button class="card-btn edit"   data-id="${it.id}">✏️ Edit</button>
      <button class="card-btn delete" data-id="${it.id}">🗑 Delete</button>
    </div>
    <div class="card-status" title="${sm.label}">${sm.emoji}</div>
  </article>`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ─── MODAL OPEN / CLOSE ─── */
function openAddModal() {
  editId = null;
  editIdInput.value = '';
  modalTitle.textContent = 'Add Item';
  fieldName.value  = '';
  fieldPrice.value = '';
  fieldModel.value = '';
  fieldShop.value  = '';
  fieldDesc.value  = '';
  setStatusRadio('thinking');
  clearImagePreview();
  openModal(modalOverlay);
  setTimeout(() => fieldName.focus(), 300);
}

function openEditModal(id) {
  const it = items.find(x => x.id === id);
  if (!it) return;
  editId = id;
  editIdInput.value = id;
  modalTitle.textContent = 'Edit Item';
  fieldName.value  = it.name  || '';
  fieldPrice.value = it.price || '';
  fieldModel.value = it.model || '';
  fieldShop.value  = it.shop  || '';
  fieldDesc.value  = it.desc  || '';
  setStatusRadio(it.status || 'thinking');
  setImagePreview(it.image || null);
  openModal(modalOverlay);
  setTimeout(() => fieldName.focus(), 300);
}

function openDeleteModal(id) {
  deleteId = id;
  openModal(deleteOverlay);
}

function openModal(overlay) {
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModal(overlay) {
  overlay.classList.remove('open');
  document.body.style.overflow = '';
}

/* ─── SAVE ─── */
function saveItem() {
  const name = fieldName.value.trim();
  if (!name) {
    fieldName.focus();
    fieldName.classList.add('shake');
    setTimeout(() => fieldName.classList.remove('shake'), 500);
    showToast('⚠️ Product name is required');
    return;
  }

  if (editId) {
    // Update
    const idx = items.findIndex(x => x.id === editId);
    if (idx !== -1) {
      items[idx] = {
        ...items[idx],
        name,
        price:  fieldPrice.value.trim(),
        model:  fieldModel.value.trim(),
        shop:   fieldShop.value.trim(),
        desc:   fieldDesc.value.trim(),
        status: getStatusRadioValue(),
        image:  currentImageB64 !== undefined ? currentImageB64 : (items[idx].image || null),
        updatedAt: Date.now(),
      };
    }
    showToast('✅ Item updated!');
  } else {
    // Add
    const newItem = {
      id:        crypto.randomUUID(),
      name,
      price:     fieldPrice.value.trim(),
      model:     fieldModel.value.trim(),
      shop:      fieldShop.value.trim(),
      desc:      fieldDesc.value.trim(),
      status:    getStatusRadioValue(),
      image:     currentImageB64 || null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    items.unshift(newItem);
    showToast('🎉 Item added!');
  }

  saveItems();
  closeModal(modalOverlay);
  renderCards();
}

/* ─── DELETE ─── */
function deleteItem() {
  if (!deleteId) return;
  items = items.filter(x => x.id !== deleteId);
  deleteId = null;
  saveItems();
  closeModal(deleteOverlay);
  renderCards();
  showToast('🗑 Item deleted');
}

/* ─── TOAST ─── */
function showToast(msg) {
  const toastContainer = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  toastContainer.appendChild(t);
  setTimeout(() => {
    t.classList.add('out');
    t.addEventListener('animationend', () => t.remove());
  }, 2400);
}

/* ─── SHAKE ANIMATION (inline style) ─── */
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
  @keyframes shake {
    0%,100%{transform:translateX(0)}
    20%{transform:translateX(-6px)}
    40%{transform:translateX(6px)}
    60%{transform:translateX(-4px)}
    80%{transform:translateX(4px)}
  }
  .shake { animation: shake .4s ease; border-color: #C0392B !important; }
`;
document.head.appendChild(shakeStyle);

/* ─── EVENT LISTENERS ─── */

// FAB
fabBtn.addEventListener('click', openAddModal);

// Modal close triggers
modalClose.addEventListener('click', () => closeModal(modalOverlay));
cancelBtn.addEventListener('click', () => closeModal(modalOverlay));
saveBtn.addEventListener('click', saveItem);

// Close on overlay click
modalOverlay.addEventListener('click', e => {
  if (e.target === modalOverlay) closeModal(modalOverlay);
});
deleteOverlay.addEventListener('click', e => {
  if (e.target === deleteOverlay) closeModal(deleteOverlay);
});

// Delete modal
deleteCancelBtn.addEventListener('click', () => closeModal(deleteOverlay));
deleteConfirmBtn.addEventListener('click', deleteItem);

// Search
searchInput.addEventListener('input', () => {
  searchQ = searchInput.value.trim();
  renderCards();
});

// Sort
sortSelect.addEventListener('change', () => {
  sortMode = sortSelect.value;
  renderCards();
});

// Keyboard: Escape closes modal
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (modalOverlay.classList.contains('open'))  closeModal(modalOverlay);
    if (deleteOverlay.classList.contains('open')) closeModal(deleteOverlay);
  }
  if (e.key === 'Enter' && modalOverlay.classList.contains('open')) {
    // Ctrl+Enter saves
    if (e.ctrlKey || e.metaKey) saveItem();
  }
});

/* ─── INIT ─── */
loadItems();
renderCards();
