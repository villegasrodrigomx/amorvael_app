/**
 * Motor de Citas Amor-Vael v23.0 - Lógica del Frontend para Apps Script
 * - COMUNICACIÓN CORREGIDA: Ahora usa `google.script.run` para todas las llamadas al backend.
 * Esto es más robusto y es el método estándar para Apps Script.
 */
document.addEventListener('DOMContentLoaded', () => {
  // El código de app.js es idéntico a la última versión que te proporcioné,
  // ya que su lógica interna era correcta. El problema estaba en cómo se
  // comunicaba con un backend mal configurado. Al corregir Código.gs,
  // este archivo funcionará como se espera.
  const appContainer = document.getElementById('app-container');
  let allData = null; 
  let currentDiscount = null;

  function router() {
    const params = new URLSearchParams(window.location.hash.substring(1));
    const view = params.get('view');
    const category = params.get('category');
    const serviceId = params.get('service');
    const packageId = params.get('package');
    
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');

    if (view === 'services' && category) renderServicesView(category);
    else if (view === 'service-detail' && serviceId) renderServiceDetailView(serviceId);
    else if (view === 'package-detail' && packageId) renderPackageDetailView(packageId);
    else renderCategoriesView();
  }

  function navigateTo(hash) {
    window.location.hash = hash;
  }

  function loadInitialData() {
    renderLoading();
    google.script.run
      .withSuccessHandler(data => {
        if (data.status === 'success') {
          allData = data;
          router();
        } else {
          renderError(data.message);
        }
      })
      .withFailureHandler(error => renderError("Error de conexión: " + error.message))
      .getAppData();
  }

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
    if (!grid || !allData) return;

    grid.innerHTML = '';
    const uniqueCategories = [...new Set(allData.services.map(s => s.category))];
    if (allData.packages.length > 0) uniqueCategories.push("Paquetes Especiales");

    uniqueCategories.forEach(category => {
      const card = document.createElement('div');
      card.className = 'category-card';
      card.dataset.category = category;
      
      let imageUrl = allData.packages.length > 0 && category === "Paquetes Especiales"
        ? 'http://amor-vael.com/wp-content/uploads/2021/08/paquetes.jpg'
        : (allData.services.find(s => s.category === category) || {}).imageUrl || 'https://via.placeholder.com/300x200.png?text=Amor-Vael';
      
      card.innerHTML = `<img src="${imageUrl}" alt="${category}"><h3>${category}</h3>`;
      grid.appendChild(card);
    });
  }

  function renderServicesView(category) {
    const template = document.getElementById('template-services-view').innerHTML;
    appContainer.innerHTML = template;
    document.getElementById('category-title').textContent = category;
    const grid = document.getElementById('services-grid');
    grid.innerHTML = '';

    const itemsToShow = (category === "Paquetes Especiales")
      ? allData.packages
      : allData.services.filter(s => s.category === category);

    itemsToShow.forEach(item => {
      const isPackage = !!item.servicios;
      const card = document.createElement('div');
      card.className = 'service-card';
      card.innerHTML = `
        <img src="${isPackage ? 'http://amor-vael.com/wp-content/uploads/2021/08/paquetes.jpg' : item.imageUrl}" alt="${item.name}">
        <h4>${item.name}</h4>
        <p>$${item.price.toLocaleString('es-MX')} MXN</p>
        <button class="cta-button" data-id="${item.id}" data-type="${isPackage ? 'package' : 'service'}">
          ${isPackage ? 'Ver Paquete' : 'Agendar Cita'}
        </button>`;
      grid.appendChild(card);
    });
  }

  function renderServiceDetailView(serviceId) {
    currentDiscount = null;
    const service = allData.services.find(s => s.id === serviceId);
    if (!service) return renderError("Servicio no encontrado");

    const modal = document.getElementById('booking-modal');
    document.getElementById('modal-service-name').textContent = service.name;
    document.getElementById('modal-service-description').textContent = service.description;
    document.getElementById('modal-service-duration').textContent = service.duration;
    document.getElementById('modal-service-price').textContent = service.price.toLocaleString('es-MX');
    document.getElementById('service-final-price').textContent = service.price.toLocaleString('es-MX');
    
    const specialistsText = service.specialistsData.map(sp => sp.name).join(' o ');
    document.getElementById('modal-specialist-name').textContent = specialistsText || 'Especialista a asignar';

    document.getElementById('service-discount-code').value = '';
    document.getElementById('service-discount-message').textContent = '';
    
    modal.style.display = 'block';
    document.getElementById('apply-service-discount-btn').onclick = () => {
      const code = document.getElementById('service-discount-code').value;
      applyDiscount(code, service, 'service');
    };
  }

  function renderPackageDetailView(packageId) {
    currentDiscount = null;
    const pkg = allData.packages.find(p => p.id === packageId);
    if (!pkg) return renderError("Paquete no encontrado");

    const modal = document.getElementById('package-modal');
    document.getElementById('modal-package-name').textContent = pkg.name;
    document.getElementById('modal-package-price').textContent = pkg.price.toLocaleString('es-MX');
    document.getElementById('pkg-final-price').textContent = pkg.price.toLocaleString('es-MX');
    
    document.getElementById('modal-package-services').innerHTML = pkg.serviceDetails.map(s => `<li>${s.name}</li>`).join('');

    document.getElementById('pkg-discount-code').value = '';
    document.getElementById('pkg-discount-message').textContent = '';
    
    modal.style.display = 'block';
    document.getElementById('apply-pkg-discount-btn').onclick = () => {
      const code = document.getElementById('pkg-discount-code').value;
      applyDiscount(code, pkg, 'pkg');
    };
  }

  function applyDiscount(code, item, typePrefix) {
    const messageEl = document.getElementById(`${typePrefix}-discount-message`);
    const finalPriceEl = document.getElementById(`${typePrefix}-final-price`);

    if (!code) {
      messageEl.textContent = 'Por favor, ingresa un código.';
      messageEl.className = 'error';
      return;
    }
    
    messageEl.textContent = 'Validando...';
    messageEl.className = '';

    google.script.run
      .withSuccessHandler(response => {
        if (response.status === 'success') {
          currentDiscount = response.discount;
          const newPrice = calculateDiscountedPrice(item.price, currentDiscount);
          finalPriceEl.textContent = newPrice.toLocaleString('es-MX');
          messageEl.textContent = `¡Descuento aplicado!`;
          messageEl.className = 'success';
        } else {
          currentDiscount = null;
          finalPriceEl.textContent = item.price.toLocaleString('es-MX');
          messageEl.textContent = response.message;
          messageEl.className = 'error';
        }
      })
      .withFailureHandler(err => {
          messageEl.textContent = 'Error al validar el código.';
          messageEl.className = 'error';
      })
      .validateDiscountCode({ code: code, itemId: item.id });
  }
  
  function calculateDiscountedPrice(originalPrice, discount) {
    if (!discount) return originalPrice;
    const value = parseFloat(discount.Valor);
    if (discount.Tipo === '%') return originalPrice * (1 - value / 100);
    if (discount.Tipo === 'MXN') return Math.max(0, originalPrice - value);
    return originalPrice;
  }
  
  appContainer.addEventListener('click', (e) => {
    const categoryCard = e.target.closest('.category-card');
    if (categoryCard) return navigateTo(`view=services&category=${categoryCard.dataset.category}`);

    const actionButton = e.target.closest('.cta-button[data-id]');
    if (actionButton) {
      const type = actionButton.dataset.type;
      const id = actionButton.dataset.id;
      if (type === 'service') navigateTo(`view=service-detail&service=${id}`);
      if (type === 'package') navigateTo(`view=package-detail&package=${id}`);
    }
    
    if (e.target.closest('.back-link')) {
      e.preventDefault();
      navigateTo('');
    }
  });

  document.body.addEventListener('click', (e) => {
    if (e.target.matches('.modal') || e.target.matches('.close-button')) {
      e.target.closest('.modal').style.display = 'none';
      navigateTo('');
    }
  });

  window.addEventListener('hashchange', router);
  loadInitialData();
});
