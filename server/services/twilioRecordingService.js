const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const supabase = require('../config/supabase');
const config = require('../config/env');
const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const downloadTwilioRecording = async (recordingIdentifier) => {
    try {
        console.log(`Downloading Twilio recording: ${recordingIdentifier}`);

        let recordingSid = recordingIdentifier;
        if (recordingIdentifier.startsWith('http')) {
            const parts = recordingIdentifier.split('/');
            recordingSid = parts[parts.length - 1];
        }

        console.log(`Using Recording SID: ${recordingSid}`);

        const tempDir = path.join(__dirname, '..', '..', 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const filePath = path.join(tempDir, `${recordingSid}.wav`);

        const recording = await client.recordings(recordingSid).fetch();
        const secureUrl = recording.mediaUrl + '.wav';

        console.log(`Downloading from: ${secureUrl}`);

        const response = await axios({
            method: 'GET',
            url: secureUrl,
            responseType: 'stream',
            auth: {
                username: process.env.TWILIO_ACCOUNT_SID,
                password: process.env.TWILIO_AUTH_TOKEN
            }
        });

        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => {
                console.log(`Recording downloaded to: ${filePath}`);
                resolve({
                    success: true,
                    filePath,
                    recordingSid
                });
            });
            writer.on('error', (error) => {
                console.error('Error writing file:', error);
                reject({
                    success: false,
                    error
                });
            });
        });
    } catch (error) {
        console.error('Error downloading Twilio recording:', error);
        return {
            success: false,
            error
        };
    }
};

const transcribeRecording = async (filePath) => {
    try {
        console.log(`Sending recording to transcription service: ${filePath}`);

        if (!fs.existsSync(filePath)) {
            console.error(`File does not exist: ${filePath}`);
            return {
                success: false,
                error: new Error(`File does not exist: ${filePath}`)
            };
        }

        const stats = fs.statSync(filePath);
        console.log(`File size: ${stats.size} bytes`);

        const formData = new FormData();
        formData.append('audio', fs.createReadStream(filePath));

        if (!config.transcriptionServerUrl) {
            console.error('transcriptionServerUrl is not defined in config');
            return {
                success: false,
                error: new Error('Transcription server URL is not configured')
            };
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        try {
            console.log(`Sending to transcription server: ${config.transcriptionServerUrl}/transcribe`);

            const transcriptionResponse = await axios.post(
                `${config.transcriptionServerUrl}/transcribe`,
                formData,
                {
                    headers: {
                        ...formData.getHeaders()
                    },
                    signal: controller.signal
                }
            );

            clearTimeout(timeoutId);

            console.log(`Transcription service response status: ${transcriptionResponse.status}`);

            if (!transcriptionResponse.data) {
                console.error('Empty response from transcription service');
                return {
                    success: false,
                    error: new Error('Empty response from transcription service')
                };
            }

            if (transcriptionResponse.data.error) {
                console.error('Transcription service returned error:', transcriptionResponse.data.error);
                return {
                    success: false,
                    error: new Error(`Transcription service error: ${transcriptionResponse.data.error}`)
                };
            }

            if (!transcriptionResponse.data.transcript || !transcriptionResponse.data.transcript.text) {
                console.error('Invalid response format from transcription service:', transcriptionResponse.data);
                return {
                    success: false,
                    error: new Error('Invalid response from transcription service')
                };
            }

            const transcript = transcriptionResponse.data.transcript.text;
            const previewText = transcript.length > 100 ? transcript.substring(0, 97) + '...' : transcript;
            console.log(`Transcription successful: "${previewText}"`);

            return {
                success: true,
                transcript
            };
        } catch (axiosError) {
            clearTimeout(timeoutId);

            if (axiosError.name === 'AbortError') {
                console.error('Transcription request timed out after 30 seconds');
                return {
                    success: false,
                    error: new Error('Transcription request timed out')
                };
            }

            console.error(`Transcription service error: ${axiosError.message}`);
            if (axiosError.response) {
                console.error(`Response status: ${axiosError.response.status}`);
                console.error(`Response data:`, axiosError.response.data);
            } else if (axiosError.request) {
                console.error('No response received from transcription service');
            }

            return {
                success: false,
                error: axiosError
            };
        }
    } catch (error) {
        console.error('Error transcribing recording:', error);
        return {
            success: false,
            error
        };
    }
};

const processRecordingAndTranscribe = async (recordingUrl) => {
    try {
        console.log(`Processing recording URL: ${recordingUrl}`);

        const urlParts = recordingUrl.split('/');
        const recordingSid = urlParts[urlParts.length - 1];

        const { data: emergencyCall, error: dbError } = await supabase
            .from('emergency_calls')
            .select('*')
            .eq('recording_sid', recordingSid)
            .single();

        if (dbError) {
            console.error('Error fetching recording from database:', dbError);
            return {
                success: false,
                error: new Error('Recording not found in database')
            };
        }

        const downloadResult = await downloadTwilioRecording(recordingUrl);
        if (!downloadResult.success) {
            return {
                success: false,
                error: downloadResult.error
            };
        }

        const transcriptionResult = await transcribeRecording(downloadResult.filePath);

        let transcriptionText;
        let transcriptionStatus;

        if (transcriptionResult.success) {
            transcriptionText = transcriptionResult.transcript;
            transcriptionStatus = 'completed';
            console.log(`Successful transcription: "${transcriptionText.substring(0, 50)}..."`);
        } else {
            transcriptionText = "Transcription failed. Please listen to the recording.";
            transcriptionStatus = 'failed';
            console.warn(`Transcription failed: ${transcriptionResult.error.message}`);
        }

        const { error: updateError } = await supabase
            .from('emergency_calls')
            .update({
                transcription: transcriptionText,
                transcription_status: transcriptionStatus,
                updated_at: new Date().toISOString()
            })
            .eq('recording_sid', recordingSid);

        if (updateError) {
            console.error('Error updating database with transcription:', updateError);
        } else {
            console.log('Transcription saved to database successfully');
        }

        try {
            fs.unlinkSync(downloadResult.filePath);
            console.log(`Deleted temporary file: ${downloadResult.filePath}`);
        } catch (unlinkError) {
            console.warn('Failed to delete temporary file:', unlinkError);
        }

        return {
            success: transcriptionResult.success,
            transcript: transcriptionText,
            recordingSid,
            transcriptionStatus
        };
    } catch (error) {
        console.error('Error processing recording:', error);
        return {
            success: false,
            error
        };
    }
};

module.exports = {
    downloadTwilioRecording,
    transcribeRecording,
    processRecordingAndTranscribe
}; 