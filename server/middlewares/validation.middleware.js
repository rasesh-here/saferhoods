const { validateRegistration, validateLogin } = require('../utils/validation');
const { sendError } = require('../utils/utils');

const validateRegisterData = (req, res, next) => {
    const { email, password, name, mobile } = req.body;

    const validation = validateRegistration({ email, password, name, mobile });

    if (!validation.isValid) {
        return sendError(res, 'Validation failed', validation.errors, 400);
    }

    next();
};

const validateLoginData = (req, res, next) => {
    const { email, password } = req.body;

    const validation = validateLogin({ email, password });

    if (!validation.isValid) {
        return sendError(res, 'Validation failed', validation.errors, 400);
    }

    next();
};

module.exports = {
    validateRegisterData,
    validateLoginData
}; 