document.addEventListener('DOMContentLoaded', async function() {
  if (!localStorage.getItem('adminKey')) {
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
});

let disciplinas = [];
let facultades = [];
let escuelas = [];
let atletas = [];

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
    <td class="p-4 font-medium">${atleta.nombre}</td>
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
      <td class="p-4 font-medium">${atleta.nombre}</td>
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
      adminKey: ADMIN_KEY
    });

    if (res.status === 'ok') {
      input.value = '';
      document.getElementById('select-disciplina-atleta').value = '';
      document.getElementById('select-facultad-atleta').value = '';
      document.getElementById('select-escuela-atleta').value = '';
      
      // Actualizar la lista local y la tabla
      const nuevoAtleta = {
        id: res.id || Date.now(),
        nombre: nombre,
        disciplinaId: disciplinaId,
        facultadId: facultadId,
        escuelaId: escuelaId
      };
      atletas.push(nuevoAtleta);
      actualizarContador();
      agregarFilaAtleta(nuevoAtleta);
      
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
  const atleta = atletas.find(a => a.id == atletaId);
  
  if (!atleta) return;

  if (typeof Swal === 'undefined') {
    const nuevoNombre = prompt('Editar nombre del atleta:', atleta.nombre);
    if (nuevoNombre === null || nuevoNombre.trim() === '') return;
    
    const disciplinaId = prompt('ID de disciplina:', atleta.disciplinaId);
    const facultadId = prompt('ID de facultad:', atleta.facultadId);
    const escuelaId = prompt('ID de escuela:', atleta.escuelaId);
    
    if (!nuevoNombre || !disciplinaId || !facultadId || !escuelaId) {
      mostrarMensaje('Complete todos los campos', 'error');
      return;
    }

    try {
      const res = await postData({
        tipo: 'editar-atleta',
        id: atletaId,
        nombre: nuevoNombre.trim(),
        disciplinaId: disciplinaId,
        facultadId: facultadId,
        escuelaId: escuelaId,
        adminKey: ADMIN_KEY
      });

      if (res.status === 'ok') {
        // Actualizar localmente
        const index = atletas.findIndex(a => a.id == atletaId);
        if (index !== -1) {
          atletas[index] = {
            ...atletas[index],
            nombre: nuevoNombre.trim(),
            disciplinaId: disciplinaId,
            facultadId: facultadId,
            escuelaId: escuelaId
          };
          actualizarFilaAtleta(atletaId);
        }
        mostrarMensaje('Atleta actualizado correctamente');
      } else {
        throw new Error(res.message || 'Error al actualizar');
      }
    } catch (error) {
      mostrarMensaje('Error: ' + error.message, 'error');
    }
    return;
  }

  const form = document.createElement('div');
  form.className = 'space-y-4';
  
  form.innerHTML += `
    <div>
      <label class="block text-gray-700 mb-2">Nombre</label>
      <input type="text" id="edit-atleta-nombre" value="${atleta.nombre}" 
        class="w-full px-4 py-2 border border-gray-300 rounded-lg">
    </div>
  `;
  
  let optionsDisciplinas = disciplinas.map(d => 
    `<option value="${d.id}" ${d.id == atleta.disciplinaId ? 'selected' : ''}>${d.nombre}</option>`
  ).join('');
  form.innerHTML += `
    <div>
      <label class="block text-gray-700 mb-2">Disciplina</label>
      <select id="edit-atleta-disciplina" class="w-full px-4 py-2 border border-gray-300 rounded-lg">
        <option value="">Seleccione disciplina</option>
        ${optionsDisciplinas}
      </select>
    </div>
  `;
  
  let optionsFacultades = facultades.map(f => 
    `<option value="${f.id}" ${f.id == atleta.facultadId ? 'selected' : ''}>${f.nombre}</option>`
  ).join('');
  form.innerHTML += `
    <div>
      <label class="block text-gray-700 mb-2">Facultad</label>
      <select id="edit-atleta-facultad" class="w-full px-4 py-2 border border-gray-300 rounded-lg">
        <option value="">Seleccione facultad</option>
        ${optionsFacultades}
      </select>
    </div>
  `;
  
  let optionsEscuelas = escuelas.map(e => 
    `<option value="${e.id}" ${e.id == atleta.escuelaId ? 'selected' : ''}>${e.nombre}</option>`
  ).join('');
  form.innerHTML += `
    <div>
      <label class="block text-gray-700 mb-2">Escuela</label>
      <select id="edit-atleta-escuela" class="w-full px-4 py-2 border border-gray-300 rounded-lg">
        <option value="">Seleccione escuela</option>
        ${optionsEscuelas}
      </select>
    </div>
  `;
  
  const { value: formValues } = await Swal.fire({
    title: 'Editar Atleta',
    html: form,
    focusConfirm: false,
    showCancelButton: true,
    preConfirm: () => {
      return {
        nombre: document.getElementById('edit-atleta-nombre').value,
        disciplinaId: document.getElementById('edit-atleta-disciplina').value,
        facultadId: document.getElementById('edit-atleta-facultad').value,
        escuelaId: document.getElementById('edit-atleta-escuela').value
      };
    }
  });

  if (!formValues) return;
  
  if (!formValues.nombre || !formValues.disciplinaId || !formValues.facultadId || !formValues.escuelaId) {
    mostrarMensaje('Complete todos los campos', 'error');
    return;
  }

  try {
    const res = await postData({
      tipo: 'editar-atleta',
      id: atletaId,
      nombre: formValues.nombre,
      disciplinaId: formValues.disciplinaId,
      facultadId: formValues.facultadId,
      escuelaId: formValues.escuelaId,
      adminKey: ADMIN_KEY
    });

    if (res.status === 'ok') {
      // Actualizar localmente
      const index = atletas.findIndex(a => a.id == atletaId);
      if (index !== -1) {
        atletas[index] = {
          ...atletas[index],
          nombre: formValues.nombre,
          disciplinaId: formValues.disciplinaId,
          facultadId: formValues.facultadId,
          escuelaId: formValues.escuelaId
        };
        actualizarFilaAtleta(atletaId);
      }
      mostrarMensaje('Atleta actualizado correctamente');
    } else {
      throw new Error(res.message || 'Error al actualizar');
    }
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
        actualizarContador();
        document.querySelector(`tr:has(button[data-id="${atletaId}"])`)?.remove();
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