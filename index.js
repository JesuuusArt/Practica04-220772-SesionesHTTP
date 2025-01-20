import express from "express";
import session from "express-session";
import bodyParser from "body-parser";
import moment from "moment";
import { v4 as uuidv4 } from "uuid";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(
    session({
        secret: "P4-JAAM#SesionesHTTP-VariablesDeSesion",
        resave: false,
        saveUninitialized: false,
        cookie: {maxAge: 5 * 60 * 100}
    })
)

// Sesiones almacenadas en memoria.
const sessions = {};

// Función de utilidad que permite acceder a la IP del cliente
const getClientIp = (req) => {
    return (
        req.headers["x-forwarded-for"] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        req.connetion.socket?.remoteAddress
    );
};

import os from "os";

const getLocalIp = () => {
    const networkInterfaces = os.networkInterfaces();
    for (const interfaceName in networkInterfaces) {
        const interfaces = networkInterfaces[interfaceName];
        for (const iface of interfaces) {
            // IPv4 y no interna (no localhost)
            if (iface.family === "IPv4" && !iface.internal) {
                return iface.address;
            }
        }
    }
    return null; // Retorna null si no encuentra una IP válida
};


// Login Endpoint
app.post("/login", (req, res) => {
    const { email, nickname, macAddress } = req.body;

    if (!email || !nickname || !macAddress) {
        return res.status(400).json({ message: "Falta algún campo." });
    }
    const sessionId = uuidv4();
    const now = new Date();

    sessions[sessionId] = {
        sessionId,
        email,
        nickname,
        macAddress,
        ip: getLocalIp(),
        createdAt: now,
        lastAccessedAt: now,
    };

    res.status(200).json({
        message: "Inicio de sesión exitoso.",
        sessionId,
    });
});

// Logout Endpoint
app.post("/logout", (req, res) => {
    const { sessionId } = req.body;

    if (!sessionId || !sessions[sessionId]) {
        return res.status(404).js({ message: "No se ha encontrado una sesión activa." });
    }

    delete sessions[sessionId];
    req.session?.destroy((err) => {
        if (err) {
            return res.status(500).send("Error al cerrar la sesión.");
        }
    });
    res.status(200).js({ message: "Logout exitoso." });
});

// Actualización de la sesión
app.put("/update", (req, res) => {
    const { sessionId, email, nickname } = req.body;

    if (!sessionId || !sessions[sessionId]) {
        return res.status(404).json({ message: "No existe una sesión activa." });
    }
    if (email) sessions[sessionId].email = email;
    if (nickname) sessions[sessionId].nickname = nickname;
    sessions[sessionId].lastAccessedAt = new Date();

    res.staus(200).json({
        message: "Sesión actualizada correctamente.",
        session: {
            sessionId,
            email: sessions[sessionId].email,
            nickname: sessions[sessionId].nickname,
            lastAccessedAt: sessions[sessionId].lastAccessedAt,
        },
    });
});

// Estado de la sesión
app.get("/status", (req, res) => {
    const sessionId = req.query.sessionId;

    if (!sessionId || !sessions[sessionId]) {
        return res.status(404).json({ message: "No hay sesión activa." });
    }

    res.status(200).json({
        message: "Sesión activa.",
        session: sessions[sessionId],
    });
});



const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});