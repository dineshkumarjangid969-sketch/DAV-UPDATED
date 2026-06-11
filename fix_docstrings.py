with open('docling-service/app.py', 'r', encoding='utf-8') as f:
    content = f.read()
content = content.replace('\\"\\"\\"', '"""')
with open('docling-service/app.py', 'w', encoding='utf-8') as f:
    f.write(content)
