/**
 * Consistent API response helpers
 */

function success(res, data = null, message = 'Success', status = 200) {
  return res.status(status).json({
    success: true,
    message,
    data
  });
}

function error(res, message = 'An error occurred', status = 400, errors = null) {
  const body = {
    success: false,
    message
  };
  if (errors) body.errors = errors;
  return res.status(status).json(body);
}

function notFound(res, message = 'Resource not found') {
  return error(res, message, 404);
}

function unauthorized(res, message = 'Unauthorized') {
  return error(res, message, 401);
}

function forbidden(res, message = 'Forbidden') {
  return error(res, message, 403);
}

function serverError(res, message = 'Internal server error') {
  return error(res, message, 500);
}

module.exports = {
  success,
  error,
  notFound,
  unauthorized,
  forbidden,
  serverError
};
