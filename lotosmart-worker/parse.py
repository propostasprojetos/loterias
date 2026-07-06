import re
with open('logged_in.html', 'r', encoding='utf-8') as f:
    text = f.read()

matches = re.findall(r'<[a-z]+[^>]*>([^<]{1,40})</[a-z]+>', text)
for match in matches:
    m = match.strip()
    if not m: continue
    if any(kw in m.lower() for kw in ['sair', 'conta', 'olá', 'ola', 'bem', 'acessar', 'login', 'perfil']):
        print(f"Found match: {m}")
