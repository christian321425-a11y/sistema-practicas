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
});