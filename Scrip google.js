/**
 * DAIA — Backend (Google Apps Script)
 *
 * Despliegue: Extensiones -> Apps Script en la hoja, pegar este archivo,
 * Implementar -> Nueva implementación -> Aplicación web
 *   - Ejecutar como: Yo
 *   - Quién tiene acceso: Cualquier usuario
 *
 * ANTES DE USARLO, configura la clave de administrador:
 *   Configuración del proyecto -> Propiedades del script -> Añadir:
 *   ADMIN_KEY = <tu clave larga y única>
 *
 * Nunca dejes la clave escrita en este archivo: es un repositorio público.
 */

var SPREADSHEET_ID = '1K8qGO46yhwpM_qTupQfGW9TNnazmU3Y4N8Wt-QfWB5c';

var HOJAS = {
  DISCIPLINAS: 'Disciplinas',
  ATLETAS: 'Atletas',
  RESPUESTAS: 'Respuestas',
  FACULTADES: 'Facultades',
  ESCUELAS: 'Escuelas',
  ICONOS: 'IconosDisciplinas'
};

var CACHE_TTL = 300;               // 5 minutos
var TOKEN_TTL = 6 * 60 * 60;       // 6 horas
var PROPIEDAD_CLAVE_ADMIN = 'ADMIN_KEY';
var LONGITUD_MINIMA_CLAVE = 6;

/* =====================================================================
 * Utilidades
 * ===================================================================== */

function responderJSON_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function error_(mensaje, codigo) {
  var r = { status: 'error', message: mensaje || 'Error desconocido' };
  if (codigo) r.code = codigo;
  return r;
}

function hoja_(nombre) {
  var hoja = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(nombre);
  if (!hoja) throw new Error('No existe la hoja "' + nombre + '" en la base de datos');
  return hoja;
}

function filas_(nombre) {
  return hoja_(nombre).getDataRange().getValues().slice(1);
}

/**
 * Los nombres se guardaron históricamente con doble codificación
 * ("F%C3%BAtbol"). Esto los devuelve legibles sin romper datos correctos.
 */
function normalizar_(valor) {
  if (valor === null || valor === undefined) return '';
  var texto = String(valor).trim();
  if (/%[0-9A-Fa-f]{2}/.test(texto)) {
    try {
      texto = decodeURIComponent(texto.replace(/\+/g, ' '));
    } catch (e) {
      /* si no es una secuencia válida, se deja tal cual */
    }
  }
  return texto.replace(/\s+/g, ' ').trim();
}

/**
 * Clave de comparación: sin tildes, sin mayúsculas y sin espacios extra.
 */
