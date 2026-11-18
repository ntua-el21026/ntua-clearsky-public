const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
require('dotenv').config();
const { createVerifySession } = require('./session');

const app = express();
const PORT = 8080;
const { gatewayToken } = require('../shared/security');
const cors = require("cors");

app.use(cors({
  origin: "http://localhost:5173", // frontend address
  credentials: true,
  allowedHeaders: ["Content-Type", "X-OBSERVATORY-AUTH"]
}));


// Never forward caller-supplied identity claims to a trusted service.
app.use((req, res, next) => {
  for (const name of Object.keys(req.headers)) {
    if (/^x-(user-|student-|institution-|internal-gateway-token$)/i.test(name)) delete req.headers[name];
  }
  next();
});
function trustedProxy(options) {
  const forwardIdentity = options.onProxyReq;
  return createProxyMiddleware({
    ...options,
    onProxyReq(proxyReq, req, res) {
      proxyReq.setHeader('X-Internal-Gateway-Token', gatewayToken);
      if (req.user) {
        const identity = {
          'x-user-id': req.user.id,
          'x-user-role': req.user.role,
          'x-user-institution': req.user.institution,
          'x-institution-id': req.user.institution,
          'x-student-id': req.user.student_id,
        };
        for (const [name, value] of Object.entries(identity)) {
          if (value !== undefined && value !== null) proxyReq.setHeader(name, value);
        }
      }
      if (forwardIdentity) forwardIdentity(proxyReq, req, res);
    }
  });
}

// Validate signatures and the user service's persistent revocation state.
const verifyToken = createVerifySession();

// Middleware: allow only specific roles
function allowRoles(...roles) {
  return (req, res, next) => {
    const userRole = req.user?.role;
    if (!roles.includes(userRole)) {
      return res.status(403).json({ error: `Forbidden: Only [${roles.join(', ')}] allowed` });
    }
    next();
  };
}

app.use('/auth/login', trustedProxy({
  target: 'http://users-service:3000',
  changeOrigin: true,
  pathRewrite: { '^/auth': '/api' }
}));

app.use('/auth/register', verifyToken, allowRoles('institution'), trustedProxy({
  target: 'http://users-service:3000',
  changeOrigin: true,
  pathRewrite: { '^/auth': '/api' }
}));

app.use('/auth/changePassword', verifyToken, allowRoles('institution'), trustedProxy({
  target: 'http://users-service:3000',
  changeOrigin: true,
  pathRewrite: { '^/auth': '/api' }
}));


app.use('/auth/logout', verifyToken, trustedProxy({
  target: 'http://users-service:3000',
  changeOrigin: true,
  pathRewrite: { '^/auth': '/api' }
}));

app.use('/grades/upload/initial', verifyToken, allowRoles('instructor'), trustedProxy({
  target: 'http://grades-service:4000',
  changeOrigin: true,
  pathRewrite: { '^/grades': '/grades' },
  onProxyReq: (proxyReq, req) => {
    proxyReq.setHeader('x-user-id', req.user?.id);
    proxyReq.setHeader('x-user-username', req.user?.username);
    proxyReq.setHeader('x-user-role', req.user?.role);
    proxyReq.setHeader('x-user-institution', req.user?.institution);
  }
}));


app.use('/grades/upload/final', verifyToken, allowRoles('instructor'), trustedProxy({
  target: 'http://grades-service:4000',
  changeOrigin: true,
  pathRewrite: { '^/grades': '/grades' },
  onProxyReq: (proxyReq, req) => {
    proxyReq.setHeader('x-user-id', req.user?.id);
    proxyReq.setHeader('x-user-username', req.user?.username);
    proxyReq.setHeader('x-user-role', req.user?.role);
    proxyReq.setHeader('x-user-institution', req.user?.institution);
  }
}));

app.use('/grades/validateExcel', verifyToken, allowRoles('instructor'), trustedProxy({
  target: 'http://grades-service:4000',
  changeOrigin: true,
  pathRewrite: { '^/grades': '/grades' },
  onProxyReq: (proxyReq, req) => {
    proxyReq.setHeader('x-user-role', req.user?.role);
  }

}));

// Route: Request review (by students)
app.use('/reviews/request', verifyToken, allowRoles('student'), trustedProxy({
  target: 'http://review-service:5000', // replace 5000 with your actual review-service port
  changeOrigin: true,
  pathRewrite: { '^/reviews': '/reviews' }, // assumes the review microservice expects /api/reviews
  onProxyReq: (proxyReq, req) => {
    proxyReq.setHeader('x-student-id', req.user?.student_id);
    proxyReq.setHeader('x-institution-id', req.user?.institution);
  }
}));

