const SPREADSHEET_ID = '1K8qGO46yhwpM_qTupQfGW9TNnazmU3Y4N8Wt-QfWB5c';
const ADMIN_KEY = 'ucv2023';
const DISCIPLINAS_SHEET = "Disciplinas";
const CACHE_EXPIRATION = 300; // 5 minutos en segundos

function doOptions() {
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT);
}

function doGet(e) {
  e = e || {};
  e.parameter = e.parameter || {};
  const tipo = e.parameter.tipo || '';
  const cacheKey = `${tipo}_${JSON.stringify(e.parameter)}`;
  
  const cache = CacheService.getScriptCache();
  const cached = cache.get(cacheKey);
  
  if (cached) {
    return ContentService.createTextOutput(cached)
      .setMimeType(ContentService.MimeType.JSON);
  }

  let respuesta;
  
  if (tipo === 'respuesta') {
    respuesta = guardarRespuesta(e.parameter);
  } else {
    switch (tipo) {
      case 'getDisciplinas': 
        respuesta = getDisciplinas(); 
        break;
      case 'getAtletas': 
        respuesta = getAtletas(e.parameter.disciplinaId); 
        break;
      case 'getFacultades': 
        respuesta = getFacultades(); 
        break;
      case 'getEscuelas': 
        respuesta = getEscuelas(); 
        break;
      case 'getDisciplinasConAtletas': 
        respuesta = getDisciplinasConAtletas(); 
        break;
      case 'verificarAccesoDisciplina':
        respuesta = verificarAccesoDisciplina(e.parameter.disciplinaId, e.parameter.clave);
        break;
      case 'getIconosDisciplinas':
        respuesta = getIconosDisciplinas();
        break;
      default:
        respuesta = { 
          status: 'error', 
          message: 'Parámetro GET "tipo" inválido o ausente' 
        };
    }
  }
  
  const response = ContentService.createTextOutput(JSON.stringify(respuesta))
    .setMimeType(ContentService.MimeType.JSON);
  
  if (tipo !== 'respuesta' && respuesta.status === 'ok') {
    cache.put(cacheKey, JSON.stringify(respuesta), CACHE_EXPIRATION);
  }
  
  return response;
}

function doPost(e) {
  let datos = {};
  
  try {
    if (e.postData.type === 'application/json') {
      datos = JSON.parse(e.postData.contents);
    } else if (e.postData.type === 'application/x-www-form-urlencoded') {
      const params = e.postData.contents.split('&');
      params.forEach(param => {
        const [key, value] = param.split('=');
        datos[decodeURIComponent(key)] = decodeURIComponent(value || '');
      });
    } else {
      throw new Error('Tipo de contenido no soportado: ' + e.postData.type);
    }
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: 'Error procesando los datos: ' + error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }

  if (datos.tipo === 'respuesta') {
    return ContentService.createTextOutput(JSON.stringify(guardarRespuesta(datos)))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (!datos.adminKey || datos.adminKey !== ADMIN_KEY) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: 'Acceso no autorizado. Clave admin inválida.'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  let respuesta;
  try {
    switch (datos.tipo) {
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
        respuesta = agregarAtleta(datos.nombre, datos.disciplinaId, datos.facultadId, datos.escuelaId);
        break;
      case 'editar-atleta':
        respuesta = editarAtleta(datos.id, datos.nombre, datos.disciplinaId, datos.facultadId, datos.escuelaId);
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
        respuesta = { 
          status: 'error', 
          message: 'Operación no soportada: ' + (datos.tipo || 'ninguna') 
        };
    }
  } catch (error) {
    respuesta = {
      status: 'error',
      message: 'Error procesando la solicitud: ' + error.message
    };
  }
  
  if (respuesta.status === 'ok') {
    CacheService.getScriptCache().removeAll([
      'getDisciplinas_', 
      'getAtletas_', 
      'getFacultades_', 
      'getEscuelas_',
      'getDisciplinasConAtletas_',
      'getIconosDisciplinas_'
    ]);
  }
  
  return ContentService.createTextOutput(JSON.stringify(respuesta))
    .setMimeType(ContentService.MimeType.JSON);
}

function getDisciplinas() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('disciplinas');
  
  if (cached) {
    return JSON.parse(cached);
  }
  
  const hoja = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(DISCIPLINAS_SHEET);
  const rows = hoja.getDataRange().getValues().slice(1);
  const result = { 
    status: 'ok', 
    disciplinas: rows.map(r => ({ 
      id: r[0], 
      nombre: r[1],
      clave: r[2] || ''
    })) 
  };
  
  cache.put('disciplinas', JSON.stringify(result), CACHE_EXPIRATION);
  return result;
}

