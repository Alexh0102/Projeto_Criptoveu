# Deploy Seguro na Vercel

## 1. Subir para o GitHub

No terminal da raiz do projeto:

```bash
git init
git add .
git commit -m "feat: release inicial segura"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/cryptify.git
git push -u origin main
```

## 2. Importar na Vercel

1. Acesse a Vercel e entre com sua conta GitHub.
2. Clique em `Add New Project`.
3. Escolha o repositorio `cryptify`.
4. Revise as configuracoes de build:

- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm ci`

5. Clique em `Deploy`.

## 3. Endurecer a conta

No GitHub:

- ative `2FA`
- proteja a branch `main`
- ative `Dependabot`
- ative `Code scanning`
- ative `Secret scanning`

Na Vercel:

- ative `2FA`
- ative `Vercel Authentication` para previews
- use dominio com HTTPS

## 4. Pos-deploy

Depois do deploy:

1. abra o site publicado
2. confirme que a URL usa `https://`
3. teste upload, criptografia e descriptografia
4. valide os headers de seguranca no navegador ou em servicos como Mozilla Observatory

## 5. O que nao fazer

- nao colocar segredos em variaveis `VITE_*`
- nao commitar `.env` com credenciais
- nao desabilitar os headers de seguranca sem revisar o impacto
- nao publicar preview aberto se houver funcionalidade sensivel no futuro
