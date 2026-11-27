// Roles de Crack Pro: cada rol desbloquea un conjunto de categorias. El administrador tiene todo.
export const ROLES = [
  { id: 'invitado', name: 'Invitado', level: 1, color: '#8d8d95', badge: 'INV', desc: 'Acceso básico de prueba: calculadora, conversiones comunes y utilidades del día a día.' },
  { id: 'visitante', name: 'Visitante', level: 2, color: '#c9c9cf', badge: 'VIS', desc: 'Todo lo de invitado más medidas técnicas, salud, sonido, sensores y generadores.' },
  { id: 'asistente', name: 'Asistente', level: 3, color: '#ffb020', badge: 'AST', desc: 'Productividad: notas, tareas, agenda, contactos, textos, fechas, imágenes y caja.' },
  { id: 'verificador', name: 'Verificador', level: 4, color: '#3fd0e0', badge: 'VER', desc: 'Validación: documentos, tarjetas, códigos de barras, hashes de archivos y auditoría.' },
  { id: 'programador', name: 'Programador', level: 5, color: '#3ddc84', badge: 'DEV', desc: 'Desarrollo: codificación, bases numéricas, JSON, expresiones, red, criptografía y archivos.' },
  { id: 'ceo', name: 'CEO', level: 6, color: '#d9b45a', badge: 'CEO', desc: 'Dirección: finanzas, negocio, inventario, clientes, reportes y auditoría del equipo.' },
  { id: 'admin', name: 'Administrador', level: 7, color: '#ff2832', badge: 'ADM', desc: 'Control total: todas las opciones desbloqueadas, gestión de perfiles, roles y códigos.' },
];
export const ROLE = Object.fromEntries(ROLES.map(r => [r.id, r]));

// grupos de roles para asignar categorias
export const G = {
  all: ['invitado', 'visitante', 'asistente', 'verificador', 'programador', 'ceo', 'admin'],
  vis: ['visitante', 'asistente', 'verificador', 'programador', 'ceo', 'admin'],
  staff: ['asistente', 'verificador', 'programador', 'ceo', 'admin'],
  office: ['asistente', 'ceo', 'admin'],
  tech: ['verificador', 'programador', 'admin'],
  dev: ['programador', 'admin'],
  ver: ['verificador', 'admin'],
  boss: ['ceo', 'admin'],
  admin: ['admin'],
};

export const canUse = (role, tool) => role === 'admin' || tool.roles.includes(role);
