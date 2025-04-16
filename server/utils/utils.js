const sendError = (res, message, error = null, statusCode = 400) => {
    return res.status(statusCode).json({
        success: false,
        message,
        error
    });
};

const sendSuccess = (res, data = {}, statusCode = 200) => {
    return res.status(statusCode).json({
        success: true,
        ...data
    });
}

const validateAndProcessLocation = (locationData) => {
    let location;

    try {
        location = typeof locationData === 'string'
            ? JSON.parse(locationData)
            : locationData;

        if (!location || typeof location !== 'object') {
            return {
                latitude: 0,
                longitude: 0,
                address: 'Unknown location',
                isValid: false
            };
        }

        const normalizedLocation = { ...location };

        if (normalizedLocation.lat !== undefined && normalizedLocation.latitude === undefined) {
            normalizedLocation.latitude = normalizedLocation.lat;
        }

        if (normalizedLocation.lng !== undefined && normalizedLocation.longitude === undefined) {
            normalizedLocation.longitude = normalizedLocation.lng;
        }

        if (normalizedLocation.latitude !== undefined && normalizedLocation.lat === undefined) {
            normalizedLocation.lat = normalizedLocation.latitude;
        }

        if (normalizedLocation.longitude !== undefined && normalizedLocation.lng === undefined) {
            normalizedLocation.lng = normalizedLocation.longitude;
        }

        if (!normalizedLocation.address) {
            normalizedLocation.address = 'Address not provided';
        }

        const isValid = normalizedLocation.latitude !== undefined &&
            normalizedLocation.longitude !== undefined &&
            normalizedLocation.latitude !== null &&
            normalizedLocation.longitude !== null;

        return {
            ...normalizedLocation,
            isValid
        };
    } catch (error) {
        return {
            latitude: 0,
            longitude: 0,
            address: 'Unknown location',
            isValid: false,
            error: error.message
        };
    }
};


const calculateDistance = (point1, point2) => {
    const lat1 = parseFloat(point1.latitude) * Math.PI / 180;
    const lon1 = parseFloat(point1.longitude) * Math.PI / 180;
    const lat2 = parseFloat(point2.latitude) * Math.PI / 180;
    const lon2 = parseFloat(point2.longitude) * Math.PI / 180;

    const dLat = lat2 - lat1;
    const dLon = lon2 - lon1;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1) * Math.cos(lat2) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const R = 6371000;
    return R * c;
};

module.exports = {
    sendSuccess,
    sendError,
    validateAndProcessLocation,
    calculateDistance
}