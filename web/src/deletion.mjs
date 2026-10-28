const definitions = {
  tour: { table: 'tours', collection: 'tours', label: 'Tour' },
  visit: { table: 'apres_visits', collection: 'visits', label: 'Après-Ski-Eintrag', bucket: 'apres-proofs', imageField: 'proof_path' },
  photo: { table: 'posts', collection: 'feed', label: 'Foto', bucket: 'community-photos', imageField: 'image_path' }
};
export function deletionDefinition(kind) { return definitions[kind]; }
export async function deleteOwnEntry(db, kind, entry, userId) {
  const definition = definitions[kind];
  if (!definition || !userId || entry?.user_id !== userId) throw Error('Du kannst nur eigene Einträge löschen.');
  const {data,error} = await db.from(definition.table).delete().eq('id',entry.id).eq('user_id',userId).select('id');
  if (error) throw error;
  if (!data?.length) throw Error('Eintrag wurde nicht gelöscht. Bitte aktualisieren.');
  return definition.bucket ? {userId,bucket:definition.bucket,path:entry[definition.imageField]} : null;
}
export async function removeImage(db, image, userId) {
  if (image.userId !== userId || !['apres-proofs','community-photos','profile-media'].includes(image.bucket) || !image.path?.startsWith(userId+'/')) throw Error('Ungültige Bildzuordnung.');
  const {error} = await db.storage.from(image.bucket).remove([image.path]);
  if(error) throw error;
}
