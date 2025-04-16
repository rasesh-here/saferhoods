import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext();

const SOCKET_URL = 'http://localhost:4000';

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const [connected, setConnected] = useState(false);
    const [userType, setUserType] = useState(null);
    const [userId, setUserId] = useState(null);
    const [currentCallId, setCurrentCallId] = useState(null);
    const [callStatus, setCallStatus] = useState('idle');
    const [messages, setMessages] = useState([]);
    const [error, setError] = useState(null);

    const [communicationMode, setCommunicationMode] = useState('text');
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [isMuted, setIsMuted] = useState(false);

    const peerConnection = useRef(null);
    const localStreamRef = useRef(null);

    useEffect(() => {
        const socketInstance = io(SOCKET_URL);

        socketInstance.on('connect', () => {
            setConnected(true);
            setError(null);
        });

        socketInstance.on('disconnect', () => {
            setConnected(false);
            setCallStatus('idle');
            stopVoiceCall();
        });

        socketInstance.on('error', ({ message }) => {
            console.error('Socket error:', message);
            setError(message);
        });

        setSocket(socketInstance);

        return () => {
            if (socketInstance) socketInstance.disconnect();
            stopVoiceCall();
        };
    }, []);

    const setupPeerConnection = useCallback(() => {
        if (peerConnection.current) {
            peerConnection.current.close();
        }

        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
            ]
        });

        pc.onicecandidate = (event) => {
            if (event.candidate && socket && currentCallId) {
                socket.emit('signal', {
                    callId: currentCallId,
                    signal: {
                        type: 'ice-candidate',
                        candidate: event.candidate
                    }
                });
            }
        };

        pc.ontrack = (event) => {
            setRemoteStream(event.streams[0]);
        };

        peerConnection.current = pc;
        return pc;
    }, [socket, currentCallId]);

    const startVoiceCall = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            localStreamRef.current = stream;
            setLocalStream(stream);

            const pc = setupPeerConnection();

            stream.getTracks().forEach(track => {
                pc.addTrack(track, stream);
            });

            setCommunicationMode('voice');
            return true;
        } catch (err) {
            console.error('Error accessing microphone:', err);
            setError('Could not access microphone. Please check permissions.');
            return false;
        }
    }, [setupPeerConnection]);

    const stopVoiceCall = useCallback(() => {
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
            setLocalStream(null);
        }

        if (peerConnection.current) {
            peerConnection.current.close();
            peerConnection.current = null;
        }

        setRemoteStream(null);
        setCommunicationMode('text');
    }, []);

    const toggleMute = useCallback(() => {
        if (localStreamRef.current) {
            const audioTracks = localStreamRef.current.getAudioTracks();
            if (audioTracks.length > 0) {
                const enabled = !audioTracks[0].enabled;
                audioTracks[0].enabled = enabled;
                setIsMuted(!enabled);
            }
        }
    }, []);

    const createOffer = useCallback(async () => {
        if (!peerConnection.current || !socket || !currentCallId) return;

        try {
            const offer = await peerConnection.current.createOffer();
            await peerConnection.current.setLocalDescription(offer);

            socket.emit('signal', {
                callId: currentCallId,
                signal: {
                    type: 'offer',
                    sdp: peerConnection.current.localDescription
                }
            });
        } catch (err) {
            console.error('Error creating offer:', err);
            setError('Failed to create call offer.');
        }
    }, [socket, currentCallId]);

    const createAnswer = useCallback(async () => {
        if (!peerConnection.current || !socket || !currentCallId) return;

        try {
            const answer = await peerConnection.current.createAnswer();
            await peerConnection.current.setLocalDescription(answer);

            socket.emit('signal', {
                callId: currentCallId,
                signal: {
                    type: 'answer',
                    sdp: peerConnection.current.localDescription
                }
            });
        } catch (err) {
            console.error('Error creating answer:', err);
            setError('Failed to answer call.');
        }
    }, [socket, currentCallId]);

    const registerAsReporter = useCallback(() => {
        if (socket && connected) {
            socket.emit('register-reporter');
            setUserType('reporter');

            socket.on('reporter-registered', ({ reporterId }) => {
                setUserId(reporterId);
            });
        }
    }, [socket, connected]);

    const registerAsAuthority = useCallback((authorityId) => {
        if (socket && connected) {
            socket.emit('register-authority', authorityId);
            setUserType('authority');
            setUserId(authorityId);
        }
    }, [socket, connected]);

    const initiateCall = useCallback(async (mode = 'text') => {
        if (socket && connected && userType === 'reporter') {
            if (mode === 'voice') {
                const success = await startVoiceCall();
                if (!success) return;
            }

            socket.emit('initiate-call', { mode });
            setCallStatus('calling');
            setCommunicationMode(mode);

            setMessages([]);
        }
    }, [socket, connected, userType, startVoiceCall]);

    const acceptCall = useCallback(async (callId, mode = 'text') => {
        if (socket && connected && userType === 'authority') {
            if (mode === 'voice') {
                const success = await startVoiceCall();
                if (!success) return;
            }

            socket.emit('accept-call', { callId, mode });
            setCommunicationMode(mode);
        }
    }, [socket, connected, userType, startVoiceCall]);

    const rejectCall = useCallback((callId) => {
        if (socket && connected && userType === 'authority') {
            socket.emit('reject-call', { callId });
            setCallStatus('idle');
            setCurrentCallId(null);
        }
    }, [socket, connected, userType]);

    const endCall = useCallback(() => {
        if (socket && connected && currentCallId) {
            socket.emit('end-call', { callId: currentCallId });
            setCallStatus('ended');
            setCurrentCallId(null);
            setMessages([]);
            stopVoiceCall();
        }
    }, [socket, connected, currentCallId, stopVoiceCall]);

    const sendMessage = useCallback((message) => {
        if (socket && connected && currentCallId && callStatus === 'active' && message.trim() !== '') {
            socket.emit('signal', {
                callId: currentCallId,
                signal: { type: 'message', data: message }
            });

            setMessages(prev => [
                ...prev,
                { sender: 'self', text: message, timestamp: new Date() }
            ]);
        }
    }, [socket, connected, currentCallId, callStatus]);

    useEffect(() => {
        if (!socket) return;

        const handleCallInitiated = ({ callId, mode = 'text' }) => {
            setCurrentCallId(callId);
            setCallStatus('calling');
            setCommunicationMode(mode);

            if (mode === 'voice' && peerConnection.current) {
                createOffer();
            }
        };

        const handleIncomingCall = ({ callId, mode = 'text' }) => {
            setCurrentCallId(callId);
            setCallStatus('incoming');
            setCommunicationMode(mode);
        };

        const handleCallAccepted = ({ mode = 'text' }) => {
            setCallStatus('active');
            setCommunicationMode(mode);

            if (mode === 'voice' && userType === 'reporter' && peerConnection.current) {
                createOffer();
            }
        };

        const handleCallConnected = ({ mode = 'text' }) => {
            setCallStatus('active');
            setCommunicationMode(mode);
        };

        const handleCallRejected = () => {
            setCallStatus('idle');
            setCurrentCallId(null);
            stopVoiceCall();
        };

        const handleCallEnded = () => {
            setCallStatus('idle');
            setCurrentCallId(null);
            setMessages([]);
            stopVoiceCall();
        };

        const handleSignal = async ({ signal }) => {
            if (signal && signal.type === 'message' && signal.data) {
                setMessages(prev => [
                    ...prev,
                    { sender: 'other', text: signal.data, timestamp: new Date() }
                ]);
            }

            if (signal && communicationMode === 'voice') {
                if (signal.type === 'offer' && peerConnection.current) {
                    await peerConnection.current.setRemoteDescription(new RTCSessionDescription(signal.sdp));
                    await createAnswer();
                }

                else if (signal.type === 'answer' && peerConnection.current) {
                    await peerConnection.current.setRemoteDescription(new RTCSessionDescription(signal.sdp));
                }

                else if (signal.type === 'ice-candidate' && peerConnection.current) {
                    try {
                        await peerConnection.current.addIceCandidate(new RTCIceCandidate(signal.candidate));
                    } catch (err) {
                        console.error('Error adding received ICE candidate', err);
                    }
                }
            }
        };

        socket.on('call-initiated', handleCallInitiated);
        socket.on('incoming-call', handleIncomingCall);
        socket.on('call-accepted', handleCallAccepted);
        socket.on('call-connected', handleCallConnected);
        socket.on('call-rejected', handleCallRejected);
        socket.on('call-ended', handleCallEnded);
        socket.on('signal', handleSignal);

        // Cleanup
        return () => {
            socket.off('call-initiated', handleCallInitiated);
            socket.off('incoming-call', handleIncomingCall);
            socket.off('call-accepted', handleCallAccepted);
            socket.off('call-connected', handleCallConnected);
            socket.off('call-rejected', handleCallRejected);
            socket.off('call-ended', handleCallEnded);
            socket.off('signal', handleSignal);
        };
    }, [socket, userType, communicationMode, createOffer, createAnswer, stopVoiceCall]);

    const value = {
        connected,
        userType,
        userId,
        currentCallId,
        callStatus,
        messages,
        error,
        communicationMode,
        localStream,
        remoteStream,
        isMuted,
        registerAsReporter,
        registerAsAuthority,
        initiateCall,
        acceptCall,
        rejectCall,
        endCall,
        sendMessage,
        toggleMute,
        setCommunicationMode
    };

    return (
        <SocketContext.Provider value={value}>
            {children}
        </SocketContext.Provider>
    );
};

// Custom hook to use the context
export const useSocket = () => {
    const context = useContext(SocketContext);
    if (!context) {
        throw new Error('useSocket must be used within a SocketProvider');
    }
    return context;
};

export default SocketContext; 