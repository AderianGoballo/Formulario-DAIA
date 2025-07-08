document.addEventListener('DOMContentLoaded', async function() {
  if (!localStorage.getItem('adminKey')) {
    window.location.href = 'admin.html';
    return;
  }

  await Promise.all([cargarFacultades(), cargarEscuelas()]);
  
  const btnAgregar = document.getElementById('btn-agregar-escuela');
  if (btnAgregar) {
    btnAgregar.addEventListener('click', agregarEscuela);
  }
});

let facultades = [];
let escuelas = [];

async function cargarFacultades() {
  try {
    localStorage.removeItem(CACHE_KEY_FACULTADES);
    
    const timestamp = new Date().getTime();
    const data = await fetchJSON({ 
      tipo: 'getFacultades',
      cache: timestamp
    });
    
    facultades = (data.facultades || []).map(f => ({
      ...f,
      nombre: decodeURIComponent(String(f.nombre || "").replace(/\+/g, ' '))
    }));
    
    llenarSelectFacultades();
  } catch (error) {
    mostrarMensaje('Error al cargar facultades: ' + error.message, 'error');
  }
}

async function cargarEscuelas() {
  try {
    localStorage.removeItem(CACHE_KEY_ESCUELAS);
    
    const timestamp = new Date().getTime();
    const data = await fetchJSON({ 
      tipo: 'getEscuelas',
      cache: timestamp
    });
    
    // CORRECCIÓN: Asegurar que nombre sea string
    escuelas = (data.escuelas || []).map(e => ({
      ...e,
      nombre: decodeURIComponent(String(e.nombre || "").replace(/\+/g, ' '))
    }));
    
    actualizarContador();
    cargarTablaEscuelas();
  } catch (error) {
    mostrarMensaje('Error al cargar escuelas: ' + error.message, 'error');
  }
}

function actualizarContador() {
  const contador = document.getElementById('contador-escuelas');
  if (!contador) return;
  
  contador.textContent = `${escuelas.length} registros`;
}

function llenarSelectFacultades() {
  const select = document.getElementById('select-facultad-escuela');
  if (!select) return;
  
  select.innerHTML = '<option value="">Seleccione facultad</option>';
  facultades.forEach(f => {
    const option = document.createElement('option');
    option.value = f.id;
    option.textContent = f.nombre;
    select.appendChild(option);
  });
}

