document.addEventListener('DOMContentLoaded', async function() {
  if (!localStorage.getItem('adminKey')) {
    window.location.href = 'admin.html';
    return;
  }

  // Cargar disciplinas inicialmente
  await cargarDisciplinas();
  
  // Configurar eventos
  document.getElementById('btn-agregar-disciplina').addEventListener('click', agregarDisciplina);
});

let disciplinas = [];

async function cargarDisciplinas() {
  try {
    // Limpiar caché y forzar recarga
    localStorage.removeItem(CACHE_KEY_DISCIPLINAS);
    
    // Usar timestamp para evitar caché
    const timestamp = new Date().getTime();
    const data = await fetchJSON({ 
      tipo: 'getDisciplinas',
      cache: timestamp
    });
    
    // Procesar datos
    disciplinas = (data.disciplinas || []).map(d => ({
      ...d,
      nombre: decodeURIComponent(d.nombre.replace(/\+/g, ' '))
    }));
    
    actualizarContador();
    cargarTablaDisciplinas();
  } catch (error) {
    mostrarMensaje('Error al cargar disciplinas: ' + error.message, 'error');
  }
}

function actualizarContador() {
  const contador = document.getElementById('contador-disciplinas');
  if (contador) {
    contador.textContent = `${disciplinas.length} registros`;
  }
}

function cargarTablaDisciplinas() {
  const tbody = document.getElementById('tabla-disciplinas-body');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  disciplinas.forEach(d => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50';
    tr.innerHTML = `
      <td class="p-4">${d.id}</td>
      <td class="p-4 font-medium">${d.nombre}</td>
      <td class="p-4">
        <div class="flex items-center gap-2">
          <input type="password" class="clave-disciplina border border-gray-300 rounded-lg p-2 w-24 focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
            value="${d.clave || ''}" data-id="${d.id}">
          <button class="guardar-clave text-blue-600 hover:text-blue-800" data-id="${d.id}">
            <i class="fas fa-save"></i>
          </button>
        </div>
      </td>
      <td class="p-4">
        <div class="flex gap-2">
          <button class="editar-disciplina text-blue-600 hover:text-blue-800" data-id="${d.id}">
            <i class="fas fa-edit"></i>
          </button>
          <button class="eliminar-disciplina text-red-600 hover:text-red-800" data-id="${d.id}">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Configurar eventos
  configurarEventosTabla();
}

function configurarEventosTabla() {
  // Configurar eventos para los botones
  document.querySelectorAll('.editar-disciplina').forEach(btn => {
    btn.addEventListener('click', editarDisciplina);
  });
  
  document.querySelectorAll('.eliminar-disciplina').forEach(btn => {
    btn.addEventListener('click', eliminarDisciplina);
  });
  
  document.querySelectorAll('.guardar-clave').forEach(btn => {
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
    const nombreCodificado = encodeURIComponent(nombre).replace(/%20/g, '+');
    
    const res = await postData({
      tipo: 'nueva-disciplina',
      nombre: nombreCodificado,
      adminKey: ADMIN_KEY
    });

    if (res.status === 'ok') {
      input.value = '';
      // Recargar disciplinas para actualizar la tabla
      await cargarDisciplinas();
      mostrarMensaje('Disciplina agregada correctamente');
      input.focus();
    } else {
      throw new Error(res.message || 'Error desconocido');
    }
  } catch (error) {
    mostrarMensaje('Error: ' + error.message, 'error');
  }
}

async function editarDisciplina() {
  const disciplinaId = this.dataset.id;
  const disciplina = disciplinas.find(d => d.id == disciplinaId);
  
  if (!disciplina) return;

  const { value: nuevoNombre } = await Swal.fire({
    title: 'Editar Disciplina',
    input: 'text',
    inputValue: disciplina.nombre,
    showCancelButton: true,
    confirmButtonText: 'Guardar',
    cancelButtonText: 'Cancelar',
    inputValidator: (value) => {
      if (!value) {
        return 'Debe ingresar un nombre';
      }
    }
  });

  if (!nuevoNombre) return;
  
  try {
    const nombreCodificado = encodeURIComponent(nuevoNombre.trim()).replace(/%20/g, '+');
    
    const res = await postData({
      tipo: 'editar-disciplina',
      id: disciplinaId,
      nombre: nombreCodificado,
      adminKey: ADMIN_KEY
    });

    if (res.status === 'ok') {
      // Recargar disciplinas para actualizar la tabla
      await cargarDisciplinas();
      mostrarMensaje('Disciplina actualizada correctamente');
    } else {
      throw new Error(res.message || 'Error al actualizar');
    }
  } catch (error) {
    mostrarMensaje('Error: ' + error.message, 'error');
  }
}

async function eliminarDisciplina() {
  const disciplinaId = this.dataset.id;
  const disciplina = disciplinas.find(d => d.id == disciplinaId);
  
  if (!disciplina) return;

  const { isConfirmed } = await Swal.fire({
    title: '¿Eliminar disciplina?',
    text: `¿Está seguro de eliminar la disciplina "${disciplina.nombre}"?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar'
  });

  if (!isConfirmed) return;
  
  try {
    const res = await postData({
      tipo: 'eliminar-disciplina',
      id: disciplinaId,
      adminKey: ADMIN_KEY
    });

    if (res.status === 'ok') {
      // Recargar disciplinas para actualizar la tabla
      await cargarDisciplinas();
      mostrarMensaje('Disciplina eliminada correctamente');
    } else {
      throw new Error(res.message || 'Error al eliminar');
    }
  } catch (error) {
    mostrarMensaje('Error: ' + error.message, 'error');
  }
}

async function guardarClaveDisciplina() {
  const disciplinaId = this.dataset.id;
  const input = this.closest('td').querySelector('.clave-disciplina');
  if (!input) return;
  
  const clave = input.value.trim();

  try {
    // Intentar con diferentes nombres de operación
    const res = await postData({
      tipo: 'actualizarClaveDisciplina',
      id: disciplinaId,
      clave: clave,
      adminKey: ADMIN_KEY
    });

    if (res.status === 'ok') {
      // Recargar para mostrar el cambio en la tabla
      await cargarDisciplinas();
      mostrarMensaje('Clave actualizada correctamente');
    } else {
      // Intentar con otro nombre si falla
      const resAlt = await postData({
        tipo: 'update-clave-disciplina',
        id: disciplinaId,
        clave: clave,
        adminKey: ADMIN_KEY
      });

      if (resAlt.status === 'ok') {
        await cargarDisciplinas();
        mostrarMensaje('Clave actualizada correctamente');
      } else {
        throw new Error(resAlt.message || 'Error al actualizar clave');
      }
    }
  } catch (error) {
    mostrarMensaje('Error: ' + error.message, 'error');
  }
}

// Función para recargar la tabla manualmente
function recargarTabla() {
  cargarTablaDisciplinas();
}