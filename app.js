// Éssente SPA Logic with Central Database

// State Management
const state = {
  cart: [],
  currentCategory: 'All',
  searchQuery: '',
  dietaryFilters: { // Renamed internally for tags filtering
    spicy: false,
    recommended: false,
    bestseller: false
  },
  currentView: 'menu', // 'menu', 'checkout', 'order-tracking'
  tableNumber: '',
  specialInstructions: '',
  couponApplied: null,
  activeOrderId: null,
  activeOrderProgress: 0,
  activeOrderStatusText: '',
  theme: 'light',
  customizerItem: null
};

// Available Coupons
const COUPONS = {
  'CILANTRO10': { code: 'CILANTRO10', type: 'percent', value: 10, description: '10% off your entire check' },
  'FREESERVICE': { code: 'FREESERVICE', type: 'flat_service', value: 50, description: '₹50 Service charge waived' },
  'FESTIVE20': { code: 'FESTIVE20', type: 'percent', value: 20, description: '20% off on special occasions' }
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  loadCartFromStorage();

  // Enrich database with checkout blueprint items
  enrichMenuData();

  renderCategories();
  renderMenu();
  updateCartBadge();
  setupEventListeners();

  // Pre-fill table number if present in URL query
  const urlParams = new URLSearchParams(window.location.search);
  const urlTable = urlParams.get('table');
  if (urlTable) {
    state.tableNumber = urlTable;
    updateTableBadges();
  }
});

// Theme Management
function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
    document.documentElement.classList.add('dark');
    state.theme = 'dark';
  } else {
    document.documentElement.classList.remove('dark');
    state.theme = 'light';
  }
  updateThemeIcon();
}

function toggleTheme() {
  if (state.theme === 'light') {
    document.documentElement.classList.add('dark');
    localStorage.setItem('theme', 'dark');
    state.theme = 'dark';
  } else {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', 'light');
    state.theme = 'light';
  }
  updateThemeIcon();
}

function updateThemeIcon() {
  const btn = document.getElementById('theme-toggle-btn');
  if (!btn) return;
  if (state.theme === 'dark') {
    btn.innerHTML = 'light_mode';
    btn.setAttribute('title', 'Switch to Light Mode');
  } else {
    btn.innerHTML = 'dark_mode';
    btn.setAttribute('title', 'Switch to Dark Mode');
  }
}

// Local Storage Cart Sync
function saveCartToStorage() {
  localStorage.setItem('cart', JSON.stringify(state.cart));
}

function loadCartFromStorage() {
  const stored = localStorage.getItem('cart');
  if (stored) {
    try {
      state.cart = JSON.parse(stored);
    } catch (e) {
      state.cart = [];
    }
  }
}

// Enrich Menu Data with blueprint-specific items using correct DB fields
function enrichMenuData() {
  let appetCat = MENU_DB.categories.find(c => c.name === 'Appetizers');
  if (appetCat) {
    if (!appetCat.items.some(i => i.name === 'Cilantro Infused Heirloom Salad')) {
      appetCat.items.unshift({
        name: 'Cilantro Infused Heirloom Salad',
        prices: [240],
        sizes: [],
        description: 'Wild arugula, citrus vinaigrette, and fresh cilantro sprigs.',
        tags: ['recommended'],
        addonGroup: 'sandwich'
      });
    }
  }

  let pastaCat = MENU_DB.categories.find(c => c.name === 'Pasta');
  if (pastaCat) {
    if (!pastaCat.items.some(i => i.name === 'Wild Mushroom Risotto')) {
      pastaCat.items.push({
        name: 'Wild Mushroom Risotto',
        prices: [320],
        sizes: [],
        description: 'Arborio rice, porcini dust, and organic herb oil.',
        tags: ['bestseller'],
        addonGroup: 'pasta'
      });
    }
  }
}

// Render Categories in the sticky scrolling bar
function renderCategories() {
  const container = document.getElementById('category-bar-inner');
  if (!container) return;

  const categories = ['All', ...MENU_DB.categories.map(c => c.name)];

  container.innerHTML = categories.map(cat => {
    const isActive = state.currentCategory === cat;
    return `
      <button onclick="selectCategory('${cat}')" class="category-btn font-label-lg text-[12px] tracking-[0.15em] uppercase pb-2 whitespace-nowrap text-on-surface-variant ${isActive ? 'active' : ''}">
        ${cat}
      </button>
    `;
  }).join('');
}

