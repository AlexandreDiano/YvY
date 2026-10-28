-- Conversas sem feature flag (decisão de 28/10): a aba aparece para todo
-- membro confirmado, sem chave para desligar. A 0050 criava a flag desligada.
delete from feature_flags where key = 'module_chat';
