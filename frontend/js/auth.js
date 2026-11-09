document.addEventListener('DOMContentLoaded', () => {
    const formLogin = document.getElementById('form-login'); // Asegúrate de que tu formulario en login.html tenga id="form-login"
    let mensajeDiv = document.getElementById('mensaje-error'); 
    
    // Si no existe el div de error en el HTML, lo creamos dinámicamente
    if (!mensajeDiv) {
        mensajeDiv = document.createElement('div');
        mensajeDiv.id = 'mensaje-error';
        mensajeDiv.style.color = 'red';
        mensajeDiv.style.marginTop = '15px';
        mensajeDiv.style.textAlign = 'center';
        formLogin.appendChild(mensajeDiv);
    }

    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Asume que los inputs tienen estos IDs en tu login.html
        const cedula = document.getElementById('login-cedula').value.trim();
        const password = document.getElementById('login-password').value.trim();
        const rol = document.getElementById('login-rol').value;

        mensajeDiv.textContent = 'Iniciando sesión...';
        mensajeDiv.style.color = '#003366';

        try {
            const res = await fetch('http://localhost:3000/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cedula, password, rol })
            });

            const data = await res.json();

            if (data.exito) {
                // Guardar la sesión y redirigir según el rol
                localStorage.setItem('usuarioLogueado', JSON.stringify(data.usuario));
                
                if (data.usuario.rol === 'admin') {
                    window.location.href = 'dashboard-admin.html';
                } else if (data.usuario.rol === 'estudiante') {
                    window.location.href = 'dashboard-estudiante.html';
                } else if (data.usuario.rol === 'tutor') {
                    window.location.href = 'dashboard-tutor.html'; // Aquí redirige al tutor
                }
            } else {
                mensajeDiv.style.color = 'red';
                mensajeDiv.textContent = data.mensaje;
            }
        } catch (error) {
            console.error(error);
            mensajeDiv.style.color = 'red';
            mensajeDiv.textContent = 'Error al conectar con el servidor. ¿Está encendido XAMPP y Node?';
        }
    });
});