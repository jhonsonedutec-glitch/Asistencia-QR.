import os
import re

with open('apps-script/Code.gs', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# Fix the specific broken property name in the JSON payload
content = re.sub(r'"t[^\w]*o": numeroDestino', '"to": numeroDestino', content)
content = re.sub(r't[^a-zA-Z0-9_]*o": numeroDestino', '"to": numeroDestino', content)

with open('apps-script/Code.gs', 'w', encoding='utf-8') as f:
    f.write(content)
