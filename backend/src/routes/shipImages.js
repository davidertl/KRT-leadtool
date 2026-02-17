/**
 * Ship images routes — proxy + cache from Star Citizen Wiki API
 * Uses CC-BY-NC-SA 4.0 Community images (starcitizen.tools wiki)
 */

const router = require('express').Router();
const { query } = require('../db/postgres');
const { requireAuth } = require('../auth/jwt');

const SC_WIKI_API = 'https://api.star-citizen.wiki/api/v2/vehicles';

/**
 * GET /api/ship-images
 * List all cached ship images
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT * FROM ship_images ORDER BY ship_type ASC`
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

/**
 * GET /api/ship-images/lookup/:shipType
 * Look up a ship image by type. Returns cached version or fetches from Wiki API.
 */
router.get('/lookup/:shipType', requireAuth, async (req, res, next) => {
  try {
    const { shipType } = req.params;

    // Check cache first
    const cached = await query(
      `SELECT * FROM ship_images WHERE LOWER(ship_type) = LOWER($1)`,
      [shipType]
    );

    if (cached.rows.length > 0) {
      return res.json(cached.rows[0]);
    }

    // Fetch from SC Wiki API
    try {
      const response = await fetch(`${SC_WIKI_API}?page[limit]=1&filter[name]=${encodeURIComponent(shipType)}`);
      if (!response.ok) {
        return res.status(404).json({ error: 'Ship not found in Wiki API' });
      }

      const data = await response.json();
      const vehicles = data.data || [];

      if (vehicles.length === 0) {
        return res.status(404).json({ error: 'Ship type not found' });
      }

      const vehicle = vehicles[0];
      const imageUrl = vehicle.media?.store_image?.url
        || vehicle.media?.gallery?.[0]?.url
        || null;
      const thumbnailUrl = vehicle.media?.store_image?.sizes?.small
        || null;

      if (!imageUrl) {
        return res.status(404).json({ error: 'No image available for this ship' });
      }

      // Cache in database
      const result = await query(
        `INSERT INTO ship_images (ship_type, image_url, thumbnail_url, source, source_url, license, license_url, author)
         VALUES ($1, $2, $3, 'sc_wiki', $4, 'CC-BY-NC-SA 4.0', 'https://creativecommons.org/licenses/by-nc-sa/4.0/', $5)
         ON CONFLICT (ship_type) DO UPDATE SET
           image_url = EXCLUDED.image_url,
           thumbnail_url = EXCLUDED.thumbnail_url,
           source_url = EXCLUDED.source_url,
           author = EXCLUDED.author
         RETURNING *`,
        [
          vehicle.name || shipType,
          imageUrl,
          thumbnailUrl,
          vehicle.link || `https://starcitizen.tools/${encodeURIComponent(vehicle.name || shipType)}`,
          'Star Citizen Wiki Community',
        ]
      );

      res.json(result.rows[0]);
    } catch (fetchErr) {
      console.error('[KRT] Wiki API fetch error:', fetchErr.message);
      res.status(502).json({ error: 'Failed to fetch from Wiki API' });
    }
  } catch (err) { next(err); }
});

/**
 * POST /api/ship-images
 * Manually add/update a ship image (admin use)
 */
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { ship_type, image_url, thumbnail_url, source, source_url, license, license_url, author } = req.body;

    if (!ship_type || !image_url) {
      return res.status(400).json({ error: 'ship_type and image_url required' });
    }

    const result = await query(
      `INSERT INTO ship_images (ship_type, image_url, thumbnail_url, source, source_url, license, license_url, author)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (ship_type) DO UPDATE SET
         image_url = EXCLUDED.image_url,
         thumbnail_url = EXCLUDED.thumbnail_url,
         source = EXCLUDED.source,
         source_url = EXCLUDED.source_url,
         license = EXCLUDED.license,
         license_url = EXCLUDED.license_url,
         author = EXCLUDED.author
       RETURNING *`,
      [
        ship_type,
        image_url,
        thumbnail_url || null,
        source || 'manual',
        source_url || null,
        license || 'CC-BY-NC-SA 4.0',
        license_url || 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
        author || null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

/**
 * DELETE /api/ship-images/:id
 */
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    await query(`DELETE FROM ship_images WHERE id = $1`, [req.params.id]);
    res.status(204).end();
  } catch (err) { next(err); }
});

/**
 * POST /api/ship-images/sync-all
 * Bulk-fetch all ships from Wiki API and cache their images
 */
router.post('/sync-all', requireAuth, async (req, res, next) => {
  try {
    let page = 1;
    let totalSynced = 0;
    let hasMore = true;

    while (hasMore) {
      const response = await fetch(`${SC_WIKI_API}?page[limit]=50&page[number]=${page}`);
      if (!response.ok) break;

      const data = await response.json();
      const vehicles = data.data || [];

      if (vehicles.length === 0) {
        hasMore = false;
        break;
      }

      for (const vehicle of vehicles) {
        const imageUrl = vehicle.media?.store_image?.url
          || vehicle.media?.gallery?.[0]?.url
          || null;

        if (!imageUrl || !vehicle.name) continue;

        const thumbnailUrl = vehicle.media?.store_image?.sizes?.small || null;

        await query(
          `INSERT INTO ship_images (ship_type, image_url, thumbnail_url, source, source_url, license, license_url, author)
           VALUES ($1, $2, $3, 'sc_wiki', $4, 'CC-BY-NC-SA 4.0', 'https://creativecommons.org/licenses/by-nc-sa/4.0/', 'Star Citizen Wiki Community')
           ON CONFLICT (ship_type) DO NOTHING`,
          [
            vehicle.name,
            imageUrl,
            thumbnailUrl,
            vehicle.link || `https://starcitizen.tools/${encodeURIComponent(vehicle.name)}`,
          ]
        );
        totalSynced++;
      }

      // Check pagination
      const meta = data.meta || {};
      if (meta.current_page >= meta.last_page || vehicles.length < 50) {
        hasMore = false;
      }
      page++;
    }

    res.json({ synced: totalSynced, message: `Synced ${totalSynced} ship images from Wiki API` });
  } catch (err) { next(err); }
});

module.exports = router;
