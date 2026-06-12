/* =================================================================
   LITTLE LEMON — Frontend Application
   ================================================================= */

const API = {
  base: '/api',
  auth: '/auth',

  get token() { return localStorage.getItem('ll_token'); },
  get username() { return localStorage.getItem('ll_username'); },

  headers(json = true) {
    const h = {};
    if (json) h['Content-Type'] = 'application/json';
    if (this.token) h['Authorization'] = `Token ${this.token}`;
    return h;
  },

  async request(method, url, body = null) {
    const opts = { method, headers: this.headers() };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw { status: res.status, data };
    return data;
  },

  get:    (url)       => API.request('GET',    url),
  post:   (url, body) => API.request('POST',   url, body),
  patch:  (url, body) => API.request('PATCH',  url, body),
  delete: (url)       => API.request('DELETE', url),
};

/* ── Auth ─────────────────────────────────────────── */
const Auth = {
  isLoggedIn() { return !!API.token; },

  async login(username, password) {
    const data = await API.post(`${API.auth}/token/login/`, { username, password });
    localStorage.setItem('ll_token', data.auth_token);
    localStorage.setItem('ll_username', username);
    return data;
  },

  async register(username, email, password) {
    await API.post(`${API.auth}/users/`, { username, email, password });
    return this.login(username, password);
  },

  async logout() {
    if (API.token) {
      try { await API.post(`${API.auth}/token/logout/`, {}); } catch {}
    }
    localStorage.removeItem('ll_token');
    localStorage.removeItem('ll_username');
    Cart.clearLocal();
    window.location.href = '/';
  },
};

