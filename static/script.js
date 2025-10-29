// app.js (módulo) - contiene toda la lógica JS extraída del HTML.
// Mantiene imports de Firebase y la misma lógica/funciones que tenías en el inline script.

import { initializeApp, setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, query, where, addDoc, onSnapshot, getDocs, updateDoc, deleteDoc, runTransaction, getDocFromCache } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Configuración y variables globales MANDATORIAS
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

let db;
let auth;
let currentUserId = null;

// URL base para el API de Flask (funciona localmente y en Azure/Gunicorn)
const API_BASE_URL = window.location.origin; 

// Definición de las estructuras de datos (Schema básico para generar formularios)
const ENTITY_SCHEMAS = {
    Efectivo_y_Equivalente_Efectivo: [
        { id: 'Caja', label: 'Caja', type: 'number', required: true, placeholder: '0.00' },
        { id: 'Caja_chica', label: 'Caja Chica', type: 'number', required: true, placeholder: '0.00' },
        { id: 'Bancos', label: 'Bancos', type: 'number', required: true, placeholder: '0.00' },
        { id: 'Depositos_en_plazo', label: 'Depósitos en Plazo', type: 'number', required: false, placeholder: '0.00' },
        { id: 'Inversiones_en_bono', label: 'Inversiones en Bono', type: 'number', required: false, placeholder: '0.00' },
        { id: 'Inversiones', label: 'Otras Inversiones', type: 'number', required: false, placeholder: '0.00' },
    ],
    Cuentas_y_Documentos_Por_Cobrar: [
        { id: 'Clientes', label: 'Clientes', type: 'number', required: true },
        { id: 'Deudores_varios', label: 'Deudores Varios', type: 'number', required: false },
        { id: 'Rentas_por_cobrar', label: 'Rentas por Cobrar', type: 'number', required: false },
        // ... más campos
    ],
    // Agregue más esquemas aquí
};

// --- FUNCIÓN DE UTILIDAD PARA LLAMADAS AL API DE FLASK ---
const fetchApi = async (url) => {
    try {
        const response = await fetch(`${API_BASE_URL}${url}`);
        const result = await response.json();

        if (!response.ok) {
            // Manejar errores HTTP (4xx, 5xx) donde Flask devuelve error JSON
            const errorMessage = result.message || `Error del servidor (${response.status} ${response.statusText})`;
            return { status: "error", message: errorMessage };
        }

        // Flask devuelve { status: 'success', data: [...] } o { status: 'error', message: '...' }
        return result;

    } catch (error) {
        console.error("Error de red o parsing JSON:", error);
        return { status: "error", message: "Error de red: No se pudo conectar con el servidor Flask. Verifique que el backend esté corriendo." };
    }
};

// --- INICIALIZACIÓN DE FIREBASE Y AUTENTICACIÓN ---
window.onload = async () => {
    try {
        // Habilitar logs para depuración
        setLogLevel('debug');
        
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);

        // Autenticación inicial
        if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
        } else {
            await signInAnonymously(auth);
        }

        onAuthStateChanged(auth, (user) => {
            if (user) {
                currentUserId = user.uid;
                const display = document.getElementById('user-id-display');
                if (display) display.textContent = currentUserId;
                console.log("Firebase Auth listo. User ID:", currentUserId);
                // Iniciar la lógica de la aplicación
                setupEventListeners();
                loadInitialData(); // <-- Ahora carga datos de Flask
            } else {
                // Si falla la autenticación (no debería pasar en este entorno), usar ID aleatorio
                currentUserId = crypto.randomUUID();
                const display = document.getElementById('user-id-display');
                if (display) display.textContent = `Anonimo: ${currentUserId.substring(0, 8)}`;
                console.log("Sesión anónima iniciada. User ID:", currentUserId);
                setupEventListeners();
                loadInitialData(); // <-- Ahora carga datos de Flask
            }
        });
    } catch (error) {
        console.error("Error al inicializar Firebase o autenticar:", error);
        const display = document.getElementById('user-id-display');
        if (display) display.textContent = "ERROR";
    }
};

