import express from 'express';
import session from 'express-session';
import bodyParser from 'body-parser';
import { v4 as uuidv4 } from 'uuid';
import os from 'os';
import macaddress from 'macaddress';
import moment from 'moment-timezone';

const app = express();

app.use(bodyParser.json());
app.use(
    session({
        secret: 'P4-JAAM#SesionesHTTP-VariablesDeSesion',
        resave: false,
        saveUninitialized: true,
        cookie: {
            maxAge: 24 * 60 * 60 * 1000,
            secure: false,
        },
    })
);

let serverMAC;
try {
    serverMAC = await macaddress.one();
} catch (error) {
    serverMAC = 'unknown';
}

const serverIP = Object.values(os.networkInterfaces())
    .flat()
    .filter((iface) => iface.family === 'IPv4' && !iface.internal)[0]?.address || 'unknown';

let sesionesActivas = [];

app.get('/iniciar-sesion', (req, res) => {
    const { fullName, email } = req.query;
    if (!req.session.data) {
        const nuevaSesion = {
            fullName: fullName || 'Usuario Anónimo',
            email: email || 'Correo no proporcionado',
            inicio: new Date(),
            ultimoAcceso: new Date(),
            id: uuidv4(),
            clientIP: req.ip,
            clientMAC: req.headers['x-client-mac'] || 'unknown',
            serverIP,
            serverMAC,
        };
        req.session.data = nuevaSesion;
        sesionesActivas.push(nuevaSesion);

        res.send('Sesión Iniciada');
    } else {
        res.send('La sesión ya está iniciada (ACTIVA)');
    }
});

app.get('/actualizar', (req, res) => {
    if (req.session.data) {
        req.session.data.ultimoAcceso = new Date();
        res.send('Fecha de última consulta actualizada');
    } else {
        res.send('No hay una sesión activa');
    }
});

app.get('/estado-sesion', (req, res) => {
    if (req.session.data) {
        const { inicio, ultimoAcceso, fullName, email } = req.session.data;
        const ahora = new Date();
        const antiguedadMs = ahora - new Date(inicio);
        const horas = Math.floor(antiguedadMs / (1000 * 60 * 60));
        const minutos = Math.floor((antiguedadMs % (1000 * 60 * 60)) / (1000 * 60));
        const segundos = Math.floor((antiguedadMs % (1000 * 60)) / 1000);

        const tiempoInactividadMs = ahora - new Date(ultimoAcceso);
        const inactividadHoras = Math.floor(tiempoInactividadMs / (1000 * 60 * 60));
        const inactividadMinutos = Math.floor((tiempoInactividadMs % (1000 * 60 * 60)) / (1000 * 60));
        const inactividadSegundos = Math.floor((tiempoInactividadMs % (1000 * 60)) / 1000);

        const inicioCDMX = moment(inicio).tz('America/Mexico_City').format('YYYY-MM-DD HH:mm:ss');
        const ultimoAccesoCDMX = moment(ultimoAcceso).tz('America/Mexico_City').format('YYYY-MM-DD HH:mm:ss');

        res.json({
            mensaje: 'Estado de la sesión',
            sessionID: req.session.data.id,
            fullName,
            email,
            inicio: inicioCDMX,
            ultimoAcceso: ultimoAccesoCDMX,
            antiguedad: `${horas} horas, ${minutos} minutos, ${segundos} segundos`,
            tiempoInactividad: `${inactividadHoras} horas, ${inactividadMinutos} minutos, ${inactividadSegundos} segundos`,
            clientIP: req.session.data.clientIP,
            clientMAC: req.session.data.clientMAC,
            serverIP: req.session.data.serverIP,
            serverMAC: req.session.data.serverMAC,
        });
    } else {
        res.json({ mensaje: 'No hay una sesión activa' });
    }
});

app.get('/listaSesionesActivas', (req, res) => {
    res.json(sesionesActivas);
});

app.get('/cerrar-sesion', (req, res) => {
    if (req.session) {
        req.session.destroy((err) => {
            if (err) {
                return res.status(500).send('Error al cerrar la sesión');
            }
            res.send('Sesión cerrada correctamente');
        });
    } else {
        res.send('No hay sesión activa para cerrar');
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});
