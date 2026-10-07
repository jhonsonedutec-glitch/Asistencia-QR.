import os
import re

with open('apps-script/Code.gs', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# Completely replace the bad block
old_block = """          const payload = {
            "messaging_product": "whatsapp",
            "t"""

new_block = """          const payload = {
            "messaging_product": "whatsapp",
            "to": numeroDestino,
            "type": "template","""

# We'll use a very forgiving regex to find and replace the payload block
content = re.sub(r'"messaging_product": "whatsapp",\s*".*o": numeroDestino,\s*"type": "template",', '"messaging_product": "whatsapp",\n            "to": numeroDestino,\n            "type": "template",', content)

with open('apps-script/Code.gs', 'w', encoding='utf-8') as f:
    f.write(content)
