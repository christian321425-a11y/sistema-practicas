const express = require('express');
const cors = require('cors');
require('dotenv').config();
const pool = require('./config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();

app.use(cors());
app.use(express.json());

// Exponer la carpeta de PDFs para que el administrador y tutores puedan descargarlos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- CONFIGURACIÓN GLOBAL PARA SUBIDA DE ARCHIVOS (MULTER) ---
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// ==========================================
// --- UTILIDADES ---
// ==========================================

// Crea la tabla de notificaciones si todavía no existe
const asegurarTablas = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS notificaciones_estudiantes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            estudiante_id INT NOT NULL,
            mensaje VARCHAR(500) NOT NULL,
            tipo VARCHAR(50) NOT NULL DEFAULT 'General',
            leida TINYINT(1) NOT NULL DEFAULT 0,
            fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_notif_estudiante (estudiante_id, leida)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
};

// Guarda una notificación para un estudiante. Si falla, no tumba la operación principal.
const crearNotificacion = async (estudiante_id, mensaje, tipo) => {
    try {
        await pool.query(
            'INSERT INTO notificaciones_estudiantes (estudiante_id, mensaje, tipo) VALUES (?, ?, ?)',
            [estudiante_id, String(mensaje).slice(0, 500), tipo]
        );
    } catch (error) {
        console.error('No se pudo crear la notificación:', error.message);
    }
};

// Convierte una fecha (Date o 'YYYY-MM-DD') en dd/mm/aaaa
const formatearFecha = (valor) => {
    if (!valor) return '';
    if (valor instanceof Date) {
        const d = String(valor.getDate()).padStart(2, '0');
        const m = String(valor.getMonth() + 1).padStart(2, '0');
        return `${d}/${m}/${valor.getFullYear()}`;
    }
    const [y, m, d] = String(valor).slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
};

// Cierra una frase con punto solo si no termina ya en uno (evita "S.A.." con empresas que acaban en punto)
const cerrarFrase = (texto) => /[.!?]$/.test(texto) ? texto : texto + '.';

const hoyISO = () => {
    const h = new Date();
    return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`;
};

// ==========================================
// --- RUTAS GLOBALES ---
// ==========================================

// Ruta de prueba
app.get('/api/estado', (req, res) => {
    res.json({ mensaje: 'Servidor Node.js funcionando correctamente' });
});

// Ruta de Login unificada (Admins, Estudiantes y Tutores)
app.post('/api/login', async (req, res) => {
    const { cedula, password, rol } = req.body;

    try {
        if (rol === 'tutor') {
            const [rows] = await pool.query('SELECT * FROM tutores_empresas WHERE cedula = ? AND password_hash = ?', [cedula, password]);

            if (rows.length > 0) {
                const tutor = rows[0];
                if (tutor.estado_cuenta !== 'Activo') {
                    return res.status(401).json({ exito: false, mensaje: 'Tu cuenta de tutor ha sido desactivada por Coordinación.' });
                }
                return res.json({
                    exito: true,
                    usuario: { id: tutor.id, cedula: tutor.cedula, nombres: tutor.nombres, apellidos: tutor.apellidos, rol: 'tutor', empresa_id: tutor.empresa_id }
                });
            }
        }
        else {
            const [rows] = await pool.query('SELECT * FROM usuarios WHERE cedula = ? AND password_hash = ? AND rol = ?', [cedula, password, rol]);

            if (rows.length > 0) {
                return res.json({ exito: true, usuario: rows[0] });
            }
        }

        res.status(401).json({ exito: false, mensaje: 'Credenciales incorrectas o rol equivocado.' });

    } catch (error) {
        console.error('Error en el login:', error);
        res.status(500).json({ exito: false, mensaje: 'Error interno del servidor.' });
    }
});

// ==========================================
// --- RUTAS DEL ESTUDIANTE ---
// ==========================================

// Registrar horas de práctica (solo si el estudiante está vinculado a una empresa)
app.post('/api/horas', async (req, res) => {
    const { estudiante_id, horas, descripcion, fecha } = req.body;
    const horasNum = Number(horas);

    if (!estudiante_id || !fecha || !descripcion || !String(descripcion).trim()) {
        return res.status(400).json({ exito: false, mensaje: 'Completa la fecha, las horas y la descripción.' });
    }
    if (!(horasNum > 0) || horasNum > 12) {
        return res.status(400).json({ exito: false, mensaje: 'Las horas deben estar entre 0.1 y 12 por registro.' });
    }
    if (String(fecha).slice(0, 10) > hoyISO()) {
        return res.status(400).json({ exito: false, mensaje: 'No puedes registrar horas con fecha futura.' });
    }

    try {
        const [asignacion] = await pool.query(
            'SELECT a.empresa_id, e.nombre_empresa FROM asignaciones a JOIN empresas e ON a.empresa_id = e.id WHERE a.estudiante_id = ? LIMIT 1',
            [estudiante_id]
        );
        if (asignacion.length === 0) {
            return res.status(403).json({ exito: false, mensaje: 'Debes estar vinculado a una empresa para registrar horas.' });
        }

        const [resultado] = await pool.query(
            "INSERT INTO registro_horas (estudiante_id, horas_realizadas, descripcion_actividades, fecha_registro, estado_validacion) VALUES (?, ?, ?, ?, 'Pendiente')",
            [estudiante_id, horasNum, String(descripcion).trim(), fecha]
        );

        if (resultado.affectedRows > 0) {
            await crearNotificacion(
                estudiante_id,
                `Tu registro de ${horasNum} h del ${formatearFecha(fecha)} se envió con éxito y quedó pendiente de revisión de tu tutor (${asignacion[0].nombre_empresa}).`,
                'Horas Enviadas'
            );
            res.json({ exito: true, mensaje: 'Horas registradas correctamente. Quedaron pendientes de validación.' });
        } else {
            res.status(400).json({ exito: false, mensaje: 'No se pudo guardar el registro' });
        }
    } catch (error) {
        console.error('Error en /api/horas:', error);
        res.status(500).json({ exito: false, mensaje: 'Error interno del servidor al guardar las horas' });
    }
});

// Obtener el historial de horas
app.get('/api/historial/:estudiante_id', async (req, res) => {
    const { estudiante_id } = req.params;
    try {
        const [rows] = await pool.query(
            `SELECT id, DATE_FORMAT(fecha_registro, '%Y-%m-%d') AS fecha_registro, horas_realizadas, descripcion_actividades, estado_validacion
             FROM registro_horas WHERE estudiante_id = ? ORDER BY fecha_registro DESC, id DESC`,
            [estudiante_id]
        );
        res.json({ exito: true, historial: rows });
    } catch (error) {
        console.error('Error al obtener historial:', error);
        res.status(500).json({ exito: false, mensaje: 'Error al consultar el historial' });
    }
});

// Perfil del estudiante (carrera, horas, meta y empresa asignada)
app.get('/api/estudiante/perfil/:id', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                u.nombres,
                u.apellidos,
                c.id AS carrera_id,
                c.nombre AS carrera_nombre,
                c.horas_requeridas AS meta_horas,
                e.id AS empresa_id,
                e.nombre_empresa,
                a.tiempo_pasantia,
                COALESCE((SELECT SUM(horas_realizadas) FROM registro_horas WHERE estudiante_id = u.id AND estado_validacion = 'Aprobada'), 0) AS horas_aprobadas,
                COALESCE((SELECT SUM(horas_realizadas) FROM registro_horas WHERE estudiante_id = u.id AND estado_validacion = 'Pendiente'), 0) AS horas_pendientes
            FROM usuarios u
            LEFT JOIN carreras c ON u.carrera_id = c.id
            LEFT JOIN asignaciones a ON u.id = a.estudiante_id
            LEFT JOIN empresas e ON a.empresa_id = e.id
            WHERE u.id = ?
            LIMIT 1
        `, [req.params.id]);

        if (rows.length > 0) res.json({ exito: true, perfil: rows[0] });
        else res.status(404).json({ exito: false, mensaje: 'Estudiante no encontrado' });
    } catch (error) {
        console.error('Error perfil:', error);
        res.status(500).json({ exito: false, mensaje: 'Error al cargar perfil' });
    }
});

