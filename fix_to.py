import os

with open('apps-script/Code.gs', 'r', encoding='utf-8', errors='ignore') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if '"t' in line and 'o": numeroDestino,' in line:
        new_lines.append('          "to": numeroDestino,\n')
    else:
        new_lines.append(line)

with open('apps-script/Code.gs', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
