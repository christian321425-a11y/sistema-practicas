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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});