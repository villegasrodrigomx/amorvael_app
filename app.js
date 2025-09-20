/**
 * Motor de Citas Amor-Vael v23.1 - VERSIÓN FINAL CON LÓGICA DE TARJETAS RESTAURADA
 * - RESTAURADO: Se vuelve a implementar la lógica `createCard` y `getCategoryImage` del cliente.
 * - CORREGIDO: `createCard` ahora añade los `data-attributes` necesarios para que la navegación
 * por delegación de eventos funcione correctamente, arreglando los clicks en paquetes.
 * - MANTIENE: Toda la lógica de negocio estable.
 */
document.addEventListener('DOMContentLoaded', () => {
  const appContainer = document.getElementById('app-container');
  let allData = null;
  const API_ENDPOINT = '/.netlify/functions/engine';

  // --- NAVEGACIÓN Y RENDERIZADO ---

  function router() {
    const params = new URLSearchParams(window.location.search);
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
      grid.innerHTML = ''; 

      let categories = [];
      if (allData && allData.allServices) categories = [...new Set(allData.allServices.map(s => s.categoria))];
      
      categories.forEach(categoryName => {
          const card = createCard('category', { name: categoryName });
          grid.appendChild(card);
      });

      if (allData && allData.allPackages && allData.allPackages.length > 0) {
          const packageCard = createCard('package', {});
          grid.appendChild(packageCard);
      }
  }
  
  function renderServicesView(category) {
      const template = document.getElementById('template-services-view').innerHTML;
      appContainer.innerHTML = template;
      document.getElementById('category-title').textContent = category;
      const grid = document.getElementById('services-grid');
      grid.innerHTML = '';

      let items;
      if (category === 'Paquetes Especiales') {
          items = allData.allPackages;
          items.forEach(pkg => {
              const card = createCard('package-item', pkg);
              grid.appendChild(card);
          });
      } else {
          items = [...(allData.allServices || []), ...(allData.allPackages || [])]
              .filter(item => item.categoria && item.categoria.trim().toUpperCase() === category.trim().toUpperCase());
          items.forEach(item => {
              // Ahora usamos createCard para ambos, servicios y paquetes dentro de una categoría
              const card = createCard(item.servicios_ids ? 'package-item' : 'service', item);
              grid.appendChild(card);
          });
      }
  }
  
  function renderDetailView(itemId, isPackage) { /* ... Lógica de modales sin cambios ... */ const item = isPackage ? allData.allPackages.find(p => p.id === itemId) : allData.allServices.find(s => s.id === itemId); if (!item) return renderError('Elemento no encontrado.'); const modal = document.getElementById(isPackage ? 'package-modal' : 'booking-modal'); const prefix = isPackage ? 'pkg' : 'service'; document.getElementById(`modal-${prefix}-name`).textContent = item.nombre; document.getElementById(`modal-${prefix}-price`).textContent = item.precio.toLocaleString('es-MX'); document.getElementById(`${prefix}-final-price`).textContent = item.precio.toLocaleString('es-MX'); if (isPackage) { document.getElementById('modal-package-services').innerHTML = item.servicios_ids.map(sId => `<li>${allData.allServices.find(s=>s.id===sId)?.nombre || 'Servicio'}</li>`).join(''); } else { document.getElementById('modal-service-description').textContent = item.descripcion; document.getElementById('modal-service-duration').textContent = item.duracion; const specialistsText = item.specialistsData.map(sp => sp.nombre).join(' / '); document.getElementById('modal-specialist-name').textContent = specialistsText || 'Por asignar'; const dateInput = document.getElementById('booking-date'); dateInput.value = ''; document.getElementById('available-slots-container').innerHTML = ''; dateInput.onchange = () => getAndRenderSlots(item.id, dateInput.value); const paymentOptions = document.querySelectorAll('input[name="payment-method"]'); const transferDetails = document.getElementById('transfer-details'); const paymentSection = document.getElementById('payment-section'); const confirmBtn = document.getElementById('confirm-booking-btn'); function handlePaymentChange() { const selected = document.querySelector('input[name="payment-method"]:checked').value; transferDetails.style.display = (selected === 'transfer') ? 'block' : 'none'; paymentSection.style.display = (selected === 'card') ? 'block' : 'none'; confirmBtn.textContent = (selected === 'transfer' || selected === 'cash') ? 'Confirmar y agendar' : 'Pagar y agendar'; } paymentOptions.forEach(radio => radio.addEventListener('change', handlePaymentChange)); document.querySelector('input[name="payment-method"][value="card"]').checked = true; handlePaymentChange(); } document.getElementById(`${prefix}-discount-code`).value = ''; document.getElementById(`${prefix}-discount-message`).textContent = ''; document.getElementById(`apply-${prefix}-discount-btn`).onclick = () => applyDiscount(item.id, item.precio, prefix); modal.style.display = 'block'; }
  async function getAndRenderSlots(serviceId, date) { /* ... Lógica de slots sin cambios ... */ const slotsContainer = document.getElementById('available-slots-container'); slotsContainer.innerHTML = 'Buscando horarios...'; try { const response = await fetch(`${API_ENDPOINT}?action=getAvailableSlots&serviceId=${serviceId}&date=${date}`); const result = await response.json(); if (result.status === 'success' && result.availableSlots.length > 0) { slotsContainer.innerHTML = result.availableSlots.map(slot => `<button class="slot-button" data-slot="${slot}">${slot}</button>`).join(''); } else { slotsContainer.innerHTML = 'No hay horarios disponibles para esta fecha.'; } } catch (error) { slotsContainer.innerHTML = 'Error al buscar horarios.'; } }
  async function applyDiscount(itemId, originalPrice, typePrefix) { /* ... Lógica de descuentos sin cambios ... */ const code = document.getElementById(`${typePrefix}-discount-code`).value; const messageEl = document.getElementById(`${typePrefix}-discount-message`); const finalPriceEl = document.getElementById(`${typePrefix}-final-price`); if (!code) { messageEl.textContent = 'Ingresa un código.'; messageEl.className = 'error'; return; } messageEl.textContent = 'Validando...'; try { const response = await fetch(`${API_ENDPOINT}?action=validateDiscountCode&code=${code}&itemId=${itemId}`); const result = await response.json(); if (result.status !== 'success') throw new Error(result.message); const newPrice = calculateDiscountedPrice(originalPrice, result.discount); finalPriceEl.textContent = newPrice.toLocaleString('es-MX'); messageEl.textContent = '¡Descuento aplicado!'; messageEl.className = 'success'; } catch (error) { finalPriceEl.textContent = originalPrice.toLocaleString('es-MX'); messageEl.textContent = error.message; messageEl.className = 'error'; } }
  function calculateDiscountedPrice(originalPrice, discount) { /* ... Lógica de descuentos sin cambios ... */ const value = parseFloat(discount.Valor); if (discount.Tipo === '%') return originalPrice * (1 - value / 100); if (discount.Tipo === 'MXN') return Math.max(0, originalPrice - value); return originalPrice; }
  
  // =================================================================
  // FUNCIONES ORIGINALES RESTAURADAS
  // =================================================================
  
  function getCategoryImage(categoryName) {
    const images = {
      'UÑAS': 'http://amor-vael.com/wp-content/uploads/2025/08/unas.jpeg',
      'PESTAÑAS': 'http://amor-vael.com/wp-content/uploads/2025/08/pestanas.jpeg',
      'MASAJES': 'http://amor-vael.com/wp-content/uploads/2025/08/masajes.jpeg',
      'FACIALES': 'http://amor-vael.com/wp-content/uploads/2025/08/faciales.jpeg'
    };
    return images[categoryName.toUpperCase()] || 'https://placehold.co/600x400/E5A1AA/FFFFFF?text=Amor-Vael';
  }

  function createCard(type, data) {
    const card = document.createElement('a');
    card.href = '#';
    
    if (type === 'category') {
      card.className = 'category-card';
      card.dataset.category = encodeURIComponent(data.name); // Para el click
      card.innerHTML = `<img src="${getCategoryImage(data.name)}" alt="Imagen de ${data.name}" class="category-card-image"><div class="category-card-title"><h3>${data.name}</h3></div>`;
    
    } else if (type === 'package') {
      card.className = 'category-card';
      card.dataset.category = 'Paquetes Especiales'; // Para el click
      const packageImageUrl = 'http://amor-vael.com/wp-content/uploads/2021/08/lotus-spa-template-services-header-img-bg.jpg';
      card.innerHTML = `<img src="${packageImageUrl}" alt="Imagen de Paquetes" class="category-card-image"><div class="category-card-title"><h3>Paquetes Especiales</h3></div>`;
    
    } else if (type === 'service') {
      card.className = 'service-card';
      card.dataset.type = 'service'; // Para el click
      card.dataset.id = data.id;      // Para el click
      // Se añade la imagen que faltaba
      card.innerHTML = `<img src="${data.imagen}" alt="${data.nombre}" class="service-card-image"><div class="service-card-info"><h4>${data.nombre}</h4><p>${data.duracion} min · $${data.precio.toLocaleString('es-MX')} MXN</p></div><div class="service-card-arrow"><i class="ph-bold ph-caret-right"></i></div>`;
    
    } else if (type === 'package-item') {
      card.className = 'service-card'; // Usamos la misma clase para consistencia de estilo
      card.dataset.type = 'packageId'; // Para el click
      card.dataset.id = data.id;       // Para el click
      const serviceCount = data.servicios_ids.length;
      const serviceText = serviceCount === 1 ? '1 servicio' : `${serviceCount} servicios`;
      // Se añade la imagen del paquete
      card.innerHTML = `<img src="${data.imagen}" alt="${data.nombre}" class="service-card-image"><div class="service-card-info"><h4>${data.nombre}</h4><p>Incluye ${serviceText}</p><p class="package-price">$${data.precio.toLocaleString('es-MX')} MXN</p></div><div class="service-card-arrow"><i class="ph-bold ph-caret-right"></i></div>`;
    }
    return card;
  }
  
  // =================================================================
  // DELEGACIÓN DE EVENTOS PRINCIPAL
  // =================================================================
  document.body.addEventListener('click', e => {
    // Busca el ancestro más cercano que sea una tarjeta con un data-attribute
    const categoryCard = e.target.closest('.category-card[data-category]');
    if (categoryCard) {
      e.preventDefault();
      navigateTo(`?category=${categoryCard.dataset.category}`);
      return;
    }
    // Un solo selector para servicios y paquetes, ya que ambos usan data-id y data-type
    const itemCard = e.target.closest('.service-card[data-id], .package-card[data-id]');
    if (itemCard) {
      e.preventDefault();
      navigateTo(`?${itemCard.dataset.type}=${itemCard.dataset.id}`);
      return;
    }
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

  // --- INICIALIZACIÓN ---
  router();
  window.addEventListener('popstate', router);
});
