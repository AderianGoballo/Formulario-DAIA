document.addEventListener('DOMContentLoaded', async function() {
  if (!localStorage.getItem('adminKey')) {
    window.location.href = 'admin.html';
    return;
  }

  await cargarFacultades();
  
  document.getElementById('btn-agregar-facultad').addEventListener('click', agregarFacultad);
});

let facultades = [];

async function cargarFacultades() {
  try {
    // Limpiar caché para forzar la recarga de datos
    localStorage.removeItem(CACHE_KEY_FACULTADES);
    
    // Usar timestamp para evitar caché
    const timestamp = new Date().getTime();
    const data = await fetchJSON({ 
      tipo: 'getFacultades',
      cache: timestamp
    });
    
    // Procesar datos y decodificar nombres
    facultades = (data.facultades || []).map(f => ({
      ...f,
      nombre: decodeURIComponent(f.nombre.replace(/\+/g, ' '))
    }));
    
    actualizarContador();
    cargarTablaFacultades();
  } catch (error) {
    mostrarMensaje('Error al cargar facultades: ' + error.message, 'error');
  }
}

function actualizarContador() {
  const contador = document.getElementById('contador-facultades');
  if (contador) {
    contador.textContent = `${facultades.length} registros`;
  }
}

function cargarTablaFacultades() {
  const tbody = document.getElementById('tabla-facultades-body');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  facultades.forEach(f => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50';
    tr.innerHTML = `
      <td class="p-4">${f.id}</td>
      <td class="p-4 font-medium">${f.nombre}</td>
      <td class="p-4">
        <div class="flex gap-2">
          <button class="editar-facultad text-green-600 hover:text-green-800" data-id="${f.id}">
            <i class="fas fa-edit"></i>
          </button>
          <button class="eliminar-facultad text-red-600 hover:text-red-800" data-id="${f.id}">
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
  document.querySelectorAll('.editar-facultad').forEach(btn => {
    btn.addEventListener('click', editarFacultad);
  });
  
  document.querySelectorAll('.eliminar-facultad').forEach(btn => {
    btn.addEventListener('click', eliminarFacultad);
  });
}

async function agregarFacultad() {
  const input = document.getElementById('input-nueva-facultad');
  if (!input) return;
  
  const nombre = input.value.trim();

  if (!nombre) {
    mostrarMensaje('Ingrese un nombre válido', 'error');
    input.focus();
    return;
  }

  try {
    // Codificar espacios correctamente
    const nombreCodificado = encodeURIComponent(nombre).replace(/%20/g, '+');
    
    const res = await postData({
      tipo: 'nueva-facultad',
      nombre: nombreCodificado,
      adminKey: ADMIN_KEY
    });

    if (res.status === 'ok') {
      input.value = '';
      // Recargar facultades para actualizar la tabla
      await cargarFacultades();
      mostrarMensaje('Facultad agregada correctamente');
      input.focus();
    } else {
      throw new Error(res.message || 'Error desconocido');
    }
  } catch (error) {
    mostrarMensaje('Error: ' + error.message, 'error');
  }
}

async function editarFacultad() {
  const facultadId = this.dataset.id;
  const facultad = facultades.find(f => f.id == facultadId);
  
  if (!facultad) return;

  // Verificar si Swal está disponible
  if (typeof Swal === 'undefined') {
    // Fallback a prompt nativo
    const nuevoNombre = prompt('Editar facultad:', facultad.nombre);
    if (nuevoNombre === null || nuevoNombre.trim() === '') return;
    await guardarCambiosFacultad(facultadId, nuevoNombre.trim());
    return;
  }

  const { value: nuevoNombre } = await Swal.fire({
    title: 'Editar Facultad',
    input: 'text',
    inputValue: facultad.nombre,
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
  await guardarCambiosFacultad(facultadId, nuevoNombre.trim());
}

async function guardarCambiosFacultad(facultadId, nuevoNombre) {
  try {
    // Codificar espacios correctamente
    const nombreCodificado = encodeURIComponent(nuevoNombre).replace(/%20/g, '+');
    
    const res = await postData({
      tipo: 'editar-facultad',
      id: facultadId,
      nombre: nombreCodificado,
      adminKey: ADMIN_KEY
    });

    if (res.status === 'ok') {
      // Recargar facultades para actualizar la tabla
      await cargarFacultades();
      mostrarMensaje('Facultad actualizada correctamente');
    } else {
      throw new Error(res.message || 'Error al actualizar');
    }
  } catch (error) {
    mostrarMensaje('Error: ' + error.message, 'error');
  }
}

async function eliminarFacultad() {
  const facultadId = this.dataset.id;
  const facultad = facultades.find(f => f.id == facultadId);
  
  if (!facultad) return;

  // Verificar si Swal está disponible
  if (typeof Swal === 'undefined') {
    // Fallback a confirm nativo
    const confirmar = confirm(`¿Eliminar facultad "${facultad.nombre}"?`);
    if (confirmar) {
      await eliminarFacultadConfirmada(facultadId);
    }
    return;
  }

  const { isConfirmed } = await Swal.fire({
    title: '¿Eliminar facultad?',
    text: `¿Está seguro de eliminar la facultad "${facultad.nombre}"?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar'
  });

  if (isConfirmed) {
    await eliminarFacultadConfirmada(facultadId);
  }
}

async function eliminarFacultadConfirmada(facultadId) {
  try {
    const res = await postData({
      tipo: 'eliminar-facultad',
      id: facultadId,
      adminKey: ADMIN_KEY
    });

    if (res.status === 'ok') {
      // Recargar facultades para actualizar la tabla
      await cargarFacultades();
      mostrarMensaje('Facultad eliminada correctamente');
    } else {
      throw new Error(res.message || 'Error al eliminar');
    }
  } catch (error) {
    mostrarMensaje('Error: ' + error.message, 'error');
  }
}