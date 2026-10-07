import os

with open('apps-script/Code.gs', 'r', encoding='utf-8', errors='ignore') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if '"type": "template",' in line:
        new_lines.append('          "to": numeroDestino,\n')
        new_lines.append(line)
    elif 'numeroDestino' in line and '"type": "template"' not in line and 'messaging_product' not in line and 'celularLimpio' not in line:
        pass # skip the bad line
    else:
        new_lines.append(line)

with open('apps-script/Code.gs', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