function verificarAccesoDisciplina(disciplinaId, clave) {
  const hoja = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(DISCIPLINAS_SHEET);
  const rows = hoja.getDataRange().getValues();
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] == disciplinaId && rows[i][2] == clave) {
      return { status: 'ok', disciplina: rows[i][1] };
    }
  }
  return { status: 'error', message: 'Clave incorrecta' };
}

function actualizarClaveDisciplina(id, clave) {
  const hoja = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(DISCIPLINAS_SHEET);
  const rows = hoja.getDataRange().getValues();
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] == id) {
      hoja.getRange(i + 1, 3).setValue(clave);
      CacheService.getScriptCache().remove('disciplinas');
      return { status: 'ok' };
    }
  }
  return { status: 'error', message: 'Disciplina no encontrada' };
}

function getAtletas(disciplinaId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const hojaAtletas = ss.getSheetByName('Atletas');
  const hojaRespuestas = ss.getSheetByName('Respuestas');
  
  const atletasData = hojaAtletas.getDataRange().getValues().slice(1);
  const respuestasData = hojaRespuestas.getDataRange().getValues().slice(1);
  const atletasRespondidos = new Set(respuestasData.map(r => r[13] || r[1]));
  
  const atletasFiltrados = disciplinaId 
    ? atletasData.filter(a => a[2] == disciplinaId)
    : atletasData;
  
  return {
    status: 'ok',
    atletas: atletasFiltrados.map(r => ({
      id: r[0],
      nombre: r[1],
      disciplinaId: r[2],
      facultadId: r[3],
      escuelaId: r[4],
      respondido: atletasRespondidos.has(r[0]) || atletasRespondidos.has(r[1])
    }))
  };
}

function getFacultades() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('facultades');
  
  if (cached) {
    return JSON.parse(cached);
  }
  
  const hoja = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Facultades');
  const rows = hoja.getDataRange().getValues().slice(1);
  const result = { 
    status: 'ok', 
    facultades: rows.map(r => ({ 
      id: r[0], 
      nombre: r[1] 
    })) 
  };
  
  cache.put('facultades', JSON.stringify(result), CACHE_EXPIRATION);
  return result;
}

function getEscuelas() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('escuelas');
  
  if (cached) {
    return JSON.parse(cached);
  }
  
  const hoja = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Escuelas');
  const rows = hoja.getDataRange().getValues().slice(1);
  const result = {
    status: 'ok',
    escuelas: rows.map(r => ({
      id: r[0],
      nombre: r[1],
      facultadId: r[2]
    }))
  };
  
  cache.put('escuelas', JSON.stringify(result), CACHE_EXPIRATION);
  return result;
}

function getDisciplinasConAtletas() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('disciplinas_con_atletas');
  
  if (cached) {
    return JSON.parse(cached);
  }
  
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const hojaDisciplinas = ss.getSheetByName('Disciplinas');
  const hojaAtletas = ss.getSheetByName('Atletas');
  const hojaRespuestas = ss.getSheetByName('Respuestas');

  const respuestasData = hojaRespuestas.getDataRange().getValues().slice(1);
  const atletasRespondidos = new Set(respuestasData.map(r => r[13] || r[1]));

  const disciplinasData = hojaDisciplinas.getDataRange().getValues().slice(1);
  const atletasData = hojaAtletas.getDataRange().getValues().slice(1);

  const atletasPorDisciplina = {};
  atletasData.forEach(r => {
    const atleta = { 
      id: r[0], 
      nombre: r[1], 
      disciplinaId: r[2], 
      facultadId: r[3], 
      escuelaId: r[4],
      respondido: atletasRespondidos.has(r[0]) || atletasRespondidos.has(r[1])
    };
    if (!atletasPorDisciplina[atleta.disciplinaId]) {
      atletasPorDisciplina[atleta.disciplinaId] = [];
    }
    atletasPorDisciplina[atleta.disciplinaId].push(atleta);
  });

  const resultado = disciplinasData.map(r => ({
    id: r[0],
    nombre: r[1],
    atletas: atletasPorDisciplina[r[0]] || []
  }));

  const result = { 
    status: 'ok', 
    disciplinas: resultado 
  };
  
  cache.put('disciplinas_con_atletas', JSON.stringify(result), CACHE_EXPIRATION);
  return result;
}

