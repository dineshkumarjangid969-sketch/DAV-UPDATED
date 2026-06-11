const fs = require('fs');
const readline = require('readline');
const path = require('path');

async function replay() {
  const rl = readline.createInterface({
    input: fs.createReadStream('C:\\Users\\dines\\.gemini\\antigravity-ide\\brain\\bf135cc7-99ee-4e1d-a2d3-a51e74cf3f05\\.system_generated\\logs\\transcript.jsonl')
  });

  const files = {};
  for await (const line of rl) {
    const step = JSON.parse(line);
    if (step.step_index >= 2390) break;

    if (step.tool_calls) {
      for (const call of step.tool_calls) {
        if (['write_to_file', 'replace_file_content', 'multi_replace_file_content'].includes(call.name)) {
            const rawArgs = call.args;
            const targetRaw = rawArgs.TargetFile || rawArgs.targetFile;
            if (!targetRaw) continue;
            let target = targetRaw;
            if (targetRaw.startsWith('"')) target = JSON.parse(targetRaw);

            target = target.replace(/\\\\/g, '\\').replace(/\\\\\\\\/g, '\\').replace(/\\\\/g, '\\');
            
            if (target.endsWith('Dashboard.js') || target.endsWith('app.py') || target.endsWith('OrderDetail.js')) {
                if (!files[target]) files[target] = fs.readFileSync(target, 'utf8');

                if (call.name === 'write_to_file') {
                    let code = rawArgs.CodeContent || rawArgs.codeContent;
                    if (code.startsWith('"')) code = JSON.parse(code);
                    files[target] = code;
                } else if (call.name === 'replace_file_content') {
                    let code = rawArgs.ReplacementContent || rawArgs.replacementContent;
                    if (code.startsWith('"')) code = JSON.parse(code);
                    const lines = files[target].split('\n');
                    let start = rawArgs.StartLine;
                    let end = rawArgs.EndLine;
                    if (typeof start === 'string' && start.startsWith('"')) start = JSON.parse(start);
                    if (typeof end === 'string' && end.startsWith('"')) end = JSON.parse(end);
                    start = parseInt(start) - 1;
                    end = parseInt(end);
                    lines.splice(start, end - start, ...(code.split('\n')));
                    files[target] = lines.join('\n');
                } else if (call.name === 'multi_replace_file_content') {
                    let chunks = rawArgs.ReplacementChunks || rawArgs.replacementChunks;
                    if (typeof chunks === 'string') chunks = JSON.parse(chunks);
                    chunks.sort((a, b) => parseInt(b.StartLine || b.startLine) - parseInt(a.StartLine || a.startLine));
                    let lines = files[target].split('\n');
                    for (const chunk of chunks) {
                        let code = chunk.ReplacementContent || chunk.replacementContent;
                        let start = chunk.StartLine || chunk.startLine;
                        let end = chunk.EndLine || chunk.endLine;
                        const s = parseInt(start) - 1;
                        const e = parseInt(end);
                        lines.splice(s, e - s, ...(code.split('\n')));
                    }
                    files[target] = lines.join('\n');
                }
            }
        }
      }
    }
  }

  for (const [target, content] of Object.entries(files)) {
      console.log('Writing reconstructed', target);
      fs.writeFileSync(target, content, 'utf8');
  }
}
replay().then(() => console.log('Done')).catch(console.error);
