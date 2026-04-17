import { supabase } from '../config/supabase.js';

/**
 * Global Logger Middleware.
 * Intercepts requests and logs metadata to public.system_logs if debug mode is active.
 */
export const loggerMiddleware = async (req, res, next) => {
  // 1. Capture original res.json to intercept completion
  const originalJson = res.json;
  
  res.json = function (data) {
    // We log after the response is sent/prepared to get the status code
    const logActivity = async () => {
      try {
        // Check if debug mode is ON
        const { data: setting } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'api_debug_mode')
          .single();

        const isDebugOn = setting?.value === 'true' || setting?.value === true;

        if (isDebugOn) {
          // Exempt polling endpoints to avoid log spam
          const exemptPaths = ['/api/system/status', '/api/system/logs'];
          if (!exemptPaths.includes(req.path)) {
            await supabase.from('system_logs').insert({
              method: req.method,
              path: req.path,
              status: res.statusCode,
              user_name: req.profile?.full_name || req.profile?.username || 'Anonymous'
            });
          }
        }
      } catch (err) {
        console.error('[loggerMiddleware] Error writing to logs:', err.message);
      }
    };

    logActivity();
    return originalJson.call(this, data);
  };

  next();
};
