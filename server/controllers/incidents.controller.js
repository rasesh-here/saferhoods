const supabase = require('../config/supabase');
const { processIncident } = require('../services/incidentProcessing.service');
const { sendSuccess, sendError, validateAndProcessLocation, calculateDistance } = require('../utils/utils');
const config = require('../config/env');

// Create a new incident
const createIncident = async (req, res) => {
    try {
        const { type, severity, location, description, title, assigned_teams, reporter_email } = req.body;

        let reportedBy = null;
        let reporterEmail = reporter_email || null;

        if (req.user && req.user.id) {
            reportedBy = req.user.id;
            if (req.user.email && !reporterEmail) {
                reporterEmail = req.user.email;
            }
        }
        else if (req.body.userId) {
            reportedBy = req.body.userId;

            if (!reporterEmail) {
                const { data: user, error } = await supabase
                    .from('users')
                    .select('email')
                    .eq('id', reportedBy)
                    .single();

                if (!error && user && user.email) {
                    reporterEmail = user.email;
                }
            }
        }
        else {
            const { data: users, error } = await supabase
                .from('users')
                .select('id, email')
                .limit(1);

            if (error || !users || users.length === 0) {
                return sendError(res, 'Failed to find a valid user for the incident report', null, 500);
            }

            reportedBy = users[0].id;
            if (!reporterEmail && users[0].email) {
                reporterEmail = users[0].email;
            }
        }

        if (!type || !location || !severity) {
            return sendError(res, 'Type, severity and location are required', null, 400);
        }

        // Process and validate location
        const processedLocation = validateAndProcessLocation(location);

        // Check if location has valid coordinates
        if (!processedLocation.isValid) {
            return sendError(res, 'Valid latitude and longitude are required for location', null, 400);
        }

        // Check for existing incidents of the same type within 100 meters
        const { data: existingIncidents, error: searchError } = await supabase
            .from('incidents')
            .select('*')
            .eq('type', type)
            .in('status', ['available', 'in_progress', 'assigned']);

        if (searchError) {
            return sendError(res, 'Server error while checking for existing incidents', searchError, 500);
        }

        // Check if there's a duplicate incident within 100 meters
        let duplicateIncident = null;
        for (const incident of existingIncidents) {
            try {
                const incidentLocation = JSON.parse(incident.location);
                // Calculate distance between locations
                const distance = calculateDistance(processedLocation, incidentLocation);

                // If within 100 meters, consider it a duplicate
                if (distance <= 100) {
                    duplicateIncident = incident;
                    break;
                }
            } catch (parseErr) {
                // Continue to next incident if location parsing fails
                continue;
            }
        }

        // If a duplicate is found, update it instead of creating a new incident
        if (duplicateIncident) {
            // Increment the reported_no counter
            const reportedNo = (duplicateIncident.reported_no || 1) + 1;

            // Update the priority level based on duplicate reports
            let priority = duplicateIncident.severity;
            if (reportedNo > 1 && priority !== 'High') {
                priority = 'High';
            }

            // Update the duplicate incident
            const { data: updatedIncident, error: updateError } = await supabase
                .from('incidents')
                .update({
                    reported_no: reportedNo,
                    severity: priority,
                    updated_at: new Date().toISOString()
                })
                .eq('id', duplicateIncident.id)
                .select()
                .single();

            if (updateError) {
                return sendError(res, 'Server error while updating duplicate incident', updateError, 500);
            }

            // Get team information for the duplicate incident
            let assignedTeams = [];
            try {
                if (duplicateIncident.assigned_teams) {
                    assignedTeams = JSON.parse(duplicateIncident.assigned_teams);

                    // For each assigned team, get additional information from the database
                    if (assignedTeams.length > 0) {
                        const teamIds = assignedTeams.map(team => team.id);
                        const { data: teamsData, error: teamsError } = await supabase
                            .from('teams')
                            .select('*')
                            .in('id', teamIds);

                        if (!teamsError && teamsData) {
                            // Enhance assigned teams data with full team information
                            assignedTeams = assignedTeams.map(team => {
                                const fullTeamData = teamsData.find(t => t.id === team.id);
                                if (fullTeamData) {
                                    // Parse team members if they exist
                                    let members = [];
                                    try {
                                        if (fullTeamData.members) {
                                            members = JSON.parse(fullTeamData.members);
                                        }
                                    } catch (e) {
                                        // Error parsing team members - no need to log
                                    }

                                    return {
                                        ...team,
                                        members,
                                        email: fullTeamData.email,
                                        phone: fullTeamData.phone,
                                        estimatedArrivalTime: new Date(Date.now() + (team.etaMinutes || 15) * 60000).toISOString()
                                    };
                                }
                                return team;
                            });
                        }
                    }
                }
            } catch (parseError) {
                // Error parsing or retrieving team data - no need to log
            }

            // Format the incident location for response
            let formattedLocation = null;
            try {
                formattedLocation = JSON.parse(duplicateIncident.location);
            } catch (parseError) {
                // Error parsing incident location - no need to log
            }

            // Return information about the duplicate incident
            return sendSuccess(res, {
                message: 'Similar incident already reported in this area',
                duplicate: true,
                incidentId: duplicateIncident.id,
                incident: {
                    id: duplicateIncident.id,
                    type: duplicateIncident.type,
                    title: duplicateIncident.title,
                    description: duplicateIncident.description,
                    severity: updatedIncident.severity,
                    status: updatedIncident.status,
                    location: formattedLocation,
                    reported_at: duplicateIncident.reported_at,
                    updated_at: updatedIncident.updated_at,
                    reported_no: reportedNo,
                    verified: duplicateIncident.verified
                },
                assigned_teams: assignedTeams,
                note: 'Your report has been registered. This incident was already reported and is being handled. Priority has been increased due to multiple reports.'
            }, 200);
        }

        // Create a new incident if no duplicate found
        const newIncident = {
            type,
            severity: severity || 'Medium',
            location: JSON.stringify(processedLocation),
            description,
            title,
            status: 'available',
            reported_by: reportedBy,
            reporter_email: reporterEmail,
            reported_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            verified: 'Pending',
            reported_no: 1, // Initialize with 1 for the first report
            assigned_teams: assigned_teams ? JSON.stringify(assigned_teams) : JSON.stringify([])
        };

        const { data: insertedIncident, error: insertError } = await supabase
            .from('incidents')
            .insert(newIncident)
            .select()
            .single();

        if (insertError) {
            console.error('Database error during incident creation:', insertError);
            return sendError(res, 'Server error while creating incident', insertError, 500);
        }

        // Process the incident to assign teams
        let processingResult = { success: false, assignedTeams: [] };
        try {
            // Process incident and wait for result, so we can include team info in response
            processingResult = await processIncident(insertedIncident);
        } catch (processError) {
            console.error('Error processing incident:', processError);
            // Continue anyway - we'll return what we have
        }

        // Format location object for response
        let formattedLocation = null;
        try {
            formattedLocation = JSON.parse(insertedIncident.location);
        } catch (e) {
            formattedLocation = processedLocation;
        }

        return sendSuccess(res, {
            message: 'Incident reported successfully',
            incident: {
                id: insertedIncident.id,
                type: insertedIncident.type,
                title: insertedIncident.title,
                description: insertedIncident.description,
                severity: insertedIncident.severity,
                status: processingResult.success ? 'assigned' : insertedIncident.status,
                location: formattedLocation,
                reported_at: insertedIncident.reported_at,
                updated_at: insertedIncident.updated_at,
                reported_no: 1,
                verified: insertedIncident.verified
            },
            assigned_teams: processingResult.assignedTeams || [],
            processing_status: processingResult.success ? 'success' : 'pending',
            note: processingResult.success
                ? `Incident is reported and ${processingResult.assignedTeams.length} teams have been assigned to respond. You will receive an email confirmation shortly.`
                : 'Incident is reported and response teams will be notified. You will receive an email confirmation once response teams are assigned.'
        }, 201);
    } catch (error) {
        console.error('Create incident error:', error);
        return sendError(res, 'Server error while creating incident', error, 500);
    }
};

