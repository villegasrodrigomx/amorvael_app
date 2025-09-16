document.addEventListener('DOMContentLoaded', () => {
  const appContainer = document.getElementById('app-container');
  let allData = null;
  let currentDiscount = null;
  
  // IMPORTANTE: Asegúrate de que esto apunte a tu backend.
  // Puede ser tu URL de función de Netlify o directamente la URL de la Web App de Google.
  const API_ENDPOINT = '/.netlify/functions/engine'; 

  // --- Router (Se mantiene tu lógica original) ---
  function router() {
    // Recargamos clientData en cada navegación para asegurar que esté actualizado
    clientData = JSON.parse(sessionStorage.getItem('amorVaelClientData')) || null;
    
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
    } else if (view === 'packages') {
      renderPackagesView();
    } else {
      renderCategoriesView();
    }
  }

  // --- Renderizado de Vistas (Modificaciones clave) ---
  
  function renderServiceDetailView(serviceId) {
      const service = allData.allServices.find(s => s.id === serviceId);
      const modal = document.getElementById('booking-modal');
      
      // ... (poblar nombre, precio, etc., como en tu código original) ...
      // CORRECCIÓN: Mostrar el nombre de la especialista
      const specialistsText = service.specialistsData.map(sp => sp.nombre).join(' / ');
      document.getElementById('modal-specialist-name').textContent = specialistsText || 'Por asignar';

      document.getElementById('service-final-price').textContent = service.precio.toLocaleString('es-MX');

      modal.style.display = 'block';

      // NUEVO: Listener para el botón de descuento
      document.getElementById('apply-service-discount-btn').onclick = () => {
          const code = document.getElementById('service-discount-code').value;
          applyDiscount(code, service.id, service.precio, 'service');
      };
  }

  function renderPackageDetailView(packageId) {
      const pkg = allData.allPackages.find(p => p.id === packageId);
      // CORRECCIÓN: Mostrar el modal en lugar del mensaje de "en construcción"
      const modal = document.getElementById('package-modal');
      
      // ... (poblar el modal con los datos del paquete) ...
      
      document.getElementById('pkg-final-price').textContent = pkg.precio.toLocaleString('es-MX');
      modal.style.display = 'block';

      // NUEVO: Listener para el botón de descuento
      document.getElementById('apply-pkg-discount-btn').onclick = () => {
          const code = document.getElementById('pkg-discount-code').value;
          applyDiscount(code, pkg.id, pkg.precio, 'pkg');
      };
  }

  // --- NUEVA LÓGICA DE DESCUENTOS ---

  async function applyDiscount(code, itemId, originalPrice, typePrefix) {
      const messageEl = document.getElementById(`${typePrefix}-discount-message`);
      const finalPriceEl = document.getElementById(`${typePrefix}-final-price`);

      if (!code) {
          messageEl.textContent = 'Por favor, ingresa un código.';
          messageEl.className = 'error';
          return;
      }
      
      messageEl.textContent = 'Validando...';
      messageEl.className = '';
      
      try {
          const response = await fetch(`${API_ENDPOINT}?action=validateDiscountCode&code=${code}&itemId=${itemId}`);
          const result = await response.json();

          if (result.status === 'success') {
              currentDiscount = result.discount;
              const newPrice = calculateDiscountedPrice(originalPrice, currentDiscount);
              finalPriceEl.textContent = newPrice.toLocaleString('es-MX');
              messageEl.textContent = '¡Descuento aplicado!';
              messageEl.className = 'success';
          } else {
              throw new Error(result.message);
          }
      } catch (error) {
          currentDiscount = null;
          finalPriceEl.textContent = originalPrice.toLocaleString('es-MX');
          messageEl.textContent = error.message;
          messageEl.className = 'error';
      }
  }
  
  function calculateDiscountedPrice(originalPrice, discount) {
      const value = parseFloat(discount.Valor);
      if (discount.Tipo === '%') return originalPrice * (1 - value / 100);
      if (discount.Tipo === 'MXN') return Math.max(0, originalPrice - value);
      return originalPrice;
  }
  
  // Inicia la app
  router();
  window.addEventListener('popstate', router);
});

