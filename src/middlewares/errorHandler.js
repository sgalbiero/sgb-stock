function errorHandler(err, req, res, next) {
  console.error(err.stack);
  
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Erro interno no servidor',
      status: err.status || 500
    }
  });
}

module.exports = errorHandler;