/* ── Toast Notifications ──────────────────────────── */
const Toast = {
  container: null,

  init() {
    if (!this.container) {
      this.container = document.getElementById('toast-container');
      if (!this.container) {
        this.container = document.createElement('div');
        this.container.id = 'toast-container';
        document.body.appendChild(this.container);
      }
    }
  },

  show(message, type = 'info', duration = 4000) {
    this.init();
    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<span class="toast-icon">${icons[type]}</span><span class="toast-message">${message}</span>`;
    this.container.appendChild(t);
    setTimeout(() => t.remove(), duration + 300);
  },

  success: (msg) => Toast.show(msg, 'success'),
  error:   (msg) => Toast.show(msg, 'error'),
  info:    (msg) => Toast.show(msg, 'info'),
  warning: (msg) => Toast.show(msg, 'warning'),
};

/* ── Cart (client-side cache) ─────────────────────── */
const Cart = {
  _data: null,

  clearLocal() { this._data = null; this._updateBadge(0); },

  async get() {
    if (!Auth.isLoggedIn()) return [];
    try {
      const data = await API.get(`${API.base}/cart/menu-items`);
      this._data = Array.isArray(data) ? data : (data.results || []);
      this._updateBadge(this._data.length);
      return this._data;
    } catch { return []; }
  },

  async add(menuItemId, unitPrice) {
    if (!Auth.isLoggedIn()) {
      Toast.warning('Please log in to add items to your cart.');
      setTimeout(() => window.location.href = '/login/', 1200);
      return false;
    }
    try {
      await API.post(`${API.base}/cart/menu-items`, {
        menu_items: menuItemId,
        quantity: 1,
        unit_price: unitPrice,
      });
      this._data = null; // invalidate cache
      const cart = await this.get();
      this._updateBadge(cart.length);
      Toast.success('Added to cart!');
      return true;
    } catch (err) {
      if (err.status === 400) {
        Toast.warning('Item already in your cart.');
      } else {
        Toast.error('Could not add to cart. Please try again.');
      }
      return false;
    }
  },

  async clear() {
    if (!Auth.isLoggedIn()) return;
    try {
      await API.delete(`${API.base}/cart/menu-items`);
      this._data = [];
      this._updateBadge(0);
    } catch { Toast.error('Could not clear cart.'); }
  },

  _updateBadge(count) {
    document.querySelectorAll('.cart-badge').forEach(el => {
      el.textContent = count;
      el.style.display = count > 0 ? 'flex' : 'none';
    });
  },
};

/* ── Navigation ───────────────────────────────────── */
const Nav = {
  init() {
    this.renderAuth();
    this.highlightActive();
    this.initToggle();
    Cart.get(); // load badge

    // Close user dropdown when clicking outside
    document.addEventListener('click', e => {
      if (!e.target.closest('.nav-user-menu')) {
        document.querySelector('.nav-dropdown')?.classList.remove('open');
      }
    });
  },

  renderAuth() {
    const authArea = document.getElementById('nav-auth-area');
    if (!authArea) return;

    if (Auth.isLoggedIn()) {
      const initials = (API.username || 'U').substring(0, 2).toUpperCase();
      authArea.innerHTML = `
        <div class="nav-user-menu">
          <button class="nav-user-btn" id="nav-user-trigger" aria-expanded="false">
            <div class="nav-user-avatar">${initials}</div>
            <span>${API.username}</span>
            <span>▾</span>
          </button>
          <div class="nav-dropdown" id="nav-dropdown">
            <a href="/orders/">📦 My Orders</a>
            <a href="/cart/">🛒 Cart</a>
            <div class="divider"></div>
            <button id="btn-logout">🚪 Sign Out</button>
          </div>
        </div>`;

      document.getElementById('nav-user-trigger')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const dd = document.getElementById('nav-dropdown');
        dd?.classList.toggle('open');
      });
      document.getElementById('btn-logout')?.addEventListener('click', () => Auth.logout());
    } else {
      authArea.innerHTML = `
        <a href="/login/" class="btn btn-green btn-sm">Sign In</a>`;
    }
  },

  highlightActive() {
    const path = window.location.pathname;
    document.querySelectorAll('.nav-link').forEach(link => {
      const href = link.getAttribute('href');
      if (href === path || (href !== '/' && path.startsWith(href))) {
        link.classList.add('active');
      }
    });
  },

  initToggle() {
    const toggle = document.getElementById('nav-toggle');
    const links  = document.getElementById('navbar-links');
    toggle?.addEventListener('click', () => {
      toggle.classList.toggle('open');
      links?.classList.toggle('open');
    });
  },
};

/* ── Menu Item Utilities ──────────────────────────── */
const FOOD_EMOJIS = ['🍽️','🥗','🍝','🥙','🫒','🍋','🧆','🥘','🫕','🍤','🥩','🍣'];
const COLORS = ['cat-bg-1','cat-bg-2','cat-bg-3','cat-bg-4','cat-bg-5','cat-bg-6'];

function itemEmoji(item) {
  const title = (item.title || '').toLowerCase();
  if (title.includes('salad'))      return '🥗';
  if (title.includes('pasta') || title.includes('spaghetti')) return '🍝';
  if (title.includes('pizza'))      return '🍕';
  if (title.includes('soup'))       return '🍲';
  if (title.includes('burger'))     return '🍔';
  if (title.includes('fish') || title.includes('salmon')) return '🐟';
  if (title.includes('chicken'))    return '🍗';
  if (title.includes('steak') || title.includes('beef')) return '🥩';
  if (title.includes('dessert') || title.includes('cake') || title.includes('tart')) return '🍰';
  if (title.includes('drink') || title.includes('juice') || title.includes('lemon')) return '🍋';
  if (title.includes('bread') || title.includes('bruschetta')) return '🥖';
  if (title.includes('shrimp') || title.includes('prawn')) return '🍤';
  if (title.includes('hummus') || title.includes('falafel')) return '🧆';
  if (title.includes('wrap') || title.includes('gyro') || title.includes('pita')) return '🥙';
  if (title.includes('rice'))       return '🍚';
  if (title.includes('cheese'))     return '🧀';
  return FOOD_EMOJIS[item.id % FOOD_EMOJIS.length] || '🍽️';
}

function itemColor(item) {
  const catId = item.category?.id ?? item.id ?? 0;
  return COLORS[catId % COLORS.length];
}

function formatPrice(price) {
  return `$${parseFloat(price).toFixed(2)}`;
}

function stockLabel(inventory) {
  if (inventory <= 0)  return '<span class="stock-label out">Out of stock</span>';
  if (inventory <= 5)  return `<span class="stock-label low">Only ${inventory} left</span>`;
  return '';
}

/* ── Menu Card Template ───────────────────────────── */
function renderMenuCard(item, inCart = false) {
  const emoji  = itemEmoji(item);
  const color  = itemColor(item);
  const outOfStock = item.inventory <= 0;
  return `
    <div class="menu-card fade-in-up" data-id="${item.id}">
      <div class="menu-card-img ${color}">
        <span class="card-emoji">${emoji}</span>
        ${item.featured ? '<span class="featured-badge">⭐ Featured</span>' : ''}
      </div>
      <div class="menu-card-body">
        <div class="menu-card-top">
          <h3 class="menu-card-title">${item.title}</h3>
          <span class="menu-card-price">${formatPrice(item.price)}</span>
        </div>
        <div class="menu-card-category">
          <span class="tag tag-green">${item.category?.title || 'Uncategorized'}</span>
        </div>
        <div class="menu-card-meta">
          ${stockLabel(item.inventory)}
        </div>
        <div class="menu-card-footer">
          <button class="btn-add-cart ${inCart ? 'added' : ''}"
                  data-id="${item.id}"
                  data-price="${item.price}"
                  ${outOfStock ? 'disabled' : ''}>
            ${outOfStock ? '❌ Out of Stock' : inCart ? '✅ In Cart' : '🛒 Add to Cart'}
          </button>
        </div>
      </div>
    </div>`;
}

/* ── Skeleton Cards ───────────────────────────────── */
function renderSkeletons(n = 6) {
  return Array.from({ length: n }, () => `
    <div class="menu-card skeleton-card">
      <div class="skeleton skeleton-img"></div>
      <div class="skeleton-body">
        <div class="skeleton skeleton-line w-3/4" style="height:18px;margin-bottom:12px"></div>
        <div class="skeleton skeleton-line w-1/2" style="height:14px;margin-bottom:8px"></div>
        <div class="skeleton skeleton-line w-full" style="height:40px;margin-top:16px;border-radius:8px"></div>
      </div>
    </div>`).join('');
}

/* ================================================================
   PAGE: HOME
   ================================================================ */
function pickDailySpecials(items) {
  if (!items.length) return [];
  // Deterministic seed from today's date — changes every 24 hrs
  const today = new Date().toDateString();
  let seed = today.split('').reduce((s, c) => (s * 31 + c.charCodeAt(0)) | 0, 0);
  seed = Math.abs(seed);
  const n = items.length;
  // Pick 3 distinct indices using the seed
  const indices = new Set();
  let attempts = 0;
  while (indices.size < Math.min(3, n) && attempts < 30) {
    indices.add((seed + attempts * 7) % n);
    attempts++;
  }
  return [...indices].map(i => items[i]);
}

async function initHome() {
  const grid      = document.getElementById('specials-grid');
  const dateLabel = document.getElementById('specials-date');
  if (!grid) return;

  if (dateLabel) {
    dateLabel.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }

  grid.innerHTML = renderSkeletons(3);

  try {
    const data  = await API.get(`${API.base}/menu-items/`);
    const all   = data.results || data;

    if (!all.length) {
      grid.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px;grid-column:1/-1">No menu items available yet.</p>';
      return;
    }

    const specials = pickDailySpecials(all);
    grid.innerHTML = specials.map(i => renderMenuCard(i)).join('');

    grid.querySelectorAll('.btn-add-cart').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id    = parseInt(btn.dataset.id);
        const price = btn.dataset.price;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span>';
        const ok = await Cart.add(id, price);
        if (ok) {
          btn.innerHTML = '✅ In Cart';
          btn.classList.add('added');
        } else {
          btn.innerHTML = '🛒 Add to Cart';
          btn.disabled = false;
        }
      });
    });
  } catch {
    grid.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px;grid-column:1/-1">Could not load specials.</p>';
  }
}

/* ================================================================
   PAGE: MENU
   ================================================================ */
async function initMenu() {
  const grid     = document.getElementById('menu-grid');
  const catTabs  = document.getElementById('category-tabs');
  const searchIn = document.getElementById('search-input');
  if (!grid) return;

  let allItems   = [];
  let cartItems  = [];
  let activeCategory = 'all';
  let searchQuery    = '';

  async function loadAll() {
    grid.innerHTML = renderSkeletons(6);
    try {
      const [menuData, cartData] = await Promise.all([
        API.get(`${API.base}/menu-items/`),
        Auth.isLoggedIn() ? Cart.get() : Promise.resolve([]),
      ]);
      allItems  = menuData.results || menuData;
      cartItems = cartData;
      renderCategories();
      renderItems();
    } catch {
      grid.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:60px 40px;">Could not load menu. Please refresh.</p>';
    }
  }

  function renderCategories() {
    if (!catTabs) return;
    const cats = [{ id: 'all', title: 'All Items' }];
    const seen = new Set();
    allItems.forEach(item => {
      const c = item.category;
      if (c && !seen.has(c.id)) { cats.push(c); seen.add(c.id); }
    });
    catTabs.innerHTML = cats.map(c => `
      <button class="cat-tab ${c.id === activeCategory ? 'active' : ''}" data-cat="${c.id}">
        ${c.title}
      </button>`).join('');
    catTabs.querySelectorAll('.cat-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        activeCategory = btn.dataset.cat;
        catTabs.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderItems();
      });
    });
  }

  function renderItems() {
    const cartIds = new Set(cartItems.map(c => c.menu_items || c.menu_items_id));
    let filtered = allItems;

    if (activeCategory !== 'all') {
      filtered = filtered.filter(i => String(i.category?.id) === String(activeCategory));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(i =>
        i.title.toLowerCase().includes(q) ||
        (i.category?.title || '').toLowerCase().includes(q)
      );
    }

    if (!filtered.length) {
      grid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:80px 40px;color:var(--text-muted)">
          <div style="font-size:3rem;margin-bottom:16px">🔍</div>
          <h3 style="color:var(--dark);margin-bottom:8px">No items found</h3>
          <p>Try a different category or search term.</p>
        </div>`;
      return;
    }

    grid.innerHTML = filtered.map(item => renderMenuCard(item, cartIds.has(item.id))).join('');

    grid.querySelectorAll('.btn-add-cart').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id    = parseInt(btn.dataset.id);
        const price = btn.dataset.price;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span>';
        const ok = await Cart.add(id, price);
        if (ok) {
          cartItems = await Cart.get();
          btn.innerHTML = '✅ In Cart';
          btn.classList.add('added');
        } else {
          btn.innerHTML = '🛒 Add to Cart';
          btn.disabled = false;
        }
      });
    });
  }

  searchIn?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderItems();
  });

  await loadAll();
}

