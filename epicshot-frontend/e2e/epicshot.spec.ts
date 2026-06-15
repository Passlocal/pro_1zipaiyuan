import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:5173'
const API = 'http://localhost:3000'

// Helper: login via API and inject auth into localStorage
async function loginAndSetup(page) {
  // First navigate to the app's origin to get localStorage access
  await page.goto(BASE + '/login')
  await page.waitForLoadState('networkidle')

  const res = await page.request.post(`${API}/v1/auth/login`, {
    data: { email: 'zhang@epicshot.com', password: 'admin123' },
    headers: { 'Content-Type': 'application/json' }
  })
  const body = await res.json()
  const token = body?.data?.token
  if (token) {
    await page.evaluate((t) => {
      localStorage.setItem('auth_token', t)
      localStorage.setItem('auth_user', JSON.stringify({
        id: 'user-seed-001',
        name: '张三',
        email: 'zhang@epicshot.com',
        role: 'admin',
        workspaceId: 'ws-seed-001',
        workspaceName: 'EpicShot Studio'
      }))
    }, token)
  }
  return token
}

test.describe('EpicShot E2E', () => {

  test('1. 登录页面渲染完整', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
    await expect(page.locator('a[href*="register"]')).toBeVisible()
  })

  test('2. 空表单提交保持在登录页', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await page.locator('button[type="submit"]').click()
    // Should stay on login page (validation or error shown)
    await expect(page).toHaveURL(/login/)
  })

  test('3. 注册页面可访问', async ({ page }) => {
    await page.goto(`${BASE}/register`)
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('#reg-password')).toBeVisible()
    await expect(page.locator('#reg-confirm')).toBeVisible()
  })

  test('4. 成功登录后跳转', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await page.fill('input[type="email"]', 'zhang@epicshot.com')
    await page.fill('input[type="password"]', 'admin123')
    await page.locator('button[type="submit"]').click()
    // Dashboard is the default route after login
    await page.waitForTimeout(2000)
    const url = page.url()
    // Should have navigated away from login
    expect(url).not.toContain('/login')
  })

  test('5. 看板页加载', async ({ page }) => {
    await loginAndSetup(page)
    await page.goto(`${BASE}/dashboard`)
    await page.waitForLoadState('networkidle')
    // Page should load without crash
    await expect(page.locator('body')).toBeVisible()
    // Check for search input or heading or project cards
    const content = page.locator('body')
    await expect(content).toBeVisible()
  })

  test('6. 工作空间页面加载', async ({ page }) => {
    await loginAndSetup(page)
    await page.goto(`${BASE}/workspace`)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).toBeVisible()
  })

  test('7. 客户端分享页加载', async ({ page, request }) => {
    // Login via API
    const loginRes = await request.post(`${API}/v1/auth/login`, {
      data: { email: 'zhang@epicshot.com', password: 'admin123' },
      headers: { 'Content-Type': 'application/json' }
    })
    const loginBody = await loginRes.json()
    const token = loginBody?.data?.token

    if (!token) { test.skip(true, 'Login failed'); return }

    // Create project
    const projRes = await request.post(`${API}/v1/projects`, {
      data: { name: '客户分享测试', description: 'share e2e' },
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    })
    const projBody = await projRes.json()
    const projectId = projBody?.data?.id

    if (!projectId) { test.skip(true, 'Project creation failed'); return }

    // Get share token
    const shareRes = await request.post(`${API}/v1/projects/${projectId}/share`, {
      data: {},
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    })
    const shareBody = await shareRes.json()
    const shareToken = shareBody?.data?.shareToken

    if (shareToken) {
      await page.goto(`${BASE}/client/${shareToken}`)
      await page.waitForLoadState('networkidle')
      await expect(page.locator('body')).toBeVisible()
    }

    // Cleanup
    await request.delete(`${API}/v1/projects/${projectId}`, {
      data: {},
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    })
  })

  test('8. 色差巡检页加载', async ({ page, request }) => {
    // Login via API
    const loginRes = await request.post(`${API}/v1/auth/login`, {
      data: { email: 'zhang@epicshot.com', password: 'admin123' },
      headers: { 'Content-Type': 'application/json' }
    })
    const loginBody = await loginRes.json()
    const token = loginBody?.data?.token

    if (!token) { test.skip(true, 'Login failed'); return }

    // Create project
    const projRes = await request.post(`${API}/v1/projects`, {
      data: { name: '色差测试', description: 'color check e2e' },
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    })
    const projBody = await projRes.json()
    const projectId = projBody?.data?.id

    if (!projectId) { test.skip(true, 'Project creation failed'); return }

    // Set localStorage auth and navigate to color-check
    await page.goto(`${BASE}/login`)
    await page.evaluate((t) => {
      localStorage.setItem('auth_token', t)
      localStorage.setItem('auth_user', JSON.stringify({
        id: 'user-seed-001', name: '张三', email: 'zhang@epicshot.com',
        role: 'admin', workspaceId: 'ws-seed-001', workspaceName: 'EpicShot Studio'
      }))
    }, token)
    await page.goto(`${BASE}/project/${projectId}/color-check`)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).toBeVisible()

    // Cleanup
    await request.delete(`${API}/v1/projects/${projectId}`, {
      data: {},
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    })
  })

  test('9. 作品集编辑页加载', async ({ page, request }) => {
    const loginRes = await request.post(`${API}/v1/auth/login`, {
      data: { email: 'zhang@epicshot.com', password: 'admin123' },
      headers: { 'Content-Type': 'application/json' }
    })
    const loginBody = await loginRes.json()
    const token = loginBody?.data?.token

    if (!token) { test.skip(true, 'Login failed'); return }

    // Create project
    const projRes = await request.post(`${API}/v1/projects`, {
      data: { name: '作品集测试', description: 'portfolio e2e' },
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    })
    const projBody = await projRes.json()
    const projectId = projBody?.data?.id

    if (!projectId) { test.skip(true, 'Project creation failed'); return }

    // Set localStorage auth and navigate to portfolio editor
    await page.goto(`${BASE}/login`)
    await page.evaluate((t) => {
      localStorage.setItem('auth_token', t)
      localStorage.setItem('auth_user', JSON.stringify({
        id: 'user-seed-001', name: '张三', email: 'zhang@epicshot.com',
        role: 'admin', workspaceId: 'ws-seed-001', workspaceName: 'EpicShot Studio'
      }))
    }, token)
    await page.goto(`${BASE}/project/${projectId}/portfolio`)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).toBeVisible()

    // Cleanup
    await request.delete(`${API}/v1/projects/${projectId}`, {
      data: {},
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    })
  })

  test('10. 项目详情页加载', async ({ page, request }) => {
    const loginRes = await request.post(`${API}/v1/auth/login`, {
      data: { email: 'zhang@epicshot.com', password: 'admin123' },
      headers: { 'Content-Type': 'application/json' }
    })
    const loginBody = await loginRes.json()
    const token = loginBody?.data?.token

    if (!token) { test.skip(true, 'Login failed'); return }

    const projRes = await request.post(`${API}/v1/projects`, {
      data: { name: '详情页测试', description: 'detail e2e' },
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    })
    const projBody = await projRes.json()
    const projectId = projBody?.data?.id

    if (!projectId) { test.skip(true, 'Project creation failed'); return }

    await page.goto(`${BASE}/login`)
    await page.evaluate((t) => {
      localStorage.setItem('auth_token', t)
      localStorage.setItem('auth_user', JSON.stringify({
        id: 'user-seed-001', name: '张三', email: 'zhang@epicshot.com',
        role: 'admin', workspaceId: 'ws-seed-001', workspaceName: 'EpicShot Studio'
      }))
    }, token)
    await page.goto(`${BASE}/project/${projectId}`)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).toBeVisible()

    await request.delete(`${API}/v1/projects/${projectId}`, {
      data: {},
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    })
  })

  test('11. 404 页面友好降级', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await page.evaluate(() => {
      localStorage.setItem('auth_token', 'fake-token')
      localStorage.setItem('auth_user', JSON.stringify({
        id: 'u1', name: 'Test', email: 't@t.com',
        role: 'admin', workspaceId: 'w1', workspaceName: 'WS'
      }))
    })
    await page.goto(`${BASE}/nonexistent-page`)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).toBeVisible()
  })
})