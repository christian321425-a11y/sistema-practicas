// 1. Proteger la ruta: Verificar si el usuario está logueado
const usuarioGuardado = localStorage.getItem('usuarioLogueado');

if (!usuarioGuardado) {
    // Si no hay datos guardados, lo regresamos al login
    window.location.href = 'index.html';
} else {
    // 2. Si está logueado, convertimos el texto a un objeto de JavaScript
    const usuario = JSON.parse(usuarioGuardado);

    // 3. Verificamos que realmente sea un estudiante (seguridad extra)
    if (usuario.rol !== 'estudiante') {
        window.location.href = 'index.html';
    }

    // 4. Mostrar su nombre en la barra superior
    document.getElementById('nombre-usuario').textContent = `${usuario.nombres} ${usuario.apellidos}`;
}

// 5. Lógica para el botón de Cerrar Sesión
document.getElementById('btn-cerrar-sesion').addEventListener('click', () => {
    // Borramos los datos del navegador
    localStorage.removeItem('usuarioLogueado');
    // Lo enviamos de vuelta al login
    window.location.href = 'index.html';
});