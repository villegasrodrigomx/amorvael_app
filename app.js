/**
 * Motor de Citas Amor-Vael v21.3 - VERSIÓN FINAL CON IMÁGENES DE CATEGORÍA
 * - RESTAURADO: Se reincorpora la función `getCategoryImage` para asignar imágenes
 * específicas a cada categoría, tal como en el sistema original.
 * - MANTIENE: La delegación de eventos para una navegación funcional y todas las mejoras anteriores.
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
    const packageId = params.get('packageId');
    const purchaseId = params.get('purchaseId');

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
      } else {
        throw new Error(result.message || 'No se pudieron cargar los datos.');
      }
    } catch (error) {
      renderError(error.message);
    }
  }

  // --- RENDERIZADO DE VISTAS ---
  
  function renderLoading() { appContainer.innerHTML = document.getElementById('template-loading').innerHTML; }
  function renderError(message) { appContainer.innerHTML = `<div class="error-message">Error: ${message}</div>`; }
  
  function renderCategoriesView() {
      const template = document.getElementById('template-categories-view').innerHTML;
      appContainer.innerHTML = template;
      const grid = document.getElementById('categories-grid');
      let categories = [];
      if(allData && allData.allServices) {
          categories = [...new Set(allData.allServices.map(s => s.categoria))];
      }
      if (allData && allData.allPackages && allData.allPackages.length > 0) {
        const packageCategories = [...new Set(allData.allPackages.map(p => p.categoria))].filter(Boolean);
        packageCategories.forEach(pc => {
          if (!categories.includes(pc)) categories.push(pc);
        });
        categories.push('Paquetes Especiales');
      }
      
      grid.innerHTML = categories.map(category => {
          // SE LLAMA A LA FUNCIÓN RESTAURADA PARA OBTENER LA IMAGEN
          const itemImage = getCategoryImage(category);
          return `<div class="category-card" data-category="${encodeURIComponent(category)}"><img src="${itemImage}" alt="${category}"><h3>${category}</h3></div>`;
      }).join('');
      document.querySelector('.client-area-link').onclick = (e) => { e.preventDefault(); navigateTo('?view=client-login'); };
  }
  
  function renderServicesView(category) {
      const template = document.getElementById('template-services-view').innerHTML;
      appContainer.innerHTML = template;
      document.getElementById('category-title').textContent = category;
      const grid = document.getElementById('services-grid');
      const items = category === 'Paquetes Especiales' 
          ? allData.allPackages 
          : [...(allData.allServices || []), ...(allData.allPackages || [])].filter(item => item.categoria === category);
      grid.innerHTML = items.map(item => {
          const isPackage = !!item.servicios_ids;
          return `<div class="service-card" data-type="${isPackage ? 'packageId' : 'service'}" data-id="${item.id}"><img src="${item.imagen}" alt="${item.nombre}"><h4>${item.nombre}</h4><p>$${item.precio.toLocaleString('es-MX')} MXN</p></div>`;
      }).join('');
  }

  function renderPackageDetailView(packageId) {
      currentDiscount = null; const pkg = allData.allPackages.find(p => p.id === packageId); const modal = document.getElementById('package-modal'); document.getElementById('modal-package-name').textContent = pkg.nombre; document.getElementById('modal-package-price').textContent = pkg.precio.toLocaleString('es-MX'); document.getElementById('pkg-final-price').textContent = pkg.precio.toLocaleString('es-MX'); document.getElementById('modal-package-services').innerHTML = pkg.servicios_ids.map(sId => `<li>${allData.allServices.find(s=>s.id===sId)?.nombre || 'Servicio'}</li>`).join(''); document.getElementById('pkg-discount-code').value = ''; document.getElementById('pkg-discount-message').textContent = ''; document.getElementById('apply-pkg-discount-btn').onclick = () => applyDiscount(pkg.id, pkg.precio, 'pkg'); modal.style.display = 'block';
  }

  function renderServiceDetailView(serviceId) {
      currentDiscount = null; const service = allData.allServices.find(s => s.id === serviceId); const modal = document.getElementById('booking-modal'); document.getElementById('modal-service-name').textContent = service.nombre; document.getElementById('modal-service-description').textContent = service.descripcion; document.getElementById('modal-service-duration').textContent = service.duracion; document.getElementById('modal-service-price').textContent = service.precio.toLocaleString('es-MX'); document.getElementById('service-final-price').textContent = service.precio.toLocaleString('es-MX'); const specialistsText = service.specialistsData.map(sp => sp.nombre).join(' / '); document.getElementById('modal-specialist-name').textContent = specialistsText || 'Por asignar'; document.getElementById('service-discount-code').value = ''; document.getElementById('service-discount-message').textContent = ''; document.getElementById('apply-service-discount-btn').onclick = () => applyDiscount(service.id, service.precio, 'service'); modal.style.display = 'block'; const dateInput = document.getElementById('booking-date'); dateInput.onchange = async () => { const date = dateInput.value; const slotsContainer = document.getElementById('available-slots-container'); slotsContainer.innerHTML = 'Buscando horarios...'; document.querySelectorAll('.slot-button').forEach(b => b.classList.remove('selected')); try { const response = await fetch(`${API_ENDPOINT}?action=getAvailableSlots&serviceId=${serviceId}&date=${date}`); const result = await response.json(); if (result.status === 'success' && result.availableSlots.length > 0) { slotsContainer.innerHTML = result.availableSlots.map(slot => `<button class="slot-button">${slot}</button>`).join(''); } else { slotsContainer.innerHTML = 'No hay horarios disponibles para esta fecha.'; } } catch (error) { slotsContainer.innerHTML = 'Error al buscar horarios.'; } }; document.getElementById('available-slots-container').addEventListener('click', e => { if (e.target.classList.contains('slot-button')) { document.querySelectorAll('.slot-button').forEach(b => b.classList.remove('selected')); e.target.classList.add('selected'); } });
  }
  
  async function applyDiscount(itemId, originalPrice, typePrefix) {
      const code = document.getElementById(`${typePrefix}-discount-code`).value; const messageEl = document.getElementById(`${typePrefix}-discount-message`); const finalPriceEl = document.getElementById(`${typePrefix}-final-price`); if (!code) { messageEl.textContent = 'Ingresa un código.'; messageEl.className = 'error'; return; } messageEl.textContent = 'Validando...'; try { const response = await fetch(`${API_ENDPOINT}?action=validateDiscountCode&code=${code}&itemId=${itemId}`); const result = await response.json(); if (result.status !== 'success') throw new Error(result.message); currentDiscount = result.discount; const newPrice = calculateDiscountedPrice(originalPrice, currentDiscount); finalPriceEl.textContent = newPrice.toLocaleString('es-MX'); messageEl.textContent = '¡Descuento aplicado!'; messageEl.className = 'success'; } catch (error) { finalPriceEl.textContent = originalPrice.toLocaleString('es-MX'); messageEl.textContent = error.message; messageEl.className = 'error'; }
  }

  function calculateDiscountedPrice(originalPrice, discount) {
      const value = parseFloat(discount.Valor); if (discount.Tipo === '%') return originalPrice * (1 - value / 100); if (discount.Tipo === 'MXN') return Math.max(0, originalPrice - value); return originalPrice;
  }
  
  document.body.addEventListener('click', e => {
      const categoryCard = e.target.closest('.category-card');
      if (categoryCard) { e.preventDefault(); navigateTo(`?category=${categoryCard.dataset.category}`); return; }
      const serviceCard = e.target.closest('.service-card');
      if (serviceCard) { e.preventDefault(); navigateTo(`?${serviceCard.dataset.type}=${serviceCard.dataset.id}`); return; }
      const closeModalButton = e.target.closest('.close-button');
      if (closeModalButton) {
          e.preventDefault();
          closeModalButton.closest('.modal').style.display = 'none';
          const currentUrl = new URL(window.location);
          currentUrl.searchParams.delete('service');
          currentUrl.searchParams.delete('packageId');
          navigateTo(currentUrl.search || '?');
          return;
      }
  });

  /**
   * FUNCIÓN DE IMÁGENES DE CATEGORÍA RESTAURADA
   * Asigna una URL de imagen específica a cada categoría.
   */
  function getCategoryImage(categoryName) {
    const categoryImages = {
      'FACIALES': 'http://amor-vael.com/wp-content/uploads/2021/08/cat-faciales.jpg',
      'MASAJES': 'http://amor-vael.com/wp-content/uploads/2021/08/cat-masajes.jpg',
      'UÑAS': 'http://amor-vael.com/wp-content/uploads/2021/08/cat-unas.jpg',
      'PESTAÑAS': 'http://amor-vael.com/wp-content/uploads/2021/08/cat-pestañas.jpg',
      'PAQUETES ESPECIALES': 'http://amor-vael.com/wp-content/uploads/2021/08/paquetes.jpg',
      // Añade más categorías y sus URLs aquí
    };
    // Devuelve la imagen específica o una imagen por defecto si la categoría no está en la lista
    return categoryImages[categoryName.toUpperCase()] || 'https://via.placeholder.com/300x200.png?text=Amor-Vael';
  }

  // --- INICIALIZACIÓN ---
  router();
  window.addEventListener('popstate', router);
});
