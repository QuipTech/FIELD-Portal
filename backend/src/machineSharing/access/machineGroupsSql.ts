// The machine's groups the caller may know about (machine_groups RLS).
export const MACHINE_GROUPS_SQL = `COALESCE((
  SELECT json_agg(json_build_object('id', g.id, 'name', g.name, 'colour', g.colour)
                  ORDER BY lower(g.name), g.id)
  FROM machine_group_machines gm
  JOIN machine_groups g ON g.id = gm.group_id AND g.deleted_at IS NULL
  WHERE gm.machine_id = m.id), '[]'::json)`;
