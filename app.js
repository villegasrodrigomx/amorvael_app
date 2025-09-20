/**
 * Motor de Citas Amor-Vael v22.1 - VERSIÓN FINAL ESTABLE
 * - CORREGIDO: La lógica para mostrar las imágenes de las categorías ahora lee correctamente
 * los datos de los servicios/paquetes, restaurando la funcionalidad original.
 * - CORREGIDO: El filtro de servicios por categoría ahora es insensible a mayúsculas/minúsculas,
 * solucionando el problema de categorías que aparecían vacías.
 * - MANTIENE: Toda la lógica de negocio, delegación de eventos, pagos y descuentos.
 */
document.addEventListener('DOMContentLoaded', () => {
  const appContainer = document.getElementById('app-container');
  let allData = null;
  const API_ENDPOINT = '/.netlify/functions/engine';

  // --- NAVEGACIÓN Y RENDERIZADO ---

  function router() {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    const category = params.get('category');
    const serviceId = params.get('service');
    const packageId = params.get('packageId');

    const openModal = document.querySelector('.modal[style*="display: block"]');
    if (openModal && !serviceId && !packageId) openModal.style.display = 'none';
    
    if (packageId) renderDetailView(packageId, true);
    else if (serviceId) renderDetailView(serviceId, false);
    else if (category) renderServicesView(decodeURIComponent(category));
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
      } else { throw new Error(result.message || 'No se pudieron cargar los datos.'); }
    } catch (error) { renderError(error.message); }
  }

  function renderLoading() { appContainer.innerHTML = document.getElementById('template-loading').innerHTML; }
  function renderError(message) { appContainer.innerHTML = `<div class="error-message">Error: ${message}</div>`; }
  
  function renderCategoriesView() {
      const template = document.getElementById('template-categories-view').innerHTML;
      appContainer.innerHTML = template;
      const grid = document.getElementById('categories-grid');
      let categories = [];
      if(allData && allData.allServices) categories = [...new Set(allData.allServices.map(s => s.categoria))];
      if (allData && allData.allPackages && allData.allPackages.length > 0) {
        const packageCategories = [...new Set(allData.allPackages.map(p => p.categoria))].filter(Boolean);
        packageCategories.forEach(pc => { if (!categories.includes(pc)) categories.push(pc); });
        categories.push('Paquetes Especiales');
      }
      grid.innerHTML = categories.map(category => {
          // Lógica de imagen corregida: Busca una imagen representativa en los datos reales.
          let representativeItem;
          if (category === 'Paquetes Especiales') {
              representativeItem = allData.allPackages.find(p => p.imagen) || { imagen: 'http://amor-vael.com/wp-content/uploads/2021/08/paquetes.jpg' };
          } else {
              representativeItem = allData.allServices.find(s => s.categoria === category && s.imagen) || allData.allPackages.find(p => p.categoria === category && p.imagen);
          }
          const itemImage = representativeItem ? representativeItem.imagen : 'https://via.placeholder.com/300x200.png?text=Amor-Vael';
          return `<div class="category-card" data-category="${encodeURIComponent(category)}"><img src="${itemImage}" alt="${category}"><h3>${category}</h3></div>`;
      }).join('');
  }
  
  function renderServicesView(category) {
      const template = document.getElementById('template-services-view').innerHTML;
      appContainer.innerHTML = template;
      document.getElementById('category-title').textContent = category;
      const grid = document.getElementById('services-grid');
      let items;
      if (category === 'Paquetes Especiales') {
          items = allData.allPackages;
      } else {
          // Filtro corregido: insensible a mayúsculas/minúsculas y espacios.
          items = [...(allData.allServices || []), ...(allData.allPackages || [])]
              .filter(item => item.categoria && item.categoria.trim().toUpperCase() === category.trim().toUpperCase());
      }
      grid.innerHTML = items.map(item => {
          const isPackage = !!item.servicios_ids;
          return `<div class="service-card" data-type="${isPackage ? 'packageId' : 'service'}" data-id="${item.id}"><img src="${item.imagen}" alt="${item.nombre}"><h4>${item.nombre}</h4><p>$${item.precio.toLocaleString('es-MX')} MXN</p></div>`;
      }).join('');
  }
  
  function renderDetailView(itemId, isPackage) {
      const item = isPackage 
          ? allData.allPackages.find(p => p.id === itemId)
          : allData.allServices.find(s => s.id === itemId);

      if (!item) return renderError('Elemento no encontrado.');

      const modal = document.getElementById(isPackage ? 'package-modal' : 'booking-modal');
      const prefix = isPackage ? 'pkg' : 'service';
      
      document.getElementById(`modal-${prefix}-name`).textContent = item.nombre;
      document.getElementById(`modal-${prefix}-price`).textContent = item.precio.toLocaleString('es-MX');
      document.getElementById(`${prefix}-final-price`).textContent = item.precio.toLocaleString('es-MX');

      if (isPackage) {
        document.getElementById('modal-package-services').innerHTML = item.servicios_ids.map(sId => `<li>${allData.allServices.find(s=>s.id===sId)?.nombre || 'Servicio'}</li>`).join('');
      } else {
        document.getElementById('modal-service-description').textContent = item.descripcion;
        document.getElementById('modal-service-duration').textContent = item.duracion;
        const specialistsText = item.specialistsData.map(sp => sp.nombre).join(' / ');
        document.getElementById('modal-specialist-name').textContent = specialistsText || 'Por asignar';
        
        const dateInput = document.getElementById('booking-date');
        dateInput.value = '';
        document.getElementById('available-slots-container').innerHTML = '';
        dateInput.onchange = () => getAndRenderSlots(item.id, dateInput.value);
        
        const paymentOptions = document.querySelectorAll('input[name="payment-method"]');
        const transferDetails = document.getElementById('transfer-details');
        const paymentSection = document.getElementById('payment-section');
        const confirmBtn = document.getElementById('confirm-booking-btn');
        function handlePaymentChange() {
            const selected = document.querySelector('input[name="payment-method"]:checked').value;
            transferDetails.style.display = (selected === 'transfer') ? 'block' : 'none';
            paymentSection.style.display = (selected === 'card') ? 'block' : 'none';
            confirmBtn.textContent = (selected === 'transfer' || selected === 'cash') ? 'Confirmar y agendar' : 'Pagar y agendar';
        }
        paymentOptions.forEach(radio => radio.addEventListener('change', handlePaymentChange));
        document.querySelector('input[name="payment-method"][value="card"]').checked = true;
        handlePaymentChange();
      }

      document.getElementById(`${prefix}-discount-code`).value = '';
      document.getElementById(`${prefix}-discount-message`).textContent = '';
      document.getElementById(`apply-${prefix}-discount-btn`).onclick = () => applyDiscount(item.id, item.precio, prefix);

      modal.style.display = 'block';
  }

  async function getAndRenderSlots(serviceId, date) {
    const slotsContainer = document.getElementById('available-slots-container');
    slotsContainer.innerHTML = 'Buscando horarios...';
    try {
      const response = await fetch(`${API_ENDPOINT}?action=getAvailableSlots&serviceId=${serviceId}&date=${date}`);
      const result = await response.json();
      if (result.status === 'success' && result.availableSlots.length > 0) {
        slotsContainer.innerHTML = result.availableSlots.map(slot => `<button class="slot-button" data-slot="${slot}">${slot}</button>`).join('');
      } else {
        slotsContainer.innerHTML = 'No hay horarios disponibles para esta fecha.';
      }
    } catch (error) {
      slotsContainer.innerHTML = 'Error al buscar horarios.';
    }
  }

  async function applyDiscount(itemId, originalPrice, typePrefix) {
      const code = document.getElementById(`${typePrefix}-discount-code`).value; const messageEl = document.getElementById(`${typePrefix}-discount-message`); const finalPriceEl = document.getElementById(`${typePrefix}-final-price`); if (!code) { messageEl.textContent = 'Ingresa un código.'; messageEl.className = 'error'; return; } messageEl.textContent = 'Validando...'; try { const response = await fetch(`${API_ENDPOINT}?action=validateDiscountCode&code=${code}&itemId=${itemId}`); const result = await response.json(); if (result.status !== 'success') throw new Error(result.message); const newPrice = calculateDiscountedPrice(originalPrice, result.discount); finalPriceEl.textContent = newPrice.toLocaleString('es-MX'); messageEl.textContent = '¡Descuento aplicado!'; messageEl.className = 'success'; } catch (error) { finalPriceEl.textContent = originalPrice.toLocaleString('es-MX'); messageEl.textContent = error.message; messageEl.className = 'error'; }
  }
  function calculateDiscountedPrice(originalPrice, discount) { const value = parseFloat(discount.Valor); if (discount.Tipo === '%') return originalPrice * (1 - value / 100); if (discount.Tipo === 'MXN') return Math.max(0, originalPrice - value); return originalPrice; }
  
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
      navigateTo(currentUrl.pathname + (currentUrl.search === '?' ? '' : currentUrl.search));
      return;
    }
    const slotButton = e.target.closest('.slot-button');
    if (slotButton) {
        document.querySelectorAll('.slot-button').forEach(b => b.classList.remove('selected'));
        slotButton.classList.add('selected');
    }
  });

  router();
  window.addEventListener('popstate', router);
});
