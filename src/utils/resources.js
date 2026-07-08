import { supabase } from '../lib/supabaseClient';

export async function fetchDefaultCapacitySuggestion() {
  const { data, error } = await supabase.from('schedule_settings').select('daily_working_hours').eq('id', 1).single();
  if (error) { console.error(error); return 8; }
  return data.daily_working_hours;
}

export async function fetchActiveResources() {
  const { data, error } = await supabase.from('resources').select('*').is('deleted_at', null).order('name', { ascending: true });
  if (error) { console.error(error); return []; }
  return data;
}

export async function createResource(name, role, dailyCapacityHours) {
  const { data, error } = await supabase.from('resources').insert({
    name: name.trim(),
    role: role?.trim() || null,
    daily_capacity_hours: Number(dailyCapacityHours) || 8,
  }).select().single();
  if (error) { alert('Erro ao criar recurso: ' + error.message); return null; }
  return data;
}

export async function findConflictsForAssignment(resourceId, taskStart, taskEnd, proposedHours, excludeTaskId) {
  const { data: resourceRow } = await supabase.from('resources').select('daily_capacity_hours, name').eq('id', resourceId).single();
  const dailyCapacity = resourceRow?.daily_capacity_hours || 8;
  const resourceName = resourceRow?.name || '(recurso)';

  const { data, error } = await supabase
    .from('schedule_task_resources')
    .select('hours_per_day, schedule_tasks!inner(id, name, project_id, start_date, end_date, deleted_at, projects(name))')
    .eq('resource_id', resourceId);
  if (error) { console.error(error); return []; }

  const overlapping = (data || []).filter(row => {
    const task = row.schedule_tasks;
    if (!task || task.deleted_at) return false;
    if (excludeTaskId && task.id === excludeTaskId) return false;
    return taskStart <= task.end_date && task.start_date <= taskEnd;
  });

  const existingTotal = overlapping.reduce((sum, row) => sum + row.hours_per_day, 0);
  const total = existingTotal + proposedHours;
  if (total <= dailyCapacity) return [];

  return overlapping.map(row => ({
    resourceName,
    taskName: row.schedule_tasks.name,
    projectName: row.schedule_tasks.projects?.name || '(projeto)',
    projectId: row.schedule_tasks.project_id,
    existingHours: row.hours_per_day,
    total,
    capacity: dailyCapacity,
  }));
}

export async function checkConflictsForTaskDateChange(taskId, newStart, newEnd) {
  const { data: myAssignments, error } = await supabase
    .from('schedule_task_resources').select('resource_id, hours_per_day').eq('task_id', taskId);
  if (error || !myAssignments || !myAssignments.length) return [];

  const results = await Promise.all(
    myAssignments.map(a => findConflictsForAssignment(a.resource_id, newStart, newEnd, a.hours_per_day, taskId))
  );
  return results.flat();
}

export async function computeAllConflicts() {
  const { data, error } = await supabase
    .from('schedule_task_resources')
    .select('id, resource_id, hours_per_day, resources(name, daily_capacity_hours), schedule_tasks!inner(id, name, project_id, start_date, end_date, deleted_at, projects(name))');
  if (error) { console.error(error); return []; }

  const rows = (data || []).filter(r => r.schedule_tasks && !r.schedule_tasks.deleted_at);
  const byResource = {};
  rows.forEach(r => {
    if (!byResource[r.resource_id]) byResource[r.resource_id] = [];
    byResource[r.resource_id].push(r);
  });

  const conflicts = [];
  Object.values(byResource).forEach(resourceRows => {
    const capacity = resourceRows[0].resources?.daily_capacity_hours || 8;
    const resourceName = resourceRows[0].resources?.name || '(recurso)';
    const seenClusters = new Set();

    resourceRows.forEach(r => {
      const ta = r.schedule_tasks;
      const overlapping = resourceRows.filter(other => {
        const tb = other.schedule_tasks;
        return ta.start_date <= tb.end_date && tb.start_date <= ta.end_date;
      });
      const total = overlapping.reduce((sum, o) => sum + o.hours_per_day, 0);
      if (total <= capacity) return;

      const clusterKey = overlapping.map(o => o.id).sort().join(',');
      if (seenClusters.has(clusterKey)) return;
      seenClusters.add(clusterKey);

      conflicts.push({
        resourceName,
        capacity,
        total,
        tasks: overlapping.map(o => ({
          name: o.schedule_tasks.name,
          projectId: o.schedule_tasks.project_id,
          projectName: o.schedule_tasks.projects?.name,
          hours: o.hours_per_day,
        })),
      });
    });
  });
  return conflicts;
}