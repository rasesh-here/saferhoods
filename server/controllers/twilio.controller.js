const twilio = require('twilio');
const VoiceResponse = twilio.twiml.VoiceResponse;
const supabase = require('../config/supabase');
const axios = require('axios');
const { processTranscription } = require('../services/simpleSpeechService');
const config = require('../config/env');

const BASE_URL = config.baseUrl;

const ensureEmergencyCallsTable = async () => {
    try {
        const { data, error } = await supabase
            .from('emergency_calls')
            .select('id')
            .limit(1);

        if (error && error.code === '42P01') {
            console.log('Creating emergency_calls table...');

            const { error: createError } = await supabase.rpc('create_emergency_calls_table_if_not_exists');

            if (createError) {
                console.error('Error creating emergency_calls table via RPC:', createError);

                console.warn('Please create the emergency_calls table manually using the SQL provided in the README.md');
            } else {
                console.log('emergency_calls table created successfully');
            }
        } else if (error) {
            console.error('Error checking emergency_calls table:', error);
        } else {
            console.log('emergency_calls table exists');
        }
    } catch (error) {
        console.error('Error in ensureEmergencyCallsTable:', error);
    }
};

ensureEmergencyCallsTable();

const handleIncomingCall = (req, res) => {
    console.log('Incoming call received from:', req.body.From);
    const twiml = new VoiceResponse();

    twiml.say('Emergency hotline. This call will be recorded for safety purposes.');

    twiml.record({
        action: `${BASE_URL}/api/twilio/recording-complete`,
        maxLength: 300,
        playBeep: true,
        recordingStatusCallback: `${BASE_URL}/api/twilio/recording-status`,
        recordingStatusCallbackMethod: 'POST',
        transcribe: false,
    });

    twiml.hangup();

    console.log('TwiML Response:', twiml.toString());

    res.type('text/xml');
    res.send(twiml.toString());
};

const handleRecordingComplete = (req, res) => {
    console.log('Recording complete webhook received');

    const twiml = new VoiceResponse();

    twiml.say('Thank you for your emergency call. Your recording has been saved and will be processed immediately.');

    twiml.hangup();

    res.type('text/xml');
    res.send(twiml.toString());
};

const handleRecordingStatus = async (req, res) => {
    try {
        const {
            RecordingSid,
            RecordingStatus,
            RecordingUrl,
            RecordingDuration,
            CallSid,
            From,
            To
        } = req.body;

        if (RecordingStatus === 'completed') {
            const newCall = {
                call_sid: CallSid,
                recording_sid: RecordingSid,
                recording_url: RecordingUrl,
                caller_number: From,
                twilio_number: To,
                duration: RecordingDuration,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                transcription_status: 'pending',
                processed: false
            };

            const { data, error } = await supabase
                .from('emergency_calls')
                .insert(newCall)
                .select();

            if (error) {
                console.error('Error saving emergency call to database:', error);
            } else {
                console.log('Emergency call saved to database successfully');

                try {
                    const twilioRecordingService = require('../services/twilioRecordingService');

                    twilioRecordingService.processRecordingAndTranscribe(RecordingUrl)
                        .then(async (result) => {
                            if (result.success) {
                                console.log('Custom transcription completed successfully');

                                await processTranscriptionAndCreateIncident(
                                    result.transcript,
                                    CallSid,
                                    From,
                                    RecordingSid
                                );
                            } else {
                                console.error('Custom transcription failed:', result.error);
                            }
                        })
                        .catch(err => {
                            console.error('Error in async processing of recording:', err);
                        });
                } catch (transcriptionError) {
                    console.error('Error initiating transcription process:', transcriptionError);
                }
            }
        }

        res.status(200).send('Recording status processed');
    } catch (error) {
        console.error('Error processing recording status:', error);
        res.status(500).send('Error processing recording status');
    }
};


