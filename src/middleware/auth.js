import { supabase } from '../config/supabase.js';

/**
 * Middleware to verify Supabase JWT
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

    // Attach user to request object
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth Middleware Error:', error);
    res.status(500).json({ message: 'Internal server error during authentication' });
  }
};

/**
 * Middleware to restrict access based on roles
 * @param {...string} allowedRoles 
 */
export const restrictTo = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      // Fetch user profile to get the role
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', req.user.id)
        .single();

      if (error || !profile) {
        return res.status(403).json({ message: 'User profile not found' });
      }

      if (!allowedRoles.includes(profile.role)) {
        return res.status(403).json({ message: 'You do not have permission to perform this action' });
      }

      next();
    } catch (error) {
      console.error('RBAC Middleware Error:', error);
      res.status(500).json({ message: 'Internal server error during authorization' });
    }
  };
};
