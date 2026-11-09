document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. LÓGICA DE PROTECCIÓN Y USUARIO ---
    const usuarioGuardado = localStorage.getItem('usuarioLogueado');
    if (!usuarioGuardado) {
        window.location.href = 'login.html';
        return;
    } 
    
    const usuario = JSON.parse(usuarioGuardado);
    if (usuario.rol !== 'admin') {
        alert('Acceso denegado: No tienes permisos de administrador.');
        window.location.href = 'login.html';
        return;
    }
    
    document.getElementById('nombre-admin').textContent = `${usuario.nombres} (Admin)`;
    const esc = (texto) => String(texto ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    document.getElementById('btn-cerrar-sesion').addEventListener('click', () => {
        localStorage.removeItem('usuarioLogueado');
        window.location.href = 'login.html';
    });

    // --- 2. VARIABLES DEL DOM (EMPRESAS Y ESTUDIANTES) ---
    const tbodySolicitudes = document.getElementById('tbody-solicitudes');
    const contadorEmpresas = document.getElementById('contador-empresas');
    const btnActualizar = document.getElementById('btn-actualizar-tabla');
    const btnEliminar = document.getElementById('btn-eliminar-seleccion');
    const inputBuscar = document.getElementById('input-buscar');

    const tbodyEstudiantes = document.getElementById('tbody-estudiantes');
    const contadorEstudiantes = document.getElementById('contador-estudiantes');
    const inputBuscarEstudiante = document.getElementById('input-buscar-estudiante');
    const btnActualizarEstudiantes = document.getElementById('btn-actualizar-estudiantes');
    const btnEliminarEstudiantes = document.getElementById('btn-eliminar-estudiantes');

    window.listaEstudiantes = [];

    // --- 3. FUNCIÓN PARA RENDERIZAR Y CARGAR ESTUDIANTES ---
    const renderTablaEstudiantes = (estudiantesAMostrar) => {
        if (!tbodyEstudiantes) return;
        tbodyEstudiantes.innerHTML = '';

        if (estudiantesAMostrar.length === 0) {
            tbodyEstudiantes.innerHTML = '<tr><td colspan="9" style="text-align: center;">No se encontraron estudiantes.</td></tr>';
            if (contadorEstudiantes) contadorEstudiantes.textContent = 0;
            return;
        }

        estudiantesAMostrar.forEach(est => {
            const horasHechas = Number(est.horas_realizadas) || 0;
            const metaHoras = Number(est.meta_horas) || 0;
            const horasFaltantes = Math.max(0, metaHoras - horasHechas);

            let empresaAsignada = '<span style="color: #666; font-style: italic;">Sin asignar</span>';
            let tiempoPasantia = '<span style="color: #666; font-style: italic;">N/A</span>';

            if (est.empresa_nombre) {
                empresaAsignada = `
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 5px; width: 100%;">
                        <span style="font-weight: bold; text-align: center;">${esc(est.empresa_nombre)}</span>
                        <button onclick="desvincularEstudiante(${est.id})" style="background-color: #dc3545; color: white; border: none; padding: 6px; border-radius: 4px; font-size: 12px; cursor: pointer; width: 100%; font-weight: bold;" title="Remover asignación">✖ Desvincular</button>
                    </div>
                `;
                tiempoPasantia = esc(est.tiempo_pasantia);
            }

            const fila = `
                <tr>
                    <td style="text-align: center; vertical-align: middle;">
                        <input type="checkbox" class="chk-estudiante" value="${est.id}" style="transform: scale(1.5); cursor: pointer;">
                    </td>
                    <td style="font-weight: bold; vertical-align: middle;">${esc(est.cedula)}</td>
                    <td style="vertical-align: middle;">${esc(est.nombres)} ${esc(est.apellidos)}</td>
                    <td style="vertical-align: middle;">${esc(est.carrera_nombre || 'Sin carrera')}</td>
                    <td style="vertical-align: middle;">${esc(est.correo || 'No registrado')}</td>
                    <td style="font-weight: bold; color: #003366; vertical-align: middle; text-align: center;">${horasHechas} / ${metaHoras} hrs</td>
                    <td style="vertical-align: middle;">${empresaAsignada}</td>
                    <td style="vertical-align: middle; text-align: center;">${tiempoPasantia}</td>
                    <td style="font-weight: bold; color: ${horasFaltantes > 0 ? '#dc3545' : '#28a745'}; vertical-align: middle; text-align: center;">${horasFaltantes} hrs</td>
                </tr>
            `;
            tbodyEstudiantes.innerHTML += fila;
        });

        if (contadorEstudiantes) {
            contadorEstudiantes.textContent = estudiantesAMostrar.length;
        }
    };

    const cargarEstudiantes = async () => {
        if (!tbodyEstudiantes) return;
        tbodyEstudiantes.innerHTML = '<tr><td colspan="9" style="text-align: center;">Actualizando estudiantes... ⏳</td></tr>';
        try {
            const response = await fetch('http://localhost:3000/api/admin/estudiantes');
            const data = await response.json();
            if (data.exito) {
                window.listaEstudiantes = data.estudiantes;
                renderTablaEstudiantes(window.listaEstudiantes);
            }
        } catch (error) {
            console.error('Error al cargar estudiantes:', error);
            tbodyEstudiantes.innerHTML = '<tr><td colspan="9" style="text-align: center; color: red;">Error al conectar con el servidor.</td></tr>';
        }
    };

    if (inputBuscarEstudiante) {
        inputBuscarEstudiante.addEventListener('input', (e) => {
            const texto = e.target.value.toLowerCase().trim();
            const filtrados = window.listaEstudiantes.filter(est => {
                const cedula = (est.cedula || '').toLowerCase();
                const nombreCompleto = `${est.nombres} ${est.apellidos}`.toLowerCase();
                const carrera = (est.carrera_nombre || '').toLowerCase();
                return cedula.includes(texto) || nombreCompleto.includes(texto) || carrera.includes(texto);
            });
            renderTablaEstudiantes(filtrados);
        });
    }

    if (btnActualizarEstudiantes) {
        btnActualizarEstudiantes.addEventListener('click', cargarEstudiantes);
    }

    if (btnEliminarEstudiantes) {
        btnEliminarEstudiantes.addEventListener('click', async () => {
            const casillas = document.querySelectorAll('.chk-estudiante:checked');
            const idsAEliminar = Array.from(casillas).map(chk => chk.value);

            if (idsAEliminar.length === 0) {
                alert('⚠️ Seleccione al menos un estudiante marcando la casilla de la izquierda.');
                return;
            }

            if (confirm(`¿Está seguro de eliminar ${idsAEliminar.length} estudiante(s) seleccionado(s)?`)) {
                try {
                    const response = await fetch('http://localhost:3000/api/admin/estudiantes', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ids: idsAEliminar })
                    });
                    const data = await response.json();
                    if (data.exito) {
                        cargarEstudiantes();
                    } else {
                        alert('❌ Error: ' + data.mensaje);
                    }
                } catch (error) {
                    console.error('Error al eliminar estudiantes:', error);
                    alert('❌ Error de conexión.');
                }
            }
        });
    }

    // --- 4. CARGAR Y RENDERIZAR DATOS EN LA TABLA DE EMPRESAS ---
    window.listaSolicitudes = []; 

    const renderTabla = (solicitudesAMostrar) => {
        if (!tbodySolicitudes) return;

        tbodySolicitudes.innerHTML = '';
        let empresasAprobadas = 0;

        if (solicitudesAMostrar.length === 0) {
            tbodySolicitudes.innerHTML = '<tr><td colspan="7" style="text-align: center;">No se encontraron solicitudes.</td></tr>';
            if (contadorEmpresas) contadorEmpresas.textContent = 0;
            return;
        }

        solicitudesAMostrar.forEach(sol => {
            const estadoActual = sol.estado_aprobacion || 'Pendiente';
            
            if (estadoActual.toLowerCase() === 'aprobada') {
                empresasAprobadas++;
            }
            
            let botonesAccion = '';
            if (estadoActual.toLowerCase() === 'pendiente') {
                botonesAccion = `
                    <div style="display: flex; flex-direction: column; gap: 5px; width: 100%;">
                        <button onclick="cambiarEstado(${sol.id}, 'Aprobada')" style="background-color: #28a745; color: white; border: none; padding: 8px; cursor: pointer; border-radius: 4px; font-weight: bold; width: 100%;">Aprobar</button>
                        <button onclick="cambiarEstado(${sol.id}, 'Rechazada')" style="background-color: #dc3545; color: white; border: none; padding: 8px; cursor: pointer; border-radius: 4px; font-weight: bold; width: 100%;">Rechazar</button>
                    </div>
                `;
            } else if (estadoActual.toLowerCase() === 'aprobada') {
                botonesAccion = `
                    <button onclick="cambiarEstado(${sol.id}, 'Finalizado')" style="background-color: #6c757d; color: white; border: none; padding: 8px; cursor: pointer; border-radius: 4px; font-weight: bold; width: 100%;">Finalizar Vínculo</button>
                `;
            } else if (estadoActual.toLowerCase() === 'rechazada') {
                botonesAccion = `
                    <button onclick="cambiarEstado(${sol.id}, 'Pendiente')" style="background-color: #ffc107; color: black; border: none; padding: 8px; cursor: pointer; border-radius: 4px; font-weight: bold; width: 100%;">Reabrir Solicitud</button>
                `;
            } else if (estadoActual.toLowerCase() === 'finalizado') {
                botonesAccion = `
                    <button onclick="cambiarEstado(${sol.id}, 'Pendiente')" style="background-color: #17a2b8; color: white; border: none; padding: 8px; cursor: pointer; border-radius: 4px; font-weight: bold; width: 100%;">Reabrir Convenio</button>
                `;
            } else {
                botonesAccion = `<span style="color: #6c757d; font-weight: bold; font-style: italic;">Sin acciones</span>`;
            }

            const linkPdf = sol.ruta_documento 
                ? `<a href="http://localhost:3000/uploads/${encodeURIComponent(sol.ruta_documento)}" target="_blank" style="color: #003366; font-weight: bold; text-decoration: underline;">Ver PDF</a>` 
                : 'Sin archivo';

            const fila = `
                <tr>
                    <td style="text-align: center; vertical-align: middle;">
                        <input type="checkbox" class="chk-solicitud" value="${sol.id}" style="transform: scale(1.5); cursor: pointer;">
                    </td>
                    <td style="font-weight: bold; vertical-align: middle;">${esc(sol.codigo_seguimiento || 'N/A')}</td>
                    <td style="vertical-align: middle;">${esc(sol.nombre_empresa)}<br><small style="color: #666;">RUC: ${esc(sol.ruc)}</small></td>
                    <td style="vertical-align: middle;">
                        <div style="display: flex; flex-direction: column; gap: 5px; width: 100%;">
                            <span>${esc(sol.contacto_nombre)}</span>
                            <button onclick="verInfoContacto(${sol.id})" style="background-color: #007bff; color: white; border: none; padding: 6px; border-radius: 4px; font-size: 12px; cursor: pointer; font-weight: bold; width: 100%;">+ Ver Info</button>
                        </div>
                    </td>
                    <td style="vertical-align: middle; text-align: center;">${linkPdf}</td>
                    <td style="font-weight: bold; text-transform: capitalize; vertical-align: middle; text-align: center;">${esc(estadoActual)}</td>
                    <td style="vertical-align: middle;">${botonesAccion}</td>
                </tr>
            `;
            tbodySolicitudes.innerHTML += fila;
        });

        if (contadorEmpresas) {
            contadorEmpresas.textContent = empresasAprobadas;
        }
    };

    const cargarDatos = async () => {
        if (!tbodySolicitudes) return;
        tbodySolicitudes.innerHTML = '<tr><td colspan="7" style="text-align: center;">Actualizando datos... ⏳</td></tr>';

        try {
            const response = await fetch('http://localhost:3000/api/admin/solicitudes');
            const data = await response.json();

            if (data.exito) {
                window.listaSolicitudes = data.solicitudes;
                renderTabla(window.listaSolicitudes);
            }
        } catch (error) {
            console.error('Error al cargar solicitudes:', error);
            tbodySolicitudes.innerHTML = '<tr><td colspan="7" style="text-align: center; color: red;">Error de conexión con el servidor.</td></tr>';
        }
    };

    // --- 5. ACCIONES (BUSCAR, ACTUALIZAR Y ELIMINAR EMPRESAS) ---
    if (inputBuscar) {
        inputBuscar.addEventListener('input', (e) => {
            const textoBusqueda = e.target.value.toLowerCase().trim();
            const filtradas = window.listaSolicitudes.filter(sol => {
                const nombre = (sol.nombre_empresa || '').toLowerCase();
                const ruc = (sol.ruc || '').toLowerCase();
                const codigo = (sol.codigo_seguimiento || '').toLowerCase();
                const contacto = (sol.contacto_nombre || '').toLowerCase();
                return nombre.includes(textoBusqueda) || ruc.includes(textoBusqueda) || codigo.includes(textoBusqueda) || contacto.includes(textoBusqueda);
            });
            renderTabla(filtradas);
        });
    }

    if (btnActualizar) {
        btnActualizar.addEventListener('click', cargarDatos);
    }

    if (btnEliminar) {
        btnEliminar.addEventListener('click', async () => {
            const casillasMarcadas = document.querySelectorAll('.chk-solicitud:checked');
            const idsAEliminar = Array.from(casillasMarcadas).map(chk => chk.value);

            if (idsAEliminar.length === 0) {
                alert('⚠️ Seleccione al menos una empresa marcando la casilla de la izquierda.');
                return;
            }

            const confirmacion = confirm(`¿Está seguro de que desea eliminar ${idsAEliminar.length} registro(s)?\n\nEsta acción borrará los datos permanentemente.`);
            
            if (confirmacion) {
                try {
                    const response = await fetch('http://localhost:3000/api/admin/solicitudes', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ids: idsAEliminar })
                    });
                    const data = await response.json();
                    if (data.exito) {
                        cargarDatos(); 
                    } else {
                        alert('❌ Error: ' + data.mensaje);
                    }
                } catch (error) {
                    console.error('Error al eliminar:', error);
                    alert('❌ Error de conexión al intentar eliminar.');
                }
            }
        });
    }

    // --- 6. CAMBIAR ESTADO DE LA SOLICITUD ---
    window.cambiarEstado = async (id, nuevoEstado) => {
        if (!confirm(`¿Estás seguro de cambiar el estado a "${nuevoEstado}"?`)) return;

        try {
            const response = await fetch(`http://localhost:3000/api/admin/solicitudes/${id}/estado`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estado: nuevoEstado })
            });
            const data = await response.json();
            if (data.exito) {
                cargarDatos(); 
            } else {
                alert('❌ Error: ' + data.mensaje);
            }
        } catch (error) {
            console.error('Error al cambiar estado:', error);
            alert('❌ Error de conexión.');
        }
    };

    // --- 7. MODAL DE INFORMACIÓN DE CONTACTO ---
    const modalInfoContacto = document.getElementById('modal-info-contacto');
    const btnCerrarInfoContacto = document.getElementById('close-info-contacto');

    window.verInfoContacto = (id) => {
        const sol = window.listaSolicitudes.find(s => s.id === id);
        if (sol) {
            document.getElementById('info-direccion').textContent = sol.direccion || 'No especificada';
            document.getElementById('info-actividad').textContent = sol.actividad || 'No especificada';
            document.getElementById('info-nombre').textContent = sol.contacto_nombre || 'No especificado';
            document.getElementById('info-cargo').textContent = sol.contacto_cargo || 'No especificado';
            document.getElementById('info-telefono').textContent = sol.contacto_telefono || 'No especificado';
            document.getElementById('info-correo').textContent = sol.contacto_correo || 'No especificado';
            modalInfoContacto.style.display = 'flex';
        }
    };

    if (btnCerrarInfoContacto) {
        btnCerrarInfoContacto.addEventListener('click', () => {
            modalInfoContacto.style.display = 'none';
        });
    }

    window.addEventListener('click', (e) => {
        if (e.target === modalInfoContacto) {
            modalInfoContacto.style.display = 'none';
        }
    });

    // --- 8. GESTIÓN DE ESTUDIANTES (MODAL Y FORMULARIO) ---
    const modalEstudiante = document.getElementById('modal-estudiante');
    const btnAbrirModalEstudiante = document.getElementById('btn-nuevo-estudiante');
    const btnCerrarModalEstudiante = document.getElementById('close-estudiante');
    const formEstudiante = document.getElementById('form-registro-estudiante');
    const selectCarreras = document.getElementById('est-carrera');

    const cargarCarreras = async () => {
        try {
            const response = await fetch('http://localhost:3000/api/admin/carreras');
            const data = await response.json();
            
            if (data.exito) {
                selectCarreras.innerHTML = '<option value="">Seleccione una carrera...</option>';
                data.carreras.forEach(carrera => {
                    selectCarreras.innerHTML += `<option value="${carrera.id}">${esc(carrera.nombre)}</option>`;
                });
            }
        } catch (error) {
            console.error('Error al cargar carreras:', error);
            selectCarreras.innerHTML = '<option value="">Error al cargar carreras</option>';
        }
    };

    if (modalEstudiante && btnAbrirModalEstudiante && btnCerrarModalEstudiante) {
        btnAbrirModalEstudiante.addEventListener('click', () => {
            cargarCarreras();
            modalEstudiante.style.display = 'flex';
        });

        btnCerrarModalEstudiante.addEventListener('click', () => {
            modalEstudiante.style.display = 'none';
        });

        window.addEventListener('click', (e) => {
            if (e.target === modalEstudiante) {
                modalEstudiante.style.display = 'none';
            }
        });
    }

    if (formEstudiante) {
        formEstudiante.addEventListener('submit', async (e) => {
            e.preventDefault();

            const cedula = document.getElementById('est-cedula').value;
            const nombres = document.getElementById('est-nombres').value;
            const apellidos = document.getElementById('est-apellidos').value;
            const carrera_id = document.getElementById('est-carrera').value;
            const password = document.getElementById('est-password').value;

            try {
                const response = await fetch('http://localhost:3000/api/admin/estudiantes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cedula, nombres, apellidos, carrera_id, password })
                });

                const data = await response.json();

                if (data.exito) {
                    alert('✅ ' + data.mensaje);
                    formEstudiante.reset();
                    modalEstudiante.style.display = 'none';
                    cargarEstudiantes(); 
                } else {
                    alert('❌ Error: ' + data.mensaje);
                }
            } catch (error) {
                console.error('Error al registrar estudiante:', error);
                alert('❌ Error de conexión con el servidor.');
            }
        });
    }

    // --- 9. LÓGICA DE PESTAÑAS (TABS) ---
    const pestanas = [
        { boton: document.getElementById('btn-tab-convenios'),       seccion: document.getElementById('seccion-convenios'),       alAbrir: null },
        { boton: document.getElementById('btn-tab-estudiantes'),     seccion: document.getElementById('seccion-estudiantes'),     alAbrir: () => cargarEstudiantes() },
        { boton: document.getElementById('btn-tab-tutores'),         seccion: document.getElementById('seccion-tutores'),         alAbrir: () => cargarTutores() },
        { boton: document.getElementById('btn-tab-notificaciones'),  seccion: document.getElementById('seccion-notificaciones'),  alAbrir: () => cargarNotificaciones() }
    ];

    const abrirPestana = (activa) => {
        pestanas.forEach(p => {
            if (!p.boton || !p.seccion) return;
            const esActiva = p === activa;
            p.seccion.style.display = esActiva ? 'block' : 'none';
            p.boton.style.backgroundColor = esActiva ? '#003366' : '#e9ecef';
            p.boton.style.color = esActiva ? 'white' : '#333';
        });
        if (activa.alAbrir) activa.alAbrir();
    };

    pestanas.forEach(p => {
        if (p.boton) p.boton.addEventListener('click', () => abrirPestana(p));
    });

    // --- 10. GESTOR DE TUTORES (CRUD Y VINCULACIÓN) ---
    const tbodyTutores = document.getElementById('tbody-tutores');
    const inputBuscarTutor = document.getElementById('input-buscar-tutor');
    window.listaTutores = [];

    const renderTablaTutores = (tutoresAMostrar) => {
        if (!tbodyTutores) return;
        tbodyTutores.innerHTML = '';

        if (tutoresAMostrar.length === 0) {
            tbodyTutores.innerHTML = '<tr><td colspan="7" style="text-align: center;">No hay tutores registrados.</td></tr>';
            return;
        }

        tutoresAMostrar.forEach(tut => {
            const esActivo = tut.estado_cuenta === 'Activo';
            const colorEstado = esActivo ? '#28a745' : '#dc3545';
            const btnEstado = `<button onclick="cambiarEstadoTutor(${tut.id}, '${esActivo ? 'Inactivo' : 'Activo'}')" style="background-color: ${esActivo ? '#ffc107' : '#28a745'}; color: ${esActivo ? 'black' : 'white'}; border: none; padding: 8px; border-radius: 4px; cursor: pointer; font-weight: bold; width: 100%;">${esActivo ? 'Desactivar Cuenta' : 'Activar Cuenta'}</button>`;

            let bloqueEmpresa = '';
            if (tut.empresa_nombre) {
                bloqueEmpresa = `
                    <div style="display: flex; flex-direction: column; gap: 5px; align-items: center; width: 100%;">
                        <span style="font-weight: bold; color: #003366; text-align: center;">${esc(tut.empresa_nombre)}</span>
                        <button onclick="desvincularTutor(${tut.id})" style="background-color: #dc3545; color: white; border: none; padding: 6px; font-size: 12px; border-radius: 4px; font-weight: bold; cursor: pointer; width: 100%;">✖ Desvincular</button>
                    </div>
                `;
            } else {
                bloqueEmpresa = `
                    <div style="display: flex; flex-direction: column; gap: 5px; align-items: center; width: 100%;">
                        <span style="color: #666; font-style: italic; text-align: center;">Sin asignar</span>
                        <button onclick="abrirModalVincularTutor(${tut.id})" style="background-color: #17a2b8; color: white; border: none; padding: 6px; font-size: 12px; border-radius: 4px; font-weight: bold; cursor: pointer; width: 100%;">🔗 Vincular Empresa</button>
                    </div>
                `;
            }

            const fila = `
                <tr>
                    <td style="text-align: center; vertical-align: middle;"><input type="checkbox" class="chk-tutor" value="${tut.id}" style="transform: scale(1.5);"></td>
                    <td style="font-weight: bold; vertical-align: middle;">${esc(tut.cedula)}</td>
                    <td style="vertical-align: middle;">${esc(tut.nombres)} ${esc(tut.apellidos)}</td>
                    <td style="vertical-align: middle;">${esc(tut.correo)}</td>
                    <td style="font-weight: bold; color: ${colorEstado}; vertical-align: middle; text-align: center;">${tut.estado_cuenta}</td>
                    <td style="vertical-align: middle;">${bloqueEmpresa}</td>
                    <td style="vertical-align: middle;">${btnEstado}</td>
                </tr>
            `;
            tbodyTutores.innerHTML += fila;
        });
    };

    const contadorTutores = document.getElementById('contador-tutores');
    
    const cargarTutores = async () => {
        if (!tbodyTutores) return;
        tbodyTutores.innerHTML = '<tr><td colspan="7" style="text-align: center;">Cargando...</td></tr>';
        try {
            const res = await fetch('http://localhost:3000/api/admin/tutores');
            const data = await res.json();
            if (data.exito) {
                window.listaTutores = data.tutores;
                renderTablaTutores(window.listaTutores);
                if (contadorTutores) contadorTutores.textContent = data.tutores.length;
            }
        } catch (error) {
            tbodyTutores.innerHTML = '<tr><td colspan="7" style="text-align: center; color: red;">Error al cargar.</td></tr>';
        }
    };

    if (inputBuscarTutor) {
        inputBuscarTutor.addEventListener('input', (e) => {
            const texto = e.target.value.toLowerCase().trim();
            const filtrados = window.listaTutores.filter(t => 
                (t.nombres + ' ' + t.apellidos).toLowerCase().includes(texto) || 
                t.cedula.includes(texto)
            );
            renderTablaTutores(filtrados);
        });
    }
    document.getElementById('btn-actualizar-tutores')?.addEventListener('click', cargarTutores);

    window.cambiarEstadoTutor = async (id, nuevoEstado) => {
        if(!confirm(`¿Cambiar cuenta a ${nuevoEstado}?`)) return;
        await fetch(`http://localhost:3000/api/admin/tutores/${id}/estado`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({estado_cuenta: nuevoEstado}) });
        cargarTutores();
    };

    window.desvincularTutor = async (id) => {
        if(!confirm(`¿Desvincular a este tutor de la empresa?`)) return;
        await fetch(`http://localhost:3000/api/admin/tutores/${id}/desvincular`, { method: 'PUT' });
        cargarTutores();
    };

    document.getElementById('btn-eliminar-tutores')?.addEventListener('click', async () => {
        const ids = Array.from(document.querySelectorAll('.chk-tutor:checked')).map(c => c.value);
        if(ids.length === 0) return alert('Seleccione tutores a eliminar');
        if(confirm(`¿Eliminar ${ids.length} tutor(es)?`)) {
            await fetch('http://localhost:3000/api/admin/tutores', { method: 'DELETE', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ids}) });
            cargarTutores();
        }
    });

    const modalTutor = document.getElementById('modal-tutor');
    const modalVincular = document.getElementById('modal-vincular-tutor');

    document.getElementById('btn-nuevo-tutor')?.addEventListener('click', () => modalTutor.style.display = 'flex');
    document.getElementById('close-tutor')?.addEventListener('click', () => modalTutor.style.display = 'none');
    document.getElementById('close-vincular-tutor')?.addEventListener('click', () => modalVincular.style.display = 'none');

    document.getElementById('form-registro-tutor')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            cedula: document.getElementById('tut-cedula').value,
            nombres: document.getElementById('tut-nombres').value,
            apellidos: document.getElementById('tut-apellidos').value,
            correo: document.getElementById('tut-correo').value,
            password: document.getElementById('tut-password').value
        };
        const res = await fetch('http://localhost:3000/api/admin/tutores', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
        const data = await res.json();
        alert(data.mensaje);
        if (data.exito) { document.getElementById('form-registro-tutor').reset(); modalTutor.style.display = 'none'; cargarTutores(); }
    });

    window.abrirModalVincularTutor = async (id) => {
        document.getElementById('vincular-tutor-id').value = id;
        const select = document.getElementById('select-vincular-empresa');
        select.innerHTML = '<option value="">Cargando empresas...</option>';
        modalVincular.style.display = 'flex';

        const res = await fetch('http://localhost:3000/api/admin/empresas-aprobadas');
        const data = await res.json();
        if (data.exito) {
            select.innerHTML = '<option value="">Seleccione empresa...</option>';
            data.empresas.forEach(emp => select.innerHTML += `<option value="${emp.id}">${esc(emp.nombre_empresa)}</option>`);
        }
    };

    document.getElementById('form-vincular-tutor')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('vincular-tutor-id').value;
        const empresa_id = document.getElementById('select-vincular-empresa').value;
        await fetch(`http://localhost:3000/api/admin/tutores/${id}/vincular`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({empresa_id}) });
        modalVincular.style.display = 'none';
        cargarTutores();
    });

    window.addEventListener('click', (e) => {
        if (e.target === modalTutor) modalTutor.style.display = 'none';
        if (e.target === modalVincular) modalVincular.style.display = 'none';
    });

    // --- 11. GESTIÓN DEL MOTOR DE ASIGNACIONES ---
    const modalAsignar = document.getElementById('modal-asignar');
    const btnRealAsignar = document.getElementById('btn-abrir-asignar');
    const btnCerrarAsignar = document.getElementById('close-asignar');
    const formAsignacion = document.getElementById('form-asignacion');
    const selectEstudianteAsig = document.getElementById('select-estudiante-asig');
    const selectEmpresaAsig = document.getElementById('select-empresa-asig');

    const cargarDatosAsignacion = async () => {
        try {
            const respEst = await fetch('http://localhost:3000/api/admin/estudiantes');
            const dataEst = await respEst.json();
            if (dataEst.exito) {
                selectEstudianteAsig.innerHTML = '<option value="">Seleccione un estudiante...</option>';
                dataEst.estudiantes.forEach(est => {
                    selectEstudianteAsig.innerHTML += `<option value="${est.id}">${esc(est.nombres)} ${esc(est.apellidos)} (Cédula: ${esc(est.cedula)})</option>`;
                });
            }
        } catch (e) {
            console.error('Error cargando estudiantes para asignar:', e);
        }

        try {
            const respEmp = await fetch('http://localhost:3000/api/admin/empresas-aprobadas');
            const dataEmp = await respEmp.json();
            if (dataEmp.exito) {
                selectEmpresaAsig.innerHTML = '<option value="">Seleccione una empresa aprobada...</option>';
                dataEmp.empresas.forEach(emp => {
                    selectEmpresaAsig.innerHTML += `<option value="${emp.id}">${esc(emp.nombre_empresa)} (RUC: ${esc(emp.ruc)})</option>`;
                });
            }
        } catch (e) {
            console.error('Error cargando empresas aprobadas:', e);
        }
    };

    if (btnRealAsignar && modalAsignar && btnCerrarAsignar) {
        btnRealAsignar.addEventListener('click', () => {
            cargarDatosAsignacion();
            modalAsignar.style.display = 'flex';
        });
        btnCerrarAsignar.addEventListener('click', () => {
            modalAsignar.style.display = 'none';
        });
        window.addEventListener('click', (e) => {
            if (e.target === modalAsignar) {
                modalAsignar.style.display = 'none';
            }
        });
    }

    if (formAsignacion) {
        formAsignacion.addEventListener('submit', async (e) => {
            e.preventDefault();
            const estudiante_id = selectEstudianteAsig.value;
            const empresa_id = selectEmpresaAsig.value;
            const tiempo_pasantia = document.getElementById('input-tiempo-pasantia').value;

            try {
                const response = await fetch('http://localhost:3000/api/admin/asignaciones', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ estudiante_id, empresa_id, tiempo_pasantia })
                });

                const data = await response.json();

                if (data.exito) {
                    alert('✅ ' + data.mensaje);
                    formAsignacion.reset();
                    modalAsignar.style.display = 'none';
                    cargarEstudiantes(); 
                } else {
                    alert('❌ Error: ' + data.mensaje);
                }
            } catch (error) {
                console.error('Error al registrar asignación:', error);
                alert('❌ Error de conexión con el servidor.');
            }
        });
    }

    window.desvincularEstudiante = async (estudiante_id) => {
        if (!confirm('¿Estás seguro de que deseas desvincular a este estudiante de su empresa actual?')) return;
        try {
            const response = await fetch(`http://localhost:3000/api/admin/asignaciones/${estudiante_id}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            if (data.exito) {
                cargarEstudiantes();
            } else {
                alert('❌ Error: ' + data.mensaje);
            }
        } catch (error) {
            console.error('Error al desvincular:', error);
            alert('❌ Error de conexión con el servidor.');
        }
    };
    
    // ==========================================
    // NOTIFICACIONES: SOLICITUDES DE INCORPORACIÓN
    // ==========================================
    const tbodyNotificaciones = document.getElementById('tbody-notificaciones');
    const badgeNotifAdmin = document.getElementById('badge-notificaciones-admin');

    const cargarNotificaciones = async () => {
        if (!tbodyNotificaciones) return;

        try {
            const res = await fetch('http://localhost:3000/api/admin/solicitudes-incorporacion');
            const data = await res.json();
            const solicitudes = data.solicitudes || [];

            if (badgeNotifAdmin) {
                badgeNotifAdmin.textContent = solicitudes.length;
                badgeNotifAdmin.style.display = solicitudes.length > 0 ? 'inline-block' : 'none';
            }

            tbodyNotificaciones.innerHTML = '';

            if (solicitudes.length === 0) {
                tbodyNotificaciones.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px; color: #666;">No hay solicitudes de incorporación pendientes.</td></tr>';
                return;
            }

            solicitudes.forEach(s => {
                const fecha = new Date(s.fecha_solicitud).toLocaleDateString('es-ES');
                const mensaje = `El tutor <strong>${esc(s.tutor_nombres)} ${esc(s.tutor_apellidos)}</strong> solicita incorporar al estudiante a la empresa <strong>${esc(s.nombre_empresa)}</strong> para el puesto de <em>${esc(s.oferta_titulo)}</em>.`;

                const btnAprobar = `<button onclick="procesarIncorporacion(${s.solicitud_id}, ${s.estudiante_id}, ${s.empresa_id}, 'Aprobar')" style="background: #28a745; color: white; border: none; padding: 8px; border-radius: 4px; cursor: pointer; font-weight: bold; width: 100%;">✔ Aprobar vinculación</button>`;
                const btnRechazar = `<button onclick="procesarIncorporacion(${s.solicitud_id}, ${s.estudiante_id}, ${s.empresa_id}, 'Rechazar')" style="background: #dc3545; color: white; border: none; padding: 8px; border-radius: 4px; cursor: pointer; font-weight: bold; width: 100%;">✖ Rechazar</button>`;

                tbodyNotificaciones.innerHTML += `
                    <tr>
                        <td style="vertical-align: middle;">${fecha}</td>
                        <td style="vertical-align: middle;"><strong>${esc(s.nombres)} ${esc(s.apellidos)}</strong><br><span style="color: #666; font-size: 13px;">C.C: ${esc(s.cedula)}</span></td>
                        <td style="vertical-align: middle;">${mensaje}</td>
                        <td style="text-align: center; vertical-align: middle; width: 180px;">
                            <div style="display: flex; flex-direction: column; gap: 5px; align-items: center; width: 100%;">
                                ${btnAprobar}
                                ${btnRechazar}
                            </div>
                        </td>
                    </tr>
                `;
            });
        } catch (error) {
            console.error('Error al cargar notificaciones:', error);
            tbodyNotificaciones.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px; color: red;">Error al conectar con el servidor.</td></tr>';
        }
    };

    window.procesarIncorporacion = async (solicitud_id, estudiante_id, empresa_id, accion) => {
        let tiempo_pasantia = 'No definido';

        if (accion === 'Aprobar') {
            if (!confirm('¿Aprobar la vinculación? Si el estudiante tenía otra empresa, quedará desvinculado de ella.')) return;
            tiempo_pasantia = prompt('Tiempo estimado de la pasantía (ej. 3 meses, 240 horas):', '3 meses');
            if (tiempo_pasantia === null) return; 
        } else {
            if (!confirm('¿Rechazar esta solicitud del tutor?')) return;
        }

        try {
            const res = await fetch('http://localhost:3000/api/admin/procesar-incorporacion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ solicitud_id, estudiante_id, empresa_id, accion, tiempo_pasantia })
            });
            const data = await res.json();
            if (data.exito) {
                alert('✅ ' + data.mensaje);
                cargarNotificaciones(); 
                cargarEstudiantes();    
            } else {
                alert('❌ Error: ' + data.mensaje);
                cargarNotificaciones();
            }
        } catch (error) {
            console.error('Error al procesar:', error);
            alert('❌ Error de conexión al procesar la solicitud.');
        }
    };

    document.getElementById('btn-actualizar-notificaciones')?.addEventListener('click', cargarNotificaciones);

    // --- 12. CARGA INICIAL ---
    cargarDatos();
    cargarEstudiantes();
    cargarTutores(); // <--- SOLUCIÓN: ESTO ACTUALIZARÁ EL CONTADOR DE TUTORES AL INICIAR
    cargarNotificaciones();
    setInterval(cargarNotificaciones, 60000); 
});