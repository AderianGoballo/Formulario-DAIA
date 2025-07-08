document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('btn-cambiar-clave').addEventListener('click', cambiarClave);
});

async function cambiarClave() {
  const claveActual = document.getElementById('clave-actual').value;
  const nuevaClave = document.getElementById('nueva-clave').value;
  const confirmarClave = document.getElementById('confirmar-clave').value;
  
  if (!claveActual || !nuevaClave || !confirmarClave) {
    mostrarMensaje('Por favor complete todos los campos', 'error');
    return;
  }
  
  if (claveActual !== ADMIN_KEY) {
    mostrarMensaje('La clave actual no es correcta', 'error');
    return;
  }
  
  if (nuevaClave !== confirmarClave) {
    mostrarMensaje('Las nuevas claves no coinciden', 'error');
    return;
  }
  
  if (nuevaClave === ADMIN_KEY) {
    mostrarMensaje('La nueva clave debe ser diferente a la actual', 'error');
    return;
  }
  
  try {
    ADMIN_KEY = nuevaClave;
    localStorage.setItem('adminKey', nuevaClave);
    
    document.getElementById('clave-actual').value = '';
    document.getElementById('nueva-clave').value = '';
    document.getElementById('confirmar-clave').value = '';
    
    mostrarMensaje('Clave cambiada correctamente');
  } catch (error) {
    mostrarMensaje('Error al cambiar la clave: ' + error.message, 'error');
  }
}