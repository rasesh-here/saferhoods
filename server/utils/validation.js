const validateEmail = (email) => {
    if (!email) {
        return { isValid: false, message: 'Email is required' };
    }

    if (email.length < 6 || email.length > 50) {
        return { isValid: false, message: 'Email must be between 6 and 50 characters' };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return { isValid: false, message: 'Invalid email format' };
    }

    if (!email.toLowerCase().endsWith('@gmail.com')) {
        return { isValid: false, message: 'Only @gmail.com email addresses are allowed' };
    }

    return { isValid: true, message: 'Email is valid' };
};

const validatePassword = (password) => {
    if (!password) {
        return { isValid: false, message: 'Password is required' };
    }

    if (password.length < 8) {
        return { isValid: false, message: 'Password must be at least 8 characters' };
    }

    if (password.length > 30) {
        return { isValid: false, message: 'Password must be at most 30 characters' };
    }

    if (!/[A-Z]/.test(password)) {
        return { isValid: false, message: 'Password must contain at least one uppercase letter' };
    }

    if (!/[a-z]/.test(password)) {
        return { isValid: false, message: 'Password must contain at least one lowercase letter' };
    }

    if (!/\d/.test(password)) {
        return { isValid: false, message: 'Password must contain at least one number' };
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        return { isValid: false, message: 'Password must contain at least one special character' };
    }

    return { isValid: true, message: 'Password is valid' };
};

const validateMobile = (mobile) => {
    if (!mobile) {
        return { isValid: false, message: 'Mobile number is required' };
    }

    const mobileRegex = /^\+91\d{10}$/;
    if (!mobileRegex.test(mobile)) {
        return {
            isValid: false,
            message: 'Mobile number must start with +91 followed by 10 digits'
        };
    }

    return { isValid: true, message: 'Mobile number is valid' };
};

const validateName = (name) => {
    if (!name) {
        return { isValid: false, message: 'Name is required' };
    }

    if (name.length < 2) {
        return { isValid: false, message: 'Name must be at least 2 characters' };
    }

    if (name.length > 50) {
        return { isValid: false, message: 'Name must be at most 50 characters' };
    }

    const nameRegex = /^[A-Za-z\s-]+$/;
    if (!nameRegex.test(name)) {
        return {
            isValid: false,
            message: 'Name can only contain letters, spaces, and hyphens'
        };
    }

    return { isValid: true, message: 'Name is valid' };
};

const validateLogin = (credentials) => {
    const { email, password } = credentials;
    const errors = {};

    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
        errors.email = emailValidation.message;
    }

    if (!password) {
        errors.password = 'Password is required';
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
};

const validateRegistration = (userData) => {
    const { name, email, password, mobile } = userData;
    const errors = {};

    const nameValidation = validateName(name);
    if (!nameValidation.isValid) {
        errors.name = nameValidation.message;
    }

    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
        errors.email = emailValidation.message;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
        errors.password = passwordValidation.message;
    }

    const mobileValidation = validateMobile(mobile);
    if (!mobileValidation.isValid) {
        errors.mobile = mobileValidation.message;
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
};

module.exports = {
    validateEmail,
    validatePassword,
    validateMobile,
    validateName,
    validateLogin,
    validateRegistration
}; 