app.use('/reviews/reply', verifyToken, allowRoles('instructor'), trustedProxy({
  target: 'http://review-service:5000', // adjust if needed
  changeOrigin: true,
  pathRewrite: { '^/reviews': '/reviews' },
  onProxyReq: (proxyReq, req) => {
    proxyReq.setHeader('x-user-id', req.user?.id);
  }
}));

app.use('/reviews/ack', verifyToken, allowRoles('student'), trustedProxy({
  target: 'http://review-service:5000',
  changeOrigin: true,
  pathRewrite: { '^/reviews': '/reviews' },
  onProxyReq: (proxyReq, req) => {
    proxyReq.setHeader('x-student-id', req.user?.student_id);
  }
}));

app.use('/reviews/instructor', verifyToken, allowRoles('instructor'), trustedProxy({
  target: 'http://review-service:5000',
  changeOrigin: true,
  pathRewrite: { '^/reviews': '/reviews' },
  onProxyReq: (proxyReq, req) => {
    proxyReq.setHeader('x-user-id', req.user?.id);
  }
}));

// GET a review by ID (student or instructor can access)
app.use('/reviews/view', verifyToken, allowRoles('student', 'instructor'), trustedProxy({
  target: 'http://review-service:5000',
  changeOrigin: true,
  pathRewrite: { '^/reviews': '/reviews' },
  onProxyReq: (proxyReq, req) => {
    proxyReq.setHeader('x-user-role', req.user.role);
      proxyReq.setHeader('x-user-id', req.user.id);
      if (req.user.role === 'student') {
        proxyReq.setHeader('x-student-id', req.user.student_id ); 
      }
  }
}));

// GET a reply to a review by review ID (student or instructor can access)
app.use('/replies/view', verifyToken, allowRoles('student', 'instructor'), trustedProxy({
  target: 'http://review-service:5000',
  changeOrigin: true,
  pathRewrite: { '^/replies': '/replies' },
  onProxyReq: (proxyReq, req) => {
    proxyReq.setHeader('x-user-role', req.user.role);
      proxyReq.setHeader('x-user-id', req.user.id);
      if (req.user.role === 'student') {
        proxyReq.setHeader('x-student-id', req.user.student_id ); 
      }
  }
}));




app.use(
  '/grades/view',
  verifyToken,
  trustedProxy({
    target: 'http://grades-service:4000',
    changeOrigin: true,
    pathRewrite: { '^/grades': '/grades' },
    onProxyReq: (proxyReq, req) => {
      proxyReq.setHeader('x-user-institution', req.user.institution);
      proxyReq.setHeader('x-user-role', req.user.role);
      proxyReq.setHeader('x-user-id', req.user.id);
      if (req.user.role === 'student') {
        proxyReq.setHeader('x-student-id', req.user.student_id ); 
      }
    }
  }),
);

app.use(
  '/grades/available',
  verifyToken,
  trustedProxy({
    target: 'http://grades-service:4000',
    changeOrigin: true,
    pathRewrite: { '^/grades': '/grades' },
    onProxyReq: (proxyReq, req) => {
      if (req.user) {
        proxyReq.setHeader('x-user-institution', req.user.institution);
        proxyReq.setHeader('x-user-role', req.user.role);
        proxyReq.setHeader('x-user-id', req.user.id);
        if (req.user.role === 'student') {
          proxyReq.setHeader('x-student-id', req.user.student_id ); 
        }
      }
    }
  })
);

app.use(
  '/grades/statistics',
  verifyToken,
  trustedProxy({
    target: 'http://grades-service:4000',
    changeOrigin: true,
    pathRewrite: { '^/grades': '/grades' },
    onProxyReq: (proxyReq, req) => {
      if (req.user) {
        proxyReq.setHeader('x-user-institution', req.user.institution);
        proxyReq.setHeader('x-user-role', req.user.role);
        proxyReq.setHeader('x-user-id', req.user.id);
        if (req.user.role === 'student') {
          proxyReq.setHeader('x-student-id', req.user.student_id ); 
        }
      }
    }
  })
);

if (require.main === module) {
  app.listen(PORT, () => console.log(`API Gateway running on port ${PORT}`));
}
module.exports = app;
