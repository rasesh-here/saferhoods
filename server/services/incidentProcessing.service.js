const supabase = require('../config/supabase');
const turf = require('@turf/turf');
const { sendTeamAssignmentNotification, sendReporterNotification } = require('./email.service');
const { validateAndProcessLocation } = require('../utils/utils');

const calculateDistance = (point1, point2) => {
    try {
        const lat1 = point1.latitude || point1.lat || 0;
        const lng1 = point1.longitude || point1.lng || 0;
        const lat2 = point2.latitude || point2.lat || 0;
        const lng2 = point2.longitude || point2.lng || 0;

        if (isNaN(parseFloat(lat1)) || isNaN(parseFloat(lng1)) ||
            isNaN(parseFloat(lat2)) || isNaN(parseFloat(lng2))) {
            console.log('Invalid coordinates:', { point1, point2 });
            return 10;
        }

        const from = turf.point([parseFloat(lng1), parseFloat(lat1)]);
        const to = turf.point([parseFloat(lng2), parseFloat(lat2)]);
        const options = { units: 'kilometers' };

        return turf.distance(from, to, options);
    } catch (error) {
        console.error('Error calculating distance:', error);
        return 10;
    }
};

const calculateSeverityScore = (incident) => {
    const typeScores = {
        'Fire': 8,
        'Flood': 7,
        'Medical': 6,
        'Accident': 5,
        'Infrastructure': 4,
        'Weather': 6,
        'Security': 7,
        'Other': 3
    };

    let score = typeScores[incident.type] || 5;

    if (incident.severity === 'High') {
        score += 2;
    } else if (incident.severity === 'Low') {
        score -= 2;
    }

    return Math.max(1, Math.min(10, score));
};

const determineRequiredTeamTypes = (incident, severityScore) => {
    const requiredTeams = [];

    switch (incident.type) {
        case 'Fire':
            requiredTeams.push('Fire Response');
            if (severityScore > 6) requiredTeams.push('Medical');
            if (severityScore > 8) requiredTeams.push('Rescue');
            break;
        case 'Flood':
            requiredTeams.push('Rescue');
            if (severityScore > 7) requiredTeams.push('Medical');
            break;
        case 'Medical':
            requiredTeams.push('Medical');
            if (severityScore > 8) requiredTeams.push('First Responder');
            break;
        case 'Accident':
        case 'Traffic Accident':
            requiredTeams.push('First Responder');
            requiredTeams.push('Medical');
            if (severityScore > 7) requiredTeams.push('Rescue');
            break;
        case 'Security':
        case 'Suspicious Activity':
            requiredTeams.push('Security');
            if (severityScore > 6) requiredTeams.push('First Responder');
            break;
        case 'Theft/Robbery':
            requiredTeams.push('Security');
            requiredTeams.push('First Responder');
            if (severityScore > 8) requiredTeams.push('Medical'); // For potential injuries
            break;
        case 'Assault/Fight':
            requiredTeams.push('Security');
            requiredTeams.push('Medical');
            requiredTeams.push('First Responder');
            break;
        case 'Vandalism/Damage':
            requiredTeams.push('Security');
            requiredTeams.push('First Responder');
            break;
        case 'Noise Complaint':
            requiredTeams.push('Security');
            break;
        case 'Other Emergency':
            requiredTeams.push('First Responder');
            if (severityScore > 5) requiredTeams.push('Medical');
            if (severityScore > 8) requiredTeams.push('Rescue');
            break;
        default:
            requiredTeams.push('First Responder');
            if (severityScore > 7) requiredTeams.push('Medical');
    }

    // Ensure we always have at least one team type required
    if (requiredTeams.length === 0) {
        requiredTeams.push('First Responder');
    }

    return requiredTeams;
};

