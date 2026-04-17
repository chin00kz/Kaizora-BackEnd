import { supabase } from '../config/supabase.js';

/**
 * Send a notification to a specific user
 */
export const createNotification = async (req, res) => {
  try {
    const { user_id, title, message, link } = req.body;

    const { data: notification, error } = await supabase
      .from('notifications')
      .insert([{ user_id, title, message, link }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ status: 'success', data: { notification } });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
};

/**
 * Broadcast a notification to ALL users (Superadmin only logic is handled by route middleware)
 */
export const broadcastNotification = async (req, res) => {
  try {
    const { title, message, link } = req.body;

    if (!title || !message) {
      return res.status(400).json({ status: 'fail', message: 'Title and message are required for broadcast.' });
    }

    // 1. Fetch all active users
    const { data: users, error: userError } = await supabase
      .from('profiles')
      .select('id')
      .eq('is_banned', false);

    if (userError) throw userError;

    if (!users || users.length === 0) {
      return res.status(200).json({ status: 'success', message: 'No active users to notify.' });
    }

    // 2. Prepare bulk insert
    const notifications = users.map(user => ({
      user_id: user.id,
      title,
      message,
      link: link || null
    }));

    // Supabase supports bulk inserts
    const { error: notifyError } = await supabase
      .from('notifications')
      .insert(notifications);

    if (notifyError) throw notifyError;

    res.status(200).json({ status: 'success', message: `Broadcast sent successfully to ${users.length} users.` });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
};
