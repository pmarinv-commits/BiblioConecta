try {
	require('dotenv').config();
} catch (err) {
	if (process.env.NODE_ENV !== 'production') {
		console.warn('dotenv not loaded; using process env only');
	}
}
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bodyParser = require('body-parser');
const passport = require('passport');
const cookieSession = require('cookie-session');
const cors = require('cors');

const app = express();
app.set('trust proxy', 1);
const frontendDir = path.join(__dirname,'../frontend');

app.use(helmet({
	contentSecurityPolicy: {
		directives: {
			defaultSrc: ["'self'"],
			imgSrc: ["'self'", 'data:', 'https://www.gstatic.com', 'https://www.ceduc.cl', 'https://cdn.jsdelivr.net'],
			styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://fonts.googleapis.com'],
			fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdn.jsdelivr.net'],
			scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com'],
			scriptSrcAttr: ["'self'", "'unsafe-inline'"],
			connectSrc: ["'self'", 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com']
		}
	},
	crossOriginEmbedderPolicy: false
}));
app.use(cors());
app.use(bodyParser.json({limit:'10mb'}));
app.use(bodyParser.urlencoded({extended:true,limit:'10mb'}));

// static frontend
app.use('/', express.static(frontendDir));
app.get('/admin/login', (req,res)=> res.sendFile(path.join(frontendDir,'admin_login.html')));

// uploads static
app.use('/uploads', express.static(path.join(__dirname,'uploads')));

// rate limiter
app.use(rateLimit({windowMs:15*60*1000, max:300}));

// sessions for passport
app.use(cookieSession({name:'session', keys:[process.env.SESSION_SECRET||'devkey'], maxAge:24*60*60*1000}));
// cookie-session does not expose regenerate/save, so stub them for passport compatibility
app.use((req, res, next) => {
	if (req.session) {
		if (typeof req.session.regenerate !== 'function') {
			req.session.regenerate = (done) => done && done();
		}
		if (typeof req.session.save !== 'function') {
			req.session.save = (done) => done && done();
		}
	}
	next();
});

// passport
try{ require('./services/passport')(passport); app.use(passport.initialize()); app.use(passport.session()); }catch(e){ console.warn('Passport init error', e.message) }

// routes
const { adminRouter } = require('./routes/admin');
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/admin/auth', require('./routes/adminAuth'));
app.use('/api/libros', require('./routes/libros'));
app.use('/api/libros/prestados', require('./routes/libros_prestados'));
app.use('/api/requests', require('./routes/requests'));
app.use('/api/student', require('./routes/student'));
app.use('/api/pdf', require('./routes/pdf'));


app.use('/api/admin', adminRouter);

// 404 handler para rutas /api/* no encontradas
app.use('/api', (req, res, next) => {
	res.status(404).json({ error: 'API endpoint not found' });
});

// Middleware global para errores en /api/*
app.use('/api', (err, req, res, next) => {
	if (res.headersSent) return next(err);
	const status = err.status || 500;
	res.status(status).json({ error: err.message || 'Error interno del servidor' });
});

// fallback
app.get('*', (req,res)=> res.sendFile(path.join(frontendDir, 'catalogo.html')));

const PORT = process.env.PORT || 3001;
app.listen(PORT, ()=> console.log('Server running on', PORT));
