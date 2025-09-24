document.addEventListener('DOMContentLoaded', () => {
  const appContainer = document.getElementById('app-container');
  let allData = null;
  let clientData = JSON.parse(sessionStorage.getItem('amorVaelClientData')) || null;
  
  const API_ENDPOINT = 'https://script.google.com/macros/s/AKfycbzlZJ0mTAUDaE_c9_oTCvSFrwTG6DC4sWRv8NtbMw1yxXx2NeP3FmvRK5hIN81_R7QdTQ/exec';

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

  function renderView(templateId) {
    const template = document.getElementById(templateId);
    if (!template) { appContainer.innerHTML = `<p class="error-message">Error: Vista no encontrada.</p>`; return null; }
    appContainer.innerHTML = '';
    appContainer.appendChild(template.content.cloneNode(true));
    return appContainer.querySelector('.view');
  }

  async function fetchAppData() {
    if (allData) return allData;
    try {
      const response = await fetch(`${API_ENDPOINT}?action=getAppData`);
      if (!response.ok) throw new Error('Respuesta no válida del servidor (no fue 200 OK).');
      
      const data = await response.json();
      
      // --- LÍNEA DE DEPURACIÓN CLAVE ---
      console.log('Respuesta COMPLETA recibida del backend:', data);
      // ---------------------------------

      if (data.status !== 'success') throw new Error(data.message || 'El backend reportó un error.');
      
      allData = data;
      return allData;
    } catch (error) {
      console.error("Error crítico en fetchAppData:", error);
      throw error;
    }
  }

  async function renderCategoriesView() {
    const view = renderView('template-categories-view');
    if (!view) return;
    view.querySelector('.client-area-link').addEventListener('click', (e) => { e.preventDefault(); navigateTo('?view=client-login'); });
    const categoryGrid = view.querySelector('.category-grid');
    categoryGrid.innerHTML = `<div class="loading-spinner"></div>`;
    try {
      await fetchAppData();
      
      // La corrección está aquí: (allData.services || [])
      // Si allData.services no existe, usa un arreglo vacío [] en su lugar.
      const services = allData.services || [];
      const packages = allData.packages || [];

      const categories = [...new Set([...services, ...packages].map(item => item.categoria))].filter(Boolean);
      
      categoryGrid.innerHTML = '';
      if (categories.length === 0) {
        categoryGrid.innerHTML = '<p>No se encontraron categorías. Revisa que las pestañas "Servicios" y "Paquetes" existan en tu Google Sheet.</p>';
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
      const services = allData.services.filter(s => s.categoria === decodedCategory).map(s => ({ ...s, type: 'service' }));
      const packages = allData.packages.filter(p => p.categoria === decodedCategory).map(p => ({ ...p, type: 'package' }));
      const items = [...packages, ...services]; // Mostrar paquetes primero
      listContainer.innerHTML = '';
      if (items.length === 0) { listContainer.innerHTML = '<p>No hay elementos en esta categoría.</p>'; return; }
      items.forEach(item => {
        const card = createCard(item.type, item);
        card.addEventListener('click', (e) => { e.preventDefault(); navigateTo(item.type === 'service' ? `?service=${item.id}` : `?package=${item.id}`); });
        listContainer.appendChild(card);
      });
    } catch (error) { listContainer.innerHTML = `<p class="error-message">Error: ${error.message}</p>`; }
  }

  async function renderServiceDetailView(serviceId, purchaseId = null) {
    const view = renderView('template-service-detail-view');
    if (!view) return;
    view.prepend(document.getElementById('template-loading').content.cloneNode(true));
    try {
      await fetchAppData();
      const service = allData.services.find(s => s.id === serviceId);
      if (!service) throw new Error('Servicio no encontrado.');
      view.querySelector('.loading-spinner')?.remove();
      view.querySelector('.view-title').textContent = service.nombre;
      if (service.especialistas && allData.specialists) {
        const names = service.especialistas.map(id => allData.specialists.find(s => s.id.toUpperCase() === id.toUpperCase())?.nombre).filter(Boolean).join(' • ');
        view.querySelector('#service-specialists-list').textContent = names ? `Con: ${names}`: '';
      }
      view.querySelector('.back-link').addEventListener('click', (e) => { e.preventDefault(); navigateTo(purchaseId ? `?view=book-package-session&purchaseId=${purchaseId}` : `?category=${encodeURIComponent(service.categoria)}`); });
      view.querySelector('.service-main-image').src = service.imagenUrl || getCategoryImage(service.categoria);
      view.querySelector('.service-price').textContent = service.precio > 0 ? `$${service.precio.toLocaleString('es-MX')} MXN` : 'Cortesía / Evaluación';
      view.querySelector('.service-duration').textContent = `Duración: ${service.duracion} minutos`;
      view.querySelector('.service-description').textContent = service.descripcion || '';
      view.querySelector('#show-calendar-btn').addEventListener('click', () => {
        view.querySelector('.booking-section').style.display = 'block';
        view.querySelector('#show-calendar-btn').style.display = 'none';
        initializeCalendar(service.id, view);
      });
    } catch (error) { appContainer.innerHTML = `<p class="error-message">Error: ${error.message}</p><a href="#" onclick="navigateTo('/'); return false;">Volver</a>`; }
  }

  async function renderPackageDetailView(packageId) {
    const view = renderView('template-package-detail-view');
    if (!view) return;
    view.prepend(document.getElementById('template-loading').content.cloneNode(true));
    try {
      await fetchAppData();
      const pkg = allData.packages.find(p => p.id === packageId);
      if (!pkg) throw new Error('Paquete no encontrado.');
      view.querySelector('.loading-spinner')?.remove();
      view.querySelector('.view-title').textContent = pkg.nombre;
      view.querySelector('.service-price').textContent = `$${pkg.precio.toLocaleString('es-MX')} MXN`;
      view.querySelector('.service-main-image').src = pkg.imagenUrl || getCategoryImage(pkg.categoria);
      view.querySelector('.back-link').addEventListener('click', (e) => { e.preventDefault(); navigateTo(`?category=${encodeURIComponent(pkg.categoria)}`); });
      const list = view.querySelector('.package-services-included ul');
      list.innerHTML = '';
      pkg.servicios.forEach(id => {
        const service = allData.services.find(s => s.id === id);
        const li = document.createElement('li');
        li.textContent = service ? service.nombre : `Servicio ${id} no encontrado`;
        list.appendChild(li);
      });
      view.querySelector('#buy-package-btn').addEventListener('click', () => openPurchaseModal(pkg));
    } catch (error) { appContainer.innerHTML = `<p class="error-message">${error.message}</p>`; }
  }

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
        } else { slotsEl.innerHTML = '<p>No hay horarios disponibles.</p>'; }
      } catch (e) { slotsEl.innerHTML = '<p class="error-message">Error al cargar horarios.</p>'; }
    }
    
    async function setupCalendar() {
      try {
        const response = await fetch(`${API_ENDPOINT}?action=getAvailableSlots&serviceId=${serviceId}&date=check`);
        const data = await response.json();
        if (data.serverDate) { serverToday = data.serverDate; renderCalendar(); } 
        else { throw new Error('Respuesta inválida del servidor.'); }
      } catch (e) { calendarDaysEl.innerHTML = `<p class="error-message">No se pudo inicializar: ${e.message}</p>`; }
    }
    
    view.querySelector('#prevMonth').onclick = () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); };
    view.querySelector('#nextMonth').onclick = () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); };
    setupCalendar();
  }

  async function openBookingModal(serviceId, date, slotData, purchaseId = null, clientInfo = {}) {
    const service = allData.services.find(s => s.id === serviceId);
    const modal = document.getElementById('booking-modal');
    modal.querySelector('.booking-form').style.display = 'block';
    modal.querySelector('#modal-message').style.display = 'none';
    const confirmBtn = modal.querySelector('#confirm-booking-btn');
    confirmBtn.disabled = false;
    modal.querySelector('#modal-title').textContent = 'Revisa y Confirma tu Cita';
    modal.querySelector('#modal-service-name').textContent = service.nombre;
    modal.querySelector('#modal-date').textContent = date.toLocaleDateString('es-MX', { dateStyle: 'long' });
    modal.querySelector('#modal-time').textContent = formatTime12h(slotData.time);
    modal.querySelector('#modal-specialist-name').textContent = slotData.specialistName;
    const nameInput = modal.querySelector('#clientName');
    const emailInput = modal.querySelector('#clientEmail');
    const phoneInput = modal.querySelector('#clientPhone');
    const paymentOptions = modal.querySelector('#payment-options-section');
    const transferDetails = modal.querySelector('#transfer-details');

    if (purchaseId) {
      modal.querySelector('#modal-price').textContent = 'Incluido en tu paquete';
      nameInput.value = clientInfo.name || '';
      emailInput.value = clientInfo.email || '';
      phoneInput.value = clientInfo.phone || '';
      paymentOptions.style.display = 'none';
      transferDetails.style.display = 'none';
      confirmBtn.textContent = 'Confirmar Sesión';
    } else {
      nameInput.value = ''; emailInput.value = ''; phoneInput.value = '';
      if (service.precio > 0) {
        modal.querySelector('#modal-price').textContent = `$${service.precio.toLocaleString('es-MX')} MXN`;
        paymentOptions.style.display = 'block';
        const updatePaymentView = () => { transferDetails.style.display = modal.querySelector('input[name="payment-method"]:checked')?.value === 'transfer' ? 'block' : 'none'; };
        modal.querySelectorAll('input[name="payment-method"]').forEach(radio => radio.onchange = updatePaymentView);
        modal.querySelector('input[value="transfer"]').checked = true;
        updatePaymentView();
        confirmBtn.textContent = 'Confirmar Cita';
      } else {
        modal.querySelector('#modal-price').textContent = 'Cortesía / Sin costo';
        paymentOptions.style.display = 'none';
        transferDetails.style.display = 'none';
        confirmBtn.textContent = 'Confirmar Cita de Cortesía';
      }
    }
    
    modal.style.display = 'flex';
    modal.querySelector('#close-modal').onclick = () => modal.style.display = 'none';
    
    confirmBtn.onclick = async () => {
      const clientName = nameInput.value.trim();
      const clientEmail = emailInput.value.trim();
      const clientPhone = phoneInput.value.trim();
      if (!clientName || !clientEmail || !clientPhone) { alert('Por favor, completa nombre, correo y celular.'); return; }
      if (!/\S+@\S+\.\S+/.test(clientEmail)) { alert('Correo electrónico inválido.'); return; }
      
      confirmBtn.disabled = true; confirmBtn.textContent = 'Procesando...';
      let paymentStatus = 'Cortesía';
      if (!purchaseId && service.precio > 0) {
        paymentStatus = modal.querySelector('input[name="payment-method"]:checked').value === 'transfer' ? 'Pendiente de transferencia' : 'Pago en sitio';
      }
      
      const action = purchaseId ? 'bookPackageSession' : 'createBooking';
      const payload = { action, serviceId, date: toISODateString(date), time: slotData.time, specialistId: slotData.specialistId, clientName, clientEmail, clientPhone, paymentStatus, purchaseId };
      
      try {
        const res = await fetch(API_ENDPOINT, { method: 'POST', body: JSON.stringify(payload) });
        const result = await res.json();
        if (result.status !== 'success') throw new Error(result.message);
        if (result.updatedClientData) { sessionStorage.setItem('amorVaelClientData', JSON.stringify({ email: clientEmail, packages: result.updatedClientData })); }
        
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
    modal.querySelector('#purchase-modal-title').textContent = `Comprar: ${pkg.nombre}`;
    const form = modal.querySelector('.purchase-form');
    form.style.display = 'block';
    const msg = modal.querySelector('#purchase-modal-message');
    msg.style.display = 'none';
    const confirmBtn = modal.querySelector('#confirm-purchase-btn');
    confirmBtn.disabled = false;
    modal.style.display = 'flex';
    modal.querySelector('#close-purchase-modal').onclick = () => modal.style.display = 'none';

    confirmBtn.onclick = async () => {
        const clientName = modal.querySelector('#purchase-clientName').value.trim();
        const clientEmail = modal.querySelector('#purchase-clientEmail').value.trim();
        const clientPhone = modal.querySelector('#purchase-clientPhone').value.trim();
        if (!clientName || !clientEmail || !clientPhone) { alert('Todos los campos son requeridos.'); return; }
        confirmBtn.disabled = true; confirmBtn.textContent = 'Procesando...';

        try {
            const res = await fetch(API_ENDPOINT, { method: 'POST', body: JSON.stringify({ action: 'purchasePackage', packageId: pkg.id, clientName, clientEmail, clientPhone }) });
            const result = await res.json();
            if (result.status !== 'success') throw new Error(result.message);
            sessionStorage.setItem('amorVaelClientData', JSON.stringify({ email: clientEmail, packages: result.updatedClientData }));
            
            form.style.display = 'none';
            msg.textContent = "¡Gracias! Recibirás un correo con la confirmación. Serás redirigido al área de cliente.";
            msg.className = 'success-message'; msg.style.display = 'block';
            setTimeout(() => { modal.style.display = 'none'; navigateTo(`?view=my-packages`); }, 4000);
        } catch (error) {
            msg.textContent = `Error: ${error.message}`; msg.className = 'error-message'; msg.style.display = 'block';
            confirmBtn.disabled = false; confirmBtn.textContent = 'Confirmar Compra';
        }
    };
  }

  async function renderClientLoginView() { /* ... */ }
  async function renderClientPackagesView() { /* ... */ }
  async function renderPackageServicesView(purchaseId) { /* ... */ }
  // (Las funciones del área de cliente son extensas y se incluyen en el bloque de abajo)

  function createCard(type, data) {
    const card = document.createElement('a');
    card.href = '#';
    if (type === 'category') {
      card.className = 'category-card';
      card.innerHTML = `<img src="${getCategoryImage(data.name)}" alt="${data.name}"><div class="category-card-title"><h3>${data.name}</h3></div>`;
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
    return images[categoryName] || 'https://placehold.co/600x400/E5A1AA/FFFFFF?text=Amor-Vael'
  }
  
  function formatTime12h(time24h) {
    if (!time24h) return '';
    const [h, m] = time24h.split(':');
    return new Date(1970, 0, 1, parseInt(h), parseInt(m)).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  function toISODateString(date) { return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0'); }
  function navigateTo(path) { window.history.pushState({}, '', path); router(); }
  function clearClientDataAndGoHome() { sessionStorage.removeItem('amorVaelClientData'); clientData = null; navigateTo('/'); }
  
  // --- LÓGICA COMPLETA DEL ÁREA DE CLIENTE ---
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
        } else { msg.textContent = 'No se encontraron paquetes para este correo, o no tienes sesiones restantes.'; }
      } catch (error) { msg.textContent = 'Error al buscar paquetes.'; }
    });
  }

  async function renderClientPackagesView() {
    const view = renderView('template-client-packages-view');
    if (!view) return;
    view.querySelector('.back-link').addEventListener('click', (e) => { e.preventDefault(); clearClientDataAndGoHome(); });
    const listEl = view.querySelector('#client-package-list');
    if (!clientData || clientData.packages.length === 0) {
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
        const service = allData.services.find(s => s.id === serviceId);
        if (service) {
          const card = createCard('service', service);
          const countEl = document.createElement('p');
          countEl.innerHTML = `(Restantes: <strong>${serviceCounts[serviceId]}</strong>)`;
          countEl.style.cssText = 'font-weight: 500; margin-top: -10px; margin-bottom: 10px; color: var(--secondary-color);';
          card.querySelector('.service-card-info').appendChild(countEl);
          card.addEventListener('click', (e) => { e.preventDefault(); navigateTo(`?service=${service.id}&purchaseId=${purchaseId}`); });
          list.appendChild(card);
        }
      });
    } catch (error) { list.innerHTML = `<p class="error-message">${error.message}</p>`; }
  }
  
  router();
  window.addEventListener('popstate', router);
});


