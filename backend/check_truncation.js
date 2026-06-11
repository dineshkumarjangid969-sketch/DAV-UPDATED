const fs = require('fs');
const readline = require('readline');
const rl = readline.createInterface({
    input: fs.createReadStream('C:\\Users\\dines\\.gemini\\antigravity-ide\\brain\\bf135cc7-99ee-4e1d-a2d3-a51e74cf3f05\\.system_generated\\logs\\transcript.jsonl')
});

// Steps that modified app.py before 2720, showing the truncated ones
const TARGET_STEPS = [1214, 1218, 1348, 1360, 1581, 1593, 1693, 1696, 1699, 1797, 1850, 2269, 2278, 2326, 2342];

rl.on('line', (l) => {
    const s = JSON.parse(l);
    if (!TARGET_STEPS.includes(s.step_index)) return;
    if (!s.tool_calls) return;
    
    for (const c of s.tool_calls) {
        if (!c.name.includes('replace_file_content')) continue;
        const a = c.args;
        const file = a.TargetFile || '';
        if (!file.includes('app.py')) continue;
        
        const desc = a.Description || a.Instruction || '';
        const tc = a.TargetContent || '';
        const rc = a.ReplacementContent || '';
        
        const tcTruncated = tc.includes('<truncated');
        const rcTruncated = rc.includes('<truncated');
        
        if (tcTruncated || rcTruncated) {
            console.log(`\n=== Step ${s.step_index} === TRUNCATED`);
            console.log(`Description: ${desc.substring(0, 200)}`);
            console.log(`TC truncated: ${tcTruncated}, RC truncated: ${rcTruncated}`);
            console.log(`Lines: ${a.StartLine}-${a.EndLine}`);
        } else {
            let tcOk = true, rcOk = true;
            if (tc.startsWith('"')) { try { JSON.parse(tc); } catch { tcOk = false; } }
            if (rc.startsWith('"')) { try { JSON.parse(rc); } catch { rcOk = false; } }
            
            if (!tcOk || !rcOk) {
                console.log(`\n=== Step ${s.step_index} === JSON DECODE FAILED`);
                console.log(`Description: ${desc.substring(0, 200)}`);
            } else {
                console.log(`\n=== Step ${s.step_index} === OK`);
                console.log(`Description: ${desc.substring(0, 200)}`);
            }
        }
    }
});
