export const createRequireAuth = ({ authUser, authPass }) => {
  return (req, res, next) => {
    if (!authUser || !authPass) {
      return res.status(500).send('Error de configuración server-side.');
    }

    if (req.session && req.session.authenticated) {
      return next();
    }

    const requestPath = req.originalUrl || req.path || '';

    if (requestPath.startsWith('/api') || req.xhr) {
      return res.status(401).json({ error: 'Sesión expirada' });
    }

    res.redirect('/login');
  };
};
