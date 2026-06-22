<template>
  <div class="reports-view">
    <div class="reports-header">
      <h1 class="reports-title">报表</h1>
    </div>

    <!-- Tab 切换 -->
    <div class="reports-tabs">
      <button
        class="reports-tab"
        :class="{ active: activeTab === 'finance' }"
        @click="activeTab = 'finance'"
      >月度财务</button>
      <button
        class="reports-tab"
        :class="{ active: activeTab === 'workload' }"
        @click="activeTab = 'workload'"
      >工作量统计</button>
    </div>

    <!-- 月份选择器 -->
    <div class="reports-month-picker">
      <button class="month-nav-btn" @click="prevMonth" :disabled="monthPickerLoading">&lt;</button>
      <span class="month-display">{{ selectedYear }} 年 {{ String(selectedMonth).padStart(2, '0') }} 月</span>
      <button class="month-nav-btn" @click="nextMonth" :disabled="monthPickerLoading">&gt;</button>
    </div>

    <!-- 加载状态 -->
    <div v-if="monthPickerLoading" class="reports-loading">加载中...</div>

    <!-- 月度财务 Tab -->
    <div v-if="activeTab === 'finance' && !monthPickerLoading" class="reports-content">
      <div class="finance-summary-cards">
        <div class="finance-card">
          <div class="finance-card-label">总收入</div>
          <div class="finance-card-value finance-income">¥{{ formatMoney(financeData.totalRevenue) }}</div>
        </div>
        <div class="finance-card">
          <div class="finance-card-label">总支出</div>
          <div class="finance-card-value finance-expense">¥{{ formatMoney(financeData.totalExpense) }}</div>
        </div>
        <div class="finance-card">
          <div class="finance-card-label">总利润</div>
          <div class="finance-card-value" :class="financeData.totalProfit >= 0 ? 'finance-profit' : 'finance-loss'">
            ¥{{ formatMoney(financeData.totalProfit) }}
          </div>
        </div>
      </div>

      <div class="finance-project-table" v-if="financeData.projects && financeData.projects.length > 0">
        <h3 class="section-title">项目明细</h3>
        <table class="data-table">
          <thead>
            <tr>
              <th>项目名称</th>
              <th>合同金额</th>
              <th>支出</th>
              <th>利润</th>
              <th>卡片数</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="proj in financeData.projects" :key="proj.id">
              <td>{{ proj.name }}</td>
              <td>¥{{ formatMoney(proj.contractAmount) }}</td>
              <td>¥{{ formatMoney(proj.expense) }}</td>
              <td :class="proj.profit >= 0 ? 'text-profit' : 'text-loss'">¥{{ formatMoney(proj.profit) }}</td>
              <td>{{ proj.cardCount }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="reports-empty">暂无本月财务数据</div>
    </div>

    <!-- 工作量统计 Tab -->
    <div v-if="activeTab === 'workload' && !monthPickerLoading" class="reports-content">
      <div class="workload-table" v-if="workloadData.length > 0">
        <h3 class="section-title">人员工作量统计</h3>
        <table class="data-table">
          <thead>
            <tr>
              <th>人员</th>
              <th>已解决卡片</th>
              <th>争议卡片</th>
              <th>平均处理时间</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in workloadData" :key="item.userId">
              <td>{{ item.userName }}</td>
              <td>{{ item.resolvedCards }}</td>
              <td>{{ item.disputedCards }}</td>
              <td>{{ item.avgTime || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="reports-empty">暂无本月工作量数据</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import client from '@/api/client'

const activeTab = ref<'finance' | 'workload'>('finance')
const selectedYear = ref(new Date().getFullYear())
const selectedMonth = ref(new Date().getMonth() + 1)
const monthPickerLoading = ref(false)

const financeData = reactive({
  totalRevenue: 0,
  totalExpense: 0,
  totalProfit: 0,
  projects: [] as Array<{
    id: string
    name: string
    contractAmount: number
    expense: number
    profit: number
    cardCount: number
  }>,
})

const workloadData = ref<Array<{
  userId: string
  userName: string
  resolvedCards: number
  disputedCards: number
  avgTime: string
}>>([])

function formatMoney(val: number): string {
  return val.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

async function fetchFinanceData() {
  monthPickerLoading.value = true
  try {
    const res = await client.get('/v1/reports/monthly-finance', {
      params: { year: selectedYear.value, month: selectedMonth.value },
    })
    const data = res.data?.data || {}
    financeData.totalRevenue = data.totalRevenue ?? 0
    financeData.totalExpense = data.totalExpense ?? 0
    financeData.totalProfit = data.totalProfit ?? 0
    financeData.projects = data.projects ?? []
  } catch (e) {
    console.error('加载月度财务失败:', e)
  } finally {
    monthPickerLoading.value = false
  }
}

async function fetchWorkloadData() {
  monthPickerLoading.value = true
  try {
    const res = await client.get('/v1/reports/workload', {
      params: { year: selectedYear.value, month: selectedMonth.value },
    })
    workloadData.value = res.data?.data ?? []
  } catch (e) {
    console.error('加载工作量统计失败:', e)
  } finally {
    monthPickerLoading.value = false
  }
}

function loadCurrentTab() {
  if (activeTab.value === 'finance') {
    fetchFinanceData()
  } else {
    fetchWorkloadData()
  }
}

function prevMonth() {
  if (selectedMonth.value === 1) {
    selectedMonth.value = 12
    selectedYear.value--
  } else {
    selectedMonth.value--
  }
  loadCurrentTab()
}

function nextMonth() {
  if (selectedMonth.value === 12) {
    selectedMonth.value = 1
    selectedYear.value++
  } else {
    selectedMonth.value++
  }
  loadCurrentTab()
}

// 切换 Tab 时重新加载
watch(activeTab, () => {
  loadCurrentTab()
})

// 初始加载
loadCurrentTab()
</script>

<style scoped lang="scss">
.reports-view {
  padding: 24px 32px;
  max-width: 1200px;
  margin: 0 auto;
}
.reports-header {
  margin-bottom: 20px;
}
.reports-title {
  font-size: 22px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0;
}

// Tabs
.reports-tabs {
  display: flex;
  gap: 0;
  margin-bottom: 20px;
  border-bottom: 2px solid #eee;
}
.reports-tab {
  padding: 10px 20px;
  border: none;
  background: none;
  font-size: 14px;
  font-weight: 500;
  color: #666;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  transition: all 0.2s;
  &:hover {
    color: #333;
  }
  &.active {
    color: #4a6cf7;
    border-bottom-color: #4a6cf7;
  }
}

// Month Picker
.reports-month-picker {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}
.month-nav-btn {
  padding: 4px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 16px;
  color: #666;
  &:hover {
    background: #f5f5f5;
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
.month-display {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  min-width: 140px;
  text-align: center;
}

// Loading & Empty
.reports-loading {
  text-align: center;
  padding: 60px 0;
  color: #999;
  font-size: 15px;
}
.reports-empty {
  text-align: center;
  padding: 40px 0;
  color: #999;
  font-size: 14px;
}

// Finance Summary Cards
.finance-summary-cards {
  display: flex;
  gap: 20px;
  margin-bottom: 32px;
}
.finance-card {
  flex: 1;
  padding: 20px 24px;
  background: #fff;
  border: 1px solid #eee;
  border-radius: 10px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}
.finance-card-label {
  font-size: 13px;
  color: #999;
  margin-bottom: 8px;
}
.finance-card-value {
  font-size: 24px;
  font-weight: 700;
  &.finance-income {
    color: #4a6cf7;
  }
  &.finance-expense {
    color: #ea4335;
  }
  &.finance-profit {
    color: #34a853;
  }
  &.finance-loss {
    color: #ea4335;
  }
}

// Section
.section-title {
  font-size: 15px;
  font-weight: 600;
  color: #333;
  margin: 0 0 12px;
}

// Data Table
.data-table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
  border: 1px solid #eee;
  border-radius: 8px;
  overflow: hidden;
  th, td {
    padding: 10px 14px;
    text-align: left;
    font-size: 13px;
    border-bottom: 1px solid #f0f0f0;
  }
  th {
    background: #fafafa;
    font-weight: 600;
    color: #555;
  }
  td {
    color: #333;
  }
  tr:last-child td {
    border-bottom: none;
  }
}
.text-profit {
  color: #34a853;
}
.text-loss {
  color: #ea4335;
}

// ===== FB-003: 移动端按钮热区优化 =====
@media (max-width: 768px) {
  .reports-view {
    padding: 16px;
  }

  .reports-title {
    font-size: 20px;
  }

  .reports-tabs {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .reports-tab {
    white-space: nowrap;
    flex-shrink: 0;
  }

  .reports-month-picker {
    gap: 10px;
  }

  .finance-summary-cards {
    flex-direction: column;
    gap: 12px;
  }

  .finance-card {
    padding: 16px;
  }

  .data-table {
    display: block;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;

    th, td {
      white-space: nowrap;
    }
  }

  .reports-tab,
  .month-nav-btn {
    min-height: 44px;
    min-width: 44px;
    font-size: 16px;
    padding: 12px;
  }
}
</style>