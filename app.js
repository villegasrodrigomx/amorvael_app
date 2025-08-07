document.addEventListener('DOMContentLoaded', () => {
  const appContainer = document.getElementById('app-container');
  let allData = null;

  const API_ENDPOINT = '/.netlify/functions/engine';

  function router() {
    const params = new URLSearchParams(window.location.search);
    const category = params.get('category');
    const serviceId = params.get('service');

    if (serviceId) {
      renderServiceDetailView(serviceId);
    } else if (category) {
      renderServicesView(category);
    } else {
      renderCategoriesView();
    }
  }

  function renderView(templateId) {
    const template = document.getElementById(templateId);
    if (!template) {
      console.error(`La plantilla con ID "${templateId}" no fue encontrada.`);
      return null;
    }
    appContainer.innerHTML = '';
    const view = template.content.cloneNode(true);
    appContainer.appendChild(view);
    return appContainer.querySelector('.view');
  }

  async function renderCategoriesView() {
    const view = renderView('template-categories-view');
    if (!view) return;

    const categoryGrid = view.querySelector('.category-grid');
    categoryGrid.innerHTML = '';
    
    const loadingSpinner = document.getElementById('template-loading').content.cloneNode(true);
    categoryGrid.appendChild(loadingSpinner);

    try {
      if (!allData) {
        allData = await fetchAppData();
      }
      const categories = [...new Set(allData.services.map(s => s.categoria))];
      
      categoryGrid.innerHTML = '';

      categories.forEach(categoryName => {
        const card = document.createElement('a');
        card.className = 'category-card';
        card.addEventListener('click', (e) => {
            e.preventDefault();
            history.pushState({}, '', `?category=${encodeURIComponent(categoryName)}`);
            router();
        });
        
        const categoryImage = getCategoryImage(categoryName);

        card.innerHTML = `
          <img src="${categoryImage}" alt="Imagen de ${categoryName}" class="category-card-image">
          <div class="category-card-title">
            <h3>${categoryName}</h3>
          </div>
        `;
        categoryGrid.appendChild(card);
      });

    } catch (error) {
      categoryGrid.innerHTML = `<p class="error-message">Error al cargar las categorías: ${error.message}</p>`;
    }
  }

  async function renderServicesView(categoryName) {
    const view = renderView('template-services-view');
    if (!view) return;

    view.querySelector('.view-title').textContent = categoryName;
    
    view.querySelector('.back-link').addEventListener('click', (e) => {
        e.preventDefault();
        history.pushState({}, '', '/');
        router();
    });

    const serviceList = view.querySelector('.service-list');
    serviceList.innerHTML = '';
    const loadingSpinner = document.getElementById('template-loading').content.cloneNode(true);
    serviceList.appendChild(loadingSpinner);

    try {
      if (!allData) {
        allData = await fetchAppData();
      }

      const servicesInCategory = allData.services.filter(s => s.categoria === categoryName);
      
      serviceList.innerHTML = '';

      servicesInCategory.forEach(service => {
        const serviceCard = document.createElement('a');
        serviceCard.className = 'service-card';
        serviceCard.addEventListener('click', (e) => {
            e.preventDefault();
            history.pushState({}, '', `?service=${service.id}`);
            router();
        });

        serviceCard.innerHTML = `
          <div class="service-card-info">
            <h4>${service.nombre}</h4>
            <p>${service.duracion} min · $${service.precio.toLocaleString('es-MX')} MXN</p>
          </div>
          <div class="service-card-arrow">
            <i class="ph-bold ph-caret-right"></i>
          </div>
        `;
        serviceList.appendChild(serviceCard);
      });

    } catch (error) {
      serviceList.innerHTML = `<p class="error-message">Error al cargar los servicios: ${error.message}</p>`;
    }
  }

  async function renderServiceDetailView(serviceId) {
    const view = renderView('template-service-detail-view');
    if (!view) return;

    const loadingSpinner = document.getElementById('template-loading').content.cloneNode(true);
    view.prepend(loadingSpinner);

    try {
      if (!allData) {
        allData = await fetchAppData();
      }
      const service = allData.services.find(s => s.id === serviceId);
      if (!service) throw new Error('Servicio no encontrado.');

      const loadingEl = view.querySelector('.loading-spinner');
      if (loadingEl) loadingEl.remove();

      const titleEl = view.querySelector('.view-title');
      if (titleEl) titleEl.textContent = service.nombre;

      const priceEl = view.querySelector('.service-price');
      if (priceEl) priceEl.textContent = `$${service.precio.toLocaleString('es-MX')} MXN`;

      const durationEl = view.querySelector('.service-duration');
      if (durationEl) durationEl.textContent = `Duración: ${service.duracion} minutos`;
      
      const category = allData.services.find(s => s.id === serviceId)?.categoria || '';
      view.querySelector('.back-link').addEventListener('click', (e) => {
        e.preventDefault();
        history.pushState({}, '', `?category=${encodeURIComponent(category)}`);
        router();
      });

      const showCalendarBtn = document.getElementById('show-calendar-btn');
      const bookingSection = view.querySelector('.booking-section');
      if (showCalendarBtn && bookingSection) {
        showCalendarBtn.addEventListener('click', () => {
          bookingSection.style.display = 'block';
          showCalendarBtn.style.display = 'none';
          initializeCalendar(serviceId);
        });
      }

    } catch (error) {
      view.innerHTML = `<p class="error-message">Error al cargar el servicio: ${error.message}</p>`;
    }
  }
  
  function initializeCalendar(serviceId) {
    const monthYearEl = document.getElementById('monthYear');
    const calendarDaysEl = document.getElementById('calendarDays');
    const prevMonthBtn = document.getElementById('prevMonth');
    const nextMonthBtn = document.getElementById('nextMonth');
    const slotsContainer = document.querySelector('.slots-container');
    const availableSlotsEl = document.getElementById('availableSlots');
    
    let currentDate = new Date();

    function renderCalendar() {
      const month = currentDate.getMonth();
      const year = currentDate.getFullYear();
      monthYearEl.textContent = currentDate.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
      calendarDaysEl.innerHTML = '';

      const firstDayOfMonth = new Date(year, month, 1);
      const lastDayOfMonth = new Date(year, month + 1, 0);
      const startDayOfWeek = firstDayOfMonth.getDay();

      for (let i = 0; i < startDayOfWeek; i++) {
        calendarDaysEl.insertAdjacentHTML('beforeend', '<div class="calendar-day disabled"></div>');
      }

      for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
        const dayCell = document.createElement('div');
        const dayDate = new Date(year, month, day);
        dayCell.className = 'calendar-day';
        dayCell.textContent = day;

        if (dayDate < new Date().setHours(0,0,0,0)) {
            dayCell.classList.add('disabled');
        } else {
            dayCell.addEventListener('click', async () => {
                document.querySelectorAll('.calendar-day.selected').forEach(el => el.classList.remove('selected'));
                dayCell.classList.add('selected');
                await fetchAndDisplaySlots(serviceId, dayDate);
            });
        }
        calendarDaysEl.appendChild(dayCell);
      }
    }

    async function fetchAndDisplaySlots(serviceId, date) {
        slotsContainer.style.display = 'block';
        availableSlotsEl.innerHTML = '';
        const loadingSpinner = document.getElementById('template-loading').content.cloneNode(true);
        availableSlotsEl.appendChild(loadingSpinner);

        const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const url = `${API_ENDPOINT}?action=getAvailableSlots&serviceId=${serviceId}&date=${dateString}`;

        try {
            const response = await fetch(url);
            const data = await response.json();
            availableSlotsEl.innerHTML = '';

            if (data.status === 'success' && data.availableSlots.length > 0) {
                data.availableSlots.sort().forEach(slotTime24h => {
                    const slotEl = document.createElement('div');
                    slotEl.className = 'slot';
                    slotEl.textContent = formatTime12h(slotTime24h);
                    slotEl.addEventListener('click', () => {
                        openBookingModal(serviceId, date, slotTime24h);
                    });
                    availableSlotsEl.appendChild(slotEl);
                });
            } else {
                availableSlotsEl.innerHTML = '<p>No hay horarios disponibles para este día.</p>';
            }
        } catch (error) {
            availableSlotsEl.innerHTML = `<p class="error-message">No se pudo cargar la disponibilidad.</p>`;
        }
    }

    prevMonthBtn.addEventListener('click', () => {
      currentDate.setMonth(currentDate.getMonth() - 1);
      renderCalendar();
    });
    nextMonthBtn.addEventListener('click', () => {
      currentDate.setMonth(currentDate.getMonth() + 1);
      renderCalendar();
    });

    renderCalendar();
  }

  function openBookingModal(serviceId, date, time24h) {
    const service = allData.services.find(s => s.id === serviceId);
    const modal = document.getElementById('booking-modal');
    
    document.getElementById('modal-service-name').textContent = service.nombre;
    document.getElementById('modal-date').textContent = date.toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    document.getElementById('modal-time').textContent = formatTime12h(time24h);

    modal.style.display = 'flex';

    document.getElementById('close-modal').onclick = () => modal.style.display = 'none';
    
    const confirmBtn = document.getElementById('confirm-booking-btn');
    confirmBtn.onclick = async () => {
        const clientName = document.getElementById('clientName').value;
        const clientEmail = document.getElementById('clientEmail').value;
        const clientPhone = document.getElementById('clientPhone').value;

        if (!clientName || !clientEmail || !clientPhone) {
            alert('Por favor, completa todos los campos.');
            return;
        }

        confirmBtn.textContent = 'Procesando...';
        confirmBtn.disabled = true;

        const bookingData = {
            serviceId,
            date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
            time: time24h,
            clientName,
            clientEmail,
            clientPhone
        };

        const modalMessage = document.getElementById('modal-message');
        try {
            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                body: JSON.stringify(bookingData)
            });
            const result = await response.json();

            if (result.status === 'success') {
                modalMessage.textContent = result.message;
                modalMessage.className = 'success';
                document.querySelector('#booking-modal .booking-form').style.display = 'none';
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            modalMessage.textContent = error.message;
            modalMessage.className = 'error';
            confirmBtn.textContent = 'Confirmar Cita';
            confirmBtn.disabled = false;
        }
        modalMessage.style.display = 'block';
    };
  }

  async function fetchAppData() {
    const response = await fetch(`${API_ENDPOINT}?action=getAppData`);
    if (!response.ok) {
      throw new Error('No se pudo conectar con el servidor.');
    }
    const data = await response.json();
    if (data.status !== 'success') {
      throw new Error(data.message);
    }
    return data;
  }
  
  function getCategoryImage(categoryName) {
    const images = {
      'Uñas': 'http://amor-vael.com/wp-content/uploads/2025/08/unas.jpeg',
      'Pestañas': 'http://amor-vael.com/wp-content/uploads/2025/08/pestanas.jpeg',
      'Masajes': 'http://amor-vael.com/wp-content/uploads/2025/08/masajes.jpeg',
      'Faciales': 'http://amor-vael.com/wp-content/uploads/2025/08/faciales.jpeg',
    };
    return images[categoryName] || 'https://placehold.co/600x400/E5A1AA/FFFFFF?text=Amor-Vael';
  }

  function formatTime12h(time24h) {
    const [hours, minutes] = time24h.split(':');
    const h = parseInt(hours, 10);
    const suffix = h >= 12 ? 'p.m.' : 'a.m.';
    const hour12 = ((h + 11) % 12 + 1);
    return `${hour12}:${minutes} ${suffix}`;
  }

  router();
  window.addEventListener('popstate', router);
});
