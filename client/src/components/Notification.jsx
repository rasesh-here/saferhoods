import React, { useEffect, useState } from 'react';
import {
    CheckCircleIcon,
    ExclamationCircleIcon,
    ExclamationTriangleIcon,
    InformationCircleIcon,
    XMarkIcon
} from '@heroicons/react/24/solid';

export function Notification({ message, type = 'info', onDismiss, autoDismissTime = 5000 }) {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        if (autoDismissTime) {
            const timer = setTimeout(() => {
                setIsVisible(false);
                setTimeout(() => {
                    onDismiss && onDismiss();
                }, 300); // Allow time for exit animation
            }, autoDismissTime);
            return () => clearTimeout(timer);
        }
    }, [autoDismissTime, onDismiss]);

    const handleDismiss = () => {
        setIsVisible(false);
        setTimeout(() => {
            onDismiss && onDismiss();
        }, 300); // Allow time for exit animation
    };

    // Alert styling configuration
    const alertConfig = {
        success: {
            bgColor: 'bg-green-50',
            textColor: 'text-green-800',
            borderColor: 'border-green-200',
            icon: <CheckCircleIcon className="h-5 w-5 text-green-500" aria-hidden="true" />,
            ringColor: 'ring-green-500/20'
        },
        error: {
            bgColor: 'bg-red-50',
            textColor: 'text-red-800',
            borderColor: 'border-red-200',
            icon: <ExclamationCircleIcon className="h-5 w-5 text-red-500" aria-hidden="true" />,
            ringColor: 'ring-red-500/20'
        },
        warning: {
            bgColor: 'bg-yellow-50',
            textColor: 'text-yellow-800',
            borderColor: 'border-yellow-200',
            icon: <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" aria-hidden="true" />,
            ringColor: 'ring-yellow-500/20'
        },
        info: {
            bgColor: 'bg-blue-50',
            textColor: 'text-blue-800',
            borderColor: 'border-blue-200',
            icon: <InformationCircleIcon className="h-5 w-5 text-blue-500" aria-hidden="true" />,
            ringColor: 'ring-blue-500/20'
        }
    };

    const config = alertConfig[type] || alertConfig.info;

    return (
        <div
            className={`fixed top-4 transform transition-all duration-300 ease-in-out z-[1100] max-w-[calc(100vw-2rem)] w-full sm:w-auto sm:max-w-md
        ${isVisible ? 'translate-y-0 opacity-100' : '-translate-y-8 opacity-0'}
        left-1/2 -translate-x-1/2`}
        >
            <div className={`rounded-lg shadow-lg ring-1 ${config.ringColor} border ${config.borderColor} overflow-hidden`}>
                <div className={`${config.bgColor} p-3 sm:p-4`}>
                    <div className="flex items-start space-x-3 sm:space-x-4">
                        <div className="flex-shrink-0">
                            {config.icon}
                        </div>
                        <div className="flex-1 pt-0.5 min-w-0">
                            <p className={`text-sm sm:text-base font-medium ${config.textColor}`}>
                                {message}
                            </p>
                        </div>
                        <div className="flex-shrink-0">
                            <button
                                type="button"
                                className={`inline-flex rounded-md p-1.5 ${config.textColor} hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                                onClick={handleDismiss}
                            >
                                <span className="sr-only">Dismiss</span>
                                <XMarkIcon className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Notification; 