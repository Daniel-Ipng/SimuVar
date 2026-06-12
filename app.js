// SimuVar - Client SPA logic

// 1. STATE & GLOBAL VARIABLES
let appState = {
  token: localStorage.getItem('simuvar_token') || null,
  user: null,
  variables: [],
  selectedVariable: null,
  activeDataRecords: []
};

// Global Chart instance
window.activeChart = null;

// API Base URL (Relative paths are routed through local dev server or Vercel)
const API_URL = '';

// 2. INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
  initApp();
  setupEventListeners();
});

// Checks active sessions and sets routing view
async function initApp() {
  if (appState.token) {
    const verified = await checkSession();
    if (verified) {
      showView('dashboard-screen');
      loadVariables();
    } else {
      logout();
    }
  } else {
    showView('auth-screen');
  }
}

// 3. SERVICE API CALLS & SESSION MANAGEMENT
async function checkSession() {
  try {
    const response = await fetch(`${API_URL}/api/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${appState.token}`
      }
    });

    if (response.status === 200) {
      const data = await response.json();
      appState.user = data.user;
      updateUserUI();
      return true;
    }
    return false;
  } catch (error) {
    console.error('Session verify error:', error);
    return false;
  }
}

// Load all variables
async function loadVariables() {
  try {
    const response = await fetch(`${API_URL}/api/variables`, {
      headers: {
        'Authorization': `Bearer ${appState.token}`
      }
    });

    if (response.status === 200) {
      appState.variables = await response.json();
      renderVariablesList();
      
      // Keep selected variable context if it still exists
      if (appState.selectedVariable) {
        const found = appState.variables.find(v => v.id === appState.selectedVariable.id);
        if (found) {
          selectVariable(found);
        } else {
          deselectVariable();
        }
      }
    } else {
      const err = await response.json();
      showToast(err.error || 'Error al obtener variables', 'danger');
    }
  } catch (error) {
    showToast('Error al conectar con el servidor', 'danger');
  }
}

// Load data records for specific variable
async function loadDataRecords(variableId) {
  try {
    const response = await fetch(`${API_URL}/api/data?variableId=${variableId}`, {
      headers: {
        'Authorization': `Bearer ${appState.token}`
      }
    });

    if (response.status === 200) {
      appState.activeDataRecords = await response.json();
      renderDataRecords();
      calculateAndRenderAnalytics();
    } else {
      showToast('Error al cargar datos asociados', 'danger');
    }
  } catch (error) {
    showToast('Error de conexión al obtener datos', 'danger');
  }
}

// Register User
async function register(username, password, role) {
  try {
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, role })
    });

    const data = await response.json();
    if (response.status === 201) {
      appState.token = data.token;
      appState.user = data.user;
      localStorage.setItem('simuvar_token', data.token);
      showToast('Registro exitoso e inicio de sesión automático.', 'success');
      updateUserUI();
      showView('dashboard-screen');
      loadVariables();
    } else {
      showToast(data.error || 'Error al registrarse', 'danger');
    }
  } catch (error) {
    showToast('Error de red al intentar registrarse', 'danger');
  }
}

// Log In User
async function login(username, password) {
  try {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();
    if (response.status === 200) {
      appState.token = data.token;
      appState.user = data.user;
      localStorage.setItem('simuvar_token', data.token);
      showToast('Sesión iniciada con éxito.', 'success');
      updateUserUI();
      showView('dashboard-screen');
      loadVariables();
    } else {
      showToast(data.error || 'Usuario o contraseña incorrectos.', 'danger');
    }
  } catch (error) {
    showToast('Error de red al iniciar sesión', 'danger');
  }
}

// Log Out User
function logout() {
  appState.token = null;
  appState.user = null;
  appState.variables = [];
  appState.selectedVariable = null;
  appState.activeDataRecords = [];
  localStorage.removeItem('simuvar_token');
  showView('auth-screen');
  showToast('Sesión cerrada correctamente.', 'success');
}

// 4. USER INTERFACE RENDERING & NAVIGATION
function showView(viewId) {
  if (viewId === 'auth-screen') {
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('dashboard-screen').style.display = 'none';
    showAuthCard('login-card');
  } else {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('dashboard-screen').style.display = 'flex';
  }
}