// --- LÓGICA DE GESTIÓN DE VISTAS (TABS) ---
const setupEventListeners = () => {
    // Eventos para el cambio de vista (Tabs)
    const tabReportes = document.getElementById('tab-reportes');
    const tabGestion = document.getElementById('tab-gestion');
    if (tabReportes) tabReportes.addEventListener('click', () => showView('reportes'));
    if (tabGestion) tabGestion.addEventListener('click', () => showView('gestion'));

    // Eventos de Reportes
    document.querySelectorAll('.report-btn').forEach(button => {
        button.addEventListener('click', handleReportSelection);
    });
    const empresaSelect = document.getElementById('empresa-select');
    if (empresaSelect) {
        empresaSelect.addEventListener('change', () => {
            // Desactivar el reporte actual al cambiar de empresa
            document.querySelectorAll('.report-btn').forEach(btn => btn.classList.remove('active'));
            clearReportDisplay();
        });
    }

    // Eventos de Gestión de Datos
    const entitySelect = document.getElementById('entity-select');
    if (entitySelect) entitySelect.addEventListener('change', handleEntitySelection);
    const saveBtn = document.getElementById('save-record-btn');
    if (saveBtn) saveBtn.addEventListener('click', handleSaveRecord);
};

const showView = (viewName) => {
    const reportesView = document.getElementById('reportes-view');
    const gestionView = document.getElementById('gestion-view');
    const tabReportes = document.getElementById('tab-reportes');
    const tabGestion = document.getElementById('tab-gestion');

    if (!reportesView || !gestionView || !tabReportes || !tabGestion) return;

    if (viewName === 'reportes') {
        reportesView.classList.remove('hidden');
        gestionView.classList.add('hidden');
        tabReportes.classList.add('active');
        tabGestion.classList.remove('active');
        reportesView.classList.add('fade-in-up');
        gestionView.classList.remove('fade-in-up');
    } else if (viewName === 'gestion') {
        reportesView.classList.add('hidden');
        gestionView.classList.remove('hidden');
        tabReportes.classList.remove('active');
        tabGestion.classList.add('active');
        gestionView.classList.add('fade-in-up');
        reportesView.classList.remove('fade-in-up');
    }
};

// --- LÓGICA DE REPORTES (CARGA REAL DE DATOS SQL) ---
const clearReportDisplay = () => {
    const title = document.getElementById('report-title');
    const subtitle = document.getElementById('report-subtitle');
    if (title) title.textContent = 'Seleccione un reporte';
    if (subtitle) subtitle.textContent = '';
    const initial = document.getElementById('initial-message');
    const loading = document.getElementById('loading-message');
    const table = document.getElementById('report-table');
    const header = document.getElementById('table-header');
    const body = document.getElementById('table-body');
    const excelBtn = document.getElementById('export-excel-btn');
    const pdfBtn = document.getElementById('export-pdf-btn');

    if (initial) initial.classList.remove('hidden');
    if (loading) loading.classList.add('hidden');
    if (table) table.classList.add('hidden');
    if (header) header.innerHTML = '';
    if (body) body.innerHTML = '';
    if (excelBtn) excelBtn.disabled = true;
    if (pdfBtn) pdfBtn.disabled = true;
};

const handleReportSelection = (event) => {
    const button = event.currentTarget;
    const reportType = button.getAttribute('data-report');
    const empresaSelect = document.getElementById('empresa-select');
    const companyId = empresaSelect ? empresaSelect.value : '';
    const reportName = button.querySelector('span') ? button.querySelector('span').textContent.replace('<br>', ' ') : '';

    document.querySelectorAll('.report-btn').forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');

    if (!companyId) {
        alertUser("Debe seleccionar una empresa primero.", "warning");
        return;
    }

    loadReportData(reportType, companyId, reportName);
};

