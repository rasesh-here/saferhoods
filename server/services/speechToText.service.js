const extractInformation = (transcript) => {
    const info = {
        type: null,
        severity: null,
        location: {
            address: null,
            latitude: null,
            longitude: null
        },
        description: transcript
    };

    const typePatterns = [
        { regex: /fire/i, type: 'Fire' },
        { regex: /flood/i, type: 'Flood' },
        { regex: /medical|hurt|injured|ambulance/i, type: 'Medical' },
        { regex: /traffic accident|crash|collision|car accident|vehicle accident|hit and run/i, type: 'Traffic Accident' },
        { regex: /robbery|theft|steal|stolen|shoplifting|burglar/i, type: 'Theft/Robbery' },
        { regex: /assault|fight|attack|beat|punch|hit|physical|violence|violent|brawl/i, type: 'Assault/Fight' },
        { regex: /vandalism|damage|property damage|graffiti|smash|break|broken|destroy/i, type: 'Vandalism/Damage' },
        { regex: /suspicious|lurking|prowling|loitering|suspicious person|strange|odd behavior/i, type: 'Suspicious Activity' },
        { regex: /noise|loud|disturbance|party|music|shouting|yelling/i, type: 'Noise Complaint' },
        { regex: /storm|weather|lightning/i, type: 'Weather' },
        { regex: /infrastructure|power|outage|water/i, type: 'Infrastructure' }
    ];

    for (const pattern of typePatterns) {
        if (pattern.regex.test(transcript)) {
            info.type = pattern.type;
            break;
        }
    }

    if (!info.type) info.type = 'Other Emergency';

    if (/urgent|emergency|critical|serious|high/i.test(transcript)) {
        info.severity = 'High';
    } else if (/moderate|medium/i.test(transcript)) {
        info.severity = 'Medium';
    } else {
        info.severity = 'Low';
    }

    const addressMatch = transcript.match(/at\s+([^\.]+)/i) ||
        transcript.match(/on\s+([^\.]+)/i) ||
        transcript.match(/near\s+([^\.]+)/i);

    if (addressMatch && addressMatch[1]) {
        info.location.address = addressMatch[1].trim();
    }

    info.title = generateTitle(transcript, info.type);

    return info;
};

const generateTitle = (transcript, type) => {
    // Map of types to emojis and labels
    const typeToCrimeMap = {
        'Fire': { emoji: '🔥', label: 'Fire' },
        'Flood': { emoji: '💧', label: 'Flood' },
        'Medical': { emoji: '🚑', label: 'Medical' },
        'Accident': { emoji: '🚗', label: 'Traffic Accident' },
        'Security': { emoji: '🔒', label: 'Security' },
        'Weather': { emoji: '🌪️', label: 'Weather' },
        'Infrastructure': { emoji: '🏗️', label: 'Infrastructure' },
        'Other': { emoji: '🚨', label: 'Incident' },
        'Theft/Robbery': { emoji: '💰', label: 'Theft/Robbery' },
        'Assault/Fight': { emoji: '👊', label: 'Assault/Fight' },
        'Vandalism/Damage': { emoji: '🔨', label: 'Vandalism/Damage' },
        'Traffic Accident': { emoji: '🚗', label: 'Traffic Accident' },
        'Suspicious Activity': { emoji: '❓', label: 'Suspicious Activity' },
        'Noise Complaint': { emoji: '🔊', label: 'Noise Complaint' },
        'Other Emergency': { emoji: '🆘', label: 'Other Emergency' },
        'Default': { emoji: '🚨', label: 'Incident' }
    };

    // Get emoji and label for the type, or use default
    const typeInfo = typeToCrimeMap[type] || typeToCrimeMap['Default'];

    const words = transcript.split(' ');
    const titleWords = words.slice(0, Math.min(8, words.length));
    let title = titleWords.join(' ');

    if (title.length < 20) {
        title = `${typeInfo.emoji} ${typeInfo.label}: ${title}`;
    } else {
        title = `${typeInfo.emoji} ${title}`;
    }

    return title;
};


module.exports = {
    extractInformation
}; 