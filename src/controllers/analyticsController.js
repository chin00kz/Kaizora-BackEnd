import { supabase } from '../config/supabase.js';
import { getCachedData } from '../utils/cache.js';

// Map impact level to a normalized score
const getScoreFromImpact = (impact_level) => {
    const scores = {
        low: 10,
        medium: 25,
        high: 50,
        critical: 100
    };
    return scores[impact_level] || 10;
};

/**
 * Get QDM Intelligence Metrics
 * Includes monthly trends, category distribution, and average approval speed.
 */
export const getSystemMetrics = async (req, res) => {
    try {
        // 1. Fetch all approved kaizens for aggregation
        const { data: kaizens, error } = await supabase
            .from('kaizens')
            .select('id, category, status, impact_level, created_at, updated_at')
            .eq('status', 'approved');

        if (error) throw error;

        // 2. Aggregate Monthly Trends (Last 6 months)
        const trends = {};
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = d.toLocaleString('default', { month: 'short' });
            trends[key] = { month: key, submissions: 0, score: 0, count: 0 };
        }

        kaizens.forEach(k => {
            const d = new Date(k.created_at);
            const key = d.toLocaleString('default', { month: 'short' });
            const score = getScoreFromImpact(k.impact_level);
            
            if (trends[key]) {
                trends[key].submissions++;
                trends[key].score += score;
                trends[key].count++;
            }
        });

        const trendArray = Object.values(trends).map(t => ({
            ...t,
            avgScore: t.count > 0 ? (t.score / t.count).toFixed(1) : 0
        }));

        // 3. Category Distribution
        const categories = {};
        kaizens.forEach(k => {
            const cat = k.category || 'Uncategorized';
            categories[cat] = (categories[cat] || 0) + 1;
        });
        const categoryArray = Object.entries(categories).map(([name, value]) => ({ name, value }));

        res.status(200).json({
            status: 'success',
            data: {
                trends: trendArray,
                categories: categoryArray
            }
        });
    } catch (error) {
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

/**
 * Get Unified Leaderboard (Users and Departments)
 */
export const getLeaderboard = async (req, res) => {
    try {
        // 1. Fetch raw data
        const { data: kaizens, error } = await supabase
            .from('kaizens')
            .select('impact_level, submitted_by, department_id')
            .eq('status', 'approved');

        if (error) throw error;

        // 2. Fetch Profile & Dept metadata (Cached)
        const profiles = await getCachedData('profiles_basic', async () => {
            const { data } = await supabase.from('profiles').select('id, full_name');
            return data || [];
        });
        const departments = await getCachedData('departments', async () => {
            const { data } = await supabase.from('departments').select('id, name');
            return data || [];
        });

        const profileMap = new Map((profiles || []).map(p => [p.id, p]));
        const deptMap = new Map((departments || []).map(d => [d.id, d]));

        // 3. Aggregate User Stats
        const userStats = {};
        kaizens.forEach(k => {
            if (!userStats[k.submitted_by]) {
                userStats[k.submitted_by] = { totalPoints: 0, count: 0, sumScore: 0 };
            }
            const score = getScoreFromImpact(k.impact_level);
            userStats[k.submitted_by].totalPoints += score;
            userStats[k.submitted_by].count++;
            userStats[k.submitted_by].sumScore += score;
        });

        const userLeaderboard = Object.entries(userStats).map(([userId, stats]) => {
            const p = profileMap.get(userId);
            const avg = stats.count > 0 ? stats.sumScore / stats.count : 0;
            const innovationIndex = (stats.totalPoints * 0.4) + (avg * 5 * 0.6);

            return {
                id: userId,
                name: p?.full_name || 'Anonymous',
                avatar: null,
                totalPoints: stats.totalPoints,
                count: stats.count,
                avgScore: avg.toFixed(1),
                innovationIndex: innovationIndex.toFixed(1)
            };
        }).sort((a, b) => b.innovationIndex - a.innovationIndex).slice(0, 10);

        // 4. Aggregate Dept Stats
        const deptStats = {};
        kaizens.forEach(k => {
            if (!k.department_id) return;
            if (!deptStats[k.department_id]) {
                deptStats[k.department_id] = { totalPoints: 0, count: 0, sumScore: 0 };
            }
            const score = getScoreFromImpact(k.impact_level);
            deptStats[k.department_id].totalPoints += score;
            deptStats[k.department_id].count++;
            deptStats[k.department_id].sumScore += score;
        });

        const deptLeaderboard = Object.entries(deptStats).map(([deptId, stats]) => {
            const d = deptMap.get(deptId);
            const avg = stats.count > 0 ? stats.sumScore / stats.count : 0;
            const innovationIndex = (stats.totalPoints * 0.4) + (avg * 5 * 0.6);

            return {
                id: deptId,
                name: d?.name || 'Unknown Department',
                totalPoints: stats.totalPoints,
                count: stats.count,
                avgScore: avg.toFixed(1),
                innovationIndex: innovationIndex.toFixed(1)
            };
        }).sort((a, b) => b.innovationIndex - a.innovationIndex).slice(0, 5);

        res.status(200).json({
            status: 'success',
            data: {
                users: userLeaderboard,
                departments: deptLeaderboard
            }
        });
    } catch (error) {
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

export const getAnalyticsOverview = async (req, res) => {
    try {
        // 1. Fetch EVERYTHING in one shot
        const [{ data: kaizens, error: kError }, { count: totalUsers, error: uError }] = await Promise.all([
            supabase
                .from('kaizens')
                .select(`
          id, category, status, impact_level, created_at, updated_at, submitted_by, department_id,
          profiles!kaizens_submitted_by_fkey (full_name),
          departments (name)
        `),
            supabase.from('profiles').select('*', { count: 'exact', head: true })
        ]);

        if (kError) throw kError;
        if (uError) throw uError;

        // 2. Prepare Aggregators
        const trends = {};
        const categories = {};
        const statusDistribution = { approved: 0, pending: 0, rejected: 0, revision_requested: 0 };
        const userStats = {};
        const deptStats = {};
        let totalReviewTimeMs = 0;
        let reviewedCount = 0;

        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = d.toLocaleString('default', { month: 'short' });
            trends[key] = { month: key, submissions: 0, approved: 0, score: 0, count: 0 };
        }

        kaizens.forEach(k => {
            // Status Distribution
            if (statusDistribution[k.status] !== undefined) {
                statusDistribution[k.status]++;
            } else {
                 statusDistribution[k.status] = 1;
            }

            // Trends (By created_at)
            const d = new Date(k.created_at);
            const key = d.toLocaleString('default', { month: 'short' });
            const score = getScoreFromImpact(k.impact_level);
            
            if (trends[key]) {
                trends[key].submissions++;
                if (k.status === 'approved') trends[key].approved++;
            }

            // Approved-only metrics
            if (k.status === 'approved') {
                // Speed Calculation
                if (k.updated_at) {
                    const diff = new Date(k.updated_at) - new Date(k.created_at);
                    if (diff > 0) {
                        totalReviewTimeMs += diff;
                        reviewedCount++;
                    }
                }

                // Trend Score
                if (trends[key]) {
                    trends[key].score += score;
                    trends[key].count++;
                }

                // Categories
                const cat = k.category || 'Uncategorized';
                categories[cat] = (categories[cat] || 0) + 1;

                // User Leaderboard
                if (k.submitted_by) {
                    if (!userStats[k.submitted_by]) {
                        userStats[k.submitted_by] = {
                            totalPoints: 0, count: 0, sumScore: 0,
                            name: k.profiles?.full_name || 'Anonymous',
                            avatar: null
                        };
                    }
                    userStats[k.submitted_by].totalPoints += score;
                    userStats[k.submitted_by].count++;
                    userStats[k.submitted_by].sumScore += score;
                }

                // Dept Leaderboard
                const deptId = k.department_id;
                if (deptId) {
                    if (!deptStats[deptId]) {
                        deptStats[deptId] = { totalPoints: 0, count: 0, sumScore: 0, name: k.departments?.name || 'Unknown Department' };
                    }
                    deptStats[deptId].totalPoints += score;
                    deptStats[deptId].count++;
                    deptStats[deptId].sumScore += score;
                }
            }
        });

        // 3. Finalize
        const avgReviewTimeHours = reviewedCount > 0
            ? Math.round((totalReviewTimeMs / (1000 * 60 * 60)) / reviewedCount)
            : 0;

        const userLeaderboard = Object.entries(userStats).map(([userId, stats]) => {
            const avg = stats.count > 0 ? stats.sumScore / stats.count : 0;
            const innovationIndex = (stats.totalPoints * 0.4) + (avg * 5 * 0.6);
            return { id: userId, ...stats, avgScore: avg.toFixed(1), innovationIndex: innovationIndex.toFixed(1) };
        }).sort((a, b) => b.innovationIndex - a.innovationIndex).slice(0, 10);

        const trendArray = Object.values(trends).map(t => ({
            ...t,
            avgScore: t.count > 0 ? (t.score / t.count).toFixed(1) : 0
        }));

        res.status(200).json({
            status: 'success',
            data: {
                totalSubmissions: kaizens.length,
                totalUsers: totalUsers || 0,
                avgReviewTime: `${avgReviewTimeHours}h`,
                statusDistribution,
                trends: trendArray,
                categories: Object.entries(categories).map(([name, value]) => ({ name, value })),
                users: userLeaderboard,
                departments: Object.entries(deptStats).map(([id, stats]) => {
                    const avg = stats.count > 0 ? stats.sumScore / stats.count : 0;
                    const innovationIndex = (stats.totalPoints * 0.4) + (avg * 5 * 0.6);
                    return { id, ...stats, innovationIndex: innovationIndex.toFixed(1) };
                }).sort((a, b) => b.innovationIndex - a.innovationIndex).slice(0, 10)
            }
        });
    } catch (error) {
        console.error('Analytics overview error:', error);
        res.status(400).json({ status: 'fail', message: error.message });
    }
};
