/* DAIA — comportamiento de la interfaz pública */

const API = 'https://script.google.com/macros/s/AKfycbzuYb3C1knQ5JArYTJM9nLLd9C8_YSHdr6AQssSxN97siEx3UAWdYIE3YMJkN7HtfS6fw/exec';

document.addEventListener('DOMContentLoaded', function () {
  iniciarTema();
  iniciarCarrusel();
  iniciarBusqueda();
  cargarDisciplinas();
  cargarPerfil();
  cargarAtletas();
  iniciarFiltro();
});

/* ---------------- Utilidades ---------------- */

function mostrarToast(mensaje, tipo) {
  const zona = document.getElementById('toast-zona');
  if (!zona) return;

  const aviso = document.createElement('div');
  aviso.className = 'toast ' + (tipo || 'info');

  const punto = document.createElement('span');
  punto.className = 'punto-aviso';

  const texto = document.createElement('span');
  texto.textContent = mensaje;

  aviso.appendChild(punto);
  aviso.appendChild(texto);
  zona.appendChild(aviso);

  setTimeout(function () {
    aviso.classList.add('saliendo');
    setTimeout(function () { aviso.remove(); }, 300);
  }, 4200);
}

async function pedir(parametros) {
  const url = new URL(API);
  Object.entries(parametros).forEach(function (par) {
    if (par[1] !== undefined && par[1] !== null) url.searchParams.append(par[0], par[1]);
  });

  const respuesta = await fetch(url);
  if (!respuesta.ok) throw new Error('Error de conexión');
  return respuesta.json();
}