function cargarTablaEscuelas() {
  const tbody = document.getElementById('tabla-escuelas-body');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  escuelas.forEach(e => {
    const facultad = facultades.find(f => f.id == e.facultadId) || { nombre: 'Desconocido' };
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50';
    tr.innerHTML = `
      <td class="p-4">${e.id}</td>
      <td class="p-4 font-medium">${e.nombre}</td>
      <td class="p-4">${facultad.nombre}</td>
      <td class="p-4">
        <div class="flex gap-2">
          <button class="editar-escuela text-yellow-600 hover:text-yellow-800" data-id="${e.id}">
            <i class="fas fa-edit"></i>
          </button>
          <button class="eliminar-escuela text-red-600 hover:text-red-800" data-id="${e.id}">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  configurarEventosTabla();
}

function configurarEventosTabla() {
  document.querySelectorAll('.editar-escuela').forEach(btn => {
    btn.addEventListener('click', editarEscuela);
  });
  
  document.querySelectorAll('.eliminar-escuela').forEach(btn => {
    btn.addEventListener('click', eliminarEscuela);
  });
}

async function agregarEscuela() {
  const input = document.getElementById('input-nueva-escuela');
  const select = document.getElementById('select-facultad-escuela');
  
  if (!input || !select) return;
  
  const nombre = input.value.trim();
  const facultadId = select.value;

  if (!nombre) {
    mostrarMensaje('Ingrese un nombre válido', 'error');
    input.focus();
    return;
  }

  if (!facultadId) {
    mostrarMensaje('Seleccione una facultad', 'error');
    select.focus();
    return;
  }

  try {
    const nombreCodificado = encodeURIComponent(nombre).replace(/%20/g, '+');
    
    const res = await postData({
      tipo: 'nueva-escuela',
      nombre: nombreCodificado,
      facultadId: facultadId,
      adminKey: ADMIN_KEY
    });

    if (res.status === 'ok') {
      input.value = '';
      select.value = '';
      await cargarEscuelas();
      mostrarMensaje('Escuela agregada correctamente');
      input.focus();
    } else {
      throw new Error(res.message || 'Error desconocido');
    }
  } catch (error) {
    mostrarMensaje('Error: ' + error.message, 'error');
  }
}

async function editarEscuela() {
  const escuelaId = this.dataset.id;
  const escuela = escuelas.find(e => e.id == escuelaId);
  
  if (!escuela) return;

  const facultadActual = facultades.find(f => f.id == escuela.facultadId) || { nombre: 'Desconocido' };
  
  const form = document.createElement('div');
  form.className = 'space-y-4';
  
  form.innerHTML += `
    <div>
      <label class="block text-gray-700 mb-2">Nombre</label>
      <input type="text" id="edit-escuela-nombre" value="${escuela.nombre}" 
        class="w-full px-4 py-2 border border-gray-300 rounded-lg">
    </div>
  `;
  
  let optionsFacultades = facultades.map(f => 
    `<option value="${f.id}" ${f.id == escuela.facultadId ? 'selected' : ''}>${f.nombre}</option>`
  ).join('');
  form.innerHTML += `
    <div>
      <label class="block text-gray-700 mb-2">Facultad</label>
      <select id="edit-escuela-facultad" class="w-full px-4 py-2 border border-gray-300 rounded-lg">
        <option value="">Seleccione facultad</option>
        ${optionsFacultades}
      </select>
    </div>
  `;
  
  if (typeof Swal === 'undefined') {
    const nuevoNombre = prompt('Editar escuela:', escuela.nombre);
    if (nuevoNombre === null || nuevoNombre.trim() === '') return;
    
    const nuevaFacultadId = escuela.facultadId;
    await guardarCambiosEscuela(escuelaId, nuevoNombre.trim(), nuevaFacultadId);
    return;
  }

  const { value: formValues } = await Swal.fire({
    title: 'Editar Escuela',
    html: form,
    focusConfirm: false,
    showCancelButton: true,
    preConfirm: () => {
      const nombreInput = document.getElementById('edit-escuela-nombre');
      const facultadSelect = document.getElementById('edit-escuela-facultad');
      
      if (!nombreInput || !facultadSelect) return null;
      
      return {
        nombre: nombreInput.value,
        facultadId: facultadSelect.value
      };
    }
  });

  if (!formValues) return;
  
  if (!formValues.nombre || !formValues.facultadId) {
    mostrarMensaje('Complete todos los campos', 'error');
    return;
  }

  await guardarCambiosEscuela(escuelaId, formValues.nombre, formValues.facultadId);
}

async function guardarCambiosEscuela(escuelaId, nuevoNombre, facultadId) {
  try {
    const nombreCodificado = encodeURIComponent(nuevoNombre).replace(/%20/g, '+');
    
    const res = await postData({
      tipo: 'editar-escuela',
      id: escuelaId,
      nombre: nombreCodificado,
      facultadId: facultadId,
      adminKey: ADMIN_KEY
    });

    if (res.status === 'ok') {
      await cargarEscuelas();
      mostrarMensaje('Escuela actualizada correctamente');
    } else {
      throw new Error(res.message || 'Error al actualizar');
    }
  } catch (error) {
    mostrarMensaje('Error: ' + error.message, 'error');
  }
}

async function eliminarEscuela() {
  const escuelaId = this.dataset.id;
  const escuela = escuelas.find(e => e.id == escuelaId);
  
  if (!escuela) return;

  if (typeof Swal === 'undefined') {
    const confirmar = confirm(`¿Eliminar escuela "${escuela.nombre}"?`);
    if (confirmar) {
      await eliminarEscuelaConfirmada(escuelaId);
    }
    return;
  }

  const { isConfirmed } = await Swal.fire({
    title: '¿Eliminar escuela?',
    text: `¿Está seguro de eliminar la escuela "${escuela.nombre}"?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar'
  });

  if (isConfirmed) {
    await eliminarEscuelaConfirmada(escuelaId);
  }
}

async function eliminarEscuelaConfirmada(escuelaId) {
  try {
    const res = await postData({
      tipo: 'eliminar-escuela',
      id: escuelaId,
      adminKey: ADMIN_KEY
    });

    if (res.status === 'ok') {
      await cargarEscuelas();
      mostrarMensaje('Escuela eliminada correctamente');
    } else {
      throw new Error(res.message || 'Error al eliminar');
    }
  } catch (error) {
    mostrarMensaje('Error: ' + error.message, 'error');
  }
}