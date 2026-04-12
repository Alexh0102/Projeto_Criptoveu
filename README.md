# Criptoveu

Site publico de criptografia e descriptografia de arquivos 100% client-side, inspirado no ecossistema `.crypt15` do WhatsApp para demonstrar seguranca real no navegador com React + TypeScript + Web Crypto API.

Link do site: `https://www.xn--criptovu-h1a.com/`

## Stack

- React 18 + Vite + TypeScript
- Tailwind CSS
- `lucide-react`
- Web Crypto API nativa do navegador
- AES-256-GCM + PBKDF2 com 600.000 iteracoes

## Requisitos Funcionais

| ID | Descricao |
| --- | --- |
| RF01 | Interface responsiva com duas abas: `Criptografar` e `Descriptografar` |
| RF02 | Upload de arquivo unico por drag and drop ou botao `Escolher arquivo` |
| RF03 | Exibicao do nome e do tamanho do arquivo selecionado |
| RF04 | Campo de senha com botao `Modo WhatsApp` que gera chave aleatoria de 64 caracteres hex |
| RF05 | Medidor visual de forca da senha com 5 niveis |
| RF06 | Botao principal para criptografar ou descriptografar |
| RF07 | Barra de progresso durante o processamento |
| RF08 | Mensagens claras de sucesso, erro e status |
| RF09 | Download automatico e botao para baixar o arquivo processado |
| RF10 | Footer explicativo: `100% no navegador - Nada sai do dispositivo` |
| RF11 | Copia da senha ou chave com um clique |

## Requisitos Nao Funcionais

| ID | Descricao |
| --- | --- |
| RNF01 | 100% client-side, sem servidor e sem envio de dados |
| RNF02 | Design moderno, dark mode e responsivo com foco em mobile |
| RNF03 | Tempo de processamento aceitavel para arquivos de ate 500 MB |
| RNF04 | Codigo limpo, tipado em TypeScript e comentado quando necessario |
| RNF05 | Acessibilidade basica com labels, foco visivel e contraste adequado |
| RNF06 | Deploy facil em Vercel ou Netlify |
| RNF07 | Performance com Web Crypto API nativa |

## Requisitos Tecnicos

- Formato proprio: cabecalho `CRIPTIFY1` + `salt` + `IV` + payload criptografado
- Compatibilidade alvo: Chrome, Edge e Firefox
- Safari: limite pratico aproximado de 2 GB
- Senha nunca e armazenada
- Chave derivada localmente com PBKDF2
- `salt` e `IV` gerados aleatoriamente por arquivo
- Erro claro para senha incorreta ou arquivo invalido
- Banner de destaque: `Seus arquivos nunca saem do navegador`

## Como rodar

```bash
npm install
npm run dev
```

## Build de producao

```bash
npm run build
```

## Build endurecida

```bash
npm run build:secure
```

Esta variante faz o build normal e aplica ofuscacao no bundle final em `dist/assets`.

## Hardening aplicado

- `CSP`, `COOP`, `COEP`, `CORP`, `HSTS`, `Referrer-Policy`, `Permissions-Policy` e demais headers em `vercel.json` e `netlify.toml`
- Sem `sourcemap` em producao
- Minificacao de bundle e remocao de `console` e `debugger` no build
- Ofuscacao opcional com `javascript-obfuscator`
- Fontes externas removidas para permitir `style-src 'self'` e `font-src 'self'`
- Validacao de contexto seguro: o app bloqueia processamento fora de `HTTPS` ou `localhost`
- Limite de arquivo de `500 MB` para reduzir risco de travamento e consumo excessivo de memoria

## Limite importante

Nao existe forma de esconder 100% o codigo de um site client-side. O navegador sempre recebe JavaScript executavel. O que da para fazer e:

- dificultar engenharia reversa com minificacao e ofuscacao
- remover `sourcemaps`
- bloquear segredos no frontend
- endurecer headers e politicas do navegador

