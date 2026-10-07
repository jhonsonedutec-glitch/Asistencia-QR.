import os

replacements = {
    'c\u01edmara': 'cámara',
    '\u01e7nicamente': 'únicamente',
    'Asisti\u00ef\u00bf\u00bd': 'Asistió',
    'Asisti': 'Asistió',
    'Asisti': 'Asistió',
    'dgitos': 'dígitos',
    'dgitos': 'dígitos',
    'num\u01f8ricos': 'numéricos',
    'Accin': 'Acción',
    'v\u01edlida': 'válida',
    'inv\u01edlido': 'inválido',
    'Justificacin': 'Justificación',
    'registrada': 'registrada', 
    'Ao': 'Año',
    'ao': 'año',
    'Cach\u01f8': 'Caché',
    'MENs': 'MENÚS',
    'L\u201cGICA': 'LÓGICA',
    'CACH%': 'CACHÉ',
    'CONFIGURACI\u201cN': 'CONFIGURACIÓN',
    'n\u01e7mero': 'número',
    'o\"': '✓'
}

def process_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        
        for bad, good in replacements.items():
            content = content.replace(bad, good)
            
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
    except Exception as e:
        print(f'Error processing {filepath}: {e}')

process_file('apps-script/Code.gs')
process_file('frontend/src/pages/Scanner.jsx')
process_file('frontend/src/pages/ConsultaPadres.jsx')
