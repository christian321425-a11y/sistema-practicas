document.addEventListener('DOMContentLoaded', async () => {
    const API = 'http://localhost:3000';

    // 1. SEGURIDAD
    const usuarioGuardado = localStorage.getItem('usuarioLogueado');
    if (!usuarioGuardado) return window.location.href = 'login.html';

    const usuario = JSON.parse(usuarioGuardado);
    if (usuario.rol !== 'estudiante') return window.location.href = 'login.html';

    document.getElementById('nombre-estudiante').textContent = `${usuario.nombres} ${usuario.apellidos}`;

    // Utilidades
    const esc = (texto) => String(texto ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const fechaCorta = (iso) => { const [y, m, d] = String(iso).slice(0, 10).split('-'); return `${d}/${m}/${y}`; };
    const hoyISO = () => { const h = new Date(); return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`; };
    const fmtHoras = (n) => (Number(n) || 0).toLocaleString('es-ES', { maximumFractionDigits: 1 });

    // 2. DOM
    const carreraTexto = document.getElementById('carrera-estudiante');
    const progresoTexto = document.getElementById('texto-progreso');
    const badgeEmpresa = document.getElementById('badge-empresa');
    const tbodyHistorial = document.getElementById('tbody-historial-estudiante');
    const tbodyOfertas = document.getElementById('tbody-ofertas-estudiante');
    const btnRegistroHoras = document.getElementById('btn-abrir-registro');
    const msgNoVinculado = document.getElementById('mensaje-no-vinculado');

    const modalRegistrar = document.getElementById('modal-registrar-horas');
    const modalPostular = document.getElementById('modal-postular');

    let estaVinculado = false;
    let metaHorasGlobal = 288; // Por defecto
    let historialCompleto = []; // Para el filtro

    if (btnRegistroHoras) {
        btnRegistroHoras.addEventListener('click', () => {
            if (!estaVinculado) return alert('Debes estar vinculado a una empresa para registrar horas.');
            const inputFecha = document.getElementById('hora-fecha');
            if (inputFecha) inputFecha.max = hoyISO();
            modalRegistrar.style.display = 'flex';
        });
    }

    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', function () { this.closest('.modal').style.display = 'none'; });
    });

    window.addEventListener('click', (e) => {
        if (e.target === modalRegistrar) modalRegistrar.style.display = 'none';
        if (e.target === modalPostular) modalPostular.style.display = 'none';
    });

    // 3. CARGAR PERFIL
    let carreraIdEstudiante = null;

    const aplicarEstadoVinculacion = (vinculado, nombreEmpresa) => {
        estaVinculado = vinculado;
        if (vinculado) {
            badgeEmpresa.textContent = `Empresa asignada: ${nombreEmpresa}`;
            badgeEmpresa.style.backgroundColor = '#d4edda'; badgeEmpresa.style.color = '#155724'; badgeEmpresa.style.borderColor = '#c3e6cb';
            if (btnRegistroHoras) btnRegistroHoras.style.display = 'block';
            if (msgNoVinculado) msgNoVinculado.style.display = 'none';
        } else {
            badgeEmpresa.textContent = 'Pendiente de asignación de empresa';
            badgeEmpresa.style.backgroundColor = '#fff3cd'; badgeEmpresa.style.color = '#856404'; badgeEmpresa.style.borderColor = '#ffeeba';
            if (btnRegistroHoras) btnRegistroHoras.style.display = 'none';
            if (msgNoVinculado) msgNoVinculado.style.display = 'block';
        }
    };

    const cargarPerfil = async () => {
        try {
            const res = await fetch(`${API}/api/estudiante/perfil/${usuario.id}`);
            const data = await res.json();

            if (data.exito) {
                const p = data.perfil;
                carreraTexto.textContent = p.carrera_nombre || 'No definida';
                carreraIdEstudiante = p.carrera_id;
                metaHorasGlobal = Number(p.meta_horas) || 288;

                aplicarEstadoVinculacion(!!p.nombre_empresa, p.nombre_empresa);

                const horasAprobadas = Number(p.horas_aprobadas) || 0;
                const horasPendientes = Number(p.horas_pendientes) || 0;
                
                const textoPendientes = horasPendientes > 0 ? `<span style="font-size: 14px; color: #856404; display: block; font-weight: normal; margin-top: 4px;">${fmtHoras(horasPendientes)} h registradas en espera de la validación del tutor</span>` : '';
                progresoTexto.innerHTML = `${fmtHoras(horasAprobadas)} / ${fmtHoras(metaHorasGlobal)} <span style="font-size: 14px; color: #666; display: block; font-weight: normal; margin-top: 5px;">(Solo cuenta horas aprobadas)</span>${textoPendientes}`;

                if (carreraIdEstudiante) cargarOfertas(carreraIdEstudiante);
                else tbodyOfertas.innerHTML = '<tr><td colspan="4" style="text-align: center;">Debes tener una carrera asignada para ver las ofertas.</td></tr>';
            }
        } catch (error) { console.error('Error cargando perfil:', error); }
    };

    let listaOfertasActuales = [];

    // 4. CARGAR OFERTAS
    const cargarOfertas = async (carrera_id) => {
        if (!carrera_id) return;
        try {
            const res = await fetch(`${API}/api/estudiante/ofertas/${carrera_id}/${usuario.id}`);
            const data = await res.json();

            tbodyOfertas.innerHTML = '';
            if (data.ofertas.length === 0) {
                tbodyOfertas.innerHTML = '<tr><td colspan="4" style="text-align: center;">No hay vacantes disponibles para tu carrera en este momento.</td></tr>';
                return;
            }

            listaOfertasActuales = data.ofertas;
            data.ofertas.forEach(o => {
                const botonAccion = o.ya_postulado > 0
                    ? `<span style="color: #28a745; font-weight: bold; background: #e8f5e9; padding: 6px 12px; border-radius: 4px;">✅ Ya postulaste</span>`
                    : `<button onclick="abrirModalPostulacion(${o.id})" style="background-color: #003366; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold;">Postular</button>`;

                const btnDetalles = `<button onclick="verDetallesOferta(${o.id})" style="background-color: #17a2b8; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold; margin-right: 5px;">👁️ Detalles</button>`;

                tbodyOfertas.innerHTML += `
                    <tr>
                        <td style="font-weight: bold;">${esc(o.nombre_empresa)}</td>
                        <td>${esc(o.titulo)}</td>
                        <td style="text-align: center; font-weight: bold; color: #17a2b8;">${esc(o.cupos)}</td>
                        <td style="text-align: center;">
                            <div style="display: flex; flex-direction: column; gap: 5px; align-items: center;">
                                ${btnDetalles}
                                ${botonAccion}
                            </div>
                        </td>
                    </tr>
                `;
            });
        } catch (error) { console.error(error); }
    };

    window.verDetallesOferta = (id) => {
        const oferta = listaOfertasActuales.find(o => o.id === id);
        if (!oferta) return;
        document.getElementById('detalles-titulo').textContent = oferta.titulo;
        document.getElementById('detalles-empresa').textContent = oferta.nombre_empresa;
        document.getElementById('detalles-carrera').textContent = oferta.carrera_nombre;
        document.getElementById('detalles-cupos').textContent = oferta.cupos;
        document.getElementById('detalles-fecha').textContent = oferta.fecha_creacion ? new Date(oferta.fecha_creacion).toLocaleDateString('es-ES') : 'N/A';
        document.getElementById('detalles-descripcion').textContent = oferta.descripcion || 'Sin descripción detallada.';
        document.getElementById('modal-detalles-oferta').style.display = 'flex';
    };

    window.abrirModalPostulacion = (id) => {
        const oferta = listaOfertasActuales.find(o => o.id === id);
        document.getElementById('postulacion-oferta-id').value = id;
        document.getElementById('postular-titulo-oferta').textContent = oferta ? oferta.titulo : '';
        modalPostular.style.display = 'flex';
    };

    // 5. POSTULAR
    const formPostulacion = document.getElementById('form-postulacion');
    if (formPostulacion) {
        formPostulacion.addEventListener('submit', async (e) => {
            e.preventDefault();
            const archivoInput = document.getElementById('postulacion-cv');
            if (archivoInput.files.length === 0) return alert('Por favor, selecciona un PDF.');

            const formData = new FormData();
            formData.append('oferta_id', document.getElementById('postulacion-oferta-id').value);
            formData.append('estudiante_id', usuario.id);
            formData.append('cv', archivoInput.files[0]);

            try {
                const res = await fetch(`${API}/api/estudiante/postular`, { method: 'POST', body: formData });
                const data = await res.json();
                if (data.exito) {
                    alert('✅ Postulación enviada exitosamente.');
                    formPostulacion.reset(); modalPostular.style.display = 'none'; cargarOfertas(carreraIdEstudiante);
                } else alert('❌ Error: ' + data.mensaje);
            } catch (error) { alert('Error de conexión al servidor.'); }
        });
    }

    // 6. ENVIAR HORAS
    const formRegistroHoras = document.getElementById('form-registro-horas');
    let bloqueadorRegistro = false;

    if (formRegistroHoras) {
        formRegistroHoras.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!estaVinculado) return alert('Debes estar vinculado a una empresa para registrar horas.');
            if (bloqueadorRegistro) return;
            bloqueadorRegistro = true;

            const payload = {
                estudiante_id: usuario.id,
                fecha: document.getElementById('hora-fecha').value,
                horas: document.getElementById('hora-cantidad').value,
                descripcion: document.getElementById('hora-descripcion').value
            };
            try {
                const res = await fetch(`${API}/api/horas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                const data = await res.json();
                if (data.exito) {
                    alert('✅ ' + data.mensaje);
                    formRegistroHoras.reset(); modalRegistrar.style.display = 'none';
                    cargarPerfil(); cargarHistorial(); cargarNotificaciones();
                } else {
                    alert('❌ ' + data.mensaje);
                    if (res.status === 403) { modalRegistrar.style.display = 'none'; cargarPerfil(); }
                }
            } catch (error) { alert('Error de conexión.'); }
            finally { bloqueadorRegistro = false; }
        });
    }

    // 7. CARGAR HISTORIAL DE HORAS Y DASHBOARD DETALLADO
    const pintarTablaHistorial = () => {
        const filtro = document.getElementById('filtro-estado-est')?.value;
        const filas = filtro ? historialCompleto.filter(h => h.estado_validacion === filtro) : historialCompleto;

        tbodyHistorial.innerHTML = '';
        if (filas.length === 0) {
            tbodyHistorial.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px; color: #666;">${historialCompleto.length === 0 ? 'Sin actividades registradas.' : 'No hay registros con ese estado.'}</td></tr>`;
            return;
        }

        filas.forEach(h => {
            const colorEstado = h.estado_validacion === 'Aprobada' ? '#28a745' : (h.estado_validacion === 'Rechazada' ? '#dc3545' : '#c79100');
            const textoEstado = h.estado_validacion === 'Pendiente' ? 'Por validar' : h.estado_validacion;
            
            tbodyHistorial.innerHTML += `
                <tr>
                    <td style="white-space: nowrap;">${fechaCorta(h.fecha_registro)}</td>
                    <td style="text-align: center; font-weight: bold; color: #003366;">${fmtHoras(h.horas_realizadas)}</td>
                    <td>${esc(h.descripcion_actividades)}</td>
                    <td style="font-weight: bold; color: ${colorEstado}; text-align: center;">${esc(textoEstado)}</td>
                </tr>
            `;
        });
    };

    document.getElementById('filtro-estado-est')?.addEventListener('change', pintarTablaHistorial);

    const cargarHistorial = async () => {
        try {
            const res = await fetch(`${API}/api/historial/${usuario.id}`);
            const data = await res.json();
            
            historialCompleto = data.historial || [];

            // Calcular Resumen
            let aprobadas = 0, pendientes = 0, rechazadas = 0;
            historialCompleto.forEach(h => {
                const hrs = Number(h.horas_realizadas) || 0;
                if (h.estado_validacion === 'Aprobada') aprobadas += hrs;
                else if (h.estado_validacion === 'Pendiente') pendientes += hrs;
                else if (h.estado_validacion === 'Rechazada') rechazadas += hrs;
            });

            const faltantes = Math.max(0, metaHorasGlobal - aprobadas);
            const porcentaje = Math.min(100, Math.round((aprobadas / metaHorasGlobal) * 100));

            // Actualizar Tarjetas Visuales
            if (document.getElementById('res-aprobadas-est')) {
                document.getElementById('res-aprobadas-est').textContent = fmtHoras(aprobadas);
                document.getElementById('res-pendientes-est').textContent = fmtHoras(pendientes);
                document.getElementById('res-rechazadas-est').textContent = fmtHoras(rechazadas);
                document.getElementById('res-faltantes-est').textContent = fmtHoras(faltantes);
                document.getElementById('texto-avance-est').textContent = `${fmtHoras(aprobadas)} de ${fmtHoras(metaHorasGlobal)} horas aprobadas`;
                document.getElementById('texto-porcentaje-est').textContent = `${porcentaje}%`;
                document.getElementById('barra-avance-est').style.width = `${porcentaje}%`;
            }

            pintarTablaHistorial();

        } catch (error) { console.error(error); }
    };

    // 8. NOTIFICACIONES
    const btnNotificaciones = document.getElementById('btn-notificaciones');
    const panelNotificaciones = document.getElementById('panel-notificaciones-dropdown');
    const badgeNotificaciones = document.getElementById('badge-notificaciones');
    const badgeMenu = document.getElementById('menu-badge-notif');
    const listaPanel = document.getElementById('lista-notificaciones');
    const listaSeccion = document.getElementById('lista-notificaciones-seccion');
    const listaInicio = document.getElementById('inicio-notificaciones');

    const ESTILO_TIPO = {
        'Vinculacion':        { icono: '🏢', color: '#28a745' },
        'Desvinculacion':     { icono: '⚠️', color: '#dc3545' },
        'Solicitud Rechazada':{ icono: '📋', color: '#fd7e14' },
        'Horas Enviadas':     { icono: '📤', color: '#17a2b8' },
        'Horas Aprobadas':    { icono: '✅', color: '#28a745' },
        'Horas Rechazadas':   { icono: '❌', color: '#dc3545' }
    };

    const itemNotificacion = (n) => {
        const estilo = ESTILO_TIPO[n.tipo] || { icono: '🔔', color: '#6c757d' };
        const noLeida = Number(n.leida) === 0;
        const fecha = new Date(n.fecha_creacion).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        return `
            <li class="notif-item ${noLeida ? 'no-leida' : ''}" style="border-left-color: ${estilo.color};" onclick="marcarLeida(${n.id})">
                <p>${estilo.icono} ${esc(n.mensaje)}</p>
                <small>${fecha}</small>
            </li>
        `;
    };

    const pintarLista = (contenedor, notificaciones, vacio) => {
        if (!contenedor) return;
        contenedor.innerHTML = notificaciones.length === 0
            ? `<li class="notif-vacia">${vacio}</li>`
            : notificaciones.map(itemNotificacion).join('');
    };

    let ultimoIdNotificacion = null;

    const cargarNotificaciones = async () => {
        try {
            const res = await fetch(`${API}/api/estudiante/notificaciones/${usuario.id}`);
            const data = await res.json();
            if (!data.exito) return;

            const lista = data.notificaciones;
            const noLeidas = lista.filter(n => Number(n.leida) === 0).length;

            pintarLista(listaPanel, lista.slice(0, 10), 'Sin notificaciones.');
            pintarLista(listaInicio, lista.slice(0, 3), 'Todavía no tienes notificaciones.');
            pintarLista(listaSeccion, lista, 'Todavía no tienes notificaciones.');

            [badgeNotificaciones, badgeMenu].forEach(badge => {
                if (!badge) return;
                badge.textContent = noLeidas;
                badge.style.display = noLeidas > 0 ? 'inline-block' : 'none';
            });

            const maxId = lista.length > 0 ? Math.max(...lista.map(n => n.id)) : 0;
            if (ultimoIdNotificacion !== null && maxId > ultimoIdNotificacion) {
                cargarPerfil();
                cargarHistorial();
            }
            ultimoIdNotificacion = maxId;
        } catch (error) { console.error(error); }
    };

    window.marcarLeida = async (notifId) => {
        try {
            await fetch(`${API}/api/estudiante/notificaciones/${notifId}/leer`, { method: 'PUT' });
        } catch (error) { console.error(error); }
        cargarNotificaciones();
    };

    const btnMarcarTodas = document.getElementById('btn-marcar-todas');
    if (btnMarcarTodas) {
        btnMarcarTodas.addEventListener('click', async () => {
            try {
                await fetch(`${API}/api/estudiante/notificaciones/marcar-todas/${usuario.id}`, { method: 'PUT' });
            } catch (error) { console.error(error); }
            cargarNotificaciones();
        });
    }

    if (btnNotificaciones && panelNotificaciones) {
        btnNotificaciones.addEventListener('click', () => {
            panelNotificaciones.style.display = panelNotificaciones.style.display === 'none' ? 'block' : 'none';
        });
        panelNotificaciones.addEventListener('click', (e) => e.stopPropagation());
    }

    const irANotificaciones = (e) => {
        e.preventDefault();
        if (panelNotificaciones) panelNotificaciones.style.display = 'none';
        window.irASeccion('sec-notificaciones');
    };
    document.getElementById('link-ver-todas')?.addEventListener('click', irANotificaciones);
    document.getElementById('link-ver-todas-inicio')?.addEventListener('click', irANotificaciones);

    document.addEventListener('click', (e) => {
        if (btnNotificaciones && panelNotificaciones && !btnNotificaciones.contains(e.target)) {
            panelNotificaciones.style.display = 'none';
        }
    });

    document.getElementById('btn-cerrar-sesion').addEventListener('click', () => {
        localStorage.removeItem('usuarioLogueado');
        window.location.href = 'login.html';
    });

    // 9. CARGA INICIAL
    cargarPerfil();
    cargarHistorial();
    cargarNotificaciones();
    setInterval(cargarNotificaciones, 20000);
});