function selectCategory(cat) {
  state.currentCategory = cat;
  renderCategories();
  renderMenu();

  // Scroll to section dynamically if it exists on page
  if (cat !== 'All') {
    const sectionEl = document.getElementById(`section-${cat.replace(/\s+/g, '-').toLowerCase()}`);
    if (sectionEl) {
      const offset = 160; // offset for navbar + category sticky bar
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = sectionEl.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  }
}

// Render Menu Cards
function renderMenu() {
  const container = document.getElementById('menu-sections-container');
  if (!container) return;

  const searchQuery = state.searchQuery.toLowerCase();

  const filteredData = MENU_DB.categories.map(categoryObj => {
    // Filter Items in Category
    const items = categoryObj.items.filter(item => {
      const matchSearch = item.name.toLowerCase().includes(searchQuery);
      if (!matchSearch) return false;

      const tags = item.tags || [];

      // Apply custom tag filters (Spicy, Recommended, Bestseller)
      if (state.dietaryFilters.spicy && !tags.includes('spicy')) return false;
      if (state.dietaryFilters.recommended && !tags.includes('recommended')) return false;
      if (state.dietaryFilters.bestseller && !tags.includes('bestseller')) return false;

      return true;
    });

    return {
      ...categoryObj,
      items
    };
  }).filter(c => c.items.length > 0 && (state.currentCategory === 'All' || state.currentCategory === c.name));

  if (filteredData.length === 0) {
    container.innerHTML = `
      <div class="col-span-full text-center py-16">
        <span class="material-symbols-outlined text-outline text-5xl mb-4">search_off</span>
        <h3 class="font-display text-2xl text-primary mb-2">No culinary items found</h3>
        <p class="text-on-surface-variant font-body text-sm">Try adjusting your search query or filters.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filteredData.map(categoryObj => {
    const categoryId = `section-${categoryObj.name.replace(/\s+/g, '-').toLowerCase()}`;
    return `
      <div id="${categoryId}" class="col-span-full pt-6 mb-12">
        <h2 class="font-display text-2xl md:text-3xl font-semibold text-primary border-b border-cilantro-pale/30 pb-4 mb-8 tracking-tight">${categoryObj.name}</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-10">
          ${categoryObj.items.map(item => renderMenuCard(item, categoryObj.name)).join('')}
        </div>
      </div>
    `;
  }).join('');
}

// Render individual item card
function renderMenuCard(item, categoryName) {
  const tags = item.tags || [];

  // Format price display
  let priceHtml = '';
  if (item.prices.length > 1) {
    priceHtml = `₹${item.prices[0]} - ₹${item.prices[1]}`;
  } else {
    priceHtml = `₹${item.prices[0]}`;
  }

  // Format custom text tags without emojis
  const tagChips = tags.map(tag => {
    let classes = 'bg-surface-container-high text-on-surface border border-outline-variant/30';
    if (tag === 'bestseller') classes = 'bg-accent-orange/10 text-accent-orange border border-accent-orange/20';
    if (tag === 'recommended') classes = 'bg-tertiary-container/30 text-on-tertiary-container border border-tertiary-container/20';
    if (tag === 'spicy') classes = 'bg-accent-red/10 text-accent-red border border-accent-red/20';

    return `<span class="font-label-sm text-[9px] px-2.5 py-0.5 rounded-full uppercase tracking-wider font-semibold ${classes}">${tag}</span>`;
  }).join(' ');

  return `
    <div class="group flex flex-col p-6 rounded-xl hover:bg-surface-container-low/60 border border-transparent hover:border-outline-variant/10 transition-all duration-300">
      <div class="flex justify-between items-baseline mb-3 menu-item-border pb-2">
        <h3 class="font-display text-xl font-semibold text-primary group-hover:text-cilantro-main transition-colors duration-300 pr-2">${item.name}</h3>
        <span class="font-headline text-lg font-semibold text-cilantro-main whitespace-nowrap">${priceHtml}</span>
      </div>
      <p class="font-body text-sm text-on-surface-variant leading-relaxed italic mb-6">
        ${item.description}
      </p>
      <div class="flex flex-wrap items-center justify-between mt-auto gap-4">
        <div class="flex gap-2">
          ${tagChips}
        </div>
        <button onclick="handleAddToCartClick('${escapeHtml(item.name)}', '${escapeHtml(categoryName)}')" class="bg-surface-container-highest/60 hover:bg-cilantro-main hover:text-on-primary text-cilantro-main border border-cilantro-main/10 px-6 py-2.5 rounded-full font-semibold text-[12px] uppercase tracking-[0.15em] transition-all duration-300 active:scale-95 shadow-sm hover:shadow-md">
          Add to Order
        </button>
      </div>
    </div>
  `;
}

// Add to Cart Handlers
function handleAddToCartClick(name, categoryName) {
  // Find item
  const category = MENU_DB.categories.find(c => c.name === categoryName);
  if (!category) return;
  const item = category.items.find(i => i.name === name);
  if (!item) return;

  // Customizer Trigger (if item has multiple sizes OR if it links to an addonGroup)
  if (item.prices.length > 1 || item.addonGroup) {
    openCustomizer(item, categoryName);
  } else {
    // Quick Add
    addToCart(item, null, []);
    showToast(`Added ${item.name} to order`);
  }
}

function openCustomizer(item, categoryName) {
  state.customizerItem = { ...item, categoryName };

  const modal = document.getElementById('customizer-modal');
  const title = document.getElementById('customizer-title');
  const subtitle = document.getElementById('customizer-subtitle');
  const sizesContainer = document.getElementById('customizer-sizes');
  const addOnsContainer = document.getElementById('customizer-addons');
  const sizeSection = document.getElementById('customizer-size-section');
  const addOnsSection = document.getElementById('customizer-addons-section');

  title.innerText = item.name;
  if (subtitle) {
    subtitle.innerText = item.description || 'Artisanal ingredients prepared fresh for your table.';
  }

  // Render Sizes in grid layout
  if (item.prices.length > 1) {
    sizeSection.classList.remove('hidden');
    sizesContainer.innerHTML = item.prices.map((price, idx) => {
      const sizeLabel = item.sizes[idx] || (idx === 0 ? 'Regular' : 'Large');
      return `
        <label class="flex items-center justify-between p-3.5 rounded-xl border border-outline-variant/30 hover:border-cilantro-main/50 cursor-pointer transition-all bg-surface-container-lowest shadow-sm hover:shadow active:scale-[0.98]">
          <div class="flex items-center gap-3">
            <input type="radio" name="customizer-size" value="${idx}" ${idx === 0 ? 'checked' : ''} class="w-4 h-4 text-cilantro-main focus:ring-cilantro-main" onchange="updateCustomizerHighlights()">
            <span class="font-body text-sm font-medium text-on-surface">${sizeLabel}</span>
          </div>
          <span class="font-semibold text-sm text-cilantro-main">₹${price}</span>
        </label>
      `;
    }).join('');
  } else {
    sizeSection.classList.add('hidden');
    sizesContainer.innerHTML = '';
  }

  // Render Add-ons dynamically from category addon list in 2-column grid
  const addonGroup = item.addonGroup;
  if (addonGroup && MENU_DB.addons[addonGroup]) {
    const list = MENU_DB.addons[addonGroup];
    addOnsSection.classList.remove('hidden');
    addOnsContainer.innerHTML = list.map((addon, idx) => {
      return `
        <label class="flex items-center justify-between p-3.5 rounded-xl border border-outline-variant/30 hover:border-cilantro-main/50 cursor-pointer transition-all bg-surface-container-lowest shadow-sm hover:shadow active:scale-[0.98]">
          <div class="flex items-center gap-3">
            <input type="checkbox" name="customizer-addon" value="${idx}" class="w-4 h-4 rounded text-cilantro-main focus:ring-cilantro-main" onchange="updateCustomizerHighlights()">
            <span class="font-body text-sm font-medium text-on-surface">${addon.name}</span>
          </div>
          <span class="font-semibold text-xs text-cilantro-light">+₹${addon.price}</span>
        </label>
      `;
    }).join('');
  } else {
    addOnsSection.classList.add('hidden');
    addOnsContainer.innerHTML = '';
  }

  // Show Modal
  modal.classList.remove('hidden');
  modal.classList.add('flex');

  // Highlight initial selection
  updateCustomizerHighlights();
}

// Function to update highlights of selected options in the customization modal
function updateCustomizerHighlights() {
  // Sizes
  const sizeRadios = document.querySelectorAll('input[name="customizer-size"]');
  sizeRadios.forEach(radio => {
    const label = radio.closest('label');
    if (label) {
      if (radio.checked) {
        label.classList.add('border-cilantro-main', 'bg-cilantro-pale/35', 'dark:bg-cilantro-pale/10');
        label.classList.remove('border-outline-variant/30', 'bg-surface-container-lowest');
      } else {
        label.classList.remove('border-cilantro-main', 'bg-cilantro-pale/35', 'dark:bg-cilantro-pale/10');
        label.classList.add('border-outline-variant/30', 'bg-surface-container-lowest');
      }
    }
  });

  // Addons
  const addonChecks = document.querySelectorAll('input[name="customizer-addon"]');
  addonChecks.forEach(cb => {
    const label = cb.closest('label');
    if (label) {
      if (cb.checked) {
        label.classList.add('border-cilantro-main', 'bg-cilantro-pale/35', 'dark:bg-cilantro-pale/10');
        label.classList.remove('border-outline-variant/30', 'bg-surface-container-lowest');
      } else {
        label.classList.remove('border-cilantro-main', 'bg-cilantro-pale/35', 'dark:bg-cilantro-pale/10');
        label.classList.add('border-outline-variant/30', 'bg-surface-container-lowest');
      }
    }
  });
}

function closeCustomizer() {
  const modal = document.getElementById('customizer-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  state.customizerItem = null;
}

function submitCustomizer() {
  if (!state.customizerItem) return;

  const item = state.customizerItem;

  // Get Selected Size
  let sizeIndex = 0;
  let sizeLabel = null;
  let price = item.prices[0];

  if (item.prices.length > 1) {
    const selectedSizeRadio = document.querySelector('input[name="customizer-size"]:checked');
    if (selectedSizeRadio) {
      sizeIndex = parseInt(selectedSizeRadio.value);
      sizeLabel = item.sizes[sizeIndex] || (sizeIndex === 0 ? 'Regular' : 'Large');
      price = item.prices[sizeIndex];
    }
  }

  // Get Selected Addons
  const selectedAddOns = [];
  const checkedAddOns = document.querySelectorAll('input[name="customizer-addon"]:checked');
  const list = MENU_DB.addons[item.addonGroup] || [];

  checkedAddOns.forEach(cb => {
    const idx = parseInt(cb.value);
    selectedAddOns.push(list[idx]);
  });

  addToCart(item, sizeLabel, selectedAddOns, price);
  closeCustomizer();
  showToast(`Added customized ${item.name} to order`);
}

function addToCart(item, size = null, selectedAddOns = [], customPrice = null) {
  const basePrice = customPrice !== null ? customPrice : item.prices[0];

  // Calculate add-on cost
  const addOnsCost = selectedAddOns.reduce((sum, addOn) => sum + addOn.price, 0);
  const totalPricePerItem = basePrice + addOnsCost;

  // Generate unique item key for cart tracking
  const addOnsString = selectedAddOns.map(a => a.name).sort().join(',');
  const key = `${item.name}-${size || 'default'}-${addOnsString}`;

  const existing = state.cart.find(c => c.key === key);
  if (existing) {
    existing.quantity++;
  } else {
    state.cart.push({
      key,
      name: item.name,
      basePrice: basePrice,
      price: totalPricePerItem,
      size: size,
      addOns: selectedAddOns,
      quantity: 1,
      description: item.description
    });
  }

  saveCartToStorage();
  updateCartBadge();
  triggerBadgeBounce();
  renderFloatingCartBar();
}

// Cart Updates & calculations
function updateQuantity(key, delta) {
  const item = state.cart.find(c => c.key === key);
  if (!item) return;

  item.quantity += delta;
  if (item.quantity <= 0) {
    state.cart = state.cart.filter(c => c.key !== key);
  }

  saveCartToStorage();
  updateCartBadge();
  renderFloatingCartBar();

  if (state.currentView === 'checkout') {
    renderCheckoutScreen();
  }
}

function removeItem(key) {
  state.cart = state.cart.filter(c => c.key !== key);
  saveCartToStorage();
  updateCartBadge();
  renderFloatingCartBar();

  if (state.currentView === 'checkout') {
    renderCheckoutScreen();
  }
}

function updateCartBadge() {
  const badgeCount = state.cart.reduce((sum, item) => sum + item.quantity, 0);

  const badges = document.querySelectorAll('.cart-badge-count');
  badges.forEach(b => {
    b.innerText = badgeCount;
    if (badgeCount > 0) {
      b.classList.remove('hidden');
    } else {
      b.classList.add('hidden');
    }
  });
}

function triggerBadgeBounce() {
  const badges = document.querySelectorAll('.cart-badge-count');
  badges.forEach(b => {
    b.classList.remove('badge-bounce');
    void b.offsetWidth; // Trigger reflow
    b.classList.add('badge-bounce');
  });
}

function calculateSubtotal() {
  return state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

function renderFloatingCartBar() {
  const bar = document.getElementById('floating-cart-bar');
  if (!bar) return;

  const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = calculateSubtotal();

  if (count > 0 && state.currentView === 'menu') {
    bar.classList.remove('hidden');
    bar.innerHTML = `
      <div onclick="navigateTo('checkout')" class="bg-primary text-on-primary p-4 rounded-full shadow-2xl flex items-center justify-between group cursor-pointer hover:bg-cilantro-main transition-all duration-300 transform active:scale-95">
        <div class="flex items-center gap-4 ml-2">
          <div class="relative">
            <span class="material-symbols-outlined text-[24px]">shopping_bag</span>
            <span class="absolute -top-2 -right-2 bg-cilantro-light text-on-primary text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold cart-badge-count">${count}</span>
          </div>
          <div>
            <p class="font-semibold text-xs tracking-wider uppercase">Review Order</p>
            <p class="text-[9px] uppercase tracking-widest opacity-80">Fresh Garden-to-Table Dine In</p>
          </div>
        </div>
        <div class="flex items-center gap-4 mr-2">
          <p class="font-headline text-lg font-semibold">₹${subtotal}</p>
          <span class="material-symbols-outlined transform group-hover:translate-x-1 transition-transform">arrow_forward</span>
        </div>
      </div>
    `;
  } else {
    bar.classList.add('hidden');
  }
}

// Router & View Toggles
function navigateTo(viewName) {
  if (viewName === state.currentView) return;

  const menuView = document.getElementById('view-menu');
  const checkoutView = document.getElementById('view-checkout');
  const trackingView = document.getElementById('view-tracking');

  // Hide all
  [menuView, checkoutView, trackingView].forEach(v => {
    if (v) {
      v.classList.add('page-hidden');
    }
  });

  state.currentView = viewName;

  // Show selected
  if (viewName === 'menu') {
    if (menuView) menuView.classList.remove('page-hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    renderMenu();
    renderFloatingCartBar();
  } else if (viewName === 'checkout') {
    if (checkoutView) checkoutView.classList.remove('page-hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    renderCheckoutScreen();
  } else if (viewName === 'order-tracking') {
    if (trackingView) trackingView.classList.remove('page-hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    renderTrackingScreen();
  }

  // Update Active Link highlight in Navbar
  const menuLink = document.getElementById('nav-menu-link');
  if (menuLink) {
    if (viewName === 'menu') {
      menuLink.classList.add('text-cilantro-main', 'border-b-2', 'border-cilantro-main');
      menuLink.classList.remove('text-on-surface-variant');
    } else {
      menuLink.classList.remove('text-cilantro-main', 'border-b-2', 'border-cilantro-main');
      menuLink.classList.add('text-on-surface-variant');
    }
  }
}

// Render Checkout Page
function renderCheckoutScreen() {
  const itemsContainer = document.getElementById('checkout-items-list');
  const billingContainer = document.getElementById('billing-check-summary');

  if (!itemsContainer || !billingContainer) return;

  if (state.cart.length === 0) {
    itemsContainer.innerHTML = `
      <div class="text-center py-16 bg-surface-container-lowest cart-card-shadow rounded-xl p-8">
        <span class="material-symbols-outlined text-outline text-5xl mb-4">shopping_cart_off</span>
        <h3 class="font-display text-2xl text-primary mb-2">Your cart is empty</h3>
        <p class="text-on-surface-variant font-body text-sm mb-6">Explore our organic culinary offerings and select dishes to add.</p>
        <button onclick="navigateTo('menu')" class="bg-primary text-on-primary px-8 py-3 rounded-full font-semibold text-xs tracking-wider uppercase hover:bg-cilantro-main transition-colors shadow-sm">
          Return to Menu
        </button>
      </div>
    `;
    billingContainer.innerHTML = `
      <div class="bg-surface-container-lowest cart-card-shadow rounded-xl p-8 text-center text-on-surface-variant">
        Add items to configure guest check summary.
      </div>
    `;
    return;
  }

  // Render items list
  itemsContainer.innerHTML = state.cart.map(item => {
    const addOnsText = item.addOns.length > 0
      ? `<p class="text-xs text-secondary italic font-body">+ Add-ons: ${item.addOns.map(a => a.name).join(', ')}</p>`
      : '';
    const sizeText = item.size ? `<span class="text-xs font-semibold px-2 py-0.5 bg-cilantro-pale text-cilantro-main rounded-md">${item.size}</span>` : '';

    return `
      <div class="bg-surface-container-lowest cart-card-shadow rounded-xl p-6 flex flex-col md:flex-row gap-6 transition-all hover:shadow-lg items-start">
        <div class="flex-grow space-y-1 w-full">
          <div class="flex justify-between items-start w-full">
            <div>
              <div class="flex items-center gap-3">
                <h3 class="font-display text-lg font-semibold text-primary">${item.name}</h3>
                ${sizeText}
              </div>
              ${addOnsText}
            </div>
            <span class="font-headline text-lg font-semibold text-cilantro-main whitespace-nowrap">₹${item.price * item.quantity}</span>
          </div>
          <p class="text-on-surface-variant font-body text-xs">${item.description || ''}</p>
          <div class="pt-4 flex items-center justify-between">
            <div class="flex items-center gap-4 bg-surface-container-low rounded-full px-4 py-1">
              <button onclick="updateQuantity('${item.key}', -1)" class="material-symbols-outlined text-cilantro-main text-lg hover:scale-110 transition-transform">remove</button>
              <span class="font-semibold text-sm w-4 text-center">${item.quantity}</span>
              <button onclick="updateQuantity('${item.key}', 1)" class="material-symbols-outlined text-cilantro-main text-lg hover:scale-110 transition-transform">add</button>
            </div>
            <button onclick="removeItem('${item.key}')" class="text-error font-semibold text-xs hover:underline transition-all">REMOVE</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Calculate costs
  const subtotal = calculateSubtotal();
  const tax = Math.round(subtotal * 0.08); // 8% tax

  // Service charge is waivable via Coupon
  let serviceCharge = 50;
  if (state.couponApplied && state.couponApplied.waiveService) {
    serviceCharge = 0;
  }

  // Discount
  let discount = 0;
  let discountTextHtml = '';
  if (state.couponApplied) {
    if (state.couponApplied.type === 'percent') {
      discount = Math.round(subtotal * (state.couponApplied.value / 100));
      discountTextHtml = `
        <div class="flex justify-between font-body text-sm text-error">
          <span>Discount (${state.couponApplied.code})</span>
          <span class="font-medium">-₹${discount}</span>
        </div>
      `;
    } else if (state.couponApplied.type === 'flat_service') {
      discountTextHtml = `
        <div class="flex justify-between font-body text-sm text-cilantro-main">
          <span>Promo Applied</span>
          <span class="font-medium">Waived Service Charge</span>
        </div>
      `;
    }
  }

  const grandTotal = subtotal + tax + serviceCharge - discount;

  billingContainer.innerHTML = `
    <div class="bg-surface-container-lowest cart-card-shadow rounded-xl p-8 space-y-6">
      <div class="text-center border-b border-outline-variant/30 pb-6">
        <h2 class="font-display text-xl font-semibold text-primary mb-1">Guest Check</h2>
        <p class="font-semibold text-[10px] text-on-surface-variant uppercase tracking-widest">Digital Dine-In Order</p>
      </div>
      <div class="space-y-4 pt-4">
        <div class="flex justify-between font-body text-sm text-on-surface-variant">
          <span>Subtotal</span>
          <span class="font-medium">₹${subtotal}</span>
        </div>
        <div class="flex justify-between font-body text-sm text-on-surface-variant">
          <span>Tax (8%)</span>
          <span class="font-medium">₹${tax}</span>
        </div>
        <div class="flex justify-between font-body text-sm text-on-surface-variant">
          <span>Service Charge</span>
          <span class="font-medium">${serviceCharge > 0 ? '₹' + serviceCharge : '<span class="line-through text-outline">₹50</span> <span class="text-cilantro-main font-semibold ml-1">Free</span>'}</span>
        </div>
        ${discountTextHtml}
      </div>
      
      <!-- Promo code input -->
      <div class="pt-4 border-t border-outline-variant/20 flex gap-2">
        <input id="promo-input" type="text" placeholder="Promo Code" class="bg-surface-container-low border border-outline-variant/30 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-cilantro-main focus:border-cilantro-main w-full uppercase text-on-surface" value="${state.couponApplied ? state.couponApplied.code : ''}">
        <button onclick="handlePromoSubmit()" class="bg-cilantro-main hover:bg-cilantro-light text-on-primary px-4 py-2 rounded-lg font-semibold text-xs uppercase tracking-wider transition-colors">Apply</button>
      </div>
      ${state.couponApplied ? `<p class="text-xs text-cilantro-main text-center italic mt-1 font-medium">${state.couponApplied.description}</p>` : ''}

      <div class="pt-6 border-t border-dashed border-outline-variant/60 flex justify-between items-end mb-8">
        <div>
          <p class="font-semibold text-[10px] text-on-surface-variant uppercase tracking-widest mb-1">Total Due</p>
          <span class="font-display text-3xl font-bold text-primary">₹${grandTotal}</span>
        </div>
      </div>
      <button onclick="handleCheckoutClick()" class="w-full bg-primary text-on-primary py-4 rounded-full font-semibold text-sm tracking-wider uppercase transition-all active:scale-95 hover:bg-cilantro-main shadow-md flex items-center justify-center gap-3">
        <span class="material-symbols-outlined">lock</span>
        Proceed to Payment
      </button>
      <p class="text-center font-body text-[11px] text-on-surface-variant/70 italic">Secure digital tableside transaction</p>
    </div>
    
    <div class="mt-8 p-6 bg-cilantro-pale/25 dark:bg-cilantro-pale/5 rounded-xl border border-cilantro-pale/40">
      <h4 class="font-semibold text-xs text-cilantro-main mb-2">The Cilantro Quality Promise</h4>
      <p class="font-body text-xs text-on-surface-variant leading-relaxed">Your order is prepared fresh from our garden-to-table kitchen. Please allow 15-20 minutes for artisanal preparation.</p>
    </div>
  `;
}

// Promo code submission
function handlePromoSubmit() {
  const input = document.getElementById('promo-input');
  if (!input) return;

  const code = input.value.trim().toUpperCase();
  if (!code) {
    state.couponApplied = null;
    showToast('Promo code removed');
    renderCheckoutScreen();
    return;
  }

  const coupon = COUPONS[code];
  if (coupon) {
    state.couponApplied = {
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      description: coupon.description,
      waiveService: coupon.type === 'flat_service'
    };
    showToast(`Code ${code} applied successfully!`);
  } else {
    state.couponApplied = null;
    showToast('Invalid Coupon Code', 'error');
  }
  renderCheckoutScreen();
}

// Checkout and Service Details Form Validation
function handleCheckoutClick() {
  const tableInput = document.getElementById('table-number-input');
  const instructionsInput = document.getElementById('special-instructions-input');

  if (tableInput) {
    state.tableNumber = tableInput.value.trim();
  }
  if (instructionsInput) {
    state.specialInstructions = instructionsInput.value.trim();
  }

  // Validate Table Number
  if (!state.tableNumber) {
    showToast('Please enter your Table Number to proceed.', 'error');
    if (tableInput) {
      tableInput.focus();
      tableInput.classList.add('border-error');
      setTimeout(() => tableInput.classList.remove('border-error'), 3000);
    }
    return;
  }

  openPaymentModal();
}

// Payment Modal Handling
function openPaymentModal() {
  const modal = document.getElementById('payment-modal');
  if (!modal) return;

  // Set the total in payment modal
  const subtotal = calculateSubtotal();
  const tax = Math.round(subtotal * 0.08);
  const serviceCharge = (state.couponApplied && state.couponApplied.waiveService) ? 0 : 50;
  const discount = state.couponApplied
    ? (state.couponApplied.type === 'percent' ? Math.round(subtotal * (state.couponApplied.value / 100)) : 0)
    : 0;
  const total = subtotal + tax + serviceCharge - discount;

  const paymentAmountEl = document.getElementById('payment-modal-amount');
  if (paymentAmountEl) {
    paymentAmountEl.innerText = `₹${total}`;
  }

  // Setup mock card inputs validation
  const payBtn = document.getElementById('mock-pay-submit-btn');
  if (payBtn) {
    payBtn.disabled = false;
    payBtn.innerText = 'Pay Securely';
  }

  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closePaymentModal() {
  const modal = document.getElementById('payment-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

function selectPaymentMethod(method) {
  const methods = ['card', 'upi', 'pay'];
  methods.forEach(m => {
    const el = document.getElementById(`pay-method-${m}`);
    const detailEl = document.getElementById(`pay-details-${m}`);
    if (el) {
      if (m === method) {
        el.classList.add('border-cilantro-main', 'bg-cilantro-pale/10');
        el.classList.remove('border-outline-variant/30');
      } else {
        el.classList.remove('border-cilantro-main', 'bg-cilantro-pale/10');
        el.classList.add('border-outline-variant/30');
      }
    }
    if (detailEl) {
      if (m === method) {
        detailEl.classList.remove('hidden');
      } else {
        detailEl.classList.add('hidden');
      }
    }
  });
}

function processPayment() {
  const payBtn = document.getElementById('mock-pay-submit-btn');
  if (payBtn) {
    payBtn.disabled = true;
    payBtn.innerHTML = `<span class="material-symbols-outlined animate-spin text-sm mr-2 align-middle">autorenew</span>Processing...`;
  }

  setTimeout(() => {
    closePaymentModal();

    state.activeOrderId = 'CC-' + Math.floor(1000 + Math.random() * 9000);
    state.activeOrderProgress = 0;

    state.lastOrderedItems = [...state.cart];
    state.lastTableNumber = state.tableNumber;
    state.lastOrderTotal = calculateSubtotal() + Math.round(calculateSubtotal() * 0.08) + ((state.couponApplied && state.couponApplied.waiveService) ? 0 : 50) - (state.couponApplied ? (state.couponApplied.type === 'percent' ? Math.round(calculateSubtotal() * (state.couponApplied.value / 100)) : 0) : 0);

    state.cart = [];
    state.couponApplied = null;
    saveCartToStorage();
    updateCartBadge();
    renderFloatingCartBar();

    navigateTo('order-tracking');
    startOrderStatusSimulation();

    showToast('Payment successful! Order placed.', 'success');
  }, 2000);
}

// Order Progress Simulation
let statusInterval = null;
function startOrderStatusSimulation() {
  if (statusInterval) clearInterval(statusInterval);

  state.activeOrderProgress = 0;
  updateProgressUI();

  statusInterval = setInterval(() => {
    state.activeOrderProgress += 10;
    if (state.activeOrderProgress >= 100) {
      state.activeOrderProgress = 100;
      clearInterval(statusInterval);
      triggerConfetti();
    }
    updateProgressUI();
  }, 4000);
}

function updateProgressUI() {
  const steps = [
    { threshold: 0, title: 'Order Confirmed', desc: 'Kitchen has received your order.', icon: 'receipt_long' },
    { threshold: 30, title: 'In Kitchen', desc: 'Chef is hand-stretching the sourdough base.', icon: 'cooking' },
    { threshold: 60, title: 'Oven & Baking', desc: 'Sizzling at 400°C for perfect char.', icon: 'local_fire_department' },
    { threshold: 85, title: 'Quality Check & Plating', desc: 'Fusing finishing herbs and oils.', icon: 'award_star' },
    { threshold: 100, title: 'Served to Table', desc: `Hot dishes delivered to Table ${state.lastTableNumber || '14'}. Enjoy!`, icon: 'restaurant' }
  ];

  let currentStep = steps[0];
  steps.forEach(step => {
    if (state.activeOrderProgress >= step.threshold) {
      currentStep = step;
    }
  });

  const progressBar = document.getElementById('tracking-progress-bar');
  const progressText = document.getElementById('tracking-progress-text');
  const currentStepTitle = document.getElementById('tracking-step-title');
  const currentStepDesc = document.getElementById('tracking-step-desc');
  const currentStepIcon = document.getElementById('tracking-step-icon');

  if (progressBar) {
    progressBar.style.width = `${state.activeOrderProgress}%`;
  }
  if (progressText) {
    progressText.innerText = `Prep Stage: ${state.activeOrderProgress}% Completed`;
  }
  if (currentStepTitle) {
    currentStepTitle.innerText = currentStep.title;
  }
  if (currentStepDesc) {
    currentStepDesc.innerText = currentStep.desc;
  }
  if (currentStepIcon) {
    let sym = currentStep.icon;
    if (sym === 'cooking') sym = 'restaurant_menu';
    currentStepIcon.innerText = sym;
  }

  // Update step indicators
  const dots = document.querySelectorAll('.tracking-dot');
  const lines = document.querySelectorAll('.tracking-line');

  dots.forEach((dot, idx) => {
    const thresh = idx * 25;
    if (state.activeOrderProgress >= thresh) {
      dot.classList.add('bg-cilantro-main', 'text-on-primary');
      dot.classList.remove('bg-surface-container-highest', 'text-outline');
    } else {
      dot.classList.remove('bg-cilantro-main', 'text-on-primary');
      dot.classList.add('bg-surface-container-highest', 'text-outline');
    }
  });

  lines.forEach((line, idx) => {
    const thresh = (idx + 1) * 25;
    if (state.activeOrderProgress >= thresh) {
      line.classList.add('bg-cilantro-main');
      line.classList.remove('bg-surface-container-highest');
    } else {
      line.classList.remove('bg-cilantro-main');
      line.classList.add('bg-surface-container-highest');
    }
  });
}

function renderTrackingScreen() {
  const orderIdEl = document.getElementById('tracking-order-id');
  const detailsEl = document.getElementById('tracking-order-summary');

  if (orderIdEl) {
    orderIdEl.innerText = state.activeOrderId || '#CC-0000';
  }

  if (detailsEl && state.lastOrderedItems) {
    detailsEl.innerHTML = `
      <div class="border-b border-outline-variant/30 pb-4 mb-4">
        <h4 class="font-display text-sm font-semibold text-primary mb-2">Delivery Location</h4>
        <p class="text-xs font-body text-on-surface-variant">Dine-in Order at <span class="font-bold text-cilantro-main">Table ${state.lastTableNumber || '14'}</span></p>
      </div>
      <div class="space-y-3">
        <h4 class="font-semibold text-[10px] text-on-surface-variant uppercase tracking-widest">Ordered Items</h4>
        ${state.lastOrderedItems.map(item => {
      const sizeHtml = item.size ? `<span class="text-[10px] px-1.5 py-0.5 bg-surface-container rounded text-on-surface-variant">${item.size}</span>` : '';
      const addOnsHtml = item.addOns.length > 0 ? `<div class="text-[10px] text-secondary font-body">+ ${item.addOns.map(a => a.name).join(', ')}</div>` : '';
      return `
            <div class="flex justify-between items-start text-xs">
              <div>
                <div class="flex items-center gap-2">
                  <span class="font-semibold text-cilantro-main">${item.quantity}x</span>
                  <span class="text-on-surface font-medium">${item.name}</span>
                  ${sizeHtml}
                </div>
                ${addOnsHtml}
              </div>
              <span class="font-semibold text-on-surface">₹${item.price * item.quantity}</span>
            </div>
          `;
    }).join('')}
      </div>
      <div class="border-t border-dashed border-outline-variant/40 pt-4 mt-4 flex justify-between font-semibold text-sm text-primary">
        <span>Grand Total Paid</span>
        <span class="font-bold text-cilantro-main">₹${state.lastOrderTotal}</span>
      </div>
    `;
  }
}

// Celebration Confetti
function triggerConfetti() {
  const container = document.getElementById('view-tracking');
  if (!container) return;

  const colors = ['#4a7c42', '#6b9b63', '#C5A059', '#e67e22', '#c0392b'];

  for (let i = 0; i < 40; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    confetti.style.left = `${Math.random() * 100}%`;
    confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.animationDelay = `${Math.random() * 2}s`;
    confetti.style.transform = `scale(${Math.random() * 0.7 + 0.3})`;

    container.appendChild(confetti);
    setTimeout(() => confetti.remove(), 4500);
  }
}

// Setup Event Listeners
function setupEventListeners() {
  // Search
  const searchInput = document.getElementById('menu-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      renderMenu();
    });
  }

  // Clear Search
  const clearSearchBtn = document.getElementById('clear-search-btn');
  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      const input = document.getElementById('menu-search-input');
      if (input) {
        input.value = '';
        state.searchQuery = '';
        renderMenu();
      }
    });
  }

  // Dynamic tags checkboxes (Spicy, Recommended, Bestseller)
  const toggles = [
    { id: 'diet-spicy', prop: 'spicy' },
    { id: 'diet-recommended', prop: 'recommended' },
    { id: 'diet-bestseller', prop: 'bestseller' }
  ];

  toggles.forEach(t => {
    const checkbox = document.getElementById(t.id);
    if (checkbox) {
      checkbox.addEventListener('change', (e) => {
        state.dietaryFilters[t.prop] = e.target.checked;

        const label = checkbox.closest('label');
        if (label) {
          if (e.target.checked) {
            label.classList.add('bg-cilantro-pale', 'text-cilantro-main', 'border-cilantro-main/30');
            label.classList.remove('bg-surface-container-low', 'text-on-surface-variant', 'border-transparent');
          } else {
            label.classList.remove('bg-cilantro-pale', 'text-cilantro-main', 'border-cilantro-main/30');
            label.classList.add('bg-surface-container-low', 'text-on-surface-variant', 'border-transparent');
          }
        }

        renderMenu();
      });
    }
  });

  // Table Number direct navigation
  const editTableBtn = document.getElementById('edit-table-btn');
  if (editTableBtn) {
    editTableBtn.addEventListener('click', () => {
      const number = prompt("Enter Table Number:", state.tableNumber || "14");
      if (number !== null) {
        state.tableNumber = number.trim();
        updateTableBadges();
      }
    });
  }
}

