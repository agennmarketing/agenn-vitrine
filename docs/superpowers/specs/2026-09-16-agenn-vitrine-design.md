# Agenn Vitrine — Design

**Data:** 2026-09-16
**Status:** Aprovado no brainstorming, aguardando revisão final da spec

## 1. Visão geral

SaaS para criar **vitrines digitais** (catálogos e cardápios) com fotos **e vídeos**. É um catálogo, não um sistema de pedidos: o cliente final monta o que quer e é enviado ao WhatsApp do lojista com uma mensagem pronta. Não há pagamento nem pedido registrado dentro do sistema.

**Diferencial:** vídeo nos itens (9:16 e 16:9) sem prejudicar o desempenho da vitrine.

**Três áreas:**
- **Acesso**: cadastro, login e recuperação de senha
- **Painel**: criar e configurar vitrines, simulador de pedidos, plano e conta
- **Vitrine**: página pública da vitrine

**Três tipos de vitrine**, escolhidos na criação e **imutáveis** depois:

| Tipo | Público | Botão padrão |
|---|---|---|
| `produtos` | Lojas | "Solicitar orçamento" |
| `servicos` | Profissionais (manicure, clínicas…) | "Agendar" |
| `comida` | Hamburguerias, pizzarias… | "Pedir" |

**Design:** painel e vitrines com visual premium, responsivos (mobile e desktop). A implementação da interface usa a skill **impeccable**.

## 2. Stack e serviços

| Camada | Escolha |
|---|---|
| App | Next.js (App Router, TypeScript), **um único projeto** |
| Hospedagem | Vercel (inclui Vercel Cron) |
| Banco, autenticação | Supabase (Postgres + RLS + Auth) |
| Vídeo | Bunny Stream (biblioteca na **rede Volume**) |
| Imagens | Bunny Storage (região São Paulo) + Pull Zone na rede Volume |
| Pagamentos | Stripe (Checkout + Customer Portal + Webhooks) |
| E-mail transacional | Resend (SMTP do Supabase Auth) |
| Anti-bot | Cloudflare Turnstile (no cadastro) |
| Erros | Sentry (plano gratuito) |
| Player de vídeo | hls.js, carregado sob demanda (HLS nativo no Safari) |
| Envio de vídeo | tus-js-client (envio retomável direto ao Bunny) |
| Testes | Vitest, Playwright, Lighthouse CI, Supabase CLI local, Stripe CLI |

### 2.1 Domínios e roteamento

O domínio raiz é configurado pela variável `ROOT_DOMAIN`.

| Endereço | Conteúdo |
|---|---|
| `ROOT_DOMAIN` | Página inicial |
| `app.ROOT_DOMAIN` | Acesso e Painel |
| `{subdominio}.ROOT_DOMAIN` | Vitrine pública |

- O middleware do Next.js lê o host e reescreve a requisição para a rota interna correta.
- A Vercel usa domínio curinga (`*.ROOT_DOMAIN`).
- **Regras do subdomínio:**
  - 3 a 30 caracteres, formato `^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$`
  - único no sistema
  - não pode estar na lista de nomes reservados (`www`, `app`, `painel`, `api`, `admin`, `suporte`, `blog`, `ajuda`, `status`, `mail`, `static`, `cdn`, entre outros)
- Trocar o subdomínio libera o antigo na hora, e o link antigo para de funcionar. O painel avisa antes de confirmar.

## 3. Planos e limites

Todos os limites ficam na tabela `plans`. Mudar um número não exige alterar código.

| Limite | Gratuito | Pro |
|---|---|---|
| Vitrines | 1 | 3 |
| Itens por vitrine | 10 | 300 |
| Vídeos de item | 1 por conta | 50 por vitrine |
| Duração máxima por vídeo | 60 s | 60 s |
| Tamanho máximo do envio de vídeo | 500 MB | 500 MB |
| Imagens por item | 3 (capa + 2) | 3 (capa + 2) |
| Logo, cor da marca, banner | Não | Sim |
| Tema claro/escuro | Sim | Sim |
| Marca d'água "Feito com Agenn Vitrine" | Sim | Não |
| Sacola, complementos, vários WhatsApp, simulador | Sim | Sim |
| Franquia de entrega de vídeo | 1 TB/mês por conta | 1 TB/mês por conta |

