// APP.JS - VERSIÓN COMPLETA Y FUNCIONAL (24/09/2025)

document.addEventListener('DOMContentLoaded', () => {
  const appContainer = document.getElementById('app-container');
  let allData = null;
  
  // --- CONFIGURACIÓN ---
  const API_ENDPOINT = 'https://script.google.com/macros/s/AKfycbzlZJ0mTAUDaE_c9_oTCvSFrwTG6DC4sWRv8NtbMw1yxXx2NeP3FmvRK5hIN81_R7QdTQ/exec';
  
  // --- ROUTER Y RENDERIZADO ---
  function router() {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    const category = params.get('category');
    const serviceId = params.get('service');
    if (serviceId) renderServiceDetailView(serviceId);
    else if (category) renderServicesView(category);
    else renderCategoriesView();
  }

  function renderView(templateId) {
    const template = document.getElementById(templateId);
    if (!template) {
      appContainer.innerHTML = `<p class="error-message">Error: La vista no existe.</p>`;
      return null;
    }
    appContainer.innerHTML = '';
    const viewContent = template.content.cloneNode(true);
    appContainer.appendChild(viewContent);
    return appContainer.querySelector('.view');
  }
  
  // --- FUNCIONES DE OBTENCIÓN DE DATOS ---
  async function fetchAppData() {
    if (allData) return allData;
    try {
        const response = await fetch(`${API_ENDPOINT}?action=getAppData`);
        if (!response.ok) throw new Error('No se pudo conectar con el servidor.');
        const data = await response.json();
        if (data.status !== 'success') throw new Error(data.message || 'Error al cargar datos iniciales.');
        allData = data;
        return allData;
    } catch (error) {
        console.error("Fetch App Data Error:", error);
        throw error;
    }
  }
  
  // --- VISTAS DE LA APLICACIÓN ---
  async function renderCategoriesView() {
    const view = renderView('template-categories-view');
    if (!view) return;
    const categoryGrid = view.querySelector('.category-grid');
    categoryGrid.innerHTML = ''; 
    categoryGrid.appendChild(document.getElementById('template-loading').content.cloneNode(true));
    try {
      await fetchAppData();
      const categories = [...new Set(allData.services.map(s => s.categoria))];
      categoryGrid.innerHTML = '';
      categories.forEach(categoryName => {
        const card = createCard('category', { name: categoryName });
        card.addEventListener('click', (e) => {
          e.preventDefault();
          navigateTo(`?category=${encodeURIComponent(categoryName)}`);
        });
        categoryGrid.appendChild(card);
      });
    } catch (error) {
      categoryGrid.innerHTML = `<p class="error-message">Error al cargar las categorías: ${error.message}</p>`;
    }
  }

  async function renderServicesView(categoryName) {
    const view = renderView('template-services-view');
    if (!view) return;
    view.querySelector('.view-title').textContent = decodeURIComponent(categoryName);
    view.querySelector('.back-link').addEventListener('click', (e) => { e.preventDefault(); navigateTo('/'); });
    const serviceList = view.querySelector('.service-list');
    serviceList.innerHTML = '';
    serviceList.appendChild(document.getElementById('template-loading').content.cloneNode(true));
    try {
      await fetchAppData();
      const servicesInCategory = allData.services.filter(s => s.categoria === decodeURIComponent(categoryName));
      serviceList.innerHTML = '';
      servicesInCategory.forEach(service => {
        const serviceCard = createCard('service', service);
        serviceCard.addEventListener('click', (e) => {
          e.preventDefault();
          navigateTo(`?service=${service.id}`);
        });
        serviceList.appendChild(serviceCard);
      });
    } catch (error) {
      serviceList.innerHTML = `<p class="error-message">Error al cargar servicios: ${error.message}</p>`;
    }
  }
  
  async function renderServiceDetailView(serviceId) {
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
        const specialistNames = service.especialistas.map(specId => allData.specialists.find(s => s.id.toUpperCase() === specId.toUpperCase())?.nombre).filter(Boolean).join(' • ');
        view.querySelector('#service-specialists-list').textContent = specialistNames ? `Con: ${specialistNames}`: '';
      }
      view.querySelector('.back-link').addEventListener('click', (e) => { e.preventDefault(); navigateTo(`?category=${encodeURIComponent(service.categoria)}`); });
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

  // --- LÓGICA DE CALENDARIO Y RESERVA ---
  function initializeCalendar(serviceId, view) {
    const monthYearEl = view.querySelector('#monthYear');
    const calendarDaysEl = view.querySelector('#calendarDays');
    let currentDate = new Date();
    let serverToday = '';

    async function renderCalendar() {
      monthYearEl.textContent = currentDate.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
      calendarDaysEl.innerHTML = '';
      const month = currentDate.getMonth(), year = currentDate.getFullYear();
      let firstDayOfMonth = new Date(year, month, 1).getDay();
      const lastDateOfMonth = new Date(year, month + 1, 0).getDate();
      for (let i = 0; i < firstDayOfMonth; i++) { calendarDaysEl.innerHTML += `<div class="calendar-day disabled"></div>`; }
      for (let i = 1; i <= lastDateOfMonth; i++) {
        const dayDate = new Date(year, month, i);
        const isoDate = toISODateString(dayDate);
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';
        dayCell.textContent = i;
        dayCell.dataset.date = isoDate;
        if (serverToday && isoDate <= serverToday) {
          dayCell.classList.add('disabled');
        } else {
          dayCell.addEventListener('click', () => {
            view.querySelectorAll('.calendar-day.selected').forEach(el => el.classList.remove('selected'));
            dayCell.classList.add('selected');
            fetchAndDisplaySlots(serviceId, dayDate);
          });
        }
        calendarDaysEl.appendChild(dayCell);
      }
    }

    async function fetchAndDisplaySlots(serviceId, date) {
      const slotsContainer = view.querySelector('.slots-container');
      const slotsEl = view.querySelector('#availableSlots');
      slotsContainer.style.display = 'block';
      slotsEl.innerHTML = '';
      slotsEl.appendChild(document.getElementById('template-loading').content.cloneNode(true));
      const url = `${API_ENDPOINT}?action=getAvailableSlots&serviceId=${serviceId}&date=${toISODateString(date)}`;
      try {
        const response = await fetch(url);
        const data = await response.json();
        slotsEl.innerHTML = '';
        if (data.status === 'success' && data.availableSlots.length > 0) {
          data.availableSlots.forEach(slotData => {
            const slotEl = document.createElement('div');
            slotEl.className = 'slot';
            slotEl.textContent = formatTime12h(slotData.time);
            slotEl.addEventListener('click', () => openBookingModal(serviceId, date, slotData));
            slotsEl.appendChild(slotEl);
          });
        } else {
          slotsEl.innerHTML = '<p>No hay horarios disponibles para este día.</p>';
        }
      } catch (e) {
        slotsEl.innerHTML = '<p class="error-message">Error al cargar la disponibilidad.</p>';
      }
    }
    
    async function setupCalendar() {
      try {
        const url = `${API_ENDPOINT}?action=getAvailableSlots&serviceId=${serviceId}&date=check`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`El servidor respondió con el estado ${response.status}`);
        const data = await response.json();
        if (data.serverDate) {
          serverToday = data.serverDate;
          renderCalendar();
        } else { throw new Error('Respuesta inválida del servidor.'); }
      } catch (e) {
        calendarDaysEl.innerHTML = `<p class="error-message">No se pudo inicializar el calendario: ${e.message}</p>`;
      }
    }
    
    view.querySelector('#prevMonth').onclick = () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); };
    view.querySelector('#nextMonth').onclick = () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); };
    
    setupCalendar();
  }

  async function openBookingModal(serviceId, date, slotData) {
    const service = allData.services.find(s => s.id === serviceId);
    const modal = document.getElementById('booking-modal');
    
    const form = modal.querySelector('.booking-form');
    form.style.display = 'block';
    modal.querySelector('#modal-message').style.display = 'none';
    const confirmBtn = document.getElementById('confirm-booking-btn');
    confirmBtn.disabled = false;
    
    document.getElementById('modal-title').textContent = 'Revisa y Confirma tu Cita';
    modal.querySelector('#modal-service-name').textContent = service.nombre;
    modal.querySelector('#modal-date').textContent = date.toLocaleDateString('es-MX', { dateStyle: 'long' });
    modal.querySelector('#modal-time').textContent = formatTime12h(slotData.time);
    modal.querySelector('#modal-specialist-name').textContent = slotData.specialistName;
    
    const paymentOptions = modal.querySelector('#payment-options-section');
    const transferDetails = modal.querySelector('#transfer-details');

    if (service.precio > 0) {
      modal.querySelector('#modal-price').textContent = `$${service.precio.toLocaleString('es-MX')} MXN`;
      paymentOptions.style.display = 'block';
      confirmBtn.textContent = 'Confirmar Cita';
      const updatePaymentView = () => {
        const method = modal.querySelector('input[name="payment-method"]:checked')?.value;
        transferDetails.style.display = method === 'transfer' ? 'block' : 'none';
      };
      modal.querySelectorAll('input[name="payment-method"]').forEach(radio => radio.onchange = updatePaymentView);
      modal.querySelector('input[value="transfer"]').checked = true;
      updatePaymentView();
    } else {
      modal.querySelector('#modal-price').textContent = 'Cortesía / Sin costo';
      paymentOptions.style.display = 'none';
      transferDetails.style.display = 'none';
      confirmBtn.textContent = 'Confirmar Cita de Cortesía';
    }
    
    modal.style.display = 'flex';
    modal.querySelector('#close-modal').onclick = () => modal.style.display = 'none';
    
    confirmBtn.onclick = async () => {
      const clientName = modal.querySelector('#clientName').value.trim();
      const clientEmail = modal.querySelector('#clientEmail').value.trim();
      const clientPhone = modal.querySelector('#clientPhone').value.trim();

      if (!clientName || !clientEmail || !clientPhone) {
        alert('Por favor, completa todos los campos: nombre, correo y celular.');
        return;
      }
      if (!/\S+@\S+\.\S+/.test(clientEmail)) {
        alert('Por favor, introduce un correo electrónico válido.');
        return;
      }
      
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Procesando...';
      
      let paymentStatus = 'Cortesía';
      if (service.precio > 0) {
        const method = modal.querySelector('input[name="payment-method"]:checked').value;
        paymentStatus = method === 'transfer' ? 'Pendiente de transferencia' : 'Pago en sitio';
      }
      
      await createBookingOnServer(serviceId, date, slotData, { clientName, clientEmail, clientPhone, paymentStatus });
    };
  }

  async function createBookingOnServer(serviceId, date, slotData, bookingDetails) {
    const modal = document.getElementById('booking-modal');
    const confirmBtn = document.getElementById('confirm-booking-btn');
    
    const payload = {
      action: 'createBooking',
      serviceId,
      date: toISODateString(date),
      time: slotData.time,
      specialistId: slotData.specialistId,
      ...bookingDetails
    };
    
    try {
      const res = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (result.status !== 'success') throw new Error(result.message);

      modal.querySelector('#modal-title').textContent = '¡Cita Confirmada!';
      modal.querySelector('.booking-form').style.display = 'none';
      const messageEl = modal.querySelector('#modal-message');
      messageEl.textContent = result.message;
      messageEl.className = 'success-message';
      messageEl.style.display = 'block';

      setTimeout(() => {
        modal.style.display = 'none';
        navigateTo('/');
      }, 4000);

    } catch (error) {
      const messageEl = modal.querySelector('#modal-message');
      messageEl.textContent = `Error al agendar: ${error.message}`;
      messageEl.className = 'error-message';
      messageEl.style.display = 'block';
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Intentar de Nuevo";
    }
  }
  
  // --- FUNCIONES AUXILIARES Y DE NAVEGACIÓN ---
  function createCard(type, data) {
    const card = document.createElement('a');
    card.href = '#';
    if (type === 'category') {
      card.className = 'category-card';
      card.innerHTML = `<img src="${getCategoryImage(data.name)}" alt="${data.name}" class="category-card-image"><div class="category-card-title"><h3>${data.name}</h3></div>`;
    } else if (type === 'service') {
      card.className = 'service-card';
      const price = data.precio > 0 ? `$${data.precio.toLocaleString('es-MX')} MXN` : 'Gratis';
      card.innerHTML = `<div class="service-card-info"><h4>${data.nombre}</h4><p>${data.duracion} min · ${price}</p></div><div class="service-card-arrow"><i class="ph-bold ph-caret-right"></i></div>`;
    }
    return card;
  }

  function getCategoryImage(categoryName) {
    const images = {
      'Uñas': 'http://amor-vael.com/wp-content/uploads/2025/08/unas.jpeg',
      'Pestañas': 'http://amor-vael.com/wp-content/uploads/2025/08/pestanas.jpeg',
      'Masajes': 'http://amor-vael.com/wp-content/uploads/2025/08/masajes.jpeg',
      'Faciales': 'http://amor-vael.com/wp-content/uploads/2025/08/faciales.jpeg'
    };
    return images[categoryName] || 'https://placehold.co/600x400/E5A1AA/FFFFFF?text=Amor-Vael'
  }
  
  function formatTime12h(time24h) {
    if (!time24h) return '';
    const [h, m] = time24h.split(':');
    return new Date(1970, 0, 1, parseInt(h), parseInt(m)).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  function toISODateString(date) { 
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }

  function navigateTo(path) {
    window.history.pushState({}, '', path);
    router();
  }
  
  // --- INICIALIZACIÓN ---
  router();
  window.addEventListener('popstate', router);
});
