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
            // Guardamos sus datos en el navegador
            localStorage.setItem('usuarioLogueado', JSON.stringify(data.usuario));
            
            // Lo redirigimos a su panel correspondiente
            window.location.href = `dashboard-${rol}.html`;
        } else {
            // Si el servidor dice que los datos están mal, mostramos el error
            mensajeError.textContent = data.mensaje;
        }
    } catch (error) {
        mensajeError.textContent = 'Error al conectar con el servidor. ¿Está encendido XAMPP y Node?';
        console.error(error);
    }
});