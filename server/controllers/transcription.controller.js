const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const { processIncident } = require('../services/incidentProcessing.service');
const supabase = require('../config/supabase');
const config = require('../config/env');
const { sendSuccess, sendError } = require('../utils/utils');

/**
 * Extract incident data from transcribed text
 * @param {string} text - Transcribed text to analyze
 * @returns {object} - Extracted incident data or error information
 */
const extractIncidentData = (text) => {
    // Convert text to lowercase for case-insensitive matching
    const lowerText = text.toLowerCase();

    // Extract incident type
    let type = null;
    const typeRegex = /(?:incident|emergency|situation|report|reporting) (?:type|is|of) (?:a |an )?(fire|medical|accident|flood|security|infrastructure|gas leak|power outage|assault|theft|vandalism|disturbance)/i;
    const typeMatch = text.match(typeRegex);

    if (typeMatch) {
        type = typeMatch[1].charAt(0).toUpperCase() + typeMatch[1].slice(1); // Capitalize first letter
    } else {
        // Try to find keywords for incident types
        const typeKeywords = {
            'Fire': /\b(?:fire|burning|smoke|flames)\b/i,
            'Medical': /\b(?:medical|ambulance|injured|hurt|bleeding|unconscious|sick|ill|heart attack|stroke)\b/i,
            'Traffic Accident': /\b(?:traffic accident|crash|collision|car accident|vehicle accident|hit and run)\b/i,
            'Theft/Robbery': /\b(?:robbery|theft|steal|stolen|shoplifting|burglar)\b/i,
            'Assault/Fight': /\b(?:assault|fight|attack|beat|punch|hit|physical|violence|violent|brawl)\b/i,
            'Vandalism/Damage': /\b(?:vandalism|damage|property damage|graffiti|smash|break|broken|destroy)\b/i,
            'Suspicious Activity': /\b(?:suspicious|lurking|prowling|loitering|suspicious person|strange|odd behavior)\b/i,
            'Noise Complaint': /\b(?:noise|loud|disturbance|party|music|shouting|yelling)\b/i,
            'Flood': /\b(?:flood|water|drowning|submerged)\b/i,
            'Infrastructure': /\b(?:collapse|building|structure|road|bridge|construction|power outage|gas leak)\b/i
        };

        for (const [potentialType, regex] of Object.entries(typeKeywords)) {
            if (regex.test(lowerText)) {
                type = potentialType;
                break;
            }
        }
    }

    // If no type was found, default to "Other"
    if (!type) {
        type = "Other";
    }

    // Extract location
    let location = null;
    const addressRegex = /(?:at|on|in|near|location is|address is) ([\w\s\.,-]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|way|place|pl|court|ct|circle|cir|highway|hwy|route|rt)[\w\s\.,-]*)/i;
    const addressMatch = text.match(addressRegex);

    if (addressMatch) {
        location = {
            address: addressMatch[1].trim(),
            latitude: 0, // Default values
            longitude: 0
        };
    } else {
        // Check for simple location mentions
        const simpleLocationRegex = /(?:at|on|in|near|location is|address is) ([\w\s\.,-]+)/i;
        const simpleMatch = text.match(simpleLocationRegex);

        if (simpleMatch) {
            location = {
                address: simpleMatch[1].trim(),
                latitude: 0,
                longitude: 0
            };
        }
    }

    // Extract severity
    let severity = 'Medium'; // Default medium severity
    if (/\b(?:severe|serious|critical|life-threatening|major|high priority|urgent|emergency)\b/i.test(lowerText)) {
        severity = 'High';
    } else if (/\b(?:minor|small|minimal|low priority|not urgent|not serious)\b/i.test(lowerText)) {
        severity = 'Low';
    }

    // Extract description - take the whole text as description if available
    const description = text.trim();

    // Generate a title based on type and location
    // Map of types to emojis and labels
    const typeToCrimeMap = {
        'Fire': { emoji: '🔥', label: 'Fire' },
        'Flood': { emoji: '💧', label: 'Flood' },
        'Medical': { emoji: '🚑', label: 'Medical' },
        'Accident': { emoji: '🚗', label: 'Traffic Accident' },
        'Infrastructure': { emoji: '🏗️', label: 'Infrastructure' },
        'Emergency': { emoji: '🆘', label: 'Emergency' },
        'Other': { emoji: '🚨', label: 'Incident' },
        'Theft/Robbery': { emoji: '💰', label: 'Theft/Robbery' },
        'Assault/Fight': { emoji: '👊', label: 'Assault/Fight' },
        'Vandalism/Damage': { emoji: '🔨', label: 'Vandalism/Damage' },
        'Traffic Accident': { emoji: '🚗', label: 'Traffic Accident' },
        'Suspicious Activity': { emoji: '❓', label: 'Suspicious Activity' },
        'Noise Complaint': { emoji: '🔊', label: 'Noise Complaint' },
        'Other Emergency': { emoji: '🆘', label: 'Other Emergency' },
        'Security': { emoji: '🔒', label: 'Security' },
        'Default': { emoji: '🚨', label: 'Incident' }
    };

    // Get emoji and label for the type, or use default
    const typeInfo = typeToCrimeMap[type] || typeToCrimeMap['Default'];

    let title = `${typeInfo.emoji} ${typeInfo.label}`;
    if (location && location.address) {
        title += ` at ${location.address}`;
    }

    // Check if we have the minimum required information
    if (!type || !description || !location) {
        return {
            success: false,
            missingFields: {
                type: !type,
                description: !description,
                location: !location
            },
            message: "Could not extract all required incident information from transcription"
        };
    }

    return {
        success: true,
        incidentData: {
            type,
            severity,
            location,
            description,
            title,
        }
    };
};

