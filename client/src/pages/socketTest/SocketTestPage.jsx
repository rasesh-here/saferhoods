import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Title } from '../../utils';

const SocketTestPage = () => {
    return (
        <div className="h-full flex items-center justify-center">
            <Title title="Socket Communication Test" />
            <div className="max-w-md w-full bg-white rounded-lg shadow-md overflow-hidden">
                <div className="px-6 py-8">
                    <h2 className="text-2xl font-bold text-center text-gray-800 mb-8">
                        Socket Communication Test
                    </h2>
                    <p className="text-gray-600 text-center mb-8">
                        Select a role to test the anonymous communication feature
                    </p>

                    <div className="space-y-4">
                        <Link
                            to="/socket-test/reporter"
                            className="block w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md text-center transition duration-150 ease-in-out"
                        >
                            Join as Reporter (Anonymous)
                        </Link>

                        <Link
                            to="/socket-test/authority"
                            className="block w-full py-3 px-4 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-md text-center transition duration-150 ease-in-out"
                        >
                            Join as Authority
                        </Link>
                    </div>

                    <div className="mt-8 pt-6 border-t border-gray-200">
                        <p className="text-sm text-gray-500 text-center">
                            Open this page in two different windows to test the communication between
                            reporter and authority.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SocketTestPage; 