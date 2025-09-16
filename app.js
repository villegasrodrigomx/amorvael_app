document.addEventListener('DOMContentLoaded', () => {
  const appContainer = document.getElementById('app-container');
  let allData = null;
  let clientData = JSON.parse(sessionStorage.getItem('amorVaelClientData')) || null;
  let currentDiscount = null;
  const API_ENDPOINT = '/.netlify/functions/engine';
  const stripe = Stripe('pk_test_51RykGMA68QYOf35CXVLHnoL1IZeWbtC2Fn72tPNSP8sNLLAAW9zUgtNJZxsaujFACiPE49JXfLOhcMtJkbWM1FyI005rXaLSb5');

  function router() {
      // Tu router original aquí
      const params = new URLSearchParams(window.location.search);
      if (params.get('packageId')) renderPackageDetailView(params.get('packageId'));
      else if (params.get('service')) renderServiceDetailView(params.get('service'));
      else if (params.get('category')) renderServicesView(params.get('category'));
      else if (!allData) loadInitialData();
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
          } else { throw new Error(result.message); }
      } catch (error) { renderError(error.message); }
  }

  // --- RENDERIZADO DE VISTAS ---
  function renderLoading() { appContainer.innerHTML = document.getElementById('template-loading').innerHTML; }
  function renderError(message) { appContainer.innerHTML = `<div class="error-message">Error: ${message}</div>`; }
  
  function renderCategoriesView() {
      const template = document.getElementById('template-categories-view').innerHTML;
      appContainer.innerHTML = template;
      const grid = document.getElementById('categories-grid');
      const categories = [...new Set(allData.allServices.map(s => s.categoria))];
      if (allData.allPackages.length > 0) categories.push('Paquetes Especiales');
      grid.innerHTML = categories.map(category => {
          const item = category === 'Paquetes Especiales' ? { imagen: 'http://amor-vael.com/wp-content/uploads/2021/08/paquetes.jpg' } : allData.allServices.find(s => s.categoria === category);
          return `<div class="category-card" onclick="navigateTo('?category=${encodeURIComponent(category)}')"><img src="${item.imagen}" alt="${category}"><h3>${category}</h3></div>`;
      }).join('');
  }
  
  function renderServicesView(category) {
      const template = document.getElementById('template-services-view').innerHTML;
      appContainer.innerHTML = template;
      document.getElementById('category-title').textContent = category;
      const grid = document.getElementById('services-grid');
      const items = category === 'Paquetes Especiales' ? allData.allPackages : allData.allServices.filter(s => s.categoria === category);
      grid.innerHTML = items.map(item => {
          const isPackage = !!item.servicios_ids;
          return `<div class="service-card" onclick="navigateTo('?${isPackage ? 'packageId' : 'service'}=${item.id}')"><img src="${item.imagen || 'http://amor-vael.com/wp-content/uploads/2021/08/paquetes.jpg'}" alt="${item.nombre}"><h4>${item.nombre}</h4><p>$${item.precio.toLocaleString('es-MX')} MXN</p></div>`;
      }).join('');
  }

  function renderPackageDetailView(packageId) {
      currentDiscount = null;
      const pkg = allData.allPackages.find(p => p.id === packageId);
      const modal = document.getElementById('package-modal');
      document.getElementById('modal-package-name').textContent = pkg.nombre;
      document.getElementById('modal-package-price').textContent = pkg.precio.toLocaleString('es-MX');
      document.getElementById('pkg-final-price').textContent = pkg.precio.toLocaleString('es-MX');
      document.getElementById('modal-package-services').innerHTML = pkg.servicios_ids.map(sId => `<li>${allData.allServices.find(s=>s.id===sId).nombre}</li>`).join('');
      document.getElementById('pkg-discount-code').value = '';
      document.getElementById('pkg-discount-message').textContent = '';
      document.getElementById('apply-pkg-discount-btn').onclick = () => applyDiscount(pkg.id, pkg.precio, 'pkg');
      modal.style.display = 'block';
      modal.querySelector('.close-button').onclick = () => { modal.style.display = 'none'; navigateTo('index.html'); };
  }

  function renderServiceDetailView(serviceId) {
      currentDiscount = null;
      const service = allData.allServices.find(s => s.id === serviceId);
      const modal = document.getElementById('booking-modal');
      document.getElementById('modal-service-name').textContent = service.nombre;
      document.getElementById('modal-service-description').textContent = service.descripcion;
      document.getElementById('modal-service-duration').textContent = service.duracion;
      document.getElementById('modal-service-price').textContent = service.precio.toLocaleString('es-MX');
      document.getElementById('service-final-price').textContent = service.precio.toLocaleString('es-MX');
      const specialistsText = service.specialistsData.map(sp => sp.nombre).join(' / ');
      document.getElementById('modal-specialist-name').textContent = specialistsText || 'Por asignar';
      document.getElementById('service-discount-code').value = '';
      document.getElementById('service-discount-message').textContent = '';
      document.getElementById('apply-service-discount-btn').onclick = () => applyDiscount(service.id, service.precio, 'service');
      modal.style.display = 'block';
      modal.querySelector('.close-button').onclick = () => { modal.style.display = 'none'; navigateTo('index.html'); };

      // Lógica original para buscar y mostrar horarios
      const dateInput = document.getElementById('booking-date');
      dateInput.onchange = async () => {
          const date = dateInput.value;
          const slotsContainer = document.getElementById('available-slots-container');
          slotsContainer.innerHTML = 'Buscando horarios...';
          try {
              const response = await fetch(`${API_ENDPOINT}?action=getAvailableSlots&serviceId=${serviceId}&date=${date}`);
              const result = await response.json();
              if (result.status === 'success' && result.availableSlots.length > 0) {
                  slotsContainer.innerHTML = result.availableSlots.map(slot => `<button class="slot-button">${slot}</button>`).join('');
              } else {
                  slotsContainer.innerHTML = 'No hay horarios disponibles para esta fecha.';
              }
          } catch (error) {
              slotsContainer.innerHTML = 'Error al buscar horarios.';
          }
      };
  }
  
  async function applyDiscount(itemId, originalPrice, typePrefix) {
      const code = document.getElementById(`${typePrefix}-discount-code`).value;
      const messageEl = document.getElementById(`${typePrefix}-discount-message`);
      const finalPriceEl = document.getElementById(`${typePrefix}-final-price`);
      if (!code) { messageEl.textContent = 'Ingresa un código.'; messageEl.className = 'error'; return; }
      messageEl.textContent = 'Validando...';
      try {
          const response = await fetch(`${API_ENDPOINT}?action=validateDiscountCode&code=${code}&itemId=${itemId}`);
          const result = await response.json();
          if (result.status !== 'success') throw new Error(result.message);
          currentDiscount = result.discount;
          const newPrice = calculateDiscountedPrice(originalPrice, currentDiscount);
          finalPriceEl.textContent = newPrice.toLocaleString('es-MX');
          messageEl.textContent = '¡Descuento aplicado!'; messageEl.className = 'success';
      } catch (error) {
          finalPriceEl.textContent = originalPrice.toLocaleString('es-MX');
          messageEl.textContent = error.message; messageEl.className = 'error';
      }
  }

  function calculateDiscountedPrice(originalPrice, discount) {
      const value = parseFloat(discount.Valor);
      if (discount.Tipo === '%') return originalPrice * (1 - value / 100);
      if (discount.Tipo === 'MXN') return Math.max(0, originalPrice - value);
      return originalPrice;
  }
  
  router();
  window.addEventListener('popstate', router);
});
