const fs = require('fs');
const readline = require('readline');
const rl = readline.createInterface({
    input: fs.createReadStream('C:\\Users\\dines\\.gemini\\antigravity-ide\\brain\\bf135cc7-99ee-4e1d-a2d3-a51e74cf3f05\\.system_generated\\logs\\transcript.jsonl')
});

// Steps from the walkthrough phase that modified app.py: 2463, 2480, 2507, 2621, 2641
const TARGET_STEPS = [2463, 2480, 2507, 2523, 2555, 2597, 2621, 2641];

rl.on('line', (l) => {
    const s = JSON.parse(l);
    if (!TARGET_STEPS.includes(s.step_index)) return;
    if (!s.tool_calls) return;
    
    for (const c of s.tool_calls) {
        if (c.name !== 'replace_file_content') continue;
        const a = c.args;
        const file = a.TargetFile || '';
        const desc = a.Description || a.Instruction || '';
        const tc = a.TargetContent || '';
        const rc = a.ReplacementContent || '';
        
        console.log(`\n=== Step ${s.step_index} ===`);
        console.log(`File: ${file.split('\\').pop()}`);
        console.log(`Description: ${desc.substring(0, 200)}`);
        console.log(`TargetContent (${tc.length} chars, truncated?): ${tc.includes('<truncated')}`);
        console.log(`ReplacementContent (${rc.length} chars, truncated?): ${rc.includes('<truncated')}`);
        
        // Check if we can JSON.parse these
        let tcDecoded = tc;
        if (tc.startsWith('"')) {
            try { tcDecoded = JSON.parse(tc); console.log('TC decoded OK'); } 
            catch(e) { console.log('TC decode FAILED:', e.message.substring(0, 80)); }
        }
        let rcDecoded = rc;
        if (rc.startsWith('"')) {
            try { rcDecoded = JSON.parse(rc); console.log('RC decoded OK'); }
            catch(e) { console.log('RC decode FAILED:', e.message.substring(0, 80)); }
        }
        
        console.log(`TC first 150: ${tcDecoded.substring(0, 150)}`);
        console.log(`RC first 150: ${rcDecoded.substring(0, 150)}`);
    }
});
