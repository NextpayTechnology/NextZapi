# @impzapp/wa-core

**Fork interno** do [WhiskeySockets/Baileys](https://github.com/WhiskeySockets/Baileys)
— biblioteca de baixo nível para o protocolo WhatsApp Multi-Device.

> ⚠️ **Não publicar em registry público.** Pacote privado do monorepo
> `imp-zapp`, consumido pelo backend via workspace.

## Por que fork

O Baileys oficial **remove periodicamente recursos que usamos em produção**
(botões interativos, CTAs, templates). Manter um fork controlado nos dá:

- Patches aplicados em horas, não em semanas de espera pelo mantenedor.
- Versão travada, sem surpresas de breaking change em `npm install`.
- Espaço para adicionar funcionalidades internas (telemetria, healthchecks).

Ver `UPSTREAM.md` para a versão-base e `PATCHES.md` para a lista de divergências
aplicadas.

## Como é consumido

O backend importa via `@impzapp/wa-core` (declarado em `backend/package.json`
como workspace `libs/*`). A camada `backend/src/wa-driver/baileys-driver.ts`
encapsula o uso — o resto do código não depende dessa lib diretamente, facilita
uma futura troca por `whatsmeow-driver.ts` (Go microservice) sem reescrita.

## Build

```bash
# dentro de backend/libs/wa-core
npm install        # instala deps da lib isolada
npm run build      # gera ./lib/ (saída transpilada)
```

O `prepare` do pacote garante que `wa-core` seja buildada quando alguém roda
`npm install` na raiz do backend.

## Upgrade de versão upstream

Seguir o procedimento documentado em `UPSTREAM.md`. TL;DR: baixar nova tarball,
limpar metadados, reaplicar `package.json` nosso, reaplicar patches de
`PATCHES.md`, atualizar tabela de versão.

## Licença

MIT — herdada do upstream. Ver `LICENSE`.
