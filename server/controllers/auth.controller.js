const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');
const config = require('../config/env');
const { validateRegistration, validateLogin } = require('../utils/validation');
const { sendSuccess, sendError } = require('../utils/utils');

const { jwtSecret, jwtExpiresIn } = config;

const register = async (req, res) => {
    try {
        const { email, password, name, mobile } = req.body;

        // Check if email already exists
        const { data: existingEmail, error: emailCheckError } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single();

        if (emailCheckError && emailCheckError.code !== 'PGRST116') {
            return sendError(res, 'Server error during registration', emailCheckError, 500);
        }

        if (existingEmail) {
            return sendError(res, 'User with this email already exists', null, 400);
        }

        // Check if mobile already exists
        const { data: existingMobile, error: mobileCheckError } = await supabase
            .from('users')
            .select('id')
            .eq('mobile', mobile)
            .single();

        if (mobileCheckError && mobileCheckError.code !== 'PGRST116') {
            return sendError(res, 'Server error during registration', mobileCheckError, 500);
        }

        if (existingMobile) {
            return sendError(res, 'User with this mobile number already exists', null, 400);
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 12); // Higher cost factor for better security

        const newUser = {
            name,
            mobile,
            email,
            password: hashedPassword,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const { data: insertedUser, error: insertError } = await supabase
            .from('users')
            .insert(newUser)
            .select()
            .single();

        if (insertError) {
            return sendError(res, 'Server error during registration', insertError, 500);
        }

        return sendSuccess(res, {
            message: 'User registered successfully',
            user: {
                id: insertedUser.id,
                name: insertedUser.name,
                mobile: insertedUser.mobile,
                email: insertedUser.email
            }
        }, 201);
    } catch (error) {
        return sendError(res, 'Server error during registration', error, 500);
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const { data: user, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (userError) {
            return sendError(res, 'Invalid credentials', null, 401);
        }

        if (!user) {
            return sendError(res, 'Invalid credentials', null, 401);
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return sendError(res, 'Invalid credentials', null, 401);
        }

        return sendSuccess(res, {
            message: 'Login successful',
            user: {
                id: user.id,
                name: user.name,
                mobile: user.mobile,
                email: user.email
            }
        });
    } catch (error) {
        return sendError(res, 'Server error during login', error, 500);
    }
};

module.exports = {
    register,
    login
}; 