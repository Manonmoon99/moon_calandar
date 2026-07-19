const { buildTodayPayload } = require('./_bd');

module.exports = (req, res) => {
  const offsetParam = parseInt(req.query.offset, 10);
  const userOffset = Number.isFinite(offsetParam) ? offsetParam : 8;
  const hemisphere = req.query.hemi === 'S' ? 'S' : 'N';

  try {
    const payload = buildTodayPayload(new Date(), userOffset, hemisphere);
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=600');
    res.status(200).json(payload);
  } catch (err) {
    res.status(500).json({ error: String((err && err.message) || err) });
  }
};
