document.addEventListener('DOMContentLoaded', function () {
  const boton = document.getElementById('btn-cambiar-clave');
  if (boton) boton.addEventListener('click', cambiarClave);
});

async function cambiarClave() {
  const campoActual = document.getElementById('clave-actual');
  const campoNueva = document.getElementById('nueva-clave');
  const campoConfirmar = document.getElementById('confirmar-clave');

  const claveActual = (campoActual.value || '').trim();
  const nuevaClave = (campoNueva.value || '').trim();
  const confirmarClave = (campoConfirmar.value || '').trim();

  if (!claveActual || !nuevaClave || !confirmarClave) {
    mostrarMensaje('Por favor complete todos los campos', 'error');
    return;
  }

  if (nuevaClave !== confirmarClave) {
    mostrarMensaje('Las nuevas claves no coinciden', 'error');
    return;
  }

  if (nuevaClave.length < 6) {
    mostrarMensaje('La nueva clave debe tener al menos 6 caracteres', 'error');
    return;
  }

  if (nuevaClave === claveActual) {
    mostrarMensaje('La nueva clave debe ser diferente a la actual', 'error');
    return;
  }

  const boton = document.getElementById('btn-cambiar-clave');
  const textoOriginal = boton ? boton.innerHTML : '';

  if (boton) {
    boton.disabled = true;
    boton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Guardando...';
  }

  try {
    // El cambio ocurre en el servidor (Propiedades del script), no en el navegador
    const res = await postData({
      tipo: 'cambiarClaveAdmin',
      claveActual: claveActual,
      nuevaClave: nuevaClave
    });

    if (res.status !== 'ok') {
      throw new Error(res.message || 'No se pudo cambiar la clave');
    }

    // La sesión de esta pestaña pasa a usar la nueva clave
    guardarSesion(nuevaClave);

    campoActual.value = '';
    campoNueva.value = '';
    campoConfirmar.value = '';

    mostrarMensaje('Clave cambiada correctamente');
  } catch (error) {
    mostrarMensaje('Error: ' + error.message, 'error');
  } finally {
    if (boton) {
      boton.disabled = false;
      boton.innerHTML = textoOriginal;
    }
  }
}
