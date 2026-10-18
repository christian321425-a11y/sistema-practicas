const express = require('express');
const cors = require('cors');
require('dotenv').config();
const pool = require('./config/database');

const app = express();

app.use(cors());
app.use(express.json());

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

// Ruta para obtener el progreso de horas según la carrera del estudiante
app.get('/api/progreso/:estudiante_id', async (req, res) => {
    const { estudiante_id } = req.params;

    try {
        const [rows] = await pool.query(`
            SELECT 
                c.nombre AS nombre_carrera,
                c.horas_requeridas AS meta_horas,
                COALESCE((SELECT SUM(horas_realizadas) FROM registro_horas WHERE estudiante_id = u.id AND estado_validacion != 'rechazada'), 0) AS total_horas
            FROM usuarios u
            LEFT JOIN carreras c ON u.carrera_id = c.id
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});

