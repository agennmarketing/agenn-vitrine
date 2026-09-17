# Fase 4 — Conferência em produção

Sem novas variáveis ou serviços. Conferir em `app.agenn.com.br` e numa vitrine pública, no celular:

1. Criar uma vitrine de **Comida** pelo assistente: categorias Lanches e Bebidas, sacola ligada, formulário com nome, retirada/entrega e pagamento obrigatórios.
2. **Complementos:** criar "Ponto da carne", "Adicionais" e "Sabores de pizza" pelos modelos; editar preços; marcar uma opção como esgotada.
3. **Itens:** ligar grupos a um lanche e a uma pizza; duplicar o lanche e conferir que a cópia mantém os grupos.
4. **Vitrine:** abrir o lanche, ver os selos ("Obrigatório · escolha 1", "Opcional · até 5"); tentar adicionar sem escolher o ponto (rola até o grupo e mostra o erro); escolher, somar adicionais e quantidade; conferir "Adicionar · R$ X".
5. **Pizza:** dois sabores; preço pela regra escolhida (maior ou média).
6. **Sacola:** barra "Ver sacola · N itens · R$ X"; fechar o navegador e voltar (a sacola continua); editar uma linha; mudar quantidade; remover.
7. **Formulário:** erros dos obrigatórios; Entrega pede endereço; Dinheiro pergunta o troco.
8. **Envio:** mensagem no WhatsApp igual ao modelo da spec 7.5, com `Pedido #XXXX`; a sacola fica vazia depois.
9. **Simulador:** o código do pedido mostra os complementos e o total certo; mudar o preço de um adicional no painel e consultar de novo mostra "Preço mudou desde o envio".
10. **Loja ou serviço com sacola desligada:** botão direto com complementos e observação nas linhas abaixo da mensagem.
11. **Aba Sacola e mensagens:** desligar a sacola numa vitrine de Comida volta ao botão direto; ligar numa vitrine de Produtos mostra a sacola.

## Pendências registradas

- Arrastar para reordenar grupos, opções e vínculos (hoje: ordem de criação e ordem de marcação no item) → fase de design.
- Taxa de entrega por bairro e pedido mínimo continuam fora do escopo (spec 13).
- Sacola não sincroniza entre aparelhos (fica no aparelho, como a spec pede).
