import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useSocket } from './SocketContext';
import { FaPhone, FaMicrophone, FaMicrophoneSlash } from 'react-icons/fa';
import { BsChatSquareText } from 'react-icons/bs';
import { Title } from '../../utils';

const ReporterView = () => {
    const {
        connected,
        userId,
        callStatus,
        messages,
        error,
        communicationMode,
        localStream,
        remoteStream,
        isMuted,
        registerAsReporter,
        initiateCall,
        endCall,
        sendMessage,
        toggleMute
    } = useSocket();

    const [messageText, setMessageText] = useState('');
    const messagesEndRef = useRef(null);
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);

    useEffect(() => {
        if (connected) {
            registerAsReporter();
        }
    }, [connected, registerAsReporter]);

    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }
        if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [localStream, remoteStream]);

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (messageText.trim()) {
            sendMessage(messageText);
            setMessageText('');
        }
    };

    const handleStartCall = (mode) => {
        initiateCall(mode);
    };

    if (!connected) {
        return (
            <div className="h-full flex items-center justify-center p-4">
                <Title title="Reporter View - Connecting" />
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                    <p className="text-lg">Connecting to server...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col p-4">
            <Title title="Anonymous Reporter Chat" />
            <div className="mb-4 flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-semibold">Anonymous Reporter</h1>
                    {userId && <p className="text-sm text-gray-500">ID: {userId}</p>}
                </div>
                <Link
                    to="/socket-test"
                    className="text-sm text-indigo-600 hover:text-indigo-800"
                >
                    Back to Selection
                </Link>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
                    Error: {error}
                </div>
            )}

            <div className="mb-4">
                {callStatus === 'idle' && (
                    <div className="flex gap-3">
                        <button
                            onClick={() => handleStartCall('text')}
                            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                        >
                            <BsChatSquareText className="h-4 w-4 mr-2" />
                            Text Call
                        </button>
                        <button
                            onClick={() => handleStartCall('voice')}
                            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                        >
                            <FaPhone className="h-4 w-4 mr-2" />
                            Voice Call
                        </button>
                    </div>
                )}

                {callStatus === 'calling' && (
                    <div className="flex items-center">
                        <div className="animate-pulse mr-3 h-3 w-3 bg-yellow-500 rounded-full"></div>
                        <p>Waiting for authority to accept your {communicationMode} call...</p>
                        <button
                            onClick={endCall}
                            className="ml-auto px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700"
                        >
                            Cancel
                        </button>
                    </div>
                )}

                {callStatus === 'active' && (
                    <div className="flex items-center">
                        <div className="mr-3 h-3 w-3 bg-green-500 rounded-full"></div>
                        <p>Connected to Authority ({communicationMode} mode)</p>
                        <div className="ml-auto flex gap-2">
                            {communicationMode === 'voice' && (
                                <button
                                    onClick={toggleMute}
                                    className={`p-2 rounded-full ${isMuted ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}
                                    title={isMuted ? 'Unmute' : 'Mute'}
                                >
                                    {isMuted ? (
                                        <FaMicrophoneSlash className="h-5 w-5" />
                                    ) : (
                                        <FaMicrophone className="h-5 w-5" />
                                    )}
                                </button>
                            )}
                            <button
                                onClick={endCall}
                                className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700"
                            >
                                End Call
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {callStatus === 'active' && communicationMode === 'voice' && (
                <div className="mb-4">
                    <div className="bg-gray-800 rounded-lg p-4 flex flex-col items-center">
                        <h3 className="text-white mb-2">Voice Call</h3>
                        <p className="text-gray-300 text-sm mb-4">Call in progress</p>

                        <audio ref={localVideoRef} muted autoPlay playsInline className="hidden" />
                        <audio ref={remoteVideoRef} autoPlay playsInline className="hidden" />

                        <div className="w-20 h-20 rounded-full bg-indigo-600 flex items-center justify-center mb-2">
                            <FaPhone className="h-10 w-10 text-white" />
                        </div>
                    </div>
                </div>
            )}

            {callStatus === 'active' && (communicationMode === 'text' || true) && (
                <div className="flex-1 flex flex-col">
                    <div className="flex-1 bg-gray-50 rounded-md p-4 mb-4 overflow-y-auto">
                        {messages.length === 0 ? (
                            <p className="text-gray-500 text-center my-4">No messages yet. Start the conversation!</p>
                        ) : (
                            <div className="space-y-3">
                                {messages.map((msg, index) => (
                                    <div
                                        key={index}
                                        className={`flex ${msg.sender === 'self' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div
                                            className={`max-w-[70%] p-3 rounded-lg ${msg.sender === 'self'
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-gray-200 text-gray-800'
                                                }`}
                                        >
                                            {msg.text}
                                        </div>
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>
                        )}
                    </div>

                    <form onSubmit={handleSendMessage} className="flex gap-2">
                        <input
                            type="text"
                            value={messageText}
                            onChange={(e) => setMessageText(e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="Type your message..."
                            disabled={callStatus !== 'active'}
                        />
                        <button
                            type="submit"
                            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-indigo-300"
                            disabled={callStatus !== 'active' || !messageText.trim()}
                        >
                            Send
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
};

export default ReporterView; 