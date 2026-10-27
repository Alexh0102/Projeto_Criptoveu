> 🌐 **English Version Available:** [Read README in English](README.md)

---

# CriptoVéu

CriptoVéu é uma aplicação web pública e open source para proteger arquivos, mensagens, QR Codes, links, imagens com esteganografia e notas diretamente no navegador.

O projeto foi construído com foco em privacidade: arquivos, senhas, mensagens e notas são processados no dispositivo do usuário, sem upload de dados sensíveis para servidores da aplicação.

**Site em produção:** https://www.criptoveu.com/

**Repositório:** https://github.com/Alexh0102/Projeto_Criptoveu

**Aplicativo Android:** [Baixar o APK mais recente](https://github.com/Alexh0102/Projeto_Criptoveu/releases/latest/download/CriptoVeu.apk)

> Aviso importante: o CriptoVéu não deve ser interpretado como uma solução “100% segura” ou como substituto para auditoria criptográfica formal. A segurança final depende da senha escolhida, do dispositivo, do navegador, da integridade do código JavaScript entregue ao usuário e do ambiente de execução.

---

## Resumo

O objetivo do CriptoVéu é oferecer ferramentas simples para criptografia, descriptografia e compartilhamento protegido de conteúdo em um ambiente **100% client-side**.

A aplicação usa a **Web Crypto API** nativa do navegador para realizar criptografia autenticada com **AES-GCM**. Novos arquivos, mensagens, QR Codes, links protegidos e cofres VéuNotes usam **Argon2id em WebAssembly**, executado dentro de um **Web Worker**. Formatos V1 anteriores com PBKDF2/SHA-256 continuam aceitos para leitura.

Principais recursos:

- Criptografia e descriptografia de arquivos locais.
- Processamento por blocos para arquivos grandes.
- Paridade XOR recuperável para um ciphertext danificado por grupo (V6).
- Pré-visualização local de arquivos descriptografados, quando o navegador oferece suporte, incluindo player avançado de vídeo.
- Geração de chave longa no estilo usado por formatos como `.crypt15`.
- QR Code protegido por senha.
- Link protegido com expiração embutida no payload e limite de visualizações controlado localmente no navegador.
- Esteganografia para esconder mensagens protegidas dentro de imagens.
- VéuNotes, um cofre portátil de várias notas criptografadas.
- Diagnóstico local do navegador para avaliar HTTPS, Web Crypto, WebAssembly, Workers e perfis Argon2id.
- PWA com service worker para cache controlado do shell da aplicação.

---

## Ferramentas disponíveis

| Rota | Ferramenta | Descrição |
|---|---|---|
| `/arquivos` | Criptografia de arquivos | Protege ou descriptografa arquivos locais usando senha. |
| `/qr-secreto` | QR protegido | Cria e lê QR Codes com mensagens criptografadas. |
| `/link-secreto` | Link protegido | Gera links com mensagem criptografada no hash da URL. |
| `/esteganografia` | Mensagem oculta | Esconde ou revela mensagens protegidas em imagens. |
| `/veu-notes` | VéuNotes | Organiza várias notas em um cofre local exportável como `.criptoveu-note`. |
| `/diagnostico-navegador` | Diagnóstico do navegador | Verifica compatibilidade local e recomenda perfis de RAM para Argon2id. |
| `/seguranca` | Segurança | Explica o modelo de segurança adotado pelo projeto. |
| `/detalhes-tecnicos` | Detalhes técnicos | Apresenta informações técnicas da implementação. |

---

## Tecnologias

- React 18 com TypeScript.
- Vite 7 para desenvolvimento, build e preview.
- React Router DOM para navegação client-side.
- Tailwind CSS e PostCSS para estilização.
- lucide-react para ícones.
- Web Crypto API nativa do navegador.
- hash-wasm para Argon2id em WebAssembly, executado em Web Worker.
- OPFS para criptografia e descriptografia em um Web Worker dedicado quando `createSyncAccessHandle` está disponível.
- Processamento por blocos de 2 MB com manifesto de integridade SHA-256 cifrado (V4/V5/V6).
- Pré-visualizações de mídia locais usam URLs de objeto a partir do arquivo recuperado, sem conversão para Base64 ou carregamento do arquivo inteiro em `ArrayBuffer`.
- qrcode para geração de QR Code.
- jsqr para leitura de QR Code em imagens.
- Service Worker e Web App Manifest para experiência PWA.
- ESLint com regras para React Hooks, React Refresh e TypeScript.

---

## Criptografia por ferramenta

| Ferramenta | Criptografia | Derivação de chave | Armazenamento / saída |
|---|---|---|---|
| Arquivos V5 com proteção dupla | AES-256-GCM + manifesto SHA-256 cifrado | SHA-256 de senha + arquivo-chave, seguido de Argon2id | Arquivo `.criptoveu` |
| Arquivos V6 com paridade recuperável | AES-256-GCM + manifesto SHA-256 cifrado + paridade XOR local | Argon2id v1.3 via WASM em Web Worker | Arquivo `.criptoveu` |
| Arquivos V4 | AES-256-GCM + manifesto SHA-256 cifrado | Argon2id v1.3 via WASM em Web Worker | Arquivo `.criptoveu` |
| Arquivos legados | AES-GCM | Argon2id no `CRIPTOVEU3`; PBKDF2/SHA-256 nos anteriores | Pacotes `CRIPTOVEU3`, `CRIPTOVEU2`, `CRIPTIFY2` e `CRIPTIFY1` |
| Mensagens `MSG2` | AES-256-GCM | Argon2id, 64 MB, `t=2`, `p=1` | Payload `CVM2` |
| QR protegido `QR2` | AES-256-GCM | Argon2id, 64 MB, `t=2`, `p=1` | Payload `CVQ2` no hash da URL |
| Link protegido `LINK2` | AES-256-GCM | Argon2id, 64 MB, `t=2`, `p=1` | Payload `CVL2` no hash da URL |
| Esteganografia | Mensagem `MSG2` protegida antes da ocultação | Argon2id, 64 MB, `t=2`, `p=1` | Imagem PNG com dados ocultos |
| VéuNotes `NOTE2` + `PORTABLE_VAULT1` | AES-256-GCM | Argon2id, 128 MB, `t=2`, `p=1` | `localStorage` e arquivo `.criptoveu-note` |
| Formatos V1 legados | AES-GCM | PBKDF2/SHA-256 | Leitura compatível; novas criações usam V2 |

---

## Como funciona

### Arquivos

A ferramenta de arquivos aceita múltiplos arquivos no modo de proteção e gera pacotes com extensão `.criptoveu`.

A criptografia e a descriptografia acontecem em blocos de até **2 MB**. Em navegadores com suporte a manipuladores síncronos do OPFS, o Web Worker dedicado grava cada registro diretamente em um arquivo temporário no OPFS, sem acumular o pacote ou o arquivo recuperado na RAM. O arquivo temporário é sincronizado, fechado, convertido em um snapshot `File` e removido depois que o resultado é entregue à aplicação.

O caminho OPFS remove o limite fixo anterior de 1 GB imposto pela aplicação. O limite prático passa a ser a quota de armazenamento disponível para o navegador, enquanto a memória permanece proporcional ao bloco ativo, aos dados de autenticação e ao perfil Argon2id selecionado, em vez de proporcional ao tamanho total do arquivo. Em navegadores sem a API OPFS necessária, o caminho alternativo continua disponível com uma proteção conservadora de 1 GB.

Formato atual dos pacotes V4/V5/V6:

```text
CRIPTOVEU[4|5|6] + ram_mb_ascii + passes_ascii + salt + iv_inicial
  + tamanho_bloco + quantidade_blocos
  + [tipo_dados + tamanho_ciphertext + ciphertext]...
  + [tipo_paridade + tamanho_paridade + paridade]... (somente V6, após cada grupo de até 4 blocos)
  + [tipo_manifesto + tamanho_ciphertext + manifesto_cifrado]
```

Estrutura do cabeçalho V4, V5 e V6:

```text
offset  tamanho   campo
0       10        assinatura: "CRIPTOVEU4", "CRIPTOVEU5" ou "CRIPTOVEU6"
10      4         RAM Argon2id em MB, ASCII decimal
14      4         passes Argon2id, ASCII decimal
18      16        salt
34      12        IV inicial
46      4         tamanho dos blocos em bytes
50      4         quantidade de blocos
54      ...       registros de dados e manifesto
```

Detalhes técnicos:

- Algoritmo: **AES-256-GCM**.
- Derivação de chave para novos arquivos: **Argon2id v1.3 via WASM em Web Worker**.
- Parâmetros Argon2id: `t=2`, `p=1`.
- Perfis de memória Argon2id: **64 MB**, **256 MB** por padrão ou **512 MB**.
- A seleção de memória fica em cache apenas para criar arquivos novos.
- O cabeçalho V4/V5/V6 registra RAM, passes, salt, IV inicial, tamanho de bloco e quantidade de blocos.
- A descriptografia lê os parâmetros diretamente do pacote; não depende de `localStorage`.
- Cada bloco tem até 2 MB.
- O cabeçalho fixo, tipo, índice e tamanho de cada registro entram no AAD para rejeitar alteração, reordenação e truncamento.
- O primeiro bloco usa o IV armazenado no cabeçalho.
- Os registros seguintes usam IVs exclusivos derivados do IV inicial e do índice; o manifesto usa o índice imediatamente posterior ao último bloco.
- No V6, cada grupo de até quatro blocos cifrados é seguido por um registro de paridade XOR. Um ciphertext de dados danificado por grupo pode ser reconstruído antes da verificação AES-GCM e SHA-256; vários blocos danificados ou a paridade danificada não podem ser recuperados.
- O **Escudo de Integridade** calcula SHA-256 do arquivo completo e de cada bloco em um Web Worker separado.
- O manifesto guarda nome original, tipo MIME, tamanho, hashes, algoritmos e parâmetros Argon2id. Ele é cifrado e autenticado como o último registro do pacote.
- Depois da recuperação, o navegador recalcula os hashes do conteúdo e só confirma a integridade quando todos coincidem.
- O diagnóstico sem senha valida apenas a estrutura do pacote e usa a expressão **estrutura plausível**. Autenticidade exige a senha correta.
- Cada resultado pode gerar um relatório JSON local com formato, KDF, parâmetros, contagem de blocos e estado da verificação.
- Compatibilidade de leitura com `CRIPTOVEU3`, `CRIPTOVEU2`, `CRIPTIFY2` e `CRIPTIFY1`.
- A paridade recuperável V6 não pode ser combinada com a proteção V5 por arquivo-chave; escolha um modo de proteção por pacote.
- Com OPFS, o limite prático é o armazenamento local disponível e a quota do navegador. O caminho alternativo fica limitado a **1 GB**.

No aplicativo Android com Capacitor, os resultados concluídos são exportados para `Download/` pelo plugin nativo Filesystem, uma fatia de 2 MB codificada em Base64 por vez. Em versões do Android que não permitem `ExternalStorage`, o gerenciador de downloads do WebView é usado como alternativa.

> Observação: o SHA-256 do manifesto complementa a autenticação AES-GCM e permite verificação explícita pós-recuperação. Ele não substitui AES-GCM nem torna uma estrutura sem senha “verificada”.

#### Proteção dupla com arquivo-chave

Quando a opção **Senha + arquivo-chave** é ativada, novos arquivos usam a
assinatura `CRIPTOVEU5`. O restante da estrutura de blocos, AAD e manifesto
segue o desenho autenticado do V4, mas a chave Argon2id depende dos dois
fatores.

O material da KDF é construído localmente desta forma:

```text
key_file_hash = SHA-256(bytes_exatos_do_arquivo_chave)
material = SHA-256(
  "CriptoVeu:password-key-file:v1"
  || 0x00
  || tamanho_da_senha_utf8_em_uint32_be
  || senha_utf8
  || key_file_hash
)
chave_aes = Argon2id(material_hex, salt_do_pacote, parâmetros_do_cabeçalho)
```

Regras de segurança:

- o arquivo-chave deve ter entre 1 byte e 32 MB;
- o nome do arquivo não participa da derivação; somente os bytes exatos;
- arquivo, nome, hash e material combinado **não são incorporados** ao pacote
  nem ao relatório;
- a assinatura V5 informa apenas que um arquivo-chave é obrigatório;
- o mesmo arquivo-chave pode ser renomeado, mas qualquer alteração em seus
  bytes impede a abertura;
- senha e arquivo-chave devem ser guardados e compartilhados separadamente;
- perder qualquer um dos dois fatores torna a recuperação impossível;
- um arquivo público ou previsível oferece pouco ganho contra um atacante que
  já tenha acesso a ele.

Pacotes sem arquivo-chave ou paridade recuperável são criados como `CRIPTOVEU4`
por padrão. A proteção por arquivo-chave cria `CRIPTOVEU5`, e a paridade
recuperável cria `CRIPTOVEU6`. A leitura de V4, V5, V6 e de todos os formatos
anteriores permanece compatível.

#### Paridade recuperável com `CRIPTOVEU6`

Quando o **Modo recuperável com paridade** é ativado, novos arquivos usam a assinatura `CRIPTOVEU6`. O pacote mantém o cabeçalho autenticado, o manifesto cifrado e a verificação SHA-256 do V4/V5/V6, acrescentando um registro de paridade XOR local após cada grupo de até quatro blocos cifrados. Se um ciphertext de dados de um grupo for danificado, mas os demais ciphertexts e a paridade permanecerem íntegros, a aplicação reconstrói o ciphertext e depois o valida com AES-GCM e os hashes finais do manifesto.

Paridade é redundância, não substitui criptografia nem backup. Ela não recupera dois blocos de dados danificados no mesmo grupo, um registro de paridade danificado, um registro excluído ou uma senha perdida. O modo não pode ser combinado com arquivo-chave e acrescenta aproximadamente 25% de espaço em grupos completos de quatro blocos.
---

### Pré-visualização de mídia descriptografada

As mídias descriptografadas são pré-visualizadas localmente a partir do `File`/`Blob` recuperado por meio de `URL.createObjectURL`. A prévia nunca converte a mídia para Base64 nem carrega o arquivo inteiro em um `ArrayBuffer` do JavaScript. A URL temporária é revogada quando a pré-visualização é fechada ou desmontada.

Os limites de criptografia/descriptografia de arquivos e de pré-visualização de vídeo são escolhidos conforme a plataforma em execução:

| Ambiente | Tamanho máximo total por lote |
|---|---:|
| Navegador desktop convencional (web) | **5 GB** |
| PWA (instalado, modo standalone) | **1 GB** |
| Capacitor Android/iOS ou navegador móvel com toque | **1 GB** |

As demais mídias mantêm os limites conservadores existentes: **100 MB** na web, **50 MB** no aplicativo nativo e **5 MB** para textos. Arquivos acima do limite aplicável continuam disponíveis para download, mas não são abertos no player do navegador.

O player de vídeo exibe aviso de carregamento e spinner até que os metadados ou a reprodução estejam disponíveis. Ele oferece timeline para busca, tempo decorrido/total, controles de recuo e avanço de 10 segundos, velocidades de **0,5x, 1,0x, 1,25x, 1,5x e 2,0x** e tela cheia nativa. No desktop, `Espaço` alterna reprodução/pausa, as setas esquerda e direita buscam 10 segundos e `F` alterna a tela cheia.

Se o navegador ou WebView não conseguir decodificar o formato ou codec do vídeo, o player é substituído por uma explicação e o usuário é orientado a baixar o arquivo descriptografado para reproduzi-lo no VLC ou no player nativo do dispositivo.

---

### Mensagens, QR Code e links protegidos

Mensagens são criptografadas localmente com AES-256-GCM e serializadas em payloads próprios do CriptoVéu. Novas criações usam Argon2id dentro de Web Worker:

- `CVM2.` / `MSG2` para mensagens protegidas e esteganografia;
- `CVQ2.` / `QR2` para QR protegido;
- `CVL2.` / `LINK2` para links protegidos;
- memória de **64 MB**, `t=2` e `p=1`;
- salt aleatório de 16 bytes e IV aleatório de 12 bytes;
- Base64URL para o envelope V2.

O QR protegido aponta para a rota `/qr-secreto` usando o hash da URL. O link protegido usa a rota `/link-secreto`, também com dados no hash da URL.

Importante:

- O hash da URL não é enviado ao servidor em requisições HTTP tradicionais.
- Quem recebe o link ou o QR Code tem acesso ao payload criptografado.
- A senha ou chave nunca é incluída no link ou no QR Code e deve ser compartilhada separadamente.
- A proteção real depende da senha usada para abrir a mensagem.
- Tipo, versão, KDF, parâmetros Argon2id e, no `LINK2`, criação, expiração e limite de visualizações entram no AAD do AES-GCM.
- Alterar ciphertext, IV, salt ou metadados autenticados faz a abertura falhar.
- Payloads V1 anteriores com **PBKDF2/SHA-256 e 600.000 iterações** continuam legíveis, mas não são mais gerados.

#### Gerador e medidor de credenciais

Os fluxos de criação de arquivos, links, QR Codes e VéuNotes compartilham um
painel local de segurança com três opções:

- frase-senha com oito palavras escolhidas sem repetição e sufixo numérico;
- senha aleatória de 24 caracteres com letras, números e símbolos;
- chave máxima com **32 bytes aleatórios**, exibida como 64 caracteres
  hexadecimais, totalizando **256 bits**.

Toda escolha aleatória usa `crypto.getRandomValues`, com rejeição de valores
para evitar viés de módulo. Não há `Math.random`, biblioteca externa, API,
telemetria ou persistência da credencial.

O medidor de valores digitados manualmente é deliberadamente heurístico. Ele
considera comprimento e variedade, mas também penaliza palavras comuns,
sequências, repetições, anos, baixa diversidade, o nome do projeto e senhas
curtas mascaradas por símbolos. Sua classificação orienta o usuário, mas não é
uma prova matemática de entropia.

Quando o próprio CriptoVéu gera a credencial, a interface identifica a
aleatoriedade conhecida do processo separadamente da estimativa humana. A
credencial pode ser revelada e copiada localmente, nunca é armazenada e, em
links ou QR Codes, nunca entra no payload compartilhado.

#### Sobre expiração e limite de visualizações

Como o CriptoVéu não usa banco de dados para controlar estado global, o limite de visualizações do link protegido é controlado localmente pelo navegador que abre o link.

Isso significa que:

- o limite pode funcionar como proteção local contra reabertura no mesmo navegador;
- não impede que o mesmo payload seja aberto em outro navegador, outro dispositivo ou outra cópia do link;
- não deve ser tratado como visualização única global garantida por servidor.

---

### Esteganografia

A ferramenta de esteganografia usa imagem local, canvas do navegador e técnica LSB nos canais RGB para inserir uma mensagem protegida.

A saída é uma imagem PNG contendo os dados ocultos. A mensagem deve ser protegida por senha antes de ser escondida.

Limites aplicados:

- Imagem de entrada com até **10 MB**.
- Resolução máxima de **20 milhões de pixels**.
- Validação de capacidade da imagem antes de gravar a mensagem.

---

### VéuNotes

O VéuNotes organiza várias notas em um cofre criptografado no `localStorage` e
permite exportar o mesmo conteúdo como um arquivo portátil
`.criptoveu-note`. Títulos, textos, etiquetas e identificadores ficam dentro
do ciphertext; a busca só acontece localmente depois do desbloqueio.

O envelope é criptografado com AES-256-GCM e protegido por senha mestre. Cofres
no modo padrão usam `NOTE2` por fora; o **Modo recuperável com paridade** usa
`NOTE3`. Ambos contêm o documento autenticado `PORTABLE_VAULT1` por dentro.

Parâmetros principais:

- Senha mínima: **12 caracteres**.
- Argon2id em Web Worker com **128 MB**, `t=2` e `p=1`.
- O modo padrão armazena um ciphertext autenticado no `NOTE2`.
- O modo recuperável armazena dois ciphertexts autenticados com IVs independentes e um valor de paridade XOR no `NOTE3`. Um ciphertext danificado pode ser reconstruído se o outro ciphertext e a paridade permanecerem íntegros; o plaintext resultante ainda precisa passar pela autenticação AES-GCM e pela validação do cofre.
- O modo recuperável torna o envelope cifrado aproximadamente três vezes maior e não recupera dois ciphertexts danificados, paridade danificada ou senha perdida.
- Tipo, versão e parâmetros da KDF são autenticados como AAD.
- Até **500 notas**, com títulos, conteúdo e até 12 etiquetas por nota.
- Busca local por título, texto ou etiqueta somente durante a sessão aberta.
- Bloqueio automático por inatividade ou permanência da aba em segundo plano.
- Troca de senha com confirmação da senha atual e novo salt Argon2id.
- Exportação em `.criptoveu-note`; backups JSON antigos continuam aceitos.
- Cofres `NOTE1` com PBKDF2 continuam legíveis.
- Cofres `NOTE2` e `NOTE3` continuam legíveis, e o modo de recuperação pode ser alternado depois do desbloqueio.
- Depois de uma abertura legada bem-sucedida, a nota única é convertida em uma
  nota do cofre portátil e recriptografada como `NOTE2`; o blob antigo só é
  substituído após a nova criptografia terminar.
- A importação valida tamanho, campos permitidos, limites e autenticação
  AES-GCM antes de substituir o cofre local.

O arquivo portátil não contém a senha e não oferece recuperação sem ela.
Backups exportados antes de uma troca de senha continuam protegidos pela senha
antiga.

---

## Testes e vetores públicos

Os diretórios em `test-vectors/` contêm vetores reproduzíveis para `MSG2`,
`QR2`, `LINK2` e `NOTE2`, incluindo senha de teste, salt, IV, AAD e ciphertext
esperado.

Salt e IV fixos existem apenas nesses vetores. A produção sempre usa
`crypto.getRandomValues`.

A suíte automatizada verifica compatibilidade V1, migração de `NOTE1`, recuperação
de paridade `NOTE3`, senha incorreta, payload truncado e adulterações de
ciphertext, IV, salt, tipo, versão, KDF, parâmetros Argon2id, expiração e limite.
Os testes de arquivos também cobrem a recuperação `CRIPTOVEU6` de um bloco de
dados danificado e a rejeição quando a paridade não consegue recuperar o grupo.

Os testes do gerador verificam o tamanho real da chave de 256 bits, as classes
da senha aleatória, a estrutura da frase-senha, unicidade amostral, uso de Web
Crypto e detecção de padrões fracos.

> Atenção: o `localStorage` pertence ao navegador atual e pode ser apagado pelo usuário, pelo sistema, por extensões, por limpeza de dados ou por políticas do navegador. Faça backup quando necessário.

---

## Modelo de ameaça

O CriptoVéu foi projetado para reduzir a exposição de dados sensíveis em ferramentas web, mantendo arquivos, mensagens, notas e senhas no dispositivo do usuário sempre que possível.

### O que o projeto busca proteger

- Conteúdo de arquivos, mensagens e notas contra leitura sem a senha correta.
- Dados sensíveis contra upload para servidores da aplicação.
- Pacotes criptografados contra alterações, truncamentos e corrupção, usando autenticação do AES-GCM.
- Ataques offline contra novos pacotes de arquivos, tornando tentativas de senha mais custosas com Argon2id e uso explícito de memória.
- Exposição acidental de payloads em links e QR Codes, desde que a senha tenha entropia suficiente.

### O que está fora do escopo

- Dispositivos comprometidos por malware, keylogger, screen recorder ou extensão maliciosa.
- Senhas fracas, reutilizadas ou compartilhadas por canais inseguros.
- Arquivos-chave públicos, previsíveis, perdidos ou copiados junto do pacote e da senha.
- Comprometimento do domínio, pipeline de build, provedor de hospedagem, conta de deploy ou JavaScript servido ao navegador.
- Phishing com cópias falsas da aplicação.
- Recuperação de conteúdo quando a senha é perdida.
- Garantia global de expiração ou visualização única em links, já que não há banco de dados ou servidor controlando estado global.
- Proteção contra todos os modelos futuros de computação quântica.

### Premissas de segurança

- O usuário acessa o domínio oficial via HTTPS.
- O navegador implementa corretamente a Web Crypto API.
- O código JavaScript entregue ao usuário é íntegro.
- O usuário escolhe senhas fortes e únicas.
- O dispositivo do usuário não está comprometido.

---

## Nível de segurança

O CriptoVéu adota um modelo de segurança forte para uma aplicação client-side, mas é importante entender seus limites.

A segurança depende principalmente de:

- força da senha escolhida pelo usuário;
- integridade do código JavaScript servido pelo domínio oficial;
- uso de HTTPS ou localhost, exigido para acesso seguro à Web Crypto API;
- ausência de envio de dados sensíveis para servidores da aplicação;
- segurança do dispositivo e do navegador do usuário.

Medidas implementadas:

- Processamento local para arquivos, mensagens e notas.
- Senhas não são armazenadas pela aplicação.
- Chaves criptográficas são derivadas no navegador.
- Novos pacotes de arquivos usam Argon2id com custo de memória explícito no próprio cabeçalho.
- AES-GCM fornece confidencialidade e autenticação do conteúdo.
- `salt` e `iv` são gerados com `crypto.getRandomValues`.
- Bloqueio de processamento fora de contexto seguro, como páginas sem HTTPS.
- Validação de tamanho para arquivos, imagens, QR Codes e backups.
- Tratamento de erro para senha incorreta, arquivo inválido e payload corrompido.
- Pré-visualização local usando URLs temporárias criadas no navegador.

Headers e políticas de hardening configurados em `vercel.json` e `netlify.toml`:

- Content-Security-Policy restritiva.
- Strict-Transport-Security.
- Cross-Origin-Opener-Policy.
- Cross-Origin-Embedder-Policy.
- Cross-Origin-Resource-Policy.
- Referrer-Policy: `no-referrer`.
- Permissions-Policy com recursos sensíveis desabilitados.
- X-Frame-Options: `DENY`.
- X-Content-Type-Options: `nosniff`.
- `frame-ancestors 'none'`.
- `object-src 'none'`.
- Cache conservador para HTML e cache longo para assets versionados.

Hardening de build:

- Build de produção sem sourcemaps.
- Minificação com esbuild.
- Remoção de `console` e `debugger` no build.
- Target moderno `es2022`.

---

## Limitações importantes

Nenhuma aplicação web client-side consegue esconder totalmente o próprio código, porque o navegador precisa receber JavaScript executável. Por isso, o projeto evita depender de segredo embutido no frontend.

O CriptoVéu não deve ser entendido como substituto para auditoria criptográfica formal. Ele usa primitivas sólidas do navegador, mas a proteção final ainda depende da senha, do dispositivo, do navegador e da integridade do deploy.

Argon2id dificulta ataques de força bruta paralela ao exigir memória por tentativa. AES-256 é considerado uma escolha prudente diante de modelos quânticos conhecidos, mas o projeto não afirma resistência quântica absoluta. Senhas com pouca entropia continuam vulneráveis a adivinhação.

Também é importante lembrar:

- Se a senha for perdida, o conteúdo não poderá ser recuperado.
- Links e QR Codes carregam o payload criptografado; compartilhe apenas com pessoas autorizadas.
- O limite de visualizações do link protegido é controlado localmente pelo navegador que abre o link.
- O `localStorage` do VéuNotes pertence ao navegador atual e pode ser apagado pelo usuário, pelo sistema ou por políticas do navegador.
- O projeto não usa, atualmente, KEMs pós-quânticos para troca de chaves entre usuários. Ferramentas baseadas em senha dependem principalmente da entropia da senha e do custo da KDF.

---

## Auditoria e contribuições de segurança

Este projeto é open source e revisões de segurança são bem-vindas.

Áreas especialmente importantes para revisão:

- uso correto de AES-GCM e IVs únicos;
- geração de `salt` e `iv` com `crypto.getRandomValues`;
- derivação de chave com Argon2id e PBKDF2;
- validação de payloads, cabeçalhos e tamanhos;
- autenticação de dados adicionais, especialmente nos blocos de arquivos;
- segurança do Service Worker e política de cache;
- CSP e headers de segurança;
- riscos de XSS e manipulação de DOM;
- segurança do `localStorage` no VéuNotes;
- compatibilidade e segurança dos formatos legados.

Para reportar vulnerabilidades ou discutir melhorias de segurança, consulte o arquivo [`SECURITY.md`](SECURITY.md) do repositório.

---

## Roadmap

Ideias e melhorias futuras planejadas ou em estudo:

- [ ] Chat criptografado efêmero sem banco de dados.
- [ ] Pareamento por ID temporário de sala.
- [ ] Transporte por WebSocket ou WebRTC DataChannel.
- [ ] Criptografia ponta a ponta no navegador.
- [ ] Troca de chaves híbrida clássica/pós-quântica para o chat.
- [ ] Verificação manual de fingerprint da sessão.
- [x] Migração de mensagens, QR Codes, links e VéuNotes para Argon2id, mantendo leitura dos payloads V1.
- [x] Escudo de Integridade para arquivos com `CRIPTOVEU4`, manifesto cifrado, verificação pós-recuperação, inspetor estrutural e relatório local.
- [x] Gerador local de frase, senha e chave de 256 bits, com medidor heurístico e avisos de padrões fracos.
- [x] Proteção dupla de arquivos com senha + arquivo-chave no formato `CRIPTOVEU5`.
- [x] Pacotes de arquivos recuperáveis com paridade XOR local no `CRIPTOVEU6`.
- [x] Cofre portátil VéuNotes com várias notas, etiquetas, busca local, troca de senha e arquivo `.criptoveu-note`.
- [x] Envelopes VéuNotes recuperáveis com paridade XOR no `NOTE3`.
- [x] Diagnóstico do navegador com verificação local de APIs críticas e recomendação conservadora de perfis Argon2id.

> Observação sobre o futuro chat: mesmo sem armazenar mensagens, um servidor de sinalização ou relay poderá observar metadados como IP, horário, duração da sessão e tamanho aproximado dos pacotes. Isso deve ser documentado claramente quando o recurso for implementado.

---

## Requisitos

- Node.js compatível com Vite 7.
- npm.
- Navegador moderno com suporte a Web Crypto API, Streams, Canvas e Service Worker.
- HTTPS em produção.

Navegadores-alvo:

- Google Chrome.
- Microsoft Edge.
- Mozilla Firefox.
- Safari moderno, respeitando limites práticos de memória do navegador.

---

## Como rodar localmente

Instale as dependências:

```bash
npm install
```

Inicie o servidor de desenvolvimento:

```bash
npm run dev
```

Gere o build de produção:

```bash
npm run build
```

Teste o build local:

```bash
npm run preview
```

Execute a análise estática:

```bash
npm run lint
```

---

## Deploy

O projeto está preparado para deploy em Vercel e Netlify.

Configuração esperada:

- Build command: `npm run build`.
- Install command: `npm ci`.
- Output directory: `dist`.
- Rewrites para rotas SPA apontando para `index.html`.
- Headers de segurança aplicados na borda da plataforma.

Após o deploy, valide:

- HTTPS ativo.
- Headers de segurança presentes.
- Criptografia e descriptografia de arquivos.
- Geração e leitura de QR protegido.
- Link protegido.
- Esteganografia.
- VéuNotes.
- Diagnóstico do navegador.
- Funcionamento do PWA.

---

## Estrutura do projeto

```text
src/
  components/          Componentes reutilizáveis da interface
  components/file-crypto/
                       Área de criptografia, download e pré-visualização
  config/              Definições das ferramentas exibidas no site
  context/             Tema e provedores globais
  hooks/               Hooks de processamento, QR e inatividade
  lib/                 Criptografia, payloads, esteganografia e storage
  pages/               Páginas e rotas principais

public/
  service-worker.js    Service worker do PWA
  site.webmanifest     Manifesto da aplicação
```

---

## Licença

Distribuído sob a licença MIT. Consulte o arquivo [`LICENSE`](LICENSE) para mais detalhes.