**Preço do Pro:** R$ 149,90/mês ou R$ 1.499/ano.

**Base do preço** (câmbio de US$ 1 = R$ 6,00, rede Volume a US$ 0,005/GB, Stripe com ~3,99% + R$ 0,39, Simples Anexo III com 6%, custo fixo de ~R$ 300/mês rateado entre 50 assinantes):

| Cenário | Lucro por assinante |
|---|---|
| Normal (6 mil visitas/mês) | ~R$ 127 |
| Movimentado (30 mil) | ~R$ 120 |
| Pior caso dentro da franquia (1 TB) | ~R$ 98 |

Com o vídeo carregando só quando o item é aberto, o custo real tende a ser bem menor. O Anexo tributário deve ser confirmado com um contador.

**Franquia de vídeo:** ao passar de 1 TB no mês, os vídeos da conta passam a mostrar só a capa até o mês virar, e o dono é avisado no painel e por e-mail.

## 4. Modelo de dados

Todas as tabelas têm `id uuid`, `created_at` e `updated_at`, salvo indicação contrária. Os valores monetários são guardados em **centavos** (`integer`).

### 4.1 Conta e plano
- **profiles**: `id` (= `auth.users.id`), `name`, `active_session_id`.
- **plans**: `id` (`free` | `pro`), `max_vitrines`, `max_items_per_vitrine`, `max_videos_per_vitrine`, `max_videos_per_account` (nulo = sem limite por conta), `max_video_seconds`, `max_video_upload_mb`, `monthly_video_gb`, `allow_branding`, `show_watermark`.
- **subscriptions**: `user_id`, `stripe_customer_id`, `stripe_subscription_id`, `plan_id`, `status` (espelho do Stripe), `interval` (`month` | `year`), `current_period_end`, `cancel_at_period_end`, `grace_until`, `pro_ended_at`.
- **stripe_events**: `id` (id do evento no Stripe), `processed_at`. Garante que cada evento seja processado uma vez só.
- **video_usage_monthly**: `user_id`, `month` (date), `bytes_delivered`, `over_quota` (bool).

### 4.2 Vitrine
- **vitrines**
  - identificação: `owner_id`, `type` (`produtos` | `servicos` | `comida`), `subdomain` (único), `name`, `description`
  - aparência: `logo_media_id`, `brand_color` (hex), `theme` (`light` | `dark`), `banner_enabled`, `banner_media_id`
  - exibição: `show_prices`, `show_media`, `cart_enabled`
  - contato e botões: `primary_whatsapp_id`, `default_button_text`, `cart_button_text`
  - estado: `status` (`active` | `frozen`), `position`
- **whatsapp_contacts**: `vitrine_id`, `label`, `phone_e164` (padrão +55, aceita outros países).
- **checkout_settings**: `vitrine_id` (único), `name_mode`, `fulfillment_mode` (retirada/entrega, com endereço quando for entrega), `payment_mode`, `schedule_mode` (data e horário), `notes_mode`, `payment_options` (text[], por exemplo `{Pix, Cartão na entrega, Dinheiro}`).
  - Cada `*_mode` vale `off`, `optional` ou `required`.
  - Com "Dinheiro" escolhido, o formulário pergunta "troco para quanto?" (opcional).
- **categories**: `vitrine_id`, `name`, `position`.

### 4.3 Itens
- **items**
  - identificação: `vitrine_id`, `owner_id`, `category_id`, `code`, `name`, `description`
  - preço: `price_type` (`fixed` | `from` | `on_request`), `price_cents` (nulo em `on_request`), `promo_price_cents`
  - outros: `duration_minutes` (Serviços), `tags` (text[]), `sold_out`, `position`
  - avançado: `whatsapp_id` (nulo = principal), `button_text` (nulo = padrão), `custom_message` (nulo = automática)
  - `deleted_at` (exclusão lógica)