// Obtener ofertas de pasantías disponibles por carrera
app.get('/api/estudiante/ofertas/:carrera_id/:estudiante_id', async (req, res) => {
    const { carrera_id, estudiante_id } = req.params;
    try {
        const [rows] = await pool.query(`
            SELECT
                o.id, o.titulo, o.cupos, o.descripcion, o.fecha_creacion,
                COALESCE(c.nombre, 'Carrera no especificada') AS carrera_nombre,
                COALESCE(e.nombre_empresa, 'Empresa no especificada') AS nombre_empresa,
                (SELECT COUNT(*) FROM postulaciones p WHERE p.oferta_id = o.id AND p.estudiante_id = ?) AS ya_postulado
            FROM ofertas_practicas o
            LEFT JOIN empresas e ON o.empresa_id = e.id
            LEFT JOIN carreras c ON o.carrera_id = c.id
            WHERE o.carrera_id = ? AND o.estado = 'Activa'
            ORDER BY o.id DESC
        `, [estudiante_id, carrera_id]);
        res.json({ exito: true, ofertas: rows });
    } catch (error) {
        console.error('Error ofertas:', error);
        res.status(500).json({ exito: false, mensaje: 'Error al cargar ofertas' });
    }
});

// Enviar postulación y subir CV
app.post('/api/estudiante/postular', upload.single('cv'), async (req, res) => {
    const { oferta_id, estudiante_id } = req.body;
    const cv_ruta = req.file ? req.file.filename : null;

    if (!cv_ruta) {
        return res.status(400).json({ exito: false, mensaje: 'Debe subir un archivo PDF válido.' });
    }

    try {
        const [existe] = await pool.query('SELECT * FROM postulaciones WHERE oferta_id = ? AND estudiante_id = ?', [oferta_id, estudiante_id]);
        if (existe.length > 0) return res.status(400).json({ exito: false, mensaje: 'Ya has postulado a esta vacante.' });

        await pool.query(
            'INSERT INTO postulaciones (oferta_id, estudiante_id, cv_ruta) VALUES (?, ?, ?)',
            [oferta_id, estudiante_id, cv_ruta]
        );
        res.json({ exito: true, mensaje: 'Postulación enviada correctamente.' });
    } catch (error) {
        console.error('Error al postular:', error);
        res.status(500).json({ exito: false, mensaje: 'Error al procesar la postulación.' });
    }
});

