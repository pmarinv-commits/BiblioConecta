const express = require('express');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bodyParser = require('body-parser');
const passport = require('passport');
const cookieSession = require('cookie-session');
const cors = require('cors');

const app = express();
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

// passport
try{ require('./services/passport')(passport); app.use(passport.initialize()); app.use(passport.session()); }catch(e){ console.warn('Passport init error', e.message) }

// routes
const { adminRouter } = require('./routes/admin');
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/admin/auth', require('./routes/adminAuth'));
app.use('/api/libros', require('./routes/libros'));
app.use('/api/requests', require('./routes/requests'));
app.use('/api/student', require('./routes/student'));
app.use('/api/pdf', require('./routes/pdf'));
app.use('/api/admin', adminRouter);

// fallback
app.get('*', (req,res)=> res.sendFile(path.join(__dirname,'../frontend/catalogo.html')));

const PORT = process.env.PORT || 3001;
app.listen(PORT, ()=> console.log('Server running on', PORT));
