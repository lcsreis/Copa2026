# ⚽ Copa 2026 — Figurinhas Repetidas

Site simples e estático para visualizar e compartilhar quais figurinhas do álbum
Panini Copa 2026 você tem **repetidas** (para troca). Sem banco de dados: os dados
ficam num único arquivo [`data.json`](data.json).

Álbum: **998 figurinhas** — 48 seleções × 20 + FWC1–20 + Extra (REGU/BRON/PRAT/OURO) + CC1–14.

## Como usar

1. Abra o site.
2. Ligue **Modo edição** e toque nas figurinhas que você tem repetidas (elas ficam destacadas).
3. Use **Mostrar só repetidas** para ver/compartilhar só o que está sobrando.
4. **Ordem do álbum** (padrão) ou **Alfabética** por seleção; há também busca por código/seleção.

Suas marcações ficam salvas no próprio navegador (localStorage), então não se perdem ao recarregar.

## Como publicar uma atualização (para todos verem)

1. No site, clique em **⬇ Exportar JSON** (ou **📋 Copiar JSON**).
2. Substitua o arquivo `data.json` deste projeto pelo arquivo exportado.
3. Faça commit e push:
   ```bash
   git add data.json
   git commit -m "Atualiza figurinhas repetidas"
   git push
   ```
4. O Vercel republica automaticamente em alguns segundos.

> Você também pode usar **⬆ Importar JSON** para carregar um `data.json` salvo (de outro
> dispositivo, por exemplo) de volta no site.

## Rodar localmente

O site precisa de um servidor HTTP (o `fetch` do `data.json` não funciona via `file://`):

```bash
npx serve .
# ou
python -m http.server 8000
```

Depois abra `http://localhost:3000` (ou `:8000`).

## Deploy no Vercel (primeira vez)

1. Crie um repositório no GitHub e dê push deste projeto (o `git` já está inicializado localmente).
2. Em [vercel.com](https://vercel.com) → **Add New Project** → importe o repositório.
3. Framework Preset: **Other** (site estático, sem build). Clique em **Deploy**.
4. Pronto — a URL gerada é o seu site compartilhável.

## Estrutura

| Arquivo        | Função                                                        |
| -------------- | ------------------------------------------------------------- |
| `index.html`   | Estrutura da página                                           |
| `styles.css`   | Estilo (tema escuro, responsivo)                              |
| `app.js`       | Render, filtros, edição, import/export                        |
| `data.json`    | Catálogo do álbum + lista `repeated` (a única que você muda)  |
| `vercel.json`  | Config de deploy estático                                     |

### Observação sobre as figurinhas FWC

As 20 figurinhas `FWC` foram distribuídas em 3 seções (Copa 2026 = FWC1–4,
Bola e Países-Sede = FWC5–8, História da Copa = FWC9–20). Se a divisão real do seu
álbum for diferente, basta ajustar os arrays `codes` em `data.json`.
