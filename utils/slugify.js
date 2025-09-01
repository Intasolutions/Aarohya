exports.slugify = (str) => str
  .toString()
  .trim()
  .toLowerCase()
  .replace(/&/g, 'and')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)+/g, '');