// Get incidents reported by current user
const getUserIncidents = async (req, res) => {
    try {
        const userId = req.params.id;

        if (!userId) {
            return sendError(res, 'User ID is required', null, 400);
        }

        const { data: allIncidents, error: fetchError } = await supabase
            .from('incidents')
            .select('*');

        if (fetchError) {
            console.error('Database error fetching incidents:', fetchError);
            return sendError(res, 'Server error while retrieving incidents', fetchError, 500);
        }

        const userIncidents = allIncidents.filter(incident => {
            const reportedBy = incident.reported_by;
            const reportedByStr = String(reportedBy || '');
            return reportedByStr === userId ||
                reportedByStr.includes(userId) ||
                (typeof reportedBy === 'object' && JSON.stringify(reportedBy).includes(userId));
        });

        // Process each incident to include full team information
        const formattedIncidents = await Promise.all(userIncidents.map(async incident => {
            try {
                // Format location
                let location = null;
                try {
                    location = incident.location ? JSON.parse(incident.location) : null;
                } catch (locError) {
                    console.error(`Error parsing location for incident ${incident.id}:`, locError);
                }

                // Get assigned teams with full information
                let assignedTeams = [];
                try {
                    if (incident.assigned_teams) {
                        // Parse the assigned teams JSON
                        const teamsData = typeof incident.assigned_teams === 'string'
                            ? JSON.parse(incident.assigned_teams)
                            : incident.assigned_teams;

                        if (teamsData && teamsData.length > 0) {
                            // Get team IDs to fetch complete data
                            const teamIds = teamsData.map(team => team.id).filter(Boolean);

                            if (teamIds.length > 0) {
                                // Fetch full team info from database
                                const { data: fullTeamsData, error: teamsError } = await supabase
                                    .from('teams')
                                    .select('*')
                                    .in('id', teamIds);

                                if (!teamsError && fullTeamsData) {
                                    // Merge basic team info with full team data
                                    assignedTeams = teamsData.map(team => {
                                        const fullTeam = fullTeamsData.find(t => t.id === team.id);

                                        if (fullTeam) {
                                            // Parse team members if available
                                            let members = [];
                                            try {
                                                if (fullTeam.members) {
                                                    members = typeof fullTeam.members === 'string'
                                                        ? JSON.parse(fullTeam.members)
                                                        : fullTeam.members;
                                                }
                                            } catch (mError) {
                                                console.error(`Error parsing members for team ${team.id}:`, mError);
                                            }

                                            // Parse team location if available
                                            let teamLocation = null;
                                            try {
                                                if (fullTeam.location) {
                                                    teamLocation = typeof fullTeam.location === 'string'
                                                        ? JSON.parse(fullTeam.location)
                                                        : fullTeam.location;
                                                }
                                            } catch (lError) {
                                                console.error(`Error parsing location for team ${team.id}:`, lError);
                                            }

                                            // Calculate estimated arrival time
                                            let etaMinutes = team.etaMinutes || 15;
                                            etaMinutes = Math.max(15, Math.min(60, etaMinutes));
                                            const estimatedArrivalTime = new Date(
                                                Date.now() + etaMinutes * 60000
                                            ).toISOString();

                                            return {
                                                ...team,
                                                name: fullTeam.name || team.name,
                                                type: fullTeam.type || team.type,
                                                email: fullTeam.email,
                                                phone: fullTeam.phone,
                                                members: members,
                                                location: teamLocation,
                                                etaMinutes: etaMinutes,
                                                estimatedArrivalTime: estimatedArrivalTime,
                                                status: fullTeam.status || 'assigned'
                                            };
                                        }
                                        return team;
                                    });
                                } else {
                                    assignedTeams = teamsData;
                                }
                            } else {
                                assignedTeams = teamsData;
                            }
                        }
                    }
                } catch (teamsParseError) {
                    console.error(`Error parsing assigned teams for incident ${incident.id}:`, teamsParseError);
                }

                // Get associated emergency call data if available
                let recordingLink = null;
                let transcription = null;

                // Only check for emergency calls if this is a Twilio call incident
                if (incident.reported_by === "system_twilio_call") {
                    try {
                        // First check the media field for recordings
                        if (incident.media) {
                            try {
                                const mediaItems = typeof incident.media === 'string'
                                    ? JSON.parse(incident.media)
                                    : incident.media;

                                if (Array.isArray(mediaItems)) {
                                    const audioItem = mediaItems.find(item => item.type === 'audio');
                                    if (audioItem && audioItem.url) {
                                        // Convert recording URL to direct play URL format
                                        if (audioItem.url.includes('/recordings/')) {
                                            const recordingSid = audioItem.url.split('/').pop();
                                            recordingLink = `http://localhost:4000/api/twilio/play/${recordingSid}`;
                                        } else {
                                            recordingLink = audioItem.url;
                                        }
                                    }
                                }
                            } catch (mediaError) {
                                console.error(`Error parsing media for incident ${incident.id}:`, mediaError);
                            }
                        }

                        // If we still don't have a recording link, try the emergency_calls table
                        if (!recordingLink) {
                            const { data: emergencyCall, error: emergencyCallError } = await supabase
                                .from('emergency_calls')
                                .select('recording_url, transcription, recording_sid')
                                .eq('incident_id', incident.id)
                                .single();

                            if (!emergencyCallError && emergencyCall) {
                                // Use the playback endpoint for the recording URL
                                if (emergencyCall.recording_sid) {
                                    recordingLink = `${config.baseUrl}/api/twilio/play/${emergencyCall.recording_sid}`;
                                } else {
                                    recordingLink = emergencyCall.recording_url;
                                }
                                transcription = emergencyCall.transcription;
                            }
                        }

                        // If we have a recording link but no transcription, extract it from description
                        if (recordingLink && !transcription && incident.description) {
                            // Description often contains the transcription for Twilio calls
                            transcription = incident.description.split('\n\n')[0].trim();
                        }
                    } catch (emergencyCallError) {
                        console.error(`Error fetching emergency call data for incident ${incident.id}:`, emergencyCallError);
                    }
                }

                return {
                    ...incident,
                    location: location,
                    assigned_teams: assignedTeams,
                    recording_link: recordingLink,
                    transcription: transcription
                };
            } catch (parseError) {
                console.error(`Error processing incident ${incident.id}:`, parseError);
                return {
                    ...incident,
                    location: null,
                    assigned_teams: [],
                    recording_link: null,
                    transcription: null
                };
            }
        }));

        return sendSuccess(res, {
            count: formattedIncidents.length,
            incidents: formattedIncidents
        });
    } catch (error) {
        console.error('Get user incidents error:', error);
        return sendError(res, 'Server error while retrieving incidents', error.message, 500);
    }
};

