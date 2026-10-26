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

// Exponer la carpeta de PDFs para que el administrador pueda descargarlos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ruta de prueba
app.get('/api/estado', (req, res) => {
    res.json({ mensaje: 'Servidor Node.js funcionando correctamente' });
});
// Ruta para procesar el Login
app.post('/api/login', async (req, res) => {
    const { cedula, password, rol } = req.body;

    try {
        // Consultamos a la base de datos si existe un usuario con esos datos exactos
        const [rows] = await pool.query(
            'SELECT * FROM usuarios WHERE cedula = ? AND password_hash = ? AND rol = ?',
            [cedula, password, rol]
        );

        // Si encuentra al usuario (rows.length > 0)
        if (rows.length > 0) {
            res.json({ exito: true, mensaje: 'Login correcto', usuario: rows[0] });
        } else {
            res.status(401).json({ exito: false, mensaje: 'Cédula, contraseña o rol incorrectos' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ exito: false, mensaje: 'Error interno del servidor' });
    }

});
// Ruta para registrar horas de práctica
app.post('/api/horas', async (req, res) => {
    // Extraemos los datos que nos envía el frontend
    const { estudiante_id, horas, descripcion, fecha } = req.body;

    try {
        // Insertamos el registro en la tabla registro_horas
        const [resultado] = await pool.query(
            'INSERT INTO registro_horas (estudiante_id, horas_realizadas, descripcion_actividades, fecha_registro) VALUES (?, ?, ?, ?)',
            [estudiante_id, horas, descripcion, fecha]
        );

        // Verificamos si se guardó con éxito (affectedRows > 0)
        if (resultado.affectedRows > 0) {
            res.json({ exito: true, mensaje: 'Horas registradas correctamente' });
        } else {
            res.status(400).json({ exito: false, mensaje: 'No se pudo guardar el registro' });
        }
    } catch (error) {
        console.error('Error en /api/horas:', error);
        res.status(500).json({ exito: false, mensaje: 'Error interno del servidor al guardar las horas' });
    }
});

// Ruta para obtener el progreso de horas y empresa del estudiante
app.get('/api/progreso/:estudiante_id', async (req, res) => {
    const { estudiante_id } = req.params;

    try {
        const [rows] = await pool.query(`
            SELECT 
                c.nombre AS nombre_carrera,
                c.horas_requeridas AS meta_horas,
                COALESCE((SELECT SUM(horas_realizadas) FROM registro_horas WHERE estudiante_id = u.id AND estado_validacion != 'rechazada'), 0) AS total_horas,
                e.nombre_empresa
            FROM usuarios u
            LEFT JOIN carreras c ON u.carrera_id = c.id
            LEFT JOIN asignaciones a ON u.id = a.estudiante_id
            LEFT JOIN empresas e ON a.empresa_id = e.id
            WHERE u.id = ?
        `, [estudiante_id]);

        if (rows.length > 0) {
            res.json({ exito: true, datos: rows[0] });
        } else {
            res.status(404).json({ exito: false, mensaje: 'Usuario no encontrado' });
        }
    } catch (error) {
        console.error('Error al obtener progreso:', error);
        res.status(500).json({ exito: false, mensaje: 'Error al consultar el progreso' });
    }
});

// Ruta para obtener el historial de horas de un estudiante
app.get('/api/historial/:estudiante_id', async (req, res) => {
    const { estudiante_id } = req.params;

    try {
        const [rows] = await pool.query(
            'SELECT fecha_registro, horas_realizadas, descripcion_actividades, estado_validacion FROM registro_horas WHERE estudiante_id = ? ORDER BY fecha_registro DESC',
            [estudiante_id]
        );
        res.json({ exito: true, historial: rows });
    } catch (error) {
        console.error('Error al obtener historial:', error);
        res.status(500).json({ exito: false, mensaje: 'Error al consultar el historial' });
    }
});

// Ruta para registrar una nueva empresa
app.post('/api/empresas', async (req, res) => {
    const { nombre, direccion, telefono } = req.body;

    try {
        const [resultado] = await pool.query(
            'INSERT INTO empresas (nombre, direccion, telefono) VALUES (?, ?, ?)',
            [nombre, direccion, telefono]
        );

        if (resultado.affectedRows > 0) {
            res.json({ exito: true, mensaje: 'Empresa registrada correctamente' });
        } else {
            res.status(400).json({ exito: false, mensaje: 'No se pudo guardar el registro' });
        }
    } catch (error) {
        console.error('Error en /api/empresas:', error);
        res.status(500).json({ exito: false, mensaje: 'Error interno del servidor al registrar la empresa' });
    }
});

// --- CONFIGURACIÓN PARA SUBIDA DE ARCHIVOS (MULTER) ---
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir); // Crea la carpeta "uploads" si no existe
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir); 
    },
    filename: function (req, file, cb) {
        // Renombramos el archivo con la fecha exacta para hacerlo único
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// --- RUTA PARA RECIBIR LA SOLICITUD DE CONVENIO ---
// Usamos upload.single('documento') para capturar el PDF
app.post('/api/solicitud-convenio', upload.single('documento'), async (req, res) => {
    // Extraemos los textos del formulario
    const { razon_social, ruc, tipo_empresa, direccion, actividad, contacto_nombre, contacto_cargo, contacto_telefono, contacto_correo } = req.body;
    
    // Verificamos que el archivo realmente haya llegado
    if (!req.file) {
        return res.status(400).json({ exito: false, mensaje: 'Debe subir el documento de convenio firmado.' });
    }

    const ruta_documento = req.file.filename;

    try {
        // Generamos un código único de 6 caracteres
        const codigoUnico = 'REQ-' + Math.random().toString(36).substring(2, 8).toUpperCase();

        const [resultado] = await pool.query(
            `INSERT INTO empresas 
            (codigo_seguimiento, nombre_empresa, ruc, tipo_empresa, direccion, actividad, contacto_nombre, contacto_cargo, contacto_telefono, contacto_correo, ruta_documento, estado_aprobacion, activa) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pendiente', 1)`,
            [codigoUnico, razon_social, ruc, tipo_empresa, direccion, actividad, contacto_nombre, contacto_cargo, contacto_telefono, contacto_correo, ruta_documento]
        );

        // Devolvemos el código generado al frontend
        res.json({ exito: true, mensaje: 'Solicitud enviada.', codigo: codigoUnico });
    } catch (error) {
        console.error('Error al guardar solicitud:', error);
        res.status(500).json({ exito: false, mensaje: 'Error al procesar la solicitud.' });
    }
});

// Ruta para consultar el estado de una solicitud de convenio
app.get('/api/estado-solicitud/:codigo', async (req, res) => {
    const { codigo } = req.params;

    try {
        const [rows] = await pool.query(
            'SELECT nombre_empresa, estado_aprobacion FROM empresas WHERE codigo_seguimiento = ?',
            [codigo]
        );

        if (rows.length > 0) {
            res.json({ exito: true, empresa: rows[0] });
        } else {
            res.status(404).json({ exito: false, mensaje: 'Código no encontrado. Verifique e intente nuevamente.' });
        }
    } catch (error) {
        console.error('Error al consultar código:', error);
        res.status(500).json({ exito: false, mensaje: 'Error interno al consultar el estado.' });
    }
});

// Ruta para que el Admin vea todas las solicitudes
app.get('/api/admin/solicitudes', async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT id, codigo_seguimiento, nombre_empresa, ruc, contacto_nombre, contacto_cargo, contacto_telefono, contacto_correo, direccion, actividad, ruta_documento, estado_aprobacion FROM empresas ORDER BY id DESC'
        );
        res.json({ exito: true, solicitudes: rows });
    } catch (error) {
        console.error('Error al obtener solicitudes:', error);
        res.status(500).json({ exito: false, mensaje: 'Error al obtener solicitudes.' });
    }
});

