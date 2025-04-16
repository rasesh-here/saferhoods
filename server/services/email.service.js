const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
dotenv.config();

let emailServiceAvailable = true;
let emailServiceError = null;

const createTransporter = () => {
    try {

        return nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: parseInt(process.env.EMAIL_PORT || '587'),
            secure: process.env.EMAIL_SECURE === 'true',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
    } catch (error) {
        console.error('Failed to create email transporter:', error);
        emailServiceAvailable = false;
        emailServiceError = error;
        return null;
    }
};

let transporter = createTransporter();

const sendEmail = async (options) => {
    const missingConfig = !process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS;

    if (missingConfig && emailServiceAvailable) {
        console.warn('Email configuration is incomplete. Setting email service to mock mode.');
        emailServiceAvailable = false;
    }

    if (!transporter && emailServiceAvailable) {
        console.log('Transporter not initialized, attempting to recreate...');
        transporter = createTransporter();
    }

    if (!emailServiceAvailable) {
        console.log('Email service is in mock mode. Would have sent:');
        console.log('To:', options.to);
        console.log('Subject:', options.subject);
        console.log('Text:', options.text.substring(0, 100) + '...');
        return {
            messageId: 'mock-email-service-' + Date.now(),
            envelope: { to: [options.to] },
            mockMode: true
        };
    }

    try {
        const mailOptions = {
            from: process.env.EMAIL_FROM || 'SaferHoods <saferhoods.notification@gmail.com>',
            to: options.to,
            subject: options.subject,
            text: options.text,
            html: options.html || undefined
        };

        const info = await transporter.sendMail(mailOptions);
        return info;
    } catch (error) {
        console.error('Error sending email:', error);

        if (error.code === 'EAUTH' || error.code === 'ESOCKET' || error.code === 'ETIMEDOUT') {
            emailServiceAvailable = false;
            emailServiceError = error;
            console.warn('Email service has been disabled due to connection/authentication failure');
            console.warn('Switching to mock email mode');
        }

        return {
            messageId: 'mock-email-' + Date.now(),
            envelope: { to: [options.to] },
            mockMode: true,
            error: error.message
        };
    }
};