- **item_codes**: `owner_id`, `code`, `item_id`. Chave única em (`owner_id`, `code`). **Nunca é apagada**, e por isso um código nunca é reaproveitado.
- **item_variations**: `item_id`, `name`, `price_cents`, `promo_price_cents`, `sold_out`, `position`. Quando existem, escolher uma é obrigatório e o preço dela **substitui** o preço do item.
- **media**
  - vínculo: `owner_id`, `vitrine_id`, `item_id` (nulo em logo e banner)
  - classificação: `role` (`cover` | `gallery` | `video` | `logo` | `banner`), `kind` (`image` | `video`), `position`
  - imagens: `storage_paths` (jsonb com os tamanhos)
  - vídeos: `bunny_video_id`, `duration_seconds`, `aspect` (`9:16` | `16:9`)
  - dimensões e estado: `width`, `height`, `bytes`, `status` (`processing` | `ready` | `failed`)
  - Restrições por item: 1 `cover` obrigatória, até 2 `gallery`, até 1 `video`.

### 4.4 Complementos
- **addon_groups**: `vitrine_id`, `name`, `kind` (`standard` | `flavors`), `required`, `min_select`, `max_select`, `allow_repeat`, `flavor_price_rule` (`max` | `average`, só em `flavors`).
- **addon_options**: `group_id`, `name`, `price_cents`, `sold_out`, `position`.
- **item_addon_groups**: `item_id`, `group_id`, `position`.

### 4.5 Simulador
- **order_snapshots**
  - `owner_id`, `vitrine_id`, `code`, `payload` (jsonb), `created_at`, `expires_at` (+90 dias)
  - `payload`: itens com `item_id`, `code`, `name`, `qty`, variação (`id`, `name`), complementos (`option_id`, `name`, `qty`), `note` e os preços unitários no momento do envio
  - **Nunca guarda dados pessoais.** Nome, endereço e pagamento vão só na mensagem.
- **rate_limits**: `key` (hash do IP + ação), `window_start`, `count`.

### 4.6 Regras de cálculo de preço
1. Preço base: preço da variação escolhida ou, sem variação, do item. Se houver promoção, vale a promoção.
2. Complementos `standard`: soma de `price_cents × qty` de cada opção.
3. Grupo `flavors`: soma ao preço base o **maior** preço ou a **média** (arredondada para cima em centavos) das opções escolhidas, conforme `flavor_price_rule`.
4. Total da linha: (base + complementos) × quantidade do item.
5. Item `on_request`: aparece como "sob consulta" e fica fora da soma. O total mostra "+ itens sob consulta".

### 4.7 O que é calculado, não salvo
Quando a conta está no gratuito:
- ficam visíveis só os **10 primeiros itens** (ordem da categoria, depois do item) da vitrine ativa e **1 vídeo** (o primeiro nessa mesma ordem);
- logo, cor e banner são ignorados na hora de gerar a página;
- as outras vitrines ficam com `status = frozen`.

Ao voltar para o Pro, tudo reaparece sem migração.

### 4.8 Segurança
- **RLS em todas as tabelas:** o dono lê e escreve só as linhas com seu `owner_id`/`user_id`.
- `plans` pode ser lida por todos.
- `subscriptions`, `stripe_events`, `video_usage_monthly` e `rate_limits` só são alteradas pelo servidor (service role).
- **Travas no banco** (triggers) impedem ultrapassar os limites de vitrines, itens e vídeos do plano atual, mesmo burlando a interface.
- As vitrines públicas são geradas no servidor e buscam só vitrines `active`.

## 5. Códigos

### 5.1 Código do item
- **Automático:** sequencial por conta, começando em `101`. O próximo número pula qualquer código já registrado em `item_codes`.
- **Personalizado:** `^[A-Z0-9]{1,6}$`. O painel converte para maiúsculas e remove espaços e acentos.
- **Único por conta** (somando todas as vitrines), incluindo itens apagados.
- O painel verifica a disponibilidade enquanto o dono digita.

