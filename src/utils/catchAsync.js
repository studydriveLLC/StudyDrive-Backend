/**
 * Intercepte les erreurs des fonctions asynchrones (Promesses)
 * et les transmet au middleware de gestion des erreurs global.
 */
const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

module.exports = catchAsync;