/**
 * Process audio recording to create an incident
 * This endpoint receives an audio file, sends it to the transcription service,
 * extracts incident data from the transcription, and creates an incident
 */
const processAudioRecording = async (req, res) => {
    try {
        // Verify audio file was uploaded
        if (!req.file) {
            return sendError(res, 'No audio file provided', null, 400);
        }

        // Verify transcription server URL is configured
        if (!config.transcriptionServerUrl) {
            return sendError(res, 'Server configuration error: Transcription service not available', null, 500);
        }

        // Create form data for transcription service
        const formData = new FormData();
        formData.append('audio', fs.createReadStream(req.file.path));

        // Send to transcription service
        try {
            const transcriptionResponse = await axios.post(
                `${config.transcriptionServerUrl}/transcribe`,
                formData,
                {
                    headers: {
                        ...formData.getHeaders()
                    },
                    timeout: 30000 // 30 second timeout
                }
            );

            // Clean up the temporary file
            fs.unlink(req.file.path, (err) => {
                // Error deleting temporary file - no need to log
            });

            // Validate transcription response
            if (!transcriptionResponse.data || !transcriptionResponse.data.transcript || !transcriptionResponse.data.transcript.text) {
                return sendError(res, 'Transcription service failed to return valid text', null, 500);
            }

            const transcribedText = transcriptionResponse.data.transcript.text;

            // Extract incident data from transcription
            const extractionResult = extractIncidentData(transcribedText);

            if (!extractionResult.success) {
                return sendError(res, 'Could not extract required incident information from transcription', {
                    transcribedText,
                    missingFields: extractionResult.missingFields
                }, 400);
            }

            // Get user ID for the report (using first available user as fallback)
            let reportedBy = null;

            // If authenticated, use authenticated user
            if (req.user && req.user.id) {
                reportedBy = req.user.id;
            } else {
                // Get first user from database as fallback
                const { data: users, error } = await supabase
                    .from('users')
                    .select('id')
                    .limit(1);

                if (error || !users || users.length === 0) {
                    return sendError(res, 'Failed to find a valid user for the incident report', {
                        transcribedText
                    }, 500);
                }

                reportedBy = users[0].id;
            }

            // Prepare incident data for creation
            const incidentData = {
                ...extractionResult.incidentData,
                reported_by: reportedBy,
                status: 'Open',
                reported_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                verified: 'Pending',
                assigned_teams: JSON.stringify([])
            };

            // Ensure location is properly formatted for storage
            incidentData.location = JSON.stringify(incidentData.location);

            // Insert into database
            const { data: insertedIncident, error: insertError } = await supabase
                .from('incidents')
                .insert(incidentData)
                .select()
                .single();

            if (insertError) {
                console.error('Database error during incident creation:', insertError);
                return sendError(res, 'Server error while creating incident', {
                    transcribedText
                }, 500);
            }

            // Process the incident asynchronously
            processIncident(insertedIncident).catch(error => {
                console.error('Background incident processing failed:', error);
            });

            return sendSuccess(res, 'Audio processed and incident created successfully', {
                transcribedText,
                incidentId: insertedIncident.id,
                status: insertedIncident.status,
                reported_at: insertedIncident.reported_at,
                note: 'Incident is being automatically processed and appropriate response teams will be notified.'
            });
        } catch (transcriptionError) {
            // Clean up the temporary file
            fs.unlink(req.file.path, (err) => {
                // Error deleting temporary file - no need to log
            });

            return sendError(res, 'Error during transcription process', transcriptionError, 500);
        }
    } catch (error) {
        return sendError(res, 'Server error processing audio recording', error, 500);
    }
};

module.exports = {
    processAudioRecording,
    extractIncidentData
}; 