import { supabase } from '../config/supabase.js';

/**
 * Get About Page Content & Creator Profiles
 * Sanitizes data based on visibility toggle.
 */
export const getAboutContent = async (req, res) => {
    try {
        // 1. Fetch System Info, Creators, and Departments
        const [
            { data: about, error: aError }, 
            { data: creators, error: cError },
            { data: departments, error: dError }
        ] = await Promise.all([
            supabase.from('system_about').select('content').single(),
            supabase
                .from('creator_profiles')
                .select(`
                    nickname, bio, phone_number, social_links, photo_url, is_visible, display_order, profile_id,
                    profiles (full_name, department_id)
                `)
                .order('display_order', { ascending: true }),
            supabase.from('departments').select('id, name')
        ]);

        if (aError) throw aError;
        if (cError) throw cError;
        if (dError) throw dError;

        // Create a lookup map for departments
        const deptMap = departments.reduce((acc, dept) => {
            acc[dept.id] = dept.name.trim(); // Trim spaces as seen in debug output ("IT ")
            return acc;
        }, {});

        // 2. Sanitize Data (Zero-Leak Logic)
        const sanitizedCreators = creators.map(c => {
            const deptId = c.profiles?.department_id;
            const deptName = deptId ? deptMap[deptId] : null;

            if (!c.is_visible) {
                return {
                    nickname: c.nickname,
                    full_name: c.profiles?.full_name,
                    department_name: deptName,
                    is_visible: false,
                    display_order: c.display_order,
                    // Strip all personal data
                    bio: null,
                    phone_number: null,
                    social_links: {},
                    photo_url: null
                };
            }
            return {
                ...c,
                full_name: c.profiles?.full_name,
                department_name: deptName,
                profiles: undefined // Clean up extra nesting
            };
        });

        res.status(200).json({
            status: 'success',
            data: {
                about: about.content,
                creators: sanitizedCreators
            }
        });
    } catch (error) {
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

/**
 * Update Creator Visibility & Personal Info
 */
export const updateCreatorProfile = async (req, res) => {
    try {
        const profileId = req.user.id;
        const { bio, phone_number, social_links, photo_url, is_visible, nickname } = req.body;

        const { data, error } = await supabase
            .from('creator_profiles')
            .update({ bio, phone_number, social_links, photo_url, is_visible, nickname })
            .eq('profile_id', profileId)
            .select()
            .single();

        if (error) throw error;

        res.status(200).json({
            status: 'success',
            message: 'Profile updated successfully.',
            data
        });
    } catch (error) {
        res.status(400).json({ status: 'fail', message: error.message });
    }
};
