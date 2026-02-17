/**
 * Navigation routes — star systems, celestial bodies, nav points, jump edges
 */

const router = require('express').Router();
const { query } = require('../db/postgres');
const { requireAuth } = require('../auth/jwt');

// ============================================================
// Star Systems
// ============================================================

/** GET /api/navigation/systems — list all active star systems */
router.get('/systems', requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT * FROM star_systems WHERE active = true ORDER BY name ASC`
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

/** GET /api/navigation/systems/:id — full system data with bodies + nav points */
router.get('/systems/:id', requireAuth, async (req, res, next) => {
  try {
    const system = await query(`SELECT * FROM star_systems WHERE id = $1`, [req.params.id]);
    if (system.rows.length === 0) return res.status(404).json({ error: 'System not found' });

    const bodies = await query(
      `SELECT * FROM celestial_bodies WHERE system_id = $1 AND active = true ORDER BY name ASC`,
      [req.params.id]
    );

    const navPoints = await query(
      `SELECT * FROM navigation_points WHERE system_id = $1 AND active = true ORDER BY name ASC`,
      [req.params.id]
    );

    const edges = await query(
      `SELECT je.*, np_from.name AS from_name, np_to.name AS to_name
       FROM jump_edges je
       JOIN navigation_points np_from ON np_from.id = je.from_nav_id
       JOIN navigation_points np_to ON np_to.id = je.to_nav_id
       WHERE np_from.system_id = $1 OR np_to.system_id = $1
       ORDER BY je.distance ASC`,
      [req.params.id]
    );

    res.json({
      system: system.rows[0],
      celestial_bodies: bodies.rows,
      navigation_points: navPoints.rows,
      jump_edges: edges.rows,
    });
  } catch (err) { next(err); }
});

// ============================================================
// Celestial Bodies
// ============================================================

/** GET /api/navigation/bodies?system_id=... */
router.get('/bodies', requireAuth, async (req, res, next) => {
  try {
    const { system_id, body_type } = req.query;
    let sql = `SELECT * FROM celestial_bodies WHERE active = true`;
    const params = [];

    if (system_id) {
      params.push(system_id);
      sql += ` AND system_id = $${params.length}`;
    }
    if (body_type) {
      params.push(body_type);
      sql += ` AND body_type = $${params.length}`;
    }

    sql += ' ORDER BY name ASC';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) { next(err); }
});

// ============================================================
// Navigation Points
// ============================================================

/** GET /api/navigation/points?system_id=...&nav_type=... */
router.get('/points', requireAuth, async (req, res, next) => {
  try {
    const { system_id, nav_type, parent_body_id, qt_target } = req.query;
    let sql = `SELECT np.*, cb.name AS parent_body_name
               FROM navigation_points np
               LEFT JOIN celestial_bodies cb ON cb.id = np.parent_body_id
               WHERE np.active = true`;
    const params = [];

    if (system_id) {
      params.push(system_id);
      sql += ` AND np.system_id = $${params.length}`;
    }
    if (nav_type) {
      params.push(nav_type);
      sql += ` AND np.nav_type = $${params.length}`;
    }
    if (parent_body_id) {
      params.push(parent_body_id);
      sql += ` AND np.parent_body_id = $${params.length}`;
    }
    if (qt_target === 'true') {
      sql += ` AND np.qt_target = true`;
    }

    sql += ' ORDER BY np.name ASC';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) { next(err); }
});

// ============================================================
// Jump Edges (graph edges for route planning)
// ============================================================

/** GET /api/navigation/edges?system_id=... */
router.get('/edges', requireAuth, async (req, res, next) => {
  try {
    const { system_id } = req.query;
    let sql = `SELECT je.*, np_from.name AS from_name, np_to.name AS to_name
               FROM jump_edges je
               JOIN navigation_points np_from ON np_from.id = je.from_nav_id
               JOIN navigation_points np_to ON np_to.id = je.to_nav_id`;
    const params = [];

    if (system_id) {
      params.push(system_id);
      sql += ` WHERE (np_from.system_id = $1 OR np_to.system_id = $1)`;
    }

    sql += ' ORDER BY je.distance ASC';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) { next(err); }
});

// ============================================================
// Route Planning (shortest path between two nav points)
// ============================================================

/** GET /api/navigation/route?from=navId&to=navId */
router.get('/route', requireAuth, async (req, res, next) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to nav point IDs required' });

    // Load all edges into memory for Dijkstra
    const edgesResult = await query(
      `SELECT from_nav_id, to_nav_id, distance FROM jump_edges`
    );

    // Build adjacency list
    const adj = {};
    for (const e of edgesResult.rows) {
      if (!adj[e.from_nav_id]) adj[e.from_nav_id] = [];
      if (!adj[e.to_nav_id]) adj[e.to_nav_id] = [];
      adj[e.from_nav_id].push({ node: e.to_nav_id, dist: e.distance || 1 });
      adj[e.to_nav_id].push({ node: e.from_nav_id, dist: e.distance || 1 });
    }

    // Dijkstra
    const dist = {};
    const prev = {};
    const visited = new Set();
    const pq = [{ node: from, dist: 0 }];
    dist[from] = 0;

    while (pq.length > 0) {
      pq.sort((a, b) => a.dist - b.dist);
      const { node, dist: d } = pq.shift();

      if (visited.has(node)) continue;
      visited.add(node);

      if (node === to) break;

      for (const neighbor of (adj[node] || [])) {
        const newDist = d + neighbor.dist;
        if (newDist < (dist[neighbor.node] ?? Infinity)) {
          dist[neighbor.node] = newDist;
          prev[neighbor.node] = node;
          pq.push({ node: neighbor.node, dist: newDist });
        }
      }
    }

    // Reconstruct path
    if (dist[to] === undefined) {
      return res.json({ route: [], distance: null, reachable: false });
    }

    const path = [];
    let current = to;
    while (current) {
      path.unshift(current);
      current = prev[current];
    }

    // Fetch nav point details for the path
    const pointsResult = await query(
      `SELECT * FROM navigation_points WHERE id = ANY($1)`,
      [path]
    );
    const pointMap = {};
    for (const p of pointsResult.rows) pointMap[p.id] = p;

    res.json({
      route: path.map((id) => pointMap[id]),
      distance: dist[to],
      reachable: true,
    });
  } catch (err) { next(err); }
});

module.exports = router;