const loadReportData = async (reportType, companyId, reportName) => {
    const initial = document.getElementById('initial-message');
    const loading = document.getElementById('loading-message');
    const table = document.getElementById('report-table');
    const excelBtn = document.getElementById('export-excel-btn');
    const pdfBtn = document.getElementById('export-pdf-btn');

    if (initial) initial.classList.add('hidden');
    if (table) table.classList.add('hidden');
    if (loading) loading.classList.remove('hidden');
    if (excelBtn) excelBtn.disabled = true;
    if (pdfBtn) pdfBtn.disabled = true;

    const title = document.getElementById('report-title');
    const subtitle = document.getElementById('report-subtitle');
    if (title) title.textContent = reportName.trim();
    if (subtitle) subtitle.textContent = `Para Empresa ID: ${companyId}`;

    // --- LLAMADA AL API DE FLASK PARA DATOS DE REPORTE ---
    const apiUrl = `/api/reporte-vista/${reportType}?empresa_id=${companyId}`;
    const resultado = await fetchApi(apiUrl);
    // --- FIN LLAMADA API ---
    
    if (loading) loading.classList.add('hidden');

    if (resultado.status === 'success') {
        if (resultado.data && resultado.data.length > 0) {
            if (table) table.classList.remove('hidden');
            if (excelBtn) excelBtn.disabled = false;
            if (pdfBtn) pdfBtn.disabled = false;
            
            // Determinar encabezados dinámicamente de la primera fila
            const headers = Object.keys(resultado.data[0]);
            
            renderTable(headers, resultado.data);
            
        } else {
            // No hay datos
            if (table) table.classList.add('hidden');
            alertUser(`No se encontraron datos para el reporte '${reportName}' de la empresa ID ${companyId}.`, "warning");
        }
    } else {
        // Error de API (Conexión fallida, vista no encontrada, etc.)
        if (table) table.classList.add('hidden');
        alertUser(resultado.message, "error");
        
        // Mostrar mensaje de error en subtítulo
        if (subtitle) subtitle.textContent = `ERROR: ${resultado.message.substring(0, 100)}...`;
    }
};

const renderTable = (headers, data) => {
    const headerRow = document.getElementById('table-header');
    const body = document.getElementById('table-body');
    if (!headerRow || !body) return;

    headerRow.innerHTML = '';
    body.innerHTML = '';

    // 1. Renderizar encabezados dinámicamente
    headers.forEach(h => {
        const th = document.createElement('th');
        // Reemplazar guiones bajos por espacios y capitalizar
        th.textContent = h.replace(/_/g, ' '); 
        headerRow.appendChild(th);
    });

    // 2. Renderizar filas de datos
    let totalDebe = 0;
    let totalHaber = 0;
    
    // Verificamos si las columnas Debe y Haber existen para calcular totales
    const hasDebeHaber = headers.includes('Debe') && headers.includes('Haber');

    data.forEach(item => {
        const tr = document.createElement('tr');
        
        headers.forEach(header => {
            const td = document.createElement('td');
            let value = item[header];
            
            // Intenta formatear como moneda si parece un número y no es un ID
            if (!isNaN(parseFloat(value)) && isFinite(value) && header !== 'Empresa' && header !== 'REG_Empresa') {
                td.classList.add('text-right', 'currency-value');
                td.textContent = formatCurrency(parseFloat(value));
            } else {
                td.classList.add('whitespace-nowrap', 'text-left', 'px-4', 'py-3');
                td.textContent = value || '';
            }
            tr.appendChild(td);
        });
        
        body.appendChild(tr);

        // Sumar totales si existen las columnas Debe/Haber
        if (hasDebeHaber) {
            totalDebe += parseFloat(item.Debe) || 0;
            totalHaber += parseFloat(item.Haber) || 0;
        }
    });

    // 3. Fila de totales (solo si existen Debe y Haber y están al final)
    if (hasDebeHaber) {
        // Asumimos que 'Debe' y 'Haber' son las últimas dos columnas
        const debeIndex = headers.indexOf('Debe');
        const haberIndex = headers.indexOf('Haber');
        
        if (debeIndex === headers.length - 2 && haberIndex === headers.length - 1) {
            const totalRow = document.createElement('tr');
            totalRow.classList.add('total-row', 'bg-red-50');
            
            // Colspan para la columna de "TOTALES"
            const colSpanCount = headers.length - 2; 
            
            let rowContent = `
                <td colspan="${colSpanCount}" class="text-left font-extrabold text-red-700 px-4 py-3 border-t-2 border-red-700">TOTALES</td>
                <td class="text-right font-extrabold text-red-700 px-4 py-3 border-t-2 border-red-700">${formatCurrency(totalDebe)}</td>
                <td class="text-right font-extrabold text-red-700 px-4 py-3 border-t-2 border-red-700">${formatCurrency(totalHaber)}</td>
            `;
            totalRow.innerHTML = rowContent;
            body.appendChild(totalRow);
        }
    }
};