const sendTeamAssignmentNotification = async (team, incident, assignmentDetails) => {
    if (!team) {
        console.error('Invalid team provided to sendTeamAssignmentNotification');
        return { messageId: 'invalid-team-' + Date.now() };
    }

    if (!emailServiceAvailable) {
        console.log(`[MOCK EMAIL] Team assignment notification would be sent to team ${team.id} (${team.name})`);
        return { messageId: 'mock-team-notification-' + Date.now() };
    }

    let teamEmails = [];
    if (team.email) {
        teamEmails.push(team.email);
        console.log(`Using team email from teams table: ${team.email}`);
    }
    else if (team.parsedMembers && Array.isArray(team.parsedMembers)) {
        teamEmails = team.parsedMembers
            .filter(member => member.email)
            .map(member => member.email);
        console.log(`Using team members emails: ${teamEmails.join(', ')}`);
    }

    if (teamEmails.length === 0) {
        console.warn(`No email addresses found for team ${team.id} (${team.name}). Using fallback email.`);
        teamEmails.push('razzrose21@gmail.com');
    }

    try {
        const incidentLocation = typeof incident.location === 'string'
            ? JSON.parse(incident.location)
            : incident.location || { latitude: 0, longitude: 0, address: 'Address not provided' };

        const locationAddress = incidentLocation.address || 'Address not provided';
        const mapLink = `https://www.google.com/maps/search/?api=1&query=${incidentLocation.latitude},${incidentLocation.longitude}`;

        const subject = `URGENT: New incident assignment - ${incident.type}: ${incident.title}`;

        const text = `
URGENT: You have been assigned to respond to an incident

Incident Type: ${incident.type}
Incident Title: ${incident.title}
Description: ${incident.description}
Location: ${locationAddress}
Map Link: ${mapLink}
Priority: ${assignmentDetails.priority}

Instructions: ${assignmentDetails.instructions}

Please respond immediately according to protocol.
This is an automated message from SaferHoods Incident Response System.
        `;

        const html = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #f44336; color: white; padding: 10px; text-align: center; }
        .content { padding: 20px; border: 1px solid #ddd; }
        .footer { font-size: 12px; text-align: center; margin-top: 20px; color: #777; }
        .button { display: inline-block; background-color: #4CAF50; color: white; padding: 10px 20px; 
                 text-decoration: none; border-radius: 4px; margin-top: 15px; }
        .priority-high { color: #f44336; font-weight: bold; }
        .priority-medium { color: #ff9800; font-weight: bold; }
        .priority-low { color: #4CAF50; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>URGENT: New Incident Assignment</h2>
        </div>
        <div class="content">
            <p><strong>Team:</strong> ${team.name} (${team.type})</p>
            <p><strong>Incident Type:</strong> ${incident.type}</p>
            <p><strong>Incident Title:</strong> ${incident.title}</p>
            <p><strong>Description:</strong> ${incident.description}</p>
            <p><strong>Location:</strong> ${locationAddress}</p>
            <p><strong>Priority:</strong> <span class="priority-${assignmentDetails.priority.toLowerCase()}">${assignmentDetails.priority}</span></p>
            
            <p><strong>Instructions:</strong><br>${assignmentDetails.instructions}</p>
            
            <a href="${mapLink}" class="button">View Location on Map</a>
        </div>
        <div class="footer">
            <p>This is an automated message from SaferHoods Incident Response System.</p>
            <p>Please respond immediately according to protocol.</p>
        </div>
    </div>
</body>
</html>
        `;

        return await sendEmail({
            to: teamEmails.join(', '),
            subject,
            text,
            html
        });
    } catch (error) {
        console.error(`Failed to send notification to team ${team.id}:`, error);
        return null;
    }
};


const sendReporterNotification = async (incident, assignedTeams) => {
    if (!incident) {
        console.error('Invalid incident provided to sendReporterNotification');
        return { messageId: 'invalid-incident-' + Date.now() };
    }

    if (!emailServiceAvailable) {
        console.log(`[MOCK EMAIL] Reporter notification would be sent for incident ${incident.id}`);
        return { messageId: 'mock-reporter-notification-' + Date.now() };
    }

    let reporterEmail = incident.reporter_email;
    if (!reporterEmail) {
        console.warn(`No reporter email found for incident ${incident.id}. Using fallback email.`);
        reporterEmail = 'razzrose21@gmail.com'; 
    }

    try {
        const incidentLocation = typeof incident.location === 'string'
            ? JSON.parse(incident.location)
            : incident.location || { latitude: 0, longitude: 0, address: 'Address not provided' };

        const subject = `SaferHoods: Update on your incident report - ${incident.title}`;

        const teamsToNotify = Array.isArray(assignedTeams) && assignedTeams.length > 0
            ? assignedTeams
            : [{ name: 'Response Team', type: 'Emergency', distance: 5, etaMinutes: 25 }];

        let teamsText = 'The following teams have been dispatched:\n\n';
        let teamsHtml = '<h3>The following teams have been dispatched:</h3><ul>';

        teamsToNotify.forEach(team => {
            const etaMinutes = team.etaMinutes || Math.ceil((team.distance || 5) * 5);
            const distance = team.distance || 5;

            teamsText += `- ${team.name} (${team.type})\n`;
            teamsText += `  Distance: ${distance.toFixed(2)} km\n`;
            teamsText += `  ETA: Approximately ${etaMinutes} minutes\n\n`;

            teamsHtml += `<li><strong>${team.name} (${team.type})</strong><br>`;
            teamsHtml += `Distance: ${distance.toFixed(2)} km<br>`;
            teamsHtml += `ETA: Approximately ${etaMinutes} minutes</li>`;
        });

        teamsHtml += '</ul>';

        const text = `
Thank you for reporting the incident: ${incident.title}

Your report has been processed and help is on the way.

${teamsText}

We appreciate your vigilance in helping to keep our community safe.
SaferHoods Incident Response System
        `;

        const html = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #2196F3; color: white; padding: 10px; text-align: center; }
        .content { padding: 20px; border: 1px solid #ddd; }
        .team-list { margin-top: 20px; }
        .team-item { padding: 10px; margin-bottom: 10px; background-color: #f9f9f9; border-left: 4px solid #2196F3; }
        .footer { font-size: 12px; text-align: center; margin-top: 20px; color: #777; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Update on Your Incident Report</h2>
        </div>
        <div class="content">
            <p>Thank you for reporting the incident: <strong>${incident.title || 'Emergency Incident'}</strong></p>
            <p>Your report has been processed and help is on the way.</p>
            
            <div class="team-list">
                <h3>The following teams have been dispatched:</h3>
                ${teamsToNotify.map(team => {
            const etaMinutes = team.etaMinutes || Math.ceil((team.distance || 5) * 5);
            const distance = team.distance || 5;
            return `
                        <div class="team-item">
                            <p><strong>${team.name} (${team.type})</strong></p>
                            <p>Distance: ${distance.toFixed(2)} km</p>
                            <p>ETA: Approximately ${etaMinutes} minutes</p>
                        </div>
                        `;
        }).join('')}
            </div>
        </div>
        <div class="footer">
            <p>We appreciate your vigilance in helping to keep our community safe.</p>
            <p>SaferHoods Incident Response System</p>
        </div>
    </div>
</body>
</html>
        `;

        return await sendEmail({
            to: reporterEmail,
            subject,
            text,
            html
        });
    } catch (error) {
        console.error(`Failed to send notification to reporter for incident ${incident.id}:`, error);
        return { messageId: 'failed-reporter-notification-' + Date.now() };
    }
};


const isEmailServiceAvailable = () => {
    return emailServiceAvailable;
};


const getEmailServiceError = () => {
    return emailServiceError;
};

module.exports = {
    sendEmail,
    sendTeamAssignmentNotification,
    sendReporterNotification,
    isEmailServiceAvailable,
    getEmailServiceError
}; 