document.addEventListener('DOMContentLoaded', () => {
    const appContainer = document.getElementById('app-container');
    let allData = null;
    let clientData = JSON.parse(sessionStorage.getItem('amorVaelClientData')) || null;
    
    const API_ENDPOINT = '/.netlify/functions/engine';
    const stripe = Stripe('pk_test_51RykGMA68QYOf35CXVLHnoL1IZeWbtC2Fn72tPNSP8sNLLAAW9zUgtNJZxsaujFACiPE49JXfLOhcMtJkbWM1FyI005rXaLSb5');

    function router() {
        clientData = JSON.parse(sessionStorage.getItem('amorVaelClientData')) || null;
        const params = new URLSearchParams(window.location.search);
        const view = params.get('view');
        const category = params.get('category');
        const serviceId = params.get('service');
        const packageId = params.get('package');
        const purchaseId = params.get('purchaseId');

        if (view === 'client-login') renderClientLoginView();
        else if (view === 'my-packages') renderClientPackagesView();
        else if (view === 'book-package-session') renderPackageServicesView(purchaseId);
        else if (packageId) renderPackageDetailView(packageId);
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
            items = allData.allPackages;
        } else {
            items = allData.allServices.filter(item => item.categoria && item.categoria.trim().toUpperCase() === category.trim().toUpperCase());
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
        document.getElementById('modal-service-name').textContent = service.nombre;
        document.getElementById('modal-service-description').textContent = service.descripcion;
        document.getElementById('modal-service-duration').textContent = service.duracion;
        document.getElementById('modal-service-price').textContent = service.precio.toLocaleString('es-MX');
        modal.style.display = 'block';
        modal.querySelector('.close-button').onclick = () => { modal.style.display = 'none'; navigateTo(window.location.pathname); };
        
        const dateInput = document.getElementById('booking-date');
        dateInput.onchange = async () => {
            const date = dateInput.value;
            const slotsContainer = document.getElementById('available-slots-container');
            slotsContainer.innerHTML = '<div class="loading-spinner"></div>';
            try {
                const response = await fetch(`${API_ENDPOINT}?action=getAvailableSlots&serviceId=${serviceId}&date=${date}`);
                const result = await response.json();
                if (result.status === 'success' && result.availableSlots.length > 0) {
                    slotsContainer.innerHTML = result.availableSlots.map(slot => `<button class="slot-button">${slot}</button>`).join('');
                } else {
                    slotsContainer.innerHTML = '<p>No hay horarios disponibles para esta fecha.</p>';
                }
            } catch (error) {
                slotsContainer.innerHTML = '<p class="error-message">Error al buscar horarios.</p>';
            }
        };
    }

    function renderPackageDetailView(packageId) {
        const pkg = allData.allPackages.find(p => p.id === packageId);
        if (!pkg) return renderError('Paquete no encontrado.');
        const modal = document.getElementById('package-modal');
        document.getElementById('modal-package-name').textContent = "Funcionalidad de compra para \"" + pkg.nombre + "\" en construcción.";
        modal.style.display = 'block';
        modal.querySelector('.close-button').onclick = () => { modal.style.display = 'none'; navigateTo(window.location.pathname); };
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
            card.innerHTML = `<div class="service-card-info"><h4>${data.nombre}</h4><p>${data.duracion} min · $${data.precio.toLocaleString('es-MX')} MXN</p></div><div class="service-card-arrow"><i class="ph-bold ph-caret-right"></i></div>`;
        } else if (type === 'package-item') {
            card.className = 'package-card';
            const serviceCount = data.servicios_ids.length;
            const serviceText = serviceCount === 1 ? '1 servicio' : `${serviceCount} servicios`;
            card.innerHTML = `<h4>${data.nombre}</h4><p>Incluye ${serviceText}</p><p class="package-price">$${data.precio.toLocaleString('es-MX')} MXN</p>`;
        }
        return card;
    }
  
    router();
    window.addEventListener('popstate', router);
});