// --- NOTIFICACIONES DEL ESTUDIANTE ---

// Obtener notificaciones del estudiante
app.get('/api/estudiante/notificaciones/:estudiante_id', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT id, mensaje, fecha_creacion, leida, tipo
            FROM notificaciones_estudiantes
            WHERE estudiante_id = ?
            ORDER BY fecha_creacion DESC, id DESC LIMIT 50
        `, [req.params.estudiante_id]);
        res.json({ exito: true, notificaciones: rows });
    } catch (error) {
        if (error.code === 'ER_NO_SUCH_TABLE') {
            return res.json({ exito: true, notificaciones: [] });
        }
        console.error('Error al cargar notificaciones:', error);
        res.status(500).json({ exito: false, mensaje: 'Error al cargar notificaciones.' });
    }
});

// Marcar todas como leídas
app.put('/api/estudiante/notificaciones/marcar-todas/:estudiante_id', async (req, res) => {
    try {
        await pool.query('UPDATE notificaciones_estudiantes SET leida = 1 WHERE estudiante_id = ?', [req.params.estudiante_id]);
        res.json({ exito: true });
    } catch (error) {
        res.status(500).json({ exito: false });
    }
});

// Marcar una notificación como leída
app.put('/api/estudiante/notificaciones/:id/leer', async (req, res) => {
    try {
        await pool.query('UPDATE notificaciones_estudiantes SET leida = 1 WHERE id = ?', [req.params.id]);
        res.json({ exito: true });
    } catch (error) {
        res.status(500).json({ exito: false });
    }
});

// ==========================================
// --- RUTAS DE ADMINISTRACIÓN ---
// ==========================================

// Registrar una nueva empresa manualmente
app.post('/api/empresas', async (req, res) => {
    const { nombre, direccion, telefono } = req.body;
    try {
        const [resultado] = await pool.query(
            'INSERT INTO empresas (nombre, direccion, telefono) VALUES (?, ?, ?)',
            [nombre, direccion, telefono]
        );
        if (resultado.affectedRows > 0) res.json({ exito: true, mensaje: 'Empresa registrada correctamente' });
        else res.status(400).json({ exito: false, mensaje: 'No se pudo guardar el registro' });
    } catch (error) {
        res.status(500).json({ exito: false, mensaje: 'Error interno del servidor al registrar la empresa' });
    }
});

// Recibir solicitud de convenio de empresa externa (Sube PDF)
app.post('/api/solicitud-convenio', upload.single('documento'), async (req, res) => {
    const { razon_social, ruc, tipo_empresa, direccion, actividad, contacto_nombre, contacto_cargo, contacto_telefono, contacto_correo } = req.body;
    if (!req.file) return res.status(400).json({ exito: false, mensaje: 'Debe subir el documento de convenio.' });

    try {
        const codigoUnico = 'REQ-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        await pool.query(
            `INSERT INTO empresas (codigo_seguimiento, nombre_empresa, ruc, tipo_empresa, direccion, actividad, contacto_nombre, contacto_cargo, contacto_telefono, contacto_correo, ruta_documento, estado_aprobacion, activa) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pendiente', 1)`,
            [codigoUnico, razon_social, ruc, tipo_empresa, direccion, actividad, contacto_nombre, contacto_cargo, contacto_telefono, contacto_correo, req.file.filename]
        );
        res.json({ exito: true, mensaje: 'Solicitud enviada.', codigo: codigoUnico });
    } catch (error) {
        res.status(500).json({ exito: false, mensaje: 'Error al procesar la solicitud.' });
    }
});

app.get('/api/estado-solicitud/:codigo', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT nombre_empresa, estado_aprobacion FROM empresas WHERE codigo_seguimiento = ?', [req.params.codigo]);
        if (rows.length > 0) res.json({ exito: true, empresa: rows[0] });
        else res.status(404).json({ exito: false, mensaje: 'Código no encontrado.' });
    } catch (error) {
        res.status(500).json({ exito: false, mensaje: 'Error interno.' });
    }
});

app.get('/api/admin/solicitudes', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, codigo_seguimiento, nombre_empresa, ruc, contacto_nombre, contacto_cargo, contacto_telefono, contacto_correo, direccion, actividad, ruta_documento, estado_aprobacion FROM empresas ORDER BY id DESC');
        res.json({ exito: true, solicitudes: rows });
    } catch (error) {
        res.status(500).json({ exito: false, mensaje: 'Error al obtener solicitudes.' });
    }
});

app.put('/api/admin/solicitudes/:id/estado', async (req, res) => {
    try {
        await pool.query('UPDATE empresas SET estado_aprobacion = ? WHERE id = ?', [req.body.estado, req.params.id]);
        res.json({ exito: true, mensaje: `Solicitud ${req.body.estado}.` });
    } catch (error) {
        res.status(500).json({ exito: false, mensaje: 'Error al cambiar estado.' });
    }
});

app.delete('/api/admin/solicitudes', async (req, res) => {
    const { ids } = req.body;
    if (!ids || ids.length === 0) return res.status(400).json({ exito: false, mensaje: 'Sin IDs.' });
    try {
        const placeholders = ids.map(() => '?').join(',');
        await pool.query(`DELETE FROM empresas WHERE id IN (${placeholders})`, ids);
        res.json({ exito: true, mensaje: 'Eliminados correctamente.' });
    } catch (error) {
        res.status(500).json({ exito: false, mensaje: 'Error al eliminar.' });
    }
});

