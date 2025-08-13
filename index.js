// index.js
const express = require('express');
const cookieParser = require('cookie-parser');
const { PrismaClient } = require('@prisma/client');
const path = require('path');

const prisma = new PrismaClient();
const app = express();

// ===== View engine =====
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'pages', 'views'));

// ===== Core middleware =====
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ===== locals bootstrap (currentUser + path) =====
app.use(async (req, res, next) => {
  try {
    const uid = req.cookies.userId ? Number(req.cookies.userId) : null;
    if (uid) {
      res.locals.currentUser = await prisma.user.findUnique({
        where: { id: uid },
        include: {
          userRoles: {
            include: {
              role: {
                include: { permissions: { include: { permission: true } } }
              }
            }
          }
        }
      });
    } else {
      res.locals.currentUser = null;
    }
  } catch (e) {
    console.error('Error loading currentUser:', e);
    res.locals.currentUser = null;
  }
  res.locals.path = req.path || '/';
  next();
});

// ===== routes requires (تأكد الملفات موجودة عندك) =====
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const adminRoutes = require('./routes/admin');
const baManagerRoutes = require('./routes/ba_manager');
const saManagerRoutes = require('./routes/sa_manager');
const devManagerRoutes = require('./routes/dev_manager');
const uatManagerRoutes = require('./routes/uat_manager');
const qcManagerRoutes = require('./routes/qc_manager');
const adminFeaturesRoutes = require('./routes/admin_features');

// ===== mount routes (اتجنب التكرار) =====
app.use('/', authRoutes);
app.use('/', baManagerRoutes);
app.use('/', qcManagerRoutes);
app.use('/', devManagerRoutes);
app.use('/', uatManagerRoutes);
app.use('/', saManagerRoutes);
app.use('/', adminFeaturesRoutes);
app.use('/', adminRoutes);
app.use('/', dashboardRoutes);

// ===== Home =====
app.get('/', async (req, res) => {
  try {
    const user = res.locals.currentUser;

    // احسب مؤشرات عامة
    const [totalProjects, totalUsers] = await Promise.all([
      prisma.project.count(),
      prisma.user.count({ where: { status: 'approved' } })
    ]);

    // مؤشرات خاصة بالمستخدم (لو لوج إن)
    let myProjects = 0;
    let myAssigns = 0;
    if (user) {
      [myProjects, myAssigns] = await Promise.all([
        prisma.project.count({ where: { ownerId: user.id } }),
        prisma.assignment.count({ where: { userId: user.id } })
      ]);
    }

    const insights = {
      totalProjects,
      totalUsers,
      myProjects,
      myAssigns
    };

    return res.render('home', { user, insights });
  } catch (e) {
    console.error('Home route error:', e);
    // حتى لو حصل خطأ، ابعت insights فاضية علشان الـ view ميفشلش
    return res.render('home', {
      user: res.locals.currentUser,
      insights: { totalProjects: 0, totalUsers: 0, myProjects: 0, myAssigns: 0 }
    });
  }
});

// ===== 404 =====
app.use((req, res) => res.status(404).send('Page not found'));

// ===== start =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on http://localhost:${PORT}`));
