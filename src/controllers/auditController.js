import { supabase } from '../config/supabase.js';

/**
 * Internal Helper to create an audit log directly from other controllers.
 * @param {string} userId - UUID of the user performing the action
 * @param {string} userName - Name of the user
 * @param {string} action - The action string (e.g., 'CREATE_KAIZEN', 'UPDATE_USER')
 * @param {string} entity - The table or entity affected (e.g., 'kaizens', 'users')
 * @param {string} entityId - The UUID of the affected entity
 * @param {object} details - Additional JSON details
 */
export const logAuditAction = async (userId, userName, action, entity = null, entityId = null, details = {}) => {
  try {
    const { error } = await supabase.from('audit_logs').insert({
      user_id: userId,
      user_name: userName || 'System/Unknown',
      action,
      entity,
      entity_id: entityId,
      details
    });
    
    if (error) {
      console.error('[logAuditAction] Failed to insert audit log:', error.message);
    }
  } catch (err) {
    console.error('[logAuditAction] Exception:', err.message);
  }
};

/**
 * Controller to fetch all audit logs (Restricted to Superadmin via route)
 */
export const getAuditLogs = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000);

    if (error) throw error;

    res.status(200).json({ status: 'success', data: { logs: data } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

/**
 * Controller to let the frontend explicitly create an audit log (e.g., LOGIN)
 */
export const createAuditLog = async (req, res) => {
  try {
    const { action, entity, entity_id, details } = req.body;
    
    if (!action) {
      return res.status(400).json({ status: 'fail', message: 'Action is required.' });
    }

    // Attempt to pull user info from req.profile (added by verifyToken middleware)
    // For LOGIN events, the frontend passes token, so verifyToken will attach req.profile
    const userId = req.user?.id || req.profile?.id || null;
    const userName = req.profile?.full_name || req.profile?.username || req.user?.user_metadata?.full_name || 'Unknown User';

    await logAuditAction(userId, userName, action, entity, entity_id, details);

    res.status(201).json({ status: 'success', message: 'Audit log recorded.' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};
