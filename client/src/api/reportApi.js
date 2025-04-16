import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

// --- Simple Helper: Map API Type to Crime Object (Emoji + Label) ---
const typeToCrimeMap = {
    'Fire': { emoji: '🔥', label: 'Fire' },
    'Theft/Robbery': { emoji: '💰', label: 'Theft/Robbery' },
    'Assault/Fight': { emoji: '👊', label: 'Assault/Fight' },
    'Vandalism/Damage': { emoji: '🔨', label: 'Vandalism/Damage' },
    'Traffic Accident': { emoji: '🚗', label: 'Traffic Accident' },
    // 'Disturbance': { emoji: '🗣️', label: 'Disturbance' },
    'Suspicious Activity': { emoji: '❓', label: 'Suspicious Activity' },
    'Noise Complaint': { emoji: '🔊', label: 'Noise Complaint' },
    'Other Emergency': { emoji: '🆘', label: 'Other Emergency' },
    // Add other types corresponding to your API 'type' values
    'Default': { emoji: '🚨', label: 'Incident' } // Fallback
};

const getCrimeObjectForType = (type) => {
    return typeToCrimeMap[type] || { emoji: typeToCrimeMap['Default'].emoji, label: type || 'Incident' };
};

const transformBasicIncident = (apiIncident) => {
    if (!apiIncident || !apiIncident.location) {
        console.warn("Skipping invalid incident data from API:", apiIncident);
        return null;
    }
    return {
        // Frontend structure fields
        id: apiIncident.id,
        crime: getCrimeObjectForType(apiIncident.type),
        location: {
            lat: apiIncident.location.lat ?? apiIncident.location.latitude ?? 0, 
            lng: apiIncident.location.lng ?? apiIncident.location.longitude ?? 0, 
            address: apiIncident.location.address || '', 
        },
        description: apiIncident.description || '',
        status: apiIncident.status || 'New',
        severity: apiIncident.severity || 'Low', 
        timestamp: apiIncident.reported_at || apiIncident.created_at || new Date().toISOString(), 
        assignedTeam: apiIncident.assigned_teams?.[0] || null,
        recordingLink: apiIncident.recording_link,
        transcription: apiIncident.transcription
    };
};

export const reportApi = createApi({
    reducerPath: 'api',
    baseQuery: fetchBaseQuery({ baseUrl: 'http://localhost:4000/api/' }),
    tagTypes: ['Incident'],
    endpoints: (builder) => ({
        getIncidents: builder.query({
           
            query: (params) => ({
                url: 'incidents',
                params: params,
            }),
            transformResponse: (response) => {
                const incidentsArray = Array.isArray(response) ? response : response?.incidents;

                if (!Array.isArray(incidentsArray)) {
                    console.error("API Error: Expected an array of incidents, received:", response);
                    return []; 
                }
             
                return incidentsArray.map(transformBasicIncident);
            },
            providesTags: ['Incident'],
        }),

        addIncident: builder.mutation({
            query: (newIncidentData) => ({
                url: 'incidents',
                method: 'POST',
                body: newIncidentData, 
            }),
            invalidatesTags: ['Incident'], 
        }),
    }),
});

export const {
    useGetIncidentsQuery,
    useAddIncidentMutation,
} = reportApi;