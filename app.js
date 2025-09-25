/**
 * =================================================================
 * MOTOR DE CITAS AMOR-VAEL - APP.JS
 * =================================================================
 * @version   10.0 (Estable con Códigos de Descuento)
 * @fecha     24 de Septiembre, 2025
 * @desc      Frontend completo para la gestión de citas. Incluye
 * lógica para servicios, paquetes, área de cliente y
 * códigos de descuento.
 * =================================================================
 */
document.addEventListener('DOMContentLoaded', () => {
    // =================================================================
    // 1. INICIALIZACIÓN Y ESTADO DE LA APLICACIÓN
    // =================================================================
    const appContainer = document.getElementById('app-container');
    let allData = null;
    let clientData = JSON.parse(sessionStorage.getItem('amorVaelClientData')) || null;
    const API_ENDPOINT = 'https://script.google.com/macros/s/AKfycbzlZJ0mTAUDaE_c9_oTCvSFrwTG6DC4sWRv8NtbMw1yxXx2NeP3FmvRK5hIN81_R7QdTQ/exec';

    // =================================================================
    // 2. ROUTER PRINCIPAL
    // =================================================================
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
        else if (serviceId) renderServiceDetailView(serviceId, purchaseId);
        else if (category) renderServicesView(category);
        else renderCategoriesView();
    }

    // =================================================================
    // 3. LÓGICA DE RENDERIZADO Y OBTENCIÓN DE DATOS
    // =================================================================
    function renderView(templateId) {
        const template = document.getElementById(templateId);
        if (!template) {
            appContainer.innerHTML = `<p class="error-message">Error: La vista "${templateId}" no fue encontrada.</p>`;
            return null;
        }
        appContainer.innerHTML = '';
        appContainer.appendChild(template.content.cloneNode(true));
        return appContainer.querySelector('.view');
    }

    async function fetchAppData() {
        if (allData) return allData;
        try {
            const response = await fetch(`${API_ENDPOINT}?action=getAppData`);
            if (!response.ok) throw new Error('No se pudo conectar con el servidor.');
            const data = await response.json();
            if (data.status !== 'success') throw new Error(data.message || 'Error al cargar datos del servidor.');
            allData = data;
            return allData;
        } catch (error) {
            console.error("Error crítico en fetchAppData:", error);
            appContainer.innerHTML = `<p class="error-message">Error al cargar: ${error.message}</p>`;
            throw error;
        }
    }

    // =================================================================
    // 4. VISTAS PRINCIPALES
    // =================================================================
    async function renderCategoriesView() {
        const view = renderView('template-categories-view');
        if (!view) return;
        view.querySelector('.client-area-link').addEventListener('click', (e) => { e.preventDefault(); navigateTo('?view=client-login'); });
        const categoryGrid = view.querySelector('.category-grid');
        categoryGrid.innerHTML = `<div class="loading-spinner"></div>`;
        try {
            await fetchAppData();
            const servicios = allData.servicios || [];
            const paquetes = allData.paquetes || [];
            const categories = [...new Set([...servicios, ...paquetes].map(item => item.categoria))].filter(Boolean).filter(cat => cat.toLowerCase() !== 'paquetes');
            categoryGrid.innerHTML = '';
            if (categories.length === 0) {
                categoryGrid.innerHTML = '<p>No se encontraron categorías disponibles.</p>';
                return;
            }
            categories.forEach(name => {
                const card = createCard('category', { name });
                card.addEventListener('click', (e) => { e.preventDefault(); navigateTo(`?category=${encodeURIComponent(name)}`); });
                categoryGrid.appendChild(card);
            });
        } catch (error) {
            categoryGrid.innerHTML = `<p class="error-message">Error al cargar: ${error.message}</p>`;
        }
    }

    async function renderServicesView(categoryName) {
        const view = renderView('template-services-view');
        if (!view) return;
        const decodedCategory = decodeURIComponent(categoryName);
        view.querySelector('.view-title').textContent = decodedCategory;
        view.querySelector('.back-link').addEventListener('click', (e) => { e.preventDefault(); navigateTo('/'); });
        const listContainer = view.querySelector('.service-list');
        listContainer.innerHTML = `<div class="loading-spinner"></div>`;
        try {
            await fetchAppData();
            const servicios = (allData.servicios || []).filter(s => s.categoria === decodedCategory).map(s => ({ ...s, type: 'service' }));
            const paquetes = (allData.paquetes || []).filter(p => p.categoria === decodedCategory).map(p => ({ ...p, type: 'package' }));
            const items = [...servicios, ...paquetes];
            listContainer.innerHTML = '';
            if (items.length === 0) {
                listContainer.innerHTML = '<p>No hay elementos en esta categoría.</p>';
                return;
            }
            items.forEach(item => {
                const card = createCard(item.type, item);
                card.addEventListener('click', (e) => { e.preventDefault(); navigateTo(item.type === 'service' ? `?service=${item.id}` : `?package=${item.id}`); });
                listContainer.appendChild(card);
            });
        } catch (error) {
            listContainer.innerHTML = `<p class="error-message">Error: ${error.message}</p>`;
        }
    }

    async function renderServiceDetailView(serviceId, purchaseId = null) {
        const view = renderView('template-service-detail-view');
        if (!view) return;
        view.prepend(document.getElementById('template-loading').content.cloneNode(true));
        try {
            await fetchAppData();
            const service = allData.servicios.find(s => s.id === serviceId);
            if (!service) throw new Error('Servicio no encontrado.');

            view.querySelector('.loading-spinner')?.remove();
            view.querySelector('.view-title').textContent = service.nombre;
            if (service.especialistas && allData.especialistas) {
                const names = service.especialistas.map(id => (allData.especialistas.find(s => s.id.toUpperCase() === id.toUpperCase()) || {}).nombre).filter(Boolean).join(' • ');
                view.querySelector('#service-specialists-list').textContent = names ? `by: ${names}` : '';
            }
            view.querySelector('.back-link').addEventListener('click', (e) => { e.preventDefault(); navigateTo(purchaseId ? `?view=book-package-session&purchaseId=${purchaseId}` : `?category=${encodeURIComponent(service.categoria)}`); });
            view.querySelector('.service-main-image').src = service.imagenUrl || getCategoryImage(service.categoria);
            view.querySelector('.service-price').textContent = service.precio > 0 ? `$${service.precio.toLocaleString('es-MX')} MXN` : 'Cortesía / Evaluación';
            view.querySelector('.service-duration').textContent = `Duración: ${service.duracion} minutos`;
            view.querySelector('.service-description').textContent = service.descripcion || '';
            
            const showCalendarBtn = view.querySelector('#show-calendar-btn');
            showCalendarBtn.addEventListener('click', () => {
                view.querySelector('.booking-section').style.display = 'block';
                showCalendarBtn.style.display = 'none';
                initializeCalendar(service.id, view);
            });
        } catch (error) {
            appContainer.innerHTML = `<p class="error-message">Error: ${error.message}</p><a href="#" onclick="navigateTo('/'); return false;">Volver</a>`;
        }
    }

    async function renderPackageDetailView(packageId) {
        const view = renderView('template-package-detail-view');
        if (!view) return;
        view.prepend(document.getElementById('template-loading').content.cloneNode(true));
        try {
            await fetchAppData();
            const pkg = allData.paquetes.find(p => p.id === packageId);
            if (!pkg) throw new Error('Paquete no encontrado.');

            view.querySelector('.loading-spinner')?.remove();
            view.querySelector('.view-title').textContent = pkg.nombre;
            view.querySelector('.service-price').textContent = `$${pkg.precio.toLocaleString('es-MX')} MXN`;
            view.querySelector('.service-main-image').src = pkg.imagenUrl || getCategoryImage(pkg.categoria);
            view.querySelector('.back-link').addEventListener('click', (e) => { e.preventDefault(); navigateTo(`?category=${encodeURIComponent(pkg.categoria)}`); });
            const list = view.querySelector('.package-services-included ul');
            list.innerHTML = '';
            pkg.servicios.forEach(id => {
                const service = allData.servicios.find(s => s.id === id);
                const li = document.createElement('li');
                li.textContent = service ? service.nombre : `Servicio ${id} no encontrado`;
                list.appendChild(li);
            });
            view.querySelector('#buy-package-btn').addEventListener('click', () => openPurchaseModal(pkg));
        } catch (error) {
            appContainer.innerHTML = `<p class="error-message">${error.message}</p>`;
        }
    }

    // =================================================================
    // 5. LÓGICA DE CALENDARIO Y RESERVA
    // =================================================================
    function initializeCalendar(serviceId, view) {
        const monthYearEl = view.querySelector('#monthYear');
        const calendarDaysEl = view.querySelector('#calendarDays');
        let currentDate = new Date();
        let serverToday = '';

        async function renderCalendar() {
            monthYearEl.textContent = currentDate.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
            calendarDaysEl.innerHTML = '';
            const month = currentDate.getMonth(), year = currentDate.getFullYear();
            let firstDay = new Date(year, month, 1).getDay();
            const lastDate = new Date(year, month + 1, 0).getDate();
            for (let i = 0; i < firstDay; i++) { calendarDaysEl.innerHTML += `<div class="calendar-day disabled"></div>`; }
            for (let i = 1; i <= lastDate; i++) {
                const dayDate = new Date(year, month, i);
                const isoDate = toISODateString(dayDate);
                const cell = document.createElement('div');
                cell.className = 'calendar-day';
                cell.textContent = i;
                cell.dataset.date = isoDate;
                if (serverToday && isoDate <= serverToday) {
                    cell.classList.add('disabled');
                } else {
                    cell.addEventListener('click', () => {
                        view.querySelectorAll('.calendar-day.selected').forEach(el => el.classList.remove('selected'));
                        cell.classList.add('selected');
                        fetchAndDisplaySlots(serviceId, dayDate);
                    });
                }
                calendarDaysEl.appendChild(cell);
            }
        }

        async function fetchAndDisplaySlots(serviceId, date) {
            const slotsContainer = view.querySelector('.slots-container');
            const slotsEl = view.querySelector('#availableSlots');
            slotsContainer.style.display = 'block';
            slotsEl.innerHTML = `<div class="loading-spinner"></div>`;
            const url = `${API_ENDPOINT}?action=getAvailableSlots&serviceId=${serviceId}&date=${toISODateString(date)}`;
            try {
                const response = await fetch(url);
                const data = await response.json();
                slotsEl.innerHTML = '';
                if (data.status === 'success' && data.availableSlots.length > 0) {
                    data.availableSlots.forEach(slot => {
                        const el = document.createElement('div');
                        el.className = 'slot';
                        el.textContent = formatTime12h(slot.time);
                        el.addEventListener('click', () => openBookingModal(serviceId, date, slot));
                        slotsEl.appendChild(el);
                    });
                } else {
                    slotsEl.innerHTML = '<p>No hay horarios disponibles.</p>';
                }
            } catch (e) {
                slotsEl.innerHTML = '<p class="error-message">Error al cargar horarios.</p>';
            }
        }
        
        async function setupCalendar() {
            try {
                const response = await fetch(`${API_ENDPOINT}?action=getAvailableSlots&serviceId=${serviceId}&date=check`);
                const data = await response.json();
                if (data.serverDate) {
                    serverToday = data.serverDate;
                    renderCalendar();
                } else {
                    throw new Error('Respuesta inválida del servidor.');
                }
            } catch (e) {
                calendarDaysEl.innerHTML = `<p class="error-message">No se pudo inicializar: ${e.message}</p>`;
            }
        }
        
        view.querySelector('#prevMonth').onclick = () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); };
        view.querySelector('#nextMonth').onclick = () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); };
        setupCalendar();
    }

    // =================================================================
    // 6. MODALES Y LÓGICA DE DESCUENTOS
    // =================================================================
    async function openBookingModal(serviceId, date, slotData, purchaseId = null) {
        const modal = document.getElementById('booking-modal');
        const service = allData.servicios.find(s => s.id === serviceId);
        if (!service) return;

        let finalPrice = service.precio;
        let appliedCode = null;

        modal.querySelector('.booking-form').style.display = 'block';
        modal.querySelector('#modal-message').style.display = 'none';
        const confirmBtn = modal.querySelector('#confirm-booking-btn');
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Confirmar Cita';

        modal.querySelector('#modal-title').textContent = 'Revisa y Confirma tu Cita';
        modal.querySelector('#modal-service-name').textContent = service.nombre;
        modal.querySelector('#modal-date').textContent = date.toLocaleDateString('es-MX', { dateStyle: 'long' });
        modal.querySelector('#modal-time').textContent = formatTime12h(slotData.time);
        modal.querySelector('#modal-specialist-name').textContent = slotData.specialistName;
        modal.querySelector('#modal-price').textContent = `$${service.precio.toLocaleString('es-MX')} MXN`;

        const nameInput = modal.querySelector('#clientName');
        const emailInput = modal.querySelector('#clientEmail');
        const phoneInput = modal.querySelector('#clientPhone');
        nameInput.value = ''; emailInput.value = ''; phoneInput.value = '';

        // Lógica de descuento
        const discountSection = modal.querySelector('.discount-section');
        const discountBtn = modal.querySelector('#apply-booking-discount-btn');
        const discountInput = modal.querySelector('#booking-discount-code');
        const discountMsg = modal.querySelector('#booking-discount-message');
        discountInput.value = '';
        discountMsg.textContent = '';
        discountSection.style.display = service.precio > 0 ? 'block' : 'none';

        discountBtn.onclick = async () => {
            const code = discountInput.value.trim().toUpperCase();
            if (!code) return;
            
            discountMsg.textContent = 'Validando...';
            discountMsg.className = 'info-message';
            
            const url = `${API_ENDPOINT}?action=validateDiscountCode&code=${code}&serviceId=${serviceId}`;
            try {
                const res = await fetch(url);
                const result = await res.json();
                if (result.status !== 'success') throw new Error(result.message);

                finalPrice = parseFloat(result.newPrice);
                appliedCode = code;
                modal.querySelector('#modal-price').innerHTML = `<s>$${service.precio.toLocaleString('es-MX')}</s> <span class="new-price">$${finalPrice.toLocaleString('es-MX')} MXN</span>`;
                discountMsg.textContent = '¡Código aplicado con éxito!';
                discountMsg.className = 'success-message';
            } catch (error) {
                discountMsg.textContent = error.message;
                discountMsg.className = 'error-message';
                finalPrice = service.precio;
                appliedCode = null;
                modal.querySelector('#modal-price').textContent = `$${service.precio.toLocaleString('es-MX')} MXN`;
            }
        };
        
        modal.style.display = 'flex';
        modal.querySelector('#close-modal').onclick = () => modal.style.display = 'none';
        
        confirmBtn.onclick = async () => {
            // ... (Lógica de confirmación de cita)
        };
    }

    async function openPurchaseModal(pkg) {
        // ... (Lógica similar para el modal de compra de paquetes, incluyendo descuentos)
    }
  
    // =================================================================
    // 7. LÓGICA DEL ÁREA DE CLIENTE
    // =================================================================
    async function renderClientLoginView() { /* ... */ }
    async function renderClientPackagesView() { /* ... */ }
    async function renderPackageServicesView(purchaseId) { /* ... */ }

    // =================================================================
    // 8. FUNCIONES AUXILIARES Y DE INICIALIZACIÓN
    // =================================================================
    function createCard(type, data) { /* ... */ }
    function getCategoryImage(categoryName) { /* ... */ }
    function formatTime12h(time24h) { /* ... */ }
    function toISODateString(date) { /* ... */ }
    function navigateTo(path) { /* ... */ }
    function clearClientDataAndGoHome() { /* ... */ }
  
    router();
    window.addEventListener('popstate', router);
});
