import { supabase } from '../lib/supabaseClient';

const LEVEL_TO_FIELD = {
  grande: 'version_major',
  media: 'version_minor',
  minima: 'version_patch',
};
const LEVEL_TO_THRESHOLD_FIELD = {
  grande: 'version_threshold_grande',
  media: 'version_threshold_media',
  minima: 'version_threshold_minima',
};

export function buildVersionLabel(project) {
  return `${project.version_major}.${project.version_minor}.${project.version_patch}`;
}

export async function fetchVersionProgress(projectId) {
  const [projRes, pendingRes] = await Promise.all([
    supabase.from('projects')
      .select('version_threshold_grande, version_threshold_media, version_threshold_minima')
      .eq('id', projectId).single(),
    supabase.from('version_pending_items').select('level').eq('project_id', projectId),
  ]);
  const thresholds = {
    grande: projRes.data?.version_threshold_grande || 1,
    media: projRes.data?.version_threshold_media || 1,
    minima: projRes.data?.version_threshold_minima || 1,
  };
  const counts = { grande: 0, media: 0, minima: 0 };
  (pendingRes.data || []).forEach(p => { counts[p.level] = (counts[p.level] || 0) + 1; });
  return { thresholds, counts };
}

export async function registerVersionColumnArrival(projectId, level, itemId, itemTitle) {
  if (!level || !LEVEL_TO_FIELD[level]) return;

  if (itemId) {
    const { data: itemRow, error: itemError } = await supabase
      .from('versions').select('counted_in_version').eq('id', itemId).single();
    if (itemError) { console.error(itemError); return; }
    if (itemRow?.counted_in_version) return;
  }

  const { error: insertError } = await supabase.from('version_pending_items').insert({
    project_id: projectId, level, version_id: itemId, item_title: itemTitle || '(sem título)',
  });
  if (insertError) { console.error(insertError); return; }

  if (itemId) {
    const { error: flagError } = await supabase.from('versions').update({ counted_in_version: true }).eq('id', itemId);
    if (flagError) console.error(flagError);
  }

  const { data: project, error: projError } = await supabase
    .from('projects').select('*').eq('id', projectId).single();
  if (projError) { console.error(projError); return; }

  const threshold = project[LEVEL_TO_THRESHOLD_FIELD[level]] || 1;

  const { data: pending, error: pendingError } = await supabase
    .from('version_pending_items').select('*').eq('project_id', projectId).eq('level', level);
  if (pendingError) { console.error(pendingError); return; }

  if (pending.length < threshold) return;

  const field = LEVEL_TO_FIELD[level];
  const newValue = (project[field] || 0) + 1;
  const newLabel = buildVersionLabel({ ...project, [field]: newValue });

  const { error: updateError } = await supabase
    .from('projects').update({ [field]: newValue }).eq('id', projectId);
  if (updateError) { console.error(updateError); return; }

  const { data: bump, error: bumpError } = await supabase
    .from('version_bumps').insert({ project_id: projectId, level, version_label: newLabel }).select().single();
  if (bumpError) { console.error(bumpError); return; }

  const bumpItems = pending.map(p => ({
    version_bump_id: bump.id, version_id: p.version_id, item_title: p.item_title,
  }));
  await supabase.from('version_bump_items').insert(bumpItems);
  await supabase.from('version_pending_items').delete().eq('project_id', projectId).eq('level', level);
}