### 5.2 Código do pedido
- 4 caracteres do alfabeto `23456789ABCDEFGHJKLMNPQRSTUVWXYZ`, sem caracteres ambíguos.
- Único entre os pedidos não expirados da conta. Em caso de colisão, gera outro.
- Limite de criação: **20 por hora por IP**.

## 6. Mídia

### 6.1 Imagens
1. O dono recorta no navegador: capa e imagens do item em **4:5**, banner em **16:9**, logo em **1:1**.
2. O navegador converte para WebP em dois tamanhos:
   - capa e galeria: 480 px e 1080 px de largura
   - banner: 960 px e 1920 px
   - logo: 128 px e 512 px
3. Os arquivos vão para a rota `POST /api/media/image`, que valida dono, plano e limites, e envia ao Bunny Storage.
4. Caminho: `/{owner_id}/{vitrine_id}/{media_id}-{tamanho}.webp`, com `Cache-Control: public, max-age=31536000, immutable`. Trocar a imagem gera um novo `media_id`.

### 6.2 Vídeos
1. O navegador lê os metadados e recusa vídeo com mais de 60 s ou mais de 500 MB. No banner, só aceita vídeo horizontal.
2. A rota `POST /api/media/video` valida limites e franquia, cria o vídeo no Bunny e devolve a assinatura TUS temporária.
3. O navegador envia direto ao Bunny com tus-js-client (retomável, com barra de progresso). A mídia fica `processing`.
4. O webhook do Bunny chama `POST /api/webhooks/bunny`. O servidor **consulta o vídeo na API do Bunny** antes de confiar no aviso, atualiza `status`, `duration_seconds` e `aspect`, e regenera a vitrine.
5. Se falhar, o status fica `failed` e o painel mostra "Tentar novamente".

**Configuração da biblioteca:**
- rede Volume
- resoluções 240p, 360p, 480p e 720p
- **sem guardar o arquivo original**
- sem MP4 de fallback
- referrers permitidos: `*.ROOT_DOMAIN`
- acesso direto aos arquivos bloqueado

### 6.3 Exibição
- **Listagem:** só a imagem de capa, com `srcset` e carregamento preguiçoso. Nenhum JavaScript de vídeo.
- **Tela do item:** hls.js é importado só quando a tela abre.
  - O carrossel mostra primeiro o vídeo (sem som, em loop, `playsinline`, botão de áudio), depois capa e imagens.
  - Ao fechar ou trocar de mídia, o player pausa e é destruído.
- **Banner em vídeo:** o poster aparece primeiro e o vídeo só inicia após o carregamento da página. Com `Save-Data` ou `prefers-reduced-motion`, fica só o poster.

### 6.4 Tarefas diárias (Vercel Cron)
- Remover mídias órfãs e falhas com mais de 24 h (no banco e no Bunny).
- Apagar vídeos excedentes de contas com `pro_ended_at` há mais de 90 dias. O aviso por e-mail sai no dia 83.
- Atualizar `video_usage_monthly`.
  - **A validar no início da fase 3:** se a API de estatísticas do Bunny informa o consumo por vídeo.
  - Se não informar, o sistema registra as aberturas do player e estima bytes por segundos assistidos × bitrate médio da resolução.
- Conferir as assinaturas com o Stripe.
- Remover `order_snapshots` expirados e `rate_limits` antigos.

Apagar item, mídia, vitrine ou conta apaga os arquivos no Bunny imediatamente.

**Proteção extra:** alerta de gasto configurado na conta do Bunny.

## 7. Vitrine pública

### 7.1 Geração
- Página estática com revalidação sob demanda por `revalidateTag('vitrine:{id}')`, disparada ao salvar no painel, ao terminar um vídeo e ao mudar o plano.
- Metadados Open Graph com nome, descrição e banner ou logo. Também `theme-color` e favicon a partir do logo.
- Subdomínio inexistente mostra "Vitrine não encontrada". Vitrine congelada mostra "Vitrine indisponível no momento".

