const {
    processIncident,
} = require('../services/incidentProcessing.service');
const supabase = require('../config/supabase');
const { sendSuccess, sendError } = require('../utils/utils');

const processNewIncident = async (req, res) => {
    try {
        const { incidentId } = req.params;

        if (!incidentId) {
            return sendError(res, 'Incident ID is required', null, 400);
        }

        const { data: incident, error: fetchError } = await supabase
            .from('incidents')
            .select('*')
            .eq('id', incidentId)
            .single();

        if (fetchError || !incident) {
            console.error('Incident not found:', fetchError || 'No data returned');
            return sendError(res, 'Incident not found', fetchError, 404);
        }

        try {
            const { error: updateError } = await supabase
                .from('incidents')
                .update({
                    verified: 'Confirmed',
                    updated_at: new Date().toISOString()
                })
                .eq('id', incidentId);

            if (updateError) {
                console.warn(`Warning: Could not update verified status for incident ${incidentId}:`, updateError);
            }
        } catch (updateError) {
            console.error(`Error updating incident ${incidentId} verified status:`, updateError);
        }

        const result = await processIncident(incident);

        if (!result || !result.success) {
            const errorMessage = result?.error || 'Unknown error';
            console.error(`Failed to process incident ${incidentId}:`, errorMessage);
            return sendError(res, 'Failed to process incident', errorMessage, 500);
        }

        return sendSuccess(res, {
            message: 'Incident processed successfully',
            data: result
        });
    } catch (error) {
        console.error('Error in processNewIncident controller:', error);
        return sendError(res, 'Internal server error', error.message, 500);
    }
};

const incidentWebhook = async (req, res) => {
    try {
        const { type, record, old_record } = req.body;

        if (type !== 'INSERT' && type !== 'UPDATE') {
            return sendSuccess(res, { message: 'No action needed' });
        }

        if (type === 'INSERT') {
            const { error: updateError } = await supabase
                .from('incidents')
                .update({
                    verified: 'Confirmed',
                    updated_at: new Date().toISOString()
                })
                .eq('id', record.id);

            if (updateError) {
                console.error('Error updating incident verification status:', updateError);
                processIncident(record).catch(err => {
                    console.error('Error in automatic incident processing:', err);
                });
            } else {
                const { data: updatedRecord, error: fetchError } = await supabase
                    .from('incidents')
                    .select('*')
                    .eq('id', record.id)
                    .single();

                if (fetchError) {
                    console.error('Error fetching updated incident:', fetchError);
                    processIncident(record).catch(err => {
                        console.error('Error in automatic incident processing:', err);
                    });
                } else {
                    processIncident(updatedRecord).catch(err => {
                        console.error('Error in automatic incident processing:', err);
                    });
                }
            }

            return sendSuccess(res, {
                message: 'Incident queued for processing'
            }, 202);
        }

        if (type === 'UPDATE') {
            if (old_record?.verified !== 'Confirmed' && record?.verified === 'Confirmed') {
                processIncident(record).catch(err => {
                    console.error('Error in automatic incident processing after verification:', err);
                });

                return sendSuccess(res, {
                    message: 'Verified incident queued for processing'
                }, 202);
            }

            if (old_record?.assigned_teams !== record?.assigned_teams && record?.assigned_teams) {
                processIncident(record).catch(err => {
                    console.error('Error in automatic incident processing after team assignment:', err);
                });

                return sendSuccess(res, {
                    message: 'Incident with team assignment queued for processing'
                }, 202);
            }
        }

        return sendSuccess(res, {
            message: 'No processing needed for this update'
        });
    } catch (error) {
        console.error('Error in incident webhook:', error);
        return sendError(res, 'Internal server error', error.message, 500);
    }
};

const verifyIncident = async (req, res) => {
    try {
        const { id } = req.params;

        // Validate incident ID
        if (!id) {
            return sendError(res, 'Incident ID is required', null, 400);
        }

        // Get the incident
        const { data: incident, error: getError } = await supabase
            .from('incidents')
            .select('*')
            .eq('id', id)
            .single();

        if (getError) {
            return sendError(res, 'Error retrieving incident', getError, 500);
        }

        if (!incident) {
            return sendError(res, 'Incident not found', null, 404);
        }

        // Update the incident
        const { data: updatedIncident, error: updateError } = await supabase
            .from('incidents')
            .update({
                verified: true,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (updateError) {
            return sendError(res, 'Error updating incident', updateError, 500);
        }

        return sendSuccess(res, {
            message: 'Incident verified successfully',
            incident: updatedIncident
        });

    } catch (error) {
        return sendError(res, 'Server error verifying incident', error, 500);
    }
};

const assignTeamToIncident = async (req, res) => {
    try {
        const { id } = req.params;
        const { teamId, etaMinutes, distance } = req.body;

        // Validate inputs
        if (!id) {
            return sendError(res, 'Incident ID is required', null, 400);
        }

        if (!teamId) {
            return sendError(res, 'Team ID is required', null, 400);
        }

        // Get the incident
        const { data: incident, error: getIncidentError } = await supabase
            .from('incidents')
            .select('*')
            .eq('id', id)
            .single();

        if (getIncidentError) {
            return sendError(res, 'Error retrieving incident', getIncidentError, 500);
        }

        if (!incident) {
            return sendError(res, 'Incident not found', null, 404);
        }

        // Get the team
        const { data: team, error: getTeamError } = await supabase
            .from('teams')
            .select('*')
            .eq('id', teamId)
            .single();

        if (getTeamError) {
            return sendError(res, 'Error retrieving team', getTeamError, 500);
        }

        if (!team) {
            return sendError(res, 'Team not found', null, 404);
        }

        // Prepare team assignment data
        const assignedTeam = {
            id: team.id,
            name: team.name,
            etaMinutes: etaMinutes || 15, // Default ETA is 15 minutes
            distance: distance || null,
            assignedAt: new Date().toISOString()
        };

        // Get current assigned teams if any
        let currentAssignedTeams = [];
        try {
            if (incident.assigned_teams) {
                currentAssignedTeams = JSON.parse(incident.assigned_teams);
            }
        } catch (parseError) {
            // Invalid JSON, treat as empty array
        }

        // Add the new team if not already assigned
        const teamExists = currentAssignedTeams.some(t => t.id === team.id);
        if (!teamExists) {
            currentAssignedTeams.push(assignedTeam);
        } else {
            // Update existing team data
            currentAssignedTeams = currentAssignedTeams.map(t => {
                if (t.id === team.id) {
                    return { ...t, ...assignedTeam };
                }
                return t;
            });
        }

        // Update the incident
        const { data: updatedIncident, error: updateError } = await supabase
            .from('incidents')
            .update({
                assigned_teams: JSON.stringify(currentAssignedTeams),
                status: 'assigned',
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (updateError) {
            return sendError(res, 'Error updating incident', updateError, 500);
        }

        return sendSuccess(res, {
            message: 'Team assigned to incident successfully',
            incident: updatedIncident
        });

    } catch (error) {
        return sendError(res, 'Server error assigning team to incident', error, 500);
    }
};

module.exports = {
    processNewIncident,
    incidentWebhook,
    verifyIncident,
    assignTeamToIncident
}; 