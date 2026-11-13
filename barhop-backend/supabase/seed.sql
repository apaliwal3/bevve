-- Fictional venues. No live crowd or safety data is fabricated.
insert into public.bars(id,name,address,latitude,longitude,is_demo) values
 ('00000000-0000-0000-0000-000000000001','Demo Bar One','Fictional address 1',41.9000,12.4900,true),
 ('00000000-0000-0000-0000-000000000002','Demo Bar Two','Fictional address 2',41.9010,12.4910,true),
 ('00000000-0000-0000-0000-000000000003','Demo Bar Three','Fictional address 3',41.9020,12.4920,true)
on conflict(id) do nothing;
insert into public.drinks(id,name,category,serving_ml) values
 ('00000000-0000-0000-0000-000000000101','Lager','beer',330),
 ('00000000-0000-0000-0000-000000000102','House red wine','wine',150)
on conflict(id) do nothing;
insert into public.bar_languages(bar_id,language_code,evidence_type) values
 ('00000000-0000-0000-0000-000000000001','en','demo'),
 ('00000000-0000-0000-0000-000000000001','it','demo')
on conflict do nothing;
