document.addEventListener('DOMContentLoaded', async function () {
  if (!haySesion()) {
    window.location.href = 'admin.html';
    return;
  }

  await cargarDisciplinas();

  const btn = document.getElementById('btn-agregar-disciplina');
  if (btn) btn.addEventListener('click', agregarDisciplina);

  const input = document.getElementById('input-nueva-disciplina');
  if (input) {
    input.addEventListener('keydown', function (evento) {
      if (evento.key === 'Enter') agregarDisciplina();
    });
  }
});

let disciplinas = [];

function escapeHtml(texto) {
  return String(texto === null || texto === undefined ? '' : texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function cargarDisciplinas() {
  try {
    // Endpoint autenticado: es el único que devuelve las claves
    const data = await fetchJSON({ tipo: 'getDisciplinasAdmin' });

    if (data.status !== 'ok') throw new Error(data.message || 'No se pudieron cargar las disciplinas');

    disciplinas = (data.disciplinas || []).map(function (d) {
      return { id: d.id, nombre: d.nombre, clave: d.clave || '' };
    });

    actualizarContador();
    cargarTablaDisciplinas();
  } catch (error) {
    mostrarMensaje('Error al cargar disciplinas: ' + error.message, 'error');
  }
}

function actualizarContador() {
  const contador = document.getElementById('contador-disciplinas');
  if (contador) contador.textContent = disciplinas.length + ' registros';
}

function cargarTablaDisciplinas() {
  const tbody = document.getElementById('tabla-disciplinas-body');
  if (!tbody) return;

  tbody.innerHTML = '';

  disciplinas.forEach(function (d) {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50';
    tr.innerHTML =
      '<td class="p-4">' + escapeHtml(d.id) + '</td>' +
      '<td class="p-4 font-medium">' + escapeHtml(d.nombre) + '</td>' +
      '<td class="p-4">' +
        '<div class="flex items-center gap-2">' +
          '<input type="password" class="clave-disciplina border border-gray-300 rounded-lg p-2 w-24 focus:ring-2 focus:ring-blue-500 focus:border-transparent" value="' +
            escapeHtml(d.clave) + '" data-id="' + escapeHtml(d.id) + '" aria-label="Clave de la disciplina">' +
          '<button class="guardar-clave text-blue-600 hover:text-blue-800" data-id="' + escapeHtml(d.id) + '" title="Guardar clave">' +
            '<i class="fas fa-save"></i>' +
          '</button>' +
        '</div>' +
      '</td>' +
      '<td class="p-4">' +
        '<div class="flex gap-2">' +
          '<button class="editar-disciplina text-blue-600 hover:text-blue-800" data-id="' + escapeHtml(d.id) + '" title="Editar">' +
            '<i class="fas fa-edit"></i>' +
          '</button>' +
          '<button class="eliminar-disciplina text-red-600 hover:text-red-800" data-id="' + escapeHtml(d.id) + '" title="Eliminar">' +
            '<i class="fas fa-trash-alt"></i>' +
          '</button>' +
        '</div>' +
      '</td>';

    tbody.appendChild(tr);
  });

  configurarEventosTabla();
}

function configurarEventosTabla() {
  document.querySelectorAll('.editar-disciplina').forEach(function (btn) {
    btn.addEventListener('click', editarDisciplina);
  });

  document.querySelectorAll('.eliminar-disciplina').forEach(function (btn) {
    btn.addEventListener('click', eliminarDisciplina);
  });

  document.querySelectorAll('.guardar-clave').forEach(function (btn) {
    btn.addEventListener('click', guardarClaveDisciplina);
  });
}

async function agregarDisciplina() {
  const input = document.getElementById('input-nueva-disciplina');
  if (!input) return;

  const nombre = input.value.trim();

  if (!nombre) {
    mostrarMensaje('Ingrese un nombre válido', 'error');
    input.focus();
    return;
  }

  try {
    const res = await postData({ tipo: 'nueva-disciplina', nombre: nombre });

    if (res.status !== 'ok') throw new Error(res.message || 'Error desconocido');

    input.value = '';
    await cargarDisciplinas();
    mostrarMensaje('Disciplina agregada correctamente');
    input.focus();
  } catch (error) {
    mostrarMensaje('Error: ' + error.message, 'error');
  }
}

async function editarDisciplina() {
  const disciplinaId = this.dataset.id;
  const disciplina = disciplinas.find(function (d) { return String(d.id) === String(disciplinaId); });
  if (!disciplina) return;

  const { value: nuevoNombre } = await Swal.fire({
    title: 'Editar disciplina',
    input: 'text',
    inputValue: disciplina.nombre,
    showCancelButton: true,
    confirmButtonText: 'Guardar',
    cancelButtonText: 'Cancelar',
    inputValidator: function (value) {
      if (!value || !value.trim()) return 'Debe ingresar un nombre';
    }
  });

  if (!nuevoNombre) return;

  try {
    const res = await postData({
      tipo: 'editar-disciplina',
      id: disciplinaId,
      nombre: nuevoNombre.trim()
    });

    if (res.status !== 'ok') throw new Error(res.message || 'Error al actualizar');

    await cargarDisciplinas();
    mostrarMensaje('Disciplina actualizada correctamente');
  } catch (error) {
    mostrarMensaje('Error: ' + error.message, 'error');
  }
}

async function eliminarDisciplina() {
  const disciplinaId = this.dataset.id;
  const disciplina = disciplinas.find(function (d) { return String(d.id) === String(disciplinaId); });
  if (!disciplina) return;

  const { isConfirmed } = await Swal.fire({
    title: '¿Eliminar disciplina?',
    text: '¿Está seguro de eliminar la disciplina "' + disciplina.nombre + '"?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar'
  });

  if (!isConfirmed) return;

  try {
    const res = await postData({ tipo: 'eliminar-disciplina', id: disciplinaId });

    if (res.status !== 'ok') throw new Error(res.message || 'Error al eliminar');

    await cargarDisciplinas();
    mostrarMensaje('Disciplina eliminada correctamente');
  } catch (error) {
    mostrarMensaje('Error: ' + error.message, 'error');
  }
}

async function guardarClaveDisciplina() {
  const disciplinaId = this.dataset.id;
  const input = this.closest('td').querySelector('.clave-disciplina');
  if (!input) return;

  const clave = input.value.trim();

  if (clave && clave.length < 4) {
    mostrarMensaje('La clave debe tener al menos 4 caracteres', 'error');
    input.focus();
    return;
  }

  try {
    const res = await postData({
      tipo: 'actualizarClaveDisciplina',
      id: disciplinaId,
      clave: clave
    });

    if (res.status !== 'ok') throw new Error(res.message || 'Error al actualizar la clave');

    await cargarDisciplinas();
    mostrarMensaje(clave ? 'Clave actualizada' : 'Clave eliminada (la disciplina queda sin acceso)');
  } catch (error) {
    mostrarMensaje('Error: ' + error.message, 'error');
  }
}
