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
            // Si todo está bien, mostramos una alerta y guardamos sus datos
            alert(`¡Bienvenido ${data.usuario.nombres}! Ingresaste como ${data.usuario.rol}`);
            localStorage.setItem('usuarioLogueado', JSON.stringify(data.usuario));
            
            // Aquí en el futuro lo enviaremos a su respectivo dashboard
            // window.location.href = `dashboard-${rol}.html`;
        } else {
            // Si el servidor dice que los datos están mal, mostramos el error
            mensajeError.textContent = data.mensaje;
        }
    } catch (error) {
        mensajeError.textContent = 'Error al conectar con el servidor. ¿Está encendido XAMPP y Node?';
        console.error(error);
    }
});