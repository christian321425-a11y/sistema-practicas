document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. SEGURIDAD Y DATOS DEL USUARIO ---
    const usuarioGuardado = localStorage.getItem('usuarioLogueado');
    if (!usuarioGuardado) {
        window.location.href = 'login.html';
        return;
    } 
    
    const usuario = JSON.parse(usuarioGuardado);
    if (usuario.rol !== 'estudiante') {
        alert('Acceso denegado: Este panel es solo para estudiantes.');
        window.location.href = 'login.html';
        return;
    }

    // Colocar nombre en la barra de navegación
    document.getElementById('nombre-estudiante').textContent = `${usuario.nombres} ${usuario.apellidos}`;

    // Botón Cerrar Sesión
    document.getElementById('btn-cerrar-sesion').addEventListener('click', () => {
        localStorage.removeItem('usuarioLogueado');
        window.location.href = 'login.html';
    });

    // --- 2. VARIABLES DEL DOM ---
    const textoProgreso = document.getElementById('texto-progreso');
    const badgeEmpresa = document.getElementById('badge-empresa');
    const carreraEstudiante = document.getElementById('carrera-estudiante');
    const tbodyHistorial = document.getElementById('tbody-historial-estudiante');

    // --- 3. CARGAR PROGRESO Y EMPRESA ---
    const cargarProgreso = async () => {
        try {
            const res = await fetch(`http://localhost:3000/api/progreso/${usuario.id}`);
            const data = await res.json();
            
            if (data.exito) {
                const p = data.datos;
                carreraEstudiante.textContent = p.nombre_carrera || 'Sin carrera asignada';
                textoProgreso.textContent = `${p.total_horas} / ${p.meta_horas}`;

                if (p.nombre_empresa) {
                    badgeEmpresa.textContent = `Realizando prácticas en: ${p.nombre_empresa}`;
                    badgeEmpresa.style.backgroundColor = '#d4edda';
                    badgeEmpresa.style.color = '#155724';
                    badgeEmpresa.style.borderColor = '#c3e6cb';
                } else {
                    badgeEmpresa.textContent = 'Pendiente de asignación de empresa';
                    badgeEmpresa.style.backgroundColor = '#fff3cd';
                    badgeEmpresa.style.color = '#856404';
                    badgeEmpresa.style.borderColor = '#ffeeba';
                }
            }
        } catch (error) {
            console.error('Error al cargar progreso:', error);
        }
    };

    // --- 4. CARGAR HISTORIAL DE HORAS ---
    const cargarHistorial = async () => {
        try {
            const res = await fetch(`http://localhost:3000/api/historial/${usuario.id}`);
            const data = await res.json();
            
            if (data.exito) {
                tbodyHistorial.innerHTML = '';
                if (data.historial.length === 0) {
                    tbodyHistorial.innerHTML = '<tr><td colspan="4" style="text-align: center;">Aún no has registrado horas.</td></tr>';
                    return;
                }

                data.historial.forEach(h => {
                    // Colores de estado
                    let colorEstado = '#ffc107'; // Pendiente
                    if (h.estado_validacion === 'Aprobada') colorEstado = '#28a745';
                    if (h.estado_validacion === 'Rechazada') colorEstado = '#dc3545';

                    // Formatear fecha a texto legible
                    const fechaObj = new Date(h.fecha_registro);
                    const fechaLocal = new Date(fechaObj.getTime() + Math.abs(fechaObj.getTimezoneOffset() * 60000));
                    const fechaTexto = fechaLocal.toLocaleDateString('es-ES');

                    tbodyHistorial.innerHTML += `
                        <tr>
                            <td>${fechaTexto}</td>
                            <td style="font-weight: bold;">${h.horas_realizadas}</td>
                            <td>${h.descripcion_actividades}</td>
                            <td style="font-weight: bold; color: ${colorEstado}; text-transform: capitalize;">${h.estado_validacion}</td>
                        </tr>
                    `;
                });
            }
        } catch (error) {
            console.error('Error al cargar historial:', error);
            tbodyHistorial.innerHTML = '<tr><td colspan="4" style="text-align: center; color: red;">Error al cargar datos.</td></tr>';
        }
    };

    // --- 5. LÓGICA DE MODALES ---
    const modalRegistrar = document.getElementById('modal-registrar-horas');
    const modalHistorial = document.getElementById('modal-historial');

    document.getElementById('btn-abrir-registro').addEventListener('click', () => modalRegistrar.style.display = 'flex');
    document.getElementById('close-registrar-horas').addEventListener('click', () => modalRegistrar.style.display = 'none');
    
    document.getElementById('btn-abrir-historial').addEventListener('click', () => {
        cargarHistorial(); // Actualizar al abrir
        modalHistorial.style.display = 'flex';
    });
    document.getElementById('close-historial').addEventListener('click', () => modalHistorial.style.display = 'none');

    // --- 6. ENVIAR FORMULARIO DE HORAS ---
    document.getElementById('form-registro-horas').addEventListener('submit', async (e) => {
        e.preventDefault();

        const payload = {
            estudiante_id: usuario.id,
            fecha: document.getElementById('hora-fecha').value,
            horas: document.getElementById('hora-cantidad').value,
            descripcion: document.getElementById('hora-descripcion').value
        };

        try {
            const res = await fetch('http://localhost:3000/api/horas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (data.exito) {
                alert('✅ ' + data.mensaje);
                document.getElementById('form-registro-horas').reset();
                modalRegistrar.style.display = 'none';
                
                // Recargar interfaz
                cargarProgreso();
                cargarHistorial();
            } else {
                alert('❌ Error: ' + data.mensaje);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('❌ Error de conexión al servidor.');
        }
    });

    // Cerrar modales al hacer clic fuera
    window.addEventListener('click', (e) => {
        if (e.target === modalRegistrar) modalRegistrar.style.display = 'none';
        if (e.target === modalHistorial) modalHistorial.style.display = 'none';
    });

    // --- 7. CARGA INICIAL ---
    cargarProgreso();
});