app.get('/api/admin/carreras', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, nombre FROM carreras ORDER BY nombre ASC');
        res.json({ exito: true, carreras: rows });
    } catch (error) {
        res.status(500).json({ exito: false, mensaje: 'Error al obtener carreras.' });
    }
});

app.post('/api/admin/estudiantes', async (req, res) => {
    const { cedula, nombres, apellidos, password, carrera_id } = req.body;
    try {
        const [existe] = await pool.query('SELECT id FROM usuarios WHERE cedula = ?', [cedula]);
        if (existe.length > 0) return res.status(400).json({ exito: false, mensaje: 'Cédula registrada.' });

        await pool.query(
            'INSERT INTO usuarios (cedula, nombres, apellidos, password_hash, rol, carrera_id) VALUES (?, ?, ?, ?, ?, ?)',
            [cedula, nombres, apellidos, password, 'estudiante', carrera_id]
        );
        res.json({ exito: true, mensaje: 'Registrado correctamente.' });
    } catch (error) {
        res.status(500).json({ exito: false, mensaje: 'Error al registrar.' });
    }
});

// Lista de estudiantes. Las horas del progreso cuentan solo las aprobadas,
// igual que en el panel del estudiante.
app.get('/api/admin/estudiantes', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT u.id, u.cedula, u.nombres, u.apellidos, u.correo, c.nombre AS carrera_nombre, c.horas_requeridas AS meta_horas,
            COALESCE((SELECT SUM(horas_realizadas) FROM registro_horas WHERE estudiante_id = u.id AND estado_validacion = 'Aprobada'), 0) AS horas_realizadas,
            e.nombre_empresa AS empresa_nombre, a.tiempo_pasantia,
            (SELECT COUNT(*) FROM solicitudes_incorporacion s WHERE s.estudiante_id = u.id AND s.estado = 'Pendiente') AS notificaciones_pendientes
            FROM usuarios u LEFT JOIN carreras c ON u.carrera_id = c.id LEFT JOIN asignaciones a ON u.id = a.estudiante_id
            LEFT JOIN empresas e ON a.empresa_id = e.id WHERE u.rol = 'estudiante' ORDER BY u.id DESC
        `);
        res.json({ exito: true, estudiantes: rows });
    } catch (error) {
        res.status(500).json({ exito: false, mensaje: 'Error al obtener estudiantes.' });
    }
});

app.delete('/api/admin/estudiantes', async (req, res) => {
    const { ids } = req.body;
    if (!ids || ids.length === 0) return res.status(400).json({ exito: false, mensaje: 'Sin IDs.' });
    try {
        const placeholders = ids.map(() => '?').join(',');
        await pool.query(`DELETE FROM notificaciones_estudiantes WHERE estudiante_id IN (${placeholders})`, ids).catch(() => {});
        await pool.query(`DELETE FROM usuarios WHERE id IN (${placeholders})`, ids);
        res.json({ exito: true, mensaje: 'Eliminados correctamente.' });
    } catch (error) {
        res.status(500).json({ exito: false, mensaje: 'Error al eliminar.' });
    }
});

app.get('/api/admin/empresas-aprobadas', async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT id, nombre_empresa, ruc FROM empresas WHERE estado_aprobacion = 'Aprobada' ORDER BY nombre_empresa ASC");
        res.json({ exito: true, empresas: rows });
    } catch (error) {
        res.status(500).json({ exito: false, mensaje: 'Error.' });
    }
});

// Asignación manual: reemplaza cualquier vínculo anterior y avisa al estudiante
app.post('/api/admin/asignaciones', async (req, res) => {
    const { estudiante_id, empresa_id, tiempo_pasantia } = req.body;
    try {
        const [empresa] = await pool.query('SELECT nombre_empresa FROM empresas WHERE id = ?', [empresa_id]);
        if (empresa.length === 0) return res.status(404).json({ exito: false, mensaje: 'Empresa no encontrada.' });

        await pool.query('DELETE FROM asignaciones WHERE estudiante_id = ?', [estudiante_id]);
        await pool.query('INSERT INTO asignaciones (estudiante_id, empresa_id, tiempo_pasantia) VALUES (?, ?, ?)', [estudiante_id, empresa_id, tiempo_pasantia]);

        await crearNotificacion(
            estudiante_id,
            `Coordinación te vinculó a ${empresa[0].nombre_empresa} para tus pasantías (${tiempo_pasantia}). Ya puedes registrar tus horas.`,
            'Vinculacion'
        );
        res.json({ exito: true, mensaje: 'Asignado correctamente.' });
    } catch (error) {
        console.error('Error al asignar:', error);
        res.status(500).json({ exito: false, mensaje: 'Error al asignar.' });
    }
});

// Desvincular desde coordinación y avisar al estudiante
app.delete('/api/admin/asignaciones/:estudiante_id', async (req, res) => {
    try {
        const [previa] = await pool.query(
            'SELECT e.nombre_empresa FROM asignaciones a JOIN empresas e ON a.empresa_id = e.id WHERE a.estudiante_id = ? LIMIT 1',
            [req.params.estudiante_id]
        );
        await pool.query('DELETE FROM asignaciones WHERE estudiante_id = ?', [req.params.estudiante_id]);

        if (previa.length > 0) {
            await crearNotificacion(
                req.params.estudiante_id,
                `${cerrarFrase('Coordinación te desvinculó de ' + previa[0].nombre_empresa)} Mientras no tengas empresa no podrás registrar horas.`,
                'Desvinculacion'
            );
        }
        res.json({ exito: true, mensaje: 'Desvinculado.' });
    } catch (error) {
        res.status(500).json({ exito: false, mensaje: 'Error al desvincular.' });
    }
});

app.get('/api/admin/tutores', async (req, res) => {
    try {
        const [rows] = await pool.query(`SELECT t.id, t.cedula, t.nombres, t.apellidos, t.correo, t.estado_cuenta, t.empresa_id, e.nombre_empresa AS empresa_nombre FROM tutores_empresas t LEFT JOIN empresas e ON t.empresa_id = e.id ORDER BY t.id DESC`);
        res.json({ exito: true, tutores: rows });
    } catch (error) {
        res.status(500).json({ exito: false, mensaje: 'Error.' });
    }
});

app.post('/api/admin/tutores', async (req, res) => {
    const { cedula, nombres, apellidos, correo, password } = req.body;
    try {
        const [existe] = await pool.query('SELECT id FROM tutores_empresas WHERE cedula = ?', [cedula]);
        if (existe.length > 0) return res.status(400).json({ exito: false, mensaje: 'Cédula existe.' });
        await pool.query('INSERT INTO tutores_empresas (cedula, nombres, apellidos, correo, password_hash) VALUES (?, ?, ?, ?, ?)', [cedula, nombres, apellidos, correo, password]);
        res.json({ exito: true, mensaje: 'Registrado correctamente.' });
    } catch (error) {
        res.status(500).json({ exito: false, mensaje: 'Error al registrar.' });
    }
});

app.put('/api/admin/tutores/:id/estado', async (req, res) => {
    try {
        await pool.query('UPDATE tutores_empresas SET estado_cuenta = ? WHERE id = ?', [req.body.estado_cuenta, req.params.id]);
        res.json({ exito: true, mensaje: 'Estado cambiado.' });
    } catch (error) {
        res.status(500).json({ exito: false, mensaje: 'Error.' });
    }
});

app.put('/api/admin/tutores/:id/vincular', async (req, res) => {
    try {
        await pool.query('UPDATE tutores_empresas SET empresa_id = ? WHERE id = ?', [req.body.empresa_id, req.params.id]);
        res.json({ exito: true, mensaje: 'Vinculado.' });
    } catch (error) {
        res.status(500).json({ exito: false, mensaje: 'Error.' });
    }
});

app.put('/api/admin/tutores/:id/desvincular', async (req, res) => {
    try {
        await pool.query('UPDATE tutores_empresas SET empresa_id = NULL WHERE id = ?', [req.params.id]);
        res.json({ exito: true, mensaje: 'Desvinculado.' });
    } catch (error) {
        res.status(500).json({ exito: false, mensaje: 'Error.' });
    }
});

app.delete('/api/admin/tutores', async (req, res) => {
    const { ids } = req.body;
    if (!ids || ids.length === 0) return res.status(400).json({ exito: false, mensaje: 'Sin IDs.' });
    try {
        const placeholders = ids.map(() => '?').join(',');
        await pool.query(`DELETE FROM tutores_empresas WHERE id IN (${placeholders})`, ids);
        res.json({ exito: true, mensaje: 'Eliminados.' });
    } catch (error) {
        res.status(500).json({ exito: false, mensaje: 'Error.' });
    }
});

// ----------------------------------------------------
// RUTAS PARA SOLICITUDES DE INCORPORACIÓN (ADMIN)
// ----------------------------------------------------

// 1. Obtener todas las solicitudes pendientes
app.get('/api/admin/solicitudes-incorporacion', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                s.id AS solicitud_id,
                s.fecha_solicitud,
                s.estado,
                u.id AS estudiante_id,
                u.cedula,
                u.nombres,
                u.apellidos,
                e.id AS empresa_id,
                e.nombre_empresa,
                o.titulo AS oferta_titulo,
                t.nombres AS tutor_nombres,
                t.apellidos AS tutor_apellidos
            FROM solicitudes_incorporacion s
            JOIN usuarios u ON s.estudiante_id = u.id
            JOIN empresas e ON s.empresa_id = e.id
            JOIN ofertas_practicas o ON s.oferta_id = o.id
            JOIN tutores_empresas t ON s.tutor_id = t.id
            WHERE s.estado = 'Pendiente'
            ORDER BY s.fecha_solicitud DESC
        `);
        res.json({ exito: true, solicitudes: rows });
    } catch (error) {
        console.error('Error al obtener solicitudes de incorporación:', error);
        res.status(500).json({ exito: false, mensaje: 'Error al consultar las notificaciones.' });
    }
});

