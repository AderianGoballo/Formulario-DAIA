// admin-common.js
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzuYb3C1knQ5JArYTJM9nLLd9C8_YSHdr6AQssSxN97siEx3UAWdYIE3YMJkN7HtfS6fw/exec';
const BASE_DATOS_URL = 'https://docs.google.com/spreadsheets/d/1K8qGO46yhwpM_qTupQfGW9TNnazmU3Y4N8Wt-QfWB5c/edit?usp=sharing';
let ADMIN_KEY = 'ucv2023';

// Cache keys
const CACHE_KEY_DISCIPLINAS = 'admin_disciplinas';
const CACHE_KEY_FACULTADES = 'admin_facultades';
const CACHE_KEY_ESCUELAS = 'admin_escuelas';
const CACHE_KEY_ATLETAS = 'admin_atletas';
const CACHE_KEY_ICONOS = 'admin_iconos';
const CACHE_EXPIRATION_MS = 5 * 60 * 1000; // 5 minutos

// Verificar sesión al cargar cualquier página admin
document.addEventListener('DOMContentLoaded', function() {
  // Solo ejecutar en páginas admin
  if (window.location.pathname.includes('-admin.html') || 
      window.location.pathname.endsWith('admin.html')) {
    
    // Redirigir a login si no está autenticado (excepto en admin.html)
    if (!localStorage.getItem('adminKey') && !window.location.pathname.endsWith('admin.html')) {
      window.location.href = 'admin.html';
      return;
    }

    // Configuración específica para admin.html
    if (window.location.pathname.endsWith('admin.html')) {
      const loginPanel = document.getElementById('login-panel');
      const adminContent = document.getElementById('admin-content');
      
      // Mostrar dashboard si ya está autenticado
      if (localStorage.getItem('adminKey')) {
        if (loginPanel) loginPanel.classList.add('hidden');
        if (adminContent) adminContent.classList.remove('hidden');
      }
      
      // Configurar botón de login
      const btnLogin = document.getElementById('btn-login');
      if (btnLogin) {
        btnLogin.addEventListener('click', function() {
          const inputClave = document.getElementById('clave-admin');
          if (inputClave && inputClave.value === ADMIN_KEY) {
            localStorage.setItem('adminKey', inputClave.value);
            if (loginPanel) loginPanel.classList.add('hidden');
            if (adminContent) adminContent.classList.remove('hidden');
          } else {
            alert('Clave incorrecta');
            if (inputClave) inputClave.focus();
          }
        });
      }
    }

    // Configurar botón para base de datos (solo en admin.html)
    const btnBaseDatos = document.getElementById('btn-base-datos');
    if (btnBaseDatos) {
      btnBaseDatos.addEventListener('click', function() {
        window.open(BASE_DATOS_URL, '_blank');
      });
    }
  }

  // Configurar botón para salir (existe en todas las páginas admin)
  const btnSalir = document.getElementById('btn-salir');
  if (btnSalir) {
    btnSalir.addEventListener('click', function() {
      localStorage.removeItem('adminKey');
      window.location.href = 'index.html';
    });
  }

  // Configurar logos para volver al index (en todas las páginas)
  const logoDaia = document.getElementById('logo-daia');
  if (logoDaia) {
    logoDaia.addEventListener('click', function() {
      window.location.href = 'index.html';
    });
  }

  const logoUcv = document.getElementById('logo-ucv');
  if (logoUcv) {
    logoUcv.addEventListener('click', function() {
      window.location.href = 'index.html';
    });
  }
});

// Funciones comunes
async function postData(data) {
  try {
    const formBody = Object.keys(data)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`)
      .join('&')
      .replace(/%20/g, ' '); // Mantener espacios en blanco

    const response = await fetch(WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: formBody,
    });
    
    if (!response.ok) throw new Error('Error en respuesta del servidor');
    return await response.json();
  } catch (error) {
    console.error('Error en postData:', error);
    return { status: 'error', message: error.message || 'Error desconocido' };
  }
}

async function fetchJSON(params) {
  const url = new URL(WEB_APP_URL);
  Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
  const response = await fetch(url);
  if (!response.ok) throw new Error('Error en fetch');
  return response.json();
}

function mostrarMensaje(mensaje, tipo = 'success') {
  const toast = document.createElement('div');
  toast.className = `fixed top-4 right-4 p-4 rounded-md shadow-lg ${tipo === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`;
  toast.textContent = mensaje;
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 3000);
}