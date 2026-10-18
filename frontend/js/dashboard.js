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
        // --- NUEVA FUNCIÓN: CARGAR PROGRESO Y CARRERA ---
        const cargarProgreso = async () => {
            try {
                // Llamamos al servidor con el ID del estudiante
                const response = await fetch(`http://localhost:3000/api/progreso/${usuario.id}`);
                const data = await response.json();

                if (data.exito) {
                    // Si no tiene carrera asignada, mostramos un mensaje de advertencia
                    const nombreCarrera = data.datos.nombre_carrera || '⚠️ Sin carrera asignada';
                    const horasMeta = data.datos.meta_horas || '???';

                    // Actualizamos el HTML
                    document.getElementById('nombre-carrera').textContent = nombreCarrera;
                    document.getElementById('contador-horas').textContent = `${data.datos.total_horas} / ${horasMeta}`;
                }
            } catch (error) {
                console.error('Error al cargar el progreso:', error);
                document.getElementById('contador-horas').textContent = `Error al cargar`;
            }
        };

        // Ejecutamos la función apenas entra al panel
        cargarProgreso();
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
                    formRegistro.reset(); // Limpia los campos
                    document.getElementById('modal-horas').style.display = 'none'; // Cierra la ventana silenciosamente
                } else {
                    alert('❌ Error: ' + data.mensaje); // Dejamos solo la de error por si algo falla
                }
            } catch (error) {
                console.error('Error al guardar horas:', error);
                alert('❌ Error de conexión con el servidor. Verifica que Node esté encendido.');
            }
        });
    }

    // --- 4. LÓGICA PARA VER EL HISTORIAL ---
    const modalHistorial = document.getElementById('modal-historial');
    const btnVerHistorial = document.getElementById('btn-ver-historial');
    const btnCerrarHistorial = document.getElementById('close-historial');
    const tablaBody = document.getElementById('tabla-body-historial');

    if (modalHistorial && btnVerHistorial && btnCerrarHistorial) {
        
        btnVerHistorial.addEventListener('click', async () => {
            modalHistorial.style.display = 'flex';
            // Mensaje de carga mientras esperamos al servidor
            tablaBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Cargando historial...</td></tr>';

            try {
                // Obtenemos el ID del estudiante desde localStorage
                const usuario = JSON.parse(localStorage.getItem('usuarioLogueado'));
                
                const response = await fetch(`http://localhost:3000/api/historial/${usuario.id}`);
                const data = await response.json();

                if (data.exito) {
                    tablaBody.innerHTML = ''; // Limpiamos el mensaje de carga

                    if (data.historial.length === 0) {
                        tablaBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Aún no tienes horas registradas.</td></tr>';
                        return;
                    }

                    // Recorremos cada registro y lo dibujamos en la tabla
                    data.historial.forEach(registro => {
                        // Limpiar la fecha para que se vea bonita (Y-M-D)
                        const fechaLimpia = new Date(registro.fecha_registro).toISOString().split('T')[0];
                        
                        // Configurar el color del estado
                        let estadoTexto = registro.estado_validacion || 'Pendiente';
                        let claseEstado = 'estado-pendiente';
                        if (estadoTexto.toLowerCase() === 'aprobada') claseEstado = 'estado-aprobada';
                        if (estadoTexto.toLowerCase() === 'rechazada') claseEstado = 'estado-rechazada';

                        const fila = `
                            <tr>
                                <td>${fechaLimpia}</td>
                                <td>${registro.horas_realizadas}</td>
                                <td>${registro.descripcion_actividades}</td>
                                <td class="${claseEstado}">${estadoTexto.charAt(0).toUpperCase() + estadoTexto.slice(1)}</td>
                            </tr>
                        `;
                        tablaBody.innerHTML += fila; // Agregamos la fila a la tabla
                    });
                }
            } catch (error) {
                console.error('Error al cargar historial:', error);
                tablaBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: red;">Error al conectar con el servidor.</td></tr>';
            }
        });

        // Cerrar la ventana con la "X"
        btnCerrarHistorial.addEventListener('click', () => {
            modalHistorial.style.display = 'none';
        });

        // Cerrar la ventana haciendo clic afuera
        window.addEventListener('click', (e) => {
            if (e.target === modalHistorial) {
                modalHistorial.style.display = 'none';
            }
        });
    }
});