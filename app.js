/**
 * =================================================================
 * MOTOR DE CITAS AMOR-VAEL - APP.JS
 * =================================================================
 * @version   11.0 (Final y Estable)
 * @fecha     25 de Septiembre, 2025
 * @desc      Frontend completo, final y robusto para la gestión de citas.
 * Incluye lógica para servicios, paquetes, área de cliente
 * y códigos de descuento.
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
                initializeCalendar(service.id, view, purchaseId);
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
    function initializeCalendar(serviceId, view, purchaseId = null) {
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
                        fetchAndDisplaySlots(serviceId, dayDate, purchaseId);
                    });
                }
                calendarDaysEl.appendChild(cell);
            }
        }

        async function fetchAndDisplaySlots(serviceId, date, purchaseId) {
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
                        el.addEventListener('click', () => openBookingModal(serviceId, date, slot, purchaseId));
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
        let clientInfo = {};

        if (purchaseId && clientData) {
            const purchase = clientData.packages.find(p => p.id === purchaseId);
            clientInfo = {
                name: purchase.nombreCliente,
                email: purchase.email,
                phone: purchase.telefono
            };
        }
        
        modal.querySelector('.booking-form').style.display = 'block';
        modal.querySelector('#modal-message').style.display = 'none';
        const confirmBtn = modal.querySelector('#confirm-booking-btn');
        confirmBtn.disabled = false;

        modal.querySelector('#modal-title').textContent = 'Revisa y Confirma tu Cita';
        modal.querySelector('#modal-service-name').textContent = service.nombre;
        modal.querySelector('#modal-date').textContent = date.toLocaleDateString('es-MX', { dateStyle: 'long' });
        modal.querySelector('#modal-time').textContent = formatTime12h(slotData.time);
        modal.querySelector('#modal-specialist-name').textContent = slotData.specialistName;
        modal.querySelector('#modal-price').innerHTML = `$${service.precio.toLocaleString('es-MX')} MXN`;

        const nameInput = modal.querySelector('#clientName');
        const emailInput = modal.querySelector('#clientEmail');
        const phoneInput = modal.querySelector('#clientPhone');
        const paymentOptions = modal.querySelector('#payment-options-section');
        const transferDetails = modal.querySelector('#transfer-details');

        const discountSection = modal.querySelector('.discount-section');
        const discountBtn = modal.querySelector('#apply-booking-discount-btn');
        const discountInput = modal.querySelector('#booking-discount-code');
        const discountMsg = modal.querySelector('#booking-discount-message');
        discountInput.value = '';
        discountMsg.textContent = '';
        discountMsg.className = '';

        if (purchaseId) {
            modal.querySelector('#modal-price').textContent = 'Incluido en tu paquete';
            nameInput.value = clientInfo.name || '';
            emailInput.value = clientInfo.email || '';
            phoneInput.value = clientInfo.phone || '';
            [paymentOptions, transferDetails, discountSection].forEach(el => el.style.display = 'none');
            confirmBtn.textContent = 'Confirmar Sesión';
        } else {
            [nameInput, emailInput, phoneInput].forEach(el => el.value = '');
            if (service.precio > 0) {
                [paymentOptions, discountSection].forEach(el => el.style.display = 'block');
                const updatePaymentView = () => { transferDetails.style.display = modal.querySelector('input[name="payment-method"]:checked')?.value === 'transfer' ? 'block' : 'none'; };
                modal.querySelectorAll('input[name="payment-method"]').forEach(radio => radio.onchange = updatePaymentView);
                modal.querySelector('input[value="transfer"]').checked = true;
                updatePaymentView();
                confirmBtn.textContent = 'Confirmar Cita';
            } else {
                modal.querySelector('#modal-price').textContent = 'Cortesía / Sin costo';
                [paymentOptions, transferDetails, discountSection].forEach(el => el.style.display = 'none');
                confirmBtn.textContent = 'Confirmar Cita de Cortesía';
            }
        }
        
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
                discountMsg.textContent = `¡Descuento de $${discountAmount} aplicado!`;
                discountMsg.className = 'success-message';
            } catch (error) {
                discountMsg.textContent = error.message;
                discountMsg.className = 'error-message';
                finalPrice = service.precio;
                appliedCode = null;
                modal.querySelector('#modal-price').innerHTML = `$${service.precio.toLocaleString('es-MX')} MXN`;
            }
        };
        
        modal.style.display = 'flex';
        modal.querySelector('#close-modal').onclick = () => modal.style.display = 'none';
        
        confirmBtn.onclick = async () => {
            const clientName = nameInput.value.trim();
            const clientEmail = emailInput.value.trim().toLowerCase();
            const clientPhone = phoneInput.value.trim();
            if (!clientName || !clientEmail || !clientPhone) { alert('Por favor, completa nombre, correo y celular.'); return; }
            if (!/\S+@\S+\.\S+/.test(clientEmail)) { alert('Correo electrónico inválido.'); return; }
            
            confirmBtn.disabled = true; confirmBtn.textContent = 'Procesando...';
            let paymentStatus = 'Cortesía';
            if (!purchaseId && service.precio > 0) {
                paymentStatus = modal.querySelector('input[name="payment-method"]:checked').value === 'transfer' ? 'Pendiente de transferencia' : 'Pago en sitio';
            }
            
            const action = purchaseId ? 'bookPackageSession' : 'createBooking';
            const payload = { action, serviceId, date: toISODateString(date), time: slotData.time, specialistId: slotData.specialistId, clientName, clientEmail, clientPhone, paymentStatus, purchaseId, finalPrice, discountCode: appliedCode };
            
            try {
                const res = await fetch(API_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
                const result = await res.json();
                if (result.status !== 'success') throw new Error(result.message);
                if (result.updatedPackages) { sessionStorage.setItem('amorVaelClientData', JSON.stringify({ email: clientEmail, packages: result.updatedPackages })); }
                
                modal.querySelector('#modal-title').textContent = '¡Éxito!';
                modal.querySelector('.booking-form').style.display = 'none';
                const msg = modal.querySelector('#modal-message');
                msg.textContent = result.message; msg.className = 'success-message'; msg.style.display = 'block';
                setTimeout(() => { modal.style.display = 'none'; navigateTo(purchaseId ? '?view=my-packages' : '/'); }, 4000);
            } catch (error) {
                const msg = modal.querySelector('#modal-message');
                msg.textContent = `Error: ${error.message}`; msg.className = 'error-message'; msg.style.display = 'block';
                confirmBtn.disabled = false; confirmBtn.textContent = 'Intentar de Nuevo';
            }
        };
    }

    async function openPurchaseModal(pkg) {
        const modal = document.getElementById('purchase-modal');
        let finalPrice = pkg.precio;
        let appliedCode = null;

        modal.querySelector('#purchase-modal-title').textContent = `Comprar Paquete: ${pkg.nombre}`;
        modal.querySelector('#purchase-modal-price').innerHTML = `$${pkg.precio.toLocaleString('es-MX')} MXN`;
        const form = modal.querySelector('.purchase-form');
        form.style.display = 'block';
        const msgEl = modal.querySelector('#purchase-modal-message');
        msgEl.style.display = 'none';
        const confirmBtn = modal.querySelector('#confirm-purchase-btn');
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Confirmar Compra';
        
        const transferDetails = modal.querySelector('#purchase-transfer-details');
        const updatePaymentView = () => {
            const method = modal.querySelector('input[name="purchase-payment-method"]:checked')?.value;
            transferDetails.style.display = method === 'transfer' ? 'block' : 'none';
        };
        modal.querySelectorAll('input[name="purchase-payment-method"]').forEach(radio => radio.onchange = updatePaymentView);
        modal.querySelector('input[value="transfer"]').checked = true;
        updatePaymentView();

        const discountBtn = modal.querySelector('#apply-purchase-discount-btn');
        const discountInput = modal.querySelector('#purchase-discount-code');
        const discountMsg = modal.querySelector('#purchase-discount-message');
        discountInput.value = '';
        discountMsg.textContent = '';
        discountMsg.className = '';

        discountBtn.onclick = async () => {
            const code = discountInput.value.trim().toUpperCase();
            if (!code) return;

            discountMsg.textContent = 'Validando...';
            discountMsg.className = 'info-message';

            const url = `${API_ENDPOINT}?action=validateDiscountCode&code=${code}&packageId=${pkg.id}`;
            try {
                const res = await fetch(url);
                const result = await res.json();
                if (result.status !== 'success') throw new Error(result.message);

                finalPrice = parseFloat(result.newPrice);
                appliedCode = code;
                modal.querySelector('#purchase-modal-price').innerHTML = `<s>$${pkg.precio.toLocaleString('es-MX')}</s> <span class="new-price">$${finalPrice.toLocaleString('es-MX')} MXN</span>`;
                discountMsg.textContent = '¡Código aplicado!';
                discountMsg.className = 'success-message';
            } catch (error) {
                discountMsg.textContent = error.message;
                discountMsg.className = 'error-message';
                finalPrice = pkg.precio;
                appliedCode = null;
                modal.querySelector('#purchase-modal-price').innerHTML = `$${pkg.precio.toLocaleString('es-MX')} MXN`;
            }
        };

        modal.style.display = 'flex';
        modal.querySelector('#close-purchase-modal').onclick = () => modal.style.display = 'none';

        confirmBtn.onclick = async () => {
            const clientName = modal.querySelector('#purchase-clientName').value.trim();
            const clientEmail = modal.querySelector('#purchase-clientEmail').value.trim().toLowerCase();
            const clientPhone = modal.querySelector('#purchase-clientPhone').value.trim();
            const paymentStatus = modal.querySelector('input[name="purchase-payment-method"]:checked').value === 'transfer' ? 'Pendiente de transferencia' : 'Pago en sitio';
            if (!clientName || !clientEmail || !clientPhone) { alert('Todos los campos son requeridos.'); return; }
            if (!/\S+@\S+\.\S+/.test(clientEmail)) { alert('Correo electrónico inválido.'); return; }
            
            confirmBtn.disabled = true; confirmBtn.textContent = 'Procesando...';

            try {
                const payload = { action: 'purchasePackage', packageId: pkg.id, clientName, clientEmail, clientPhone, paymentStatus, finalPrice, discountCode: appliedCode };
                const res = await fetch(API_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
                const result = await res.json();
                if (result.status !== 'success') throw new Error(result.message);
                
                sessionStorage.setItem('amorVaelClientData', JSON.stringify({ email: clientEmail, packages: result.updatedPackages }));
                form.style.display = 'none';
                msgEl.textContent = result.message;
                msgEl.className = 'success-message'; msgEl.style.display = 'block';
                setTimeout(() => { modal.style.display = 'none'; navigateTo(`?view=my-packages`); }, 4000);
            } catch (error) {
                msgEl.textContent = `Error: ${error.message}`;
                msgEl.className = 'error-message';
                msgEl.style.display = 'block';
                confirmBtn.disabled = false;
                confirmBtn.textContent = 'Confirmar Compra';
            }
        };
    }
  
    // =================================================================
    // 7. LÓGICA DEL ÁREA DE CLIENTE
    // =================================================================
    async function renderClientLoginView() {
        const view = renderView('template-client-login-view');
        if (!view) return;
        view.querySelector('.back-link').addEventListener('click', (e) => { e.preventDefault(); navigateTo('/'); });
        view.querySelector('#find-packages-btn').addEventListener('click', async () => {
            const emailInput = view.querySelector('#client-login-email');
            const msg = view.querySelector('#login-message');
            const email = emailInput.value.trim().toLowerCase();
            if (!email) { msg.textContent = 'Por favor, introduce un correo.'; return; }
            msg.textContent = 'Buscando...';
            try {
                const res = await fetch(`${API_ENDPOINT}?action=getClientPackages&clientEmail=${encodeURIComponent(email)}`);
                const data = await res.json();
                if (data.status === 'success' && data.clientPackages.length > 0) {
                    sessionStorage.setItem('amorVaelClientData', JSON.stringify({ email, packages: data.clientPackages }));
                    navigateTo('?view=my-packages');
                } else {
                    msg.textContent = 'No se encontraron paquetes para este correo, o no tienes sesiones restantes.';
                }
            } catch (error) {
                msg.textContent = 'Error al buscar paquetes.';
            }
        });
    }

    async function renderClientPackagesView() {
        const view = renderView('template-client-packages-view');
        if (!view) return;
        view.querySelector('.back-link').addEventListener('click', (e) => { e.preventDefault(); clearClientDataAndGoHome(); });
        const listEl = view.querySelector('#client-package-list');
        if (!clientData || !clientData.packages || clientData.packages.length === 0) {
            listEl.innerHTML = '<p>No tienes paquetes activos. <a href="#" id="try-another">Intenta con otro correo</a>.</p>';
            listEl.querySelector('#try-another').addEventListener('click', (e) => { e.preventDefault(); navigateTo('?view=client-login'); });
            return;
        }
        listEl.innerHTML = '';
        clientData.packages.forEach(pkg => {
            const card = document.createElement('div');
            card.className = 'client-package-card';
            const remaining = pkg.serviciosRestantes ? pkg.serviciosRestantes.split(',').length : 0;
            card.innerHTML = `<h4>${pkg.nombrePaquete}</h4><p><strong>Sesiones restantes:</strong> ${remaining}</p>`;
            const btn = document.createElement('button');
            btn.className = 'cta-button';
            btn.textContent = 'Agendar Sesión';
            btn.onclick = () => navigateTo(`?view=book-package-session&purchaseId=${pkg.id}`);
            card.appendChild(btn);
            listEl.appendChild(card);
        });
    }

    async function renderPackageServicesView(purchaseId) {
        const view = renderView('template-package-services-view');
        if (!view) return;
        view.querySelector('.back-link').addEventListener('click', (e) => { e.preventDefault(); navigateTo('?view=my-packages'); });
        const list = view.querySelector('.service-list');
        if (!clientData) { navigateTo('?view=client-login'); return; }
        list.innerHTML = `<div class="loading-spinner"></div>`;
        try {
            await fetchAppData();
            const purchase = clientData.packages.find(p => p.id === purchaseId);
            if (!purchase) throw new Error('Compra no encontrada.');
            const remainingIds = purchase.serviciosRestantes ? purchase.serviciosRestantes.split(',') : [];
            list.innerHTML = '';
            if (remainingIds.length === 0) { list.innerHTML = '<p>Ya has agendado todas las sesiones de este paquete.</p>'; return; }
            
            const serviceCounts = remainingIds.reduce((acc, id) => { acc[id] = (acc[id] || 0) + 1; return acc; }, {});
            Object.keys(serviceCounts).forEach(serviceId => {
                const service = allData.servicios.find(s => s.id === serviceId);
                if (service) {
                    const card = createCard('service', service);
                    const countEl = document.createElement('p');
                    countEl.innerHTML = `(Restantes: <strong>${serviceCounts[serviceId]}</strong>)`;
                    countEl.style.cssText = 'font-weight: 500; margin-top: -10px; margin-bottom: 10px; color: var(--secondary-color);';
                    card.querySelector('.service-card-info').appendChild(countEl);
                    card.addEventListener('click', (e) => { 
                        e.preventDefault(); 
                        navigateTo(`?service=${service.id}&purchaseId=${purchaseId}`);
                    });
                    list.appendChild(card);
                }
            });
        } catch (error) {
            list.innerHTML = `<p class="error-message">${error.message}</p>`;
        }
    }
  
    // =================================================================
    // 8. FUNCIONES AUXILIARES Y DE INICIALIZACIÓN
    // =================================================================
    function createCard(type, data) {
        const card = document.createElement('a');
        card.href = '#';
        if (type === 'category') {
            card.className = 'category-card';
            card.innerHTML = `<img src="${getCategoryImage(data.name)}" class="category-card-image" alt="${data.name}"><div class="category-card-title"><h3>${data.name}</h3></div>`;
        } else {
            card.className = 'service-card';
            let price = data.precio > 0 ? `$${parseFloat(data.precio).toLocaleString('es-MX')} MXN` : 'Gratis';
            let subtext = type === 'service' ? `${data.duracion} min` : 'Paquete';
            card.innerHTML = `<div class="service-card-info"><h4>${data.nombre}</h4><p>${subtext} · ${price}</p></div><div class="service-card-arrow"><i class="ph-bold ph-caret-right"></i></div>`;
        }
        return card;
    }
  
    function getCategoryImage(categoryName) {
        const images = {'Uñas':'http://amor-vael.com/wp-content/uploads/2025/08/unas.jpeg','Pestañas':'http://amor-vael.com/wp-content/uploads/2025/08/pestanas.jpeg','Masajes':'http://amor-vael.com/wp-content/uploads/2025/08/masajes.jpeg','Faciales':'http://amor-vael.com/wp-content/uploads/2025/08/faciales.jpeg'};
        return images[categoryName] || 'https://placehold.co/600x400/E5A1AA/FFFFFF?text=Amor-Vael';
    }
  
    function formatTime12h(time24h) {
        if (!time24h) return '';
        const [h, m] = time24h.split(':');
        return new Date(1970, 0, 1, parseInt(h), parseInt(m)).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', hour12: true });
    }

    function toISODateString(date) { return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0'); }
    function navigateTo(path) { window.history.pushState({}, '', path); router(); }
    function clearClientDataAndGoHome() { sessionStorage.removeItem('amorVaelClientData'); clientData = null; navigateTo('/'); }
  
    router();
    window.addEventListener('popstate', router);
});

