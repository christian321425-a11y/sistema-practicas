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
                    <span style="font-weight: bold;">${est.empresa_nombre}</span><br>
                    <button onclick="desvincularEstudiante(${est.id})" style="background-color: #dc3545; color: white; border: none; padding: 4px 8px; border-radius: 3px; font-size: 11px; cursor: pointer; margin-top: 5px;" title="Remover asignación">✖ Desvincular</button>
                `;
                tiempoPasantia = est.tiempo_pasantia;
            }

            const fila = `
                <tr>
                    <td style="text-align: center;">
                        <input type="checkbox" class="chk-estudiante" value="${est.id}" style="transform: scale(1.5); cursor: pointer;">
                    </td>
                    <td style="font-weight: bold;">${est.cedula}</td>
                    <td>${est.nombres} ${est.apellidos}</td>
                    <td>${est.carrera_nombre || 'Sin carrera'}</td>
                    <td>${est.correo || 'No registrado'}</td>
                    <td style="font-weight: bold; color: #003366;">${horasHechas} / ${metaHoras} hrs</td>
                    <td>${empresaAsignada}</td>
                    <td>${tiempoPasantia}</td>
                    <td style="font-weight: bold; color: ${horasFaltantes > 0 ? '#dc3545' : '#28a745'};">${horasFaltantes} hrs</td>
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

    // Buscador en tiempo real para estudiantes
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

    // Botón eliminar seleccionados para estudiantes
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
                    <div style="display: flex; gap: 15px; justify-content: center;">
                        <button onclick="cambiarEstado(${sol.id}, 'Aprobada')" style="background-color: #28a745; color: white; border: none; padding: 8px 15px; cursor: pointer; border-radius: 5px; font-weight: bold; flex: 1; margin: 0;">Aprobar</button>
                        <button onclick="cambiarEstado(${sol.id}, 'Rechazada')" style="background-color: #dc3545; color: white; border: none; padding: 8px 15px; cursor: pointer; border-radius: 5px; font-weight: bold; flex: 1; margin: 0;">Rechazar</button>
                    </div>
                `;
            } else if (estadoActual.toLowerCase() === 'aprobada') {
                botonesAccion = `
                    <button onclick="cambiarEstado(${sol.id}, 'Finalizado')" style="background-color: #6c757d; color: white; border: none; padding: 8px 15px; cursor: pointer; border-radius: 5px; font-weight: bold; width: 100%; margin: 0;">Finalizar Vínculo</button>
                `;
            } else if (estadoActual.toLowerCase() === 'rechazada') {
                botonesAccion = `
                    <button onclick="cambiarEstado(${sol.id}, 'Pendiente')" style="background-color: #ffc107; color: black; border: none; padding: 8px 15px; cursor: pointer; border-radius: 5px; font-weight: bold; width: 100%; margin: 0;">Reabrir Solicitud</button>
                `;
            } else if (estadoActual.toLowerCase() === 'finalizado') {
                botonesAccion = `
                    <button onclick="cambiarEstado(${sol.id}, 'Pendiente')" style="background-color: #17a2b8; color: white; border: none; padding: 8px 15px; cursor: pointer; border-radius: 5px; font-weight: bold; width: 100%; margin: 0;">Reabrir Convenio</button>
                `;
            } else {
                botonesAccion = `<span style="color: #6c757d; font-weight: bold; font-style: italic;">Sin acciones</span>`;
            }

            const linkPdf = sol.ruta_documento 
                ? `<a href="http://localhost:3000/uploads/${sol.ruta_documento}" target="_blank" style="color: #003366; font-weight: bold; text-decoration: underline;">Ver PDF</a>` 
                : 'Sin archivo';

            const fila = `
                <tr>
                    <td style="text-align: center;">
                        <input type="checkbox" class="chk-solicitud" value="${sol.id}" style="transform: scale(1.5); cursor: pointer;">
                    </td>
                    <td style="font-weight: bold;">${sol.codigo_seguimiento || 'N/A'}</td>
                    <td>${sol.nombre_empresa}<br><small style="color: #666;">RUC: ${sol.ruc}</small></td>
                    <td>
                        ${sol.contacto_nombre}<br>
                        <button onclick="verInfoContacto(${sol.id})" style="background-color: #007bff; color: white; border: none; padding: 4px 10px; border-radius: 3px; font-size: 12px; cursor: pointer; margin-top: 5px;">+ Ver Info</button>
                    </td>
                    <td>${linkPdf}</td>
                    <td style="font-weight: bold; text-transform: capitalize;">${estadoActual}</td>
                    <td>${botonesAccion}</td>
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

                return nombre.includes(textoBusqueda) || 
                       ruc.includes(textoBusqueda) || 
                       codigo.includes(textoBusqueda) || 
                       contacto.includes(textoBusqueda);
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
                    selectCarreras.innerHTML += `<option value="${carrera.id}">${carrera.nombre}</option>`;
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

    // --- 9. LÓGICA DE PESTAÑAS (TABS) 3 SECCIONES ---
    const btnTabConvenios = document.getElementById('btn-tab-convenios');
    const btnTabEstudiantes = document.getElementById('btn-tab-estudiantes');
    const btnTabTutores = document.getElementById('btn-tab-tutores');
    
    const seccionConvenios = document.getElementById('seccion-convenios');
    const seccionEstudiantes = document.getElementById('seccion-estudiantes');
    const seccionTutores = document.getElementById('seccion-tutores');

    const resetTabs = () => {
        [btnTabConvenios, btnTabEstudiantes, btnTabTutores].forEach(btn => {
            if(btn) { btn.style.backgroundColor = '#e9ecef'; btn.style.color = '#333'; }
        });
        [seccionConvenios, seccionEstudiantes, seccionTutores].forEach(sec => {
            if(sec) sec.style.display = 'none';
        });
    };

    if (btnTabConvenios && btnTabEstudiantes && btnTabTutores) {
        btnTabConvenios.addEventListener('click', () => {
            resetTabs();
            seccionConvenios.style.display = 'block';
            btnTabConvenios.style.backgroundColor = '#003366'; btnTabConvenios.style.color = 'white';
        });
        btnTabEstudiantes.addEventListener('click', () => {
            resetTabs();
            seccionEstudiantes.style.display = 'block';
            btnTabEstudiantes.style.backgroundColor = '#003366'; btnTabEstudiantes.style.color = 'white';
            cargarEstudiantes(); 
        });
        btnTabTutores.addEventListener('click', () => {
            resetTabs();
            seccionTutores.style.display = 'block';
            btnTabTutores.style.backgroundColor = '#003366'; btnTabTutores.style.color = 'white';
            cargarTutores(); // Llama a la nueva función de tutores
        });
    }

    // --- 10. GESTOR DE TUTORES (CRUD Y VINCULACIÓN) ---
    const tbodyTutores = document.getElementById('tbody-tutores');
    const inputBuscarTutor = document.getElementById('input-buscar-tutor');
    window.listaTutores = [];

    // Renderizar tabla
    const renderTablaTutores = (tutoresAMostrar) => {
        if (!tbodyTutores) return;
        tbodyTutores.innerHTML = '';

        if (tutoresAMostrar.length === 0) {
            tbodyTutores.innerHTML = '<tr><td colspan="7" style="text-align: center;">No hay tutores registrados.</td></tr>';
            return;
        }

        tutoresAMostrar.forEach(tut => {
            // Botón Activar/Desactivar
            const esActivo = tut.estado_cuenta === 'Activo';
            const colorEstado = esActivo ? '#28a745' : '#dc3545';
            const btnEstado = `<button onclick="cambiarEstadoTutor(${tut.id}, '${esActivo ? 'Inactivo' : 'Activo'}')" style="background-color: ${esActivo ? '#ffc107' : '#28a745'}; color: ${esActivo ? 'black' : 'white'}; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; font-weight: bold; width: 100%;">${esActivo ? 'Desactivar Cuenta' : 'Activar Cuenta'}</button>`;

            // Lógica Empresa Vinculada
            let bloqueEmpresa = '';
            if (tut.empresa_nombre) {
                bloqueEmpresa = `
                    <span style="font-weight: bold; color: #003366;">${tut.empresa_nombre}</span><br>
                    <button onclick="desvincularTutor(${tut.id})" style="background-color: #dc3545; color: white; border: none; padding: 3px 8px; font-size: 11px; border-radius: 3px; cursor: pointer; margin-top: 5px;">✖ Desvincular</button>
                `;
            } else {
                bloqueEmpresa = `
                    <span style="color: #666; font-style: italic;">Sin asignar</span><br>
                    <button onclick="abrirModalVincularTutor(${tut.id})" style="background-color: #17a2b8; color: white; border: none; padding: 3px 8px; font-size: 11px; border-radius: 3px; cursor: pointer; margin-top: 5px;">🔗 Vincular Empresa</button>
                `;
            }

            const fila = `
                <tr>
                    <td style="text-align: center;"><input type="checkbox" class="chk-tutor" value="${tut.id}" style="transform: scale(1.5);"></td>
                    <td style="font-weight: bold;">${tut.cedula}</td>
                    <td>${tut.nombres} ${tut.apellidos}</td>
                    <td>${tut.correo}</td>
                    <td style="font-weight: bold; color: ${colorEstado};">${tut.estado_cuenta}</td>
                    <td>${bloqueEmpresa}</td>
                    <td>${btnEstado}</td>
                </tr>
            `;
            tbodyTutores.innerHTML += fila;
        });
    };

    // Cargar Tutores
    const contadorTutores = document.getElementById('contador-tutores');
    const cargarTutores = async () => {
        tbodyTutores.innerHTML = '<tr><td colspan="7" style="text-align: center;">Cargando...</td></tr>';
        try {
            const res = await fetch('http://localhost:3000/api/admin/tutores');
            const data = await res.json();
            if (data.exito) {
                window.listaTutores = data.tutores;
                renderTablaTutores(window.listaTutores);
                if (contadorTutores) contadorTutores.textContent = data.tutores.length; // Actualiza la tarjeta 3
            }
        } catch (error) {
            tbodyTutores.innerHTML = '<tr><td colspan="7" style="text-align: center; color: red;">Error al cargar.</td></tr>';
        }
    };

    // Búsqueda Tutores
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

    // Acciones Globales: Estado, Desvincular y Eliminar
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

    // Modales de Tutor
    const modalTutor = document.getElementById('modal-tutor');
    const modalVincular = document.getElementById('modal-vincular-tutor');

    document.getElementById('btn-nuevo-tutor')?.addEventListener('click', () => modalTutor.style.display = 'flex');
    document.getElementById('close-tutor')?.addEventListener('click', () => modalTutor.style.display = 'none');
    document.getElementById('close-vincular-tutor')?.addEventListener('click', () => modalVincular.style.display = 'none');

    // Submit Crear Tutor
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

    // Abrir Modal Vincular
    window.abrirModalVincularTutor = async (id) => {
        document.getElementById('vincular-tutor-id').value = id;
        const select = document.getElementById('select-vincular-empresa');
        select.innerHTML = '<option value="">Cargando empresas...</option>';
        modalVincular.style.display = 'flex';

        const res = await fetch('http://localhost:3000/api/admin/empresas-aprobadas');
        const data = await res.json();
        if (data.exito) {
            select.innerHTML = '<option value="">Seleccione empresa...</option>';
            data.empresas.forEach(emp => select.innerHTML += `<option value="${emp.id}">${emp.nombre_empresa}</option>`);
        }
    };

    // Submit Vincular Tutor
    document.getElementById('form-vincular-tutor')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('vincular-tutor-id').value;
        const empresa_id = document.getElementById('select-vincular-empresa').value;
        await fetch(`http://localhost:3000/api/admin/tutores/${id}/vincular`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({empresa_id}) });
        modalVincular.style.display = 'none';
        cargarTutores();
    });

    // Cerrar modales al hacer clic fuera
    window.addEventListener('click', (e) => {
        if (e.target === modalTutor) modalTutor.style.display = 'none';
        if (e.target === modalVincular) modalVincular.style.display = 'none';
    });

    // --- 11. GESTIÓN DEL MOTOR DE ASIGNACIONES ---
    const modalAsignar = document.getElementById('modal-asignar');
    const btnRealAsignar = document.getElementById('btn-abrir-asignar'); // Ahora busca el botón por su ID exacto
    const btnCerrarAsignar = document.getElementById('close-asignar');
    const formAsignacion = document.getElementById('form-asignacion');
    const selectEstudianteAsig = document.getElementById('select-estudiante-asig');
    const selectEmpresaAsig = document.getElementById('select-empresa-asig');

    // Buscamos específicamente el botón de la Tarjeta 3 por su texto o clase si es necesario
    const botonesTarjeta = document.querySelectorAll('.card button');
    
    botonesTarjeta.forEach(b => {
        if (b.textContent.includes('Asignar Estudiante')) {
            btnRealAsignar = b;
        }
    });

    const cargarDatosAsignacion = async () => {
        // Cargar estudiantes para el select
        try {
            const respEst = await fetch('http://localhost:3000/api/admin/estudiantes');
            const dataEst = await respEst.json();
            if (dataEst.exito) {
                selectEstudianteAsig.innerHTML = '<option value="">Seleccione un estudiante...</option>';
                dataEst.estudiantes.forEach(est => {
                    selectEstudianteAsig.innerHTML += `<option value="${est.id}">${est.nombres} ${est.apellidos} (Cédula: ${est.cedula})</option>`;
                });
            }
        } catch (e) {
            console.error('Error cargando estudiantes para asignar:', e);
        }

        // Cargar empresas aprobadas para el select
        try {
            const respEmp = await fetch('http://localhost:3000/api/admin/empresas-aprobadas');
            const dataEmp = await respEmp.json();
            if (dataEmp.exito) {
                selectEmpresaAsig.innerHTML = '<option value="">Seleccione una empresa aprobada...</option>';
                dataEmp.empresas.forEach(emp => {
                    selectEmpresaAsig.innerHTML += `<option value="${emp.id}">${emp.nombre_empresa} (RUC: ${emp.ruc})</option>`;
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
                    cargarEstudiantes(); // Recarga la tabla para ver reflejada la asignación
                } else {
                    alert('❌ Error: ' + data.mensaje);
                }
            } catch (error) {
                console.error('Error al registrar asignación:', error);
                alert('❌ Error de conexión con el servidor.');
            }
        });
    }

    // --- FUNCIÓN PARA DESVINCULAR ESTUDIANTE ---
    window.desvincularEstudiante = async (estudiante_id) => {
        if (!confirm('¿Estás seguro de que deseas desvincular a este estudiante de su empresa actual?')) return;

        try {
            const response = await fetch(`http://localhost:3000/api/admin/asignaciones/${estudiante_id}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (data.exito) {
                cargarEstudiantes(); // Recargamos la tabla automáticamente
            } else {
                alert('❌ Error: ' + data.mensaje);
            }
        } catch (error) {
            console.error('Error al desvincular:', error);
            alert('❌ Error de conexión con el servidor.');
        }
    };
    
    // --- 10. CARGA INICIAL ---
    cargarDatos();
    cargarEstudiantes(); 
});