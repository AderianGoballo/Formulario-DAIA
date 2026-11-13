document.addEventListener('DOMContentLoaded', async function() {
  if (!haySesion()) {
    window.location.href = 'admin.html';
    return;
  }

  await Promise.all([
    cargarDisciplinas(), 
    cargarFacultades(), 
    cargarEscuelas(), 
    cargarAtletas()
  ]);
  
  document.getElementById('btn-agregar-atleta').addEventListener('click', agregarAtleta);

  const filtro = document.getElementById('filtro-atletas');
  if (filtro) filtro.addEventListener('input', filtrarAtletas);
});

function clave(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function filtrarAtletas() {
  const campo = document.getElementById('filtro-atletas');
  const tbody = document.getElementById('tabla-atletas-body');
  const contador = document.getElementById('contador-atletas');
  if (!campo || !tbody) return;

  const texto = clave(campo.value);
  const digitos = campo.value.replace(/\D/g, '');

  const lista = atletas.filter(function (a) {
    const coincideNombre = clave(a.nombre).indexOf(texto) !== -1;
    const coincideCedula = digitos && String(a.cedula || '').indexOf(digitos) !== -1;
    return texto ? (coincideNombre || coincideCedula) : true;
  });

  tbody.innerHTML = '';
  lista.forEach(agregarFilaAtleta);

  if (contador) {
    contador.textContent = texto
      ? lista.length + ' de ' + atletas.length + ' registros'
      : atletas.length + ' registros';
  }
}

let disciplinas = [];
let facultades = [];
let escuelas = [];
let atletas = [];

function escapeHtml(texto) {
  return String(texto === null || texto === undefined ? '' : texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatearCedula(cedula) {
  const d = String(cedula || '').replace(/\D/g, '');
  if (!d) return '—';
  return 'V-' + d.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

async function cargarDisciplinas() {
  try {
    const data = await fetchJSON({ tipo: 'getDisciplinas' });
    disciplinas = data.disciplinas || [];
    llenarSelectDisciplinas();
  } catch (error) {
    mostrarMensaje('Error al cargar disciplinas: ' + error.message, 'error');
  }
}

async function cargarFacultades() {
  try {
    const data = await fetchJSON({ tipo: 'getFacultades' });
    facultades = data.facultades || [];
    llenarSelectFacultades();
  } catch (error) {
    mostrarMensaje('Error al cargar facultades: ' + error.message, 'error');
  }
}

async function cargarEscuelas() {
  try {
    const data = await fetchJSON({ tipo: 'getEscuelas' });
    escuelas = data.escuelas || [];
    llenarSelectEscuelas();
  } catch (error) {
    mostrarMensaje('Error al cargar escuelas: ' + error.message, 'error');
  }
}

async function cargarAtletas() {
  try {
    const data = await fetchJSON({ tipo: 'getAtletas' });
    atletas = data.atletas || [];
    actualizarContador();
    cargarTablaAtletas();
  } catch (error) {
    mostrarMensaje('Error al cargar atletas: ' + error.message, 'error');
  }
}

function actualizarContador() {
  document.getElementById('contador-atletas').textContent = `${atletas.length} registros`;
}

function llenarSelectDisciplinas() {
  const select = document.getElementById('select-disciplina-atleta');
  select.innerHTML = '<option value="">Seleccione disciplina</option>';
  disciplinas.forEach(d => {
    const option = document.createElement('option');
    option.value = d.id;
    option.textContent = d.nombre;
    select.appendChild(option);
  });
}

function llenarSelectFacultades() {
  const select = document.getElementById('select-facultad-atleta');
  select.innerHTML = '<option value="">Seleccione facultad</option>';
  facultades.forEach(f => {
    const option = document.createElement('option');
    option.value = f.id;
    option.textContent = f.nombre;
    select.appendChild(option);
  });
}

function llenarSelectEscuelas() {
  const select = document.getElementById('select-escuela-atleta');
  select.innerHTML = '<option value="">Seleccione escuela</option>';
  escuelas.forEach(e => {
    const option = document.createElement('option');
    option.value = e.id;
    option.textContent = e.nombre;
    select.appendChild(option);
  });
}

function cargarTablaAtletas() {
  const tbody = document.getElementById('tabla-atletas-body');
  tbody.innerHTML = '';
  
  atletas.forEach(a => {
    agregarFilaAtleta(a);
  });
}

function agregarFilaAtleta(atleta) {
  const tbody = document.getElementById('tabla-atletas-body');
  const disciplina = disciplinas.find(d => d.id == atleta.disciplinaId) || { nombre: 'Desconocido' };
  const facultad = facultades.find(f => f.id == atleta.facultadId) || { nombre: 'Desconocido' };
  const escuela = escuelas.find(e => e.id == atleta.escuelaId) || { nombre: 'Desconocido' };
  
  const tr = document.createElement('tr');
  tr.className = 'hover:bg-gray-50';
  tr.innerHTML = `
    <td class="p-4">${atleta.id}</td>
    <td class="p-4 font-medium">${escapeHtml(atleta.nombre)}</td>
    <td class="p-4">${formatearCedula(atleta.cedula)}</td>
    <td class="p-4">${escapeHtml(disciplina.nombre)}</td>
    <td class="p-4">${escapeHtml(facultad.nombre)}</td>
    <td class="p-4">${escapeHtml(escuela.nombre)}</td>
    <td class="p-4">
      <div class="flex gap-2">
        <button class="editar-atleta text-pink-600 hover:text-pink-800" data-id="${atleta.id}">
          <i class="fas fa-edit"></i>
        </button>
        <button class="eliminar-atleta text-red-600 hover:text-red-800" data-id="${atleta.id}">
          <i class="fas fa-trash-alt"></i>
        </button>
      </div>
    </td>
  `;
  tbody.appendChild(tr);

  tr.querySelector('.editar-atleta').addEventListener('click', editarAtleta);
  tr.querySelector('.eliminar-atleta').addEventListener('click', eliminarAtleta);
}

function actualizarFilaAtleta(atletaId) {
  const atleta = atletas.find(a => a.id == atletaId);
  if (!atleta) return;

  const disciplina = disciplinas.find(d => d.id == atleta.disciplinaId) || { nombre: 'Desconocido' };
  const facultad = facultades.find(f => f.id == atleta.facultadId) || { nombre: 'Desconocido' };
  const escuela = escuelas.find(e => e.id == atleta.escuelaId) || { nombre: 'Desconocido' };

  const row = document.querySelector(`tr:has(button[data-id="${atletaId}"])`);
  if (row) {
    row.innerHTML = `
      <td class="p-4">${atleta.id}</td>
      <td class="p-4 font-medium">${escapeHtml(atleta.nombre)}</td>
    <td class="p-4">${formatearCedula(atleta.cedula)}</td>
      <td class="p-4">${disciplina.nombre}</td>
      <td class="p-4">${facultad.nombre}</td>
      <td class="p-4">${escuela.nombre}</td>
      <td class="p-4">
        <div class="flex gap-2">
          <button class="editar-atleta text-pink-600 hover:text-pink-800" data-id="${atleta.id}">
            <i class="fas fa-edit"></i>
          </button>
          <button class="eliminar-atleta text-red-600 hover:text-red-800" data-id="${atleta.id}">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      </td>
    `;

    row.querySelector('.editar-atleta').addEventListener('click', editarAtleta);
    row.querySelector('.eliminar-atleta').addEventListener('click', eliminarAtleta);
  }
}

async function agregarAtleta() {
  const input = document.getElementById('input-nuevo-atleta');
  const nombre = input.value.trim();
  const disciplinaId = document.getElementById('select-disciplina-atleta').value;
  const facultadId = document.getElementById('select-facultad-atleta').value;
  const escuelaId = document.getElementById('select-escuela-atleta').value;
  const cedula = (document.getElementById('input-cedula-atleta') || {}).value || '';
  const anioIngreso = (document.getElementById('input-anio-atleta') || {}).value || '';
  const carrera = (document.getElementById('input-carrera-atleta') || {}).value || '';

  if (!nombre) {
    mostrarMensaje('Ingrese un nombre válido', 'error');
    input.focus();
    return;
  }

  if (!disciplinaId) {
    mostrarMensaje('Seleccione una disciplina', 'error');
    return;
  }

  if (!facultadId) {
    mostrarMensaje('Seleccione una facultad', 'error');
    return;
  }

  if (!escuelaId) {
    mostrarMensaje('Seleccione una escuela', 'error');
    return;
  }

  try {
    const res = await postData({
      tipo: 'nuevo-atleta',
      nombre: nombre,
      disciplinaId: disciplinaId,
      facultadId: facultadId,
      escuelaId: escuelaId,
      cedula: cedula,
      anioIngreso: anioIngreso,
      carrera: carrera,
      adminKey: ADMIN_KEY
    });

    if (res.status === 'ok') {
      input.value = '';
      document.getElementById('select-disciplina-atleta').value = '';
      document.getElementById('select-facultad-atleta').value = '';
      document.getElementById('select-escuela-atleta').value = '';

      const campoCedula = document.getElementById('input-cedula-atleta');
      const campoAnio = document.getElementById('input-anio-atleta');
      const campoCarrera = document.getElementById('input-carrera-atleta');
      if (campoCedula) campoCedula.value = '';
      if (campoAnio) campoAnio.value = '';
      if (campoCarrera) campoCarrera.value = '';

      // Actualizar la lista local y la tabla
      const nuevoAtleta = {
        id: res.id || Date.now(),
        nombre: nombre,
        disciplinaId: disciplinaId,
        facultadId: facultadId,
        escuelaId: escuelaId
      };
      atletas.push(nuevoAtleta);
      vista.pagina = 1;
      renderizarTabla();
      
      mostrarMensaje('Atleta agregado correctamente');
      input.focus();
    } else {
      throw new Error(res.message || 'Error desconocido');
    }
  } catch (error) {
    mostrarMensaje('Error: ' + error.message, 'error');
  }
}

async function editarAtleta() {
  const atletaId = this.dataset.id;
  const atleta = atletas.find(a => String(a.id) === String(atletaId));
  if (!atleta) return;

  function opciones(lista, seleccionado, textoVacio) {
    let html = textoVacio ? '<option value="">' + textoVacio + '</option>' : '';
    lista.forEach(function (item) {
      html += '<option value="' + item.id + '"' +
        (String(item.id) === String(seleccionado) ? ' selected' : '') + '>' +
        escapeHtml(item.nombre) + '</option>';
    });
    return html;
  }

  const formulario =
    '<div class="form-edicion">' +
      '<div><label for="e-nombre">Nombre completo</label>' +
        '<input id="e-nombre" type="text" value="' + escapeHtml(atleta.nombre) + '"></div>' +
      '<div class="fila-doble">' +
        '<div><label for="e-cedula">Cédula</label>' +
          '<input id="e-cedula" type="text" inputmode="numeric" placeholder="31925673" value="' + escapeHtml(atleta.cedula || '') + '"></div>' +
        '<div><label for="e-anio">Año de ingreso</label>' +
          '<input id="e-anio" type="number" min="1990" max="2100" placeholder="2025" value="' + escapeHtml(atleta.anioIngreso || '') + '"></div>' +
      '</div>' +
      '<div><label for="e-carrera">Carrera</label>' +
        '<input id="e-carrera" type="text" placeholder="Comunicación Social" value="' + escapeHtml(atleta.carrera || '') + '"></div>' +
      '<div><label for="e-disciplina">Disciplina</label>' +
        '<select id="e-disciplina">' + opciones(disciplinas, atleta.disciplinaId, 'Sin asignar') + '</select></div>' +
      '<div><label for="e-facultad">Facultad</label>' +
        '<select id="e-facultad">' + opciones(facultades, atleta.facultadId, 'Sin asignar') + '</select></div>' +
      '<div><label for="e-escuela">Escuela</label>' +
        '<select id="e-escuela">' + opciones(escuelas, atleta.escuelaId, 'Sin asignar') + '</select></div>' +
    '</div>';

  if (typeof Swal === 'undefined') {
    const nuevoNombre = prompt('Nombre del atleta:', atleta.nombre);
    if (!nuevoNombre || !nuevoNombre.trim()) return;
    await guardarCambiosAtleta(atletaId, {
      nombre: nuevoNombre.trim(),
      cedula: atleta.cedula || '',
      anioIngreso: atleta.anioIngreso || '',
      carrera: atleta.carrera || '',
      disciplinaId: atleta.disciplinaId,
      facultadId: atleta.facultadId,
      escuelaId: atleta.escuelaId
    });
    return;
  }

  const resultado = await Swal.fire({
    title: 'Editar atleta',
    html: formulario,
    width: 560,
    showCancelButton: true,
    confirmButtonText: 'Guardar cambios',
    cancelButtonText: 'Cancelar',
    focusConfirm: false,
    didOpen: function () {
      const selectFacultad = document.getElementById('e-facultad');
      const selectEscuela = document.getElementById('e-escuela');
      if (!selectFacultad || !selectEscuela) return;

      selectFacultad.addEventListener('change', function () {
        const elegida = selectFacultad.value;
        const anterior = selectEscuela.value;

        let html = '<option value="">Sin asignar</option>';

        escuelas
          .filter(function (e) { return !elegida || String(e.facultadId) === String(elegida); })
          .forEach(function (e) {
            html += '<option value="' + e.id + '">' + escapeHtml(e.nombre) + '</option>';
          });

        selectEscuela.innerHTML = html;

        if (Array.prototype.some.call(selectEscuela.options, function (o) { return o.value === anterior; })) {
          selectEscuela.value = anterior;
        }
      });
    },
    preConfirm: function () {
      const nombre = document.getElementById('e-nombre').value.trim();
      if (!nombre) {
        Swal.showValidationMessage('El nombre no puede quedar vacío');
        return false;
      }
      return {
        nombre: nombre,
        cedula: document.getElementById('e-cedula').value.trim(),
        anioIngreso: document.getElementById('e-anio').value.trim(),
        carrera: document.getElementById('e-carrera').value.trim(),
        disciplinaId: document.getElementById('e-disciplina').value,
        facultadId: document.getElementById('e-facultad').value,
        escuelaId: document.getElementById('e-escuela').value
      };
    }
  });

  if (!resultado.value) return;
  await guardarCambiosAtleta(atletaId, resultado.value);
}

async function guardarCambiosAtleta(atletaId, datos) {
  try {
    const res = await postData({
      tipo: 'editar-atleta',
      id: atletaId,
      nombre: datos.nombre,
      disciplinaId: datos.disciplinaId,
      facultadId: datos.facultadId,
      escuelaId: datos.escuelaId,
      cedula: datos.cedula,
      anioIngreso: datos.anioIngreso,
      carrera: datos.carrera,
      adminKey: ADMIN_KEY
    });

    if (res.status !== 'ok') throw new Error(res.message || 'Error al actualizar');

    const indice = atletas.findIndex(a => String(a.id) === String(atletaId));
    if (indice !== -1) {
      atletas[indice] = Object.assign({}, atletas[indice], datos);
      actualizarFilaAtleta(atletaId);
    }

    mostrarMensaje('Atleta actualizado');
  } catch (error) {
    mostrarMensaje('Error: ' + error.message, 'error');
  }
}

async function eliminarAtleta() {
  const atletaId = this.dataset.id;
  const atleta = atletas.find(a => a.id == atletaId);
  
  if (!atleta) return;

  if (typeof Swal === 'undefined') {
    const confirmar = confirm(`¿Eliminar al atleta "${atleta.nombre}"?`);
    if (!confirmar) return;
    
    try {
      const res = await postData({
        tipo: 'eliminar-atleta',
        id: atletaId,
        adminKey: ADMIN_KEY
      });

      if (res.status === 'ok') {
        // Eliminar localmente
        atletas = atletas.filter(a => a.id != atletaId);
        renderizarTabla();
        mostrarMensaje('Atleta eliminado correctamente');
      } else {
        throw new Error(res.message || 'Error al eliminar');
      }
    } catch (error) {
      mostrarMensaje('Error: ' + error.message, 'error');
    }
    return;
  }

  const confirmar = await Swal.fire({
    title: '¿Eliminar atleta?',
    text: `¿Está seguro de eliminar al atleta "${atleta.nombre}"?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar'
  });

  if (!confirmar.isConfirmed) return;
  
  try {
    const res = await postData({
      tipo: 'eliminar-atleta',
      id: atletaId,
      adminKey: ADMIN_KEY
    });

    if (res.status === 'ok') {
      // Eliminar localmente
      atletas = atletas.filter(a => a.id != atletaId);
      actualizarContador();
      document.querySelector(`tr:has(button[data-id="${atletaId}"])`)?.remove();
      mostrarMensaje('Atleta eliminado correctamente');
    } else {
      throw new Error(res.message || 'Error al eliminar');
    }
  } catch (error) {
    mostrarMensaje('Error: ' + error.message, 'error');
  }
}
/* ---------- Orden, filtro y paginación de la tabla ---------- */

let vista = { texto: '', campo: 'id', dir: 1, pagina: 1, tamano: 25 };

function nombreDisciplina(id) {
  const d = disciplinas.find(function (x) { return String(x.id) === String(id); });
  return d ? d.nombre : '';
}

function listaVisible() {
  const texto = clave(vista.texto);
  const digitos = String(vista.texto || '').replace(/\D/g, '');

  const lista = atletas.filter(function (a) {
    if (!texto) return true;
    const porNombre = clave(a.nombre).indexOf(texto) !== -1;
    const porCedula = digitos && String(a.cedula || '').indexOf(digitos) !== -1;
    return porNombre || porCedula;
  });

  const campo = vista.campo;
  const dir = vista.dir;

  lista.sort(function (a, b) {
    let x, y;

    if (campo === 'nombre') { x = clave(a.nombre); y = clave(b.nombre); }
    else if (campo === 'cedula') { x = String(a.cedula || '').padStart(10, '0'); y = String(b.cedula || '').padStart(10, '0'); }
    else if (campo === 'disciplina') { x = clave(nombreDisciplina(a.disciplinaId)); y = clave(nombreDisciplina(b.disciplinaId)); }
    else { x = Number(a.id) || 0; y = Number(b.id) || 0; }

    if (x < y) return -1 * dir;
    if (x > y) return 1 * dir;
    return 0;
  });

  return lista;
}

function renderizarTabla() {
  const tbody = document.getElementById('tabla-atletas-body');
  if (!tbody) return;

  const lista = listaVisible();
  const totalPaginas = Math.max(1, Math.ceil(lista.length / vista.tamano));

  if (vista.pagina > totalPaginas) vista.pagina = totalPaginas;
  if (vista.pagina < 1) vista.pagina = 1;

  const inicio = (vista.pagina - 1) * vista.tamano;
  const pagina = lista.slice(inicio, inicio + vista.tamano);

  tbody.innerHTML = '';

  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="vacio">No hay atletas que coincidan con la búsqueda.</td></tr>';
  } else {
    pagina.forEach(agregarFilaAtleta);
  }

  const contador = document.getElementById('contador-atletas');
  if (contador) {
    contador.textContent = vista.texto
      ? lista.length + ' de ' + atletas.length + ' registros'
      : atletas.length + ' registros';
  }

  const info = document.getElementById('pagina-info');
  if (info) info.textContent = 'Página ' + vista.pagina + ' de ' + totalPaginas;

  const prev = document.getElementById('pagina-anterior');
  const siguiente = document.getElementById('pagina-siguiente');
  if (prev) prev.disabled = vista.pagina <= 1;
  if (siguiente) siguiente.disabled = vista.pagina >= totalPaginas;

  document.querySelectorAll('th[data-orden]').forEach(function (th) {
    const activa = th.getAttribute('data-orden') === vista.campo;
    th.classList.toggle('activa', activa);
    th.setAttribute('data-dir', activa ? String(vista.dir) : '');
  });
}

function cargarTablaAtletas() {
  vista.pagina = 1;
  renderizarTabla();
}

function filtrarAtletas() {
  const campo = document.getElementById('filtro-atletas');
  vista.texto = campo ? campo.value : '';
  vista.pagina = 1;
  renderizarTabla();
}

function actualizarFilaAtleta() {
  renderizarTabla();
}

function cambiarOrden(campo) {
  if (vista.campo === campo) vista.dir = -vista.dir;
  else { vista.campo = campo; vista.dir = 1; }

  vista.pagina = 1;
  renderizarTabla();
}

document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('th[data-orden]').forEach(function (th) {
    th.addEventListener('click', function () {
      cambiarOrden(th.getAttribute('data-orden'));
    });
  });

  const prev = document.getElementById('pagina-anterior');
  const siguiente = document.getElementById('pagina-siguiente');

  if (prev) prev.addEventListener('click', function () { vista.pagina--; renderizarTabla(); });
  if (siguiente) siguiente.addEventListener('click', function () { vista.pagina++; renderizarTabla(); });
});
