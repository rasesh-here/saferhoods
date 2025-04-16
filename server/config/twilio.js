const twilio = require('twilio');

// Twilio credentials
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

// Initialize Twilio client
const client = twilio(accountSid, authToken);

module.exports = {
    client,
    accountSid,
    authToken
}; 