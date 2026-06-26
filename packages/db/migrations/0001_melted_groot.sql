CREATE INDEX "events_room_timestamp_idx" ON "events" USING btree ("room_id","timestamp");--> statement-breakpoint
CREATE INDEX "memories_pet_idx" ON "memories" USING btree ("pet_id");--> statement-breakpoint
CREATE INDEX "pets_room_idx" ON "pets" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "world_objects_room_idx" ON "world_objects" USING btree ("room_id");