// --- LÓGICA DE GESTIÓN DE DATOS (NUEVA FUNCIÓN) ---
const handleEntitySelection = (event) => {
    const entityName = event.target.value;
    const formContainer = document.getElementById('data-entry-form');
    const messageContainer = document.getElementById('data-entry-message');
    const saveButtonContainer = document.getElementById('save-button-container');
    const saveButton = document.getElementById('save-record-btn');

    if (!entityName) {
        if (messageContainer) messageContainer.classList.remove('hidden');
        if (formContainer) formContainer.classList.add('hidden');
        if (saveButtonContainer) saveButtonContainer.classList.add('hidden');
        if (saveButton) saveButton.disabled = true;
        return;
    }

    if (messageContainer) messageContainer.classList.add('hidden');
    if (formContainer) formContainer.classList.remove('hidden');
    if (saveButtonContainer) saveButtonContainer.classList.remove('hidden');
    if (saveButton) saveButton.disabled = false;
    
    generateForm(entityName);
};

const generateForm = (entityName) => {
    const schema = ENTITY_SCHEMAS[entityName];
    const formContainer = document.getElementById('data-entry-form');
    if (!formContainer) return;
    formContainer.innerHTML = '';
    
    if (!schema) {
        formContainer.innerHTML = `<p class="text-center text-red-500 col-span-2">Esquema no encontrado para ${entityName}.</p>`;
        return;
    }

    schema.forEach(field => {
        const div = document.createElement('div');
        div.classList.add('flex', 'flex-col', 'gap-1');

        const label = document.createElement('label');
        label.htmlFor = field.id;
        label.classList.add('text-sm', 'font-medium', 'text-gray-700');
        label.textContent = field.label + (field.required ? ' *' : '');
        
        const input = document.createElement('input');
        input.type = field.type;
        input.id = field.id;
        input.name = field.id;
        input.required = field.required;
        input.placeholder = field.placeholder || 'Ingrese valor';
        input.classList.add('w-full', 'p-3', 'border', 'border-gray-300', 'rounded-lg', 'focus:ring-blue-500', 'focus:border-blue-500', 'shadow-sm', 'text-gray-800');
        
        if (field.type === 'number') {
            input.step = '0.01'; // Para decimales
            input.value = '0.00'; // Valor inicial
        }

        div.appendChild(label);
        div.appendChild(input);
        formContainer.appendChild(div);
    });
    
    // Campo oculto para la Empresa ID, ya que todas las tablas lo requieren
    const companyIdField = document.createElement('input');
    companyIdField.type = 'hidden';
    companyIdField.id = 'Empresa_ID_Field';
    companyIdField.name = 'Empresa';
    const empresaSelect = document.getElementById('empresa-select');
    companyIdField.value = empresaSelect ? empresaSelect.value : '';
    formContainer.appendChild(companyIdField);
};
    
const handleSaveRecord = async (event) => {
    event.preventDefault();

    const entityName = document.getElementById('entity-select').value;
    const companyId = document.getElementById('empresa-select').value;
    const saveButton = document.getElementById('save-record-btn');

    if (!companyId || !entityName) {
        alertUser("Debe seleccionar una empresa y una entidad.", "error");
        return;
    }

    const formData = new FormData(document.getElementById('data-entry-form'));
    const data = {};
    let isFormValid = true;

    // Recolectar y validar datos
    for (const [key, value] of formData.entries()) {
        const schema = ENTITY_SCHEMAS[entityName].find(f => f.id === key);
        
        if (key === 'Empresa') {
            data[key] = parseInt(companyId);
            continue;
        }
        
        if (schema && schema.type === 'number') {
            const numValue = parseFloat(value) || 0;
            data[key] = numValue;
            if (schema.required && numValue <= 0) {
                isFormValid = false;
                alertUser(`El campo ${schema.label} es obligatorio y debe ser mayor que cero.`, "error");
                break;
            }
        } else {
            data[key] = value;
        }
    }
    
    if (!isFormValid) return;
    
    if (saveButton) {
        saveButton.disabled = true;
        saveButton.innerHTML = `<i class="ph-fill ph-circle-notch spin text-xl"></i> Guardando...`;
    }

    try {
        // Definir la ruta de la colección: /artifacts/{appId}/users/{userId}/{entityName}
        const collectionPath = `artifacts/${appId}/users/${currentUserId}/${entityName}`;
        const entityCollection = collection(db, collectionPath);
        
        // Firestore save logic: Usamos addDoc para un nuevo registro
        await addDoc(entityCollection, {
            ...data,
            timestamp: new Date().toISOString(),
            Empresa: data.Empresa // Usar el ID de empresa numérico
        });

        alertUser(`Registro de ${entityName} guardado con éxito.`, "success");
        
        // Limpiar el formulario para un nuevo registro
        const form = document.getElementById('data-entry-form');
        if (form) form.reset();
        const empresaField = document.getElementById('Empresa_ID_Field');
        if (empresaField) empresaField.value = companyId; // Mantener la empresa
        
    } catch (e) {
        console.error("Error al guardar el registro en Firestore:", e);
        alertUser("Error al guardar el registro. Verifique la consola para detalles.", "error");
    } finally {
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.innerHTML = `<i class="ph-fill ph-floppy-disk text-xl"></i> Guardar Registro`;
        }
    }
};

