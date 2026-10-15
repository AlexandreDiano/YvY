-- Yvy — feature flags iniciais.

insert into feature_flags (key, is_enabled, description) values
  ('module_acoes',    true,  'Mapa e lista de ações de mobilização'),
  ('module_feed',     true,  'Feed local do bairro (Fala Camarada)'),
  ('module_checagem', true,  'Checagem de fatos'),
  ('module_convites', true,  'Geração de QRCode de convite'),
  ('module_transparencia', true, 'Votações do Congresso e atos de quem foi eleito (APIs oficiais)')
on conflict (key) do update
  set is_enabled = excluded.is_enabled,
      description = excluded.description,
      updated_at = now();
