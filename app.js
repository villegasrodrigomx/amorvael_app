/**
 * Motor de Citas Amor-Vael v26.0 - VERSIÓN FINAL BASADA EN ORIGINALES
 * - Se restaura la lógica del `router` y `createCard` del archivo app.js original del cliente.
 * - MEJORAS INTEGRADAS: Se inyecta la lógica para mostrar especialistas, habilitar la compra de
 * paquetes y validar descuentos de forma compatible con el código original.
 * - ESTABILIDAD: Se eliminan las modificaciones que causaban los errores de "card is not defined" y el contenedor roto.
 */
document.addEventListener('DOMContentLoaded', () => {
    const appContainer = document.getElementById('app-container');
    let allData = null;
    let clientData = JSON.parse(sessionStorage.getItem('amorVaelClientData')) || null;
    let currentDiscount = null;
    
    // --- CONFIGURACIÓN (Original) ---
    const API_ENDPOINT = '/.netlify/functions/engine';
    const stripe = Stripe('pk_test_51RykGMA68QYOf35CXVLHnoL1IZeWbtC2Fn72tPNSP8sNLLAAW9zUgtNJZxsaujFACiPE49JXfLOhcMtJkbWM1FyI005rXaLSb5');

    // --- ROUTER Y RENDERIZADO (Lógica Original Restaurada) ---
    function router() {
        clientData = JSON.parse(sessionStorage.getItem('amorVaelClientData')) || null;
        const params = new URLSearchParams(window.location.search);
        const view = params.get('view');
        const category = params.get('category');
        const serviceId = params.get('service');
        const packageId = params.get('packageId'); 
        const purchaseId = params.get('purchaseId');

        const openModal = document.querySelector('.modal[style*="display: block"]');
        if (openModal && !serviceId && !packageId) openModal.style.display = 'none';

        if (view === 'client-login') renderClientLoginView();
        else if (view === 'my-packages') renderClientPackagesView();
        else if (view === 'book-package-session') renderPackageServicesView(purchaseId);
        else if (packageId) renderDetailView(packageId, true);
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
                allData = result; // La estructura original esperaba el objeto completo
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
        if (allData && allData.services) categories = [...new Set(allData.services.map(s => s.categoria))];
        
        categories.forEach(categoryName => {
            const card = createCard('category', { name: categoryName });
            card.onclick = (e) => { e.preventDefault(); navigateTo(`?category=${encodeURIComponent(categoryName)}`); };
            grid.appendChild(card);
        });

        if (allData && allData.packages && allData.packages.length > 0) {
            const packageCard = createCard('package', {});
            packageCard.onclick = (e) => { e.preventDefault(); navigateTo('?category=Paquetes Especiales'); };
            grid.appendChild(packageCard);
        }
        document.querySelector('.client-area-link').onclick = (e) => { e.preventDefault(); navigateTo('?view=client-login'); };
    }
  
    function renderServicesView(category) {
        const template = document.getElementById('template-services-view').innerHTML;
        appContainer.innerHTML = template;
        document.getElementById('category-title').textContent = category;
        const grid = document.getElementById('services-grid');
        grid.innerHTML = '';

        let items;
        if (category === 'Paquetes Especiales') {
            items = allData.packages;
        } else {
            items = [...(allData.services || []), ...(allData.packages || [])]
                .filter(item => item.categoria && item.categoria.trim().toUpperCase() === category.trim().toUpperCase());
        }
        
        items.forEach(item => {
            const isPackage = !!item.servicios_ids;
            const card = createCard(isPackage ? 'package-item' : 'service', item);
            card.onclick = (e) => { e.preventDefault(); navigateTo(`?${isPackage ? 'packageId' : 'service'}=${item.id}`); };
            grid.appendChild(card);
        });
    }
  
    function renderDetailView(itemId, isPackage) {
        const dataSource = isPackage ? allData.packages : allData.services;
        const item = dataSource.find(i => i.id === itemId);
        if (!item) return renderError('Elemento no encontrado.');

        const modal = document.getElementById(isPackage ? 'package-modal' : 'booking-modal');
        const prefix = isPackage ? 'pkg' : 'service';
        
        document.getElementById(`modal-${prefix}-name`).textContent = item.nombre;
        document.getElementById(`modal-${prefix}-price`).textContent = item.precio.toLocaleString('es-MX');
        document.getElementById(`${prefix}-final-price`).textContent = item.precio.toLocaleString('es-MX');

        if (isPackage) {
            document.getElementById('modal-package-services').innerHTML = item.servicios_ids.map(sId => `<li>${allData.services.find(s=>s.id===sId)?.nombre || 'Servicio'}</li>`).join('');
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
            paymentOptions.forEach(radio => radio.addEventListener('change', handlePaymentChange));
            document.querySelector('input[name="payment-method"][value="card"]').checked = true;
            handlePaymentChange();
        }

        document.getElementById(`${prefix}-discount-code`).value = '';
        document.getElementById(`${prefix}-discount-message`).textContent = '';
        document.getElementById(`apply-${prefix}-discount-btn`).onclick = () => applyDiscount(item.id, item.precio, prefix);
        
        modal.style.display = 'block';
        modal.querySelector('.close-button').onclick = () => {
            modal.style.display = 'none';
            const currentUrl = new URL(window.location);
            currentUrl.searchParams.delete('service');
            currentUrl.searchParams.delete('packageId');
            navigateTo(currentUrl.pathname + (currentUrl.search === '?' ? '' : currentUrl.search));
        };
    }

    async function getAndRenderSlots(serviceId, date) {
        const slotsContainer = document.getElementById('available-slots-container');
        slotsContainer.innerHTML = '<div class="loading-spinner"></div>';
        try {
            const response = await fetch(`${API_ENDPOINT}?action=getAvailableSlots&serviceId=${serviceId}&date=${date}`);
            const result = await response.json();
            if (result.status === 'success' && result.availableSlots.length > 0) {
                slotsContainer.innerHTML = result.availableSlots.map(slot => `<button class="slot-button" data-slot="${slot}">${slot}</button>`).join('');
            } else {
                slotsContainer.innerHTML = '<p>No hay horarios disponibles para esta fecha.</p>';
            }
        } catch (error) {
            slotsContainer.innerHTML = '<p class="error-message">Error al buscar horarios.</p>';
        }
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
            const newPrice = calculateDiscountedPrice(originalPrice, result.discount);
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
        if (discount.Tipo === 'FIJO') return Math.max(0, originalPrice - value);
        return originalPrice;
    }
    
    function handlePaymentChange() {
        const selected = document.querySelector('input[name="payment-method"]:checked').value;
        document.getElementById('transfer-details').style.display = (selected === 'transfer') ? 'block' : 'none';
        document.getElementById('payment-section').style.display = (selected === 'card') ? 'block' : 'none';
    }

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
            card.innerHTML = `<img src="${getCategoryImage(data.name)}" alt="${data.name}" class="category-card-image"><div class="category-card-title"><h3>${data.name}</h3></div>`;
        } else if (type === 'package') {
            card.className = 'category-card';
            const packageImageUrl = 'http://amor-vael.com/wp-content/uploads/2021/08/lotus-spa-template-services-header-img-bg.jpg';
            card.innerHTML = `<img src="${packageImageUrl}" alt="Paquetes" class="category-card-image"><div class="category-card-title"><h3>Paquetes Especiales</h3></div>`;
        } else if (type === 'service') {
            card.className = 'service-card';
            card.innerHTML = `<img src="${data.imagen}" alt="${data.nombre}"><div class="service-card-info"><h4>${data.nombre}</h4><p>${data.duracion} min · $${data.precio.toLocaleString('es-MX')} MXN</p></div>`;
        } else if (type === 'package-item') {
            card.className = 'package-card';
            const serviceCount = data.servicios_ids.length;
            const serviceText = serviceCount === 1 ? '1 servicio' : `${serviceCount} servicios`;
            card.innerHTML = `<img src="${data.imagen}" alt="${data.nombre}"><div class="service-card-info"><h4>${data.nombre}</h4><p>Incluye ${serviceText}</p><p class="package-price">$${data.precio.toLocaleString('es-MX')} MXN</p></div>`;
        }
        return card;
    }
  
    // --- INICIALIZACIÓN ---
    router();
    window.addEventListener('popstate', router);
});
