document.addEventListener('DOMContentLoaded', async function() {
  if (!localStorage.getItem('adminKey')) {
    window.location.href = 'admin.html';
    return;
  }

  await Promise.all([cargarDisciplinas(), cargarIconos()]);
});

let disciplinas = [];
let iconosDisciplinas = [];

const ICONOS_DEPORTIVOS = {
  'Artes Marciales': [
    'fa-user-ninja',       // Ninja/karate
    'fa-hand-rock',        // Puño/martial arts
    'fa-khanda',           // Espadas/artes marciales
    'fa-shield-alt',       // Defensa personal
    'fa-fist-raised',      // Puño cerrado
    'fa-people-arrows',    // Combate
    'fa-swords'            // Esgrima/armas
  ],
  'Gimnasia': [
    'fa-ribbon',           // Cinta gimnasia rítmica
    'fa-ring',             // Aro
    'fa-star',             // Estrella (elementos gimnásticos)
    'fa-balance-scale',    // Equilibrio
    'fa-spa',              // Elegancia/movimiento
    'fa-dumbbell',         // Aparatos
    'fa-scroll',           // Cinta larga
    'fa-circle'            // Pelota
  ],
  'Deportes de Pelota': [
    'fa-futbol',           // Fútbol
    'fa-basketball-ball',  // Baloncesto
    'fa-volleyball-ball',  // Voleibol
    'fa-baseball-ball',    // Béisbol
    'fa-football-ball',    // Fútbol americano
    'fa-table-tennis',     // Tenis de mesa
    'fa-golf-ball',        // Golf
    'fa-hockey-puck'       // Hockey
  ],
  'Deportes Acuáticos': [
    'fa-swimmer',          // Natación
    'fa-water',            // Waterpolo
    'fa-sailboat',         // Vela
    'fa-ship',             // Remo
    'fa-umbrella-beach'    // Playa/vóley playa
  ],
  'Deportes de Invierno': [
    'fa-skiing',           // Esquí
    'fa-snowboarding',     // Snowboard
    'fa-skating',          // Patinaje sobre hielo
    'fa-icicles'           // Deportes en hielo
  ],
  'Deportes al Aire Libre': [
    'fa-biking',           // Ciclismo
    'fa-hiking',           // Senderismo
    'fa-running',          // Atletismo
    'fa-walking',          // Marcha
    'fa-mountain',         // Montañismo
    'fa-campground'        // Camping/deportes de aventura
  ],
  'Deportes Varios': [
    'fa-dumbbell',         // Halterofilia
    'fa-chess',            // Ajedrez
    'fa-archery',          // Tiro con arco
    'fa-bowling-ball',     // Bolos
    'fa-bullseye',         // Tiro al blanco
    'fa-medal',            // Medallas
    'fa-trophy',           // Trofeos
    'fa-award',            // Premios
    'fa-flag-checkered'    // Automovilismo
  ]
};

async function cargarDisciplinas() {
  try {
    const data = await fetchJSON({ tipo: 'getDisciplinas' });
    disciplinas = data.disciplinas || [];
    actualizarContador();
  } catch (error) {
    mostrarMensaje('Error al cargar disciplinas: ' + error.message, 'error');
  }
}

function actualizarContador() {
  const contador = document.getElementById('contador-iconos');
  if (contador) {
    contador.textContent = `${disciplinas.length} disciplinas`;
  }
}

async function cargarIconos() {
  try {
    const data = await fetchJSON({ tipo: 'getIconosDisciplinas' });
    iconosDisciplinas = data.iconos || [];
    cargarTablaIconos();
  } catch (error) {
    mostrarMensaje('Error al cargar íconos: ' + error.message, 'error');
  }
}

function cargarTablaIconos() {
  const tbody = document.getElementById('tabla-iconos-body');
  tbody.innerHTML = '';
  
  disciplinas.forEach(d => {
    const iconoActual = iconosDisciplinas.find(icono => icono.disciplinaId == d.id)?.icono || 'fa-trophy';
    
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50';
    tr.innerHTML = `
      <td class="p-4">${d.id}</td>
      <td class="p-4 font-medium">${d.nombre}</td>
      <td class="p-4 text-2xl"><i class="fas ${iconoActual}"></i></td>
      <td class="p-4">
        <select class="nuevo-icono border border-gray-300 rounded-lg p-2 w-full" data-id="${d.id}">
          ${generarOpcionesIconos(iconoActual)}
        </select>
      </td>
      <td class="p-4">
        <button class="guardar-icono bg-indigo-600 text-white font-medium py-2 px-4 rounded-lg hover:bg-indigo-700 transition-all" data-id="${d.id}">
          <i class="fas fa-save mr-2"></i>Guardar
        </button>
      </td>
    `;
    tbody.appendChild(tr);
    
    const select = tr.querySelector('.nuevo-icono');
    select.addEventListener('change', function() {
      const iconoSeleccionado = this.value;
      const iconoActualCell = this.closest('tr').querySelector('td:nth-child(3)');
      iconoActualCell.innerHTML = `<i class="fas ${iconoSeleccionado}"></i>`;
    });
    
    tr.querySelector('.guardar-icono').addEventListener('click', function() {
      const disciplinaId = this.dataset.id;
      const select = document.querySelector(`.nuevo-icono[data-id="${disciplinaId}"]`);
      guardarIconoDisciplina(disciplinaId, select.value.trim());
    });
  });
}

function generarOpcionesIconos(iconoSeleccionado) {
  let opciones = '<option value="">Seleccione un ícono</option>';
  
  for (const [categoria, iconos] of Object.entries(ICONOS_DEPORTIVOS)) {
    opciones += `<optgroup label="${categoria}">`;
    iconos.forEach(icono => {
      const selected = icono === iconoSeleccionado ? 'selected' : '';
      const nombreIcono = icono.replace('fa-', '').replace(/-/g, ' ');
      opciones += `<option value="${icono}" ${selected}>${nombreIcono}</option>`;
    });
    opciones += `</optgroup>`;
  }

  return opciones;
}

async function guardarIconoDisciplina(disciplinaId, icono) {
  if (!icono) {
    mostrarMensaje('Seleccione un ícono válido', 'error');
    return;
  }

  try {
    const res = await postData({
      tipo: 'actualizarIconoDisciplina',
      id: disciplinaId,
      icono: icono,
      adminKey: ADMIN_KEY
    });
    
    if (res.status === 'ok') {
      localStorage.removeItem(CACHE_KEY_ICONOS);
      
      // Actualizar el array local
      const index = iconosDisciplinas.findIndex(i => i.disciplinaId == disciplinaId);
      if (index !== -1) {
        iconosDisciplinas[index].icono = icono;
      } else {
        iconosDisciplinas.push({
          disciplinaId: disciplinaId,
          icono: icono
        });
      }
      
      mostrarMensaje('Ícono actualizado correctamente');
      return true;
    } else {
      throw new Error(res.message || 'Error al actualizar ícono');
    }
  } catch (error) {
    mostrarMensaje('Error: ' + error.message, 'error');
    return false;
  }
}