import json
import os

transcript_path = r"C:\Users\dines\.gemini\antigravity-ide\brain\bf135cc7-99ee-4e1d-a2d3-a51e74cf3f05\.system_generated\logs\transcript.jsonl"
target_step = 2390

files = {}

def get_base_file(target):
    if target not in files:
        try:
            with open(target, 'r', encoding='utf-8') as f:
                files[target] = f.read()
        except FileNotFoundError:
            files[target] = ""

with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            step = json.loads(line)
        except:
            continue
            
        step_idx = step.get('step_index', 0)
        if step_idx >= target_step:
            break
            
        calls = step.get('tool_calls', [])
        for call in calls:
            name = call.get('name')
            if name in ('write_to_file', 'replace_file_content', 'multi_replace_file_content'):
                args = call.get('args', {})
                if isinstance(args, str):
                    try: args = json.loads(args)
                    except: continue
                        
                target = args.get('TargetFile') or args.get('targetFile')
                if not target:
                    continue
                    
                while isinstance(target, str) and target.startswith('"'):
                    try: target = json.loads(target)
                    except: break
                    
                target = target.replace('\\\\', '\\')
                
                if target.endswith('Dashboard.js') or target.endswith('app.py') or target.endswith('OrderDetail.js') or target.endswith('ocr_fallback.py'):
                    get_base_file(target)
                    
                    if name == 'write_to_file':
                        code = args.get('CodeContent') or args.get('codeContent')
                        while isinstance(code, str) and code.startswith('"'):
                            try: code = json.loads(code)
                            except: break
                        files[target] = code
                        
                    elif name == 'replace_file_content':
                        code = args.get('ReplacementContent') or args.get('replacementContent')
                        while isinstance(code, str) and code.startswith('"'):
                            try: code = json.loads(code)
                            except: break
                        lines = files[target].split('\n')
                        
                        start_str = args.get('StartLine') or args.get('startLine')
                        while isinstance(start_str, str) and start_str.startswith('"'):
                            try: start_str = json.loads(start_str)
                            except: break
                        start = int(start_str) - 1
                        
                        end_str = args.get('EndLine') or args.get('endLine')
                        while isinstance(end_str, str) and end_str.startswith('"'):
                            try: end_str = json.loads(end_str)
                            except: break
                        end = int(end_str)
                        
                        lines[start:end] = code.split('\n')
                        files[target] = '\n'.join(lines)
                        
                    elif name == 'multi_replace_file_content':
                        chunks = args.get('ReplacementChunks') or args.get('replacementChunks')
                        while isinstance(chunks, str):
                            try: chunks = json.loads(chunks)
                            except: break
                        
                        if not isinstance(chunks, list):
                            continue
                            
                        # Fix for chunks sometimes having string values with quotes
                        for chunk in chunks:
                            for key in ['StartLine', 'startLine', 'EndLine', 'endLine', 'ReplacementContent', 'replacementContent']:
                                if key in chunk:
                                    while isinstance(chunk[key], str) and chunk[key].startswith('"'):
                                        try: chunk[key] = json.loads(chunk[key])
                                        except: break
                                    
                        chunks.sort(key=lambda x: int(x.get('StartLine') or x.get('startLine')), reverse=True)
                        lines = files[target].split('\n')
                        for chunk in chunks:
                            code = chunk.get('ReplacementContent') or chunk.get('replacementContent')
                            start = int(chunk.get('StartLine') or chunk.get('startLine')) - 1
                            end = int(chunk.get('EndLine') or chunk.get('endLine'))
                            lines[start:end] = code.split('\n')
                        files[target] = '\n'.join(lines)

for target, content in files.items():
    print(f"Restoring {target}")
    with open(target, 'w', encoding='utf-8') as f:
        f.write(content)

print("Done restoring files.")
