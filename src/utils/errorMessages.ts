/**
 * Traduce mensajes de error de Supabase al español
 */
export function translateError(errorMessage: string): string {
  const errorLower = errorMessage.toLowerCase();

  // Mapeo de errores comunes de Supabase
  const errorMap: Record<string, string> = {
    'invalid login credentials': 'Correo o contraseña incorrectos',
    'invalid credentials': 'Credenciales inválidas',
    'email not confirmed': 'Por favor, confirma tu correo electrónico antes de iniciar sesión',
    'user not found': 'Usuario no encontrado',
    'email already registered': 'Este correo electrónico ya está registrado',
    'password too weak': 'La contraseña es demasiado débil',
    'password should be at least 6 characters': 'La contraseña debe tener al menos 6 caracteres',
    'signup is disabled': 'El registro está deshabilitado',
    'email rate limit exceeded': 'Demasiados intentos. Por favor, espera unos minutos',
    'token has expired': 'El enlace ha expirado. Por favor, solicita uno nuevo',
    'invalid token': 'El enlace no es válido',
    'user already registered': 'Este usuario ya está registrado',
    'network request failed': 'Error de conexión. Por favor, verifica tu internet',
    'fetch failed': 'Error de conexión. Por favor, verifica tu internet',
    'organization already exists': 'Ya existe una organización con ese nombre',
    'permission denied': 'No tienes permiso para realizar esta acción',
    'duplicate key value': 'Este valor ya existe',
    'foreign key violation': 'Error de referencia. Por favor, verifica los datos',
    'not null violation': 'Faltan campos requeridos',
    'check constraint violation': 'Los datos no cumplen con los requisitos',
  };

  // Buscar coincidencias exactas o parciales
  for (const [key, value] of Object.entries(errorMap)) {
    if (errorLower.includes(key)) {
      return value;
    }
  }

  // Si no hay traducción, devolver el mensaje original
  return errorMessage;
}

