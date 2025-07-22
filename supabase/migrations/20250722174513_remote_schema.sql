CREATE UNIQUE INDEX dungeonmaster_userid_isuser_true_unique ON public.dungeonmaster USING btree (user_id) WHERE (is_user = true);