### 7.2 Estrutura
1. **Topo:** logo (ou iniciais no gratuito), nome, busca por nome ou código, ícone da sacola (se ligada).
2. **Banner 16:9** (Pro, se ligado).
3. **Barra de categorias** fixa ao rolar, destacando a categoria visível.
4. **Itens por categoria.**
   - Cada card mostra: capa, nome, preço (se `show_prices`), "de/por", "a partir de" ou "sob consulta", duração e etiquetas.
   - Esgotado: o card fica esmaecido, pode ser aberto, mas não adicionado.
   - Com `show_media = false`: a listagem vira lista só com texto, e a tela do item não mostra mídias.
5. **Rodapé:** marca d'água no gratuito.

**Cor da marca:** o texto sobre a cor é branco ou preto, o que tiver mais contraste (WCAG).

### 7.3 Tela do item
- Painel deslizante no mobile, janela no desktop. A URL recebe `?item={code}` e o link pode ser compartilhado.
- Conteúdo: mídias, nome, descrição, preço, variações, grupos de complementos com selos ("Obrigatório · escolha 1", "Opcional · até 5"), quantidade e observação (até 140 caracteres).
- **Botão do rodapé:**
  - Sacola ligada: "Adicionar · R$ X" (sem valor se os preços estiverem ocultos).
  - Sacola desligada: texto do item ou da vitrine, e envio direto ao WhatsApp do item.
- **Validação:** se faltar escolha obrigatória, rola até o grupo e o destaca.

### 7.4 Sacola
- Guardada em `localStorage` por vitrine (com `try/catch`). Sem armazenamento disponível, funciona só em memória.
- Barra flutuante: "Ver sacola · N itens · R$ X".
- Permite editar, mudar quantidade e remover.
- Ao abrir, confere com os dados atuais: remove itens apagados ou esgotados e avisa.
- **Formulário** conforme `checkout_settings`, validado antes do envio. A observação geral aceita até 300 caracteres.

### 7.5 Envio ao WhatsApp
Vale para a sacola e para o botão direto:
1. `POST /api/orders` cria o `order_snapshot` e devolve o código.
2. O sistema monta a mensagem **sem nenhum valor**.
3. Redireciona para `https://wa.me/{telefone}?text={mensagem codificada}`.

Se o passo 1 falhar, a mensagem vai sem o código. A venda nunca é bloqueada.

**Mensagem da sacola:**
```
*Pedido #K7F2 – Burger do Zé*

2x *X-Bacon* (cód. 104)
   • Ponto: Ao ponto
   • Adicionais: 2x Bacon, 1x Cheddar
   • Obs: sem cebola

1x *Coca-Cola lata* (cód. 210)

Retirada · Nome: Ana · Pagamento: Pix
```

**Mensagem automática do botão direto:**
- Produtos e Comida: `Olá! Vim da vitrine *{vitrine}* e tenho interesse em: *{item} – {variacao}* (cód. {codigo}). Pedido #{pedido}`
- Serviços: `Olá! Vim da vitrine *{vitrine}* e gostaria de agendar: *{item} – {variacao}* (cód. {codigo}). Pedido #{pedido}`
- Os complementos escolhidos aparecem em linhas abaixo, no mesmo formato da sacola.

**Mensagem personalizada:** aceita as variáveis `{item}`, `{codigo}`, `{variacao}`, `{vitrine}` e `{pedido}`. O bloco de complementos é sempre acrescentado ao final.

### 7.6 Metas de desempenho
- LCP abaixo de 2,5 s em celular intermediário no 4G.
- Lighthouse mobile com nota de 90 ou mais.
- Tela do item, sacola e player carregados sob demanda.
- Fontes hospedadas no próprio site.

## 8. Painel

### 8.1 Acesso
- Telas: entrar, criar conta (nome, e-mail, senha, Turnstile), confirmar e-mail, esqueci a senha, redefinir senha.
- Botão "Continuar com Google" em todas.
- O painel só é liberado com e-mail confirmado.

