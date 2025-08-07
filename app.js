document.addEventListener('DOMContentLoaded', () => {
  const appContainer = document.getElementById('app-container');
  let allData = null; // Guardaremos aquí todos los datos de la app

  // --- API ---
  // El endpoint de nuestra función de Netlify que actúa como proxy
  const API_ENDPOINT = '/.netlify/functions/engine';

  // --- ROUTER ---
  // Decide qué vista mostrar basándose en la URL
  function router() {
    const params = new URLSearchParams(window.location.search);
    const category = params.get('category');
    const serviceId = params.get('service');

    if (serviceId) {
      // Lógica para mostrar detalles del servicio (la haremos más adelante)
      console.log('Mostrar detalles para el servicio:', serviceId);
    } else if (category) {
      // Lógica para mostrar la lista de servicios de una categoría (la haremos más adelante)
      console.log('Mostrar servicios para la categoría:', category);
    } else {
      // Por defecto, mostrar la página de inicio con las categorías
      renderCategoriesView();
    }
  }

  // --- RENDERIZADO DE VISTAS ---

  // Función para limpiar el contenedor y mostrar una nueva vista
  function renderView(templateId) {
    const template = document.getElementById(templateId);
    if (!template) return null;
    appContainer.innerHTML = '';
    const view = template.content.cloneNode(true);
    appContainer.appendChild(view);
    return appContainer.querySelector('.view');
  }

  // Renderiza la vista de categorías
  async function renderCategoriesView() {
    const view = renderView('template-categories-view');
    if (!view) return;

    const categoryGrid = view.querySelector('.category-grid');
    categoryGrid.innerHTML = ''; // Limpiar
    
    // Mostramos un spinner de carga mientras obtenemos los datos
    const loadingSpinner = document.getElementById('template-loading').content.cloneNode(true);
    categoryGrid.appendChild(loadingSpinner);

    try {
      // Si no tenemos los datos, los pedimos. Si ya los tenemos, los reusamos.
      if (!allData) {
        allData = await fetchAppData();
      }

      // Extraemos las categorías únicas de la lista de servicios
      const categories = [...new Set(allData.services.map(s => s.categoria))];
      
      categoryGrid.innerHTML = ''; // Limpiamos el spinner

      categories.forEach(categoryName => {
        const card = document.createElement('a');
        card.className = 'category-card';
        card.href = `?category=${encodeURIComponent(categoryName)}`;
        
        // Asignamos una imagen por defecto a cada categoría
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
      categoryGrid.innerHTML = `<p>Error al cargar las categorías: ${error.message}</p>`;
    }
  }

  // --- FUNCIONES AUXILIARES ---

  // Pide todos los datos iniciales a nuestro backend
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
  
  // Devuelve una imagen para cada categoría.
  // **TU TAREA:** Reemplaza estas URLs con las de tus propias fotos.
  function getCategoryImage(categoryName) {
    const images = {
      'Uñas': 'http://amor-vael.com/wp-content/uploads/2025/08/unas.jpeg',
      'Pestañas': 'http://amor-vael.com/wp-content/uploads/2025/08/pestanas.jpeg',
      'Masajes': 'http://amor-vael.com/wp-content/uploads/2025/08/masajes.jpeg',
      'Faciales': 'http://amor-vael.com/wp-content/uploads/2025/08/faciales.jpeg',
    };
    // Devuelve la imagen de la categoría o una por defecto si no la encuentra
    return images[categoryName] || 'https://placehold.co/600x400/E5A1AA/FFFFFF?text=Amor-Vael';
  }

  // --- INICIAR LA APP ---
  router();
});

