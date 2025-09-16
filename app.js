// --- CONFIGURACIÓN ---
/  const API_ENDPOINT = '/.netlify/functions/engine';
/  const stripe = Stripe('pk_test_51RykGMA68QYOf35CXVLHnoL1IZeWbtC2Fn72tPNSP8sNLLAAW9zUgtNJZxsaujFACiPE49JXfLOhcMtJkbWM1FyI005rXaLSb5');

document.addEventListener('DOMContentLoaded', () => {
  const appContainer = document.getElementById('app-container');
  let allData = null;
  let currentDiscount = null; // Variable para almacenar el descuento aplicado

  // --- API Endpoint ---
  // La URL del servidor se obtiene desde una variable global definida en index.html
  const API_ENDPOINT = SERVER_URL;
  const stripe = Stripe('pk_test_51RykGMA68QYOf35CXVLHnoL1IZeWbtC2Fn72tPNSP8sNLLAAW9zUgtNJZxsaujFACiPE49JXfLOhcMtJkbWM1FyI005rXaLSb5');

  // --- Router y Navegación ---
  function navigateTo(path) {
    history.pushState(null, '', path);
    router();
  }

  function router() {
    const params = new URLSearchParams(window.location.hash.substring(1)); // Usar hash para routing
    const view = params.get('view');
    const category = params.get('category');
    const serviceId = params.get('service');
    const packageId = params.get('package');

    if (view === 'services') renderServicesView(category);
    else if (serviceId) renderServiceDetailView(serviceId);
    else if (packageId) renderPackageDetailView(packageId);
    else renderCategoriesView();
  }

  // --- Obtención de datos iniciales ---
  async function loadInitialData() {
    renderLoading();
    try {
      const response = await google.script.run
        .withSuccessHandler(data => {
          if (data.status === 'success') {
            allData = data;
            router();
          } else {
            renderError(data.message);
          }
        })
        .withFailureHandler(error => {
          renderError(error.message);
        })
        .getAppData();
    } catch (error) {
      renderError('No se pudo conectar con el servidor.');
    }
  }

  // --- VISTAS DE RENDERIZADO ---
  
  function renderLoading() {
    appContainer.innerHTML = document.getElementById('template-loading').innerHTML;
  }

  function renderError(message) {
    appContainer.innerHTML = `<div class="error-message">${message}</div>`;
  }

  function renderCategoriesView() {
    const template = document.getElementById('template-categories-view').innerHTML;
    appContainer.innerHTML = template;
    const grid = document.getElementById('categories-grid');
    grid.innerHTML = ''; // Limpiar grid

    const uniqueCategories = [...new Set(allData.services.map(s => s.category))];
    if (allData.packages.length > 0) {
        uniqueCategories.push("Paquetes Especiales");
    }

    uniqueCategories.forEach(category => {
      const categoryCard = document.createElement('div');
      categoryCard.className = 'category-card';
      // CORRECCIÓN: Usar data-category para identificar la categoría de forma segura
      categoryCard.dataset.category = category;
      
      // Asignar imagen (lógica de ejemplo)
      const representativeItem = allData.services.find(s => s.category === category) || { imageUrl: 'https://via.placeholder.com/300x200.png?text=Amor-Vael' };
      if (category === "Paquetes Especiales") {
        representativeItem.imageUrl = 'http://amor-vael.com/wp-content/uploads/2021/08/paquetes.jpg'; // URL de imagen para paquetes
      }

      categoryCard.innerHTML = `
        <img src="${representativeItem.imageUrl}" alt="${category}">
        <h3>${category}</h3>
      `;
      grid.appendChild(categoryCard);
    });
  }

  function renderServicesView(category) {
    const template = document.getElementById('template-services-view').innerHTML;
    appContainer.innerHTML = template;
    document.getElementById('category-title').textContent = category;
    const grid = document.getElementById('services-grid');
    grid.innerHTML = '';

    let itemsToShow;
    if (category === "Paquetes Especiales") {
      itemsToShow = allData.packages;
    } else {
      itemsToShow = allData.services.filter(s => s.category === category);
    }
    
    itemsToShow.forEach(item => {
      const isPackage = !!item.servicios; // Chequea si el item es un paquete
      const card = document.createElement('div');
      card.className = 'service-card';
      card.innerHTML = `
        <img src="${isPackage ? 'http://amor-vael.com/wp-content/uploads/2021/08/paquetes.jpg' : item.imageUrl}" alt="${item.name}">
        <h4>${item.name}</h4>
        <p>$${item.price.toLocaleString('es-MX')} MXN</p>
        <button class="cta-button" data-id="${item.id}" data-type="${isPackage ? 'package' : 'service'}">
            ${isPackage ? 'Ver Paquete' : 'Agendar Cita'}
        </button>
      `;
      grid.appendChild(card);
    });
  }
  
  // --- Lógica de los Modales (Detalles y Compra) ---

  function renderServiceDetailView(serviceId) {
    currentDiscount = null; // Reiniciar descuento
    const service = allData.services.find(s => s.id === serviceId);
    const modal = document.getElementById('booking-modal');
    
    document.getElementById('modal-service-name').textContent = service.name;
    document.getElementById('modal-service-description').textContent = service.description;
    document.getElementById('modal-service-duration').textContent = service.duration;
    document.getElementById('modal-service-price').textContent = service.price.toLocaleString('es-MX');
    document.getElementById('service-final-price').textContent = service.price.toLocaleString('es-MX');

    // ** CORRECCIÓN CLAVE: Mostrar nombre de especialista(s) **
    const specialistsText = service.specialistsData.map(sp => sp.name).join(' o ');
    document.getElementById('modal-specialist-name').textContent = specialistsText || 'Especialista a asignar';

    modal.style.display = 'block';

    // Configurar listeners del modal de servicio
    setupServiceModalListeners(service);
  }

  function renderPackageDetailView(packageId) {
    currentDiscount = null; // Reiniciar descuento
    const pkg = allData.packages.find(p => p.id === packageId);
    const modal = document.getElementById('package-modal');
    
    document.getElementById('modal-package-name').textContent = pkg.name;
    document.getElementById('modal-package-price').textContent = pkg.price.toLocaleString('es-MX');
    document.getElementById('pkg-final-price').textContent = pkg.price.toLocaleString('es-MX');
    
    const servicesList = document.getElementById('modal-package-services');
    servicesList.innerHTML = '';
    pkg.serviceDetails.forEach(s => {
        const li = document.createElement('li');
        li.textContent = s.name;
        servicesList.appendChild(li);
    });

    modal.style.display = 'block';

    // Configurar listeners del modal de paquete
    setupPackageModalListeners(pkg);
  }

  // --- Lógica de Descuentos ---

  async function applyDiscount(code, item, type) {
    const messageEl = document.getElementById(`${type}-discount-message`);
    const finalPriceEl = document.getElementById(`${type}-final-price`);

    if (!code) {
        messageEl.textContent = 'Por favor, ingresa un código.';
        messageEl.className = 'error';
        return;
    }
    
    messageEl.textContent = 'Validando...';
    messageEl.className = '';

    const params = { action: 'validateDiscountCode', code };
    if (type === 'pkg') params.packageId = item.id;
    if (type === 'service') params.serviceId = item.id;

    google.script.run
        .withSuccessHandler(response => {
            if (response.status === 'success') {
                currentDiscount = response.discount;
                const newPrice = calculateDiscountedPrice(item.price, currentDiscount);
                finalPriceEl.textContent = newPrice.toLocaleString('es-MX');
                messageEl.textContent = `¡Descuento de ${currentDiscount.Valor}${currentDiscount.Tipo === '%' ? '%' : ' MXN'} aplicado!`;
                messageEl.className = 'success';
            } else {
                currentDiscount = null;
                finalPriceEl.textContent = item.price.toLocaleString('es-MX');
                messageEl.textContent = response.message;
                messageEl.className = 'error';
            }
        })
        .withFailureHandler(err => {
            messageEl.textContent = 'Error al conectar con el servidor.';
            messageEl.className = 'error';
        })
        .validateDiscountCode(params);
  }
  
  function calculateDiscountedPrice(originalPrice, discount) {
      if (!discount) return originalPrice;
      if (discount.Tipo === '%') {
          return originalPrice * (1 - discount.Valor / 100);
      }
      if (discount.Tipo === 'MXN') {
          return Math.max(0, originalPrice - discount.Valor);
      }
      return originalPrice;
  }

  // --- CONFIGURACIÓN DE LISTENERS ---
  
  function setupServiceModalListeners(service) {
      const applyBtn = document.getElementById('apply-service-discount-btn');
      applyBtn.onclick = () => {
          const code = document.getElementById('service-discount-code').value;
          applyDiscount(code, service, 'service');
      };
      // Aquí iría el resto de listeners del modal de servicio (fecha, confirmar, etc.)
  }

  function setupPackageModalListeners(pkg) {
      const applyBtn = document.getElementById('apply-pkg-discount-btn');
      applyBtn.onclick = () => {
          const code = document.getElementById('pkg-discount-code').value;
          applyDiscount(code, pkg, 'pkg');
      };
      // Aquí iría el resto de listeners del modal de paquete (confirmar compra, etc.)
  }

  // --- Event Delegation Principal ---
  
  appContainer.addEventListener('click', e => {
    // ** CORRECCIÓN CLAVE: Delegación de eventos para clicks **
    const categoryCard = e.target.closest('.category-card');
    if (categoryCard) {
      const category = categoryCard.dataset.category;
      navigateTo(`#view=services&category=${category}`);
      return;
    }

    const actionButton = e.target.closest('.cta-button[data-id]');
    if (actionButton) {
      const id = actionButton.dataset.id;
      const type = actionButton.dataset.type;
      if (type === 'service') navigateTo(`#view=service-detail&service=${id}`);
      if (type === 'package') navigateTo(`#view=package-detail&package=${id}`);
      return;
    }
    
    if (e.target.matches('.back-link')) {
        e.preventDefault();
        history.back();
    }
  });

  document.body.addEventListener('click', e => {
      // Cerrar modales
      if (e.target.matches('.modal') || e.target.matches('.close-button')) {
          document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
          // Limpiar URL para evitar que el modal se reabra al recargar
          navigateTo('#');
      }
  });


  // --- Inicialización ---
  window.addEventListener('popstate', router);
  loadInitialData();
});
