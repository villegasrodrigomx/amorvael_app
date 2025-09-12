document.addEventListener('DOMContentLoaded', () => {
  const appContainer = document.getElementById('app-container');
  let allData = null;
  let clientData = JSON.parse(sessionStorage.getItem('amorVaelClientData')) || null;
  
  // --- CONFIGURACIÓN ---
  const API_ENDPOINT = '/.netlify/functions/engine';
  const stripe = Stripe('pk_test_51RykGMA68QYOf35CXVLHnoL1IZeWbtC2Fn72tPNSP8sNLLAAW9zUgtNJZxsaujFACiPE49JXfLOhcMtJkbWM1FyI005rXaLSb5');

  // --- ROUTER Y FUNCIONES DE RENDERIZADO ---
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
    else if (view === 'packages') renderPackagesView();
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

  // --- VISTAS DE LA APLICACIÓN ---
  async function fetchAppData() {
    const response = await fetch(`${API_ENDPOINT}?action=getAppData`);
    if (!response.ok) throw new Error('No se pudo conectar con el servidor.');
    const data = await response.json();
    if (data.status !== 'success') throw new Error(data.message || 'Error al cargar datos.');
    return data;
  }

  async function renderCategoriesView() {
    const view = renderView('template-categories-view');
    if (!view) return;
    view.querySelector('.client-area-link').addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo('?view=client-login');
    });
    const categoryGrid = view.querySelector('.category-grid');
    categoryGrid.innerHTML = ''; 
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
    const decodedCategoryName = decodeURIComponent(categoryName);
    view.querySelector('.view-title').textContent = decodedCategoryName;
    view.querySelector('.back-link').addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo('/');
    });
    const listContainer = view.querySelector('.service-list');
    listContainer.innerHTML = '';
    try {
      if (!allData) allData = await fetchAppData();
      // 1. Mostrar paquetes asignados a esta categoría
      const packagesInCategory = allData.packages.filter(p => p.categoria === decodedCategoryName);
      if (packagesInCategory.length > 0) {
        packagesInCategory.forEach(pkg => {
          const packageCard = createCard('package-item', pkg);
          packageCard.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo(`?package=${pkg.id}`);
          });
          listContainer.appendChild(packageCard);
        });
      }
      // 2. Mostrar servicios de esta categoría
      const servicesInCategory = allData.services.filter(s => s.categoria === decodedCategoryName);
      if(servicesInCategory.length > 0) {
        servicesInCategory.forEach(service => {
            const serviceCard = createCard('service', service);
            serviceCard.addEventListener('click', (e) => {
                e.preventDefault();
                navigateTo(`?service=${service.id}`);
            });
            listContainer.appendChild(serviceCard);
        });
      }
      if (packagesInCategory.length === 0 && servicesInCategory.length === 0) {
        listContainer.innerHTML = '<p>No hay servicios o paquetes en esta categoría.</p>';
      }
    } catch (error) {
      listContainer.innerHTML = `<p class="error-message">Error al cargar: ${error.message}</p>`;
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
      view.querySelector('.view-title').textContent = service.nombre;
      if (service.especialistas && allData.specialists) {
        const specialistNames = service.especialistas.map(specId => {
          const spec = allData.specialists.find(s => s.id.toUpperCase() === specId.toUpperCase());
          return spec ? spec.nombre : null;
        }).filter(Boolean).join(' • ');
        view.querySelector('#service-specialists-list').textContent = `Con: ${specialistNames}`;
      }
      view.querySelector('.back-link').addEventListener('click', (e) => {
        e.preventDefault();
        if (purchaseId) navigateTo(`?view=book-package-session&purchaseId=${purchaseId}`);
        else navigateTo(`?category=${encodeURIComponent(service.categoria)}`);
      });
      view.querySelector('.service-main-image').src = service.imagenUrl || getCategoryImage(service.categoria);
      view.querySelector('.service-price').textContent = `$${service.precio.toLocaleString('es-MX')} MXN`;
      view.querySelector('.service-duration').textContent = `Duración: ${service.duracion} minutos`;
      view.querySelector('.service-description').textContent = service.descripcion || '';
      
      const showCalendarBtn = view.querySelector('#show-calendar-btn');
      showCalendarBtn.addEventListener('click', () => {
        view.querySelector('.booking-section').style.display = 'block';
        showCalendarBtn.style.display = 'none';
        initializeCalendar(serviceId, view, purchaseId);
      });
    } catch (error) {
      view.innerHTML = `<p class="error-message">Error: ${error.message}</p>`;
    }
  }

  function initializeCalendar(serviceId, view, purchaseId) {
    const monthYearEl = view.querySelector('#monthYear');
    const calendarDaysEl = view.querySelector('#calendarDays');
    const prevMonthBtn = view.querySelector('#prevMonth');
    const nextMonthBtn = view.querySelector('#nextMonth');
    let currentDate = new Date();
    let hoyOficial = '';

    async function renderCalendar() {
      monthYearEl.textContent = currentDate.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
      calendarDaysEl.innerHTML = '';
      const month = currentDate.getMonth(), year = currentDate.getFullYear();
      const firstDayOfMonth = new Date(year, month, 1).getDay();
      const lastDateOfMonth = new Date(year, month + 1, 0).getDate();
      for (let i = 0; i < firstDayOfMonth; i++) { calendarDaysEl.innerHTML += `<div class="calendar-day disabled"></div>`; }
      for (let i = 1; i <= lastDateOfMonth; i++) {
        const dayDate = new Date(year, month, i);
        const isoDate = toISODateString(dayDate);
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';
        dayCell.textContent = i;
        if (hoyOficial && isoDate <= hoyOficial) {
          dayCell.classList.add('disabled');
        } else {
          dayCell.addEventListener('click', () => {
            view.querySelectorAll('.calendar-day.selected').forEach(el => el.classList.remove('selected'));
            dayCell.classList.add('selected');
            fetchAndDisplaySlots(serviceId, dayDate, purchaseId);
          });
        }
        calendarDaysEl.appendChild(dayCell);
      }
    }
    async function fetchAndDisplaySlots(serviceId, date, purchaseId) {
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
            slotEl.addEventListener('click', () => openBookingModal(serviceId, date, slotData, purchaseId));
            slotsEl.appendChild(slotEl);
          });
        } else {
          slotsEl.innerHTML = '<p>No hay horarios disponibles para este día.</p>';
        }
      } catch (e) {
        slotsEl.innerHTML = '<p class="error-message">Error al cargar disponibilidad.</p>';
      }
    }
    async function setupCalendar() {
        try {
            const url = `${API_ENDPOINT}?action=getAvailableSlots&serviceId=${serviceId}&date=check`;
            const response = await fetch(url);
            const data = await response.json();
            if (data.hoy) {
                hoyOficial = data.hoy;
                renderCalendar();
            } else { throw new Error('Respuesta inválida del servidor'); }
        } catch (e) {
            calendarDaysEl.innerHTML = `<p class="error-message">No se pudo inicializar el calendario.</p>`;
        }
    }
    prevMonthBtn.onclick = () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); };
    nextMonthBtn.onclick = () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); };
    setupCalendar();
  }
  
  async function openBookingModal(serviceId, date, slotData, purchaseId) {
    if (purchaseId && !clientData) {
      alert("Tu sesión ha expirado.");
      return navigateTo('?view=client-login');
    }
  
    const service = allData.services.find(s => s.id === serviceId);
    const modal = document.getElementById('booking-modal');
    const confirmBtn = document.getElementById('confirm-booking-btn');
    const clientInputs = modal.querySelector('.client-inputs');
    const paymentOptions = modal.querySelector('#payment-options-section');
    const paymentSection = modal.querySelector('#payment-section');
    const transferDetails = modal.querySelector('#transfer-details');
    const discountSection = modal.querySelector('#discount-section');

    // Reset
    clientInputs.style.display = 'block';
    confirmBtn.style.display = 'block';
    confirmBtn.disabled = false;
    modal.querySelector('.booking-form').style.display = 'block';
    modal.querySelector('#modal-message').style.display = 'none';
    document.getElementById('modal-title').textContent = 'Revisa y Confirma tu Cita';
    discountSection.style.display = 'none';
    
    // Populate
    modal.querySelector('#modal-service-name').textContent = service.nombre;
    modal.querySelector('#modal-date').textContent = date.toLocaleDateString('es-MX', { dateStyle: 'long' });
    modal.querySelector('#modal-time').textContent = formatTime12h(slotData.time);
    modal.querySelector('#modal-specialist-name').textContent = slotData.specialistName;
    
    const clientNameInput = modal.querySelector('#clientName');
    const clientEmailInput = modal.querySelector('#clientEmail');
    const clientPhoneInput = modal.querySelector('#clientPhone');

    if (purchaseId) {
      confirmBtn.textContent = 'Confirmar Sesión';
      modal.querySelector('#modal-price').textContent = 'Incluido en tu paquete';
      paymentOptions.style.display = 'none';
      paymentSection.style.display = 'none';
      transferDetails.style.display = 'none';
      const purchase = clientData.packages.find(p => p.id === purchaseId);
      clientNameInput.value = purchase.nombreCliente;
      clientEmailInput.value = purchase.email;
      clientPhoneInput.value = purchase.telefono || '';
    } else {
      modal.querySelector('#modal-price').textContent = `$${service.precio.toLocaleString('es-MX')} MXN`;
      clientNameInput.value = '';
      clientEmailInput.value = '';
      clientPhoneInput.value = '';
      
      if (service.precio > 0) {
        paymentOptions.style.display = 'block';
        const updatePaymentView = () => {
          const method = modal.querySelector('input[name="payment-method"]:checked').value;
          paymentSection.style.display = method === 'card' ? 'block' : 'none';
          transferDetails.style.display = method === 'transfer' ? 'block' : 'none';
          confirmBtn.textContent = method === 'card' ? 'Continuar al Pago' : 'Confirmar Cita';
        };
        modal.querySelectorAll('input[name="payment-method"]').forEach(radio => radio.onchange = updatePaymentView);
        updatePaymentView();
      } else {
        paymentOptions.style.display = 'none';
        paymentSection.style.display = 'none';
        transferDetails.style.display = 'none';
        confirmBtn.textContent = 'Confirmar Cita';
      }
    }
    
    modal.style.display = 'flex';
    modal.querySelector('#close-modal').onclick = () => modal.style.display = 'none';
    
    confirmBtn.onclick = async () => {
      if (!clientNameInput.value || !clientEmailInput.value) return alert('Por favor, completa nombre y correo.');
      
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Procesando...';
      
      if (purchaseId) {
        await createBookingOnServer(serviceId, date, slotData, purchaseId);
      } else if (service.precio === 0) {
        await createBookingOnServer(serviceId, date, slotData, null, 'Cortesía');
      } else {
        const method = modal.querySelector('input[name="payment-method"]:checked').value;
        if (method === 'card') {
          await processPayment(serviceId, date, slotData);
        } else {
          const status = method === 'transfer' ? 'Pendiente de transferencia' : 'Pago en sitio';
          await createBookingOnServer(serviceId, date, slotData, null, status);
        }
      }
    };
  }
  
  async function processPayment(serviceId, date, slotData) {
    const modalMessage = document.getElementById('modal-message');
    const confirmBtn = document.getElementById('confirm-booking-btn');
    const clientInputs = document.querySelector('#booking-modal .client-inputs');
    const paymentSection = document.querySelector('#booking-modal #payment-section');
    const paymentOptions = document.querySelector('#booking-modal #payment-options-section');
    const transferDetails = document.querySelector('#booking-modal #transfer-details');

    try {
      const intentRes = await fetch(API_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify({ action: 'createPaymentIntent', serviceId })
      });
      const intentData = await intentRes.json();
      if (intentData.status !== 'success') throw new Error(intentData.message);

      clientInputs.style.display = 'none';
      paymentOptions.style.display = 'none';
      transferDetails.style.display = 'none';
      paymentSection.style.display = 'block';
      confirmBtn.textContent = 'Pagar y Agendar';
      
      const elements = stripe.elements({ clientSecret: intentData.clientSecret });
      const paymentElement = elements.create('payment');
      paymentElement.mount('#payment-element');
      confirmBtn.disabled = false;

      confirmBtn.onclick = async () => {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Confirmando...';
        const { error, paymentIntent } = await stripe.confirmPayment({
          elements,
          redirect: 'if_required'
        });
        if (error) throw new Error(error.message);
        if (paymentIntent.status === 'succeeded') {
          await createBookingOnServer(serviceId, date, slotData, null, 'Pagado con tarjeta');
        } else {
          throw new Error('El pago no fue exitoso.');
        }
      };
    } catch (error) {
      modalMessage.textContent = `Error: ${error.message}`;
      modalMessage.className = 'error';
      modalMessage.style.display = 'block';
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Continuar al Pago';
    }
  }

  async function createBookingOnServer(serviceId, date, slotData, purchaseId, paymentStatus) {
    const modal = document.getElementById('booking-modal');
    const confirmBtn = document.getElementById('confirm-booking-btn');
    const formContainer = modal.querySelector('.booking-form');
    
    let bookingData = {
      action: purchaseId ? 'bookPackageSession' : 'createBooking',
      serviceId, date: toISODateString(date), time: slotData.time,
      specialistId: slotData.specialistId,
      clientName: modal.querySelector('#clientName').value,
      clientEmail: modal.querySelector('#clientEmail').value,
      clientPhone: modal.querySelector('#clientPhone').value,
    };
    if (purchaseId) {
        bookingData.paymentStatus = 'Incluido en paquete';
    } else {
        bookingData.paymentStatus = paymentStatus;
    }
    
    try {
      const res = await fetch(API_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify(bookingData)
      });
      const result = await res.json();
      if (result.status !== 'success') throw new Error(result.message);

      modal.querySelector('#modal-title').textContent = '¡Cita Confirmada!';
      formContainer.style.display = 'none';
      modal.querySelector('#modal-message').textContent = result.message;
      modal.querySelector('#modal-message').className = 'success';
      modal.querySelector('#modal-message').style.display = 'block';

      const closeModalBtn = document.getElementById('close-modal');
      closeModalBtn.onclick = () => {
        modal.style.display = 'none';
        navigateTo('/');
      };

    } catch (error) {
      modal.querySelector('#modal-message').textContent = `Error al agendar: ${error.message}`;
      modal.querySelector('#modal-message').className = 'error';
      modal.querySelector('#modal-message').style.display = 'block';
      confirmBtn.style.display = 'block';
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Intentar de Nuevo";
    }
  }
  
  // --- FUNCIONES AUXILIARES ---
  function createCard(type, data) {
    const card = document.createElement('a');
    card.href = '#';
    if (type === 'category') {
      card.className = 'category-card';
      card.innerHTML = `<img src="${getCategoryImage(data.name)}" alt="${data.name}" class="category-card-image"><div class="category-card-title"><h3>${data.name}</h3></div>`;
    } else if (type === 'package') {
      card.className = 'category-card';
      card.innerHTML = `<img src="https://images.unsplash.com/photo-1540555233522-26a9926973a1?auto=format&fit=crop&q=80&w=1000" alt="Paquetes" class="category-card-image"><div class="category-card-title"><h3>Paquetes Especiales</h3></div>`;
    } else if (type === 'service') {
      card.className = 'service-card';
      card.innerHTML = `<div class="service-card-info"><h4>${data.nombre}</h4><p>${data.duracion} min · $${data.precio.toLocaleString('es-MX')} MXN</p></div><div class="service-card-arrow"><i class="ph-bold ph-caret-right"></i></div>`;
    } else if (type === 'package-item') {
      card.className = 'package-card';
      card.innerHTML = `<h4>${data.nombre}</h4><p class="package-price">$${data.precio.toLocaleString('es-MX')} MXN</p>`;
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
    return images[categoryName] || 'https://placehold.co/600x400/E5A1AA/FFFFFF?text=Amor-Vael';
  }

  function formatTime12h(time24h) {
    if (!time24h) return '';
    const [h, m] = time24h.split(':');
    return new Date(1970, 0, 1, h, m).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  function toISODateString(date) { 
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }

  function navigateTo(path) {
    window.history.pushState({}, '', path);
    router();
  }
  
  function clearClientDataAndGoHome() {
    sessionStorage.removeItem('amorVaelClientData');
    clientData = null;
    navigateTo('/');
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
      const uniqueServiceIds = [...new Set(remainingServiceIds)];
      uniqueServiceIds.forEach(serviceId => {
        const service = allData.services.find(s => s.id === serviceId);
        if (service) {
          const count = remainingServiceIds.filter(id => id === serviceId).length;
          const serviceCard = createCard('service', service);
          const countEl = document.createElement('p');
          countEl.textContent = `(Restantes: ${count})`;
          countEl.style.fontWeight = 'bold';
          serviceCard.querySelector('div').appendChild(countEl);
          
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

  async function openPurchaseModal(pkg) {
    const modal = document.getElementById('booking-modal');
    // Resetear el modal a un estado de compra
    modal.querySelector('#modal-title').textContent = 'Confirmar Compra de Paquete';
    modal.querySelector('.booking-summary').innerHTML = `<p><strong>Paquete:</strong> <span id="modal-service-name">${pkg.nombre}</span></p><p><strong>Precio:</strong> <span id="modal-price">$${pkg.precio.toLocaleString('es-MX')} MXN</span></p>`;
    const form = modal.querySelector('.booking-form');
    form.style.display = 'block';
    form.querySelector('.client-inputs').style.display = 'block';
    form.querySelector('#payment-options-section').style.display = 'none';
    form.querySelector('#payment-section').style.display = 'none';
    form.querySelector('#transfer-details').style.display = 'none';
    const discountSection = form.querySelector('#discount-section');
    discountSection.style.display = 'block';

    const modalMessage = document.getElementById('modal-message');
    modalMessage.style.display = 'none';
    document.getElementById('discount-message').textContent = '';
    document.getElementById('discount-code').value = '';

    const confirmBtn = document.getElementById('confirm-booking-btn');
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Confirmar Compra';
    
    modal.style.display = 'flex';
    document.getElementById('close-modal').onclick = () => modal.style.display = 'none';
    
    // Lógica del descuento
    const applyDiscountBtn = document.getElementById('apply-discount-btn');
    let currentDiscount = null;
    applyDiscountBtn.onclick = async () => {
      const code = document.getElementById('discount-code').value.toUpperCase();
      const messageEl = document.getElementById('discount-message');
      if (!code) return;
      
      const res = await fetch(`${API_ENDPOINT}?action=validateDiscountCode&code=${code}&packageId=${pkg.id}`);
      const result = await res.json();
      
      if(result.status === 'success') {
        currentDiscount = result.discount;
        messageEl.className = 'success';
        messageEl.textContent = `¡Descuento aplicado! Nuevo total: $${result.newPrice.toLocaleString('es-MX')} MXN`;
        modal.querySelector('#modal-price').innerHTML = `$${result.newPrice.toLocaleString('es-MX')} MXN <span class="price-original">$${pkg.precio.toLocaleString('es-MX')} MXN</span>`;
      } else {
        currentDiscount = null;
        messageEl.className = 'error';
        messageEl.textContent = result.message;
        modal.querySelector('#modal-price').textContent = `$${pkg.precio.toLocaleString('es-MX')} MXN`;
      }
    };
    
    confirmBtn.onclick = async () => {
        const clientName = document.getElementById('clientName').value;
        const clientEmail = document.getElementById('clientEmail').value;
        const clientPhone = document.getElementById('clientPhone').value;
        if (!clientName || !clientEmail) {
            alert('Por favor, completa todos los campos.');
            return;
        }
        confirmBtn.textContent = 'Procesando...';
        confirmBtn.disabled = true;
        
        const purchaseData = { 
          action: 'purchasePackage', 
          packageId: pkg.id, 
          clientName, clientEmail, clientPhone,
          discountCode: currentDiscount ? currentDiscount.Codigo : null
        };
        
        try {
            const response = await fetch(API_ENDPOINT, { method: 'POST', body: JSON.stringify(purchaseData) });
            const result = await response.json();
            if (result.status === 'success') {
                modalMessage.textContent = "¡Gracias por tu compra! Serás redirigido para agendar tu primera sesión.";
                modalMessage.className = 'success';
                modalMessage.style.display = 'block';
                form.style.display = 'none';
                
                clientData = { email: clientEmail, packages: result.updatedPackages };
                sessionStorage.setItem('amorVaelClientData', JSON.stringify(clientData));
                setTimeout(() => {
                  modal.style.display = 'none';
                  navigateTo(`?view=book-package-session&purchaseId=${result.purchaseId}`);
                }, 2500);

            } else { throw new Error(result.message); }
        } catch (error) {
            modalMessage.textContent = error.message;
            modalMessage.className = 'error';
            modalMessage.style.display = 'block';
            confirmBtn.textContent = 'Confirmar Compra';
            confirmBtn.disabled = false;
        }
    };
  }

  router();
  window.addEventListener('popstate', router);
});