function updateTableBadges() {
  const badges = document.querySelectorAll('.table-badge-num');
  badges.forEach(b => {
    b.innerText = state.tableNumber || '--';
  });

  const containers = document.querySelectorAll('.table-badge-container');
  containers.forEach(c => {
    if (state.tableNumber) {
      c.classList.remove('hidden');
      c.classList.add('flex');
    } else {
      c.classList.add('hidden');
      c.classList.remove('flex');
    }
  });

  // Also sync form input on checkout page
  const tableInput = document.getElementById('table-number-input');
  if (tableInput) {
    tableInput.value = state.tableNumber;
  }
}

// Toast System
function showToast(message, type = 'success') {
  const toastContainer = document.getElementById('toast-container');
  if (!toastContainer) return;

  const toast = document.createElement('div');
  toast.className = `p-4 rounded-xl shadow-lg flex items-center gap-3 transform translate-y-4 opacity-0 transition-all duration-300 ${type === 'error' ? 'bg-error text-on-error' : 'bg-primary text-on-primary'
    }`;

  const icon = type === 'error' ? 'error' : 'check_circle';

  toast.innerHTML = `
    <span class="material-symbols-outlined text-[20px]">${icon}</span>
    <span class="font-body font-medium text-sm">${message}</span>
  `;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.remove('translate-y-4', 'opacity-0');
  }, 10);

  setTimeout(() => {
    toast.classList.add('translate-y-4', 'opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// HTML Escaper helper
function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
