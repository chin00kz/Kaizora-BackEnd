import { supabase } from '../config/supabase.js';

/**
 * Middleware to intercept requests and block access based on maintenance tier.
 * Exempts public status and auth routes.
 */
export const maintenanceGuard = async (req, res, next) => {
  try {
    // 1. Skip check for health, system status, and public endpoints
    const exemptPaths = ['/api/system/status', '/health'];
    if (exemptPaths.includes(req.path) || req.path.startsWith('/api/auth')) {
      return next();
    }

    // 2. Fetch current maintenance mode from DB
    // Optimization: In a production app, we would cache this in memory for 1-5 minutes
    const { data: setting, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'maintenance_mode')
      .single();

    if (error || !setting) return next();

    let mode = setting.value;
    // Strip surrounding quotes if present (due to legacy double-serialization)
    if (typeof mode === 'string' && mode.startsWith('"') && mode.endsWith('"')) {
      mode = mode.substring(1, mode.length - 1);
    }

    if (mode === 'none') return next();

    // 3. Evaluate restriction based on user role
    let userRole = req.profile?.role;

    // Because this middleware runs globally before some specific route auth, we need to extract the role manually if missing.
    if (!userRole) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const { data: authData } = await supabase.auth.getUser(token);
        if (authData?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', authData.user.id)
            .single();
          if (profile) userRole = profile.role;
        }
      }
    }

    if (mode === 'admin-only') {
      // Allow only admin and superadmin
      if (['admin', 'superadmin'].includes(userRole)) {
        return next();
      }
      return res.status(503).json({ 
        status: 'maintenance', 
        code: 'ADMIN_ONLY',
        message: 'Platform is currently in Admin-only maintenance mode.' 
      });
    }

    if (mode === 'superadmin-only') {
      // Allow ONLY superadmin
      if (userRole === 'superadmin') {
        return next();
      }
      return res.status(503).json({ 
        status: 'maintenance', 
        code: 'SUPERADMIN_ONLY',
        message: 'Platform is currently in Superadmin-only maintenance mode.' 
      });
    }

    next();
  } catch (err) {
    console.error('[maintenanceGuard] Error:', err);
    next(); // Fail open to prevent lockout if DB is down, or fail closed? Usually fail open for UX.
  }
};