const processTranscriptionAndCreateIncident = async (transcriptionText, callSid, callerNumber, recordingSid) => {
    try {
        const result = processTranscription(transcriptionText, callSid, callerNumber || 'Unknown');

        if (!result.success) {
            console.error('Failed to process transcription:', result.error);
            return;
        }
        const { incident } = result;

        const shortDesc = incident.description.length > 100
            ? incident.description.substring(0, 100) + '...'
            : incident.description;

        const incidentPayload = {
            type: incident.type,
            severity: incident.severity,
            location: incident.location,
            description: incident.description,
            title: incident.title,
            userId: "system_twilio_call",
        };

        try {
            const apiEndpoint = `${BASE_URL}/api/incidents`;
            const response = await axios.post(apiEndpoint, incidentPayload);
            const { error } = await supabase
                .from('emergency_calls')
                .update({
                    processed: true,
                    incident_id: response.data.incidentId || 'unknown',
                    updated_at: new Date().toISOString()
                })
                .eq('recording_sid', recordingSid);

            if (error) {
                console.error('Error updating emergency call record:', error);
            } else {
                console.log('Emergency call record updated successfully');
            }

            return response.data;
        } catch (apiError) {
            if (apiError.response?.data) {
                console.error('API response:', apiError.response.data);
            }

            try {
                await supabase
                    .from('emergency_calls')
                    .update({
                        processed: false,
                        error_message: `Failed to create incident: ${apiError.message}`,
                        updated_at: new Date().toISOString()
                    })
                    .eq('recording_sid', recordingSid);

                console.log('Updated emergency call record with error information');
            } catch (dbError) {
                console.error('Failed to update emergency call record with error:', dbError);
            }
        }
    } catch (error) {
        console.error('Error in processTranscriptionAndCreateIncident:', error);
    }
};

const fetchRecording = async (req, res) => {
    try {
        const { recordingSid } = req.params;

        if (!recordingSid) {
            return res.status(400).json({ error: 'Recording SID is required' });
        }

        console.log(`Fetching recording with SID: ${recordingSid}`);

        const { data: emergencyCall, error: dbError } = await supabase
            .from('emergency_calls')
            .select('*')
            .eq('recording_sid', recordingSid)
            .single();

        if (dbError || !emergencyCall) {
            console.error('Error fetching recording from database:', dbError);
            return res.status(404).json({ error: 'Recording not found' });
        }

        return res.status(200).json({
            recording_sid: recordingSid,
            play_url: `${BASE_URL}/api/twilio/play/${recordingSid}`,
            duration: emergencyCall.duration,
            transcription: emergencyCall.transcription
        });
    } catch (error) {
        console.error('Error fetching recording:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

const playRecording = async (req, res) => {
    try {
        const { recordingSid } = req.params;

        if (!recordingSid) {
            return res.status(400).send('Recording SID is required');
        }

        const { data: emergencyCall, error: dbError } = await supabase
            .from('emergency_calls')
            .select('recording_url')
            .eq('recording_sid', recordingSid)
            .single();

        if (dbError || !emergencyCall) {
            console.error('Error fetching recording from database:', dbError);
            return res.status(404).send('Recording not found');
        }

        const recordingUrl = emergencyCall.recording_url;

        const { accountSid, authToken } = require('../config/twilio');

        const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

        try {
            const response = await axios({
                method: 'GET',
                url: recordingUrl,
                responseType: 'stream',
                headers: {
                    'Authorization': `Basic ${auth}`
                }
            });

            res.set('Content-Type', response.headers['content-type']);

            response.data.pipe(res);
        } catch (error) {
            console.error('Error streaming recording:', error);
            return res.status(500).send('Error streaming recording');
        }
    } catch (error) {
        console.error('Error playing recording:', error);
        return res.status(500).send('Server error');
    }
};


module.exports = {
    handleIncomingCall,
    handleRecordingComplete,
    handleRecordingStatus,
    fetchRecording,
    playRecording,
}; 