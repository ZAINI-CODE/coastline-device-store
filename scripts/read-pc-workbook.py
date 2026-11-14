import json, zipfile, xml.etree.ElementTree as ET
from pathlib import Path
source=Path(r'C:\Users\Administrator\OneDrive\Documents\Phone Dataset\data of pcs ecel file\pcs details.xlsx')
ns={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
with zipfile.ZipFile(source) as z:
    strings=[]
    if 'xl/sharedStrings.xml' in z.namelist():
        strings=[''.join(x.itertext()) for x in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si',ns)]
    sheets=[]
    for name in z.namelist():
        if name.startswith('xl/worksheets/sheet') and name.endswith('.xml'):
            rows=[]
            for row in ET.fromstring(z.read(name)).findall('m:sheetData/m:row',ns):
                cells={}
                for cell in row.findall('m:c',ns):
                    value=cell.find('m:v',ns)
                    text=value.text if value is not None else ''
                    if cell.get('t')=='s': text=strings[int(text)]
                    elif cell.get('t')=='inlineStr': text=''.join(cell.find('m:is',ns).itertext())
                    if text: cells[cell.get('r')]=text
                if cells: rows.append(cells)
            sheets.append({'sheet_file':name,'rows':rows})
    result={'source_file':source.name,'sheets':sheets}
    Path('data/pc-workbook-source.json').write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    print(json.dumps(result,ensure_ascii=False))
