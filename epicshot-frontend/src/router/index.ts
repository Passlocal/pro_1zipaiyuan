import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/auth/LoginView.vue'),
    meta: { guest: true }
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/views/auth/RegisterView.vue'),
    meta: { guest: true }
  },
  {
    path: '/',
    component: () => import('@/components/layout/AppLayout.vue'),
    children: [
      {
        path: '',
        name: 'Dashboard',
        component: () => import('@/views/project/DashboardView.vue'),
        meta: { requiresAuth: true }
      },
      {
        path: 'workspace',
        name: 'Workspace',
        component: () => import('@/views/workspace/WorkspaceView.vue'),
        meta: { requiresAuth: true }
      },
      {
        path: 'project/:id',
        name: 'ProjectDetail',
        component: () => import('@/views/project/ProjectDetailView.vue'),
        meta: { requiresAuth: true }
      },
      {
        path: 'project/:id/timeline',
        name: 'ProjectTimeline',
        component: () => import('@/views/project/TimelineView.vue'),
        meta: { requiresAuth: true }
      },
      {
        path: 'project/:id/color-check',
        name: 'ColorCheck',
        component: () => import('@/views/project/ColorCheckView.vue'),
        meta: { requiresAuth: true }
      },
      {
        path: 'project/:id/portfolio',
        name: 'PortfolioEditor',
        component: () => import('@/views/portfolio/PortfolioEditorView.vue'),
        meta: { requiresAuth: true }
      },
      {
        path: 'portfolio/:id',
        name: 'PortfolioView',
        component: () => import('@/views/portfolio/PortfolioViewView.vue'),
        meta: { requiresAuth: true }
      }
    ]
  },
  // 客户免登录视图
  {
    path: '/client/project/:shareToken',
    name: 'ClientProject',
    component: () => import('@/views/client/ClientProjectView.vue')
  },
  {
    path: '/client/assets',
    name: 'ClientAssets',
    component: () => import('@/views/client/ClientAssetsView.vue')
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFoundView.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, _from, next) => {
  const auth = useAuthStore()

  if (to.meta.requiresAuth && !auth.isLoggedIn) {
    return next({ path: '/login', query: { redirect: to.fullPath } })
  }

  if (to.meta.guest && auth.isLoggedIn) {
    return next('/')
  }

  next()
})

export default router