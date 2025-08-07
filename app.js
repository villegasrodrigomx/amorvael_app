document.addEventListener('DOMContentLoaded', () => {
  const appContainer = document.getElementById('app-container');
  let allData = null; // Guardaremos aquí todos los datos de la app

  // --- API ---
  const API_ENDPOINT = '/.netlify/functions/engine';

  // --- ROUTER ---
  function router() {
    const params = new URLSearchParams(window.location.search);
    const category = params.get('category');
    const serviceId = params.get('service');

    if (serviceId) {
      // Lógica para mostrar detalles del servicio (la haremos en el siguiente paso)
      console.log('Mostrar detalles para el servicio:', serviceId);
    } else if (category) {
      // ¡NUEVA LÓGICA! Mostrar la lista de servicios de una categoría
      renderServicesView(category);
    } else {
      renderCategoriesView();
    }
  }

  // --- RENDERIZADO DE VISTAS ---

  function renderView(templateId) {
    const template = document.getElementById(templateId);
    if (!template) return null;
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
        // IMPORTANTE: Ahora usamos un event listener para manejar la navegación
        card.addEventListener('click', (e) => {
            e.preventDefault();
            // Actualizamos la URL y llamamos al router para cambiar de vista
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

  // --- ¡NUEVA FUNCIÓN! ---
  // Renderiza la vista que muestra la lista de servicios para una categoría
  async function renderServicesView(categoryName) {
    const view = renderView('template-services-view');
    if (!view) return;

    // Ponemos el título de la categoría en la vista
    view.querySelector('.view-title').textContent = categoryName;
    
    // Configuramos el botón de "Volver"
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

      // Filtramos solo los servicios que pertenecen a esta categoría
      const servicesInCategory = allData.services.filter(s => s.categoria === categoryName);
      
      serviceList.innerHTML = '';

      servicesInCategory.forEach(service => {
        const serviceCard = document.createElement('a');
        serviceCard.className = 'service-card';
        serviceCard.href = `?service=${service.id}`;
        // Por ahora, el enlace no hará nada, lo implementaremos en el siguiente paso
        serviceCard.addEventListener('click', (e) => e.preventDefault());

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


  // --- FUNCIONES AUXILIARES ---

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

  // --- INICIAR LA APP ---
  router();
  // Escuchar los cambios en la URL (botones de atrás/adelante del navegador)
  window.addEventListener('popstate', router);
});