/* ================================================================
   PAGE: CART
   ================================================================ */
async function initCart() {
  const container   = document.getElementById('cart-container');
  const emptyState  = document.getElementById('cart-empty');
  const summaryBox  = document.getElementById('cart-summary');
  const subtotalEl  = document.getElementById('cart-subtotal');
  const totalEl     = document.getElementById('cart-total');
  const orderBtn    = document.getElementById('btn-place-order');
  const clearBtn    = document.getElementById('btn-clear-cart');
  if (!container) return;

  if (!Auth.isLoggedIn()) {
    container.innerHTML = '';
    emptyState.style.display = 'block';
    emptyState.innerHTML = `
      <div class="empty-icon">🔒</div>
      <h3>Sign in to view your cart</h3>
      <p>You need to be logged in to manage your cart.</p>
      <a href="/login/" class="btn btn-green">Sign In</a>`;
    summaryBox?.style && (summaryBox.style.display = 'none');
    return;
  }

  async function loadCart() {
    container.innerHTML = '<div class="loading-center"><div class="spinner"></div><span>Loading cart…</span></div>';
    const items = await Cart.get();

    if (!items.length) {
      container.innerHTML = '';
      if (emptyState) {
        emptyState.style.display = 'block';
        emptyState.innerHTML = `
          <div class="empty-icon">🛒</div>
          <h3>Your cart is empty</h3>
          <p>Browse our menu and add some delicious items.</p>
          <a href="/menu/" class="btn btn-green">Browse Menu</a>`;
      }
      if (summaryBox) summaryBox.style.display = 'none';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (summaryBox) summaryBox.style.display = 'block';

    let subtotal = 0;
    container.innerHTML = items.map(item => {
      subtotal += parseFloat(item.price || 0);
      const menuItem = item.menu_item_details || {};
      const title    = menuItem.title || `Item #${item.menu_items}`;
      const cat      = menuItem.category?.title || '';
      const emoji    = itemEmoji({ title, id: item.menu_items });
      const color    = itemColor({ id: item.menu_items });
      return `
        <div class="cart-item" data-id="${item.menu_items}">
          <div class="cart-item-emoji ${color}">${emoji}</div>
          <div class="cart-item-info">
            <div class="cart-item-title">${title}</div>
            ${cat ? `<div class="cart-item-category"><span class="tag tag-green">${cat}</span></div>` : ''}
            <div class="cart-qty" style="margin-top:8px">
              <span class="cart-qty-label">Qty: ${item.quantity}</span>
            </div>
          </div>
          <div class="cart-item-pricing">
            <div class="cart-item-price">${formatPrice(item.price)}</div>
            <div class="cart-item-unit">$${parseFloat(item.unit_price).toFixed(2)} each</div>
          </div>
        </div>`;
    }).join('');

    const deliveryFee = subtotal > 0 ? 3.99 : 0;
    const total = subtotal + deliveryFee;
    if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);
    if (totalEl)    totalEl.textContent    = formatPrice(total);
    document.getElementById('delivery-fee').textContent = deliveryFee > 0 ? formatPrice(deliveryFee) : 'Free';
  }

  /* ── Checkout Modal ─────────────────────────────── */
  const modal        = document.getElementById('checkout-modal');
  const modalClose   = document.getElementById('modal-close-btn');
  const payForm      = document.getElementById('payment-form');
  const payBtn       = document.getElementById('btn-pay-now');
  const modalTotal   = document.getElementById('modal-total');
  const cardNumIn    = document.getElementById('card-number');
  const cardNameIn   = document.getElementById('card-name');
  const cardExpIn    = document.getElementById('card-expiry');
  const cardCvvIn    = document.getElementById('card-cvv');
  const ccCard       = document.getElementById('cc-card');
  const ccNumDisp    = document.getElementById('cc-num-display');
  const ccNameDisp   = document.getElementById('cc-name-display');
  const ccExpDisp    = document.getElementById('cc-exp-display');
  const ccCvvDisp    = document.getElementById('cc-cvv-display');
  const successOv    = document.getElementById('success-overlay');
  const successNum   = document.getElementById('success-order-num');

  function openModal() {
    if (!modal) return;
    modalTotal && (modalTotal.textContent = totalEl?.textContent || '$0.00');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    setTimeout(() => modal.classList.add('open'), 10);
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove('open');
    setTimeout(() => { modal.style.display = 'none'; document.body.style.overflow = ''; }, 300);
  }

  orderBtn?.addEventListener('click', openModal);
  modalClose?.addEventListener('click', closeModal);
  modal?.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  // Live card preview
  cardNumIn?.addEventListener('input', e => {
    let v = e.target.value.replace(/\D/g, '').substring(0, 16);
    e.target.value = v.replace(/(.{4})/g, '$1 ').trim();
    const disp = v.padEnd(16, '•');
    ccNumDisp && (ccNumDisp.textContent = disp.replace(/(.{4})/g, '$1 ').trim());
  });
  cardNameIn?.addEventListener('input', e => {
    ccNameDisp && (ccNameDisp.textContent = e.target.value.toUpperCase() || 'YOUR NAME');
  });
  cardExpIn?.addEventListener('input', e => {
    let v = e.target.value.replace(/\D/g, '').substring(0, 4);
    if (v.length >= 3) v = v.slice(0, 2) + '/' + v.slice(2);
    e.target.value = v;
    ccExpDisp && (ccExpDisp.textContent = v || 'MM/YY');
  });
  cardCvvIn?.addEventListener('focus', () => ccCard?.classList.add('flipped'));
  cardCvvIn?.addEventListener('blur',  () => ccCard?.classList.remove('flipped'));
  cardCvvIn?.addEventListener('input', e => {
    const v = e.target.value.replace(/\D/g, '').substring(0, 3);
    e.target.value = v;
    ccCvvDisp && (ccCvvDisp.textContent = v.replace(/./g, '•') || '•••');
  });

  payForm?.addEventListener('submit', async e => {
    e.preventDefault();
    // Basic client-side validation
    const num  = (cardNumIn?.value || '').replace(/\s/g, '');
    const name = cardNameIn?.value.trim() || '';
    const exp  = cardExpIn?.value || '';
    const cvv  = cardCvvIn?.value || '';
    if (num.length < 16) { Toast.error('Please enter a valid 16-digit card number.'); return; }
    if (!name)            { Toast.error('Please enter the cardholder name.'); return; }
    if (exp.length < 5)   { Toast.error('Please enter a valid expiry date (MM/YY).'); return; }
    if (cvv.length < 3)   { Toast.error('Please enter a valid 3-digit CVV.'); return; }

    payBtn.disabled = true;
    payBtn.innerHTML = '<span class="spinner"></span> Processing…';

    try {
      const order = await API.post(`${API.base}/orders`, {});
      Cart.clearLocal();
      closeModal();
      if (successOv) {
        successNum && (successNum.textContent = order?.id ? `Order #${order.id}` : '');
        successOv.style.display = 'flex';
        setTimeout(() => successOv.classList.add('open'), 10);
      } else {
        Toast.success('Order placed successfully! 🎉');
        setTimeout(() => window.location.href = '/orders/', 1200);
      }
    } catch (err) {
      Toast.error(err.data?.message || 'Payment failed. Please try again.');
      payBtn.disabled = false;
      payBtn.innerHTML = '🔒 Pay Now';
    }
  });

  document.getElementById('btn-view-orders')?.addEventListener('click', () => {
    window.location.href = '/orders/';
  });

  clearBtn?.addEventListener('click', async () => {
    if (!confirm('Clear your entire cart?')) return;
    clearBtn.disabled = true;
    await Cart.clear();
    Toast.info('Cart cleared.');
    loadCart();
    clearBtn.disabled = false;
  });

  await loadCart();
}

