// admin-common.js — utilidades compartidas del panel DAIA
//
// IMPORTANTE: la clave de administrador ya NO vive en este archivo.
// El navegador la pide en admin.html, el servidor la valida y solo se
// guarda durante la sesión de la pestaña (sessionStorage).

const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzuYb3C1knQ5JArYTJM9nLLd9C8_YSHdr6AQssSxN97siEx3UAWdYIE3YMJkN7HtfS6fw/exec';
const BASE_DATOS_URL = 'https://docs.google.com/spreadsheets/d/1K8qGO46yhwpM_qTupQfGW9TNnazmU3Y4N8Wt-QfWB5c/edit';

const CLAVE_SESION = 'adminKey';

// Claves de caché (solo se usan para invalidar lo que guarda el navegador)
const CACHE_KEY_DISCIPLINAS = 'admin_disciplinas';
const CACHE_KEY_FACULTADES = 'admin_facultades';
const CACHE_KEY_ESCUELAS = 'admin_escuelas';
const CACHE_KEY_ATLETAS = 'admin_atletas';
const CACHE_KEY_ICONOS = 'admin_iconos';

// Clave en memoria de esta pestaña
let ADMIN_KEY = leerClaveSesion();

/* -------------------------------------------------------------------- */
/* Sesión                                                               */
/* -------------------------------------------------------------------- */

function leerClaveSesion() {
  try {
    return sessionStorage.getItem(CLAVE_SESION) || '';
  } catch (e) {
    return '';
  }
}

function guardarSesion(clave) {
  ADMIN_KEY = clave;
  try {
    sessionStorage.setItem(CLAVE_SESION, clave);
  } catch (e) {
    /* modo privado sin almacenamiento: la sesión durará esta página */
  }
}

function cerrarSesion() {
  ADMIN_KEY = '';
  try {
    sessionStorage.removeItem(CLAVE_SESION);
    localStorage.removeItem(CLAVE_SESION); // limpia sesiones del sistema anterior
  } catch (e) {
    /* ignorado */
  }
}

function haySesion() {
  return !!leerClaveSesion();
}

function esPaginaAdmin() {
  const ruta = window.location.pathname;
  return ruta.endsWith('admin.html') || ruta.includes('-admin.html');
}

function esDashboard() {
  return window.location.pathname.endsWith('admin.html');
}

/* -------------------------------------------------------------------- */
/* API                                                                  */
/* -------------------------------------------------------------------- */

/**
 * POST al backend. Si hay sesión, adjunta la clave automáticamente.
 */
async function postData(datos) {
  const cuerpo = Object.assign({}, datos);

  if (ADMIN_KEY && !cuerpo.adminKey) {
    cuerpo.adminKey = ADMIN_KEY;
  }

  try {
    const formBody = Object.keys(cuerpo)
      .filter(k => cuerpo[k] !== undefined && cuerpo[k] !== null)
      .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(cuerpo[k]))
      .join('&');

    const respuesta = await fetch(WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: formBody
    });

    if (!respuesta.ok) throw new Error('Error en la respuesta del servidor (' + respuesta.status + ')');
    return await respuesta.json();
  } catch (error) {
    console.error('postData:', error);
    return { status: 'error', message: error.message || 'Error de conexión' };
  }
}

/**
 * GET al backend. Si hay sesión, adjunta la clave automáticamente.
 */
async function fetchJSON(parametros) {
  const url = new URL(WEB_APP_URL);
  const datos = Object.assign({}, parametros);

  if (ADMIN_KEY && !datos.adminKey) {
    datos.adminKey = ADMIN_KEY;
  }

  Object.entries(datos).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.append(k, v);
  });

  const respuesta = await fetch(url);
  if (!respuesta.ok) throw new Error('Error al consultar el servidor (' + respuesta.status + ')');

  const json = await respuesta.json();

  if (json && json.code === 'unauthorized') {
    cerrarSesion();
    window.location.href = 'admin.html';
    throw new Error('Sesión expirada');
  }

  return json;
}

/* -------------------------------------------------------------------- */
/* Avisos                                                               */
/* -------------------------------------------------------------------- */

function mostrarMensaje(mensaje, tipo = 'success') {
  let zona = document.getElementById('toast-zona');

  if (!zona) {
    zona = document.createElement('div');
    zona.id = 'toast-zona';
    zona.className = 'toast-zona';
    zona.setAttribute('aria-live', 'polite');
    document.body.appendChild(zona);
  }

  const tipos = { success: 'exito', error: 'error', info: 'info', warning: 'aviso' };

  const aviso = document.createElement('div');
  aviso.className = 'toast ' + (tipos[tipo] || 'info');

  const punto = document.createElement('span');
  punto.className = 'punto-aviso';

  const texto = document.createElement('span');
  texto.textContent = mensaje;

  aviso.appendChild(punto);
  aviso.appendChild(texto);
  zona.appendChild(aviso);

  setTimeout(() => {
    aviso.classList.add('saliendo');
    setTimeout(() => aviso.remove(), 300);
  }, 4200);
}

/* -------------------------------------------------------------------- */
/* Arranque                                                             */
/* -------------------------------------------------------------------- */

document.addEventListener('DOMContentLoaded', function () {
  if (!esPaginaAdmin()) return;

  // Páginas internas: si no hay sesión, a la puerta.
  if (!esDashboard() && !haySesion()) {
    window.location.href = 'admin.html';
    return;
  }

  if (esDashboard()) {
    configurarLogin();
  }

  configurarBotonesComunes();
});

function configurarLogin() {
  const panel = document.getElementById('login-panel');
  const contenido = document.getElementById('admin-content');
  const boton = document.getElementById('btn-login');
  const campo = document.getElementById('clave-admin');

  if (haySesion()) {
    if (panel) panel.classList.add('hidden');
    if (contenido) contenido.classList.remove('hidden');
  }

  if (!boton) return;

  async function entrar() {
    const clave = (campo && campo.value || '').trim();

    if (!clave) {
      alert('Ingrese la clave de acceso');
      if (campo) campo.focus();
      return;
    }

    boton.disabled = true;
    const textoOriginal = boton.innerHTML;
    boton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Verificando...';

    try {
      const resultado = await postData({ tipo: 'verificarAdmin', clave: clave });

      if (resultado.status === 'ok') {
        guardarSesion(clave);
        if (campo) campo.value = '';
        if (panel) panel.classList.add('hidden');
        if (contenido) contenido.classList.remove('hidden');
      } else {
        alert(resultado.message || 'Clave incorrecta');
        if (campo) {
          campo.value = '';
          campo.focus();
        }
      }
    } catch (error) {
      alert('No se pudo verificar la clave: ' + error.message);
    } finally {
      boton.disabled = false;
      boton.innerHTML = textoOriginal;
    }
  }

  boton.addEventListener('click', entrar);

  if (campo) {
    campo.addEventListener('keydown', function (evento) {
      if (evento.key === 'Enter') entrar();
    });
  }
}

function configurarBotonesComunes() {
  const salir = document.getElementById('btn-salir');
  if (salir) {
    salir.addEventListener('click', function () {
      cerrarSesion();
      window.location.href = 'index.html';
    });
  }

  const baseDatos = document.getElementById('btn-base-datos');
  if (baseDatos) {
    baseDatos.addEventListener('click', function () {
      window.open(BASE_DATOS_URL, '_blank');
    });
  }

  ['logo-daia', 'logo-ucv'].forEach(function (id) {
    const logo = document.getElementById(id);
    if (logo) {
      logo.addEventListener('click', function () {
        window.location.href = 'index.html';
      });
    }
  });
}