// Ruta para que el Admin cambie el estado (Aprobar/Rechazar)
app.put('/api/admin/solicitudes/:id/estado', async (req, res) => {
    const { id } = req.params;
    const { estado } = req.body; // Recibirá 'Aprobada' o 'Rechazada'

    try {
        await pool.query(
            'UPDATE empresas SET estado_aprobacion = ? WHERE id = ?',
            [estado, id]
        );
        res.json({ exito: true, mensaje: `La solicitud ha sido ${estado}.` });
    } catch (error) {
        console.error('Error al actualizar estado:', error);
        res.status(500).json({ exito: false, mensaje: 'Error al cambiar el estado.' });
    }
});

// Ruta para eliminar solicitudes seleccionadas (Soporta múltiples)
app.delete('/api/admin/solicitudes', async (req, res) => {
    const { ids } = req.body; // Espera un arreglo: [1, 2, 5]

    if (!ids || ids.length === 0) {
        return res.status(400).json({ exito: false, mensaje: 'No se enviaron solicitudes para eliminar.' });
    }

    try {
        // Genera los signos de interrogación dinámicamente según la cantidad de IDs (?, ?, ?)
        const placeholders = ids.map(() => '?').join(',');
        await pool.query(`DELETE FROM empresas WHERE id IN (${placeholders})`, ids);
        
        res.json({ exito: true, mensaje: 'Registros eliminados correctamente.' });
    } catch (error) {
        console.error('Error al eliminar solicitudes:', error);
        res.status(500).json({ exito: false, mensaje: 'Error al eliminar en la base de datos.' });
    }
});