**Sessão única:**
- Ao entrar, o `session_id` do JWT é gravado em `profiles.active_session_id`.
- O middleware compara a cada requisição. Se não bater, encerra a sessão com a mensagem "Sua conta foi acessada em outro aparelho."

### 8.2 Minhas vitrines
- Cards com status, link, copiar link, QR Code (gerado no navegador) e botão "Editar".
- Uso do plano: vitrines, vídeos e franquia do mês.
- "Nova vitrine": com o limite atingido, abre o convite para o Pro.

### 8.3 Assistente de criação
1. Tipo (com aviso de que não poderá ser alterado).
2. Nome e subdomínio (disponibilidade verificada enquanto digita).
3. WhatsApp principal.
4. Aparência (cadeado e selo Pro no gratuito).

Ao concluir, a vitrine é criada com as categorias de exemplo do tipo, `checkout_settings` padrão e sacola ligada só em `comida`.

### 8.4 Editor da vitrine
**Abas:**
- **Itens:** categorias e itens com arrastar para reordenar, esgotado com um toque, busca, duplicar.
- **Complementos:** biblioteca de grupos, com modelos prontos: Ponto da carne, Adicionais, Molhos, Tamanho, Sabores de pizza, Bebida do combo.
- **Aparência**
- **WhatsApp**
- **Sacola e mensagens**
- **Configurações:** nome, descrição, subdomínio, excluir vitrine.

**Comportamento:**
- Prévia ao vivo ao lado no desktop e pelo botão "Ver prévia" no mobile. A prévia é renderizada dinamicamente com os dados ainda não salvos.
- Barra fixa "Alterações não salvas · Salvar". Sair com pendências pede confirmação.

### 8.5 Editor de item
- **Mídias:** espaços Capa (obrigatória), Imagem 2, Imagem 3 e Vídeo, com recorte, progresso e status.
- **Código:** preenchido automaticamente, editável, com verificação.
- **Campos por tipo:** preço e promoção; duração e tipo de preço (Serviços); variações; etiquetas; grupos de complementos.
- **Seção "Avançado"** (recolhida): WhatsApp, texto do botão, mensagem personalizada com as variáveis.

### 8.6 Simulador
- **Por código de pedido:** mostra itens, complementos, preços unitários atuais, subtotais e total. Avisa quando algum preço mudou desde o envio.
- **Modo manual:** busca por código de item, escolhe variação, complementos e quantidade, e soma o total.
- **"Copiar resumo com valores"**: texto pronto para responder ao cliente no WhatsApp.
- Funciona para qualquer vitrine da conta, porque o código é único por conta.

### 8.7 Plano e assinatura
- Plano, consumo, "Assinar Pro" (mensal ou anual) e "Gerenciar assinatura" (Stripe Customer Portal).
- Quando a conta volta ao gratuito com mais de uma vitrine: tela para escolher qual fica ativa. Sem escolha, fica a mais antiga.

### 8.8 Conta
- Nome editável e e-mail só para leitura.
- "Trocar senha" **só aparece em conta com senha** (identidade `email` no Supabase). Em conta criada pelo Google, não aparece. Se a mesma conta tiver as duas formas de login, aparece.
- "Sair de todos os aparelhos".
- "Excluir conta": cancela a assinatura no Stripe e apaga dados e mídias.

### 8.9 Regras do gratuito na interface
Recursos Pro aparecem com cadeado e selo, e abrem o convite para assinar. Nunca ficam escondidos.

## 9. Assinatura (Stripe)