function showAuthCard(cardId) {
  if (cardId === 'login-card') {
    document.getElementById('login-card').style.display = 'block';
    document.getElementById('register-card').style.display = 'none';
  } else {
    document.getElementById('login-card').style.display = 'none';
    document.getElementById('register-card').style.display = 'block';
  }
}

function updateUserUI() {
  if (appState.user) {
    document.getElementById('user-display-name').textContent = appState.user.username;
    document.getElementById('user-display-role').textContent = 
      appState.user.role === 'admin' ? 'Administrador' : 'Investigador';
  }
}

// Render the variables list in sidebar
function renderVariablesList(filter = '') {
  const container = document.getElementById('variables-list');
  container.innerHTML = '';

  const filtered = appState.variables.filter(v => 
    v.name.toLowerCase().includes(filter.toLowerCase()) || 
    (v.description && v.description.toLowerCase().includes(filter.toLowerCase()))
  );

  if (filtered.length === 0) {
    container.innerHTML = `<div style="text-align: center; font-size: 12px; color: var(--text-muted); padding: 20px;">No se encontraron variables</div>`;
    return;
  }

  filtered.forEach(v => {
    const item = document.createElement('div');
    item.className = `variable-item ${appState.selectedVariable && appState.selectedVariable.id === v.id ? 'active' : ''}`;
    
    item.innerHTML = `
      <div class="var-item-header">
        <span class="var-item-name" title="${v.name}">${v.name}</span>
        <span class="badge-type ${v.type}">${v.type}</span>
      </div>
      <div class="var-item-meta">
        <span>${v.data_count} muestras</span>
        <span>${new Date(v.created_at).toLocaleDateString('es-ES')}</span>
      </div>
    `;

    item.addEventListener('click', () => selectVariable(v));
    container.appendChild(item);
  });
}

// Select a variable and load its data
function selectVariable(variable) {
  appState.selectedVariable = variable;
  
  // Highlight in sidebar
  document.querySelectorAll('.variable-item').forEach(el => el.classList.remove('active'));
  renderVariablesList(document.getElementById('search-input').value);

  // Update Main view panels
  document.getElementById('welcome-view').style.display = 'none';
  document.getElementById('variable-detail-view').style.display = 'block';

  // Populating details
  document.getElementById('active-var-name').textContent = variable.name;
  document.getElementById('active-var-desc').textContent = variable.description || 'Sin descripción detallada.';
  document.getElementById('active-var-creator').textContent = variable.creator || 'Desconocido';
  
  const typeBadge = document.getElementById('active-var-type-badge');
  typeBadge.className = `badge-type ${variable.type}`;
  typeBadge.textContent = variable.type;

  // Manage control visibility depending on role / ownership
  const isOwner = variable.user_id === appState.user.id;
  const isAdmin = appState.user.role === 'admin';
  
  const actionHeader = document.querySelector('.header-actions');
  if (isOwner || isAdmin) {
    actionHeader.style.display = 'flex';
  } else {
    actionHeader.style.display = 'none';
  }

  // Set instructions inside upload box
  document.getElementById('data-value-input').placeholder = 
    variable.type === 'discreta' ? 'Ej: 5 (entero)' : 'Ej: 4.87 (decimal)';
  document.getElementById('data-value-input').step = 
    variable.type === 'discreta' ? '1' : 'any';

  // Load associated records
  loadDataRecords(variable.id);
}

function deselectVariable() {
  appState.selectedVariable = null;
  appState.activeDataRecords = [];
  document.getElementById('welcome-view').style.display = 'flex';
  document.getElementById('variable-detail-view').style.display = 'none';
  renderVariablesList(document.getElementById('search-input').value);
}

