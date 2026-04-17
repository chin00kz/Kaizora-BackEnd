import { supabase } from '../config/supabase.js';
import { getCachedData } from '../utils/cache.js';

/**
 * Get QDM Intelligence Metrics
 * Includes monthly trends, category distribution, and average approval speed.
 */
export const getSystemMetrics = async (req, res) => {
  try {
    // 1. Fetch all approved kaizens for aggregation
    const { data: kaizens, error } = await supabase
      .from('kaizens')
      .select('id, category, status, score, created_at, reviewed_at')
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
        if (trends[key]) {
            trends[key].submissions++;
            trends[key].score += k.score || 0;
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
        categories[k.category] = (categories[k.category] || 0) + 1;
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
      .select('score, submitted_by, department_id')
      .eq('status', 'approved');

    if (error) throw error;

    // 2. Fetch Profile & Dept metadata (Cached)
    const profiles = await getCachedData('profiles_basic', async () => {
        const { data } = await supabase.from('profiles').select('id, full_name, avatar_url');
        return data || [];
    });
    const departments = await getCachedData('departments', async () => {
        const { data } = await supabase.from('departments').select('id, name');
        return data || [];
    });

    const profileMap = new Map(profiles.map(p => [p.id, p]));
    const deptMap = new Map(departments.map(d => [d.id, d]));

    // 3. Aggregate User Stats
    const userStats = {};
    kaizens.forEach(k => {
        if (!userStats[k.submitted_by]) {
            userStats[k.submitted_by] = { totalPoints: 0, count: 0, sumScore: 0 };
        }
        userStats[k.submitted_by].totalPoints += k.score;
        userStats[k.submitted_by].count++;
        userStats[k.submitted_by].sumScore += k.score;
    });

    const userLeaderboard = Object.entries(userStats).map(([userId, stats]) => {
        const p = profileMap.get(userId);
        const avg = stats.count > 0 ? stats.sumScore / stats.count : 0;
        // Mixed Algorithm: (Total * 0.4) + (Avg * 5 * 0.6)
        const innovationIndex = (stats.totalPoints * 0.4) + (avg * 5 * 0.6);
        
        return {
            id: userId,
            name: p?.full_name || 'Anonymous',
            avatar: p?.avatar_url,
            totalPoints: stats.totalPoints,
            count: stats.count,
            avgScore: avg.toFixed(1),
            innovationIndex: innovationIndex.toFixed(1)
        };
    }).sort((a, b) => b.innovationIndex - a.innovationIndex).slice(0, 10);

    // 4. Aggregate Dept Stats
    const deptStats = {};
    kaizens.forEach(k => {
        if (!deptStats[k.department_id]) {
            deptStats[k.department_id] = { totalPoints: 0, count: 0, sumScore: 0 };
        }
        deptStats[k.department_id].totalPoints += k.score;
        deptStats[k.department_id].count++;
        deptStats[k.department_id].sumScore += k.score;
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
          id, category, status, score, created_at, reviewed_at, submitted_by, department_id,
          profiles!kaizens_submitted_by_fkey (full_name, avatar_url),
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
        // Status Distribution (Always count)
        if (statusDistribution[k.status] !== undefined) {
            statusDistribution[k.status]++;
        }

        // Trends (By created_at)
        const d = new Date(k.created_at);
        const key = d.toLocaleString('default', { month: 'short' });
        if (trends[key]) {
            trends[key].submissions++;
            if (k.status === 'approved') trends[key].approved++;
        }

        // Approved-only metrics
        if (k.status === 'approved') {
            // Speed Calculation
            if (k.reviewed_at) {
                const diff = new Date(k.reviewed_at) - new Date(k.created_at);
                if (diff > 0) {
                    totalReviewTimeMs += diff;
                    reviewedCount++;
                }
            }

            // Trend Score
            if (trends[key]) {
                trends[key].score += k.score || 0;
                trends[key].count++;
            }

            // Categories
            categories[k.category] = (categories[k.category] || 0) + 1;

            // User Leaderboard
            if (!userStats[k.submitted_by]) {
                userStats[k.submitted_by] = { 
                    totalPoints: 0, count: 0, sumScore: 0, 
                    name: k.profiles?.full_name || 'Anonymous',
                    avatar: k.profiles?.avatar_url
                };
            }
            userStats[k.submitted_by].totalPoints += k.score;
            userStats[k.submitted_by].count++;
            userStats[k.submitted_by].sumScore += k.score;

            // Dept Leaderboard
            const deptId = k.department_id;
            if (deptId) {
                if (!deptStats[deptId]) {
                    deptStats[deptId] = { totalPoints: 0, count: 0, sumScore: 0, name: k.departments?.name || 'Unknown' };
                }
                deptStats[deptId].totalPoints += k.score;
                deptStats[deptId].count++;
                deptStats[deptId].sumScore += k.score;
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
            totalUsers,
            avgReviewTime: `${avgReviewTimeHours}h`,
            statusDistribution,
            trends: trendArray,
            categories: Object.entries(categories).map(([name, value]) => ({ name, value })),
            users: userLeaderboard,
            departments: Object.entries(deptStats).map(([id, stats]) => {
                const avg = stats.count > 0 ? stats.sumScore / stats.count : 0;
                const innovationIndex = (stats.totalPoints * 0.4) + (avg * 5 * 0.6);
                return { id, ...stats, innovationIndex: innovationIndex.toFixed(1) };
            }).sort((a,b) => b.innovationIndex - a.innovationIndex).slice(0, 10)
        }
    });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
};