- Produto "Pro" com dois preços em BRL (mensal e anual). Pagamento só com cartão.
- `checkout.session` em modo `subscription`. O Customer é criado no primeiro checkout, com `metadata.user_id`.
- **Webhook** `POST /api/webhooks/stripe`:
  - verifica a assinatura do evento e ignora eventos já presentes em `stripe_events`
  - eventos tratados: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`
  - a cada evento, **busca a assinatura no Stripe** e atualiza `subscriptions`
- **Mapeamento de status:**

  | Status no Stripe | Resultado |
  |---|---|
  | `active`, `trialing` | Pro |
  | `past_due` | Pro com `grace_until = primeira falha + 7 dias`. Depois disso, gratuito. |
  | `canceled`, `unpaid`, `incomplete_expired` | Gratuito, com `pro_ended_at = agora` |

- Tentativas de cobrança do Stripe configuradas para **7 dias** e, depois, cancelar a assinatura.
- Cancelamento pelo portal vale no fim do período pago (`cancel_at_period_end`).
- **Toda mudança de plano:** atualiza `vitrines.status` e revalida todas as vitrines do dono.

## 10. Tratamento de erros

| Situação | Comportamento |
|---|---|
| Envio de mídia interrompido | Retomada automática. Mensagem "Conexão caiu, retomando…" |
| Vídeo fora do limite | Recusado antes do envio, com o motivo em português |
| Processamento do vídeo falhou | Status `failed` + "Tentar novamente" |
| Revalidação falhou | Versão anterior continua no ar e o sistema tenta de novo |
| Criação do código de pedido falhou | Mensagem enviada sem código |
| Limite de pedidos por IP atingido | Mensagem enviada sem código |
| Webhook do Stripe perdido | Conferência diária |
| Limite de plano ao salvar | Convite para o Pro, nunca erro genérico |
| Sessão substituída | Encerra com "Sua conta foi acessada em outro aparelho." |

Todos os erros de servidor são enviados ao Sentry.

## 11. Testes

- **Unitários (Vitest):**
  - cálculo de preço (seção 4.6)
  - montagem das mensagens (sacola, botão direto, personalizada)
  - geração e validação de códigos de item e pedido
  - validação de subdomínio
  - cálculo de permissões do plano e itens visíveis no gratuito
  - validação do formulário da sacola
- **Integração:**
  - políticas RLS no Supabase local (um dono nunca acessa dados de outro)
  - triggers de limite
  - webhooks do Stripe (Stripe CLI)
  - webhook do Bunny (API simulada)
- **Ponta a ponta (Playwright, mobile e desktop):**
  - cadastro → criar vitrine → cadastrar item → vitrine pública → sacola → conferir URL e texto do WhatsApp → simulador mostra o total correto
  - bloqueios do gratuito
  - congelamento ao voltar para o gratuito
- **Desempenho:** Lighthouse CI em uma vitrine de exemplo, com nota mínima de 90.

## 12. Fases de construção

Cada fase tem seu próprio plano de implementação.

1. **Fundação:** projeto Next.js, Supabase (schema, RLS, triggers), acesso (e-mail, Google, confirmação, Turnstile, Resend, sessão única), roteamento por subdomínio, tabela de planos.
2. **Vitrines de Produtos e Serviços com imagens:** assistente, editor, itens, variações, categorias, códigos, WhatsApp, vitrine pública, botão direto, `order_snapshots` e simulador.
3. **Vídeos:** Bunny Stream, player sob demanda, banner em vídeo, limpeza, franquia.
4. **Complementos e sacola:** grupos reutilizáveis e sabores, sacola, formulário, mensagem completa. Com isso, a vitrine de Comida fica completa.
5. **Pro com Stripe:** checkout, portal, webhooks, marca d'água, restrições de personalização, congelamento, regra dos 90 dias.
6. **Acabamento:** QR Code, excluir conta, termos de uso e política de privacidade, otimização de desempenho.

## 13. Fora do escopo

- Pedidos e pagamentos dentro do sistema
- Taxa de entrega por bairro e pedido mínimo
- Domínio próprio do cliente (o banco já permite adicionar depois)
- Estatísticas de visitas e cliques para o dono
- Painel administrativo da plataforma (usar os painéis do Supabase e do Stripe)
- Pix ou boleto na assinatura
- Planos pagos adicionais (a tabela `plans` já permite)

## 14. Decisões em aberto

- **Domínio raiz** (`ROOT_DOMAIN`): ainda não definido. Não bloqueia o desenvolvimento, que usa uma variável de ambiente.
- **Anexo do Simples Nacional:** confirmar com um contador (afeta a margem, não o sistema).