const processIncident = async (incident) => {
    try {
        try {
            const { error: verifyError } = await supabase
                .from('incidents')
                .update({
                    verified: 'Confirmed',
                    updated_at: new Date().toISOString()
                })
                .eq('id', incident.id);

            if (verifyError) {
                console.error(`Error setting incident ${incident.id} as verified:`, verifyError);
            }
        } catch (verifyError) {
            console.error(`Exception setting incident ${incident.id} as verified:`, verifyError);
        }

        const location = validateAndProcessLocation(incident.location);

        if (!location.isValid) {
            try {
                const { error: updateError } = await supabase
                    .from('incidents')
                    .update({
                        status: 'error',
                        notes: incident.notes
                            ? `${incident.notes}\nInvalid location data: Valid latitude and longitude are required.`
                            : 'Invalid location data: Valid latitude and longitude are required.',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', incident.id);

                if (updateError) {
                    console.error(`Error updating incident ${incident.id} due to invalid location:`, updateError);
                }
            } catch (updateError) {
                console.error(`Exception updating incident ${incident.id} due to invalid location:`, updateError);
            }

            return {
                success: false,
                error: 'Invalid location data: Valid latitude and longitude are required.'
            };
        }

        const severityScore = calculateSeverityScore(incident);

        const requiredTeamTypes = determineRequiredTeamTypes(incident, severityScore);

        const config = require('../config/env');
        if (config.forceMockData) {
            console.warn('FORCE_MOCK_DATA is enabled. Using mock data instead of real Supabase data.');
        }

        let teamsQuery = supabase
            .from('teams')
            .select('*');

        if (requiredTeamTypes && requiredTeamTypes.length > 0) {
            teamsQuery = teamsQuery.in('type', requiredTeamTypes);
        }

        teamsQuery = teamsQuery.eq('status', 'available');

        const { data: availableTeams, error: teamsError } = await teamsQuery;

        if (teamsError) {
            console.error('Error fetching available teams:', teamsError);
            return {
                success: false,
                error: 'Failed to fetch available teams'
            };
        }

        let teamsToProcess = availableTeams || [];
        let teamSource = 'database';

        if (teamsToProcess.length === 0) {
            try {
                const mockTeams = createSampleTeams(requiredTeamTypes);
                const createdTeams = [];

                for (const team of mockTeams) {
                    const { data: insertedTeam, error: insertError } = await supabase
                        .from('teams')
                        .insert(team)
                        .select()
                        .single();

                    if (!insertError && insertedTeam) {
                        createdTeams.push(insertedTeam);
                    }
                }

                if (createdTeams.length > 0) {
                    teamsToProcess = createdTeams;
                    teamSource = 'generated';
                } else {
                    return {
                        success: false,
                        message: 'No available teams found, and failed to create sample teams'
                    };
                }
            } catch (fallbackError) {
                console.error('Error in team fallback mechanism:', fallbackError);
                return {
                    success: false,
                    error: 'Failed to create emergency teams for response'
                };
            }
        }

        const teamsWithParsedData = teamsToProcess.map(team => {
            const parsedLocation = validateAndProcessLocation(team.location);

            let parsedMembers;
            try {
                parsedMembers = typeof team.members === 'string'
                    ? JSON.parse(team.members)
                    : team.members || [];
            } catch (error) {
                console.error(`Error parsing members for team ${team.id}:`, error);
                parsedMembers = [];
            }

            return {
                ...team,
                parsedLocation,
                parsedMembers
            };
        });

        const teamsWithValidLocations = teamsWithParsedData.filter(team => team.parsedLocation.isValid);

        const teamsWithDistances = teamsWithParsedData.map(team => {
            const distance = calculateDistance(location, team.parsedLocation);
            const typeRelevance = requiredTeamTypes.indexOf(team.type) !== -1 ?
                (requiredTeamTypes.indexOf(team.type) + 1) : 10;
            const relevanceScore = (typeRelevance * 0.7) + (distance * 0.3);
            let etaMinutes = Math.ceil(distance * 5);
            etaMinutes = Math.max(15, Math.min(60, etaMinutes));

            return {
                ...team,
                distance,
                relevanceScore,
                etaMinutes
            };
        });

        teamsWithDistances.sort((a, b) => a.relevanceScore - b.relevanceScore);

        const teamCountToAssign = severityScore <= 3 ? 1 : severityScore <= 6 ? 2 : 3;

        const teamsToAssign = teamsWithDistances.slice(0, teamCountToAssign);

        try {
            const teamAssignmentData = teamsToAssign.map(team => ({
                id: team.id,
                name: team.name,
                type: team.type,
                distance: team.distance,
                etaMinutes: team.etaMinutes
            }));

            const { error: updateError } = await supabase
                .from('incidents')
                .update({
                    status: 'assigned',
                    assigned_teams: JSON.stringify(teamAssignmentData),
                    updated_at: new Date().toISOString()
                })
                .eq('id', incident.id);

            if (updateError) {
                console.error(`Error updating incident ${incident.id} with team assignments:`, updateError);
            }
        } catch (updateError) {
            console.error(`Exception updating incident ${incident.id} with team assignments:`, updateError);
        }

        const assignmentResults = await Promise.all(
            teamsToAssign.map(team =>
                safelyAssignTeam(team, incident, location, severityScore)
            )
        );

        const successfulAssignments = assignmentResults.filter(result => result.success);
        const assignedTeamsInfo = successfulAssignments.map(result => result.team);

        try {
            await sendReporterNotification(incident, assignedTeamsInfo);
        } catch (emailError) {
            console.error(`Error sending notification to reporter for incident ${incident.id}:`, emailError);
        }

        const detailedTeams = assignedTeamsInfo.map(team => {
            let members = [];
            if (team.parsedMembers && team.parsedMembers.length > 0) {
                members = team.parsedMembers;
            } else if (team.members) {
                try {
                    if (typeof team.members === 'string') {
                        members = JSON.parse(team.members);
                    } else {
                        members = team.members;
                    }
                } catch (e) {
                    console.warn(`Could not parse members for team ${team.id}:`, e);
                }
            }

            let formattedLocation = null;
            try {
                if (team.parsedLocation && team.parsedLocation.isValid) {
                    formattedLocation = team.parsedLocation;
                } else if (team.location) {
                    if (typeof team.location === 'string') {
                        formattedLocation = JSON.parse(team.location);
                    } else {
                        formattedLocation = team.location;
                    }
                }
            } catch (e) {
                console.warn(`Could not parse location for team ${team.id}:`, e);
            }

            const etaMinutes = team.etaMinutes || 15;
            const estimatedArrivalTime = new Date(Date.now() + etaMinutes * 60000).toISOString();

            return {
                id: team.id,
                name: team.name,
                type: team.type,
                status: 'assigned',
                email: team.email,
                phone: team.phone,
                distance: Math.round((team.distance || 0) * 100) / 100,
                etaMinutes: etaMinutes,
                estimatedArrivalTime: estimatedArrivalTime,
                location: formattedLocation,
                members: members,
                last_active: team.last_active || team.updated_at || new Date().toISOString()
            };
        });

        return {
            success: true,
            incidentId: incident.id,
            severityScore,
            requiredTeamTypes,
            teamSource,
            teamsFound: teamsWithDistances.length,
            teamsAssigned: assignedTeamsInfo.length,
            assignedTeams: detailedTeams,
            status: 'Teams dispatched',
            message: `${assignedTeamsInfo.length} teams have been dispatched to your location and will arrive shortly.`
        };

    } catch (error) {
        console.error('Error processing incident:', error);

        try {
            const { error: updateError } = await supabase
                .from('incidents')
                .update({
                    status: 'pending',
                    verified: 'Confirmed',
                    notes: incident.notes
                        ? `${incident.notes}\nError processing incident: ${error.message}`
                        : `Error processing incident: ${error.message}`,
                    updated_at: new Date().toISOString()
                })
                .eq('id', incident.id);

            if (updateError) {
                console.error(`Error updating incident ${incident.id} after processing failure:`, updateError);
            }
        } catch (updateError) {
            console.error(`Exception updating incident ${incident.id} after processing failure:`, updateError);
        }

        return {
            success: false,
            error: error.message
        };
    }
};

const createSampleTeams = (requiredTypes) => {
    console.log('Creating sample teams for types:', requiredTypes);
    const teams = [];

    const defaultLocation = {
        latitude: 18.5204,
        longitude: 73.8567,
        address: "Pune, Maharashtra, India"
    };

    const teamTypes = [
        'Medical',
        'Fire Response',
        'Rescue',
        'Security',
        'First Responder'
    ];

    const typesToCreate = (requiredTypes && requiredTypes.length > 0) ? [...requiredTypes] : [...teamTypes];

    typesToCreate.forEach((type, index) => {
        const team = {
            name: `${type} Team ${index + 1}`,
            type: type,
            status: 'available',
            location: JSON.stringify(defaultLocation),
            members: JSON.stringify([
                {
                    name: 'Team Leader',
                    role: 'Leader',
                    email: 'razzrose21@gmail.com'
                },
                {
                    name: 'Team Member',
                    role: 'Member',
                    email: 'saferhoods.notification@gmail.com'
                }
            ]),
            email: 'razzrose21@gmail.com',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        teams.push(team);
    });

    return teams;
};

const safelyAssignTeam = async (team, incident, location, severityScore) => {
    try {
        let instructions = `Respond to ${incident.type} incident: ${incident.title}. `;
        instructions += `Location: ${location.address}. `;
        instructions += `Severity: ${severityScore}/10. `;

        // Type-specific instructions based on incident type and team type
        if (team.type === 'Medical') {
            instructions += 'Provide medical assistance to any injured persons.';
        } else if (team.type === 'Fire Response') {
            instructions += 'Contain fire and assist with evacuation if needed.';
        } else if (team.type === 'Rescue') {
            instructions += 'Focus on search and rescue operations.';
        } else if (team.type === 'Security') {
            // Different security instructions based on incident type
            switch (incident.type) {
                case 'Theft/Robbery':
                    instructions += 'Respond to theft/robbery incident. Secure the area and gather information from witnesses.';
                    break;
                case 'Assault/Fight':
                    instructions += 'Respond to assault/fight incident. Secure the area and ensure safety of all individuals involved.';
                    break;
                case 'Vandalism/Damage':
                    instructions += 'Respond to vandalism/property damage. Document the damage and secure the area.';
                    break;
                case 'Suspicious Activity':
                    instructions += 'Investigate reported suspicious activity. Assess potential security threats.';
                    break;
                case 'Noise Complaint':
                    instructions += 'Respond to noise complaint. De-escalate the situation and ensure compliance with local ordinances.';
                    break;
                default:
                    instructions += 'Provide security assistance and assess the situation for potential threats.';
            }
        } else if (team.type === 'First Responder') {
            // Different first responder instructions based on incident type
            switch (incident.type) {
                case 'Traffic Accident':
                    instructions += 'Secure the accident scene, assist injured parties, and direct traffic if necessary.';
                    break;
                case 'Theft/Robbery':
                    instructions += 'Gather information from victims and witnesses, secure the scene, and assist security teams.';
                    break;
                case 'Assault/Fight':
                    instructions += 'Separate involved parties, provide immediate assistance, and secure the area.';
                    break;
                case 'Vandalism/Damage':
                    instructions += 'Document the damage, gather witness statements, and secure affected property.';
                    break;
                case 'Other Emergency':
                    instructions += 'Assess the emergency situation and provide immediate assistance as needed.';
                    break;
                default:
                    instructions += 'Provide first response assistance as required for the situation.';
            }
        } else {
            instructions += `Provide ${team.type} assistance as required.`;
        }

        const distance = team.distance || 5;
        let etaMinutes = Math.ceil(distance * 5);
        etaMinutes = Math.max(15, Math.min(60, etaMinutes));

        instructions += ` Estimated distance: ${distance.toFixed(2)} km. Approximate ETA: ${etaMinutes} minutes.`;

        const assignmentDetails = {
            incident_id: incident.id,
            team_id: team.id,
            priority: severityScore >= 8 ? 'High' : severityScore >= 5 ? 'Medium' : 'Low',
            instructions,
            status: 'assigned',
            assigned_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const { data: assignmentData, error: assignError } = await supabase
            .from('assignments')
            .insert(assignmentDetails)
            .select()
            .single();

        if (assignError) {
            console.error(`Error creating assignment for team ${team.id}:`, assignError);
            return { success: false, error: assignError };
        }

        console.log(`Created assignment for team ${team.id} (${team.name})`);

        const { error: teamUpdateError } = await supabase
            .from('teams')
            .update({
                status: 'assigned',
                current_assignment: incident.id,
                updated_at: new Date().toISOString()
            })
            .eq('id', team.id);

        if (teamUpdateError) {
            console.error(`Error updating team ${team.id} status to assigned:`, teamUpdateError);
        } else {
            console.log(`Updated team ${team.id} (${team.name}) status to assigned`);
        }

        const { data: fullTeamData, error: teamError } = await supabase
            .from('teams')
            .select('*')
            .eq('id', team.id)
            .single();

        const teamDataToReturn = fullTeamData || team;

        let parsedMembers = [];
        try {
            if (teamDataToReturn.members) {
                if (typeof teamDataToReturn.members === 'string') {
                    parsedMembers = JSON.parse(teamDataToReturn.members);
                } else {
                    parsedMembers = teamDataToReturn.members;
                }
            }
        } catch (e) {
            console.warn(`Error parsing team members for team ${team.id}:`, e);
        }

        let parsedLocation = null;
        try {
            if (teamDataToReturn.location) {
                if (typeof teamDataToReturn.location === 'string') {
                    parsedLocation = JSON.parse(teamDataToReturn.location);
                } else {
                    parsedLocation = teamDataToReturn.location;
                }
            }
        } catch (e) {
            console.warn(`Error parsing team location for team ${team.id}:`, e);
        }

        try {
            await sendTeamAssignmentNotification(teamDataToReturn, incident, assignmentDetails);
            console.log(`Email notification sent to team ${team.name}`);
        } catch (emailError) {
            console.error(`Failed to send email notification to team ${team.id}:`, emailError);
        }

        return {
            success: true,
            assignment: assignmentData || assignmentDetails,
            team: {
                ...teamDataToReturn,
                parsedMembers,
                parsedLocation,
                etaMinutes,
                distance,
                assignmentId: assignmentData?.id || null
            }
        };
    } catch (error) {
        console.error(`Error in team assignment process for team ${team?.id}:`, error);
        return { success: false, error };
    }
};

module.exports = {
    processIncident,
    calculateSeverityScore,
    determineRequiredTeamTypes,
    createSampleTeams,
    safelyAssignTeam
}; 