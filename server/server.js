const express = require('express');
const app = express();
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const socketIO = require('socket.io');
const callService = require('./services/call.service');
const { sendSuccess, sendError } = require('./utils/utils');
dotenv.config();

const PORT = process.env.PORT || 4000;

const authRoutes = require('./routes/auth.routes');
const incidentsRoutes = require('./routes/incidents.routes');
const incidentProcessingRoutes = require('./routes/incidentProcessing.routes');
const callRoutes = require('./routes/call.routes');
const recordingsRoutes = require('./routes/transcription.routes');
const twilioRoutes = require('./routes/twilio.routes');


const server = http.createServer(app);

const io = socketIO(server, {
    cors: {
        origin: ['http://localhost:5173'],
        methods: ['GET', 'POST'],
        credentials: true
    }
});

app.use(cors({
    // origin: "*",
    origin: ['http://localhost:5173'],
    credentials: true
}));

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/incidents', incidentsRoutes);
app.use('/api/incident-processing', incidentProcessingRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/recordings', recordingsRoutes);
app.use('/api/twilio', twilioRoutes);

app.get('/', (req, res) => {
    sendSuccess(res, {
        message: 'Welcome to SaferHoods API',
    });
});

io.on('connection', (socket) => {
    // Client connected - no need to log
    let userId = null;
    let userType = null;

    socket.on('register-authority', (id) => {
        userType = 'authority';
        userId = id;
        callService.registerAuthority(socket, id);
    });

    socket.on('register-reporter', () => {
        userType = 'reporter';
        userId = callService.registerReporter(socket);
        socket.emit('reporter-registered', { reporterId: userId });
    });

    socket.on('initiate-call', ({ mode = 'text' }) => {
        if (userType === 'reporter' && userId) {
            const callId = callService.initiateCall(userId, mode);
            socket.emit('call-initiated', { callId, mode });
        } else {
            socket.emit('error', { message: 'Only reporters can initiate calls' });
        }
    });

    socket.on('accept-call', ({ callId, mode = 'text' }) => {
        if (userType === 'authority' && userId) {
            const result = callService.acceptCall(callId, userId, mode);
            if (!result.success) {
                socket.emit('error', { message: result.message });
            }
        } else {
            socket.emit('error', { message: 'Only authorities can accept calls' });
        }
    });

    socket.on('reject-call', ({ callId }) => {
        if (userType === 'authority' && userId) {
            const result = callService.rejectCall(callId, userId);
            if (!result.success) {
                socket.emit('error', { message: result.message });
            }
        } else {
            socket.emit('error', { message: 'Only authorities can reject calls' });
        }
    });

    socket.on('end-call', ({ callId }) => {
        if (userId && userType) {
            const result = callService.endCall(callId, userId, userType);
            if (!result.success) {
                socket.emit('error', { message: result.message });
            }
        } else {
            socket.emit('error', { message: 'User not registered' });
        }
    });

    socket.on('signal', ({ callId, signal }) => {
        if (userId && userType) {
            // No need to log signals

            const result = callService.relaySignal(callId, signal, userType, userId);
            if (!result.success) {
                socket.emit('error', { message: result.message });
            }
        } else {
            socket.emit('error', { message: 'User not registered' });
        }
    });

    socket.on('disconnect', () => {
        // Client disconnected - no need to log
        if (userType === 'authority' && userId) {
            callService.unregisterAuthority(userId);
        } else if (userType === 'reporter' && userId) {
            callService.unregisterReporter(userId);
        }
    });
});

const initializeApp = async () => {
    try {
        server.listen(PORT, () => {
            // Server start logs can be kept for operational purposes
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Error initializing the app:', error);
        process.exit(1);
    }
};

initializeApp();