function escapar(texto) {
  return String(texto === null || texto === undefined ? '' : texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function iniciales(nombre) {
  const partes = String(nombre || '').trim().split(/\s+/);
  return ((partes[0] || '')[0] || '') + ((partes[1] || '')[0] || '');
}

function formatearCedula(cedula) {
  const d = String(cedula || '').replace(/\D/g, '');
  if (!d) return 'Sin cédula';
  return 'V-' + d.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/* ---------------- Tema ---------------- */

function iniciarTema() {
  const boton = document.getElementById('boton-tema');
  if (!boton) return;

  function pintar() {
    const oscuro = document.documentElement.getAttribute('data-tema') !== 'claro';
    boton.textContent = oscuro ? '☾' : '☀';
  }

  boton.addEventListener('click', function () {
    const actual = document.documentElement.getAttribute('data-tema');
    const siguiente = actual === 'claro' ? 'oscuro' : 'claro';
    document.documentElement.setAttribute('data-tema', siguiente);
    try { localStorage.setItem('daia-tema', siguiente); } catch (e) { /* sin almacenamiento */ }
    pintar();
  });

  pintar();
}

/* ---------------- Carrusel ---------------- */

function iniciarCarrusel() {
  const hero = document.getElementById('hero');
  if (!hero) return;

  const fotos = hero.querySelectorAll('.hero-foto');
  const puntos = hero.querySelectorAll('.punto');
  if (!fotos.length) return;

  let actual = 0;
  let temporizador = null;

  function mostrar(indice) {
    actual = (indice + fotos.length) % fotos.length;
    fotos.forEach(function (foto, i) { foto.classList.toggle('activa', i === actual); });
    puntos.forEach(function (punto, i) { punto.classList.toggle('activo', i === actual); });
  }

  function iniciar() {
    detener();
    temporizador = setInterval(function () { mostrar(actual + 1); }, 6000);
  }

  function detener() {
    if (temporizador) clearInterval(temporizador);
  }

  puntos.forEach(function (punto, i) {
    punto.addEventListener('click', function () { mostrar(i); iniciar(); });
  });

  hero.addEventListener('mouseenter', detener);
  hero.addEventListener('mouseleave', iniciar);

  mostrar(0);
  iniciar();
}

/* ---------------- Disciplinas ---------------- */

const ICONO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">' +
  '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3v18M5.6 5.6c3.5 3.5 9.3 3.5 12.8 0M5.6 18.4c3.5-3.5 9.3-3.5 12.8 0"/></svg>';

async function cargarDisciplinas() {
  const contenedor = document.getElementById('contenedorDisciplinas');
  if (!contenedor) return;

  try {
    const datos = await pedir({ tipo: 'getDisciplinas' });

    if (datos.status !== 'ok') throw new Error(datos.message || 'No se pudieron cargar las disciplinas');

    const lista = datos.disciplinas || [];
    contenedor.innerHTML = '';

    lista.forEach(function (d, i) {
      const tarjeta = document.createElement('a');
      tarjeta.className = 'disciplina c' + ((i % 6) + 1);
      tarjeta.href = '#';
      tarjeta.dataset.id = d.id;
      tarjeta.dataset.nombre = d.nombre;

      tarjeta.innerHTML =
        '<span class="icono">' + ICONO + '</span>' +
        '<strong>' + escapar(d.nombre) + '</strong>' +
        '<span class="cantidad">' + (d.requiereClave ? 'Requiere clave' : 'Acceso directo') + '</span>' +
        '<span class="ver">Ver atletas →</span>';

      contenedor.appendChild(tarjeta);
    });

    prepararModalClave(lista);
  } catch (error) {
    contenedor.innerHTML = '<p style="color: #FB7185;">' + escapar(error.message) + '</p>';
  }
}

/* ---------------- Buscador ---------------- */

function iniciarBusqueda() {
  const campo = document.getElementById('busqueda');
  if (!campo) return;

  const boton = document.querySelector('.fila-busqueda .boton');

  async function consultar() {
    const texto = campo.value.trim();

    if (texto.length < 3) {
      mostrarToast('Escribe al menos 3 letras del nombre o la cédula.', 'error');
      campo.focus();
      return;
    }

    try {
      mostrarToast('Buscando…', 'info');

      const datos = await pedir({ tipo: 'buscarAtleta', q: texto });

      if (datos.status !== 'ok') throw new Error(datos.message);
      if (!datos.atletas || !datos.atletas.length) {
        mostrarToast('No encontramos a nadie con ese dato.', 'aviso');
        return;
      }

      if (datos.atletas.length === 1) {
        window.location.href = 'perfil.html?id=' + encodeURIComponent(datos.atletas[0].id);
        return;
      }

      sessionStorage.setItem('daia-resultados', JSON.stringify(datos.atletas));
      window.location.href = 'perfil.html';
    } catch (error) {
      mostrarToast('Error al buscar: ' + error.message, 'error');
    }
  }

  if (boton) {
    boton.addEventListener('click', function (evento) {
      evento.preventDefault();
      consultar();
    });
  }

  campo.addEventListener('keydown', function (evento) {
    if (evento.key === 'Enter') consultar();
  });
}

/* ---------------- Modal de clave ---------------- */

function prepararModalClave(disciplinas) {
  const modal = document.getElementById('modal-clave');
  if (!modal) return;

  const titulo = document.getElementById('modal-disciplina');
  const campo = document.getElementById('clave-disciplina');
  const botonEntrar = document.getElementById('modal-entrar');
  const botonCancelar = document.getElementById('modal-cancelar');

  let disciplina = null;

  document.querySelectorAll('.disciplina').forEach(function (tarjeta) {
    tarjeta.addEventListener('click', function (evento) {
      evento.preventDefault();

      disciplina = {
        id: tarjeta.dataset.id,
        nombre: tarjeta.dataset.nombre
      };

      titulo.textContent = disciplina.nombre;
      campo.value = '';
      modal.classList.add('abierto');
      modal.setAttribute('aria-hidden', 'false');
      setTimeout(function () { campo.focus(); }, 60);
    });
  });

  function cerrar() {
    modal.classList.remove('abierto');
    modal.setAttribute('aria-hidden', 'true');
  }

  async function entrar() {
    if (!disciplina) return;

    const clave = campo.value.trim();
    if (!clave) {
      mostrarToast('Escribe la clave de la disciplina.', 'error');
      campo.focus();
      return;
    }

    botonEntrar.disabled = true;
    botonEntrar.textContent = 'Verificando…';

    try {
      const datos = await pedir({
        tipo: 'verificarAccesoDisciplina',
        disciplinaId: disciplina.id,
        clave: clave
      });

      if (datos.status !== 'ok' || !datos.token) {
        mostrarToast(datos.message || 'Clave incorrecta', 'error');
        campo.select();
        return;
      }

      sessionStorage.setItem('disciplina_' + disciplina.id + '_token', datos.token);
      sessionStorage.setItem('disciplina_' + disciplina.id + '_nombre', disciplina.nombre);

      cerrar();
      mostrarToast('Acceso concedido', 'exito');

      window.location.href = 'atletas.html?disciplinaId=' + encodeURIComponent(disciplina.id) +
        '&disciplinaNombre=' + encodeURIComponent(disciplina.nombre);
    } catch (error) {
      mostrarToast('Error al verificar: ' + error.message, 'error');
    } finally {
      botonEntrar.disabled = false;
      botonEntrar.textContent = 'Entrar';
    }
  }

  botonEntrar.addEventListener('click', entrar);
  botonCancelar.addEventListener('click', cerrar);
  campo.addEventListener('keydown', function (evento) { if (evento.key === 'Enter') entrar(); });
  modal.addEventListener('click', function (evento) { if (evento.target === modal) cerrar(); });
  document.addEventListener('keydown', function (evento) { if (evento.key === 'Escape') cerrar(); });
}

/* ---------------- Ficha pública ---------------- */

async function cargarPerfil() {
  const contenedor = document.getElementById('perfil');
  if (!contenedor) return;

  const parametros = new URLSearchParams(location.search);
  const id = parametros.get('id');

  if (!id) {
    mostrarResultados(contenedor);
    return;
  }

  try {
    const datos = await pedir({ tipo: 'getAtleta', id: id });

    if (datos.status !== 'ok' || !datos.atleta) throw new Error(datos.message || 'Atleta no encontrado');

    const a = datos.atleta;

    contenedor.innerHTML =
      '<div class="perfil-hero aparecer">' +
        '<div class="avatar-grande">' + escapar(iniciales(a.nombre)) + '</div>' +
        '<h1 class="perfil-nombre">' + escapar(a.nombre) + '</h1>' +
        '<span class="perfil-pastilla">' + escapar(a.disciplina || 'Sin disciplina') + '</span>' +
        '<p class="nota-lectura">Consulta pública · solo lectura</p>' +
      '</div>' +
      '<div class="mosaico escalonado">' +
        celda('n1', 'destacada', 'Cédula', formatearCedula(a.cedula)) +
        celda('n2', '', 'Disciplina', a.disciplina || 'Sin asignar') +
        celda('n4', '', 'Año de ingreso', a.anioIngreso || 'Sin dato') +
        celda('n3', '', 'Carrera', a.carrera || 'Sin dato') +
        celda('n5', '', 'Facultad', a.facultad || 'Sin dato') +
        celda('n6', '', 'Estado', 'Registrado') +
      '</div>' +
      '<div class="perfil-pie"><a class="boton secundario" href="index.html">Volver a la consulta</a></div>';
  } catch (error) {
    contenedor.innerHTML = '<p style="color: #FB7185;">' + escapar(error.message) + '</p>';
  }
}

function celda(color, extra, rotulo, valor) {
  return '<div class="celda ' + color + (extra ? ' ' + extra : '') + '">' +
    '<span class="rotulo">' + escapar(rotulo) + '</span>' +
    '<span class="valor">' + escapar(valor) + '</span>' +
  '</div>';
}

function mostrarResultados(contenedor) {
  let lista = [];

  try {
    lista = JSON.parse(sessionStorage.getItem('daia-resultados') || '[]');
  } catch (e) {
    lista = [];
  }

  if (!lista.length) {
    contenedor.innerHTML =
      '<p class="seccion-sub">No hay resultados. <a href="index.html" style="color: var(--cian);">Vuelve a consultar</a>.</p>';
    return;
  }

  contenedor.innerHTML =
    '<h1 class="perfil-nombre" style="text-align: center; font-size: 1.5rem;">' +
      lista.length + ' coincidencias' +
    '</h1>' +
    '<p class="seccion-sub" style="text-align: center; margin-bottom: 24px;">Elige el atleta que buscas.</p>' +
    '<div class="grid-atletas escalonado">' +
      lista.map(function (a, i) {
        return '<article class="atleta a' + ((i % 6) + 1) + '">' +
          '<div class="atleta-cabeza">' +
            '<div class="avatar-chico">' + escapar(iniciales(a.nombre)) + '</div>' +
            '<div>' +
              '<p class="atleta-nombre">' + escapar(a.nombre) + '</p>' +
              '<p class="atleta-meta">' + escapar(formatearCedula(a.cedula)) + '</p>' +
            '</div>' +
          '</div>' +
          '<a class="boton pequeno" href="perfil.html?id=' + encodeURIComponent(a.id) + '">Ver ficha</a>' +
        '</article>';
      }).join('') +
    '</div>';
}

/* ---------------- Listado del entrenador ---------------- */

async function cargarAtletas() {
  const contenedor = document.getElementById('contenedorAtletas');
  if (!contenedor) return;

  const parametros = new URLSearchParams(location.search);
  const disciplinaId = parametros.get('disciplinaId');
  const nombre = parametros.get('disciplinaNombre') || 'Disciplina';

  const token = sessionStorage.getItem('disciplina_' + disciplinaId + '_token');

  if (!disciplinaId || !token) {
    window.location.href = 'login-disciplina.html?disciplinaId=' + encodeURIComponent(disciplinaId || '') +
      '&disciplinaNombre=' + encodeURIComponent(nombre);
    return;
  }

  document.getElementById('titulo-disciplina').textContent = nombre;

  try {
    const datos = await pedir({ tipo: 'getAtletas', disciplinaId: disciplinaId, token: token });

    if (datos.code === 'unauthorized') {
      sessionStorage.removeItem('disciplina_' + disciplinaId + '_token');
      window.location.href = 'login-disciplina.html?disciplinaId=' + encodeURIComponent(disciplinaId) +
        '&disciplinaNombre=' + encodeURIComponent(nombre);
      return;
    }

    if (datos.status !== 'ok') throw new Error(datos.message);

    renderizarAtletas(datos.atletas || [], disciplinaId, nombre);
  } catch (error) {
    contenedor.innerHTML = '<p style="color: #FB7185;">' + escapar(error.message) + '</p>';
  }
}

function renderizarAtletas(atletas, disciplinaId, disciplinaNombre) {
  const contenedor = document.getElementById('contenedorAtletas');
  const evaluados = atletas.filter(function (a) { return a.respondido; }).length;

  const resumen = document.getElementById('resumen-atletas');
  if (resumen) {
    resumen.textContent = atletas.length + ' atletas · ' + evaluados + ' evaluados · ' +
      (atletas.length - evaluados) + ' pendientes';
  }

  contenedor.innerHTML = '';

  atletas.forEach(function (a, i) {
    const tarjeta = document.createElement('article');
    tarjeta.className = 'atleta a' + ((i % 6) + 1);

    tarjeta.innerHTML =
      '<div class="atleta-cabeza">' +
        '<div class="avatar-chico">' + escapar(iniciales(a.nombre)) + '</div>' +
        '<div>' +
          '<p class="atleta-nombre">' + escapar(a.nombre) + '</p>' +
          '<p class="atleta-meta">' + escapar(formatearCedula(a.cedula)) +
            (a.carrera ? ' · ' + escapar(a.carrera) : '') + '</p>' +
        '</div>' +
      '</div>' +
      (a.respondido
        ? '<span class="estado completado">Evaluado ' + escapar(a.fechaEvaluacion || '') + '</span>'
        : '<span class="estado pendiente">Pendiente</span>') +
      (a.respondido
        ? '<a class="boton pequeno secundario" href="perfil.html?id=' + encodeURIComponent(a.id) + '">Ver ficha</a>'
        : '<a class="boton pequeno" href="cuestionario.html?nombre=' + encodeURIComponent(a.nombre) +
            '&atletaId=' + encodeURIComponent(a.id) +
            '&disciplinaId=' + encodeURIComponent(disciplinaId) +
            '&disciplina=' + encodeURIComponent(disciplinaNombre) + '">Evaluar</a>');

    contenedor.appendChild(tarjeta);
  });
}

/* ---------------- Filtro ---------------- */

function iniciarFiltro() {
  const filtro = document.querySelector('.filtro');
  if (!filtro) return;

  filtro.addEventListener('input', function () {
    const texto = filtro.value.toLowerCase().trim();

    document.querySelectorAll('.atleta').forEach(function (tarjeta) {
      tarjeta.style.display = tarjeta.textContent.toLowerCase().includes(texto) ? '' : 'none';
    });
  });
}
