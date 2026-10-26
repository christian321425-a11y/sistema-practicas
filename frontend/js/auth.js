document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault(); // Evita que la página se recargue en blanco

    // Capturamos lo que el usuario escribió
    const cedula = document.getElementById('cedula').value;
    const password = document.getElementById('password').value;
    const rol = document.getElementById('rol').value;
    const mensajeError = document.getElementById('mensaje-error');

    // Limpiamos errores anteriores
    mensajeError.textContent = '';

    try {
        // Enviamos los datos al servidor (Backend)
        const response = await fetch('http://localhost:3000/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cedula, password, rol })
        });

        const data = await response.json();

     if (data.exito) {
                // Guardamos los datos del usuario en el navegador (Local Storage)
                localStorage.setItem('usuarioLogueado', JSON.stringify(data.usuario));
                
                // REDIRECCIÓN INTELIGENTE SEGÚN EL ROL
                if (data.usuario.rol === 'admin') {
                    window.location.href = 'dashboard-admin.html';
                } else if (data.usuario.rol === 'estudiante') {
                    window.location.href = 'dashboard-estudiante.html';
                } else {
                    // Por si luego agregamos el rol tutor
                    alert('Rol no reconocido por el sistema.');
                }
                
            } else {
                // Si la cédula o contraseña son incorrectas, mostramos el error
                mensajeDiv.textContent = data.mensaje;
                mensajeDiv.style.color = 'red';
            }
    } catch (error) {
        mensajeError.textContent = 'Error al conectar con el servidor. ¿Está encendido XAMPP y Node?';
        console.error(error);
    }
});