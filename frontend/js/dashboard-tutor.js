document.addEventListener('DOMContentLoaded', async () => {
    const API = 'http://localhost:3000';

    // ============================================================
    // 1. SEGURIDAD DE SESIÓN
    // ============================================================
    const usuarioGuardado = localStorage.getItem('usuarioLogueado');
    if (!usuarioGuardado) {
        window.location.href = 'login.html';
        return;
    }

    const usuario = JSON.parse(usuarioGuardado);
    if (usuario.rol !== 'tutor') {
        alert('Acceso denegado: solo los tutores pueden entrar a esta área.');
        window.location.href = 'login.html';
        return;
    }

    // ============================================================
    // 2. UTILIDADES
    // ============================================================
    const esc = (texto) => String(texto ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const fechaCorta = (iso) => { const [y, m, d] = String(iso).slice(0, 10).split('-'); return `${d}/${m}/${y}`; };
    const fmtHoras = (n) => (Number(n) || 0).toLocaleString('es-ES', { maximumFractionDigits: 1 });
    const colorEstado = (estado) => estado === 'Aprobada' ? '#28a745' : (estado === 'Rechazada' ? '#dc3545' : '#c79100');
    const textoEstado = (estado) => estado === 'Pendiente' ? 'Por validar' : estado;

    // ============================================================
    // 3. CABECERA, SESIÓN Y NAVEGACIÓN
    // ============================================================
    document.getElementById('nombre-tutor').textContent = `${usuario.nombres} ${usuario.apellidos}`;

    document.getElementById('btn-cerrar-sesion').addEventListener('click', () => {
        localStorage.removeItem('usuarioLogueado');
        window.location.href = 'login.html';
    });

    const menuItems = document.querySelectorAll('.menu-item');
    const secciones = document.querySelectorAll('.seccion-tutor');

    const irASeccion = (idSeccion) => {
        menuItems.forEach(item => item.classList.toggle('activo', item.getAttribute('data-target') === idSeccion));
        secciones.forEach(sec => sec.classList.toggle('activa', sec.id === idSeccion));
    };

    const tbodyOfertas = document.getElementById('tbody-ofertas');
    const tbodyPasantes = document.getElementById('tbody-pasantes');
    const tbodyHoras = document.getElementById('tbody-horas-pendientes');
    const selectCarreraOferta = document.getElementById('select-carrera-oferta');
    const formCrearOferta = document.getElementById('form-crear-pasantia');
    const badgePendientes = document.getElementById('badge-pendientes');

    const cargadores = {
        'sec-crear': () => cargarCarreras(),
        'sec-existentes': () => cargarOfertas(),
        'sec-pasantes': () => cargarPasantes(),
        'sec-validacion': () => cargarHorasPendientes()
    };

    let panelListo = false;

    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            const destino = item.getAttribute('data-target');
            irASeccion(destino);
            if (panelListo && usuario.empresa_id && cargadores[destino]) cargadores[destino]();
        });
    });

    // ============================================================
    // 4. EMPRESA DEL TUTOR
    // ============================================================
    const empresaTexto = document.getElementById('empresa-tutor');
    const avisoSinEmpresa = document.getElementById('aviso-sin-empresa');

    try {
        const res = await fetch(`${API}/api/tutor/perfil/${usuario.id}`);
        const data = await res.json();
        if (data.exito) {
            usuario.empresa_id = data.perfil.empresa_id;
            localStorage.setItem('usuarioLogueado', JSON.stringify(usuario));
            empresaTexto.textContent = data.perfil.nombre_empresa || 'Sin empresa vinculada';
        }
    } catch (error) {
        console.error('Error al consultar la empresa del tutor:', error);
        empresaTexto.textContent = 'Error de conexión';
    }

    if (!usuario.empresa_id) {
        empresaTexto.textContent = 'Sin empresa vinculada';
        empresaTexto.style.color = '#dc3545';
        if (avisoSinEmpresa) avisoSinEmpresa.style.display = 'block';
        tbodyOfertas.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">Sin empresa vinculada.</td></tr>';
        tbodyPasantes.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">Sin empresa vinculada.</td></tr>';
        tbodyHoras.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">Sin empresa vinculada.</td></tr>';
        if (formCrearOferta) {
            formCrearOferta.addEventListener('submit', (e) => { e.preventDefault(); alert('No tienes una empresa vinculada.'); });
        }
        return;
    }

    // ============================================================
    // 5. VENTANA DE MOTIVO
    // ============================================================
    const modalMotivo = document.getElementById('modal-motivo');
    const motivoTitulo = document.getElementById('motivo-titulo');
    const motivoDescripcion = document.getElementById('motivo-descripcion');
    const motivoTexto = document.getElementById('motivo-texto');
    const motivoError = document.getElementById('motivo-error');
    const motivoConfirmar = document.getElementById('motivo-confirmar');
    const motivoCancelar = document.getElementById('motivo-cancelar');
    let accionMotivo = null;

    const abrirMotivo = ({ titulo, descripcion, boton, onConfirmar }) => {
        motivoTitulo.textContent = titulo;
        motivoDescripcion.textContent = descripcion;
        motivoConfirmar.textContent = boton;
        motivoTexto.value = '';
        motivoError.style.display = 'none';
        accionMotivo = onConfirmar;
        modalMotivo.style.display = 'flex';
        motivoTexto.focus();
    };

    const cerrarMotivo = () => { modalMotivo.style.display = 'none'; accionMotivo = null; };

    motivoCancelar.addEventListener('click', cerrarMotivo);

    motivoConfirmar.addEventListener('click', async () => {
        const motivo = motivoTexto.value.trim();
        if (motivo.length < 5) {
            motivoError.style.display = 'block';
            return;
        }
        motivoError.style.display = 'none';
        motivoConfirmar.disabled = true;
        try {
            const terminado = accionMotivo ? await accionMotivo(motivo) : true;
            if (terminado) cerrarMotivo();
        } finally {
            motivoConfirmar.disabled = false;
        }
    });

    ['modal-postulantes', 'modal-historial'].forEach(id => {
        const modal = document.getElementById(id);
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
    });
    modalMotivo.addEventListener('click', (e) => { if (e.target === modalMotivo) cerrarMotivo(); });

    // ============================================================
    // 6. CARRERAS Y CREACIÓN DE OFERTAS
    // ============================================================
    const cargarCarreras = async () => {
        if (!selectCarreraOferta) return;
        try {
            const res = await fetch(`${API}/api/admin/carreras`);
            const data = await res.json();
            if (data.exito) {
                selectCarreraOferta.innerHTML = '<option value="" disabled selected>Seleccione una carrera...</option>';
                data.carreras.forEach(c => selectCarreraOferta.innerHTML += `<option value="${c.id}">${esc(c.nombre)}</option>`);
            }
        } catch (error) {
            console.error('Error al cargar carreras:', error);
            selectCarreraOferta.innerHTML = '<option value="">Error al conectar con el servidor</option>';
        }
    };

    if (formCrearOferta) {
        formCrearOferta.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                empresa_id: usuario.empresa_id,
                titulo: document.getElementById('oferta-titulo').value,
                descripcion: document.getElementById('oferta-descripcion').value,
                carrera_id: selectCarreraOferta.value,
                cupos: document.getElementById('oferta-cupos').value
            };
            try {
                const res = await fetch(`${API}/api/tutor/ofertas`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (data.exito) {
                    alert('✅ ' + data.mensaje);
                    formCrearOferta.reset();
                    irASeccion('sec-existentes');
                    cargarOfertas();
                } else alert('❌ ' + data.mensaje);
            } catch (error) { alert('❌ Error de conexión al servidor.'); }
        });
    }

    // ============================================================
    // 7. OFERTAS EXISTENTES Y POSTULANTES
    // ============================================================
    let listaOfertas = [];

    const cargarOfertas = async () => {
        try {
            const res = await fetch(`${API}/api/tutor/ofertas/${usuario.empresa_id}`);
            if (!res.ok) throw new Error('Respuesta no válida del servidor');
            const data = await res.json();
            listaOfertas = data.ofertas;

            tbodyOfertas.innerHTML = '';
            if (listaOfertas.length === 0) {
                tbodyOfertas.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">Todavía no has publicado ninguna oferta.</td></tr>';
                return;
            }

            listaOfertas.forEach(o => {
                const activa = o.estado === 'Activa';
                
                // BOTONES EN COLUMNA (CORREGIDO)
                const btnPostulantes = `<button onclick="verPostulantes(${o.id})" style="background-color: #17a2b8; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; width: 100%; font-weight: bold;">👥 Ver CVs</button>`;
                const btnAccion = activa
                    ? `<button onclick="cambiarEstadoOferta(${o.id}, 'Cerrada')" style="background-color: #dc3545; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; width: 100%; font-weight: bold;">Cerrar oferta</button>`
                    : `<button onclick="cambiarEstadoOferta(${o.id}, 'Activa')" style="background-color: #28a745; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; width: 100%; font-weight: bold;">Abrir oferta</button>`;

                tbodyOfertas.innerHTML += `
                    <tr>
                        <td style="font-weight: bold; vertical-align: middle;">${esc(o.titulo)}</td>
                        <td style="vertical-align: middle;">${esc(o.carrera_nombre)}</td>
                        <td style="text-align: center; vertical-align: middle;">${esc(o.cupos)}</td>
                        <td style="text-align: center; font-weight: bold; color: #17a2b8; font-size: 16px; vertical-align: middle;">${o.total_postulantes || 0}</td>
                        <td style="text-align: center; font-weight: bold; color: ${activa ? '#28a745' : '#6c757d'}; vertical-align: middle;">${esc(o.estado)}</td>
                        <td style="text-align: center; vertical-align: middle;">
                            <div style="display: flex; flex-direction: column; gap: 5px; align-items: center; width: 100%;">
                                ${btnPostulantes}
                                ${btnAccion}
                            </div>
                        </td>
                    </tr>
                `;
            });
        } catch (error) {
            console.error('Error cargando ofertas:', error);
            tbodyOfertas.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: red;">Error al cargar las ofertas.</td></tr>';
        }
    };

    window.cambiarEstadoOferta = async (id, nuevoEstado) => {
        if (!confirm(`¿Seguro que quieres ${nuevoEstado === 'Activa' ? 'abrir' : 'cerrar'} esta oferta?`)) return;
        try {
            const res = await fetch(`${API}/api/tutor/ofertas/${id}/estado`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado: nuevoEstado })
            });
            const data = await res.json();
            if (data.exito) cargarOfertas();
            else alert('❌ ' + data.mensaje);
        } catch (error) { alert('Error de conexión al servidor.'); }
    };

    window.verPostulantes = async (ofertaId) => {
        const oferta = listaOfertas.find(o => o.id === ofertaId);
        const tbody = document.getElementById('tbody-postulantes');

        document.getElementById('modal-titulo-oferta').textContent = `Postulantes: ${oferta ? oferta.titulo : ''}`;
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">Cargando postulantes...</td></tr>';
        document.getElementById('modal-postulantes').style.display = 'flex';

        try {
            const res = await fetch(`${API}/api/tutor/ofertas/${ofertaId}/postulantes`);
            const data = await res.json();

            tbody.innerHTML = '';
            if (!data.postulantes || data.postulantes.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #666;">Aún no hay postulantes para esta vacante.</td></tr>';
                return;
            }

            data.postulantes.forEach(p => {
                const fecha = new Date(p.fecha_postulacion).toLocaleDateString('es-ES');
                const btnCV = `<a href="${API}/uploads/${encodeURIComponent(p.cv_ruta)}" target="_blank" style="background-color: #003366; color: white; padding: 6px 10px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold; width: 100%; box-sizing: border-box; text-align: center;">📄 Abrir CV</a>`;

                let accion;
                if (p.ya_vinculado > 0) {
                    accion = '<span style="color: #28a745; font-weight: bold;">✅ Ya es pasante</span>';
                } else if (p.solicitud_pendiente > 0) {
                    accion = '<span style="color: #c79100; font-weight: bold;">⏳ Solicitud enviada</span>';
                } else {
                    accion = `<button onclick="solicitarIncorporacion(${p.estudiante_id}, ${ofertaId})" style="background-color: #28a745; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-weight: bold; width: 100%;">🏢 Incorporar</button>`;
                }

                tbody.innerHTML += `
                    <tr>
                        <td style="font-weight: bold; vertical-align: middle;">${esc(p.nombres)} ${esc(p.apellidos)}<br><small style="font-weight: normal; color: #666;">${esc(p.correo)}</small></td>
                        <td style="vertical-align: middle;">${esc(p.cedula)}</td>
                        <td style="text-align: center; vertical-align: middle;">${fecha}</td>
                        <td style="text-align: center; vertical-align: middle;">${btnCV}</td>
                        <td style="text-align: center; font-weight: bold; color: ${p.estado === 'Pendiente' ? '#c79100' : '#28a745'}; vertical-align: middle;">${esc(p.estado)}</td>
                        <td style="text-align: center; vertical-align: middle;">
                            <div style="display: flex; flex-direction: column; gap: 5px; align-items: center; width: 100%;">
                                ${accion}
                            </div>
                        </td>
                    </tr>
                `;
            });
        } catch (error) {
            console.error('Error al cargar postulantes:', error);
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: red;">Error al consultar los datos.</td></tr>';
        }
    };

    window.solicitarIncorporacion = async (estudianteId, ofertaId) => {
        if (!confirm('¿Solicitar a Coordinación la incorporación de este estudiante a tu empresa?')) return;
        try {
            const res = await fetch(`${API}/api/tutor/solicitar-incorporacion`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estudiante_id: estudianteId, empresa_id: usuario.empresa_id, oferta_id: ofertaId, tutor_id: usuario.id })
            });
            const data = await res.json();
            alert((data.exito ? '✅ ' : '❌ ') + data.mensaje);
            if (data.exito) verPostulantes(ofertaId);
        } catch (error) { alert('❌ Error de conexión al servidor.'); }
    };

    // ============================================================
    // 8. PASANTES: VER HORAS Y DESVINCULAR
    // ============================================================
    let listaPasantes = [];

    const cargarPasantes = async () => {
        try {
            const res = await fetch(`${API}/api/tutor/pasantes/${usuario.empresa_id}`);
            const data = await res.json();
            listaPasantes = data.pasantes;

            tbodyPasantes.innerHTML = '';
            if (listaPasantes.length === 0) {
                tbodyPasantes.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">No tienes estudiantes asignados actualmente.</td></tr>';
                return;
            }

            listaPasantes.forEach(p => {
                const meta = Number(p.meta_horas) || 288;
                const pendientes = Number(p.horas_pendientes) || 0;
                
                // BOTONES EN COLUMNA (CORREGIDO)
                const acciones = `
                    <div style="display: flex; flex-direction: column; gap: 5px; align-items: center; width: 100%;">
                        <button onclick="verHorasPasante(${p.id})" style="background-color: #17a2b8; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-weight: bold; width: 100%;">Ver horas</button>
                        <button onclick="desvincularPasante(${p.id})" style="background-color: #dc3545; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-weight: bold; width: 100%;">Desvincular</button>
                    </div>
                `;
                tbodyPasantes.innerHTML += `
                    <tr>
                        <td style="vertical-align: middle;">${esc(p.cedula)}</td>
                        <td style="font-weight: bold; vertical-align: middle;">${esc(p.nombres)} ${esc(p.apellidos)}<br><small style="font-weight: normal; color: #666;">${esc(p.correo)}</small></td>
                        <td style="vertical-align: middle;">${esc(p.carrera_nombre || 'N/A')}</td>
                        <td style="vertical-align: middle;">${esc(p.tiempo_pasantia)}</td>
                        <td style="text-align: center; font-weight: bold; color: #28a745; vertical-align: middle;">${fmtHoras(p.horas_aprobadas)} / ${fmtHoras(meta)} h</td>
                        <td style="text-align: center; font-weight: bold; color: ${pendientes > 0 ? '#c79100' : '#999'}; vertical-align: middle;">${pendientes > 0 ? fmtHoras(pendientes) + ' h' : '—'}</td>
                        <td style="text-align: center; vertical-align: middle;">${acciones}</td>
                    </tr>
                `;
            });
        } catch (error) {
            console.error('Error cargando pasantes:', error);
            tbodyPasantes.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: red;">Error al cargar los pasantes.</td></tr>';
        }
    };

    let historialActual = [];
    const modalHistorial = document.getElementById('modal-historial');
    const tbodyHistorial = document.getElementById('tbody-historial-pasante');
    const filtroEstado = document.getElementById('filtro-estado-historial');

    const pintarHistorial = () => {
        const filtro = filtroEstado.value;
        const filas = filtro ? historialActual.filter(h => h.estado_validacion === filtro) : historialActual;

        if (filas.length === 0) {
            tbodyHistorial.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px; color: #666;">${historialActual.length === 0 ? 'Este estudiante todavía no ha registrado horas.' : 'No hay registros con ese estado.'}</td></tr>`;
            return;
        }

        tbodyHistorial.innerHTML = filas.map(h => `
            <tr>
                <td style="white-space: nowrap;">${fechaCorta(h.fecha_registro)}</td>
                <td style="text-align: center; font-weight: bold; color: #003366;">${fmtHoras(h.horas_realizadas)}</td>
                <td>${esc(h.descripcion_actividades)}</td>
                <td style="text-align: center; font-weight: bold; color: ${colorEstado(h.estado_validacion)};">${textoEstado(esc(h.estado_validacion))}</td>
            </tr>
        `).join('');
    };

    filtroEstado.addEventListener('change', pintarHistorial);

    window.verHorasPasante = async (estudianteId) => {
        filtroEstado.value = '';
        historialActual = [];
        document.getElementById('historial-titulo').textContent = 'Horas registradas';
        document.getElementById('historial-subtitulo').textContent = '';
        tbodyHistorial.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">Cargando...</td></tr>';
        modalHistorial.style.display = 'flex';

        try {
            const res = await fetch(`${API}/api/tutor/historial-pasante/${estudianteId}?empresa_id=${usuario.empresa_id}`);
            const data = await res.json();

            if (!data.exito) {
                tbodyHistorial.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px; color: red;">${esc(data.mensaje)}</td></tr>`;
                return;
            }

            const est = data.estudiante;
            const r = data.resumen;
            const meta = Number(est.meta_horas) || 288;
            const faltantes = Math.max(0, meta - r.aprobadas);
            const porcentaje = Math.min(100, Math.round((r.aprobadas / meta) * 100));

            document.getElementById('historial-titulo').textContent = `Horas de ${est.nombres} ${est.apellidos}`;
            document.getElementById('historial-subtitulo').textContent = `C.C. ${est.cedula} · ${est.carrera_nombre || 'Sin carrera'} · Pasantía: ${est.tiempo_pasantia || 'No definido'}`;
            document.getElementById('res-aprobadas').textContent = fmtHoras(r.aprobadas);
            document.getElementById('res-pendientes').textContent = fmtHoras(r.pendientes);
            document.getElementById('res-rechazadas').textContent = fmtHoras(r.rechazadas);
            document.getElementById('res-faltantes').textContent = fmtHoras(faltantes);
            document.getElementById('texto-avance').textContent = `${fmtHoras(r.aprobadas)} de ${fmtHoras(meta)} horas aprobadas`;
            document.getElementById('texto-porcentaje').textContent = `${porcentaje}%`;
            document.getElementById('barra-avance').style.width = `${porcentaje}%`;

            historialActual = data.historial;
            pintarHistorial();
        } catch (error) {
            console.error('Error al cargar el historial del pasante:', error);
            tbodyHistorial.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px; color: red;">Error de conexión con el servidor.</td></tr>';
        }
    };

    window.desvincularPasante = (estudianteId) => {
        const pasante = listaPasantes.find(p => p.id === estudianteId);
        const nombre = pasante ? `${pasante.nombres} ${pasante.apellidos}` : 'este pasante';

        abrirMotivo({
            titulo: `Desvincular a ${nombre}`,
            descripcion: 'El estudiante recibirá una notificación con este motivo y no podrá registrar horas hasta que lo vinculen a una empresa. Sus horas ya registradas se conservan.',
            boton: 'Desvincular',
            onConfirmar: async (motivo) => {
                try {
                    const res = await fetch(`${API}/api/tutor/desvincular-pasante`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ estudiante_id: estudianteId, empresa_id: usuario.empresa_id, motivo })
                    });
                    const data = await res.json();
                    if (data.exito) {
                        alert('✅ ' + data.mensaje);
                        cargarPasantes();
                        cargarHorasPendientes();
                        return true;
                    }
                    alert('❌ ' + data.mensaje);
                    return false;
                } catch (error) {
                    alert('❌ Error de conexión con el servidor.');
                    return false;
                }
            }
        });
    };

    // ============================================================
    // 9. VALIDACIÓN DE HORAS
    // ============================================================
    const cargarHorasPendientes = async () => {
        try {
            const res = await fetch(`${API}/api/tutor/horas-pendientes/${usuario.empresa_id}`);
            const data = await res.json();

            const total = data.horas.length;
            if (badgePendientes) {
                badgePendientes.textContent = total;
                badgePendientes.style.display = total > 0 ? 'inline-block' : 'none';
            }

            tbodyHoras.innerHTML = '';
            if (total === 0) {
                tbodyHoras.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #28a745; font-weight: bold;">Todo al día. No hay horas pendientes.</td></tr>';
                return;
            }

            data.horas.forEach(h => {
                // BOTONES EN COLUMNA (CORREGIDO)
                tbodyHoras.innerHTML += `
                    <tr>
                        <td style="white-space: nowrap; vertical-align: middle;">${fechaCorta(h.fecha_registro)}</td>
                        <td style="font-weight: bold; vertical-align: middle;">${esc(h.nombres)} ${esc(h.apellidos)}<br><small style="font-weight: normal; color: #666;">C.C: ${esc(h.cedula)}</small></td>
                        <td style="vertical-align: middle;">${esc(h.descripcion_actividades)}</td>
                        <td style="text-align: center; font-weight: bold; color: #003366; vertical-align: middle;">${fmtHoras(h.horas_realizadas)}</td>
                        <td style="text-align: center; vertical-align: middle;">
                            <div style="display: flex; flex-direction: column; gap: 5px; align-items: center; width: 100%;">
                                <button onclick="validarHora(${h.hora_id}, 'Aprobada')" style="background-color: #28a745; color: white; border: none; padding: 7px 10px; border-radius: 4px; cursor: pointer; font-weight: bold; width: 100%;">✔ Aprobar</button>
                                <button onclick="validarHora(${h.hora_id}, 'Rechazada')" style="background-color: #dc3545; color: white; border: none; padding: 7px 10px; border-radius: 4px; cursor: pointer; font-weight: bold; width: 100%;">✖ Rechazar</button>
                            </div>
                        </td>
                    </tr>
                `;
            });
        } catch (error) {
            console.error('Error cargando horas pendientes:', error);
        }
    };

    // BLOQUEADOR LÓGICO PARA EVITAR DOBLE CLIC (SOLUCIÓN AL BUG)
    let bloqueadorValidacion = false;

    const enviarValidacion = async (id, estado, motivo) => {
        if (bloqueadorValidacion) return false;
        bloqueadorValidacion = true; 
        
        try {
            const res = await fetch(`${API}/api/tutor/horas/${id}/estado`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estado, motivo, empresa_id: usuario.empresa_id })
            });
            const data = await res.json();
            if (data.exito) {
                cargarHorasPendientes();
                cargarPasantes();
                bloqueadorValidacion = false; 
                return true;
            }
            alert('❌ ' + data.mensaje);
            cargarHorasPendientes();
            bloqueadorValidacion = false;
            return false;
        } catch (error) {
            console.error(error);
            alert('❌ Error de conexión al servidor.');
            bloqueadorValidacion = false;
            return false;
        }
    };

    window.validarHora = (id, estado) => {
        if (bloqueadorValidacion) return; // Si ya hay una validación en curso, no hace nada
        
        if (estado === 'Aprobada') {
            if (confirm('¿Aprobar estas horas? Se avisará al estudiante.')) enviarValidacion(id, 'Aprobada');
            return;
        }
        abrirMotivo({
            titulo: 'Rechazar horas',
            descripcion: 'El estudiante verá este motivo en sus notificaciones.',
            boton: 'Rechazar horas',
            onConfirmar: (motivo) => enviarValidacion(id, 'Rechazada', motivo)
        });
    };

    // ============================================================
    // 10. CARGA INICIAL
    // ============================================================
    panelListo = true;
    cargarCarreras();
    cargarPasantes();
    cargarHorasPendientes();
    cargarOfertas();

    setInterval(cargarHorasPendientes, 30000);
});