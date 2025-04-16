const { v4: uuidv4 } = require('uuid');

const activeAuthorities = new Map();
const activeReporters = new Map();
const activeCalls = new Map();
const pendingCalls = new Map();

const registerAuthority = (socket, id) => {
    activeAuthorities.set(id, socket);
    console.log(`Authority registered: ${id}`);
    return id;
};

const registerReporter = (socket) => {
    const id = uuidv4();
    activeReporters.set(id, socket);
    console.log(`Reporter registered: ${id}`);
    return id;
};

const unregisterAuthority = (id) => {
    for (const [callId, call] of activeCalls.entries()) {
        if (call.authorityId === id) {
            const reporterSocket = activeReporters.get(call.reporterId);
            if (reporterSocket) {
                reporterSocket.emit('call-ended', { callId });
            }
            activeCalls.delete(callId);
        }
    }
    activeAuthorities.delete(id);
    console.log(`Authority unregistered: ${id}`);
};

const unregisterReporter = (id) => {
    for (const [callId, call] of activeCalls.entries()) {
        if (call.reporterId === id) {
            const authoritySocket = activeAuthorities.get(call.authorityId);
            if (authoritySocket) {
                authoritySocket.emit('call-ended', { callId });
            }
            activeCalls.delete(callId);
        }
    }

    for (const [callId, call] of pendingCalls.entries()) {
        if (call.reporterId === id) {
            pendingCalls.delete(callId);
        }
    }

    activeReporters.delete(id);
    console.log(`Reporter unregistered: ${id}`);
};

const initiateCall = (reporterId, mode = 'text') => {
    const callId = uuidv4();

    pendingCalls.set(callId, {
        reporterId,
        mode,
        status: 'pending'
    });

    console.log(`Call initiated: ${callId} by reporter: ${reporterId}, mode: ${mode}`);

    for (const [authorityId, socket] of activeAuthorities.entries()) {
        socket.emit('incoming-call', {
            callId,
            mode,
            message: 'Anonymous reporter is calling'
        });
    }

    return callId;
};

const acceptCall = (callId, authorityId, mode = 'text') => {
    const pendingCall = pendingCalls.get(callId);
    if (!pendingCall) {
        return { success: false, message: 'Call not found or already ended' };
    }

    const reporterSocket = activeReporters.get(pendingCall.reporterId);
    const authoritySocket = activeAuthorities.get(authorityId);

    if (!reporterSocket || !authoritySocket) {
        pendingCalls.delete(callId);
        return { success: false, message: 'One of the parties disconnected' };
    }

    const callMode = mode || pendingCall.mode || 'text';

    activeCalls.set(callId, {
        reporterId: pendingCall.reporterId,
        authorityId,
        mode: callMode,
        status: 'active'
    });
    pendingCalls.delete(callId);

    console.log(`Call accepted: ${callId} by authority: ${authorityId}, mode: ${callMode}`);

    reporterSocket.emit('call-accepted', { callId, mode: callMode });
    authoritySocket.emit('call-connected', { callId, mode: callMode });

    return { success: true };
};

const rejectCall = (callId, authorityId) => {
    const pendingCall = pendingCalls.get(callId);
    if (!pendingCall) {
        return { success: false, message: 'Call not found or already ended' };
    }

    const reporterSocket = activeReporters.get(pendingCall.reporterId);

    if (reporterSocket) {
        reporterSocket.emit('call-rejected', { callId });
    }

    pendingCalls.delete(callId);
    console.log(`Call rejected: ${callId} by authority: ${authorityId}`);

    return { success: true };
};

const endCall = (callId, userId, userType) => {
    const activeCall = activeCalls.get(callId);
    if (!activeCall) {
        return { success: false, message: 'Call not found or already ended' };
    }

    const otherPartyId = userType === 'reporter' ? activeCall.authorityId : activeCall.reporterId;
    const otherPartySocket = userType === 'reporter'
        ? activeAuthorities.get(otherPartyId)
        : activeReporters.get(otherPartyId);

    if (otherPartySocket) {
        otherPartySocket.emit('call-ended', { callId });
    }

    activeCalls.delete(callId);
    console.log(`Call ended: ${callId} by ${userType}: ${userId}`);

    return { success: true };
};

const relaySignal = (callId, signal, senderType, senderId) => {
    const activeCall = activeCalls.get(callId);
    if (!activeCall) {
        return { success: false, message: 'Call not found or already ended' };
    }

    const recipientId = senderType === 'reporter' ? activeCall.authorityId : activeCall.reporterId;
    const recipientSocket = senderType === 'reporter'
        ? activeAuthorities.get(recipientId)
        : activeReporters.get(recipientId);

    if (!recipientSocket) {
        return { success: false, message: 'Recipient disconnected' };
    }

    if (signal && signal.type) {
        if (signal.type === 'message') {
            console.log(`Relaying message from ${senderType} (${senderId}) to ${senderType === 'reporter' ? 'authority' : 'reporter'} (${recipientId}): ${signal.data}`);
        } else if (signal.type === 'offer' || signal.type === 'answer' || signal.type === 'ice-candidate') {
            console.log(`Relaying WebRTC signal (${signal.type}) from ${senderType} (${senderId}) to ${senderType === 'reporter' ? 'authority' : 'reporter'} (${recipientId})`);
        }
    }

    recipientSocket.emit('signal', { callId, signal });
    return { success: true };
};

const getActiveAuthorities = () => {
    return Array.from(activeAuthorities.keys());
};

module.exports = {
    registerAuthority,
    registerReporter,
    unregisterAuthority,
    unregisterReporter,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
    relaySignal,
    getActiveAuthorities
}; 