/* ================================================================
   PAGE: ORDERS
   ================================================================ */
async function initOrders() {
  const container = document.getElementById('orders-container');
  if (!container) return;

  if (!Auth.isLoggedIn()) {
    container.innerHTML = `
      <div class="order-empty">
        <div class="empty-icon">🔒</div>
        <h3>Sign in to view your orders</h3>
        <p>You need to be logged in to view your order history.</p>
        <a href="/login/" class="btn btn-green" style="margin-top:16px">Sign In</a>
      </div>`;
    return;
  }

  container.innerHTML = '<div class="loading-center"><div class="spinner"></div><span>Loading orders…</span></div>';

  try {
    const data   = await API.get(`${API.base}/orders`);
    const orders = data.results || data;

    if (!orders.length) {
      container.innerHTML = `
        <div class="order-empty">
          <div class="empty-icon">📦</div>
          <h3>No orders yet</h3>
          <p>Your order history will appear here once you place your first order.</p>
          <a href="/menu/" class="btn btn-green" style="margin-top:16px">Start Ordering</a>
        </div>`;
      return;
    }

    container.innerHTML = orders.map(order => {
      const statusClass = order.status ? 'status-delivered' : 'status-pending';
      const statusText  = order.status ? '✅ Delivered' : '⏳ Pending';
      const date = new Date(order.date).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
      });
      return `
        <div class="order-card">
          <div class="order-header">
            <div class="order-id">Order #${order.id}
              <span>${date}</span>
            </div>
            <span class="order-status ${statusClass}">${statusText}</span>
          </div>
          <div class="order-details">
            <div class="order-detail-item">
              <strong>Customer:</strong> ${order.user}
            </div>
            ${order.delivery_crew
              ? `<div class="order-detail-item"><strong>Driver:</strong> ${order.delivery_crew}</div>`
              : ''}
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
            <span class="tag tag-green">${(order.order_items||[]).length} item${(order.order_items||[]).length !== 1 ? 's' : ''}</span>
            <span class="order-total">${formatPrice(order.total)}</span>
          </div>
        </div>`;
    }).join('');
  } catch {
    container.innerHTML = `
      <div class="order-empty">
        <div class="empty-icon">⚠️</div>
        <h3>Could not load orders</h3>
        <p>Please try refreshing the page.</p>
        <button class="btn btn-green" style="margin-top:16px" onclick="location.reload()">Refresh</button>
      </div>`;
  }
}

