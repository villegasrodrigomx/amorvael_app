/**
 * =================================================================
 * MOTOR DE CITAS AMOR-VAEL - APP.JS
 * =================================================================
 * @version   12.0 (Final y Estable con Descuentos Corregidos)
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
