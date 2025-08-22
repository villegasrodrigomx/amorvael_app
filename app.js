document.addEventListener('DOMContentLoaded', () => {
  const appContainer = document.getElementById('app-container');
  let allData = null;
  // CORRECCIÓN: Nos aseguramos de que clientData siempre se cargue desde sessionStorage al inicio
  let clientData = JSON.parse(sessionStorage.getItem('amorVaelClientData')) || null;

  const API_ENDPOINT = '/.netlify/functions/engine';
  const stripe = Stripe('pk_test_51RykGMA68QYOf35CXVLHnoL1IZeWbtC2Fn72tPNSP8sNLLAAW9zUgtNJZxsaujFACiPE49JXfLOhcMtJkbWM1FyI005rXaLSb5');

  // --- ROUTER PRINCIPAL ---
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
      view.querySelector('.service-main-image').src = service.imagenUrl || 'https://placehold.co/600x400';
      view.querySelector('.service-price').textContent = `$${service.precio.toLocaleString('es-MX')} MXN`;
      view.querySelector('.service-duration').textContent = `Duración: ${service.duracion} minutos`;
      view.querySelector('.service-description').textContent = service.descripcion || '';
      
      const showCalendarBtn = view.querySelector('#show-calendar-btn');
      const bookingSection = view.querySelector('.booking-section');
      showCalendarBtn.addEventListener('click', () => {
        bookingSection.style.display = 'block';
        showCalendarBtn.style.display = 'none';
        initializeCalendar(serviceId, view, purchaseId);
      });
    } catch (error) {
      view.innerHTML = `<p class="error-message">Error: ${error.message}</p>`;
    }
  }

  function initializeCalendar(serviceId, view, purchaseId) {
    const calendarDaysEl = view.querySelector('#calendarDays');
    let currentDate = new Date();
    
    async function renderCalendar() {
      // ... Lógica para renderizar el calendario ...
      const url = `${API_ENDPOINT}?action=getAvailableSlots&serviceId=${serviceId}&date=check`;
      const response = await fetch(url);
      const data = await response.json();
      const hoyOficial = data.hoy;

      // ... (resto de la lógica para dibujar los días)
      // Dentro del bucle de días:
      dayCell.addEventListener('click', () => {
        // ...
        fetchAndDisplaySlots(serviceId, dayDate, purchaseId);
      });
    }

    async function fetchAndDisplaySlots(serviceId, date, purchaseId) {
      const slotsEl = view.querySelector('#availableSlots');
      slotsEl.innerHTML = '';
      slotsEl.appendChild(document.getElementById('template-loading').content.cloneNode(true));
      
      const url = `${API_ENDPOINT}?action=getAvailableSlots&serviceId=${serviceId}&date=${toISODateString(date)}`;
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
        slotsEl.innerHTML = '<p>No hay horarios disponibles.</p>';
      }
    }
    renderCalendar();
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

    // Reset
    clientInputs.style.display = 'block';
    confirmBtn.style.display = 'block';
    confirmBtn.disabled = false;
    modal.querySelector('#modal-message').style.display = 'none';

    // Populate
    modal.querySelector('#modal-service-name').textContent = service.nombre;
    modal.querySelector('#modal-date').textContent = date.toLocaleDateString('es-MX', { dateStyle: 'long' });
    modal.querySelector('#modal-time').textContent = formatTime12h(slotData.time);
    modal.querySelector('#modal-specialist-name').textContent = slotData.specialistName;
    
    if (purchaseId) {
      confirmBtn.textContent = 'Confirmar Sesión';
      modal.querySelector('#modal-price').textContent = 'Incluido en tu paquete';
      paymentOptions.style.display = 'none';
      paymentSection.style.display = 'none';
      const purchase = clientData.packages.find(p => p.id === purchaseId);
      modal.querySelector('#clientName').value = purchase.nombreCliente;
      modal.querySelector('#clientEmail').value = purchase.email;
      modal.querySelector('#clientPhone').value = purchase.telefono || '';
    } else {
      modal.querySelector('#modal-price').textContent = `$${service.precio.toLocaleString('es-MX')} MXN`;
      paymentOptions.style.display = 'block';
      modal.querySelector('#clientName').value = '';
      modal.querySelector('#clientEmail').value = '';
      modal.querySelector('#clientPhone').value = '';
      
      const updateView = () => {
        const method = modal.querySelector('input[name="payment-method"]:checked').value;
        paymentSection.style.display = method === 'card' ? 'block' : 'none';
        confirmBtn.textContent = method === 'card' ? 'Continuar al Pago' : 'Confirmar Cita';
      };
      modal.querySelectorAll('input[name="payment-method"]').forEach(radio => radio.onchange = updateView);
      updateView();
    }
    
    modal.style.display = 'flex';
    modal.querySelector('#close-modal').onclick = () => modal.style.display = 'none';
    
    confirmBtn.onclick = async () => {
      const clientName = modal.querySelector('#clientName').value;
      const clientEmail = modal.querySelector('#clientEmail').value;
      if (!clientName || !clientEmail) return alert('Por favor, completa nombre y correo.');
      
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Procesando...';
      
      if (purchaseId) {
        await createBookingOnServer(serviceId, date, slotData, purchaseId);
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
    const confirmBtn = document.getElementById('confirm-booking-btn');
    const clientInputs = document.querySelector('#booking-modal .client-inputs');
    const paymentSection = document.querySelector('#booking-modal #payment-section');

    try {
      const intentRes = await fetch(API_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify({ action: 'createPaymentIntent', serviceId })
      });
      const intentData = await intentRes.json();
      if (intentData.status !== 'success') throw new Error(intentData.message);

      clientInputs.style.display = 'none';
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
      document.getElementById('modal-message').textContent = `Error: ${error.message}`;
      document.getElementById('modal-message').style.display = 'block';
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
    if (purchaseId) bookingData.purchaseId = purchaseId;
    else bookingData.paymentStatus = paymentStatus;
    
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

    } catch (error) {
      modal.querySelector('#modal-message').textContent = `Error al agendar: ${error.message}`;
      modal.querySelector('#modal-message').className = 'error';
      modal.querySelector('#modal-message').style.display = 'block';
      confirmBtn.disabled = false;
    }
  }

  function formatTime12h(time24h) {
    if (!time24h) return '';
    const [h, m] = time24h.split(':');
    return new Date(1970, 0, 1, h, m).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  function toISODateString(date) { 
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }

  function navigateTo(path) {
    window.history.pushState({}, '', path);
    router();
  }

  router();
  window.addEventListener('popstate', router);
});
