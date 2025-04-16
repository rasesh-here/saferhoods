const NODE_ENV = process.env.NODE_ENV || 'development';

const BASE_URL = NODE_ENV === 'production'
    ? process.env.PROD_BASE_URL
    : process.env.DEV_BASE_URL;

const config = {
    nodeEnv: NODE_ENV,
    isDevelopment: NODE_ENV === 'development',
    isProduction: NODE_ENV === 'production',

    port: parseInt(process.env.PORT || '4000', 10),
    baseUrl: BASE_URL || 'http://localhost:4000',


    jwtSecret: process.env.JWT_SECRET || 'default_jwt_secret_for_dev',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',


    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_KEY,

    forceMockData: process.env.FORCE_MOCK_DATA === 'true',
    disableAuth: process.env.DISABLE_AUTH === 'true',

    // Define transcription server URL - required for the emergency call flow
    transcriptionServerUrl: process.env.TRANSCRIPTION_SERVER_URL,
};

// Warnings for missing required configuration
if (!config.jwtSecret || config.jwtSecret === 'default_jwt_secret_for_dev') {
    console.warn('WARNING: Using default JWT secret. Set JWT_SECRET in your environment variables.');
}

if (!config.supabaseUrl || !config.supabaseKey) {
    console.warn('WARNING: Supabase configuration missing. Will use mock data.');
}

if (!config.transcriptionServerUrl) {
    console.warn('WARNING: TRANSCRIPTION_SERVER_URL not set. Emergency call transcription will fail.');

    // For development, provide a default URL if on development environment
    if (config.isDevelopment) {
        config.transcriptionServerUrl = 'http://localhost:5001';
        console.warn('Setting default transcription server URL for development: http://localhost:5001');
    }
}

module.exports = config;