// Ruta para obtener las carreras y llenar el formulario de estudiantes
app.get('/api/admin/carreras', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, nombre FROM carreras ORDER BY nombre ASC');
        res.json({ exito: true, carreras: rows });
    } catch (error) {
        console.error('Error al obtener carreras:', error);
        res.status(500).json({ exito: false, mensaje: 'Error al obtener las carreras.' });
    }
});

// Ruta para registrar un nuevo estudiante
app.post('/api/admin/estudiantes', async (req, res) => {
    const { cedula, nombres, apellidos, password, carrera_id } = req.body;

    try {
        const [existe] = await pool.query('SELECT id FROM usuarios WHERE cedula = ?', [cedula]);
        if (existe.length > 0) {
            return res.status(400).json({ exito: false, mensaje: 'La cédula ya está registrada en el sistema.' });
        }

        await pool.query(
            'INSERT INTO usuarios (cedula, nombres, apellidos, password_hash, rol, carrera_id) VALUES (?, ?, ?, ?, ?, ?)',
            [cedula, nombres, apellidos, password, 'estudiante', carrera_id]
        );

        res.json({ exito: true, mensaje: 'Estudiante registrado correctamente.' });
    } catch (error) {
        console.error('Error al registrar estudiante:', error);
        res.status(500).json({ exito: false, mensaje: 'Error interno al registrar el estudiante.' });
    }
});

// Ruta única y correcta para que el Admin obtenga todos los estudiantes con sus horas y empresa real
// Ruta para que el Admin obtenga todos los estudiantes con sus horas, empresa asignada y tiempo de pasantía
app.get('/api/admin/estudiantes', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                u.id, 
                u.cedula, 
                u.nombres, 
                u.apellidos, 
                u.correo, 
                c.nombre AS carrera_nombre,
                c.horas_requeridas AS meta_horas,
                COALESCE((SELECT SUM(horas_realizadas) FROM registro_horas WHERE estudiante_id = u.id AND estado_validacion != 'rechazada'), 0) AS horas_realizadas,
                e.nombre_empresa AS empresa_nombre,
                a.tiempo_pasantia
            FROM usuarios u 
            LEFT JOIN carreras c ON u.carrera_id = c.id 
            LEFT JOIN asignaciones a ON u.id = a.estudiante_id
            LEFT JOIN empresas e ON a.empresa_id = e.id
            WHERE u.rol = 'estudiante' 
            ORDER BY u.id DESC
        `);
        res.json({ exito: true, estudiantes: rows });
    } catch (error) {
        console.error('Error al obtener estudiantes:', error);
        res.status(500).json({ exito: false, mensaje: 'Error al obtener los estudiantes.' });
    }
});

// Ruta para eliminar estudiantes seleccionados (Soporta múltiples)
app.delete('/api/admin/estudiantes', async (req, res) => {
    const { ids } = req.body;

    if (!ids || ids.length === 0) {
        return res.status(400).json({ exito: false, mensaje: 'No se enviaron estudiantes para eliminar.' });
    }

    try {
        const placeholders = ids.map(() => '?').join(',');
        await pool.query(`DELETE FROM usuarios WHERE id IN (${placeholders})`, ids);
        
        res.json({ exito: true, mensaje: 'Estudiantes eliminados correctamente.' });
    } catch (error) {
        console.error('Error al eliminar estudiantes:', error);
        res.status(500).json({ exito: false, mensaje: 'Error al eliminar en la base de datos.' });
    }
});

// Ruta para obtener solo las empresas con convenio Aprobado (para el selector de asignaciones)
app.get('/api/admin/empresas-aprobadas', async (req, res) => {
    try {
        const [rows] = await pool.query(
            "SELECT id, nombre_empresa, ruc FROM empresas WHERE estado_aprobacion = 'Aprobada' ORDER BY nombre_empresa ASC"
        );
        res.json({ exito: true, empresas: rows });
    } catch (error) {
        console.error('Error al obtener empresas aprobadas:', error);
        res.status(500).json({ exito: false, mensaje: 'Error al obtener empresas aprobadas.' });
    }
});

// Ruta para registrar una asignación de estudiante a empresa
app.post('/api/admin/asignaciones', async (req, res) => {
    const { estudiante_id, empresa_id, tiempo_pasantia } = req.body;

    try {
        await pool.query(
            'INSERT INTO asignaciones (estudiante_id, empresa_id, tiempo_pasantia) VALUES (?, ?, ?)',
            [estudiante_id, empresa_id, tiempo_pasantia]
        );
        res.json({ exito: true, mensaje: 'Estudiante asignado correctamente a la empresa.' });
    } catch (error) {
        console.error('Error al guardar asignación:', error);
        res.status(500).json({ exito: false, mensaje: 'Error interno al registrar la asignación.' });
    }
});

// Ruta para desvincular un estudiante de su empresa asignada
app.delete('/api/admin/asignaciones/:estudiante_id', async (req, res) => {
    const { estudiante_id } = req.params;

    try {
        await pool.query('DELETE FROM asignaciones WHERE estudiante_id = ?', [estudiante_id]);
        res.json({ exito: true, mensaje: 'Estudiante desvinculado correctamente.' });
    } catch (error) {
        console.error('Error al desvincular estudiante:', error);
        res.status(500).json({ exito: false, mensaje: 'Error interno al desvincular.' });
    }
});

// ==========================================
// --- RUTAS PARA TUTORES EMPRESARIALES ---
// ==========================================

// 1. Obtener todos los tutores con su empresa vinculada
app.get('/api/admin/tutores', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                t.id, 
                t.cedula, 
                t.nombres, 
                t.apellidos, 
                t.correo, 
                t.estado_cuenta, 
                t.empresa_id, 
                e.nombre_empresa AS empresa_nombre 
            FROM tutores_empresas t
            LEFT JOIN empresas e ON t.empresa_id = e.id
            ORDER BY t.id DESC
        `);
        res.json({ exito: true, tutores: rows });
    } catch (error) {
        console.error('Error al obtener tutores:', error);
        res.status(500).json({ exito: false, mensaje: 'Error al obtener tutores.' });
    }
});

