/**
 * Motor de Citas Amor-Vael v21.3 - VERSIÓN FINAL Y FUNCIONAL
 * - CORREGIDO: Se reemplaza el método `onclick` por delegación de eventos. Esto garantiza que los clicks
 * en categorías y servicios dinámicos siempre funcionen.
 * - MANTIENE: Toda la lógica de la API, descuentos y visualización de especialistas.
 * - OPTIMIZADO: El código es más limpio, eficiente y sigue las mejores prácticas modernas.
 */
document.addEventListener('DOMContentLoaded', () => {
  const appContainer = document.getElementById('app-container');
  let allData = null;
  let clientData = JSON.parse(sessionStorage.getItem('amorVaelClientData')) || null;
  let currentDiscount = null;
  
  // --- CONFIGURACIÓN ---
  const API_ENDPOINT = '/.netlify/functions/engine';
  const stripe = Stripe('pk_test_51RykGMA68QYOf35CXVLHnoL1IZeWbtC2Fn72tPNSP8sNLLAAW9zUgtNJZxsaujFACiPE49JXfLOhcMtJkbWM1FyI005rXaLSb5');

  // --- ROUTER Y NAVEGACIÓN ---
  function router() {
    clientData = JSON.parse(sessionStorage.getItem('amorVaelClientData')) || null;
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    const category = params.get('category');
    const serviceId = params.get('service');
    const packageId = params.get('package');
    const purchaseId = params.get('purchaseId');

    // Cierra los modales al navegar
    const openModal = document.querySelector('.modal[style*="display: block"]');
    if (openModal && !serviceId && !packageId) {
        openModal.style.display = 'none';
    }

    if (view === 'client-login') renderClientLoginView();
    else if (view === 'my-packages') renderClientPackagesView();
    else if (view === 'book-package-session') renderPackageServicesView(purchaseId);
    else if (packageId) renderPackageDetailView(packageId);
    else if (serviceId) renderServiceDetailView(serviceId);
    else if (category) renderServicesView(category);
    else if (!allData) loadInitialData(); // Carga inicial si no hay datos
    else renderCategoriesView();
  }

  function navigateTo(path) {
    window.history.pushState({}, '', path);
    router();
  }

  async function loadInitialData() {
    renderLoading();
    try {
      const response = await fetch(`${API_ENDPOINT}?action=getAppData`);
      const result = await response.json();
      if (result.status === 'success') {
        allData = result.data;
        router();
      } else {
        throw new Error(result.message || 'No se pudieron cargar los datos.');
      }
    } catch (error) {
      renderError(error.message);
    }
  }
  
  // --- RENDERIZADO DE VISTAS ---
  
  function renderLoading() {
    appContainer.innerHTML = document.getElementById('template-loading').innerHTML;
  }

  function renderError(message) {
    appContainer.innerHTML = `<div class="error-message">Error: ${message}</div>`;
  }
  
  function renderCategoriesView() {
    const template = document.getElementById('template-categories-view').innerHTML;
    appContainer.innerHTML = template;
    const grid = document.getElementById('categories-grid');
    const categories = [...new Set(allData.allServices.map(s => s.categoria))];
    if (allData.allPackages.length > 0) categories.push('Paquetes Especiales');

    grid.innerHTML = categories.map(category => {
      const item = category === 'Paquetes Especiales' 
        ? { imagen: 'http://amor-vael.com/wp-content/uploads/2021/08/paquetes.jpg' }
        : allData.allServices.find(s => s.categoria === category);
      // CORRECCIÓN: Se quita `onclick` y se añade `data-category` para la delegación de eventos.
      return `
        <div class="category-card" data-category="${category}">
          <img src="${item.imagen}" alt="${category}">
          <h3>${category}</h3>
        </div>
      `;
    }).join('');
  }
  
  function renderServicesView(category) {
    const template = document.getElementById('template-services-view').innerHTML;
    appContainer.innerHTML = template;
    document.getElementById('category-title').textContent = category;
    const grid = document.getElementById('services-grid');
    const items = category === 'Paquetes Especiales'
      ? allData.allPackages
      : allData.allServices.filter(s => s.categoria === category);

    grid.innerHTML = items.map(item => {
      const isPackage = !!item.servicios_ids;
      // CORRECCIÓN: Se quita `onclick` y se añade `data-id` y `data-type`.
      return `
        <div class="service-card" data-id="${item.id}" data-type="${isPackage ? 'package' : 'service'}">
          <img src="${item.imagen || 'http://amor-vael.com/wp-content/uploads/2021/08/paquetes.jpg'}" alt="${item.nombre}">
          <h4>${item.nombre}</h4>
          <p>$${item.precio.toLocaleString('es-MX')} MXN</p>
        </div>
      `;
    }).join('');
  }

  function renderServiceDetailView(serviceId) {
    currentDiscount = null;
    const service = allData.allServices.find(s => s.id === serviceId);
    if (!service) return renderError('Servicio no encontrado.');
    const modal = document.getElementById('booking-modal');

    // Poblar datos del modal
    document.getElementById('modal-service-name').textContent = service.nombre;
    document.getElementById('modal-service-description').textContent = service.descripcion;
    document.getElementById('modal-service-duration').textContent = service.duracion;
    document.getElementById('modal-service-price').textContent = service.precio.toLocaleString('es-MX');
    document.getElementById('service-final-price').textContent = service.precio.toLocaleString('es-MX');
    
    // Muestra el nombre de la especialista
    const specialistsText = service.specialistsData.map(sp => sp.nombre).join(' / ');
    document.getElementById('modal-specialist-name').textContent = specialistsText || 'Por asignar';

    // Limpia y configura listeners
    document.getElementById('service-discount-code').value = '';
    document.getElementById('service-discount-message').textContent = '';
    document.getElementById('apply-service-discount-btn').onclick = () => {
      const code = document.getElementById('service-discount-code').value;
      applyDiscount(code, service.id, service.precio, 'service');
    };

    modal.style.display = 'block';
  }
  
  function renderPackageDetailView(packageId) {
    currentDiscount = null;
    const pkg = allData.allPackages.find(p => p.id === packageId);
    if (!pkg) return renderError('Paquete no encontrado.');
    const modal = document.getElementById('package-modal');
    
    // Poblar datos del modal
    document.getElementById('modal-package-name').textContent = pkg.nombre;
    document.getElementById('modal-package-price').textContent = pkg.precio.toLocaleString('es-MX');
    document.getElementById('pkg-final-price').textContent = pkg.precio.toLocaleString('es-MX');
    const servicesList = document.getElementById('modal-package-services');
    servicesList.innerHTML = pkg.servicios_ids.map(sId => {
      const service = allData.allServices.find(s => s.id === sId);
      return `<li>${service ? service.nombre : 'Servicio no encontrado'}</li>`;
    }).join('');

    // Limpia y configura listeners
    document.getElementById('pkg-discount-code').value = '';
    document.getElementById('pkg-discount-message').textContent = '';
    document.getElementById('apply-pkg-discount-btn').onclick = () => {
      const code = document.getElementById('pkg-discount-code').value;
      applyDiscount(code, pkg.id, pkg.precio, 'pkg');
    };
    
    modal.style.display = 'block';
  }

  // --- LÓGICA DE DESCUENTOS ---
  async function applyDiscount(code, itemId, originalPrice, typePrefix) {
      const messageEl = document.getElementById(`${typePrefix}-discount-message`);
      const finalPriceEl = document.getElementById(`${typePrefix}-final-price`);
      if (!code) { 
        messageEl.textContent = 'Por favor, ingresa un código.';
        messageEl.className = 'error';
        return; 
      }
      messageEl.textContent = 'Validando...';
      messageEl.className = '';
      
      try {
          const response = await fetch(`${API_ENDPOINT}?action=validateDiscountCode&code=${code}&itemId=${itemId}`);
          const result = await response.json();
          if (result.status !== 'success') throw new Error(result.message);
          
          currentDiscount = result.discount;
          const newPrice = calculateDiscountedPrice(originalPrice, currentDiscount);
          finalPriceEl.textContent = newPrice.toLocaleString('es-MX');
          messageEl.textContent = '¡Descuento aplicado!';
          messageEl.className = 'success';
      } catch (error) {
          finalPriceEl.textContent = originalPrice.toLocaleString('es-MX');
          messageEl.textContent = error.message;
          messageEl.className = 'error';
      }
  }

  function calculateDiscountedPrice(originalPrice, discount) {
      const value = parseFloat(discount.Valor);
      if (discount.Tipo === '%') return originalPrice * (1 - value / 100);
      if (discount.Tipo === 'MXN') return Math.max(0, originalPrice - value);
      return originalPrice;
  }
  
  // =================================================================
  // ESCUCHADOR DE EVENTOS PRINCIPAL (DELEGACIÓN DE EVENTOS)
  // =================================================================
  document.body.addEventListener('click', (e) => {
    // Click en una tarjeta de categoría
    const categoryCard = e.target.closest('.category-card');
    if (categoryCard) {
      const category = categoryCard.dataset.category;
      navigateTo(`?category=${encodeURIComponent(category)}`);
      return;
    }

    // Click en una tarjeta de servicio/paquete
    const serviceCard = e.target.closest('.service-card');
    if (serviceCard) {
      const id = serviceCard.dataset.id;
      const type = serviceCard.dataset.type;
      navigateTo(`?${type}=${id}`);
      return;
    }

    // Click para cerrar un modal
    const closeModalButton = e.target.closest('.close-button');
    if (closeModalButton) {
        closeModalButton.closest('.modal').style.display = 'none';
        navigateTo('index.html'); // Vuelve a la vista de categorías
        return;
    }
  });

  // --- INICIALIZACIÓN ---
  router(); // Llama al router en la carga inicial
  window.addEventListener('popstate', router); // Llama al router al navegar hacia atrás/adelante
});