// 2. Procesar solicitud (Aprobar o Rechazar) y avisar al estudiante
app.post('/api/admin/procesar-incorporacion', async (req, res) => {
    const { solicitud_id, estudiante_id, empresa_id, accion, tiempo_pasantia } = req.body;

    try {
        const [solicitud] = await pool.query(
            "SELECT id FROM solicitudes_incorporacion WHERE id = ? AND estado = 'Pendiente'",
            [solicitud_id]
        );
        if (solicitud.length === 0) {
            return res.status(400).json({ exito: false, mensaje: 'Esta solicitud ya fue procesada.' });
        }

        const [empresa] = await pool.query('SELECT nombre_empresa FROM empresas WHERE id = ?', [empresa_id]);
        const nombreEmpresa = empresa.length > 0 ? empresa[0].nombre_empresa : 'la empresa';

        if (accion === 'Aprobar') {
            await pool.query('UPDATE solicitudes_incorporacion SET estado = ? WHERE id = ?', ['Aprobada', solicitud_id]);
            await pool.query('DELETE FROM asignaciones WHERE estudiante_id = ?', [estudiante_id]);
            await pool.query(
                'INSERT INTO asignaciones (estudiante_id, empresa_id, tiempo_pasantia) VALUES (?, ?, ?)',
                [estudiante_id, empresa_id, tiempo_pasantia || 'No definido']
            );
            await crearNotificacion(
                estudiante_id,
                `Ya estás vinculado a ${nombreEmpresa} para tus pasantías. Desde ahora puedes registrar tus horas.`,
                'Vinculacion'
            );
            res.json({ exito: true, mensaje: 'Estudiante vinculado oficialmente a la empresa.' });
        } else if (accion === 'Rechazar') {
            await pool.query('UPDATE solicitudes_incorporacion SET estado = ? WHERE id = ?', ['Rechazada', solicitud_id]);
            await crearNotificacion(
                estudiante_id,
                `La solicitud para incorporarte a ${nombreEmpresa} no fue aprobada por Coordinación. Puedes seguir postulando a otras ofertas.`,
                'Solicitud Rechazada'
            );
            res.json({ exito: true, mensaje: 'Solicitud rechazada.' });
        } else {
            res.status(400).json({ exito: false, mensaje: 'Acción no válida.' });
        }
    } catch (error) {
        console.error('Error al procesar la vinculación:', error);
        res.status(500).json({ exito: false, mensaje: 'Error al ejecutar la acción en el servidor.' });
    }
});

