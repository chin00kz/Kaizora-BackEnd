import { supabase } from '../config/supabase.js';

/**
 * Middleware to verify Supabase JWT and attach user + profile to the request
 */
export const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ message: 'Invalid or expired token', error: error?.message });
    }

    // Fetch the user's profile to get role info
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_banned, username')
      .eq('id', user.id)
      .single();

    if (profile?.is_banned) {
      return res.status(403).json({ message: 'Your account has been banned.' });
    }

    req.user = user;
    req.profile = profile;
    next();
  } catch (error) {
    console.error('Auth Middleware Error:', error);
    res.status(500).json({ message: 'Internal server error during authentication' });
  }
};

/**
 * Middleware to restrict access based on roles.
 * Superadmin always passes, regardless of the allowed roles list.
 */
export const restrictTo = (...allowedRoles) => {
  return (req, res, next) => {
    const role = req.profile?.role;

    if (!role) {
      return res.status(403).json({ message: 'User profile not found' });
    }

    // Superadmin bypasses all role checks — they have access to everything
    if (role === 'superadmin') {
      return next();
    }

    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ message: 'You do not have permission to perform this action' });
    }

    next();
  };
};

/**
 * Guard to prevent ANY action targeting a superadmin user.
 * Used in admin controller endpoints.
 */
export const checkNotSuperAdmin = (targetProfile) => {
  if (targetProfile?.role === 'superadmin') {
    return {
      blocked: true,
      message: 'Permission Denied: The Super Admin account cannot be modified or deleted.'
    };
  }
  return { blocked: false };
};