// Get all incidents
const getAllIncidents = async (req, res) => {
    try {
        const { status, severity, type, verified } = req.query;

        let query = supabase
            .from('incidents')
            .select('*');

        if (status) {
            query = query.eq('status', status);
        }

        if (severity) {
            query = query.eq('severity', severity);
        }

        if (type) {
            query = query.eq('type', type);
        }

        if (verified !== undefined) {
            const isVerified = verified === 'true';
            query = query.eq('verified', isVerified ? 'Confirmed' : 'Pending');
        }

        const { data: incidents, error: fetchError } = await query;

        if (fetchError) {
            console.error('Database error fetching incidents:', fetchError);
            return sendError(res, 'Server error while retrieving incidents', fetchError, 500);
        }

        // Process each incident to include full team information
        const formattedIncidents = await Promise.all(incidents.map(async incident => {
            try {
                // Format location
                let location = null;
                try {
                    location = incident.location ? JSON.parse(incident.location) : null;
                } catch (locError) {
                    console.error(`Error parsing location for incident ${incident.id}:`, locError);
                }

                // Get assigned teams with full information
                let assignedTeams = [];
                try {
                    if (incident.assigned_teams) {
                        // Parse the assigned teams JSON
                        const teamsData = typeof incident.assigned_teams === 'string'
                            ? JSON.parse(incident.assigned_teams)
                            : incident.assigned_teams;

                        if (teamsData && teamsData.length > 0) {
                            // Get team IDs to fetch complete data
                            const teamIds = teamsData.map(team => team.id).filter(Boolean);

                            if (teamIds.length > 0) {
                                // Fetch full team info from database
                                const { data: fullTeamsData, error: teamsError } = await supabase
                                    .from('teams')
                                    .select('*')
                                    .in('id', teamIds);

                                if (!teamsError && fullTeamsData) {
                                    // Merge basic team info with full team data
                                    assignedTeams = teamsData.map(team => {
                                        const fullTeam = fullTeamsData.find(t => t.id === team.id);

                                        if (fullTeam) {
                                            // Parse team members if available
                                            let members = [];
                                            try {
                                                if (fullTeam.members) {
                                                    members = typeof fullTeam.members === 'string'
                                                        ? JSON.parse(fullTeam.members)
                                                        : fullTeam.members;
                                                }
                                            } catch (mError) {
                                                console.error(`Error parsing members for team ${team.id}:`, mError);
                                            }

                                            // Parse team location if available
                                            let teamLocation = null;
                                            try {
                                                if (fullTeam.location) {
                                                    teamLocation = typeof fullTeam.location === 'string'
                                                        ? JSON.parse(fullTeam.location)
                                                        : fullTeam.location;
                                                }
                                            } catch (lError) {
                                                console.error(`Error parsing location for team ${team.id}:`, lError);
                                            }

                                            // Calculate estimated arrival time
                                            let etaMinutes = team.etaMinutes || 15;
                                            etaMinutes = Math.max(15, Math.min(60, etaMinutes));
                                            const estimatedArrivalTime = new Date(
                                                Date.now() + etaMinutes * 60000
                                            ).toISOString();

                                            return {
                                                ...team,
                                                name: fullTeam.name || team.name,
                                                type: fullTeam.type || team.type,
                                                email: fullTeam.email,
                                                phone: fullTeam.phone,
                                                members: members,
                                                location: teamLocation,
                                                etaMinutes: etaMinutes,
                                                estimatedArrivalTime: estimatedArrivalTime,
                                                status: fullTeam.status || 'assigned'
                                            };
                                        }
                                        return team;
                                    });
                                } else {
                                    assignedTeams = teamsData;
                                }
                            } else {
                                assignedTeams = teamsData;
                            }
                        }
                    }
                } catch (teamsParseError) {
                    console.error(`Error parsing assigned teams for incident ${incident.id}:`, teamsParseError);
                }

                // Get associated emergency call data if available
                let recordingLink = null;
                let transcription = null;

                // Only check for emergency calls if this is a Twilio call incident
                if (incident.reported_by === "system_twilio_call") {
                    try {
                        // First check the media field for recordings
                        if (incident.media) {
                            try {
                                const mediaItems = typeof incident.media === 'string'
                                    ? JSON.parse(incident.media)
                                    : incident.media;

                                if (Array.isArray(mediaItems)) {
                                    const audioItem = mediaItems.find(item => item.type === 'audio');
                                    if (audioItem && audioItem.url) {
                                        // Convert recording URL to direct play URL format
                                        if (audioItem.url.includes('/recordings/')) {
                                            const recordingSid = audioItem.url.split('/').pop();
                                            recordingLink = `http://localhost:4000/api/twilio/play/${recordingSid}`;
                                        } else {
                                            recordingLink = audioItem.url;
                                        }
                                    }
                                }
                            } catch (mediaError) {
                                console.error(`Error parsing media for incident ${incident.id}:`, mediaError);
                            }
                        }

                        // If we still don't have a recording link, try the emergency_calls table
                        if (!recordingLink) {
                            const { data: emergencyCall, error: emergencyCallError } = await supabase
                                .from('emergency_calls')
                                .select('recording_url, transcription, recording_sid')
                                .eq('incident_id', incident.id)
                                .single();

                            if (!emergencyCallError && emergencyCall) {
                                // Use the playback endpoint for the recording URL
                                if (emergencyCall.recording_sid) {
                                    recordingLink = `${config.baseUrl}/api/twilio/play/${emergencyCall.recording_sid}`;
                                } else {
                                    recordingLink = emergencyCall.recording_url;
                                }
                                transcription = emergencyCall.transcription;
                            }
                        }

                        // If we have a recording link but no transcription, extract it from description
                        if (recordingLink && !transcription && incident.description) {
                            // Description often contains the transcription for Twilio calls
                            transcription = incident.description.split('\n\n')[0].trim();
                        }
                    } catch (emergencyCallError) {
                        console.error(`Error fetching emergency call data for incident ${incident.id}:`, emergencyCallError);
                    }
                }

                return {
                    ...incident,
                    location: location,
                    assigned_teams: assignedTeams,
                    recording_link: recordingLink,
                    transcription: transcription
                };
            } catch (parseError) {
                console.error(`Error processing incident ${incident.id}:`, parseError);
                return {
                    ...incident,
                    location: null,
                    assigned_teams: [],
                    recording_link: null,
                    transcription: null
                };
            }
        }));

        return sendSuccess(res, {
            count: formattedIncidents.length,
            incidents: formattedIncidents
        });
    } catch (error) {
        console.error('Get all incidents error:', error);
        return sendError(res, 'Server error while retrieving incidents', error.message, 500);
    }
};

module.exports = {
    createIncident,
    getUserIncidents,
    getAllIncidents,
}; 