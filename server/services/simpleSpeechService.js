
const extractInformation = (transcript) => {
    console.log('\n=== EXTRACTING INFORMATION FROM TRANSCRIPT ===');

    if (!transcript) {
        console.log('WARNING: Empty or undefined transcript received');
        transcript = "No transcription available";
    }

    console.log(`Transcript: "${transcript}"`);

    // Initialize incident information structure
    const info = {
        type: null,
        severity: null,
        location: {
            address: null,
            latitude: null,
            longitude: null
        },
        description: transcript,
        title: null
    };

    // Extract incident type
    console.log('\n→ Extracting incident type...');
    const typePatterns = [
        { regex: /fire|burn|flame|smoke|burning/i, type: 'Fire' },
        { regex: /flood|water|drowning|submerged/i, type: 'Flood' },
        { regex: /medical|ambulance|heart|breathing|hurt|injured|bleeding|emergency|help|choking|stroke|attack|dying|sick|ill|hospital/i, type: 'Medical' },
        { regex: /traffic accident|crash|collision|car accident|vehicle accident|hit and run/i, type: 'Traffic Accident' },
        { regex: /robbery|theft|steal|stolen|shoplifting|burglar/i, type: 'Theft/Robbery' },
        { regex: /assault|fight|attack|beat|punch|hit|physical|violence|violent|brawl/i, type: 'Assault/Fight' },
        { regex: /vandalism|damage|property damage|graffiti|smash|break|broken|destroy/i, type: 'Vandalism/Damage' },
        { regex: /suspicious|lurking|prowling|loitering|suspicious person|strange|odd behavior/i, type: 'Suspicious Activity' },
        { regex: /noise|loud|disturbance|party|music|shouting|yelling/i, type: 'Noise Complaint' },
        { regex: /missing|lost|child|person|disappeared|abduction|kidnap/i, type: 'Missing Person' },
        { regex: /gas|leak|fume|carbon monoxide|electric|power|outage|explosion|utility/i, type: 'Infrastructure' }
    ];

    let matchedType = false;
    for (const pattern of typePatterns) {
        if (pattern.regex.test(transcript)) {
            info.type = pattern.type;
            console.log(`✓ Found type: ${pattern.type}`);
            matchedType = true;
            break;
        }
    }

    if (!matchedType) {
        if (/emergency|urgent|please help|need help|assistance|police|fire|ambulance|911|help|danger/i.test(transcript)) {
            info.type = 'Emergency';
            console.log('✓ Found general emergency');
        } else {
            info.type = 'Other';
            console.log('✓ No specific type found, defaulting to: Other');
        }
    }

    // Extract severity
    console.log('\n→ Extracting severity...');
    if (/emergency|urgent|immediately|quickly|now|life|death|dying|critical|serious|severe|bad|major|threatening|help me|help us|please help|need help/i.test(transcript)) {
        info.severity = 'High';
        console.log('✓ Found severity: High (emergency keywords)');
    }
    else if (/many|multiple|several|few|group|family|everyone|everybody|all|people|children/i.test(transcript)) {
        info.severity = 'High';
        console.log('✓ Found severity: High (multiple people affected)');
    }
    else if (/weapon|gun|knife|fire|burn|blood|bleeding|attack|trapped|armed|shooting/i.test(transcript)) {
        info.severity = 'High';
        console.log('✓ Found severity: High (dangerous situation)');
    }
    else if (/moderate|medium|some|hurt|minor|small|not serious|little/i.test(transcript)) {
        info.severity = 'Medium';
        console.log('✓ Found severity: Medium');
    }
    else {
        info.severity = 'High';
        console.log('✓ No clear severity found, defaulting to High for emergency call');
    }

    // Extract location
    console.log('\n→ Extracting location...');
    const addressMatch = transcript.match(/at\s+([^\.]+)/i) ||
        transcript.match(/on\s+([^\.]+)/i) ||
        transcript.match(/near\s+([^\.]+)/i) ||
        transcript.match(/address is\s+([^\.]+)/i) ||
        transcript.match(/location is\s+([^\.]+)/i) ||
        transcript.match(/happening (?:at|on|in)\s+([^\.]+)/i) ||
        transcript.match(/happened (?:at|on|in)\s+([^\.]+)/i) ||
        transcript.match(/(\d+\s+[A-Za-z]+\s+(?:street|road|avenue|lane|drive|place|blvd|st|rd|ave|ln|dr|pl))/i);

    if (addressMatch && addressMatch[1]) {
        info.location.address = addressMatch[1].trim();
        console.log(`✓ Found location: "${info.location.address}"`);
    } else {
        console.log('✗ No specific location found in transcript');
        info.location.address = "Location not specified in emergency call";
    }

    // Generate title
    console.log('\n→ Generating title...');

    // Map of types to emojis and labels
    const typeToCrimeMap = {
        'Fire': { emoji: '🔥', label: 'Fire' },
        'Flood': { emoji: '💧', label: 'Flood' },
        'Medical': { emoji: '🚑', label: 'Medical' },
        'Traffic Accident': { emoji: '🚗', label: 'Traffic Accident' },
        'Theft/Robbery': { emoji: '💰', label: 'Theft/Robbery' },
        'Assault/Fight': { emoji: '👊', label: 'Assault/Fight' },
        'Vandalism/Damage': { emoji: '🔨', label: 'Vandalism/Damage' },
        'Suspicious Activity': { emoji: '❓', label: 'Suspicious Activity' },
        'Noise Complaint': { emoji: '🔊', label: 'Noise Complaint' },
        'Missing Person': { emoji: '🔍', label: 'Missing Person' },
        'Infrastructure': { emoji: '🏗️', label: 'Infrastructure' },
        'Emergency': { emoji: '🆘', label: 'Emergency' },
        'Other': { emoji: '🚨', label: 'Incident' },
        'Default': { emoji: '🚨', label: 'Incident' }
    };

    // Get emoji and label for the type, or use default
    const typeInfo = typeToCrimeMap[info.type] || typeToCrimeMap['Default'];

    let titlePrefix = `${typeInfo.emoji} ${typeInfo.label} Emergency`;

    if (info.location.address && info.location.address !== "Location not specified in emergency call") {
        let shortAddress = info.location.address.split(' ').slice(0, 4).join(' ');
        titlePrefix += ` at ${shortAddress}`;
    }

    if (transcript.length < 50) {
        info.title = `${titlePrefix}: ${transcript}`;
    } else {
        const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 0);
        if (sentences.length > 0) {
            let firstSentence = sentences[0].trim();
            if (firstSentence.length > 60) {
                firstSentence = firstSentence.substring(0, 57) + '...';
            }
            info.title = `${titlePrefix}: ${firstSentence}`;
        } else {
            info.title = `${titlePrefix}: ${transcript.substring(0, 50)}...`;
        }
    }

    console.log(`✓ Generated title: "${info.title}"`);

    // Log extraction summary
    console.log('\n=== EXTRACTION SUMMARY ===');
    console.log(`• Type: ${info.type}`);
    console.log(`• Severity: ${info.severity}`);
    console.log(`• Location: ${info.location.address}`);
    console.log(`• Title: ${info.title}`);

    return info;
};

/**
 * Process transcription text to create incident information
 * @param {string} transcriptionText - The transcribed text
 * @param {string} callSid - The Twilio call SID
 * @param {string} callerNumber - The caller's phone number
 * @returns {object} - The incident information object with success flag
 */
const processTranscription = (transcriptionText, callSid, callerNumber) => {
    try {
        // Extract incident information from the transcription
        const incidentInfo = extractInformation(transcriptionText);

        // Enhance the description with call metadata
        const enhancedDescription = `${incidentInfo.description}\n\nReceived from: ${callerNumber}\nCall ID: ${callSid}`;
        incidentInfo.description = enhancedDescription;

        return {
            success: true,
            incident: incidentInfo
        };
    } catch (error) {
        console.error('Error processing transcription:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

module.exports = {
    extractInformation,
    processTranscription
}; 