-- Vitrine de serviços: no lugar da sacola, o botão do serviço chama a etapa de
-- solicitação ("Quero esse serviço") e a mensagem sai pronta no WhatsApp.
-- Vitrines de serviços que ainda usam o texto padrão antigo passam para o novo.
update public.vitrines
set default_button_text = 'Quero esse serviço'
where type = 'servicos' and default_button_text = 'Agendar';