// --- FUNCIONES DE UTILIDAD ---
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-HN', {
        style: 'currency',
        currency: 'HNL', // Asumo Lempira, ajuste si es necesario
        minimumFractionDigits: 2,
    }).format(amount).replace('HNL', 'L. ');
};

const alertUser = (message, type) => {
    // Implementar una forma visual de notificar al usuario (sin usar alert())
    console.log(`[ALERTA ${type.toUpperCase()}]: ${message}`);
    // Aquí se podría integrar un modal o un toast
    const alertDiv = document.createElement('div');
    
    const baseClasses = 'fixed bottom-5 right-5 z-50 p-4 rounded-lg shadow-xl text-white font-semibold flex items-center gap-2 fade-in-up';
    let icon = '';
    let colorClasses = '';

    switch(type) {
        case 'success':
            colorClasses = 'bg-green-600';
            icon = `<i class="ph-fill ph-check-circle text-xl"></i>`;
            break;
        case 'error':
            colorClasses = 'bg-red-600';
            icon = `<i class="ph-fill ph-x-circle text-xl"></i>`;
            break;
        case 'warning':
        default:
            colorClasses = 'bg-yellow-600';
            icon = `<i class="ph-fill ph-warning-circle text-xl"></i>`;
            break;
    }

    alertDiv.className = `${baseClasses} ${colorClasses}`;
    alertDiv.innerHTML = `${icon} <span>${message}</span>`;
    
    document.body.appendChild(alertDiv);
    
    // Auto-destruir después de 5 segundos
    setTimeout(() => {
        alertDiv.classList.remove('fade-in-up');
        alertDiv.classList.add('opacity-0');
        setTimeout(() => alertDiv.remove(), 500);
    }, 5000);
};
    
const loadInitialData = async () => {
    const empresaSelect = document.getElementById('empresa-select');
    if (!empresaSelect) return;

    empresaSelect.innerHTML = `<option value="">-- Cargando empresas... --</option>`;
    empresaSelect.disabled = true;

    // --- LLAMADA AL API DE FLASK PARA LISTA DE EMPRESAS ---
    const resultado = await fetchApi('/api/empresas');
    // --- FIN LLAMADA API ---

    empresaSelect.innerHTML = `<option value="">-- Seleccione una empresa --</option>`;
    empresaSelect.disabled = false;

    if (resultado.status === 'success' && resultado.data && resultado.data.length > 0) {
        resultado.data.forEach(empresa => {
            const option = document.createElement('option');
            // REG_Empresa es el ID (value), Nombre_empresa es el texto
            option.value = empresa.REG_Empresa;
            option.textContent = `${empresa.Nombre_empresa} (ID ${empresa.REG_Empresa})`;
            empresaSelect.appendChild(option);
        });
    } else {
        alertUser(resultado.message || "Error al cargar la lista de empresas. Verifique la conexión a Azure SQL.", "error");
        empresaSelect.innerHTML = `<option value="">-- ERROR de conexión --</option>`;
        empresaSelect.disabled = true;
    }

    // Seleccionar Reportes como vista inicial
    showView('reportes');
};