function getIconosDisciplinas() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('IconosDisciplinas');
  
  if (!sheet) {
    // Si la hoja no existe, crear una nueva con datos básicos
    const newSheet = ss.insertSheet('IconosDisciplinas');
    newSheet.appendRow(['disciplinaId', 'icono']);
    return { status: 'ok', iconos: [] };
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  
  // Verificar si la hoja tiene la estructura correcta
  if (!headers.includes('disciplinaId') || !headers.includes('icono')) {
    return { status: 'error', message: 'Estructura de hoja IconosDisciplinas incorrecta' };
  }

  const iconos = data.map(row => {
    return {
      disciplinaId: row[headers.indexOf('disciplinaId')],
      icono: row[headers.indexOf('icono')] || 'fa-trophy' // Valor por defecto
    };
  });

  return { status: 'ok', iconos: iconos };
}

function actualizarIconoDisciplina(disciplinaId, icono) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName('IconosDisciplinas');
  
  // Si la hoja no existe, créala
  if (!sheet) {
    sheet = ss.insertSheet('IconosDisciplinas');
    sheet.appendRow(['disciplinaId', 'icono']);
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  
  const disciplinaIdCol = headers.indexOf('disciplinaId');
  const iconoCol = headers.indexOf('icono');
  
  // Buscar y actualizar
  let updated = false;
  for (let i = 0; i < data.length; i++) {
    if (data[i][disciplinaIdCol] == disciplinaId) {
      sheet.getRange(i + 2, iconoCol + 1).setValue(icono);
      updated = true;
      break;
    }
  }
  
  // Si no existe, agregar nuevo registro
  if (!updated) {
    sheet.appendRow([disciplinaId, icono]);
  }
  
  // Limpiar caché
  CacheService.getScriptCache().remove('getIconosDisciplinas_');
  
  return { status: 'ok' };
}

function guardarRespuesta(d) {
  if (!d || !d.atleta || !d.atletaId) {
    return { 
      result: 'error', 
      message: 'Falta campo atleta o ID' 
    };
  }
  
  try {
    const hoja = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Respuestas');
    hoja.appendRow([
      new Date(),
      d.atleta,
      d.disciplina || '',
      d.estadoFisico || '',
      d.estadoTecnico || '',
      d.estadoTactico || '',
      d.actitud || '',
      d.asistencia || '',
      d.asistenciaGeneral || '',
      d.observaciones || '',
      d.facultad || '',
      d.escuela || '',
      d.semestre || '',
      d.atletaId
    ]);
    
    // Limpiar cache relevante
    CacheService.getScriptCache().removeAll([
      'getAtletas_',
      'getDisciplinasConAtletas_'
    ]);
    
    return { 
      result: 'success',
      atletaId: d.atletaId
    };
  } catch (error) {
    return {
      result: 'error',
      message: 'Error guardando respuesta: ' + error.message
    };
  }
}

function agregarDisciplina(nombre) {
  if (!nombre) return { 
    status: 'error', 
    message: 'Nombre vacío' 
  };
  
  try {
    const hoja = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Disciplinas');
    const rows = hoja.getDataRange().getValues();
    const ultimoId = rows.length > 1 ? Math.max(...rows.slice(1).map(r => r[0])) : 0;
    const nuevoId = ultimoId + 1;
    hoja.appendRow([nuevoId, nombre, '']); // Clave vacía por defecto
    CacheService.getScriptCache().remove('disciplinas');
    return { 
      status: 'ok', 
      id: nuevoId 
    };
  } catch (error) {
    return {
      status: 'error',
      message: 'Error agregando disciplina: ' + error.message
    };
  }
}

