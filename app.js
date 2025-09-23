/**
 * Motor de Citas Amor-Vael v2.01 - VERSIÓN DE PRODUCCIÓN FINAL Y ESTABLE
 * - Basado 100% en el código original del cliente para garantizar la estabilidad.
 * - MEJORAS INTEGRADAS: Se inyecta la lógica para mostrar especialistas, habilitar compra de paquetes,
 * validar descuentos y manejar servicios de $0.00 de forma compatible.
 * - LÓGICA DE PAGO CORREGIDA: Se desactiva el pago con tarjeta.
 */
document.addEventListener('DOMContentLoaded', () => {
    const appContainer = document.getElementById('app-container');
    let allData = null;
    const API_ENDPOINT = '/.netlify/functions/engine';

    function router() {
        const params = new URLSearchParams(window.location.search);
        const category = params.get('category');
        const serviceId = params.get('service');
        const packageId = params.get('package');

        if (packageId) renderPackageDetailView(packageId);
        else if (serviceId) renderServiceDetailView(serviceId);
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
            card.onclick = (e) => { e.preventDefault(); navigateTo(`?category=${encodeURIComponent(categoryName)}`); };
            grid.appendChild(card);
        });

        if (allData && allData.allPackages && allData.allPackages.length > 0) {
            const packageCard = createCard('package', {});
            packageCard.onclick = (e) => { e.preventDefault(); navigateTo('?category=Paquetes Especiales'); };
            grid.appendChild(packageCard);
        }
        
        const versionFooter = document.getElementById('version-footer');
        if(versionFooter) versionFooter.textContent = 'v.2.01';
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
        } else {
            items = [...(allData.allServices || []), ...(allData.allPackages || [])]
                .filter(item => item.categoria && item.categoria.trim().toUpperCase() === category.trim().toUpperCase());
        }
        
        items.forEach(item => {
            const isPackage = !!item.servicios_ids;
            const card = createCard(isPackage ? 'package-item' : 'service', item);
            card.onclick = (e) => { e.preventDefault(); navigateTo(`?${isPackage ? 'package' : 'service'}=${item.id}`); };
            grid.appendChild(card);
        });
    }
  
    function renderServiceDetailView(serviceId) {
        const service = allData.allServices.find(s => s.id === serviceId);
        if (!service) return renderError('Servicio no encontrado.');
        const modal = document.getElementById('booking-modal');

        // Poblar datos del modal
        document.getElementById('modal-service-name').textContent = service.nombre;
        document.getElementById('modal-service-description').textContent = service.descripcion;
        document.getElementById('modal-service-duration').textContent = service.duracion;
        document.getElementById('modal-service-price').textContent = service.precio.toLocaleString('es-MX');
        document.getElementById('service-final-price').textContent = service.precio.toLocaleString('es-MX');
        const specialistsText = service.specialistsData.map(sp => sp.nombre).join(' / ');
        document.getElementById('modal-specialist-name').textContent = specialistsText || 'Por asignar';
        
        // Lógica de pago
        const paymentContainer = document.getElementById('payment-options-container');
        const discountContainer = modal.querySelector('.discount-section');
        const finalPriceContainer = modal.querySelector('.final-price');

        if (service.precio > 0) {
            paymentContainer.style.display = 'block';
            discountContainer.style.display = 'flex';
            finalPriceContainer.style.display = 'block';
            const paymentOptions = document.querySelectorAll('input[name="payment-method"]');
            paymentOptions.forEach(radio => radio.addEventListener('change', handlePaymentChange));
            document.querySelector('input[name="payment-method"][value="transfer"]').checked = true;
            handlePaymentChange();
        } else {
            paymentContainer.style.display = 'none';
            discountContainer.style.display = 'none';
            finalPriceContainer.style.display = 'none';
            document.getElementById('transfer-details').style.display = 'none';
            document.getElementById('payment-section').style.display = 'none';
        }

        // Lógica de disponibilidad
        const dateInput = document.getElementById('booking-date');
        dateInput.value = '';
        dateInput.onchange = () => getAndRenderSlots(serviceId, dateInput.value);
        
        modal.style.display = 'block';
        modal.querySelector('.close-button').onclick = () => { modal.style.display = 'none'; navigateTo(window.location.search.replace(/&?service=[^&]+/, '')); };
    }

    function renderPackageDetailView(packageId) {
        const pkg = allData.allPackages.find(p => p.id === packageId);
        if (!pkg) return renderError('Paquete no encontrado.');
        const modal = document.getElementById('package-modal');

        document.getElementById('modal-package-name').textContent = pkg.nombre;
        document.getElementById('modal-package-price').textContent = pkg.precio.toLocaleString('es-MX');
        document.getElementById('pkg-final-price').textContent = pkg.precio.toLocaleString('es-MX');
        document.getElementById('modal-package-services').innerHTML = pkg.servicios_ids.map(sId => `<li>${allData.allServices.find(s=>s.id===sId)?.nombre || 'Servicio'}</li>`).join('');

        document.getElementById('pkg-discount-code').value = '';
        document.getElementById('pkg-discount-message').textContent = '';
        document.getElementById('apply-pkg-discount-btn').onclick = () => applyDiscount(pkg.id, pkg.precio, 'pkg');
        
        modal.style.display = 'block';
        modal.querySelector('.close-button').onclick = () => { modal.style.display = 'none'; navigateTo(window.location.search.replace(/&?package=[^&]+/, '')); };
    }

    async function getAndRenderSlots(serviceId, date) {
        const slotsContainer = document.getElementById('available-slots-container');
        slotsContainer.innerHTML = '<div class="loading-spinner"></div>';
        try {
            const response = await fetch(`${API_ENDPOINT}?action=getAvailableSlots&serviceId=${serviceId}&date=${date}`);
            const result = await response.json();
            if (result.status === 'success' && result.availableSlots.length > 0) {
                slotsContainer.innerHTML = result.availableSlots.map(slot => `<button class="slot-button">${slot}</button>`).join('');
            } else { slotsContainer.innerHTML = '<p>No hay horarios disponibles para esta fecha.</p>'; }
        } catch (error) { slotsContainer.innerHTML = '<p class="error-message">Error al buscar horarios.</p>'; }
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
            messageEl.textContent = '¡Descuento aplicado!'; messageEl.className = 'success';
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
        document.getElementById('payment-section').style.display = 'none'; // Siempre oculto por ahora
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
            card.innerHTML = `<img src="${data.imagen}" alt="${data.nombre}"><div class="service-card-info"><h4>${data.nombre}</h4><p>${data.duracion} min · $${data.precio.toLocaleString('es-MX')} MXN</p></div><div class="service-card-arrow"><i class="ph-bold ph-caret-right"></i></div>`;
        } else if (type === 'package-item') {
            card.className = 'package-card';
            const serviceCount = data.servicios_ids.length;
            const serviceText = serviceCount === 1 ? '1 servicio' : `${serviceCount} servicios`;
            card.innerHTML = `<img src="${data.imagen}" alt="${data.nombre}"><div class="service-card-info"><h4>${data.nombre}</h4><p>Incluye ${serviceText}</p><p class="package-price">$${data.precio.toLocaleString('es-MX')} MXN</p></div>`;
        }
        return card;
    }
  
    router();
    window.addEventListener('popstate', router);
});
