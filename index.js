import express from "express";
import session from "express-session";
import bodyParser from "body-parser";
import moment from "moment-timezone";
import { v4 as uuidv4 } from "uuid";
import cors from "cors";
import os from "os";


const app = express();
app.use(express.json());
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(
    session({
        secret: "P4-JAAM#MeEnferme-SesionesHTTP-VariablesDeSesion",
        resave: false,
        saveUninitialized: false,
        cookie: { maxAge: 5 * 60 * 1000 }, // 5 minutos
    })
);

const TIMEZONE = "America/Mexico_City";

const sessions = {};

const MAX_INACTIVITY_TIME = 10 * 60 * 1000;

setInterval(() => {
    const now = moment().tz(TIMEZONE);
    for (const sessionId in sessions) {
        const session = sessions[sessionId];
        const lastAccessedAt = moment(session.lastAccessedAt);
        const inactivityDuration = now.diff(lastAccessedAt);

        if (inactivityDuration > MAX_INACTIVITY_TIME) {
            console.log(`Eliminando sesión por inactividad: ${sessionId}`);
            delete sessions[sessionId];
        }
    }
}, 60 * 1000);


// Función de utilidad para obtener la IP del cliente
const getClientIp = (req) => {
    let ip = req.headers["x-forwarded-for"] ||
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress ||
        req.connection?.socket?.remoteAddress;

    if (ip && ip.startsWith("::ffff:")) {
        ip = ip.substring(7);
    }

    if (ip === "127.0.0.1" || ip === "0.0.0.0") {
        const { serverIp } = getServerNetworkInfo();
        ip = serverIp;
    }

    return ip;
};


const getServerNetworkInfo = () => {
    const interfaces = os.networkInterfaces();
    for (const name in interfaces) {
        for (const iface of interfaces[name]) {
            if (iface.family === "IPv4" && !iface.internal) {
                return { serverIp: iface.address, serverMac: iface.mac };
            }
        }
    }
    return { serverIp: "0.0.0.0", serverMac: "00:00:00:00:00:00" }; // Fallback en caso de error
};

// Login Endpoint
app.post("/login", (req, res) => {
    const { email, nickname, macAddress } = req.body;

    if (!email || !nickname || !macAddress) {
        return res.status(400).json({ message: "Falta algún campo." });
    }

    const sessionId = uuidv4();
    const now = moment().tz(TIMEZONE);
    const clientIp = getClientIp(req);

    sessions[sessionId] = {
        sessionId,
        email,
        nickname,
        macAddress,
        ip: clientIp,
        createdAt: now.format("YYYY-MM-DD HH:mm:ss"),
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
        return res.status(404).json({ message: "No se ha encontrado una sesión activa." });
    }

    delete sessions[sessionId];
    req.session?.destroy((err) => {
        if (err) {
            return res.status(500).send("Error al cerrar la sesión.");
        }
    });
    res.status(200).json({ message: "Logout exitoso." });
});

// Actualización de la sesión
app.post("/update", (req, res) => {
    const { sessionId, email, nickname } = req.body;

    if (!sessionId || !sessions[sessionId]) {
        return res.status(404).json({ message: "No existe una sesión activa." });
    }

    const now = moment().tz(TIMEZONE);
    if (email) sessions[sessionId].email = email;
    if (nickname) sessions[sessionId].nickname = nickname;
    sessions[sessionId].lastAccessedAt = now;

    res.status(200).json({
        message: "Sesión actualizada correctamente.",
        session: {
            sessionId,
            email: sessions[sessionId].email,
            nickname: sessions[sessionId].nickname,
            createdAt: sessions[sessionId].createdAt,
            lastAccessedAt: sessions[sessionId].lastAccessedAt.format("YYYY-MM-DD HH:mm:ss"),
        },
    });
});

// Estado de la sesión
app.get("/status", (req, res) => {
    const sessionId = req.query.sessionId;

    // Obtener la IP y MAC del servidor
    const { serverIp, serverMac } = getServerNetworkInfo();

    if (!sessionId || !sessions[sessionId]) {
        return res.status(404).json({ message: "No hay sesión activa." });
    }

    const now = moment().tz(TIMEZONE);
    const session = sessions[sessionId];
    const lastAccessedAt = moment(session.lastAccessedAt).tz(TIMEZONE);
    const sessionCreatedAt = moment(session.createdAt).tz(TIMEZONE);
    
    const inactivityDuration = moment.duration(now.diff(lastAccessedAt));
    const sessionDuration = moment.duration(now.diff(sessionCreatedAt));

    res.status(200).json({
        message: "Sesión activa.",
        session: {
            ...session,
            serverIp,
            serverMac, // MAC del servidor
            inactivity:`${inactivityDuration.minutes()} minutos y ${inactivityDuration.seconds()} segundos`,
            totalDuration: `${sessionDuration.hours()} horas, ${sessionDuration.minutes()} minutos y ${sessionDuration.seconds()} segundos`,
            createdAt: sessionCreatedAt.format("YYYY-MM-DD HH:mm:ss"),
            lastAccessedAt: lastAccessedAt.format("YYYY-MM-DD HH:mm:ss"),
        },
    });
});

// Endpoint para obtener la lista de sesiones activas
app.get("/sessions", (req, res) => {
    if (Object.keys(sessions).length === 0) {
        return res.status(200).json({ message: "No hay sesiones activas en este momento." });
    }

    // Obtener la IP y MAC del servidor
    const { serverIp, serverMac } = getServerNetworkInfo();

    // Generar un resumen de las sesiones activas
    const now = moment().tz(TIMEZONE);
    const sessionList = Object.values(sessions).map((session) => {
        const lastAccessedAt = moment(session.lastAccessedAt);
        const inactivityDuration = moment.duration(now.diff(lastAccessedAt));
        const sessionDuration = moment.duration(now.diff(moment(session.createdAt)));

        return {
            sessionId: session.sessionId,
            email: session.email,
            nickname: session.nickname,
            ip: session.ip,
            serverIp,
            macAddress: session.macAddress,
            serverMac,
            createdAt: session.createdAt,
            inactivity: `${inactivityDuration.minutes()} minutos y ${inactivityDuration.seconds()} segundos`,
            totalDuration: `${sessionDuration.hours()} horas, ${sessionDuration.minutes()} minutos y ${sessionDuration.seconds()} segundo`,
            lastAccessedAt: moment(lastAccessedAt).tz("America/Mexico_City").format("YYYY-MM-DD HH:mm:ss")
        };
    });

    res.status(200).json({
        message: "Lista de sesiones activas:",
        activeSessions: sessionList,
    });
});

// Ruta raíz
app.get("/", (req, res) => {
    return res.status(200).json({
        message: "Bienvenido a la API de Artiaga",
        author: "Jesus Alejandro Artiaga Morales",
    });
});

// Iniciar servidor
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});