const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const rolesRoutes = require('./routes/roles');
const messageRoutes = require('./routes/message');
const projectsRoutes = require('./routes/projects');
const managerRoutes = require('./routes/manager');
const dashboardRoutes = require('./routes/dashboard');
const adminPermRoutes    = require('./routes/admin_permissions');
const templatesRoutes = require('./routes/templates');     // NEW
const projectDocsRoutes = require('./routes/project_docs'); // UPDATED
const documentsRoutes = require('./routes/documents');      // UPDATED
const baRoutes = require('./routes/ba');
const assignmentsRoutes = require('./routes/assignments');
const projectsAdminRoutes = require('./routes/projects_admin');
const adminFeaturesRoutes = require('./routes/admin_features');
const devBootstrapRoutes = require('./routes/dev_bootstrap');
const { setCurrentUser } = require('./middleware/auth');
const { requireAuth, requireApproved } = require('./middleware/auth');
const { requireFeature } = require('./middleware/permissions');




const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'pages', 'views'));

// expose currentUser to views
app.use(async (req,res,next)=>{
  try{
    const uid=req.cookies.userId;
    if(!uid) res.locals.currentUser=null;
    else {
      res.locals.currentUser = await prisma.user.findUnique({
        where:{ id:Number(uid) },
        include:{ userRoles:{ include:{ role:true }}}
      });
    }
  }catch{ res.locals.currentUser=null; }
  res.locals.path=req.path||'/';
  next();
});

app.get('/', async (req,res)=>{
  const [totalProjects, totalUsers] = await Promise.all([
    prisma.project.count(),
    prisma.user.count({ where:{ status:'approved' }})
  ]);
  const user=res.locals.currentUser;
  let myProjects=0, myAssigns=0;
  if(user){
    [myProjects, myAssigns] = await Promise.all([
      prisma.project.count({ where:{ ownerId:user.id }}),
      prisma.assignment.count({ where:{ userId:user.id }})
    ]);
  }
  res.render('home', { user, insights:{ totalProjects, totalUsers, myProjects, myAssigns }});
});

app.get('/whoami', (req, res) => {
  res.send(req.user ? `Hello ${req.user.name || req.user.email}` : 'Not logged in');
});

app.get('/feature-test', requireAuth, requireApproved, requireFeature('create_project'), (req, res) => {
  res.send('You have create_project ✅');
});

// routes
app.use('/', authRoutes);
app.use('/', adminRoutes);
app.use('/roles', rolesRoutes);
app.use('/', messageRoutes);
app.use('/', projectsRoutes);
app.use('/', managerRoutes);
app.use('/', dashboardRoutes);
app.use('/', adminPermRoutes);
app.use('/', templatesRoutes);
app.use('/', projectDocsRoutes);
app.use('/', documentsRoutes);
app.use('/', baRoutes);
app.use('/', assignmentsRoutes);
app.use('/', projectsAdminRoutes);
app.use('/', adminFeaturesRoutes);
app.use('/', devBootstrapRoutes);
app.use(setCurrentUser);


app.use((req,res)=>res.status(404).send('Page not found'));

const PORT=3000;
app.listen(PORT, ()=>console.log(`Server running on http://localhost:${PORT}`));
