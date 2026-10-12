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
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});