function editarDisciplina(id, nombre) {
  if (!id || !nombre) return { 
    status: 'error', 
    message: 'Faltan datos' 
  };
  
  try {
    const hoja = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Disciplinas');
    const rows = hoja.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] == id) {
        hoja.getRange(i + 1, 2).setValue(nombre);
        CacheService.getScriptCache().remove('disciplinas');
        return { 
          status: 'ok' 
        };
      }
    }
    return { 
      status: 'error', 
      message: 'ID no encontrado' 
    };
  } catch (error) {
    return {
      status: 'error',
      message: 'Error editando disciplina: ' + error.message
    };
  }
}

function eliminarDisciplina(id) {
  if (!id) return { 
    status: 'error', 
    message: 'ID requerido' 
  };
  
  try {
    const hoja = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Disciplinas');
    const rows = hoja.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] == id) {
        hoja.deleteRow(i + 1);
        CacheService.getScriptCache().removeAll(['disciplinas', 'getDisciplinasConAtletas']);
        return { 
          status: 'ok' 
        };
      }
    }
    return { 
      status: 'error', 
      message: 'ID no encontrado' 
    };
  } catch (error) {
    return {
      status: 'error',
      message: 'Error eliminando disciplina: ' + error.message
    };
  }
}

function agregarAtleta(nombre, disciplinaId, facultadId, escuelaId) {
  if (!nombre || !disciplinaId || !facultadId || !escuelaId) {
    return { 
      status: 'error', 
      message: 'Faltan datos' 
    };
  }
  
  try {
    const hoja = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Atletas');
    const rows = hoja.getDataRange().getValues();
    const ultimoId = rows.length > 1 ? Math.max(...rows.slice(1).map(r => r[0])) : 0;
    const nuevoId = ultimoId + 1;
    hoja.appendRow([nuevoId, nombre, disciplinaId, facultadId, escuelaId]);
    CacheService.getScriptCache().removeAll(['getAtletas_', 'getDisciplinasConAtletas_']);
    return { 
      status: 'ok', 
      id: nuevoId 
    };
  } catch (error) {
    return {
      status: 'error',
      message: 'Error agregando atleta: ' + error.message
    };
  }
}

function editarAtleta(id, nombre, disciplinaId, facultadId, escuelaId) {
  if (!id || !nombre || !disciplinaId || !facultadId || !escuelaId) {
    return { 
      status: 'error', 
      message: 'Faltan datos' 
    };
  }
  
  try {
    const hoja = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Atletas');
    const rows = hoja.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] == id) {
        hoja.getRange(i + 1, 2).setValue(nombre);
        hoja.getRange(i + 1, 3).setValue(disciplinaId);
        hoja.getRange(i + 1, 4).setValue(facultadId);
        hoja.getRange(i + 1, 5).setValue(escuelaId);
        CacheService.getScriptCache().removeAll(['getAtletas_', 'getDisciplinasConAtletas_']);
        return { 
          status: 'ok' 
        };
      }
    }
    return { 
      status: 'error', 
      message: 'ID no encontrado' 
    };
  } catch (error) {
    return {
      status: 'error',
      message: 'Error editando atleta: ' + error.message
    };
  }
}

function eliminarAtleta(id) {
  if (!id) return { 
    status: 'error', 
    message: 'ID requerido' 
  };
  
  try {
    const hoja = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Atletas');
    const rows = hoja.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] == id) {
        hoja.deleteRow(i + 1);
        CacheService.getScriptCache().removeAll(['getAtletas_', 'getDisciplinasConAtletas_']);
        return { 
          status: 'ok' 
        };
      }
    }
    return { 
      status: 'error', 
      message: 'ID no encontrado' 
    };
  } catch (error) {
    return {
      status: 'error',
      message: 'Error eliminando atleta: ' + error.message
    };
  }
}

function agregarFacultad(nombre) {
  if (!nombre) return { 
    status: 'error', 
    message: 'Nombre vacío' 
  };
  
  try {
    const hoja = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Facultades');
    const rows = hoja.getDataRange().getValues();
    const ultimoId = rows.length > 1 ? Math.max(...rows.slice(1).map(r => r[0])) : 0;
    const nuevoId = ultimoId + 1;
    hoja.appendRow([nuevoId, nombre]);
    CacheService.getScriptCache().removeAll(['facultades', 'escuelas', 'getDisciplinasConAtletas_']);
    return { 
      status: 'ok', 
      id: nuevoId 
    };
  } catch (error) {
    return {
      status: 'error',
      message: 'Error agregando facultad: ' + error.message
    };
  }
}

