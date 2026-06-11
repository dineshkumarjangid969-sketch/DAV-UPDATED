const fs = require('fs');
const readline = require('readline');
const rl = readline.createInterface({
    input: fs.createReadStream('C:\\Users\\dines\\.gemini\\antigravity-ide\\brain\\bf135cc7-99ee-4e1d-a2d3-a51e74cf3f05\\.system_generated\\logs\\transcript.jsonl')
});

rl.on('line', (l) => {
    const s = JSON.parse(l);
    if (s.step_index === 1360) {
        const c = s.tool_calls[0];
        const rc = c.args.ReplacementContent;
        // Check if it contains <truncated
        if (rc.includes('<truncated')) {
            console.log('YES - content is truncated in the transcript!');
            const idx = rc.indexOf('<truncated');
            console.log('Truncation at position:', idx);
            console.log('Around truncation:', rc.substring(idx - 50, idx + 50));
        } else {
            console.log('Not truncated, but JSON.parse fails.');
            // Show last 200 chars
            console.log('Last 200 chars:', rc.substring(rc.length - 200));
        }
    }
});
