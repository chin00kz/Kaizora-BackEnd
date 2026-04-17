import { supabase } from '../config/supabase.js';

/**
 * Get public system status (maintenance mode and message)
 */
export const getSystemStatus = async (req, res) => {
  try {
    const { data: settings, error } = await supabase
      .from('system_settings')
      .select('key, value');

    if (error) throw error;

    const status = {};
    settings.forEach(s => {
      status[s.key] = s.value;
    });

    res.status(200).json({ status: 'success', data: { status } });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
};

/**
 * Update system settings (Admin / Superadmin only)
 */
export const updateSystemSettings = async (req, res) => {
  try {
    const { mode, message } = req.body;
    const updates = [];

    if (mode) {
      // Validate role permissions for higher modes
      if (mode === 'superadmin-only' && req.profile.role !== 'superadmin') {
        return res.status(403).json({ status: 'fail', message: 'Only a Superadmin can activate Superadmin-only maintenance mode.' });
      }
      updates.push(supabase.from('system_settings').upsert({ key: 'maintenance_mode', value: JSON.stringify(mode) }, { onConflict: 'key' }));
    }

    if (message !== undefined) {
      updates.push(supabase.from('system_settings').upsert({ key: 'maintenance_message', value: JSON.stringify(message) }, { onConflict: 'key' }));
    }

    if (req.body.debug_mode !== undefined) {
      updates.push(supabase.from('system_settings').upsert({ key: 'api_debug_mode', value: JSON.stringify(req.body.debug_mode) }, { onConflict: 'key' }));
    }

    const results = await Promise.all(updates);
    const errors = results.map(r => r.error).filter(Boolean);

    if (errors.length > 0) throw errors[0];

    res.status(200).json({ status: 'success', message: 'System settings updated successfully.' });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
};

/**
 * Nuclear Action: Purge Rejected Kaizens (Superadmin only logic handled by route)
 */
export const purgeRejectedKaizens = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('kaizens')
      .delete()
      .eq('status', 'rejected');

    if (error) throw error;

    res.status(200).json({ status: 'success', message: 'Rejected Kaizens purged successfully.' });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
};

/**
 * Get recent system logs (Superadmin only)
 */
export const getSystemLogs = async (req, res) => {
  try {
    const { data: logs, error } = await supabase
      .from('system_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    res.status(200).json({ status: 'success', data: { logs } });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
};

/**
 * Clear all system logs (Superadmin only)
 */
export const clearSystemLogs = async (req, res) => {
  try {
    const { error } = await supabase
      .from('system_logs')
      .delete()
      .neq('id', 0); // Delete all

    if (error) throw error;

    res.status(200).json({ status: 'success', message: 'System logs cleared.' });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
};