function editarFacultad(id, nombre) {
  if (!id || !nombre) return { 
    status: 'error', 
    message: 'Faltan datos' 
  };
  
  try {
    const hoja = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Facultades');
    const rows = hoja.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] == id) {
        hoja.getRange(i + 1, 2).setValue(nombre);
        CacheService.getScriptCache().removeAll(['facultades', 'escuelas', 'getDisciplinasConAtletas_']);
        return { 
          status: 'ok' 
        };
      }
    }
    return { 
      status: 'error', 
      message: 'ID no encontrado' 
    };
  } catch (error) {
    return {
      status: 'error',
      message: 'Error editando facultad: ' + error.message
    };
  }
}

function eliminarFacultad(id) {
  if (!id) return { 
    status: 'error', 
    message: 'ID requerido' 
  };
  
  try {
    const hoja = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Facultades');
    const rows = hoja.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] == id) {
        // Verificar si hay escuelas asociadas
        const escuelas = getEscuelas().escuelas || [];
        const escuelasAsociadas = escuelas.filter(e => e.facultadId == id);
        if (escuelasAsociadas.length > 0) {
          return {
            status: 'error',
            message: 'No se puede eliminar la facultad porque tiene escuelas asociadas'
          };
        }
        
        hoja.deleteRow(i + 1);
        CacheService.getScriptCache().removeAll(['facultades', 'escuelas', 'getDisciplinasConAtletas_']);
        return { 
          status: 'ok' 
        };
      }
    }
    return { 
      status: 'error', 
      message: 'ID no encontrado' 
    };
  } catch (error) {
    return {
      status: 'error',
      message: 'Error eliminando facultad: ' + error.message
    };
  }
}

function agregarEscuela(nombre, facultadId) {
  if (!nombre || !facultadId) return { 
    status: 'error', 
    message: 'Faltan datos' 
  };
  
  try {
    const hoja = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Escuelas');
    const rows = hoja.getDataRange().getValues();
    const ultimoId = rows.length > 1 ? Math.max(...rows.slice(1).map(r => r[0])) : 0;
    const nuevoId = ultimoId + 1;
    hoja.appendRow([nuevoId, nombre, facultadId]);
    CacheService.getScriptCache().removeAll(['escuelas', 'getDisciplinasConAtletas_']);
    return { 
      status: 'ok', 
      id: nuevoId 
    };
  } catch (error) {
    return {
      status: 'error',
      message: 'Error agregando escuela: ' + error.message
    };
  }
}

function editarEscuela(id, nombre, facultadId) {
  if (!id || !nombre || !facultadId) return { 
    status: 'error', 
    message: 'Faltan datos' 
  };
  
  try {
    const hoja = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Escuelas');
    const rows = hoja.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] == id) {
        hoja.getRange(i + 1, 2).setValue(nombre);
        hoja.getRange(i + 1, 3).setValue(facultadId);
        CacheService.getScriptCache().removeAll(['escuelas', 'getDisciplinasConAtletas_']);
        return { 
          status: 'ok' 
        };
      }
    }
    return { 
      status: 'error', 
      message: 'ID no encontrado' 
    };
  } catch (error) {
    return {
      status: 'error',
      message: 'Error editando escuela: ' + error.message
    };
  }
}

function eliminarEscuela(id) {
  if (!id) return { 
    status: 'error', 
    message: 'ID requerido' 
  };
  
  try {
    const hoja = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Escuelas');
    const rows = hoja.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] == id) {
        // Verificar si hay atletas asociados
        const atletas = getAtletas().atletas || [];
        const atletasAsociados = atletas.filter(a => a.escuelaId == id);
        if (atletasAsociados.length > 0) {
          return {
            status: 'error',
            message: 'No se puede eliminar la escuela porque tiene atletas asociados'
          };
        }
        
        hoja.deleteRow(i + 1);
        CacheService.getScriptCache().removeAll(['escuelas', 'getDisciplinasConAtletas_']);
        return { 
          status: 'ok' 
        };
      }
    }
    return { 
      status: 'error', 
      message: 'ID no encontrado' 
    };
  } catch (error) {
    return {
      status: 'error',
      message: 'Error eliminando escuela: ' + error.message
    };
  }
}