// ==========================================
// --- RUTAS DEL TUTOR EMPRESARIAL ---
// ==========================================

// Datos actuales del tutor (por si el admin lo vinculó después de iniciar sesión)
app.get('/api/tutor/perfil/:id', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT t.id, t.empresa_id, e.nombre_empresa
            FROM tutores_empresas t LEFT JOIN empresas e ON t.empresa_id = e.id
            WHERE t.id = ?
        `, [req.params.id]);
        if (rows.length > 0) res.json({ exito: true, perfil: rows[0] });
        else res.status(404).json({ exito: false, mensaje: 'Tutor no encontrado.' });
    } catch (error) {
        res.status(500).json({ exito: false, mensaje: 'Error.' });
    }
});

app.get('/api/tutor/empresa/:id', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT nombre_empresa FROM empresas WHERE id = ?', [req.params.id]);
        if (rows.length > 0) res.json({ exito: true, nombre_empresa: rows[0].nombre_empresa });
        else res.status(404).json({ exito: false, mensaje: 'Empresa no encontrada.' });
    } catch (error) {
        res.status(500).json({ exito: false, mensaje: 'Error.' });
    }
});

// Pasantes de la empresa con horas aprobadas, pendientes y meta de la carrera
app.get('/api/tutor/pasantes/:empresa_id', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT u.id, u.cedula, u.nombres, u.apellidos, u.correo, c.nombre AS carrera_nombre, c.horas_requeridas AS meta_horas, a.tiempo_pasantia,
            COALESCE((SELECT SUM(horas_realizadas) FROM registro_horas WHERE estudiante_id = u.id AND estado_validacion = 'Aprobada'), 0) AS horas_aprobadas,
            COALESCE((SELECT SUM(horas_realizadas) FROM registro_horas WHERE estudiante_id = u.id AND estado_validacion = 'Pendiente'), 0) AS horas_pendientes
            FROM usuarios u JOIN asignaciones a ON u.id = a.estudiante_id LEFT JOIN carreras c ON u.carrera_id = c.id
            WHERE a.empresa_id = ?
            ORDER BY u.apellidos ASC
        `, [req.params.empresa_id]);
        res.json({ exito: true, pasantes: rows });
    } catch (error) {
        res.status(500).json({ exito: false, mensaje: 'Error.' });
    }
});