// Render data records table
function renderDataRecords() {
  const tbody = document.getElementById('data-records-table-body');
  const totalCountEl = document.getElementById('data-total-count');
  
  tbody.innerHTML = '';
  
  const records = appState.activeDataRecords;
  totalCountEl.textContent = records.length;

  if (records.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 30px;">
          No hay registros de datos asociados a esta variable.
        </td>
      </tr>
    `;
    return;
  }

  // Show last 100 rows for performance, but calculate statistics on all
  const displayRecords = [...records].reverse().slice(0, 100);

  const isOwner = appState.selectedVariable.user_id === appState.user.id;
  const isAdmin = appState.user.role === 'admin';
  const hasEditRights = isOwner || isAdmin;

  displayRecords.forEach((record, index) => {
    const row = document.createElement('tr');
    
    // Formatting timestamp
    const dateStr = new Date(record.created_at).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    row.innerHTML = `
      <td>${records.length - index}</td>
      <td><strong>${record.value}</strong></td>
      <td>${dateStr}</td>
      <td class="actions-cell">
        ${hasEditRights ? `
          <button class="btn-icon edit" onclick="openEditRecordModal(${record.id}, ${record.value})" title="Editar Valor">
            <!-- Edit Pencil icon -->
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4Z"></path></svg>
          </button>
          <button class="btn-icon delete" onclick="deleteRecord(${record.id})" title="Eliminar Valor">
            <!-- Delete Trash icon -->
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        ` : `<span style="font-size:11px; color:var(--text-muted);">Solo lectura</span>`}
      </td>
    `;
    tbody.appendChild(row);
  });
}

// 5. STATISTICAL CALCULATIONS & CHARTS
function calculateAndRenderAnalytics() {
  const values = appState.activeDataRecords.map(r => r.value);
  const type = appState.selectedVariable.type;

  if (values.length === 0) {
    // Reset cards to default empty
    document.getElementById('stat-mean').textContent = '-';
    document.getElementById('stat-median').textContent = '-';
    document.getElementById('stat-mode').textContent = '-';
    document.getElementById('stat-stddev').textContent = '-';
    document.getElementById('stat-min').textContent = '-';
    document.getElementById('stat-max').textContent = '-';
    
    if (window.activeChart) {
      window.activeChart.destroy();
      window.activeChart = null;
    }
    return;
  }

  // 1. Min and Max
  const min = Math.min(...values);
  const max = Math.max(...values);
  
  // 2. Mean (Media)
  const sum = values.reduce((acc, v) => acc + v, 0);
  const mean = sum / values.length;

  // 3. Median (Mediana)
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 !== 0 
    ? sorted[mid] 
    : (sorted[mid - 1] + sorted[mid]) / 2;

  // 4. Mode (Moda)
  const frequencies = {};
  let maxFreq = 0;
  let modes = [];
  
  values.forEach(v => {
    frequencies[v] = (frequencies[v] || 0) + 1;
    if (frequencies[v] > maxFreq) {
      maxFreq = frequencies[v];
    }
  });

  for (const val in frequencies) {
    if (frequencies[val] === maxFreq) {
      modes.push(parseFloat(val));
    }
  }

  let modeText = '';
  if (maxFreq === 1) {
    modeText = 'Sin moda';
  } else if (modes.length > 2) {
    modeText = 'Multimodal';
  } else {
    modeText = modes.join(', ');
  }

  // 5. Sample Standard Deviation (Desviación Estándar Muestral)
  let stdDev = 0;
  if (values.length > 1) {
    const varianceSum = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0);
    stdDev = Math.sqrt(varianceSum / (values.length - 1));
  }

  // Populate UI
  document.getElementById('stat-mean').textContent = mean.toFixed(4).replace(/\.?0+$/, '');
  document.getElementById('stat-median').textContent = median.toFixed(4).replace(/\.?0+$/, '');
  document.getElementById('stat-mode').textContent = modeText;
  document.getElementById('stat-stddev').textContent = stdDev.toFixed(4).replace(/\.?0+$/, '');
  document.getElementById('stat-min').textContent = min;
  document.getElementById('stat-max').textContent = max;

  // Render Chart
  renderDistributionChart(values, type);
}

// Dynamic Histogram logic with Sturges Rule
function renderDistributionChart(values, type) {
  const ctx = document.getElementById('distribution-chart').getContext('2d');
  
  if (window.activeChart) {
    window.activeChart.destroy();
  }

  let labels = [];
  let data = [];

  if (type === 'discreta') {
    const uniqueValues = [...new Set(values)].sort((a, b) => a - b);
    if (uniqueValues.length <= 15) {
      labels = uniqueValues.map(v => v.toString());
      const counts = {};
      values.forEach(v => counts[v] = (counts[v] || 0) + 1);
      data = uniqueValues.map(v => counts[v]);
    } else {
      ({ labels, data } = calculateBins(values));
    }
  } else {
    ({ labels, data } = calculateBins(values));
  }

  window.activeChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Frecuencia Absoluta',
        data: data,
        backgroundColor: 'rgba(6, 182, 212, 0.25)',
        borderColor: 'rgba(6, 182, 212, 1)',
        borderWidth: 1.5,
        borderRadius: 4,
        barPercentage: 0.95,
        categoryPercentage: 0.95
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(17, 24, 39, 0.95)',
          titleColor: '#fff',
          bodyColor: '#e5e7eb',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#9ca3af', font: { family: 'Inter', size: 11 } }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#9ca3af', font: { family: 'Inter', size: 10 } }
        }
      }
    }
  });
}

function calculateBins(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const N = values.length;
  
  // Sturges formula
  const k = Math.ceil(1 + 3.322 * Math.log10(N));
  const range = max - min;
  
  if (range === 0) {
    return {
      labels: [`[${min}]`],
      data: [N]
    };
  }

  const binWidth = range / k;
  const labels = [];
  const data = Array(k).fill(0);

  for (let i = 0; i < k; i++) {
    const binStart = min + (i * binWidth);
    const binEnd = min + ((i + 1) * binWidth);
    
    if (i === k - 1) {
      labels.push(`[${binStart.toFixed(2)}, ${binEnd.toFixed(2)}]`);
    } else {
      labels.push(`[${binStart.toFixed(2)}, ${binEnd.toFixed(2)})`);
    }
  }

  values.forEach(v => {
    let idx = Math.floor((v - min) / binWidth);
    if (idx >= k) idx = k - 1;
    if (idx < 0) idx = 0;
    data[idx]++;
  });

  return { labels, data };
}

// 6. CSV/EXCEL BULK IMPORTS
async function handleBulkUpload(file) {
  if (!appState.selectedVariable) {
    showToast('Seleccione una variable antes de cargar un archivo.', 'warning');
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const arrayBuffer = e.target.result;
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rawJson = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      const parsedValues = [];
      const variableType = appState.selectedVariable.type;

      // Parsing sheet structure row-by-row
      for (let r = 0; r < rawJson.length; r++) {
        const row = rawJson[r];
        if (!row || row.length === 0) continue;

        // Take the first numerical cell in the row
        for (let c = 0; c < row.length; c++) {
          const cellVal = row[c];
          if (cellVal !== undefined && cellVal !== null && cellVal !== '') {
            // Localise commas for Spanish Excel sheets e.g. "3,14" -> "3.14"
            const cleanStr = cellVal.toString().trim().replace(',', '.');
            const num = parseFloat(cleanStr);
            if (!isNaN(num)) {
              // Discrete validation
              if (variableType === 'discreta' && num % 1 !== 0) {
                showToast(`Error de validación: El valor ${num} en fila ${r + 1} no es un número entero. La carga fue abortada.`, 'danger');
                return;
              }
              parsedValues.push(num);
              break; // Read one cell per row
            }
          }
        }
      }

      if (parsedValues.length === 0) {
        showToast('No se encontraron datos numéricos válidos en el archivo.', 'warning');
        return;
      }

      // API call to bulk upload
      showToast(`Subiendo ${parsedValues.length} registros...`, 'warning');
      const response = await fetch(`${API_URL}/api/data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${appState.token}`
        },
        body: JSON.stringify({
          variableId: appState.selectedVariable.id,
          values: parsedValues
        })
      });

      const resData = await response.json();
      if (response.status === 201) {
        showToast(`Carga masiva completada: ${parsedValues.length} registros guardados.`, 'success');
        loadVariables(); // Refresh counts in sidebar
      } else {
        showToast(resData.error || 'Error en la carga de datos masiva.', 'danger');
      }

    } catch (error) {
      console.error(error);
      showToast('Error al parsear el archivo. Verifique el formato.', 'danger');
    }
  };
  
  reader.readAsArrayBuffer(file);
}

// Generate client-side sample CSV
function downloadSampleTemplate() {
  const isDiscrete = appState.selectedVariable.type === 'discreta';
  const csvContent = isDiscrete 
    ? "Valores\n12\n15\n8\n21\n14\n17\n9\n14\n18\n12" 
    : "Valores\n12.45\n15.82\n8.10\n21.34\n14.60\n17.15\n9.44\n14.90\n18.02\n12.78";
    
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `plantilla_${appState.selectedVariable.name.toLowerCase().replace(/\s+/g, '_')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// 7. EXPORTING DATA TO CSV / EXCEL
function exportToCSV() {
  if (appState.activeDataRecords.length === 0) {
    showToast('No hay datos disponibles para exportar.', 'warning');
    return;
  }

  const variable = appState.selectedVariable;
  let csvContent = "data:text/csv;charset=utf-8,ID,Valor,FechaRegistro\n";
  
  appState.activeDataRecords.forEach((r, idx) => {
    const dateStr = new Date(r.created_at).toISOString();
    csvContent += `${idx + 1},${r.value},${dateStr}\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `reporte_${variable.name.toLowerCase().replace(/\s+/g, '_')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Archivo CSV descargado exitosamente.', 'success');
}

function exportToExcel() {
  if (appState.activeDataRecords.length === 0) {
    showToast('No hay datos disponibles para exportar.', 'warning');
    return;
  }

  const variable = appState.selectedVariable;
  
  // Format data for sheet
  const formattedData = appState.activeDataRecords.map((r, index) => ({
    'Índice': index + 1,
    'Valor Recolectado': r.value,
    'Fecha de Registro': new Date(r.created_at).toLocaleString('es-ES')
  }));

  // Create workbook
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(formattedData);
  
  // Add sheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, "Datos Recolectados");

  // Add statistics sheet metadata
  const statsValues = appState.activeDataRecords.map(r => r.value);
  const min = Math.min(...statsValues);
  const max = Math.max(...statsValues);
  const sum = statsValues.reduce((acc, v) => acc + v, 0);
  const mean = sum / statsValues.length;
  
  const statsMeta = [
    { 'Propiedad': 'Variable', 'Valor': variable.name },
    { 'Propiedad': 'Tipo', 'Valor': variable.type },
    { 'Propiedad': 'Muestras', 'Valor': statsValues.length },
    { 'Propiedad': 'Media (μ)', 'Valor': mean },
    { 'Propiedad': 'Mínimo', 'Valor': min },
    { 'Propiedad': 'Máximo', 'Valor': max }
  ];
  const wsStats = XLSX.utils.json_to_sheet(statsMeta);
  XLSX.utils.book_append_sheet(wb, wsStats, "Resumen Estadistico");

  // Download workbook
  XLSX.writeFile(wb, `reporte_${variable.name.toLowerCase().replace(/\s+/g, '_')}.xlsx`);
  showToast('Libro de Excel (.xlsx) descargado exitosamente.', 'success');
}

// 8. RECORD OPERATIONS (DELETE / EDIT VALUE)
async function deleteRecord(recordId) {
  if (!confirm('¿Está seguro de eliminar este registro de valor? Esta acción no se puede deshacer.')) return;

  try {
    const response = await fetch(`${API_URL}/api/data?id=${recordId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${appState.token}`
      }
    });

    if (response.status === 200) {
      showToast('Registro eliminado con éxito.', 'success');
      loadVariables(); // Refresh counts in sidebar
    } else {
      const err = await response.json();
      showToast(err.error || 'Error al eliminar el registro.', 'danger');
    }
  } catch (error) {
    showToast('Error de red al intentar eliminar el registro.', 'danger');
  }
}

// Global modal triggers since they are dynamically loaded in tables
window.openEditRecordModal = function(id, value) {
  document.getElementById('data-record-modal-id').value = id;
  document.getElementById('data-record-modal-value').value = value;
  
  const isDiscrete = appState.selectedVariable.type === 'discreta';
  document.getElementById('data-record-modal-value').step = isDiscrete ? '1' : 'any';
  document.getElementById('data-record-modal-type-tip').textContent = 
    isDiscrete ? 'Nota: La variable es discreta. Ingrese solo números enteros.' : 'Nota: La variable es continua. Puede usar decimales.';

  document.getElementById('data-record-modal').style.display = 'flex';
};

window.deleteRecord = deleteRecord;

// 9. MODALS & FORMS HANDLERS
function setupEventListeners() {
  // Navigation links
  document.getElementById('go-to-register').addEventListener('click', (e) => {
    e.preventDefault();
    showAuthCard('register-card');
  });

  document.getElementById('go-to-login').addEventListener('click', (e) => {
    e.preventDefault();
    showAuthCard('login-card');
  });

  // Forms submit
  document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const user = document.getElementById('login-username').value;
    const pass = document.getElementById('login-password').value;
    login(user, pass);
  });

  document.getElementById('register-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const user = document.getElementById('register-username').value;
    const pass = document.getElementById('register-password').value;
    const role = document.getElementById('register-role').value;
    register(user, pass, role);
  });

  document.getElementById('logout-btn').addEventListener('click', logout);

  // Search filter
  document.getElementById('search-input').addEventListener('input', (e) => {
    renderVariablesList(e.target.value);
  });

  // Variables triggers
  document.getElementById('add-variable-btn').addEventListener('click', () => {
    openVariableModal();
  });

  document.getElementById('welcome-create-btn').addEventListener('click', () => {
    openVariableModal();
  });

  document.getElementById('edit-variable-btn').addEventListener('click', () => {
    if (appState.selectedVariable) {
      openVariableModal(appState.selectedVariable);
    }
  });

  document.getElementById('delete-variable-btn').addEventListener('click', async () => {
    if (!appState.selectedVariable) return;
    const name = appState.selectedVariable.name;
    if (!confirm(`¿Está completamente seguro de eliminar la variable "${name}" y todos sus datos?`)) return;

    try {
      const response = await fetch(`${API_URL}/api/variables?id=${appState.selectedVariable.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${appState.token}`
        }
      });

      if (response.status === 200) {
        showToast(`Variable "${name}" eliminada correctamente.`, 'success');
        deselectVariable();
        loadVariables();
      } else {
        const err = await response.json();
        showToast(err.error || 'Error al eliminar variable.', 'danger');
      }
    } catch (error) {
      showToast('Error al conectar con el servidor', 'danger');
    }
  });

  // Cancel buttons in Modals
  document.getElementById('cancel-variable-modal').addEventListener('click', () => {
    document.getElementById('variable-modal').style.display = 'none';
  });

  document.getElementById('cancel-data-record-modal').addEventListener('click', () => {
    document.getElementById('data-record-modal').style.display = 'none';
  });

  // Save Variable Form
  document.getElementById('variable-modal-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('variable-modal-id').value;
    const name = document.getElementById('variable-name').value;
    const type = document.getElementById('variable-type').value;
    const description = document.getElementById('variable-desc').value;

    const isEdit = !!id;
    const url = isEdit ? `${API_URL}/api/variables?id=${id}` : `${API_URL}/api/variables`;
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${appState.token}`
        },
        body: JSON.stringify({ name, type, description })
      });

      const data = await response.json();
      if (response.status === 200 || response.status === 201) {
        showToast(isEdit ? 'Variable modificada correctamente.' : 'Variable registrada correctamente.', 'success');
        document.getElementById('variable-modal').style.display = 'none';
        loadVariables();
        
        // Auto select newly created or update details of edited
        if (isEdit) {
          appState.selectedVariable = data;
        }
        setTimeout(() => selectVariable(data), 200);
      } else {
        showToast(data.error || 'Error al guardar la variable.', 'danger');
      }
    } catch (error) {
      showToast('Error de red al guardar variable', 'danger');
    }
  });

  // Individual Value Manual Submission
  document.getElementById('add-data-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!appState.selectedVariable) return;

    const valueInput = document.getElementById('data-value-input');
    const val = parseFloat(valueInput.value);

    // Front-end pre-validation
    if (appState.selectedVariable.type === 'discreta' && val % 1 !== 0) {
      showToast('La variable es discreta. Ingrese solo números enteros.', 'warning');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${appState.token}`
        },
        body: JSON.stringify({
          variableId: appState.selectedVariable.id,
          value: val
        })
      });

      const data = await response.json();
      if (response.status === 201) {
        showToast('Valor registrado con éxito.', 'success');
        valueInput.value = '';
        loadVariables(); // Refresh count in sidebar
      } else {
        showToast(data.error || 'Error al guardar dato.', 'danger');
      }
    } catch (error) {
      showToast('Error al conectar con el servidor', 'danger');
    }
  });

  // Edit Value Record Submission Modal
  document.getElementById('data-record-modal-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('data-record-modal-id').value;
    const value = parseFloat(document.getElementById('data-record-modal-value').value);

    if (appState.selectedVariable.type === 'discreta' && value % 1 !== 0) {
      showToast('La variable es discreta. Ingrese solo enteros.', 'warning');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/data?id=${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${appState.token}`
        },
        body: JSON.stringify({ value })
      });

      const data = await response.json();
      if (response.status === 200) {
        showToast('Valor actualizado correctamente.', 'success');
        document.getElementById('data-record-modal').style.display = 'none';
        loadVariables(); // Refresh counts and records
      } else {
        showToast(data.error || 'Error al actualizar el registro.', 'danger');
      }
    } catch (error) {
      showToast('Error de red al actualizar dato', 'danger');
    }
  });

  // Clear data button
  document.getElementById('clear-data-btn').addEventListener('click', async () => {
    if (!appState.selectedVariable) return;
    const name = appState.selectedVariable.name;
    if (!confirm(`¿Está seguro de vaciar todos los registros de la variable "${name}"? Se perderán las estadísticas.`)) return;

    try {
      const response = await fetch(`${API_URL}/api/data?variableId=${appState.selectedVariable.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${appState.token}`
        }
      });

      if (response.status === 200) {
        showToast('Datos vaciados correctamente.', 'success');
        loadVariables();
      } else {
        const err = await response.json();
        showToast(err.error || 'Error al vaciar datos.', 'danger');
      }
    } catch (error) {
      showToast('Error al conectar con el servidor', 'danger');
    }
  });

  // Download CSV template
  document.getElementById('download-template-btn').addEventListener('click', (e) => {
    e.preventDefault();
    if (appState.selectedVariable) {
      downloadSampleTemplate();
    }
  });

  // Export buttons
  document.getElementById('export-csv-btn').addEventListener('click', exportToCSV);
  document.getElementById('export-excel-btn').addEventListener('click', exportToExcel);

  // Setup drag & drop file events
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');

  dropzone.addEventListener('click', () => fileInput.click());

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleBulkUpload(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleBulkUpload(e.target.files[0]);
      fileInput.value = ''; // Reset file input
    }
  });
}

// Open create/edit variables dialog
function openVariableModal(variable = null) {
  const isEdit = !!variable;
  document.getElementById('variable-modal-title').textContent = 
    isEdit ? 'Editar Variable Aleatoria' : 'Registrar Variable Aleatoria';
  
  document.getElementById('variable-modal-id').value = isEdit ? variable.id : '';
  document.getElementById('variable-name').value = isEdit ? variable.name : '';
  document.getElementById('variable-type').value = isEdit ? variable.type : 'discreta';
  document.getElementById('variable-type').disabled = isEdit; // Disable type modifying if editing (integrity concern)
  document.getElementById('variable-desc').value = isEdit ? variable.description : '';

  document.getElementById('variable-modal').style.display = 'flex';
}

// Helper: Toast Notifications creator
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'danger') icon = '❌';
  if (type === 'warning') icon = '⚠️';

  toast.innerHTML = `
    <span>${icon}</span>
    <span style="font-size: 13.5px; font-weight: 500;">${message}</span>
  `;

  container.appendChild(toast);

  // Fade-out and delete sequence
  setTimeout(() => {
    toast.style.transition = 'opacity 0.5s ease';
    toast.style.opacity = '0';
    setTimeout(() => {
      if (toast.parentNode === container) {
        container.removeChild(toast);
      }
    }, 500);
  }, 4000);
}
