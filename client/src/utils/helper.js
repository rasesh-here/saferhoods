import {
    QueueListIcon,
    CheckCircleIcon,
    PaperAirplaneIcon,
    ShieldCheckIcon,
    XMarkIcon,
    InformationCircleIcon,
    UserCircleIcon
} from '@heroicons/react/20/solid';

export const formatTimeAgo = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
        const now = new Date();
        const past = new Date(timestamp);
        const diffInSeconds = Math.floor((now - past) / 1000);

        if (isNaN(diffInSeconds) || diffInSeconds < 0) {
            return past.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
        }


        const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

        if (diffInSeconds < 60) return rtf.format(-diffInSeconds, 'second');
        const diffInMinutes = Math.floor(diffInSeconds / 60);
        if (diffInMinutes < 60) return rtf.format(-diffInMinutes, 'minute');
        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) return rtf.format(-diffInHours, 'hour');
        const diffInDays = Math.floor(diffInHours / 24);
        if (diffInDays < 7) return rtf.format(-diffInDays, 'day');

        return past.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch (error) {
        console.error("Error formatting time ago:", error, "Timestamp:", timestamp);
        return 'Invalid Date';
    }
};

export const getSeverityDotClasses = (severity) => {
    switch (severity) {
        case 'High': return 'bg-red-500';
        case 'Medium': return 'bg-yellow-500';
        case 'Low': return 'bg-blue-500';
        default: return 'bg-gray-400';
    }
};

export const getStatusStyle = (status) => {
    switch (status) {
        case 'New': return { textColor: 'text-red-700', icon: QueueListIcon, bgColor: 'bg-red-50' };
        case 'Acknowledged': return { textColor: 'text-yellow-700', icon: CheckCircleIcon, bgColor: 'bg-yellow-50' };
        case 'Assigned': return { textColor: 'text-purple-700', icon: UserCircleIcon, bgColor: 'bg-purple-50' };
        case 'Responding': return { textColor: 'text-blue-700', icon: PaperAirplaneIcon, bgColor: 'bg-blue-50' };
        case 'Resolved': return { textColor: 'text-green-700', icon: ShieldCheckIcon, bgColor: 'bg-green-50' };
        case 'Declined': return { textColor: 'text-orange-700', icon: XMarkIcon, bgColor: 'bg-orange-50' };
        default: return { textColor: 'text-gray-700', icon: InformationCircleIcon, bgColor: 'bg-gray-50' };
    }
};

// Helper to safely get nested properties (like address)
export const getSafe = (fn, defaultValue = '') => {
    try {
        return fn() ?? defaultValue;
    } catch (e) {
        return defaultValue;
    }
};

export const detectBrave = async () => {
    // First check navigator.brave which is available in newer versions
    if (navigator.brave && await navigator.brave.isBrave()) {
        return true;
    }

    // For older versions, use a feature detection approach
    try {
        // Brave blocks some navigator properties that other browsers have
        const navigatorProperties = [
            'plugins', 'mimeTypes', 'webdriver',
            'languages', 'hardwareConcurrency', 'deviceMemory'
        ];

        // Brave usually blocks these navigator properties, or modifies them
        let missingProps = 0;
        for (const prop of navigatorProperties) {
            if (navigator[prop] === undefined ||
                (prop === 'plugins' && navigator.plugins.length === 0) ||
                (prop === 'languages' && navigator.languages.length === 0)) {
                missingProps++;
            }
        }

        // Check for window.chrome presence (common in Chromium browsers)
        const hasChrome = Boolean(window.chrome);

        // Additional check for specific Brave behavior with WebRTC
        const mediaDevices = navigator.mediaDevices || {};
        const hasEnumerateDevices = Boolean(mediaDevices.enumerateDevices);

        // If multiple indicators point to Brave, return true
        return missingProps >= 3 && hasChrome && hasEnumerateDevices;
    } catch (error) {
        console.error("Error detecting browser:", error);
        return false;
    }
}; 