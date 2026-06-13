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

/* ── Cart Panel (mini dropdown) ──────────────────── */
const CartPanel = {
  _open: false,

  init() {
    const btn    = document.getElementById('nav-cart-btn');
    const panel  = document.getElementById('cart-panel');
    const overlay= document.getElementById('cart-panel-overlay');
    const closeBtn=document.getElementById('cart-panel-close');
    const coBtn  = document.getElementById('btn-cp-checkout');

    if (!btn || !panel) return;

    btn.addEventListener('click', e => { e.stopPropagation(); this.toggle(); });
    closeBtn?.addEventListener('click', () => this.close());
    overlay?.addEventListener('click', () => this.close());
    coBtn?.addEventListener('click', () => {
      this.close();
      if (!Auth.isLoggedIn()) {
        Toast.warning('Please sign in first.');
        setTimeout(() => window.location.href = '/login/', 900);
        return;
      }
      const totalEl = document.getElementById('cp-total');
      Checkout.open(totalEl?.textContent || '$0.00');
    });

    document.addEventListener('keydown', e => { if (e.key === 'Escape') this.close(); });
  },

  toggle() { this._open ? this.close() : this.open(); },

  async open() {
    this._open = true;
    const panel   = document.getElementById('cart-panel');
    const overlay = document.getElementById('cart-panel-overlay');
    panel?.classList.add('open');
    overlay?.classList.add('open');
    document.body.style.overflow = 'hidden';
    await this.render();
  },

  close() {
    this._open = false;
    document.getElementById('cart-panel')?.classList.remove('open');
    document.getElementById('cart-panel-overlay')?.classList.remove('open');
    document.body.style.overflow = '';
  },

  async render() {
    const body   = document.getElementById('cart-panel-body');
    const footer = document.getElementById('cart-panel-footer');
    const coBtn  = document.getElementById('btn-cp-checkout');
    if (!body) return;

    if (!Auth.isLoggedIn()) {
      body.innerHTML = `
        <div class="cp-empty">
          <div class="empty-icon">🔒</div>
          <p>Sign in to view your cart</p>
          <a href="/login/" class="btn btn-green btn-sm">Sign In</a>
        </div>`;
      if (footer) footer.style.display = 'none';
      return;
    }

    body.innerHTML = '<div style="padding:32px;text-align:center"><div class="spinner"></div></div>';
    const items = await Cart.get();

    if (!items.length) {
      body.innerHTML = `
        <div class="cp-empty">
          <div class="empty-icon">🛒</div>
          <p>Your cart is empty</p>
          <a href="/menu/" class="btn btn-green btn-sm" onclick="CartPanel.close()">Browse Menu</a>
        </div>`;
      if (footer) footer.style.display = 'none';
      return;
    }

    let subtotal = 0;
    body.innerHTML = items.map(item => {
      subtotal += parseFloat(item.price || 0);
      const mi    = item.menu_item_details || {};
      const title = mi.title || `Item #${item.menu_items}`;
      const imgUrl= FOOD_IMAGES[(title).toLowerCase()];
      const emoji = itemEmoji({ title, id: item.menu_items });
      const color = itemColor({ id: item.menu_items });
      const thumb = imgUrl
        ? `<img src="${imgUrl}" alt="${title}" class="cp-item-thumb" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
        : '';
      return `
        <div class="cp-item">
          <div class="cp-item-img ${color}">${thumb}<span class="cp-item-emoji" style="${imgUrl?'display:none':''}">${emoji}</span></div>
          <div class="cp-item-info">
            <div class="cp-item-title">${title}</div>
            <div class="cp-item-qty">Qty: ${item.quantity}</div>
          </div>
          <div class="cp-item-price">${formatPrice(item.price)}</div>
        </div>`;
    }).join('');

    const delivery = 3.99;
    const total    = subtotal + delivery;
    const subtotalEl = document.getElementById('cp-subtotal');
    const totalEl    = document.getElementById('cp-total');
    if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);
    if (totalEl)    totalEl.textContent    = formatPrice(total);
    if (footer)     footer.style.display  = 'block';
    if (coBtn)      coBtn.disabled        = false;
  },
};

/* ── Menu Item Utilities ──────────────────────────── */
const FOOD_EMOJIS = ['🍽️','🥗','🍝','🥙','🫒','🍋','🧆','🥘','🫕','🍤','🥩','🍣'];
const COLORS = ['cat-bg-1','cat-bg-2','cat-bg-3','cat-bg-4','cat-bg-5','cat-bg-6'];

const FOOD_IMAGES = {
  'greek salad':           'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=400&q=80',
  'bruschetta al pomodoro':'https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?auto=format&fit=crop&w=400&q=80',
  'hummus & warm pita':    'https://images.unsplash.com/photo-1505253758473-96b7015fcd40?auto=format&fit=crop&w=400&q=80',
  'falafel plate':         'https://unsplash.com/photos/8GL78h6Y6RU/download?w=400',
  'stuffed grape leaves':  'https://images.unsplash.com/photo-1518779578993-ec3579fee39f?auto=format&fit=crop&w=400&q=80',
  'grilled lamb chops':    'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=400&q=80',
  'chicken souvlaki':      'https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=400&q=80',
  'beef moussaka':         'https://images.unsplash.com/photo-1574484284002-952d92456975?auto=format&fit=crop&w=400&q=80',
  'pasta arrabiata':       'https://images.unsplash.com/photo-1563379926898-05f4575a45d8?auto=format&fit=crop&w=400&q=80',
  'mushroom risotto':      'https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?auto=format&fit=crop&w=400&q=80',
  'lemon herb chicken':    'https://unsplash.com/photos/XaDsH-O2QXs/download?w=400',
  'grilled sea bass':      'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=400&q=80',
  'shrimp saganaki':       'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=400&q=80',
  'grilled salmon fillet': 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=400&q=80',
  'calamari fritti':       'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&w=400&q=80',
  'lemon tart':            'https://images.unsplash.com/photo-1519915028121-7d3463d20b13?auto=format&fit=crop&w=400&q=80',
  'baklava':               'https://images.pexels.com/photos/20183046/pexels-photo-20183046.jpeg?auto=compress&cs=tinysrgb&w=400',
  'chocolate lava cake':   'https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?auto=format&fit=crop&w=400&q=80',
  'panna cotta':           'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=400&q=80',
  'fresh lemonade':        'https://unsplash.com/photos/Z3z1O7hqyC4/download?w=400',
  'sparkling water':       'https://unsplash.com/photos/A2GVZTroNvE/download?w=400',
  'mint lemonade':         'https://images.unsplash.com/photo-1497534446932-c925b458314e?auto=format&fit=crop&w=400&q=80',
  'turkish coffee':        'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=400&q=80',
};

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

/* ── Multi-Step Checkout ─────────────────────────── */
const Checkout = {
  _step: 1,
  _total: '$0.00',

  init() {
    const backdrop = document.getElementById('checkout-modal');
    const closeBtn = document.getElementById('modal-close-btn');
    const delNext  = document.getElementById('btn-del-next');
    const payBack  = document.getElementById('btn-pay-back');
    const cardBack = document.getElementById('btn-card-back');
    const tfBack   = document.getElementById('btn-transfer-back');
    const optCard  = document.getElementById('opt-card');
    const optXfer  = document.getElementById('opt-transfer');
    const payForm  = document.getElementById('payment-form');
    const cfmXfer  = document.getElementById('btn-confirm-transfer');
    const viewOrds = document.getElementById('btn-view-orders');

    if (!backdrop) return;

    backdrop.addEventListener('click', e => { if (e.target === backdrop) this.close(); });
    closeBtn?.addEventListener('click', () => this.close());

    delNext?.addEventListener('click', () => {
      const name    = document.getElementById('del-name')?.value.trim();
      const address = document.getElementById('del-address')?.value.trim();
      const city    = document.getElementById('del-city')?.value.trim();
      const zip     = document.getElementById('del-zip')?.value.trim();
      const phone   = document.getElementById('del-phone')?.value.trim();
      if (!name)    { Toast.error('Please enter your full name.');     return; }
      if (!address) { Toast.error('Please enter a delivery address.'); return; }
      if (!city)    { Toast.error('Please enter your city.');          return; }
      if (!zip)     { Toast.error('Please enter your ZIP code.');      return; }
      if (!phone)   { Toast.error('Please enter a phone number.');     return; }
      this.goTo(2);
    });

    payBack?.addEventListener('click',  () => this.goTo(1));
    cardBack?.addEventListener('click', () => this.goTo(2));
    tfBack?.addEventListener('click',   () => this.goTo(2));

    optCard?.addEventListener('click', () => this.goTo('3-card'));
    optXfer?.addEventListener('click', () => {
      const ref = `LL-${Date.now().toString(36).toUpperCase()}`;
      const refEl = document.getElementById('transfer-ref');
      const amtEl = document.getElementById('transfer-amount');
      if (refEl) refEl.textContent = ref;
      if (amtEl) amtEl.textContent = this._total;
      this.goTo('3-transfer');
    });

    // Live card preview
    const cardNumIn  = document.getElementById('card-number');
    const cardNameIn = document.getElementById('card-name');
    const cardExpIn  = document.getElementById('card-expiry');
    const cardCvvIn  = document.getElementById('card-cvv');
    const ccCard     = document.getElementById('cc-card');

    cardNumIn?.addEventListener('input', e => {
      let v = e.target.value.replace(/\D/g,'').substring(0,16);
      e.target.value = v.replace(/(.{4})/g,'$1 ').trim();
      const d = v.padEnd(16,'•');
      const el = document.getElementById('cc-num-display');
      if (el) el.textContent = d.replace(/(.{4})/g,'$1 ').trim();
    });
    cardNameIn?.addEventListener('input', e => {
      const el = document.getElementById('cc-name-display');
      if (el) el.textContent = e.target.value.toUpperCase() || 'YOUR NAME';
    });
    cardExpIn?.addEventListener('input', e => {
      let v = e.target.value.replace(/\D/g,'').substring(0,4);
      if (v.length >= 3) v = v.slice(0,2)+'/'+v.slice(2);
      e.target.value = v;
      const el = document.getElementById('cc-exp-display');
      if (el) el.textContent = v || 'MM/YY';
    });
    cardCvvIn?.addEventListener('focus', () => ccCard?.classList.add('flipped'));
    cardCvvIn?.addEventListener('blur',  () => ccCard?.classList.remove('flipped'));
    cardCvvIn?.addEventListener('input', e => {
      const v = e.target.value.replace(/\D/g,'').substring(0,3);
      e.target.value = v;
      const el = document.getElementById('cc-cvv-display');
      if (el) el.textContent = v.replace(/./g,'•') || '•••';
    });

    payForm?.addEventListener('submit', async e => {
      e.preventDefault();
      const num  = (cardNumIn?.value||'').replace(/\s/g,'');
      const name = cardNameIn?.value.trim()||'';
      const exp  = cardExpIn?.value||'';
      const cvv  = cardCvvIn?.value||'';
      if (num.length < 16) { Toast.error('Please enter a valid 16-digit card number.'); return; }
      if (!name)            { Toast.error('Please enter the cardholder name.'); return; }
      if (exp.length < 5)   { Toast.error('Please enter a valid expiry date (MM/YY).'); return; }
      if (cvv.length < 3)   { Toast.error('Please enter a valid 3-digit CVV.'); return; }
      const payBtn = document.getElementById('btn-pay-now');
      payBtn.disabled = true;
      payBtn.innerHTML = '<span class="spinner"></span> Processing…';
      try {
        const order = await API.post(`${API.base}/orders`, {});
        Cart.clearLocal();
        this.close();
        this._showSuccess(order?.id);
      } catch (err) {
        Toast.error(err.data?.message || 'Payment failed. Please try again.');
        payBtn.disabled = false;
        payBtn.innerHTML = '🔒 Pay Now';
      }
    });

    cfmXfer?.addEventListener('click', async () => {
      cfmXfer.disabled = true;
      cfmXfer.innerHTML = '<span class="spinner"></span> Confirming…';
      try {
        const order = await API.post(`${API.base}/orders`, {});
        Cart.clearLocal();
        this.close();
        this._showSuccess(order?.id);
      } catch (err) {
        Toast.error(err.data?.message || 'Could not place order. Please try again.');
        cfmXfer.disabled = false;
        cfmXfer.innerHTML = '✅ I\'ve Made the Transfer';
      }
    });

    viewOrds?.addEventListener('click', () => { window.location.href = '/orders/'; });
  },

  open(totalText) {
    this._total = totalText || '$0.00';
    const el = document.getElementById('modal-total');
    if (el) el.textContent = this._total;
    this.goTo(1);
    const backdrop = document.getElementById('checkout-modal');
    if (!backdrop) return;
    backdrop.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    setTimeout(() => backdrop.classList.add('open'), 10);
  },

  close() {
    const backdrop = document.getElementById('checkout-modal');
    if (!backdrop) return;
    backdrop.classList.remove('open');
    setTimeout(() => { backdrop.style.display = 'none'; document.body.style.overflow = ''; }, 300);
  },

  goTo(step) {
    this._step = step;
    const ids = ['co-step-1','co-step-2','co-step-3-card','co-step-3-transfer'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    const target = `co-step-${step}`;
    const el = document.getElementById(target);
    if (el) el.style.display = 'block';

    // Update step bar
    [1,2,3].forEach(n => {
      const s = document.getElementById(`csstep-${n}`);
      if (!s) return;
      const active = (step === n || (step === '3-card' && n === 3) || (step === '3-transfer' && n === 3));
      const done   = (typeof step === 'number' && n < step) || ((step === '3-card' || step === '3-transfer') && n < 3);
      s.classList.toggle('active', active);
      s.classList.toggle('done', done);
    });
  },

  _showSuccess(orderId) {
    const ov = document.getElementById('success-overlay');
    const num = document.getElementById('success-order-num');
    if (num) num.textContent = orderId ? `Order #${orderId}` : '';
    if (ov) {
      ov.style.display = 'flex';
      setTimeout(() => ov.classList.add('open'), 10);
    }
  },
};

/* ── Chatbot ──────────────────────────────────────── */
const Chatbot = {
  _open: false,
  _greeted: false,

  _kb: [
    { p: ['hello','hi','hey','howdy','morning','afternoon','evening','hola'], r: "Hello there! 👋 Great to have you here. I'm Lemon, the Little Lemon assistant. What can I help you with today?" },
    { p: ['hour','open','close','time','when are you','schedule'], r: "We're open every day from **11 AM to 10 PM** 🕐. Come on in — we'd love to see you!" },
    { p: ['location','address','where','find you','directions','map'], r: "You'll find us at **123 Mediterranean Ave, Chicago, IL 60601** 📍. We're in the heart of the city!" },
    { p: ['menu','food','dish','eat','serve','offer','what do you have','what can i'], r: "Our menu has something for everyone! 🍽️\n• **Starters** — Greek Salad, Hummus & Pita, Falafel\n• **Mains** — Grilled Lamb Chops, Pasta Arrabiata, Lemon Herb Chicken\n• **Seafood** — Grilled Sea Bass, Salmon Fillet, Calamari\n• **Desserts** — Baklava, Lemon Tart, Chocolate Lava Cake\n• **Drinks** — Fresh Lemonade, Mint Lemonade, Turkish Coffee\nCheck the full [Menu](/menu/) online!" },
    { p: ['deliver','delivery','order online','online order','shipping'], r: "Yes, we deliver across Chicago! 🛵 Order online, and your food arrives in **25–35 minutes**. Delivery fee is just **$3.99**." },
    { p: ['pay','payment','card','transfer','cash','how to pay'], r: "We accept **card payments** (Visa, Mastercard, Amex) and **bank transfers** for online orders. When you check out, you'll be able to choose! 💳" },
    { p: ['allerg','vegan','vegetarian','gluten','diet','dairy','nut'], r: "We have **vegetarian** and **vegan** options! 🌱 Please mention any allergies when you order — our kitchen can accommodate most dietary requirements." },
    { p: ['reserv','book','table','booking'], r: "For reservations, call us at **+1 (312) 555-0182** or email **hello@littlelemon.com**. We recommend booking ahead for weekends! 📞" },
    { p: ['contact','phone','email','call','reach'], r: "Reach us anytime:\n📞 **+1 (312) 555-0182**\n✉️ **hello@littlelemon.com**\nOr visit us at 123 Mediterranean Ave, Chicago." },
    { p: ['price','cost','expensive','cheap','how much','afford'], r: "Our prices are great value for authentic Mediterranean! 💰\n• Starters: $9.99–$12.99\n• Mains: $14.99–$26.99\n• Seafood: $14.99–$24.99\n• Desserts: $5.99–$8.99\n• Drinks: $2.99–$5.49" },
    { p: ['special','daily special','today','recommend','best','popular','favourite'], r: "Our Daily Specials rotate every 24 hours — check the **Home page** for today's picks! ⭐ Most popular: Grilled Lamb Chops, Grilled Sea Bass, and Greek Salad." },
    { p: ['thank','thanks','perfect','great','awesome','brilliant','cheers'], r: "You're so welcome! 🍋 Enjoy your meal, and don't hesitate to ask if you need anything else." },
    { p: ['bye','goodbye','see you','later','ciao'], r: "Goodbye! 👋 Hope to see you at Little Lemon soon. Have a wonderful day! 🌟" },
    { p: ['account','sign up','register','login','sign in'], r: "You can **create an account** or **sign in** using the button in the top-right corner. Having an account lets you place orders and track delivery!" },
    { p: ['cart','basket','order','checkout','buy'], r: "Ready to order? Browse our [Menu](/menu/), add items to your cart, and click the 🛒 cart icon to check out. We'll take care of the rest! 😊" },
  ],

  _quickReplies: ['📍 Location & Hours', '🍽️ Our Menu', '🚗 Delivery Info', '💳 Payment Options', '📞 Contact Us'],

  reply(msg) {
    const lower = msg.toLowerCase();
    for (const entry of this._kb) {
      if (entry.p.some(w => lower.includes(w))) return entry.r;
    }
    return "Hmm, I'm not sure about that! 😊 Try asking about our **menu**, **hours**, **delivery**, **reservations**, or **contact info** — or call us at **+1 (312) 555-0182**.";
  },

  _addMsg(text, role) {
    const msgs = document.getElementById('chatbot-msgs');
    if (!msgs) return;
    const div = document.createElement('div');
    div.className = `chat-msg chat-msg--${role}`;
    // Convert **bold** markdown to <strong>
    const html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g,'<br>').replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2">$1</a>');
    div.innerHTML = `${role==='bot'?'<span class="chat-av">🍋</span>':''}<div class="chat-bubble">${html}</div>`;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  },

  _showQuickReplies() {
    const el = document.getElementById('chatbot-qr');
    if (!el) return;
    el.innerHTML = this._quickReplies.map(r =>
      `<button class="chat-qr-btn" data-q="${r}">${r}</button>`).join('');
    el.querySelectorAll('.chat-qr-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this._addMsg(btn.dataset.q, 'user');
        el.innerHTML = '';
        setTimeout(() => this._botReply(btn.dataset.q), 600);
      });
    });
  },

  _botReply(msg) {
    const typing = document.createElement('div');
    typing.className = 'chat-msg chat-msg--bot chat-typing';
    typing.innerHTML = '<span class="chat-av">🍋</span><div class="chat-bubble"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>';
    const msgs = document.getElementById('chatbot-msgs');
    msgs?.appendChild(typing);
    msgs && (msgs.scrollTop = msgs.scrollHeight);
    setTimeout(() => {
      typing.remove();
      this._addMsg(this.reply(msg), 'bot');
    }, 900 + Math.random() * 400);
  },

  init() {
    const toggle  = document.getElementById('chatbot-toggle');
    const closeBtn= document.getElementById('chatbot-close-btn');
    const form    = document.getElementById('chatbot-form');
    const input   = document.getElementById('chatbot-input');
    if (!toggle) return;

    toggle.addEventListener('click', () => this.toggle());
    closeBtn?.addEventListener('click', () => this.close());
    form?.addEventListener('submit', e => {
      e.preventDefault();
      const msg = input?.value.trim();
      if (!msg) return;
      input.value = '';
      document.getElementById('chatbot-qr').innerHTML = '';
      this._addMsg(msg, 'user');
      this._botReply(msg);
    });

    setTimeout(() => {
      if (!this._open) {
        const badge = document.getElementById('chatbot-unread');
        if (badge) badge.style.display = 'flex';
      }
    }, 3000);
  },

  open() {
    this._open = true;
    const win  = document.getElementById('chatbot-window');
    const icon = document.getElementById('chatbot-toggle-icon');
    const badge= document.getElementById('chatbot-unread');
    win?.classList.add('open');
    if (icon) icon.textContent = '✕';
    if (badge) badge.style.display = 'none';
    if (!this._greeted) {
      this._greeted = true;
      setTimeout(() => {
        this._addMsg("Hello! 👋 Welcome to **Little Lemon** — Chicago's favourite Mediterranean restaurant! 🍋", 'bot');
        setTimeout(() => {
          this._addMsg("I'm **Lemon**, your virtual assistant. I can help with our menu, hours, delivery, reservations, and more. What can I do for you today?", 'bot');
          setTimeout(() => this._showQuickReplies(), 600);
        }, 800);
      }, 400);
    }
  },

  close() {
    this._open = false;
    document.getElementById('chatbot-window')?.classList.remove('open');
    const icon = document.getElementById('chatbot-toggle-icon');
    if (icon) icon.textContent = '💬';
  },

  toggle() { this._open ? this.close() : this.open(); },
};