app.get('/api/tutor/horas-pendientes/:empresa_id', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT r.id AS hora_id, DATE_FORMAT(r.fecha_registro, '%Y-%m-%d') AS fecha_registro, r.horas_realizadas, r.descripcion_actividades,
                   u.id AS estudiante_id, u.nombres, u.apellidos, u.cedula
            FROM registro_horas r JOIN usuarios u ON r.estudiante_id = u.id JOIN asignaciones a ON u.id = a.estudiante_id
            WHERE a.empresa_id = ? AND r.estado_validacion = 'Pendiente' ORDER BY r.fecha_registro ASC, r.id ASC
        `, [req.params.empresa_id]);
        res.json({ exito: true, horas: rows });
    } catch (error) {
        res.status(500).json({ exito: false, mensaje: 'Error.' });
    }
});

// Aprobar o rechazar un registro de horas y avisar al estudiante
app.put('/api/tutor/horas/:id/estado', async (req, res) => {
    const { estado, motivo, empresa_id } = req.body;

    if (!['Aprobada', 'Rechazada'].includes(estado)) {
        return res.status(400).json({ exito: false, mensaje: 'Estado no válido.' });
    }
    if (!empresa_id) {
        return res.status(400).json({ exito: false, mensaje: 'Falta la empresa del tutor.' });
    }

    try {
        // El registro debe pertenecer a un estudiante vinculado a la empresa del tutor
        const [rows] = await pool.query(`
            SELECT r.id, r.estudiante_id, r.horas_realizadas, DATE_FORMAT(r.fecha_registro, '%Y-%m-%d') AS fecha_registro, r.estado_validacion
            FROM registro_horas r JOIN asignaciones a ON r.estudiante_id = a.estudiante_id
            WHERE r.id = ? AND a.empresa_id = ?
        `, [req.params.id, empresa_id]);

        if (rows.length === 0) {
            return res.status(404).json({ exito: false, mensaje: 'Registro no encontrado para tu empresa.' });
        }
        const registro = rows[0];
        if (registro.estado_validacion !== 'Pendiente') {
            return res.status(400).json({ exito: false, mensaje: 'Este registro ya fue revisado.' });
        }

        await pool.query('UPDATE registro_horas SET estado_validacion = ? WHERE id = ?', [estado, req.params.id]);

        const horas = Number(registro.horas_realizadas);
        const fecha = formatearFecha(registro.fecha_registro);
        if (estado === 'Aprobada') {
            await crearNotificacion(registro.estudiante_id, `Tu tutor aprobó tu registro de ${horas} h del ${fecha}.`, 'Horas Aprobadas');
        } else {
            const razon = motivo && String(motivo).trim() ? ` Motivo: ${String(motivo).trim()}` : '';
            await crearNotificacion(registro.estudiante_id, `Tu tutor rechazó tu registro de ${horas} h del ${fecha}.${razon}`, 'Horas Rechazadas');
        }

        res.json({ exito: true, mensaje: `Horas ${estado.toLowerCase()}s.` });
    } catch (error) {
        console.error('Error al validar horas:', error);
        res.status(500).json({ exito: false, mensaje: 'Error.' });
    }
});

app.post('/api/tutor/ofertas', async (req, res) => {
    const { empresa_id, titulo, descripcion, carrera_id, cupos } = req.body;
    try {
        await pool.query('INSERT INTO ofertas_practicas (empresa_id, titulo, descripcion, carrera_id, cupos) VALUES (?, ?, ?, ?, ?)', [empresa_id, titulo, descripcion, carrera_id, cupos]);
        res.json({ exito: true, mensaje: 'Oferta publicada.' });
    } catch (error) {
        res.status(500).json({ exito: false, mensaje: 'Error al publicar.' });
    }
});

app.get('/api/tutor/ofertas/:empresa_id', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT o.id, o.titulo, o.cupos, o.estado, COALESCE(c.nombre, 'Carrera no especificada') AS carrera_nombre,
            (SELECT COUNT(*) FROM postulaciones p WHERE p.oferta_id = o.id) AS total_postulantes
            FROM ofertas_practicas o LEFT JOIN carreras c ON o.carrera_id = c.id WHERE o.empresa_id = ? ORDER BY o.id DESC
        `, [req.params.empresa_id]);
        res.json({ exito: true, ofertas: rows });
    } catch (error) {
        res.status(500).json({ exito: false, mensaje: 'Error.' });
    }
});