function clave_(texto) {
  return normalizar_(texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function claveAdminConfigurada_() {
  try {
    return PropertiesService.getScriptProperties().getProperty(PROPIEDAD_CLAVE_ADMIN) || '';
  } catch (e) {
    return '';
  }
}

function esAdmin_(clave) {
  var real = claveAdminConfigurada_();
  if (!real) return false;
  return clave === real;
}

function invalidarCache_() {
  try {
    CacheService.getScriptCache().removeAll([
      'disciplinas', 'disciplinas_v2', 'facultades', 'escuelas', 'iconos', 'atletas'
    ]);
  } catch (e) {
    /* la caché es opcional */
  }
}

function cacheGet_(clave) {
  try {
    var datos = CacheService.getScriptCache().get(clave);
    return datos ? JSON.parse(datos) : null;
  } catch (e) {
    return null;
  }
}

function cachePut_(clave, valor) {
  try {
    CacheService.getScriptCache().put(clave, JSON.stringify(valor), CACHE_TTL);
  } catch (e) {
    /* la caché es opcional */
  }
}

function nuevoToken_() {
  if (typeof Utilities !== 'undefined' && Utilities.getUuid) return Utilities.getUuid();
  return 'tok-' + Date.now() + '-' + Math.random().toString(36).slice(2);
}

/* =====================================================================
 * Entrada HTTP
 * ===================================================================== */

function doOptions() {
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT);
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  var tipo = p.tipo || '';

  try {
    switch (tipo) {
      case 'getDisciplinas':
        return responderJSON_(getDisciplinas());

      case 'getFacultades':
        return responderJSON_(getFacultades());

      case 'getEscuelas':
        return responderJSON_(getEscuelas());

      case 'getAtletas':
        return responderJSON_(getAtletas(p.disciplinaId, p.token, p.adminKey));

      case 'buscarAtleta':
        return responderJSON_(buscarAtleta(p.q));

      case 'getAtleta':
        return responderJSON_(getAtleta(p.id));

      case 'verificarAccesoDisciplina':
        return responderJSON_(verificarAccesoDisciplina(p.disciplinaId, p.clave));

      case 'verificarAdmin':
        return responderJSON_(verificarAdmin(p.clave));

      case 'getDisciplinasAdmin':
        return responderJSON_(getDisciplinasAdmin(p.adminKey));

      case 'getIconosDisciplinas':
        return responderJSON_(getIconosDisciplinas());

      default:
        return responderJSON_(error_('Parámetro GET "tipo" inválido o ausente'));
    }
  } catch (err) {
    return responderJSON_(error_(err.message));
  }
}

function doPost(e) {
  var datos = {};

  try {
    if (e && e.parameter && Object.keys(e.parameter).length > 0) {
      // Apps Script ya decodifica los formularios urlencoded en e.parameter
      datos = e.parameter;
    } else if (e && e.postData) {
      if (/application\/json/i.test(e.postData.type || '')) {
        datos = JSON.parse(e.postData.contents);
      } else {
        datos = {};
        String(e.postData.contents || '').split('&').forEach(function (par) {
          if (!par) return;
          var i = par.indexOf('=');
          var k = i === -1 ? par : par.slice(0, i);
          var v = i === -1 ? '' : par.slice(i + 1);
          datos[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '));
        });
      }
    }
  } catch (err) {
    return responderJSON_(error_('Error procesando los datos: ' + err.message));
  }

  var tipo = datos.tipo || '';

  try {
    // Respuesta de un atleta: requiere token de su disciplina
    if (tipo === 'respuesta') {
      return responderJSON_(guardarRespuesta(datos));
    }

    // Inicio de sesión del administrador
    if (tipo === 'verificarAdmin') {
      return responderJSON_(verificarAdmin(datos.clave));
    }

    if (!esAdmin_(datos.adminKey)) {
      return responderJSON_(error_('Acceso no autorizado. Clave admin inválida.', 'unauthorized'));
    }

    var respuesta;

    switch (tipo) {
      case 'cambiarClaveAdmin':
        respuesta = cambiarClaveAdmin(datos.claveActual, datos.nuevaClave);
        break;
      case 'nueva-disciplina':
        respuesta = agregarDisciplina(datos.nombre);
        break;
      case 'editar-disciplina':
        respuesta = editarDisciplina(datos.id, datos.nombre);
        break;
      case 'eliminar-disciplina':
        respuesta = eliminarDisciplina(datos.id);
        break;
      case 'nuevo-atleta':
        respuesta = agregarAtleta(datos.nombre, datos.disciplinaId, datos.facultadId, datos.escuelaId,
          datos.cedula, datos.anioIngreso, datos.carrera);
        break;
      case 'editar-atleta':
        respuesta = editarAtleta(datos.id, datos.nombre, datos.disciplinaId, datos.facultadId, datos.escuelaId,
          datos.cedula, datos.anioIngreso, datos.carrera);
        break;
      case 'eliminar-atleta':
        respuesta = eliminarAtleta(datos.id);
        break;
      case 'nueva-facultad':
        respuesta = agregarFacultad(datos.nombre);
        break;
      case 'editar-facultad':
        respuesta = editarFacultad(datos.id, datos.nombre);
        break;
      case 'eliminar-facultad':
        respuesta = eliminarFacultad(datos.id);
        break;
      case 'nueva-escuela':
        respuesta = agregarEscuela(datos.nombre, datos.facultadId);
        break;
      case 'editar-escuela':
        respuesta = editarEscuela(datos.id, datos.nombre, datos.facultadId);
        break;
      case 'eliminar-escuela':
        respuesta = eliminarEscuela(datos.id);
        break;
      case 'actualizarClaveDisciplina':
        respuesta = actualizarClaveDisciplina(datos.id, datos.clave);
        break;
      case 'actualizarIconoDisciplina':
        respuesta = actualizarIconoDisciplina(datos.id, datos.icono);
        break;
      default:
        respuesta = error_('Operación no soportada: ' + (tipo || 'ninguna'));
    }

    if (respuesta && respuesta.status === 'ok') {
      invalidarCache_();
    }

    return responderJSON_(respuesta);
  } catch (err) {
    return responderJSON_(error_('Error procesando la solicitud: ' + err.message));
  }
}

/* =====================================================================
 * Autenticación
 * ===================================================================== */

function verificarAdmin(clave) {
  if (!claveAdminConfigurada_()) {
    return error_('El administrador aún no configuró ADMIN_KEY en las propiedades del script.');
  }
  if (!clave) return error_('Clave requerida');
  return esAdmin_(clave) ? { status: 'ok' } : error_('Clave incorrecta');
}

function cambiarClaveAdmin(claveActual, nuevaClave) {
  if (!esAdmin_(claveActual)) return error_('La clave actual no es correcta');

  var nueva = String(nuevaClave || '').trim();
  if (nueva.length < LONGITUD_MINIMA_CLAVE) {
    return error_('La nueva clave debe tener al menos ' + LONGITUD_MINIMA_CLAVE + ' caracteres');
  }
  if (nueva === claveActual) {
    return error_('La nueva clave debe ser distinta de la actual');
  }

  PropertiesService.getScriptProperties().setProperty(PROPIEDAD_CLAVE_ADMIN, nueva);
  return { status: 'ok' };
}

function verificarAccesoDisciplina(disciplinaId, clave) {
  if (!disciplinaId) return error_('Disciplina no especificada');

  var filas = filas_(HOJAS.DISCIPLINAS);
  for (var i = 0; i < filas.length; i++) {
    if (String(filas[i][0]) === String(disciplinaId)) {
      var esperada = normalizar_(filas[i][2]);
      if (esperada && String(clave || '').trim() === esperada) {
        var token = nuevoToken_();
        try {
          CacheService.getScriptCache().put('tok_' + token, String(disciplinaId), TOKEN_TTL);
        } catch (e) {
          return error_('No se pudo crear la sesión de acceso');
        }
        return {
          status: 'ok',
          token: token,
          disciplina: normalizar_(filas[i][1])
        };
      }
      return error_('Clave incorrecta');
    }
  }
  return error_('Disciplina no encontrada');
}

function tokenValidoPara_(token, disciplinaId) {
  if (!token) return false;
  try {
    var guardado = CacheService.getScriptCache().get('tok_' + token);
    if (!guardado) return false;
    return String(guardado) === String(disciplinaId);
  } catch (e) {
    return false;
  }
}

/* =====================================================================
 * Lecturas
 * ===================================================================== */

function getDisciplinas() {
  var cache = cacheGet_('disciplinas_v2');
  if (cache) return cache;

  var iconos = mapaIconos_();
  var disciplinas = filas_(HOJAS.DISCIPLINAS).map(function (r) {
    return {
      id: r[0],
      nombre: normalizar_(r[1]),
      icono: iconos[String(r[0])] || 'fa-trophy',
      requiereClave: normalizar_(r[2]) !== ''
    };
  });

  var resultado = { status: 'ok', disciplinas: disciplinas };
  cachePut_('disciplinas_v2', resultado);
  return resultado;
}

/** Solo para el panel: incluye la clave de cada disciplina. */
function getDisciplinasAdmin(adminKey) {
  if (!esAdmin_(adminKey)) return error_('Acceso no autorizado', 'unauthorized');

  var disciplinas = filas_(HOJAS.DISCIPLINAS).map(function (r) {
    return {
      id: r[0],
      nombre: normalizar_(r[1]),
      clave: normalizar_(r[2])
    };
  });

  return { status: 'ok', disciplinas: disciplinas };
}

function getFacultades() {
  var cache = cacheGet_('facultades');
  if (cache) return cache;

  var resultado = {
    status: 'ok',
    facultades: filas_(HOJAS.FACULTADES).map(function (r) {
      return { id: r[0], nombre: normalizar_(r[1]) };
    })
  };

  cachePut_('facultades', resultado);
  return resultado;
}

function getEscuelas() {
  var cache = cacheGet_('escuelas');
  if (cache) return cache;

  var resultado = {
    status: 'ok',
    escuelas: filas_(HOJAS.ESCUELAS).map(function (r) {
      return { id: r[0], nombre: normalizar_(r[1]), facultadId: r[2] };
    })
  };

  cachePut_('escuelas', resultado);
  return resultado;
}

function mapaIconos_() {
  var hoja = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(HOJAS.ICONOS);
  var mapa = {};
  if (!hoja) return mapa;

  var datos = hoja.getDataRange().getValues();
  if (!datos.length) return mapa;

  var cabeceras = datos[0].map(function (h) { return String(h).trim().toLowerCase(); });
  var colId = cabeceras.indexOf('disciplinaid');
  var colIcono = cabeceras.indexOf('icono');
  if (colId === -1 || colIcono === -1) return mapa;

  for (var i = 1; i < datos.length; i++) {
    var id = datos[i][colId];
    if (id !== '' && id !== null && id !== undefined) {
      mapa[String(id)] = String(datos[i][colIcono] || '').trim() || 'fa-trophy';
    }
  }
  return mapa;
}

function getIconosDisciplinas() {
  var cache = cacheGet_('iconos');
  if (cache) return cache;

  var mapa = mapaIconos_();
  var resultado = {
    status: 'ok',
    iconos: Object.keys(mapa).map(function (id) {
      return { disciplinaId: id, icono: mapa[id] };
    })
  };

  cachePut_('iconos', resultado);
  return resultado;
}

/**
 * Atletas de una disciplina.
 * Autoriza con el token de la disciplina o con la clave de administrador.
 */
function getAtletas(disciplinaId, token, adminKey) {
  if (!esAdmin_(adminKey) && !tokenValidoPara_(token, disciplinaId)) {
    return error_('Acceso no autorizado. Vuelve a introducir la clave de la disciplina.', 'unauthorized');
  }

  var atletasData = filas_(HOJAS.ATLETAS);
  var respuestas = filas_(HOJAS.RESPUESTAS);

  var porId = {};
  var porNombreSinId = {};

  respuestas.forEach(function (r) {
    var fecha = r[0];
    var nombre = normalizar_(r[1]).toLowerCase();
    var id = r[13];

    if (id !== '' && id !== null && id !== undefined) {
      if (!porId[String(id)] || fecha > porId[String(id)]) porId[String(id)] = fecha;
    } else if (nombre) {
      // Solo las respuestas antiguas sin ID obligan a comparar por nombre
      if (!porNombreSinId[nombre] || fecha > porNombreSinId[nombre]) porNombreSinId[nombre] = fecha;
    }
  });

  var lista = atletasData
    .filter(function (r) {
      return !disciplinaId || String(r[2]) === String(disciplinaId);
    })
    .map(function (r) {
      var id = r[0];
      var nombre = normalizar_(r[1]);

      var fechaEvaluacion = null;
      if (id !== '' && id !== null && id !== undefined) {
        fechaEvaluacion = porId[String(id)] || null;
      } else {
        fechaEvaluacion = porNombreSinId[nombre.toLowerCase()] || null;
      }

      return {
        id: id,
        nombre: nombre,
        disciplinaId: r[2],
        facultadId: r[3],
        escuelaId: r[4],
        cedula: String(r[5] || '').replace(/\D/g, ''),
        anioIngreso: r[6] || '',
        carrera: normalizar_(r[7]),
        respondido: !!fechaEvaluacion,
        fechaEvaluacion: fechaEvaluacion ? formatearFecha_(fechaEvaluacion) : null
      };
    });

  return { status: 'ok', atletas: lista };
}

/* =====================================================================
 * Consulta pública: búsqueda y ficha
 * ===================================================================== */

function mapaNombres_(hoja) {
  var mapa = {};
  filas_(hoja).forEach(function (r) {
    if (r[0] !== '' && r[0] !== null && r[0] !== undefined) {
      mapa[String(r[0])] = normalizar_(r[1]);
    }
  });
  return mapa;
}

function datosFicha_(r, disciplinas, facultades) {
  return {
    id: r[0],
    nombre: normalizar_(r[1]),
    disciplina: disciplinas[String(r[2])] || '',
    facultad: facultades[String(r[3])] || '',
    cedula: String(r[5] || '').replace(/\D/g, ''),
    anioIngreso: r[6] || '',
    carrera: normalizar_(r[7])
  };
}

/**
 * Búsqueda pública por nombre o cédula. Devuelve como máximo 10 coincidencias.
 */
function buscarAtleta(consulta) {
  var q = clave_(consulta);
  if (!q || q.length < 3) return error_('Escribe al menos 3 letras o la cédula');

  var soloDigitos = q.replace(/\D/g, '');
  var disciplinas = mapaNombres_(HOJAS.DISCIPLINAS);
  var facultades = mapaNombres_(HOJAS.FACULTADES);

  var encontrados = [];
  var filas = filas_(HOJAS.ATLETAS);

  for (var i = 0; i < filas.length && encontrados.length < 10; i++) {
    var r = filas[i];
    var cedula = String(r[5] || '').replace(/\D/g, '');
    var nombre = clave_(r[1]);

    var coincide = soloDigitos
      ? cedula.indexOf(soloDigitos) !== -1
      : nombre.indexOf(q) !== -1;

    if (coincide) encontrados.push(datosFicha_(r, disciplinas, facultades));
  }

  return { status: 'ok', atletas: encontrados };
}

/**
 * Ficha completa de un atleta (solo lectura).
 */
function getAtleta(id) {
  if (!id) return error_('Falta el identificador del atleta');

  var disciplinas = mapaNombres_(HOJAS.DISCIPLINAS);
  var facultades = mapaNombres_(HOJAS.FACULTADES);
  var filas = filas_(HOJAS.ATLETAS);

  for (var i = 0; i < filas.length; i++) {
    if (String(filas[i][0]) === String(id)) {
      return { status: 'ok', atleta: datosFicha_(filas[i], disciplinas, facultades) };
    }
  }

  return error_('Atleta no encontrado');
}

function formatearFecha_(valor) {
  if (!valor) return '';
  if (Object.prototype.toString.call(valor) === '[object Date]') {
    var d = valor;
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear();
  }
  return String(valor);
}

/* =====================================================================
 * Escritura: respuestas del cuestionario
 * ===================================================================== */

function guardarRespuesta(d) {
  if (!d || !d.atleta || !d.atletaId) {
    return { result: 'error', message: 'Falta el nombre o el ID del atleta' };
  }

  var disciplinaId = d.disciplinaId || '';
  if (!tokenValidoPara_(d.token, disciplinaId)) {
    return { result: 'error', message: 'Sesión de disciplina no válida o expirada', code: 'unauthorized' };
  }

  var competiciones = d.asistenciaCompeticiones;
  if (competiciones === undefined) competiciones = d.asistenciacompeticiones;
  if (competiciones === undefined) competiciones = d.asistenciaGeneral;

  try {
    hoja_(HOJAS.RESPUESTAS).appendRow([
      new Date(),
      normalizar_(d.atleta),
      normalizar_(d.disciplina),
      d.estadoFisico || '',
      d.estadoTecnico || '',
      d.estadoTactico || '',
      d.actitud || '',
      d.asistencia || '',
      competiciones || '',
      d.observaciones || '',
      normalizar_(d.facultad),
      normalizar_(d.escuela),
      d.semestre || '',
      d.atletaId
    ]);

    invalidarCache_();
    return { result: 'success', atletaId: d.atletaId };
  } catch (err) {
    return { result: 'error', message: 'Error guardando la respuesta: ' + err.message };
  }
}

/* =====================================================================
 * CRUD: disciplinas
 * ===================================================================== */

function agregarDisciplina(nombre) {
  var limpio = normalizar_(nombre);
  if (!limpio) return error_('Nombre vacío');

  var hoja = hoja_(HOJAS.DISCIPLINAS);
  var filas = hoja.getDataRange().getValues().slice(1);
  var ultimoId = filas.length ? Math.max.apply(null, filas.map(function (r) { return Number(r[0]) || 0; })) : 0;
  var nuevoId = ultimoId + 1;

  hoja.appendRow([nuevoId, limpio, '']);
  return { status: 'ok', id: nuevoId };
}

function editarDisciplina(id, nombre) {
  var limpio = normalizar_(nombre);
  if (!id || !limpio) return error_('Faltan datos');

  var hoja = hoja_(HOJAS.DISCIPLINAS);
  var filas = hoja.getDataRange().getValues();
  for (var i = 1; i < filas.length; i++) {
    if (String(filas[i][0]) === String(id)) {
      hoja.getRange(i + 1, 2).setValue(limpio);
      return { status: 'ok' };
    }
  }
  return error_('ID no encontrado');
}

function eliminarDisciplina(id) {
  if (!id) return error_('ID requerido');

  var hoja = hoja_(HOJAS.DISCIPLINAS);
  var filas = hoja.getDataRange().getValues();
  for (var i = 1; i < filas.length; i++) {
    if (String(filas[i][0]) === String(id)) {
      hoja.deleteRow(i + 1);
      return { status: 'ok' };
    }
  }
  return error_('ID no encontrado');
}

function actualizarClaveDisciplina(id, clave) {
  if (!id) return error_('ID requerido');

  var hoja = hoja_(HOJAS.DISCIPLINAS);
  var filas = hoja.getDataRange().getValues();
  for (var i = 1; i < filas.length; i++) {
    if (String(filas[i][0]) === String(id)) {
      var limpia = String(clave || '').trim();
      if (limpia && limpia.length < 4) {
        return error_('La clave de la disciplina debe tener al menos 4 caracteres');
      }
      hoja.getRange(i + 1, 3).setValue(limpia);
      return { status: 'ok' };
    }
  }
  return error_('Disciplina no encontrada');
}

function actualizarIconoDisciplina(disciplinaId, icono) {
  if (!disciplinaId) return error_('Disciplina requerida');

  var nombre = String(icono || '').trim();
  if (!nombre) return error_('Selecciona un ícono');

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var hoja = ss.getSheetByName(HOJAS.ICONOS);

  if (!hoja) {
    hoja = ss.insertSheet(HOJAS.ICONOS);
    hoja.appendRow(['disciplinaId', 'icono']);
  }

  var datos = hoja.getDataRange().getValues();
  var cabeceras = datos[0].map(function (h) { return String(h).trim().toLowerCase(); });
  var colId = cabeceras.indexOf('disciplinaid');
  var colIcono = cabeceras.indexOf('icono');

  if (colId === -1 || colIcono === -1) {
    return error_('La hoja IconosDisciplinas no tiene las columnas disciplinaId e icono');
  }

  for (var i = 1; i < datos.length; i++) {
    if (String(datos[i][colId]) === String(disciplinaId)) {
      hoja.getRange(i + 1, colIcono + 1).setValue(nombre);
      return { status: 'ok' };
    }
  }

  hoja.appendRow([disciplinaId, nombre]);
  return { status: 'ok' };
}

/* =====================================================================
 * CRUD: atletas
 * ===================================================================== */

function agregarAtleta(nombre, disciplinaId, facultadId, escuelaId, cedula, anioIngreso, carrera) {
  var limpio = normalizar_(nombre);
  if (!limpio || !disciplinaId || !facultadId || !escuelaId) return error_('Faltan datos');

  var hoja = hoja_(HOJAS.ATLETAS);
  var filas = hoja.getDataRange().getValues().slice(1);
  var ultimoId = filas.length ? Math.max.apply(null, filas.map(function (r) { return Number(r[0]) || 0; })) : 0;
  var nuevoId = ultimoId + 1;

  hoja.appendRow([
    nuevoId,
    limpio,
    disciplinaId,
    facultadId,
    escuelaId,
    String(cedula || '').replace(/\D/g, ''),
    anioIngreso || '',
    normalizar_(carrera)
  ]);

  return { status: 'ok', id: nuevoId };
}

function editarAtleta(id, nombre, disciplinaId, facultadId, escuelaId, cedula, anioIngreso, carrera) {
  var limpio = normalizar_(nombre);
  if (!id || !limpio || !disciplinaId || !facultadId || !escuelaId) return error_('Faltan datos');

  var hoja = hoja_(HOJAS.ATLETAS);
  var filas = hoja.getDataRange().getValues();
  for (var i = 1; i < filas.length; i++) {
    if (String(filas[i][0]) === String(id)) {
      hoja.getRange(i + 1, 2, 1, 4).setValues([[limpio, disciplinaId, facultadId, escuelaId]]);

      // Los datos personales solo se sobrescriben si llegan
      if (cedula !== undefined) {
        hoja.getRange(i + 1, 6).setValue(String(cedula || '').replace(/\D/g, ''));
      }
      if (anioIngreso !== undefined) {
        hoja.getRange(i + 1, 7).setValue(anioIngreso || '');
      }
      if (carrera !== undefined) {
        hoja.getRange(i + 1, 8).setValue(normalizar_(carrera));
      }

      return { status: 'ok' };
    }
  }
  return error_('ID no encontrado');
}

function eliminarAtleta(id) {
  if (!id) return error_('ID requerido');

  var hoja = hoja_(HOJAS.ATLETAS);
  var filas = hoja.getDataRange().getValues();
  for (var i = 1; i < filas.length; i++) {
    if (String(filas[i][0]) === String(id)) {
      hoja.deleteRow(i + 1);
      return { status: 'ok' };
    }
  }
  return error_('ID no encontrado');
}

/* =====================================================================
 * CRUD: facultades
 * ===================================================================== */

function agregarFacultad(nombre) {
  var limpio = normalizar_(nombre);
  if (!limpio) return error_('Nombre vacío');

  var hoja = hoja_(HOJAS.FACULTADES);
  var filas = hoja.getDataRange().getValues().slice(1);
  var ultimoId = filas.length ? Math.max.apply(null, filas.map(function (r) { return Number(r[0]) || 0; })) : 0;
  var nuevoId = ultimoId + 1;

  hoja.appendRow([nuevoId, limpio]);
  return { status: 'ok', id: nuevoId };
}

function editarFacultad(id, nombre) {
  var limpio = normalizar_(nombre);
  if (!id || !limpio) return error_('Faltan datos');

  var hoja = hoja_(HOJAS.FACULTADES);
  var filas = hoja.getDataRange().getValues();
  for (var i = 1; i < filas.length; i++) {
    if (String(filas[i][0]) === String(id)) {
      hoja.getRange(i + 1, 2).setValue(limpio);
      return { status: 'ok' };
    }
  }
  return error_('ID no encontrado');
}

function eliminarFacultad(id) {
  if (!id) return error_('ID requerido');

  var escuelas = filas_(HOJAS.ESCUELAS);
  var asociadas = escuelas.filter(function (e) { return String(e[2]) === String(id); });
  if (asociadas.length > 0) {
    return error_('No se puede eliminar la facultad porque tiene escuelas asociadas');
  }

  var hoja = hoja_(HOJAS.FACULTADES);
  var filas = hoja.getDataRange().getValues();
  for (var i = 1; i < filas.length; i++) {
    if (String(filas[i][0]) === String(id)) {
      hoja.deleteRow(i + 1);
      return { status: 'ok' };
    }
  }
  return error_('ID no encontrado');
}

/* =====================================================================
 * CRUD: escuelas
 * ===================================================================== */

function agregarEscuela(nombre, facultadId) {
  var limpio = normalizar_(nombre);
  if (!limpio || !facultadId) return error_('Faltan datos');

  var hoja = hoja_(HOJAS.ESCUELAS);
  var filas = hoja.getDataRange().getValues().slice(1);
  var ultimoId = filas.length ? Math.max.apply(null, filas.map(function (r) { return Number(r[0]) || 0; })) : 0;
  var nuevoId = ultimoId + 1;

  hoja.appendRow([nuevoId, limpio, facultadId]);
  return { status: 'ok', id: nuevoId };
}

function editarEscuela(id, nombre, facultadId) {
  var limpio = normalizar_(nombre);
  if (!id || !limpio || !facultadId) return error_('Faltan datos');

  var hoja = hoja_(HOJAS.ESCUELAS);
  var filas = hoja.getDataRange().getValues();
  for (var i = 1; i < filas.length; i++) {
    if (String(filas[i][0]) === String(id)) {
      hoja.getRange(i + 1, 2, 1, 2).setValues([[limpio, facultadId]]);
      return { status: 'ok' };
    }
  }
  return error_('ID no encontrado');
}

function eliminarEscuela(id) {
  if (!id) return error_('ID requerido');

  var atletas = filas_(HOJAS.ATLETAS);
  var asociados = atletas.filter(function (a) { return String(a[4]) === String(id); });
  if (asociados.length > 0) {
    return error_('No se puede eliminar la escuela porque tiene atletas asociados');
  }

  var hoja = hoja_(HOJAS.ESCUELAS);
  var filas = hoja.getDataRange().getValues();
  for (var i = 1; i < filas.length; i++) {
    if (String(filas[i][0]) === String(id)) {
      hoja.deleteRow(i + 1);
      return { status: 'ok' };
    }
  }
  return error_('ID no encontrado');
}