/* ================================================================
   PAGE: AUTH (Login / Register)
   ================================================================ */
function initAuth() {
  if (Auth.isLoggedIn()) { window.location.href = '/'; return; }

  const loginForm    = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const tabs         = document.querySelectorAll('.auth-tab');
  const loginPanel   = document.getElementById('panel-login');
  const registerPanel= document.getElementById('panel-register');

  function switchTab(name) {
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    if (name === 'login') {
      loginPanel.style.display    = 'block';
      registerPanel.style.display = 'none';
    } else {
      loginPanel.style.display    = 'none';
      registerPanel.style.display = 'block';
    }
  }

  tabs.forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));

  // Check if URL has ?tab=register
  if (new URLSearchParams(window.location.search).get('tab') === 'register') {
    switchTab('register');
  }

  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn  = loginForm.querySelector('button[type=submit]');
    const user = loginForm.querySelector('#login-username').value.trim();
    const pass = loginForm.querySelector('#login-password').value;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Signing in…';
    try {
      await Auth.login(user, pass);
      Toast.success(`Welcome back, ${user}!`);
      const next = new URLSearchParams(window.location.search).get('next') || '/';
      setTimeout(() => window.location.href = next, 800);
    } catch (err) {
      const msg = err.data?.non_field_errors?.[0] || 'Invalid username or password.';
      Toast.error(msg);
      btn.disabled = false;
      btn.innerHTML = 'Sign In';
    }
  });

  registerForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn   = registerForm.querySelector('button[type=submit]');
    const user  = registerForm.querySelector('#reg-username').value.trim();
    const email = registerForm.querySelector('#reg-email').value.trim();
    const pass  = registerForm.querySelector('#reg-password').value;
    const pass2 = registerForm.querySelector('#reg-password2').value;

    if (pass !== pass2) { Toast.error('Passwords do not match.'); return; }
    if (pass.length < 8) { Toast.error('Password must be at least 8 characters.'); return; }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Creating account…';
    try {
      await Auth.register(user, email, pass);
      Toast.success(`Welcome to Little Lemon, ${user}! 🍋`);
      setTimeout(() => window.location.href = '/', 800);
    } catch (err) {
      const errors = err.data;
      const msg = errors?.username?.[0] || errors?.password?.[0] || errors?.email?.[0]
                  || 'Registration failed. Please try again.';
      Toast.error(msg);
      btn.disabled = false;
      btn.innerHTML = 'Create Account';
    }
  });
}

/* ================================================================
   BOOTSTRAP
   ================================================================ */
document.addEventListener('DOMContentLoaded', () => {
  Nav.init();

  const page = document.body.dataset.page;
  if (page === 'home')     initHome();
  if (page === 'menu')     initMenu();
  if (page === 'cart')     initCart();
  if (page === 'orders')   initOrders();
  if (page === 'auth')     initAuth();
});
