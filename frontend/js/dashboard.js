// Esperar a que todo el HTML esté cargado antes de ejecutar algo
document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. LÓGICA DE PROTECCIÓN Y USUARIO ---
    const usuarioGuardado = localStorage.getItem('usuarioLogueado');

    if (!usuarioGuardado) {
        // Si no hay sesión, lo regresa al login
        window.location.href = 'index.html';
    } else {
        const usuario = JSON.parse(usuarioGuardado);
        // Si no es estudiante, lo regresa al login
        if (usuario.rol !== 'estudiante') {
            window.location.href = 'index.html';
        }
        // Coloca el nombre en la barra superior
        document.getElementById('nombre-usuario').textContent = `${usuario.nombres} ${usuario.apellidos}`;
    }

    // Botón de cerrar sesión
    document.getElementById('btn-cerrar-sesion').addEventListener('click', () => {
        localStorage.removeItem('usuarioLogueado');
        window.location.href = 'index.html';
    });

    // --- 2. LÓGICA DEL MODAL DE REGISTRO DE HORAS ---
    const modalHoras = document.getElementById('modal-horas');
    const btnAbrirModal = document.getElementById('btn-registrar-horas');
    const btnCerrarModal = document.querySelector('.close-btn');

    // Comprobación silenciosa: solo se activa si existen los elementos
    if (modalHoras && btnAbrirModal && btnCerrarModal) {
        
        // Abrir la ventana
        btnAbrirModal.addEventListener('click', () => {
            modalHoras.style.display = 'flex';
            document.getElementById('fecha').valueAsDate = new Date(); // Fecha actual por defecto
        });

        // Cerrar la ventana con la "X"
        btnCerrarModal.addEventListener('click', () => {
            modalHoras.style.display = 'none';
        });

        // Cerrar la ventana haciendo clic afuera
        window.addEventListener('click', (e) => {
            if (e.target === modalHoras) {
                modalHoras.style.display = 'none';
            }
        });
    }
    // --- 3. LÓGICA PARA ENVIAR LAS HORAS A LA BASE DE DATOS ---
    const formRegistro = document.getElementById('form-registro-horas');

    if (formRegistro) {
        formRegistro.addEventListener('submit', async (e) => {
            e.preventDefault(); // Evita que la página intente recargarse al enviar

            // 1. Obtenemos el ID del estudiante que inició sesión
            const usuario = JSON.parse(localStorage.getItem('usuarioLogueado'));
            
            // 2. Capturamos lo que escribió en la ventana emergente
            const fecha = document.getElementById('fecha').value;
            const horas = document.getElementById('cantidad-horas').value;
            const descripcion = document.getElementById('descripcion').value;

            try {
                // 3. Enviamos los datos al servidor
                const response = await fetch('http://localhost:3000/api/horas', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        estudiante_id: usuario.id,
                        horas: horas,
                        descripcion: descripcion,
                        fecha: fecha
                    })
                });

                const data = await response.json();

                // 4. Mostramos el resultado y cerramos la ventana
                if (data.exito) {
                    alert('✅ ' + data.mensaje);
                    formRegistro.reset(); // Limpia los campos
                    document.getElementById('modal-horas').style.display = 'none'; // Cierra la ventana
                } else {
                    alert('❌ Error: ' + data.mensaje);
                }
            } catch (error) {
                console.error('Error al guardar horas:', error);
                alert('❌ Error de conexión con el servidor. Verifica que Node esté encendido.');
            }
        });
    }
});