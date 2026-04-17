import { supabase } from '../src/config/supabase.js';

async function updateIntro() {
    const detailedContent = 'Kaizora is a state-of-the-art continuous improvement management platform engineered to revolutionize how organizations capture, evaluate, and implement innovative ideas. Built on the principles of Kaizen, Kaizora provides a seamless end-to-end workflow for tracking improvement initiatives from inception to measurable impact. Our mission is to democratize innovation, empowering every team member to contribute to organizational excellence through a data-driven, transparent, and rewarding process.';

    const { error } = await supabase
        .from('system_about')
        .update({ content: detailedContent })
        .eq('id', (await supabase.from('system_about').select('id').single()).data.id);

    if (error) {
        console.error('Update Error:', error);
    } else {
        console.log('System About content updated successfully.');
    }
}

updateIntro();
