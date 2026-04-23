# Context — Mantenedor do NextZapi

> Se você é Claude lendo este arquivo, você está num **fork interno** do
> Baileys mantido pela **NextpayTechnology**. Este documento é o contexto
> acumulado entre sessões — **leia até o fim antes de executar nada**.

## O que é este pacote

Fork privado de [WhiskeySockets/Baileys](https://github.com/WhiskeySockets/Baileys)
— biblioteca Node para WhatsApp Multi-Device.

- **Versão-base:** `v6.7.21` (commit `15b6247ccf7dabd9d4db9ae055121170881f8ea1`)
- **Nome do pacote:** `nextzapi` (privado, não publicar em npm público)
- **Instalação prevista:** `git+https://github.com/NextpayTechnology/NextZapi.git#main`
  (quando o repo separado for criado)
- **Formato do output:** CommonJS (o backend que consome é CJS)

Existe por um motivo único: **o Baileys upstream removeu recursos de
mensagens ricas (botões, listas, templates) que precisamos em produção.**
Whaileys mantinha mas ficou defasado / instável. Este fork nos dá
controle — patchamos em horas, não em semanas de espera.

## Arquitetura geral

```
nextzapi/
├── src/              ← fonte TypeScript (fork do Baileys)
│   ├── Socket/       ← socket.ts, messages-send.ts, messages-recv.ts, chats.ts, groups.ts…
│   ├── Utils/        ← messages.ts (core), reporting-utils.ts (NOSSO), crypto.ts, generics.ts…
│   ├── Types/        ← Message.ts, Socket.ts
│   ├── Signal/       ← libsignal.ts, Group/
│   ├── WAUSync/      ← user sync protocols
│   ├── Defaults/     ← defaults do SocketConfig (incluso patch de botões)
│   ├── WAM/          ← analytics
│   ├── WABinary/     ← XML-like binary nodes
│   ├── typings/      ← baileys-patches.d.ts (declarações extras)
│   └── index.ts
├── WAProto/          ← proto gerado (index.js é CJS, PATCHEADO)
├── proto-extract/    ← ferramenta pra regenerar proto
├── lib/              ← output do build (gitignored)
├── package.json
├── tsconfig.json     ← module: CommonJS (NÃO MUDAR)
├── tsconfig.build.json
├── UPSTREAM.md       ← versão base + como atualizar
├── PATCHES.md        ← changelog cronológico dos diffs (LEIA!)
└── LICENSE
```

## Os 7 patches aplicados — conhecimento necessário pra não quebrar

**Sempre atualize `PATCHES.md` quando adicionar novo patch.**

### PATCH-001 — Build verde (Node 20+)
- `src/typings/baileys-patches.d.ts` — declara `libsignal`, `link-preview-js`,
  augment `jimp`
- `src/Utils/crypto.ts` — casts `as unknown as BufferSource` em
  `subtle.importKey` / `deriveBits` (Node 20 tipa Uint8Array com ArrayBufferLike)
- `src/Defaults/index.ts` + `src/Utils/generics.ts` — removido
  `with { type: 'json' }` (exige ESNext), usa `resolveJsonModule`
- `tsconfig.build.json` — **CommonJS** (não ESNext)
- `WAProto/index.js` — convertido de ESM pra CJS manualmente

### PATCH-002 — Tipos de botões (Types/Message.ts)
Adiciona types `Buttonable`, `Templatable`, `Listable` e aplica como mixin
em `AnyMediaMessageContent` e `AnyRegularMessageContent`.

### PATCH-003 — Lógica de envio de botões (Utils/messages.ts)
No `generateWAMessageContent`, antes do `viewOnce`:
- `buttons` → `proto.buttonsMessage` com `headerType` inferido
- `templateButtons` → `proto.templateMessage.fourRowTemplate`
- `sections` → `proto.listMessage`

### PATCH-004 — Branch `interactiveMessage` em generateWAMessageContent
O upstream removeu. Sem este patch, envio com
`{ interactiveMessage: {...} }` caía no `else` final → `prepareWAMessageMedia`
→ `Boom('Invalid media type')`. **Um elif salvou.**

### PATCH-005 — **CRÍTICO** — Reporting token (Utils/reporting-utils.ts)
Arquivo novo, portado na íntegra de `whaileys/Utils/reporting-utils.js`.
Implementa `shouldIncludeReportingToken` + `getMessageReportingToken`
(HMAC-SHA256 sobre campos específicos do proto encodado).

Aplicado em 2 lugares:
1. `Utils/messages.ts` final do `generateWAMessageContent`:
   adiciona `messageContextInfo.messageSecret = randomBytes(32)`
2. `Socket/messages-send.ts` antes de `sendNode(stanza)`:
   anexa `<reporting>` binary node ao stanza

**Sem este patch, botões são ACEITOS pelo WhatsApp mas DESCARTADOS.**
Sintoma: "✓ enviado" no app remetente, nada chega no destinatário. Este
foi o bug mais caro de diagnosticar.

### PATCH-006 — documentWithCaption hack (Defaults/index.ts)
Default de `patchMessageBeforeSending` agora usa `patchMessageForMdIfRequired`
(nova export em `Utils/messages.ts`). Quando a mensagem tem
`buttonsMessage` / `listMessage` / `interactiveMessage`, envelopa inteiro
em:
```js
{ documentWithCaptionMessage: { message: {...originalMessage} } }
```
Hack da comunidade — o WhatsApp trata como envio de documento com caption
e entrega o conteúdo rico dentro. Original: `whaileys/Utils/messages.js:724-738`.

### PATCH-007 — `<biz>` binary node (Socket/messages-send.ts)
Sinaliza ao WhatsApp que o stanza é rico. Antes de `sendNode(stanza)`:
- `listMessage` → `<list type="product_list" v="2">`
- `buttonsMessage` / `interactiveMessage.nativeFlowMessage` →
  `<interactive type="native_flow" v="1"><native_flow v="9" name="mixed"/></interactive>`

**Os 7 patches SÃO a diferença entre "botões funcionam" e "não funcionam".
Cada um isoladamente não resolve — é a combinação.**

## Regras de ouro ao manter este fork

1. **Cada mudança de código vira uma entrada em `PATCHES.md`.** Formato:
   ID sequencial, título, data, arquivos, motivação, risco, origem.
2. **Nunca mexa em `src/` sem ler `PATCHES.md` primeiro** — tem coisas
   tipadas como hack que parecem erradas mas são de propósito.
3. **Build é CommonJS, não ESM.** Se ver alguém tentando voltar pra ESM,
   vai dar `ERR_REQUIRE_ESM` em produção (já aconteceu).
4. **`WAProto/index.js` foi convertido manualmente pra CJS.** Se regenerar
   com `npm run gen:protobuf`, o protobufjs produz ESM e quebra. Reaplicar:
   - linha 2: `import $protobuf from "protobufjs/minimal.js"` →
     `const $protobuf = require("protobufjs/minimal.js")`
   - linha 10: `export const proto` → `const proto`
   - final: `export { $root as default }` →
     `module.exports.proto = proto; module.exports.default = $root`
5. **Nunca exponha `"type": "module"` no package.json.** Foi o erro que
   quebrou produção (`ERR_REQUIRE_ESM`).
6. **Atualizar versão-base do Baileys:** procedimento completo em `UPSTREAM.md`.
   TL;DR: baixa nova tarball, diff contra atual, reaplica cada patch de
   `PATCHES.md` manualmente, roda build + testes E2E.

## Como testar localmente

```bash
# Build
npm install
npm run build
# → gera lib/ em CJS

# Sanity check
node -e "const m = require('./lib'); console.log(Object.keys(m).slice(0, 10))"
# Deve imprimir: makeWASocket, proto, Browsers, DisconnectReason, useMultiFileAuthState...

# Ver se proto tem os tipos ricos
node -e "console.log(typeof require('./lib').proto.Message.ButtonsMessage)"
# → function
```

## Status da migração pra repo próprio

O código nasceu dentro de um monorepo consumidor (histórico). Foi
extraído para esta pasta standalone e rebrandado como `nextzapi` —
agora vive como repositório próprio.

Estado atual:
- ✅ Código extraído pra `/Users/higorlacerda/Desktop/nextwa/` (repo local)
- ✅ Todos os 7 patches aplicados e testados em produção (Dokploy)
- ✅ `package.json` renomeado pra `nextzapi`, removido `private: true`,
  adicionado `"prepare": "npm run build"` (faz o consumer buildar
  automaticamente via git-dep)
- ✅ `README.md` reescrito em pt-br com guia de uso completo, rebrandado
- ✅ `example.js` criado pra teste end-to-end (QR + echo + botões)
- ✅ Primeiro commit local (`feat: bootstrap do fork nextzapi standalone`)
- ⏳ Repo GitHub `NextpayTechnology/NextZapi` **ainda não criado**
  (usuário vai fazer manualmente e dar push)
- ⏳ Consumer downstream **ainda não ajustado** pra apontar pra
  `nextzapi` via git-dep (fica pra depois)

## Commits relevantes

```
8f06d63  feat: bootstrap do fork nextzapi standalone (neste repo)
```

Commits históricos (pré-extração) que originaram este fork, conforme
apareciam no monorepo consumidor antes do rebrand:
```
20551b6  fix: WAProto/index.js em CommonJS
264f4f3  fix: compilar como CommonJS para compat com backend
935765c  update (Dockerfile + nixpacks + build script)
d1966f5  feat: fork interno + driver abstrato
```

## Consumer (quem depende deste pacote)

O consumidor atual é o backend interno da NextpayTechnology, na camada
`backend/src/wa-driver/`. **Isso não deve mudar no curto prazo** —
este fork é pra consumo interno.

## Links úteis

- `PATCHES.md` — changelog cronológico (autoridade sobre o que mudou)
- `UPSTREAM.md` — versão do Baileys-base + como atualizar
- `README.md` — visão geral do pacote
- [Baileys upstream](https://github.com/WhiskeySockets/Baileys)
- [Whaileys (referência pra patches antigos)](https://www.npmjs.com/package/whaileys)