// Postulantes de una oferta, indicando si ya están vinculados o con solicitud en curso
app.get('/api/tutor/ofertas/:oferta_id/postulantes', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT p.id AS postulacion_id, p.estudiante_id, p.fecha_postulacion, p.cv_ruta, p.estado, u.nombres, u.apellidos, u.cedula, u.correo,
            (SELECT COUNT(*) FROM asignaciones a WHERE a.estudiante_id = p.estudiante_id AND a.empresa_id = o.empresa_id) AS ya_vinculado,
            (SELECT COUNT(*) FROM solicitudes_incorporacion s WHERE s.estudiante_id = p.estudiante_id AND s.oferta_id = p.oferta_id AND s.estado = 'Pendiente') AS solicitud_pendiente
            FROM postulaciones p
            JOIN usuarios u ON p.estudiante_id = u.id
            JOIN ofertas_practicas o ON p.oferta_id = o.id
            WHERE p.oferta_id = ? ORDER BY p.fecha_postulacion DESC
        `, [req.params.oferta_id]);
        res.json({ exito: true, postulantes: rows });
    } catch (error) {
        console.error('Error al obtener postulantes:', error);
        res.status(500).json({ exito: false, mensaje: 'Error.' });
    }
});

app.put('/api/tutor/ofertas/:id/estado', async (req, res) => {
    try {
        await pool.query('UPDATE ofertas_practicas SET estado = ? WHERE id = ?', [req.body.estado, req.params.id]);
        res.json({ exito: true, mensaje: `Oferta ${req.body.estado}.` });
    } catch (error) {
        res.status(500).json({ exito: false, mensaje: 'Error.' });
    }
});

// El tutor solicita la incorporación de un estudiante a su empresa
app.post('/api/tutor/solicitar-incorporacion', async (req, res) => {
    const { estudiante_id, empresa_id, oferta_id, tutor_id } = req.body;
    try {
        const [vinculado] = await pool.query(
            'SELECT id FROM asignaciones WHERE estudiante_id = ? AND empresa_id = ?',
            [estudiante_id, empresa_id]
        );
        if (vinculado.length > 0) {
            return res.status(400).json({ exito: false, mensaje: 'Este estudiante ya está vinculado a tu empresa.' });
        }

        const [pendiente] = await pool.query(
            "SELECT id FROM solicitudes_incorporacion WHERE estudiante_id = ? AND oferta_id = ? AND estado = 'Pendiente'",
            [estudiante_id, oferta_id]
        );
        if (pendiente.length > 0) {
            return res.status(400).json({ exito: false, mensaje: 'Ya hay una solicitud pendiente para este estudiante en esta vacante.' });
        }

        await pool.query(
            'INSERT INTO solicitudes_incorporacion (estudiante_id, empresa_id, oferta_id, tutor_id) VALUES (?, ?, ?, ?)',
            [estudiante_id, empresa_id, oferta_id, tutor_id]
        );

        res.json({ exito: true, mensaje: 'Solicitud de incorporación enviada al administrador correctamente.' });
    } catch (error) {
        console.error('Error al solicitar incorporación:', error);
        res.status(500).json({ exito: false, mensaje: 'Error interno del servidor al procesar la solicitud.' });
    }
});

// Desvincular un pasante desde el lado del tutor
app.post('/api/tutor/desvincular-pasante', async (req, res) => {
    const { estudiante_id, empresa_id, motivo } = req.body;

    if (!motivo || !String(motivo).trim()) {
        return res.status(400).json({ exito: false, mensaje: 'Indica el motivo de la desvinculación.' });
    }

    try {
        const [empresa] = await pool.query('SELECT nombre_empresa FROM empresas WHERE id = ?', [empresa_id]);
        const [resultado] = await pool.query('DELETE FROM asignaciones WHERE estudiante_id = ? AND empresa_id = ?', [estudiante_id, empresa_id]);

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ exito: false, mensaje: 'El estudiante no está vinculado a tu empresa.' });
        }

        const nombreEmpresa = empresa.length > 0 ? empresa[0].nombre_empresa : 'la empresa';
        await crearNotificacion(
            estudiante_id,
            `${cerrarFrase('Fuiste desvinculado de ' + nombreEmpresa)} Motivo: ${String(motivo).trim()}`,
            'Desvinculacion'
        );

        res.json({ exito: true, mensaje: 'Pasante desvinculado correctamente.' });
    } catch (error) {
        console.error('Error al desvincular pasante:', error);
        res.status(500).json({ exito: false, mensaje: 'Error al procesar la desvinculación.' });
    }
});

// Historial de horas de un pasante con resumen (solo si pertenece a la empresa del tutor)
app.get('/api/tutor/historial-pasante/:estudiante_id', async (req, res) => {
    const { empresa_id } = req.query;
    if (!empresa_id) {
        return res.status(400).json({ exito: false, mensaje: 'Falta la empresa del tutor.' });
    }

    try {
        const [estudiante] = await pool.query(`
            SELECT u.id, u.cedula, u.nombres, u.apellidos, c.nombre AS carrera_nombre, c.horas_requeridas AS meta_horas, a.tiempo_pasantia
            FROM usuarios u
            JOIN asignaciones a ON u.id = a.estudiante_id
            LEFT JOIN carreras c ON u.carrera_id = c.id
            WHERE u.id = ? AND a.empresa_id = ?
        `, [req.params.estudiante_id, empresa_id]);

        if (estudiante.length === 0) {
            return res.status(404).json({ exito: false, mensaje: 'El estudiante no está vinculado a tu empresa.' });
        }

        const [historial] = await pool.query(`
            SELECT id, DATE_FORMAT(fecha_registro, '%Y-%m-%d') AS fecha_registro, horas_realizadas, descripcion_actividades, estado_validacion
            FROM registro_horas
            WHERE estudiante_id = ?
            ORDER BY fecha_registro DESC, id DESC
        `, [req.params.estudiante_id]);

        const resumen = { aprobadas: 0, pendientes: 0, rechazadas: 0, registros: historial.length };
        historial.forEach(h => {
            const horas = Number(h.horas_realizadas) || 0;
            if (h.estado_validacion === 'Aprobada') resumen.aprobadas += horas;
            else if (h.estado_validacion === 'Pendiente') resumen.pendientes += horas;
            else if (h.estado_validacion === 'Rechazada') resumen.rechazadas += horas;
        });

        res.json({ exito: true, estudiante: estudiante[0], resumen, historial });
    } catch (error) {
        console.error('Error al obtener historial del pasante:', error);
        res.status(500).json({ exito: false, mensaje: 'Error al consultar el historial.' });
    }
});

// ==========================================
// --- ARRANQUE ---
// ==========================================
const PORT = process.env.PORT || 3000;

asegurarTablas()
    .catch(error => console.error('No se pudo verificar la tabla de notificaciones:', error.message))
    .finally(() => {
        app.listen(PORT, () => {
            console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
        });
    });