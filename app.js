document.addEventListener('DOMContentLoaded', () => {
  const appContainer = document.getElementById('app-container');
  let allData = null;
  let clientData = JSON.parse(sessionStorage.getItem('amorVaelClientData')) || null;

  const API_ENDPOINT = '/.netlify/functions/engine';

  // --- ROUTER PRINCIPAL (CORREGIDO) ---
  function router() {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    const category = params.get('category');
    const serviceId = params.get('service');
    const packageId = params.get('package');
    const purchaseId = params.get('purchaseId');

    if (view === 'client-login') {
      renderClientLoginView();
    } else if (view === 'my-packages') {
      renderClientPackagesView();
    } else if (view === 'book-package-session') {
      renderPackageServicesView(purchaseId);
    } else if (packageId) {
      renderPackageDetailView(packageId);
    } else if (serviceId) {
      renderServiceDetailView(serviceId, purchaseId);
    } else if (category) {
      renderServicesView(category);
    } else if (view === 'packages') { // <-- ESTA ES LA LÍNEA QUE FALTABA
      renderPackagesView();
    } else {
      renderCategoriesView();
    }
  }

  // --- FUNCIÓN PARA RENDERIZAR VISTAS ---
  function renderView(templateId) {
    const template = document.getElementById(templateId);
    if (!template) {
      console.error(`La plantilla con ID "${templateId}" no fue encontrada.`);
      appContainer.innerHTML = `<p class="error-message">Error de aplicación: La vista no existe.</p>`;
      return null;
    }
    appContainer.innerHTML = '';
    const viewContent = template.content.cloneNode(true);
    appContainer.appendChild(viewContent);
    return appContainer.querySelector('.view');
  }

  // --- VISTAS DE LA APLICACIÓN ---

  async function renderCategoriesView() {
    const view = renderView('template-categories-view');
    if (!view) return;
    view.querySelector('.client-area-link').addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo('?view=client-login');
    });
    const categoryGrid = view.querySelector('.category-grid');
    categoryGrid.appendChild(document.getElementById('template-loading').content.cloneNode(true));
    try {
      if (!allData) allData = await fetchAppData();
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
      if (allData.packages && allData.packages.length > 0) {
        const packageCard = createCard('package');
        packageCard.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo('?view=packages');
        });
        categoryGrid.appendChild(packageCard);
      }
    } catch (error) {
      categoryGrid.innerHTML = `<p class="error-message">Error al cargar las categorías: ${error.message}</p>`;
    }
  }

  async function renderServicesView(categoryName) {
    const view = renderView('template-services-view');
    if (!view) return;
    view.querySelector('.view-title').textContent = decodeURIComponent(categoryName);
    view.querySelector('.back-link').addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo('/');
    });
    const serviceList = view.querySelector('.service-list');
    serviceList.appendChild(document.getElementById('template-loading').content.cloneNode(true));
    try {
      if (!allData) allData = await fetchAppData();
      const servicesInCategory = allData.services.filter(s => s.categoria === categoryName);
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
      serviceList.innerHTML = `<p class="error-message">Error al cargar los servicios: ${error.message}</p>`;
    }
  }

  async function renderPackagesView() {
    const view = renderView('template-packages-view');
    if (!view) return;
    view.querySelector('.back-link').addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo('/');
    });
    const packageList = view.querySelector('.package-list');
    packageList.appendChild(document.getElementById('template-loading').content.cloneNode(true));
    try {
      if (!allData) allData = await fetchAppData();
      packageList.innerHTML = '';
      allData.packages.forEach(pkg => {
        const packageCard = createCard('package-item', pkg);
        packageCard.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo(`?package=${pkg.id}`);
        });
        packageList.appendChild(packageCard);
      });
    } catch (error) {
      packageList.innerHTML = `<p class="error-message">Error al cargar los paquetes: ${error.message}</p>`;
    }
  }

  async function renderServiceDetailView(serviceId, purchaseId = null) {
    const view = renderView('template-service-detail-view');
    if (!view) return;
    view.prepend(document.getElementById('template-loading').content.cloneNode(true));
    try {
      if (!allData) allData = await fetchAppData();
      const service = allData.services.find(s => s.id === serviceId);
      if (!service) throw new Error('Servicio no encontrado.');
      
      view.querySelector('.loading-spinner')?.remove();
      
      const category = service.categoria || '';
      view.querySelector('.back-link').addEventListener('click', (e) => {
        e.preventDefault();
        if (purchaseId) {
          navigateTo(`?view=book-package-session&purchaseId=${purchaseId}`);
        } else {
          navigateTo(`?category=${encodeURIComponent(category)}`);
        }
      });
      
      view.querySelector('.service-main-image').src = service.imagenUrl || getCategoryImage(category);
      view.querySelector('.view-title').textContent = service.nombre;
      view.querySelector('.service-price').textContent = `$${service.precio.toLocaleString('es-MX')} MXN`;
      view.querySelector('.service-duration').textContent = `Duración: ${service.duracion} minutos`;
      view.querySelector('.service-description').textContent = service.descripcion || 'Descripción no disponible.';
      
      const showCalendarBtn = view.querySelector('#show-calendar-btn');
      const bookingSection = view.querySelector('.booking-section');
      showCalendarBtn.addEventListener('click', () => {
        bookingSection.style.display = 'block';
        showCalendarBtn.style.display = 'none';
        initializeCalendar(serviceId, view, purchaseId);
      });
    } catch (error) {
      view.innerHTML = `<p class="error-message">Error al cargar el servicio: ${error.message}</p>`;
    }
  }

  async function renderPackageDetailView(packageId) {
    const view = renderView('template-package-detail-view');
    if (!view) return;
    view.querySelector('.back-link').addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo('?view=packages');
    });
    view.prepend(document.getElementById('template-loading').content.cloneNode(true));
    try {
      if (!allData) allData = await fetchAppData();
      const pkg = allData.packages.find(p => p.id === packageId);
      if (!pkg) throw new Error('Paquete no encontrado.');
      view.querySelector('.loading-spinner')?.remove();
      view.querySelector('.view-title').textContent = pkg.nombre;
      view.querySelector('.package-price').textContent = `$${pkg.precio.toLocaleString('es-MX')} MXN`;
      const servicesIncludedList = view.querySelector('.package-services-included ul');
      servicesIncludedList.innerHTML = '';
      pkg.servicios.forEach(serviceId => {
        const service = allData.services.find(s => s.id === serviceId);
        if (service) {
          const listItem = document.createElement('li');
          listItem.textContent = service.nombre;
          servicesIncludedList.appendChild(listItem);
        }
      });
      view.querySelector('#buy-package-btn').addEventListener('click', () => {
        openPurchaseModal(pkg);
      });
    } catch (error) {
      view.innerHTML = `<p class="error-message">Error al cargar el paquete: ${error.message}</p>`;
    }
  }

  async function renderClientLoginView() {
    const view = renderView('template-client-login-view');
    if (!view) return;
    view.querySelector('.back-link').addEventListener('click', (e) => { e.preventDefault(); navigateTo('/'); });
    view.querySelector('#find-packages-btn').addEventListener('click', async () => {
      const emailInput = view.querySelector('#client-login-email');
      const messageEl = view.querySelector('#login-message');
      const email = emailInput.value.trim().toLowerCase();
      if (!email) {
        messageEl.textContent = 'Por favor, introduce un correo.';
        return;
      }
      messageEl.textContent = 'Buscando...';
      const url = `${API_ENDPOINT}?action=getClientPackages&clientEmail=${encodeURIComponent(email)}`;
      try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.status === 'success' && data.clientPackages.length > 0) {
          clientData = { email, packages: data.clientPackages };
          sessionStorage.setItem('amorVaelClientData', JSON.stringify(clientData));
          navigateTo('?view=my-packages');
        } else {
          messageEl.textContent = 'No se encontraron paquetes para este correo, o no tienes sesiones restantes.';
        }
      } catch (error) {
        messageEl.textContent = 'Error al buscar paquetes.';
      }
    });
  }

  async function renderClientPackagesView() {
    const view = renderView('template-client-packages-view');
    if (!view) return;
    view.querySelector('.back-link').addEventListener('click', (e) => { e.preventDefault(); clearClientDataAndGoHome(); });
    const listEl = view.querySelector('#client-package-list');
    if (!clientData || clientData.packages.length === 0) {
      listEl.innerHTML = '<p>No tienes paquetes activos. <a href="#" id="try-another-email">Intenta con otro correo</a>.</p>';
      listEl.querySelector('#try-another-email').addEventListener('click', (e) => {
          e.preventDefault();
          navigateTo('?view=client-login');
      });
      return;
    }
    listEl.innerHTML = '';
    clientData.packages.forEach(pkg => {
      const card = document.createElement('div');
      card.className = 'client-package-card';
      const remainingServicesArray = pkg.serviciosRestantes ? pkg.serviciosRestantes.split(',') : [];
      card.innerHTML = `
        <h4>${pkg.nombrePaquete}</h4>
        <p><strong>Sesiones restantes:</strong> ${remainingServicesArray.length}</p>
      `;
      const button = document.createElement('button');
      button.className = 'cta-button';
      button.textContent = 'Agendar Sesión';
      button.onclick = () => navigateTo(`?view=book-package-session&purchaseId=${pkg.id}`);
      card.appendChild(button);
      listEl.appendChild(card);
    });
  }

  async function renderPackageServicesView(purchaseId) {
    const view = renderView('template-package-services-view');
    if (!view) return;
    view.querySelector('.back-link').addEventListener('click', (e) => { e.preventDefault(); navigateTo('?view=my-packages'); });
    const serviceList = view.querySelector('.service-list');
    try {
      if (!allData) allData = await fetchAppData();
      if (!clientData) {
          navigateTo('?view=client-login');
          return;
      }
      const purchase = clientData.packages.find(p => p.id === purchaseId);
      if (!purchase) throw new Error('Compra no encontrada.');
      
      const remainingServiceIds = purchase.serviciosRestantes ? purchase.serviciosRestantes.split(',') : [];
      serviceList.innerHTML = '';

      if (remainingServiceIds.length === 0) {
        serviceList.innerHTML = '<p>Ya has agendado todas las sesiones de este paquete.</p>';
        return;
      }

      remainingServiceIds.forEach(serviceId => {
        const service = allData.services.find(s => s.id === serviceId);
        if (service) {
          const serviceCard = createCard('service', service);
          serviceCard.addEventListener('click', (e) => {
              e.preventDefault();
              navigateTo(`?service=${service.id}&purchaseId=${purchaseId}`);
          });
          serviceList.appendChild(serviceCard);
        }
      });
    } catch (error) {
      serviceList.innerHTML = `<p class="error-message">${error.message}</p>`;
    }
  }

  function initializeCalendar(serviceId, view, purchaseId = null) {
    const monthYearEl = view.querySelector('#monthYear');
    const calendarDaysEl = view.querySelector('#calendarDays');
    const prevMonthBtn = view.querySelector('#prevMonth');
    const nextMonthBtn = view.querySelector('#nextMonth');
    const slotsContainer = view.querySelector('.slots-container');
    const availableSlotsEl = view.querySelector('#availableSlots');
    let currentDate = new Date();
    let hoyOficial = '';

    function renderCalendar() {
      const month = currentDate.getMonth();
      const year = currentDate.getFullYear();
      monthYearEl.textContent = currentDate.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
      calendarDaysEl.innerHTML = '';
      const firstDayOfMonth = new Date(year, month, 1);
      const lastDayOfMonth = new Date(year, month + 1, 0);
      const startDayOfWeek = firstDayOfMonth.getDay();
      for (let i = 0; i < startDayOfWeek; i++) calendarDaysEl.insertAdjacentHTML('beforeend', '<div class="calendar-day disabled"></div>');
      for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
        const dayCell = document.createElement('div');
        const dayDate = new Date(year, month, day);
        const isoDate = toISODateString(dayDate);
        dayCell.className = 'calendar-day';
        dayCell.textContent = day;
        if (hoyOficial && isoDate <= hoyOficial) {
            dayCell.classList.add('disabled');
        } else {
            dayCell.addEventListener('click', async () => {
                view.querySelectorAll('.calendar-day.selected').forEach(el => el.classList.remove('selected'));
                dayCell.classList.add('selected');
                await fetchAndDisplaySlots(serviceId, dayDate, purchaseId);
            });
        }
        calendarDaysEl.appendChild(dayCell);
      }
    }

    async function fetchAndDisplaySlots(serviceId, date, purchaseId) {
        slotsContainer.style.display = 'block';
        availableSlotsEl.innerHTML = '';
        availableSlotsEl.appendChild(document.getElementById('template-loading').content.cloneNode(true));
        const dateString = toISODateString(date);
        const url = `${API_ENDPOINT}?action=getAvailableSlots&serviceId=${serviceId}&date=${dateString}`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            availableSlotsEl.innerHTML = '';
            if (data.status === 'success') {
                if (data.availableSlots.length > 0) {
                    data.availableSlots.sort().forEach(slotTime24h => {
                        const slotEl = document.createElement('div');
                        slotEl.className = 'slot';
                        slotEl.textContent = formatTime12h(slotTime24h);
                        slotEl.addEventListener('click', () => openBookingModal(serviceId, date, slotTime24h, purchaseId));
                        availableSlotsEl.appendChild(slotEl);
                    });
                } else {
                    availableSlotsEl.innerHTML = '<p>No hay horarios disponibles para este día.</p>';
                }
            } else {
                 throw new Error(data.message);
            }
        } catch (error) {
            availableSlotsEl.innerHTML = `<p class="error-message">No se pudo cargar la disponibilidad.</p>`;
        }
    }

    async function setupCalendar() {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateString = toISODateString(tomorrow);
      const url = `${API_ENDPOINT}?action=getAvailableSlots&serviceId=${serviceId}&date=${dateString}`;
      try {
          const response = await fetch(url);
          const data = await response.json();
          if (data.status === 'success') {
              hoyOficial = data.hoy;
              renderCalendar();
          } else {
              throw new Error(data.message);
          }
      } catch(error) {
          console.error("Error al inicializar el calendario:", error);
          calendarDaysEl.innerHTML = `<p class="error-message">No se pudo inicializar el calendario.</p>`;
      }
    }
    prevMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); });
    nextMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); });
    setupCalendar();
  }

  function openBookingModal(serviceId, date, time24h, purchaseId = null) {
    if (purchaseId && !clientData) {
        alert("Tu sesión ha expirado. Por favor, identifícate de nuevo para agendar tu sesión.");
        navigateTo('?view=client-login');
        return;
    }
    const service = allData.services.find(s => s.id === serviceId);
    const modal = document.getElementById('booking-modal');
    document.querySelector('#booking-modal .booking-form').style.display = 'block';
    const modalMessage = document.getElementById('modal-message');
    modalMessage.style.display = 'none';
    const confirmBtn = document.getElementById('confirm-booking-btn');
    confirmBtn.disabled = false;
    document.getElementById('modal-service-name').textContent = service.nombre;
    document.getElementById('modal-date').textContent = date.toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    document.getElementById('modal-time').textContent = formatTime12h(time24h);
    const clientNameInput = document.getElementById('clientName');
    const clientEmailInput = document.getElementById('clientEmail');
    const clientPhoneInput = document.getElementById('clientPhone');

    if (purchaseId) {
      document.getElementById('modal-title').textContent = 'Confirma tu Sesión de Paquete';
      document.getElementById('modal-price').textContent = 'Incluido en tu paquete';
      confirmBtn.textContent = 'Confirmar Sesión';
      const purchase = clientData.packages.find(p => p.id === purchaseId);
      clientNameInput.value = purchase.nombreCliente;
      clientEmailInput.value = purchase.email;
      clientPhoneInput.value = purchase.telefono || '';
    } else {
      document.getElementById('modal-title').textContent = 'Revisa y Confirma tu Cita';
      document.getElementById('modal-price').textContent = `$${service.precio.toLocaleString('es-MX')} MXN`;
      confirmBtn.textContent = 'Confirmar Cita';
      clientNameInput.value = '';
      clientEmailInput.value = '';
      clientPhoneInput.value = '';
    }

    modal.style.display = 'flex';
    document.getElementById('close-modal').onclick = () => modal.style.display = 'none';
    
    confirmBtn.onclick = async () => {
        confirmBtn.textContent = 'Procesando...';
        confirmBtn.disabled = true;
        let bookingData;
        if (purchaseId) {
            bookingData = { action: 'bookPackageSession', serviceId, date: toISODateString(date), time: time24h, clientEmail: clientEmailInput.value, purchaseId };
        } else {
            bookingData = { action: 'createBooking', serviceId, date: toISODateString(date), time: time24h, clientName: clientNameInput.value, clientEmail: clientEmailInput.value, clientPhone: clientPhoneInput.value };
        }
        
        try {
            const response = await fetch(API_ENDPOINT, { method: 'POST', body: JSON.stringify(bookingData) });
            const result = await response.json();
            if (result.status === 'success') {
                document.getElementById('modal-title').textContent = '¡Cita Confirmada!';
                modalMessage.textContent = result.message;
                modalMessage.className = 'success';
                document.querySelector('#booking-modal .booking-form').style.display = 'none';
                if(purchaseId) {
                  sessionStorage.removeItem('amorVaelClientData');
                  clientData = null;
                }
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            modalMessage.textContent = error.message;
            modalMessage.className = 'error';
            confirmBtn.textContent = purchaseId ? 'Confirmar Sesión' : 'Confirmar Cita';
            confirmBtn.disabled = false;
        }
        modalMessage.style.display = 'block';
    };
  }

  function openPurchaseModal(pkg) {
    const modal = document.getElementById('booking-modal');
    document.getElementById('modal-title').textContent = 'Confirmar Compra de Paquete';
    document.querySelector('#booking-modal .booking-summary').innerHTML = `<p><strong>Paquete:</strong> <span id="modal-service-name">${pkg.nombre}</span></p><p><strong>Precio:</strong> <span id="modal-price">$${pkg.precio.toLocaleString('es-MX')} MXN</span></p>`;
    document.querySelector('#booking-modal .booking-form').style.display = 'block';
    const modalMessage = document.getElementById('modal-message');
    modalMessage.style.display = 'none';
    const confirmBtn = document.getElementById('confirm-booking-btn');
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Confirmar Compra';
    modal.style.display = 'flex';
    document.getElementById('close-modal').onclick = () => modal.style.display = 'none';
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
        const purchaseData = { action: 'purchasePackage', packageId: pkg.id, clientName, clientEmail, clientPhone };
        try {
            const response = await fetch(API_ENDPOINT, { method: 'POST', body: JSON.stringify(purchaseData) });
            const result = await response.json();
            if (result.status === 'success') {
                document.getElementById('modal-title').textContent = '¡Compra Exitosa!';
                modalMessage.textContent = result.message;
                modalMessage.className = 'success';
                document.querySelector('#booking-modal .booking-form').style.display = 'none';
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            modalMessage.textContent = error.message;
            modalMessage.className = 'error';
            confirmBtn.textContent = 'Confirmar Compra';
            confirmBtn.disabled = false;
        }
        modalMessage.style.display = 'block';
    };
  }

  async function fetchAppData() {
    const response = await fetch(`${API_ENDPOINT}?action=getAppData`);
    if (!response.ok) throw new Error('No se pudo conectar con el servidor.');
    const data = await response.json();
    if (data.status !== 'success') throw new Error(data.message);
    return data;
  }
  
  function getCategoryImage(categoryName) {
    const images = { 'Uñas': 'http://amor-vael.com/wp-content/uploads/2025/08/unas.jpeg', 'Pestañas': 'http://amor-vael.com/wp-content/uploads/2025/08/pestanas.jpeg', 'Masajes': 'http://amor-vael.com/wp-content/uploads/2025/08/masajes.jpeg', 'Faciales': 'http://amor-vael.com/wp-content/uploads/2025/08/faciales.jpeg' };
    return images[categoryName] || 'https://placehold.co/600x400/E5A1AA/FFFFFF?text=Amor-Vael';
  }

  function formatTime12h(time24h) {
    if (!time24h) return '';
    const [hours, minutes] = time24h.split(':');
    const h = parseInt(hours, 10);
    const suffix = h >= 12 ? 'p.m.' : 'a.m.';
    const hour12 = ((h + 11) % 12 + 1);
    return `${hour12}:${minutes} ${suffix}`;
  }

  function navigateTo(path) {
    history.pushState({}, '', path);
    router();
  }

  function createCard(type, data) {
    const card = document.createElement('a');
    if (type === 'category') {
      card.className = 'category-card';
      card.innerHTML = `<img src="${getCategoryImage(data.name)}" alt="Imagen de ${data.name}" class="category-card-image"><div class="category-card-title"><h3>${data.name}</h3></div>`;
    } else if (type === 'package') {
      card.className = 'category-card';
      const packageImageUrl = 'http://amor-vael.com/wp-content/uploads/2021/08/lotus-spa-template-services-header-img-bg.jpg';
      card.innerHTML = `<img src="${packageImageUrl}" alt="Imagen de Paquetes" class="category-card-image"><div class="category-card-title"><h3>Paquetes Especiales</h3></div>`;
    } else if (type === 'service') {
      card.className = 'service-card';
      card.innerHTML = `<div class="service-card-info"><h4>${data.nombre}</h4><p>${data.duracion} min · $${data.precio.toLocaleString('es-MX')} MXN</p></div><div class="service-card-arrow"><i class="ph-bold ph-caret-right"></i></div>`;
    } else if (type === 'package-item') {
      card.className = 'package-card';
      const serviceCount = data.servicios.length;
      const serviceText = serviceCount === 1 ? '1 servicio' : `${serviceCount} servicios`;
      card.innerHTML = `<h4>${data.nombre}</h4><p>Incluye ${serviceText}</p><p class="package-price">$${data.precio.toLocaleString('es-MX')} MXN</p>`;
    }
    return card;
  }

  function toISODateString(date) { 
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }
  
  function clearClientDataAndGoHome() {
    sessionStorage.removeItem('amorVaelClientData');
    clientData = null;
    navigateTo('/');
  }

  router();
  window.addEventListener('popstate', router);
});
