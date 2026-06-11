"""
Reconstruct files to their state at step 2720 (the walkthrough:
"Resolution: Dashboard Parsing and Accuracy Fixes")
by replaying all write/replace tool calls from the transcript.

Key fix: JSON-decode all string values from args that are wrapped in quotes.
"""
import json
import os
import subprocess

TRANSCRIPT = r"C:\Users\dines\.gemini\antigravity-ide\brain\bf135cc7-99ee-4e1d-a2d3-a51e74cf3f05\.system_generated\logs\transcript.jsonl"
PROJECT = r"c:\Users\dines\OneDrive\Documents\DAV TRANSPORT"
CUTOFF_STEP = 2721

TARGETS = {'app.py', 'ocr_fallback.py', 'server.js', 'reparse_db.js'}

def dejson(val):
    """Recursively un-escape a JSON-stringified value."""
    if not isinstance(val, str):
        return val
    s = val
    # Keep unwrapping if the string is JSON-encoded (starts/ends with quote)
    while isinstance(s, str) and s.startswith('"'):
        try:
            s = json.loads(s)
        except (json.JSONDecodeError, ValueError):
            break
    return s

def normalize_path(p):
    p = dejson(p)
    return p.replace('\\\\', '\\').replace('/', '\\')

def is_target(path):
    norm = normalize_path(path)
    basename = os.path.basename(norm)
    return basename in TARGETS

def get_file_from_git(relpath):
    try:
        result = subprocess.run(
            ['git', 'show', f'HEAD:{relpath}'],
            capture_output=True, text=True, cwd=PROJECT, encoding='utf-8'
        )
        if result.returncode == 0:
            return result.stdout
    except:
        pass
    return None

files = {}

def ensure_file_loaded(path):
    norm = normalize_path(path)
    if norm not in files:
        if norm.lower().startswith(PROJECT.lower().replace('/', '\\')):
            relpath = norm[len(PROJECT):].lstrip('\\').replace('\\', '/')
        else:
            relpath = norm
        content = get_file_from_git(relpath)
        if content is not None:
            files[norm] = content
            print(f"  Loaded {relpath} from git HEAD ({len(content)} chars)")
        else:
            try:
                with open(norm, 'r', encoding='utf-8') as f:
                    files[norm] = f.read()
                print(f"  Loaded {relpath} from disk ({len(files[norm])} chars)")
            except FileNotFoundError:
                files[norm] = ""
                print(f"  File not found: {relpath}, starting empty")

print("=== Replaying transcript to reconstruct files at step 2720 ===\n")

with open(TRANSCRIPT, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            step = json.loads(line)
        except:
            continue
        
        step_idx = step.get('step_index', 0)
        if step_idx >= CUTOFF_STEP:
            break
        
        calls = step.get('tool_calls', [])
        for call in calls:
            name = call.get('name')
            if name not in ('write_to_file', 'replace_file_content', 'multi_replace_file_content'):
                continue
            
            args = call.get('args', {})
            target = args.get('TargetFile') or args.get('targetFile', '')
            
            if not is_target(target):
                continue
            
            norm = normalize_path(target)
            ensure_file_loaded(norm)
            
            if name == 'write_to_file':
                code = dejson(args.get('CodeContent') or args.get('codeContent', ''))
                if code:
                    files[norm] = code
                    print(f"Step {step_idx}: write_to_file {os.path.basename(norm)} ({len(code)} chars)")
            
            elif name == 'replace_file_content':
                repl = dejson(args.get('ReplacementContent') or args.get('replacementContent', ''))
                tgt_content = dejson(args.get('TargetContent') or args.get('targetContent', ''))
                start = int(dejson(args.get('StartLine', '1')))
                end = int(dejson(args.get('EndLine', '1')))
                
                current = files[norm]
                
                if tgt_content and tgt_content in current:
                    files[norm] = current.replace(tgt_content, repl, 1)
                    print(f"Step {step_idx}: replace {os.path.basename(norm)} (target match, L{start}-{end})")
                else:
                    # Fallback: line-based splice
                    lines_list = current.split('\n')
                    s = max(0, start - 1)
                    e = min(len(lines_list), end)
                    new_lines = repl.split('\n')
                    lines_list[s:e] = new_lines
                    files[norm] = '\n'.join(lines_list)
                    print(f"Step {step_idx}: replace {os.path.basename(norm)} (line splice, L{start}-{end})")
            
            elif name == 'multi_replace_file_content':
                chunks = args.get('ReplacementChunks') or args.get('replacementChunks', [])
                if isinstance(chunks, str):
                    try:
                        chunks = json.loads(chunks)
                    except:
                        continue
                
                if not isinstance(chunks, list):
                    continue
                
                current = files[norm]
                for chunk in chunks:
                    repl = dejson(chunk.get('ReplacementContent') or chunk.get('replacementContent', ''))
                    tgt_content = dejson(chunk.get('TargetContent') or chunk.get('targetContent', ''))
                    
                    if tgt_content and tgt_content in current:
                        current = current.replace(tgt_content, repl, 1)
                    else:
                        start = int(dejson(chunk.get('StartLine', '1')))
                        end = int(dejson(chunk.get('EndLine', '1')))
                        lines_list = current.split('\n')
                        s = max(0, start - 1)
                        e = min(len(lines_list), end)
                        new_lines = repl.split('\n')
                        lines_list[s:e] = new_lines
                        current = '\n'.join(lines_list)
                
                files[norm] = current
                print(f"Step {step_idx}: multi_replace {os.path.basename(norm)} ({len(chunks)} chunks)")

print("\n=== Writing restored files ===")

for norm, content in files.items():
    os.makedirs(os.path.dirname(norm), exist_ok=True)
    with open(norm, 'w', encoding='utf-8') as f:
        f.write(content)
    lines_count = content.count('\n') + 1
    print(f"  Wrote {norm} ({len(content)} chars, {lines_count} lines)")

print("\nDone!")