/* ── Menu Card Template ───────────────────────────── */
function renderMenuCard(item, inCart = false) {
  const emoji  = itemEmoji(item);
  const color  = itemColor(item);
  const outOfStock = item.inventory <= 0;
  const imgUrl = FOOD_IMAGES[(item.title || '').toLowerCase()];
  const photoHtml = imgUrl
    ? `<img src="${imgUrl}" alt="${item.title}" loading="lazy" class="card-photo"
            onerror="this.parentElement.classList.remove('has-photo');this.remove()">`
    : '';
  return `
    <div class="menu-card fade-in-up" data-id="${item.id}">
      <div class="menu-card-img ${color}${imgUrl ? ' has-photo' : ''}">
        ${photoHtml}
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

  let data;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      data = await API.get(`${API.base}/menu-items/`);
      break;
    } catch (err) {
      if (attempt === 2) {
        console.error('[specials] load failed after retries:', err);
        grid.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px;grid-column:1/-1">Could not load specials. Please refresh.</p>';
        return;
      }
      await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
    }
  }

  const all = Array.isArray(data) ? data : (data && Array.isArray(data.results) ? data.results : []);

  if (!all.length) {
    grid.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px;grid-column:1/-1">No menu items available yet.</p>';
    return;
  }

  const specials = pickDailySpecials(all).filter(Boolean);
  try {
    grid.innerHTML = specials.map(i => renderMenuCard(i)).join('');
  } catch (renderErr) {
    console.error('[specials] render error:', renderErr);
    grid.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px;grid-column:1/-1">Could not display specials.</p>';
    return;
  }

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

  orderBtn?.addEventListener('click', () => {
    const t = totalEl?.textContent;
    Checkout.open(t);
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
  CartPanel.init();
  Checkout.init();
  Chatbot.init();

  const page = document.body.dataset.page;
  if (page === 'home')   initHome();
  if (page === 'menu')   initMenu();
  if (page === 'cart')   initCart();
  if (page === 'orders') initOrders();
  if (page === 'auth')   initAuth();
});