// 2. Registrar un nuevo tutor
app.post('/api/admin/tutores', async (req, res) => {
    const { cedula, nombres, apellidos, correo, password } = req.body;
    try {
        const [existe] = await pool.query('SELECT id FROM tutores_empresas WHERE cedula = ?', [cedula]);
        if (existe.length > 0) return res.status(400).json({ exito: false, mensaje: 'La cédula del tutor ya existe.' });

        await pool.query(
            'INSERT INTO tutores_empresas (cedula, nombres, apellidos, correo, password_hash) VALUES (?, ?, ?, ?, ?)',
            [cedula, nombres, apellidos, correo, password]
        );
        res.json({ exito: true, mensaje: 'Tutor registrado correctamente.' });
    } catch (error) {
        console.error('Error al registrar tutor:', error);
        res.status(500).json({ exito: false, mensaje: 'Error al registrar el tutor.' });
    }
});

// 3. Activar / Desactivar cuenta del tutor
app.put('/api/admin/tutores/:id/estado', async (req, res) => {
    const { estado_cuenta } = req.body; // 'Activo' o 'Inactivo'
    try {
        await pool.query('UPDATE tutores_empresas SET estado_cuenta = ? WHERE id = ?', [estado_cuenta, req.params.id]);
        res.json({ exito: true, mensaje: `Cuenta del tutor cambiada a ${estado_cuenta}.` });
    } catch (error) {
        res.status(500).json({ exito: false, mensaje: 'Error al cambiar el estado de la cuenta.' });
    }
});

// 4. Vincular empresa a tutor
app.put('/api/admin/tutores/:id/vincular', async (req, res) => {
    const { empresa_id } = req.body;
    try {
        await pool.query('UPDATE tutores_empresas SET empresa_id = ? WHERE id = ?', [empresa_id, req.params.id]);
        res.json({ exito: true, mensaje: 'Tutor vinculado a la empresa exitosamente.' });
    } catch (error) {
        res.status(500).json({ exito: false, mensaje: 'Error al vincular empresa.' });
    }
});

// 5. Desvincular empresa del tutor
app.put('/api/admin/tutores/:id/desvincular', async (req, res) => {
    try {
        await pool.query('UPDATE tutores_empresas SET empresa_id = NULL WHERE id = ?', [req.params.id]);
        res.json({ exito: true, mensaje: 'Empresa desvinculada del tutor.' });
    } catch (error) {
        res.status(500).json({ exito: false, mensaje: 'Error al desvincular empresa.' });
    }
});

// 6. Eliminar tutores seleccionados
app.delete('/api/admin/tutores', async (req, res) => {
    const { ids } = req.body;
    if (!ids || ids.length === 0) return res.status(400).json({ exito: false, mensaje: 'No hay IDs.' });
    try {
        const placeholders = ids.map(() => '?').join(',');
        await pool.query(`DELETE FROM tutores_empresas WHERE id IN (${placeholders})`, ids);
        res.json({ exito: true, mensaje: 'Tutores eliminados correctamente.' });
    } catch (error) {
        res.status(500).json({ exito: false, mensaje: 'Error al eliminar tutores.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});

