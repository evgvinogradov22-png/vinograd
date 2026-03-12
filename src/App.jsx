import React, { useState, useEffect, useRef } from 'react';
import { Check, ChevronLeft, ChevronRight, Plus, Trash2, Users, ArrowDownLeft, ArrowUpRight, CreditCard, TrendingUp, List, Lock, LogOut, Target, BarChart3, Folder, X, Sparkles, Send, BookOpen, Edit3, Save, Archive, RotateCcw, GripVertical, Calendar, Clock, User, Eye, ChevronDown, Hash, MoreHorizontal, Bell, Search, Settings, Filter, Wallet } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import storage from './storage';

const STORAGE_KEY = 'budget-system-v9';
const AUTH_KEY = 'budget-auth';
const PASSWORD = '1122';
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const DAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const DAYS_FULL = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

const HABIT_COLORS = {
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600', fill: 'bg-emerald-500', border: 'border-emerald-300' },
  blue: { bg: 'bg-blue-100', text: 'text-blue-600', fill: 'bg-blue-500', border: 'border-blue-300' },
  violet: { bg: 'bg-violet-100', text: 'text-violet-600', fill: 'bg-violet-500', border: 'border-violet-300' },
  amber: { bg: 'bg-amber-100', text: 'text-amber-600', fill: 'bg-amber-500', border: 'border-amber-300' },
  rose: { bg: 'bg-rose-100', text: 'text-rose-600', fill: 'bg-rose-500', border: 'border-rose-300' },
  cyan: { bg: 'bg-cyan-100', text: 'text-cyan-600', fill: 'bg-cyan-500', border: 'border-cyan-300' },
};

const TASK_COLORS = {
  blue: { bg: 'bg-blue-500', light: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-500', dot: 'bg-blue-500' },
  red: { bg: 'bg-red-500', light: 'bg-red-100', text: 'text-red-600', border: 'border-red-500', dot: 'bg-red-500' },
  green: { bg: 'bg-emerald-500', light: 'bg-emerald-100', text: 'text-emerald-600', border: 'border-emerald-500', dot: 'bg-emerald-500' },
  amber: { bg: 'bg-amber-500', light: 'bg-amber-100', text: 'text-amber-600', border: 'border-amber-500', dot: 'bg-amber-500' },
  violet: { bg: 'bg-violet-500', light: 'bg-violet-100', text: 'text-violet-600', border: 'border-violet-500', dot: 'bg-violet-500' },
  rose: { bg: 'bg-rose-500', light: 'bg-rose-100', text: 'text-rose-600', border: 'border-rose-500', dot: 'bg-rose-500' },
};

const TASK_TYPES = {
  executor: { icon: User, label: 'Исполнитель', color: 'text-blue-500' },
  control: { icon: Eye, label: 'Контроль', color: 'text-amber-500' },
};

// Компонент авторизации
function LoginScreen({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password === PASSWORD) {
      try {
        await storage.set(AUTH_KEY, 'true');
      } catch (e) {}
      onLogin();
    } else {
      setError(true);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setPassword('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className={`bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm ${shake ? 'animate-shake' : ''}`}>
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg">
            <Lock size={32} className="text-white" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-center text-slate-800 mb-2">Бюджет</h1>
        <p className="text-sm text-center text-slate-500 mb-6">Введите пароль для входа</p>
        
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(false); }}
            placeholder="••••"
            className={`w-full text-center text-2xl tracking-widest px-4 py-4 rounded-xl border-2 focus:outline-none transition-all mb-4 ${
              error ? 'border-red-400 bg-red-50' : 'border-slate-200 focus:border-blue-500'
            }`}
            autoFocus
          />
          {error && <p className="text-red-500 text-sm text-center mb-4">Неверный пароль</p>}
          <button
            type="submit"
            className="w-full py-3 bg-gradient-to-r from-blue-500 to-violet-600 text-white font-medium rounded-xl hover:opacity-90 transition-opacity"
          >
            Войти
          </button>
        </form>
      </div>
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }
        .animate-shake { animation: shake 0.3s ease-in-out; }
      `}</style>
    </div>
  );
}

const defaultData = {
  accounts: [
    { id: 1, name: 'Бизнес', balance: 190000 },
    { id: 2, name: 'Наличка', balance: 0 },
    { id: 3, name: 'Озон', balance: 22000 },
    { id: 4, name: 'Альфа', balance: 0 },
    { id: 5, name: 'Тбанк', balance: 0 },
    { id: 6, name: 'Сбер', balance: 0 },
  ],
  employees: [
    { id: 1, name: 'Саша' },
    { id: 2, name: 'Вадим' },
    { id: 3, name: 'Настя' },
    { id: 4, name: 'Марина' },
    { id: 5, name: 'Ксюша' },
    { id: 6, name: 'Миша' },
    { id: 7, name: 'Дима' },
  ],
  fotSettings: { payDay1: 5, payDay2: 20 },
  credits: [
    { id: 1, name: 'Альфа кредитка', totalDebt: 150000, monthlyPayment: 10000, day: 12 },
    { id: 2, name: 'Альфа Бизнес Кредит', totalDebt: 500000, monthlyPayment: 37000, day: 15 },
    { id: 3, name: 'Ипотека', totalDebt: 5000000, monthlyPayment: 72000, day: 20 },
    { id: 4, name: 'Квартира', totalDebt: 2000000, monthlyPayment: 104000, day: 22 },
    { id: 5, name: 'Сбер кредит', totalDebt: 100000, monthlyPayment: 5600, day: 24 },
    { id: 6, name: 'Сбер Кредитка', totalDebt: 200000, monthlyPayment: 11000, day: 30 },
    { id: 7, name: 'Альфа кредит', totalDebt: 300000, monthlyPayment: 19400, day: 30 },
  ],
  recurringExpenses: [
    { id: 1, name: 'Питание', amount: 80000, day: 1 },
    { id: 2, name: 'Бассейн Теодор', amount: 15600, day: 1 },
    { id: 3, name: 'Развивашки Теодор', amount: 9000, day: 5 },
  ],
  dds: {},
  salaries: {
    '2026-03': {
      1: { pay1: 14825, pay2: 14825 },
      2: { pay1: 35100, pay2: 35100 },
      3: { pay1: 16200, pay2: 16200 },
      4: { pay1: 15300, pay2: 15300 },
      5: { pay1: 15000, pay2: 15000 },
      6: { pay1: 2850, pay2: 2850 },
      7: { pay1: 7200, pay2: 7200 },
    }
  },
  months: {
    '2026-03': {
      income: [
        { id: 1, name: 'Алексей Филатов', amount: 260000, day: 5 },
        { id: 2, name: 'Доктор Михайлова', amount: 90000, day: 10 },
        { id: 3, name: 'Андрей Гострый', amount: 100000, day: 10 },
        { id: 4, name: 'Зоя Машакова', amount: 50000, day: 15 },
        { id: 5, name: 'Нутри Крис', amount: 20000, day: 20 },
        { id: 6, name: 'ФОТ 1 часть', amount: 150000, day: 1 },
        { id: 7, name: 'ФОТ 2 часть', amount: 150000, day: 15 },
        { id: 8, name: 'Виолетта', amount: 30000, day: 12 },
        { id: 9, name: 'ФПСП', amount: 500000, day: 25 },
      ],
      expenses: [],
      debts: [
        { id: 1, name: 'Женек', amount: 21000, day: 28 },
        { id: 2, name: 'Дядя Миша', amount: 10000, day: 15 },
      ],
    },
  },
  // Привычки
  habitGroups: [
    { id: 1, name: 'Здоровье', color: 'emerald' },
    { id: 2, name: 'Продуктивность', color: 'blue' },
    { id: 3, name: 'Добавки', color: 'amber', isSystem: true },
  ],
  habits: [
    { id: 1, name: 'Зарядка', groupId: 1, createdAt: '2026-03-01' },
    { id: 2, name: 'Читать 30 мин', groupId: 2, createdAt: '2026-03-01' },
  ],
  habitCompletions: {},
  journal: {},
  // Календарь - проекты
  calendarProjects: [
    { id: 'work', name: 'Работа', color: 'blue', subprojects: [
      { id: 'clients', name: 'Клиенты', color: 'blue' },
      { id: 'internal', name: 'Внутренние', color: 'violet' },
    ]},
    { id: 'personal', name: 'Личное', color: 'green', subprojects: [
      { id: 'health', name: 'Здоровье', color: 'green' },
      { id: 'family', name: 'Семья', color: 'rose' },
    ]},
    { id: 'business', name: 'Бизнес', color: 'amber', subprojects: [] },
  ],
  // Календарь - задачи
  calendarTasks: [
    { id: 1, title: 'Встреча с клиентом', date: '2026-03-11', time: '10:00', endTime: '11:00', duration: 60, color: 'blue', type: 'executor', assignee: null, project: 'clients' },
    { id: 2, title: 'Проверить отчёт Саши', date: '2026-03-11', time: '14:00', endTime: '14:30', duration: 30, color: 'amber', type: 'control', assignee: 'Саша', project: 'internal' },
    { id: 3, title: 'Тренировка', date: '2026-03-11', time: '18:00', endTime: '19:30', duration: 90, color: 'green', type: 'executor', assignee: null, project: 'health' },
    { id: 4, title: 'Code review', date: '2026-03-11', time: '16:00', endTime: '17:00', duration: 60, color: 'violet', type: 'control', assignee: 'Вадим', project: 'internal' },
  ],
};

export default function BudgetSystem() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Текущая дата
  const today = new Date();
  const currentDay = today.getDate();
  const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);
  const [tab, setTab] = useState('habits');
  const [mainTab, setMainTab] = useState('habits');
  
  // Календарь состояния
  const [calendarDate, setCalendarDate] = useState(today);
  const [calendarView, setCalendarView] = useState('week'); // day, week, month, agenda
  const [selectedProject, setSelectedProject] = useState('all');
  const [expandedProjects, setExpandedProjects] = useState(['work', 'personal']);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', date: todayKey, time: '10:00', endTime: '11:00', duration: 60, color: 'blue', type: 'executor', assignee: null, project: '' });

  useEffect(() => { 
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const result = await storage.get(AUTH_KEY);
      if (result?.value === 'true') {
        setIsAuthenticated(true);
        loadData();
      }
    } catch (e) {}
    setAuthChecked(true);
  };

  const handleLogin = () => {
    setIsAuthenticated(true);
    loadData();
  };

  const handleLogout = async () => {
    try {
      await storage.delete(AUTH_KEY);
    } catch (e) {}
    setIsAuthenticated(false);
    setData(null);
  };

  const loadData = async () => {
    try {
      const result = await storage.get(STORAGE_KEY);
      if (result?.value) {
        let loadedData = JSON.parse(result.value);
        // Автоматически переносим просроченные долги на сегодня
        loadedData = moveOverdueDebtsToToday(loadedData);
        // Добавляем группу "Добавки" если её нет
        loadedData = ensureSupplementsGroup(loadedData);
        setData(loadedData);
        await storage.set(STORAGE_KEY, JSON.stringify(loadedData));
      } else {
        setData(defaultData);
        await storage.set(STORAGE_KEY, JSON.stringify(defaultData));
      }
    } catch (e) { setData(defaultData); }
    setLoading(false);
  };

  // Добавляет группу "Добавки" если её нет
  const ensureSupplementsGroup = (inputData) => {
    const newData = { ...inputData };
    if (!newData.habitGroups) newData.habitGroups = [];
    const hasSupplements = newData.habitGroups.some(g => g.name === 'Добавки' || g.isSystem);
    if (!hasSupplements) {
      newData.habitGroups.push({ id: Date.now(), name: 'Добавки', color: 'amber', isSystem: true });
    }
    return newData;
  };

  // Переносит просроченные долги на текущий день
  const moveOverdueDebtsToToday = (inputData) => {
    const newData = JSON.parse(JSON.stringify(inputData));
    const todayDate = new Date();
    const currentDayNum = todayDate.getDate();
    const currentMonth = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}`;
    
    // Проверяем долги текущего месяца
    if (newData.months?.[currentMonth]?.debts) {
      newData.months[currentMonth].debts = newData.months[currentMonth].debts.map(debt => {
        if (debt.day < currentDayNum) {
          return { ...debt, day: currentDayNum };
        }
        return debt;
      });
    }
    
    // Переносим долги из прошлых месяцев в текущий
    Object.keys(newData.months || {}).forEach(monthKey => {
      if (monthKey < currentMonth && newData.months[monthKey]?.debts?.length > 0) {
        if (!newData.months[currentMonth]) {
          newData.months[currentMonth] = { income: [], expenses: [], debts: [] };
        }
        if (!newData.months[currentMonth].debts) {
          newData.months[currentMonth].debts = [];
        }
        // Переносим каждый долг
        newData.months[monthKey].debts.forEach(debt => {
          newData.months[currentMonth].debts.push({
            ...debt,
            id: Date.now() + Math.random(),
            day: currentDayNum
          });
        });
        // Очищаем долги в прошлом месяце
        newData.months[monthKey].debts = [];
      }
    });
    
    return newData;
  };

  const save = async (newData) => {
    setData(newData);
    try { await storage.set(STORAGE_KEY, JSON.stringify(newData)); } catch (e) {}
  };

  const fmt = (n) => new Intl.NumberFormat('ru-RU').format(n) + ' ₽';
  const fmtShort = (n) => new Intl.NumberFormat('ru-RU').format(n);

  const parseMonthKey = (key) => {
    const [y, m] = key.split('-').map(Number);
    return { year: y, month: m };
  };

  const getPrevMonthKey = (key) => {
    const { year, month } = parseMonthKey(key);
    const d = new Date(year, month - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  const getMonthData = () => data.months[selectedMonth] || { income: [], expenses: [], debts: [] };
  const getDDS = () => data.dds[selectedMonth] || [];
  
  const ensureMonth = (key) => {
    if (!data.months[key]) {
      const newData = JSON.parse(JSON.stringify(data));
      newData.months[key] = { income: [], expenses: [], debts: [] };
      save(newData);
      return newData;
    }
    return data;
  };

  // Проверка что месяц не раньше марта 2026
  const MIN_MONTH = '2026-03';
  
  const changeMonth = (dir) => {
    const { year, month } = parseMonthKey(selectedMonth);
    const d = new Date(year, month - 1 + dir, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    
    // Не даём уйти раньше марта 2026
    if (key < MIN_MONTH) return;
    
    ensureMonth(key);
    setSelectedMonth(key);
  };

  // Отметить как выполненное — переносит в ДДС
  const markDone = (type, item, extra = {}) => {
    const newData = JSON.parse(JSON.stringify(data));
    if (!newData.dds[selectedMonth]) newData.dds[selectedMonth] = [];
    
    const ddsEntry = {
      id: Date.now(),
      date: new Date().toISOString(),
      day: item.day || extra.day,
      type,
      name: item.name || extra.name,
      amount: item.amount || extra.amount,
      ...extra
    };
    newData.dds[selectedMonth].push(ddsEntry);
    
    // Удаляем из плана
    if (type === 'income' || type === 'expenses' || type === 'debts') {
      const listType = type;
      if (newData.months[selectedMonth] && newData.months[selectedMonth][listType]) {
        newData.months[selectedMonth][listType] = newData.months[selectedMonth][listType].filter(i => i.id !== item.id);
      }
    }
    
    save(newData);
  };

  const markEmployeeDone = (emp, payNum) => {
    const newData = JSON.parse(JSON.stringify(data));
    if (!newData.dds[selectedMonth]) newData.dds[selectedMonth] = [];
    
    const day = payNum === 1 ? data.fotSettings.payDay1 : data.fotSettings.payDay2;
    const salary = data.salaries?.[selectedMonth]?.[emp.id] || { pay1: 0, pay2: 0 };
    const amount = payNum === 1 ? salary.pay1 : salary.pay2;
    
    newData.dds[selectedMonth].push({
      id: Date.now(),
      date: new Date().toISOString(),
      day,
      type: 'salary',
      name: `${emp.name} (выплата ${payNum})`,
      amount,
      employeeId: emp.id,
      payNum
    });
    
    save(newData);
  };

  const markCreditDone = (credit) => {
    const newData = JSON.parse(JSON.stringify(data));
    if (!newData.dds[selectedMonth]) newData.dds[selectedMonth] = [];
    
    newData.dds[selectedMonth].push({
      id: Date.now(),
      date: new Date().toISOString(),
      day: credit.day,
      type: 'credit',
      name: credit.name,
      amount: credit.monthlyPayment,
      creditId: credit.id
    });
    
    save(newData);
  };

  const removeDDS = (id) => {
    const newData = JSON.parse(JSON.stringify(data));
    newData.dds[selectedMonth] = newData.dds[selectedMonth].filter(d => d.id !== id);
    save(newData);
  };

  const add = (type) => {
    const current = ensureMonth(selectedMonth);
    const newData = JSON.parse(JSON.stringify(current));
    if (!newData.months[selectedMonth]) newData.months[selectedMonth] = { income: [], expenses: [], debts: [] };
    if (!newData.months[selectedMonth][type]) newData.months[selectedMonth][type] = [];
    
    // Определяем день: если текущий месяц — сегодняшний день, иначе 1
    const { year, month } = parseMonthKey(selectedMonth);
    const isCurrentMonth = selectedMonth === currentMonthKey;
    const defaultDay = isCurrentMonth ? currentDay : 1;
    
    newData.months[selectedMonth][type].push({ id: Date.now(), name: '', amount: 0, day: defaultDay });
    save(newData);
  };

  const remove = (type, id) => {
    const newData = JSON.parse(JSON.stringify(data));
    newData.months[selectedMonth][type] = newData.months[selectedMonth][type].filter(i => i.id !== id);
    save(newData);
  };

  const update = (type, id, field, value) => {
    const newData = JSON.parse(JSON.stringify(data));
    const item = newData.months[selectedMonth][type].find(i => i.id === id);
    if (item) item[field] = field === 'name' ? value : Number(value);
    save(newData);
  };

  const updateAccount = (id, balance) => {
    const newData = JSON.parse(JSON.stringify(data));
    const acc = newData.accounts.find(a => a.id === id);
    if (acc) acc.balance = Number(balance);
    save(newData);
  };

  const addEmployee = () => {
    const newData = JSON.parse(JSON.stringify(data));
    const newId = Date.now();
    newData.employees.push({ id: newId, name: '' });
    // Инициализируем зарплату для текущего месяца
    if (!newData.salaries) newData.salaries = {};
    if (!newData.salaries[selectedMonth]) newData.salaries[selectedMonth] = {};
    newData.salaries[selectedMonth][newId] = { pay1: 0, pay2: 0 };
    save(newData);
  };

  const updateEmployee = (id, field, value) => {
    const newData = JSON.parse(JSON.stringify(data));
    if (field === 'name') {
      const emp = newData.employees.find(e => e.id === id);
      if (emp) emp.name = value;
    } else {
      // pay1 или pay2 — сохраняем для текущего месяца
      if (!newData.salaries) newData.salaries = {};
      if (!newData.salaries[selectedMonth]) newData.salaries[selectedMonth] = {};
      if (!newData.salaries[selectedMonth][id]) newData.salaries[selectedMonth][id] = { pay1: 0, pay2: 0 };
      newData.salaries[selectedMonth][id][field] = Number(value);
    }
    save(newData);
  };

  const removeEmployee = (id) => {
    const newData = JSON.parse(JSON.stringify(data));
    newData.employees = newData.employees.filter(e => e.id !== id);
    save(newData);
  };

  // Получить зарплату сотрудника за текущий месяц
  const getEmployeeSalary = (empId) => {
    return data.salaries?.[selectedMonth]?.[empId] || { pay1: 0, pay2: 0 };
  };

  const updateFotSettings = (field, value) => {
    const newData = JSON.parse(JSON.stringify(data));
    newData.fotSettings[field] = Number(value);
    save(newData);
  };

  const addCredit = () => {
    const newData = JSON.parse(JSON.stringify(data));
    newData.credits.push({ id: Date.now(), name: '', totalDebt: 0, monthlyPayment: 0, day: 1 });
    save(newData);
  };

  const updateCredit = (id, field, value) => {
    const newData = JSON.parse(JSON.stringify(data));
    const credit = newData.credits.find(c => c.id === id);
    if (credit) credit[field] = field === 'name' ? value : Number(value);
    save(newData);
  };

  const removeCredit = (id) => {
    const newData = JSON.parse(JSON.stringify(data));
    newData.credits = newData.credits.filter(c => c.id !== id);
    save(newData);
  };

  // Постоянные расходы
  const addRecurringExpense = () => {
    const newData = JSON.parse(JSON.stringify(data));
    if (!newData.recurringExpenses) newData.recurringExpenses = [];
    newData.recurringExpenses.push({ id: Date.now(), name: '', amount: 0, day: 1 });
    save(newData);
  };

  const updateRecurringExpense = (id, field, value) => {
    const newData = JSON.parse(JSON.stringify(data));
    const expense = newData.recurringExpenses.find(e => e.id === id);
    if (expense) expense[field] = field === 'name' ? value : Number(value);
    save(newData);
  };

  const removeRecurringExpense = (id) => {
    const newData = JSON.parse(JSON.stringify(data));
    newData.recurringExpenses = newData.recurringExpenses.filter(e => e.id !== id);
    save(newData);
  };

  const markRecurringExpenseDone = (expense) => {
    const newData = JSON.parse(JSON.stringify(data));
    if (!newData.dds[selectedMonth]) newData.dds[selectedMonth] = [];
    
    newData.dds[selectedMonth].push({
      id: Date.now(),
      date: new Date().toISOString(),
      day: expense.day,
      type: 'recurring',
      name: expense.name,
      amount: expense.amount,
      recurringId: expense.id
    });
    
    save(newData);
  };

  const skipRecurringExpense = (expense) => {
    const newData = JSON.parse(JSON.stringify(data));
    if (!newData.months[selectedMonth]) newData.months[selectedMonth] = { income: [], expenses: [], debts: [] };
    if (!newData.months[selectedMonth].debts) newData.months[selectedMonth].debts = [];
    
    const { month: m } = parseMonthKey(selectedMonth);
    newData.months[selectedMonth].debts.push({
      id: Date.now(),
      name: `${expense.name} (просрочка ${expense.day} ${MONTHS_SHORT[m - 1]})`,
      amount: expense.amount,
      day: expense.day,
      originalType: 'recurring',
      recurringId: expense.id,
      isOverdue: true
    });
    
    if (!newData.skippedRecurring) newData.skippedRecurring = {};
    if (!newData.skippedRecurring[selectedMonth]) newData.skippedRecurring[selectedMonth] = [];
    newData.skippedRecurring[selectedMonth].push(expense.id);
    
    save(newData);
  };

  // Перенести ВСЕ просроченные в долги
  const transferAllOverdueToDebts = () => {
    const newData = JSON.parse(JSON.stringify(data));
    if (!newData.months[selectedMonth]) newData.months[selectedMonth] = { income: [], expenses: [], debts: [] };
    if (!newData.months[selectedMonth].debts) newData.months[selectedMonth].debts = [];
    if (!newData.skippedRecurring) newData.skippedRecurring = {};
    if (!newData.skippedRecurring[selectedMonth]) newData.skippedRecurring[selectedMonth] = [];
    if (!newData.skippedCredits) newData.skippedCredits = {};
    if (!newData.skippedCredits[selectedMonth]) newData.skippedCredits[selectedMonth] = [];
    
    const { month: m } = parseMonthKey(selectedMonth);
    let transferred = 0;
    
    // Просроченные постоянные расходы
    const overdueRecurring = (newData.recurringExpenses || []).filter(e => 
      !newData.skippedRecurring[selectedMonth].includes(e.id) && 
      !(newData.dds?.[selectedMonth] || []).some(d => d.type === 'recurring' && d.recurringId === e.id) &&
      e.day < currentDay
    );
    
    overdueRecurring.forEach(expense => {
      newData.months[selectedMonth].debts.push({
        id: Date.now() + transferred,
        name: `${expense.name} (просрочка ${expense.day} ${MONTHS_SHORT[m - 1]})`,
        amount: expense.amount,
        day: currentDay,
        originalType: 'recurring',
        recurringId: expense.id,
        isOverdue: true
      });
      newData.skippedRecurring[selectedMonth].push(expense.id);
      transferred++;
    });
    
    // Просроченные кредиты
    const overdueCredits = newData.credits.filter(c => 
      !newData.skippedCredits[selectedMonth].includes(c.id) && 
      !(newData.dds?.[selectedMonth] || []).some(d => d.type === 'credit' && d.creditId === c.id) &&
      c.day < currentDay
    );
    
    overdueCredits.forEach(credit => {
      newData.months[selectedMonth].debts.push({
        id: Date.now() + transferred,
        name: `${credit.name} (просрочка ${credit.day} ${MONTHS_SHORT[m - 1]})`,
        amount: credit.monthlyPayment,
        day: currentDay,
        originalType: 'credit',
        creditId: credit.id,
        isOverdue: true
      });
      newData.skippedCredits[selectedMonth].push(credit.id);
      transferred++;
    });
    
    // Просроченные расходы
    const overdueExpenses = (newData.months[selectedMonth].expenses || []).filter(e => e.day < currentDay);
    overdueExpenses.forEach(expense => {
      newData.months[selectedMonth].debts.push({
        id: Date.now() + transferred,
        name: `${expense.name} (просрочка ${expense.day} ${MONTHS_SHORT[m - 1]})`,
        amount: expense.amount,
        day: currentDay,
        originalType: 'expense',
        isOverdue: true
      });
      transferred++;
    });
    // Удаляем просроченные расходы из списка расходов
    newData.months[selectedMonth].expenses = (newData.months[selectedMonth].expenses || []).filter(e => e.day >= currentDay);
    
    if (transferred > 0) {
      save(newData);
    }
  };

  const isRecurringPaid = (id) => (data.dds?.[selectedMonth] || []).some(d => d.type === 'recurring' && d.recurringId === id);
  const isRecurringSkipped = (id) => data.skippedRecurring?.[selectedMonth]?.includes(id);

  // === КАЛЕНДАРЬ ===
  const fmtDateCal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const isTodayCal = (date) => fmtDateCal(date) === fmtDateCal(today);
  const isSelectedCal = (date) => fmtDateCal(date) === fmtDateCal(calendarDate);
  const [draggedTask, setDraggedTask] = useState(null);
  const [resizingTask, setResizingTask] = useState(null);
  const [resizeStartY, setResizeStartY] = useState(0);
  const [resizeStartDuration, setResizeStartDuration] = useState(0);
  const [showAddProject, setShowAddProject] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', color: 'blue', parentId: null });
  const [editingTask, setEditingTask] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const calendarGridRef = useRef(null);
  
  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);
  
  // Auto-scroll to current time on mount and view change
  useEffect(() => {
    if (calendarGridRef.current && (calendarView === 'week' || calendarView === 'day')) {
      const now = new Date();
      const currentHour = now.getHours();
      const scrollTo = Math.max(0, (currentHour - 7) * 60 - 60); // Scroll to 1 hour before current
      calendarGridRef.current.scrollTop = scrollTo;
    }
  }, [calendarView, mainTab]);
  
  // Клик на пустую ячейку - создать задачу
  const handleCellClick = (date, hourWithMinutes = 10) => {
    const dateStr = fmtDateCal(date);
    const hour = Math.floor(hourWithMinutes);
    const minutes = Math.round((hourWithMinutes - hour) * 60 / 15) * 15;
    const endTotalMin = hour * 60 + minutes + 60;
    const endHour = Math.floor(endTotalMin / 60);
    const endMin = endTotalMin % 60;
    
    setNewTask({
      title: '',
      description: '',
      date: dateStr,
      time: `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
      endTime: `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`,
      duration: 60,
      color: 'blue',
      type: 'executor',
      assignee: null,
      project: selectedProject !== 'all' ? selectedProject : ''
    });
    setShowAddTask(true);
  };
  
  // Resize handlers
  const handleResizeStart = (e, task) => {
    e.stopPropagation();
    e.preventDefault();
    setResizingTask(task);
    setResizeStartY(e.clientY);
    setResizeStartDuration(task.duration || 60);
  };
  
  const handleResizeMove = (e) => {
    if (!resizingTask) return;
    const deltaY = e.clientY - resizeStartY;
    const deltaMinutes = Math.round(deltaY / 60 * 60 / 15) * 15; // snap to 15 min
    const newDuration = Math.max(15, Math.min(480, resizeStartDuration + deltaMinutes)); // 15min - 8hours
    
    const startHour = parseInt(resizingTask.time.split(':')[0]);
    const startMin = parseInt(resizingTask.time.split(':')[1]);
    const endTotalMin = startHour * 60 + startMin + newDuration;
    const endHour = Math.floor(endTotalMin / 60);
    const endMin = endTotalMin % 60;
    
    updateCalendarTask(resizingTask.id, {
      duration: newDuration,
      endTime: `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`
    });
  };
  
  const handleResizeEnd = () => {
    setResizingTask(null);
  };
  
  // Global mouse handlers for resize
  useEffect(() => {
    if (resizingTask) {
      const handleMove = (e) => handleResizeMove(e);
      const handleUp = () => handleResizeEnd();
      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleUp);
      return () => {
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleUp);
      };
    }
  }, [resizingTask, resizeStartY, resizeStartDuration]);
  
  const getCalendarMonthDays = () => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = (firstDay.getDay() + 6) % 7;
    const days = [];
    
    for (let i = startPad - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: d, isCurrentMonth: false });
    }
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }
    while (days.length < 42) {
      const d = new Date(year, month + 1, days.length - lastDay.getDate() - startPad + 1);
      days.push({ date: d, isCurrentMonth: false });
    }
    return days;
  };
  
  const getCalendarWeekDays = () => {
    const start = new Date(calendarDate);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  };
  
  // Получить финансовые события на дату
  const getFinancialEventsForDate = (date) => {
    const day = date.getDate();
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const events = [];
    
    // Кредиты
    (data?.credits || []).forEach(credit => {
      if (credit.day === day) {
        const isPaid = (data?.dds?.[monthKey] || []).some(d => d.type === 'credit' && d.creditId === credit.id);
        events.push({
          id: `credit-${credit.id}-${monthKey}`,
          title: credit.name,
          amount: credit.monthlyPayment,
          type: 'credit',
          color: 'rose',
          icon: '💳',
          isPaid
        });
      }
    });
    
    // Постоянные расходы
    (data?.recurringExpenses || []).forEach(expense => {
      if (expense.day === day) {
        const isPaid = (data?.dds?.[monthKey] || []).some(d => d.type === 'recurring' && d.recurringId === expense.id);
        events.push({
          id: `recurring-${expense.id}-${monthKey}`,
          title: expense.name,
          amount: expense.amount,
          type: 'recurring',
          color: 'amber',
          icon: '🔄',
          isPaid
        });
      }
    });
    
    // ФОТ
    const fotSettings = data?.fotSettings || { payDay1: 5, payDay2: 20 };
    if (day === fotSettings.payDay1 || day === fotSettings.payDay2) {
      const salaryData = data?.salaries?.[monthKey] || {};
      const payKey = day === fotSettings.payDay1 ? 'pay1' : 'pay2';
      const totalSalary = Object.values(salaryData).reduce((sum, emp) => sum + (Number(emp[payKey]) || 0), 0);
      if (totalSalary > 0) {
        const isPaid = (data?.dds?.[monthKey] || []).some(d => d.type === 'salary' && d.day === day);
        events.push({
          id: `fot-${payKey}-${monthKey}`,
          title: `ФОТ ${day === fotSettings.payDay1 ? '(аванс)' : '(зп)'}`,
          amount: totalSalary,
          type: 'salary',
          color: 'violet',
          icon: '👥',
          isPaid
        });
      }
    }
    
    // Приходы из бюджета
    const monthData = data?.months?.[monthKey] || {};
    (monthData.income || []).forEach(income => {
      if (income.day === day) {
        const isPaid = (data?.dds?.[monthKey] || []).some(d => d.type === 'income' && d.incomeId === income.id);
        events.push({
          id: `income-${income.id}-${monthKey}`,
          title: income.name,
          amount: income.amount,
          type: 'income',
          color: 'green',
          icon: '💰',
          isPaid
        });
      }
    });
    
    // Долги
    (monthData.debts || []).forEach(debt => {
      if (debt.day === day) {
        const isPaid = (data?.dds?.[monthKey] || []).some(d => d.type === 'debt' && d.debtId === debt.id);
        events.push({
          id: `debt-${debt.id}-${monthKey}`,
          title: debt.name,
          amount: debt.amount,
          type: 'debt',
          color: 'red',
          icon: '📋',
          isPaid
        });
      }
    });
    
    return events;
  };
  
  const [showFinancialEvents, setShowFinancialEvents] = useState(true);
  
  const getTasksForDate = (date) => {
    const dateStr = fmtDateCal(date);
    let tasks = (data?.calendarTasks || []).filter(t => t.date === dateStr);
    if (selectedProject !== 'all') {
      const project = (data?.calendarProjects || []).find(p => p.id === selectedProject);
      if (project) {
        const subIds = project.subprojects?.map(s => s.id) || [];
        tasks = tasks.filter(t => t.project === selectedProject || subIds.includes(t.project));
      } else {
        tasks = tasks.filter(t => t.project === selectedProject);
      }
    }
    return tasks.sort((a, b) => a.time.localeCompare(b.time));
  };
  
  const toggleCalendarProject = (projectId) => {
    setExpandedProjects(prev => 
      prev.includes(projectId) 
        ? prev.filter(p => p !== projectId)
        : [...prev, projectId]
    );
  };
  
  const addCalendarTask = () => {
    if (!newTask.title.trim()) return;
    const newData = { ...data };
    if (!newData.calendarTasks) newData.calendarTasks = [];
    if (!newData.calendarProjects) newData.calendarProjects = [];
    newData.calendarTasks.push({
      ...newTask,
      id: Date.now(),
    });
    save(newData);
    setNewTask({ title: '', description: '', date: todayKey, time: '10:00', endTime: '11:00', duration: 60, color: 'blue', type: 'executor', assignee: null, project: '' });
    setShowAddTask(false);
  };
  
  const updateCalendarTask = (taskId, updates) => {
    const newData = { ...data };
    newData.calendarTasks = (newData.calendarTasks || []).map(t => 
      t.id === taskId ? { ...t, ...updates } : t
    );
    save(newData);
  };
  
  const removeCalendarTask = (taskId) => {
    const newData = { ...data, calendarTasks: (data.calendarTasks || []).filter(t => t.id !== taskId) };
    save(newData);
  };
  
  // === DRAG & DROP SYSTEM ===
  const [dragData, setDragData] = useState(null); // { type: 'task' | 'payment', data: ... }
  const [dropTarget, setDropTarget] = useState(null); // { date, hour, minute }
  
  const handleDragStart = (e, type, data) => {
    e.stopPropagation();
    setDragData({ type, data });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ type, data }));
  };
  
  const handleDragOver = (e, date, hour = null, cellElement = null) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    
    let minute = 0;
    if (hour !== null && cellElement) {
      const rect = cellElement.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      const cellHeight = rect.height;
      minute = Math.floor(relativeY / cellHeight * 60 / 15) * 15;
      if (minute >= 60) minute = 45;
      if (minute < 0) minute = 0;
    }
    
    setDropTarget({ date: fmtDateCal(date), hour, minute });
  };
  
  const handleDragLeave = (e) => {
    e.preventDefault();
    // Only clear if leaving the calendar entirely
    if (!e.relatedTarget || !e.currentTarget.contains(e.relatedTarget)) {
      setDropTarget(null);
    }
  };
  
  const handleDrop = (e, date, hour = null, cellElement = null) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!dragData) {
      // Try to get from dataTransfer
      try {
        const jsonData = e.dataTransfer.getData('text/plain');
        if (jsonData) {
          const parsed = JSON.parse(jsonData);
          setDragData(parsed);
        }
      } catch (err) {}
    }
    
    if (!dragData) {
      setDropTarget(null);
      return;
    }
    
    const dateStr = fmtDateCal(date);
    
    // Calculate drop minute from position
    let minute = 0;
    if (hour !== null && cellElement) {
      const rect = cellElement.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      const cellHeight = rect.height;
      minute = Math.floor(relativeY / cellHeight * 60 / 15) * 15;
      if (minute >= 60) minute = 45;
      if (minute < 0) minute = 0;
    }
    
    if (dragData.type === 'task') {
      // Move existing task
      const task = dragData.data;
      const updates = { date: dateStr };
      
      if (hour !== null) {
        updates.time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        const duration = task.duration || 60;
        const totalMinutes = hour * 60 + minute + duration;
        const endHour = Math.floor(totalMinutes / 60);
        const endMin = totalMinutes % 60;
        updates.endTime = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;
      }
      
      updateCalendarTask(task.id, updates);
    } else if (dragData.type === 'payment') {
      // Create task from payment
      const payment = dragData.data;
      const newData = { ...data };
      if (!newData.calendarTasks) newData.calendarTasks = [];
      
      const time = hour !== null 
        ? `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
        : '10:00';
      const startHour = hour || 10;
      const endHour = startHour + 1;
      
      newData.calendarTasks.push({
        id: Date.now(),
        title: `💰 ${payment.name || payment.type}`,
        description: `Сумма: ${payment.amount?.toLocaleString() || payment.monthlyPayment?.toLocaleString()}₽`,
        date: dateStr,
        time,
        endTime: `${String(endHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
        duration: 60,
        color: payment.type === 'credit' ? 'rose' : payment.type === 'recurring' ? 'amber' : payment.type === 'salary' ? 'violet' : 'red',
        type: 'executor',
        assignee: null,
        project: '',
        paymentData: payment
      });
      
      save(newData);
    }
    
    setDragData(null);
    setDropTarget(null);
  };
  
  const handleDragEnd = () => {
    setDragData(null);
    setDropTarget(null);
  };
  
  // Legacy handlers for compatibility
  const handleTaskDragStart = (e, task) => handleDragStart(e, 'task', task);
  const handleTaskDragOver = (e) => e.preventDefault();
  const handleTaskDrop = (e, newDate, newHour = null) => {
    const cellElement = e.currentTarget;
    handleDrop(e, newDate, newHour, cellElement);
  };
  
  // Управление проектами
  const addCalendarProject = () => {
    if (!newProject.name.trim()) return;
    const newData = { ...data };
    if (!newData.calendarProjects) newData.calendarProjects = [];
    
    const projectId = newProject.name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();
    
    if (newProject.parentId) {
      // Добавляем как подпроект
      newData.calendarProjects = newData.calendarProjects.map(p => {
        if (p.id === newProject.parentId) {
          return {
            ...p,
            subprojects: [...(p.subprojects || []), { id: projectId, name: newProject.name, color: newProject.color }]
          };
        }
        return p;
      });
    } else {
      // Добавляем как основной проект
      newData.calendarProjects.push({
        id: projectId,
        name: newProject.name,
        color: newProject.color,
        subprojects: []
      });
    }
    
    save(newData);
    setNewProject({ name: '', color: 'blue', parentId: null });
    setShowAddProject(false);
  };
  
  const removeCalendarProject = (projectId, parentId = null) => {
    const newData = { ...data };
    
    if (parentId) {
      // Удаляем подпроект
      newData.calendarProjects = newData.calendarProjects.map(p => {
        if (p.id === parentId) {
          return { ...p, subprojects: (p.subprojects || []).filter(s => s.id !== projectId) };
        }
        return p;
      });
    } else {
      // Удаляем основной проект
      newData.calendarProjects = newData.calendarProjects.filter(p => p.id !== projectId);
    }
    
    // Удаляем задачи этого проекта
    newData.calendarTasks = (newData.calendarTasks || []).filter(t => t.project !== projectId);
    
    if (selectedProject === projectId) setSelectedProject('all');
    save(newData);
  };
  
  const [calendarZoom, setCalendarZoom] = useState(1); // 0.5, 0.75, 1, 1.5, 2
  const calendarHours = Array.from({ length: 17 }, (_, i) => i + 7); // 7:00 - 23:00
  const hourHeight = 60 * calendarZoom; // базовая высота часа * zoom

  // === ПРИВЫЧКИ ===
  const [habitView, setHabitView] = useState('week');
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [showAddHabitGroup, setShowAddHabitGroup] = useState(false);
  const [newHabit, setNewHabit] = useState({ name: '', groupId: null, courseDays: null, times: [] });
  const [newHabitGroup, setNewHabitGroup] = useState({ name: '', color: 'emerald' });
  const [editingHabit, setEditingHabit] = useState(null);
  const [editingGroup, setEditingGroup] = useState(null);
  const [quote, setQuote] = useState('Каждый день — новая возможность стать лучше.');
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [journalText, setJournalText] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedJournalDate, setSelectedJournalDate] = useState(null);
  const [habitWeekOffset, setHabitWeekOffset] = useState(0);
  const [habitMonthOffset, setHabitMonthOffset] = useState(0);
  const [draggedHabit, setDraggedHabit] = useState(null);
  const [dragOverHabit, setDragOverHabit] = useState(null);

  const fmtDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const loadQuote = async () => {
    setQuoteLoading(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 100,
          messages: [{ role: "user", content: "Напиши одну короткую мотивирующую цитату на русском для человека работающего над привычками. Только цитату, без кавычек, 1-2 предложения." }]
        })
      });
      const result = await res.json();
      setQuote(result.content?.[0]?.text || 'Маленькие шаги ведут к большим переменам.');
    } catch { setQuote('Маленькие шаги каждый день ведут к большим переменам.'); }
    setQuoteLoading(false);
  };

  const sendJournal = async () => {
    if (!journalText.trim() || !data) return;
    setAiLoading(true);
    let aiText = '';
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 200,
          messages: [{ role: "user", content: `Ты коуч по привычкам. Пользователь написал отчёт о дне: "${journalText}". Дай короткий тёплый ответ (2-3 предложения), отметь хорошее и дай совет. На русском.` }]
        })
      });
      const result = await res.json();
      aiText = result.content?.[0]?.text || 'Отлично! Продолжай в том же духе.';
    } catch { aiText = 'Спасибо за отчёт! Продолжай работать над собой.'; }
    setAiResponse(aiText);
    const newData = { ...data };
    if (!newData.journal) newData.journal = {};
    newData.journal[todayKey] = { text: journalText, aiResponse: aiText, time: today.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) };
    save(newData);
    setAiLoading(false);
  };

  const getWeekDays = (date, weekOffset = 0) => {
    const start = new Date(date);
    const day = start.getDay();
    start.setDate(start.getDate() - day + (day === 0 ? -6 : 1) + (weekOffset * 7));
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  };

  const getMonthDaysHabits = (date, monthOffset = 0) => {
    const targetDate = new Date(date.getFullYear(), date.getMonth() + monthOffset, 1);
    const year = targetDate.getFullYear(), month = targetDate.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: lastDay }, (_, i) => new Date(year, month, i + 1));
  };

  const getHabitMonthName = (monthOffset) => {
    const d = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
    return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  };

  const getHabitWeekRange = (weekOffset) => {
    const days = getWeekDays(today, weekOffset);
    const start = days[0];
    const end = days[6];
    if (start.getMonth() === end.getMonth()) {
      return `${start.getDate()}–${end.getDate()} ${MONTHS_SHORT[start.getMonth()]}`;
    }
    return `${start.getDate()} ${MONTHS_SHORT[start.getMonth()]} – ${end.getDate()} ${MONTHS_SHORT[end.getMonth()]}`;
  };

  const toggleHabitCompletion = (habitId, date) => {
    const key = fmtDate(date);
    const newData = { ...data, habitCompletions: { ...data.habitCompletions } };
    if (!newData.habitCompletions[key]) newData.habitCompletions[key] = [];
    if (newData.habitCompletions[key].includes(habitId)) {
      newData.habitCompletions[key] = newData.habitCompletions[key].filter(id => id !== habitId);
    } else {
      newData.habitCompletions[key] = [...newData.habitCompletions[key], habitId];
    }
    save(newData);
  };

  const isHabitCompleted = (habitId, date) => data?.habitCompletions?.[fmtDate(date)]?.includes(habitId) || false;

  const addHabit = () => {
    if (!newHabit.name.trim() || !data) return;
    const newData = { ...data };
    if (!newData.habits) newData.habits = [];
    newData.habits.push({ 
      id: Date.now(), 
      name: newHabit.name, 
      groupId: newHabit.groupId || data.habitGroups?.[0]?.id, 
      createdAt: todayKey, 
      archived: false,
      courseDays: newHabit.courseDays || null,
      times: newHabit.times || []
    });
    save(newData);
    setNewHabit({ name: '', groupId: null, courseDays: null, times: [] });
    setShowAddHabit(false);
  };

  const archiveHabit = (id) => {
    const newData = { ...data, habits: data.habits.map(h => h.id === id ? { ...h, archived: true, archivedAt: todayKey } : h) };
    save(newData);
  };

  const unarchiveHabit = (id) => {
    const newData = { ...data, habits: data.habits.map(h => h.id === id ? { ...h, archived: false, archivedAt: null } : h) };
    save(newData);
  };

  const updateHabit = (id, updates) => {
    const newData = { ...data, habits: data.habits.map(h => h.id === id ? { ...h, ...updates } : h) };
    save(newData);
  };

  const removeHabit = (id) => {
    const newData = { ...data, habits: data.habits.filter(h => h.id !== id) };
    save(newData);
  };

  const reorderHabits = (dragId, dropId) => {
    if (dragId === dropId || !data?.habits) return;
    const habits = [...data.habits];
    const dragIndex = habits.findIndex(h => h.id === dragId);
    const dropIndex = habits.findIndex(h => h.id === dropId);
    if (dragIndex === -1 || dropIndex === -1) return;
    
    const [draggedItem] = habits.splice(dragIndex, 1);
    // Если перетаскиваем в другую группу — меняем группу
    const dropHabit = data.habits.find(h => h.id === dropId);
    if (dropHabit && draggedItem.groupId !== dropHabit.groupId) {
      draggedItem.groupId = dropHabit.groupId;
    }
    habits.splice(dropIndex, 0, draggedItem);
    
    const newData = { ...data, habits };
    save(newData);
  };

  const handleHabitDragStart = (e, habit) => {
    setDraggedHabit(habit);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', habit.id);
    e.target.style.opacity = '0.5';
  };

  const handleHabitDragEnd = (e) => {
    e.target.style.opacity = '1';
    setDraggedHabit(null);
    setDragOverHabit(null);
  };

  const handleHabitDragOver = (e, habit) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedHabit && habit.id !== draggedHabit.id) {
      setDragOverHabit(habit.id);
    }
  };

  const handleHabitDrop = (e, habit) => {
    e.preventDefault();
    if (draggedHabit && habit.id !== draggedHabit.id) {
      reorderHabits(draggedHabit.id, habit.id);
    }
    setDragOverHabit(null);
  };

  const addHabitGroup = () => {
    if (!newHabitGroup.name.trim() || !data) return;
    const newData = { ...data };
    if (!newData.habitGroups) newData.habitGroups = [];
    newData.habitGroups.push({ id: Date.now(), ...newHabitGroup });
    save(newData);
    setNewHabitGroup({ name: '', color: 'emerald' });
    setShowAddHabitGroup(false);
  };

  const updateHabitGroup = (id, updates) => {
    const newData = { ...data, habitGroups: data.habitGroups.map(g => g.id === id ? { ...g, ...updates } : g) };
    save(newData);
  };

  const removeHabitGroup = (id) => {
    const newData = { ...data, habitGroups: data.habitGroups.filter(g => g.id !== id), habits: data.habits.filter(h => h.groupId !== id) };
    save(newData);
  };

  const deleteJournalEntry = (date) => {
    const newData = { ...data };
    delete newData.journal[date];
    save(newData);
    if (selectedJournalDate === date) setSelectedJournalDate(null);
  };

  if (!authChecked) return <div className="min-h-screen bg-neutral-50 flex items-center justify-center text-neutral-400">Загрузка...</div>;
  
  if (!isAuthenticated) return <LoginScreen onLogin={handleLogin} />;

  if (loading || !data) return <div className="min-h-screen bg-neutral-50 flex items-center justify-center text-neutral-400">Загрузка данных...</div>;

  const md = getMonthData();
  const dds = getDDS();
  const { year, month } = parseMonthKey(selectedMonth);
  const monthName = `${MONTHS[month - 1]} ${year}`;
  
  const totalBalance = data.accounts.reduce((s, a) => s + a.balance, 0);
  
  // Зарплаты за текущий месяц
  const monthSalaries = data.salaries?.[selectedMonth] || {};
  const totalPay1 = data.employees.reduce((s, e) => s + (monthSalaries[e.id]?.pay1 || 0), 0);
  const totalPay2 = data.employees.reduce((s, e) => s + (monthSalaries[e.id]?.pay2 || 0), 0);
  const totalSalary = totalPay1 + totalPay2;
  
  const totalCreditsDebt = data.credits.reduce((s, c) => s + c.totalDebt, 0);
  const totalCreditsMonthly = data.credits.reduce((s, c) => s + c.monthlyPayment, 0);

  // Проверяем что уже в ДДС
  const isEmployeePaid = (empId, payNum) => dds.some(d => d.type === 'salary' && d.employeeId === empId && d.payNum === payNum);
  const isCreditPaid = (creditId) => dds.some(d => d.type === 'credit' && d.creditId === creditId);

  // Постоянные расходы
  const recurringExpenses = data.recurringExpenses || [];
  const totalRecurring = recurringExpenses.reduce((s, e) => s + e.amount, 0);
  const ddsRecurring = dds.filter(d => d.type === 'recurring').reduce((s, d) => s + d.amount, 0);
  const planRecurring = totalRecurring - ddsRecurring;

  // Суммы из ДДС
  const ddsIncome = dds.filter(d => d.type === 'income').reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const ddsExpenses = dds.filter(d => d.type === 'expense').reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const ddsSalary = dds.filter(d => d.type === 'salary').reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const ddsCredits = dds.filter(d => d.type === 'credit').reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const ddsDebts = dds.filter(d => d.type === 'debt').reduce((s, d) => s + (Number(d.amount) || 0), 0);

  // План (что осталось)
  const planIncome = (md.income || []).reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const planExpenses = (md.expenses || []).reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const planDebts = (md.debts || []).reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const planSalary = totalSalary - ddsSalary;
  const planCredits = totalCreditsMonthly - ddsCredits;

  const totalIncome = planIncome + ddsIncome;
  const totalOut = planExpenses + ddsExpenses + totalSalary + totalCreditsMonthly + planDebts + ddsDebts + totalRecurring;
  
  const prevMonthKey = getPrevMonthKey(selectedMonth);
  const prevDDS = data.dds[prevMonthKey] || [];
  const prevIncome = prevDDS.filter(d => d.type === 'income').reduce((s, d) => s + d.amount, 0);
  const prevOut = prevDDS.filter(d => ['expense', 'salary', 'credit', 'debt', 'recurring'].includes(d.type)).reduce((s, d) => s + d.amount, 0);
  const prevBalance = totalBalance; // Упрощённо
  const endBalance = prevBalance + totalIncome - totalOut;

  // Chart data
  const daysInMonth = new Date(year, month, 0).getDate();
  const chartData = [];
  let cumBalance = prevBalance;

  for (let d = 1; d <= daysInMonth; d++) {
    const dayIncome = (md.income || []).filter(i => i.day === d).reduce((s, i) => s + i.amount, 0) +
                      dds.filter(i => i.type === 'income' && i.day === d).reduce((s, i) => s + i.amount, 0);
    const dayExpense = (md.expenses || []).filter(i => i.day === d).reduce((s, i) => s + i.amount, 0) +
                       dds.filter(i => i.type === 'expense' && i.day === d).reduce((s, i) => s + i.amount, 0);
    const dayDebts = (md.debts || []).filter(i => i.day === d).reduce((s, i) => s + i.amount, 0) +
                     dds.filter(i => i.type === 'debt' && i.day === d).reduce((s, i) => s + i.amount, 0);
    const dayCredits = data.credits.filter(c => c.day === d).reduce((s, c) => s + c.monthlyPayment, 0);
    const daySalary = (d === data.fotSettings.payDay1 ? totalPay1 : 0) + (d === data.fotSettings.payDay2 ? totalPay2 : 0);
    const dayRecurring = recurringExpenses.filter(e => e.day === d).reduce((s, e) => s + e.amount, 0);
    
    cumBalance += dayIncome - dayExpense - dayDebts - dayCredits - daySalary - dayRecurring;
    chartData.push({ day: d, balance: cumBalance });
  }

  const firstDay = (new Date(year, month - 1, 1).getDay() + 6) % 7;

  const getAllItemsForDay = (day) => {
    const items = [];
    (md.income || []).filter(i => i.day === day).forEach(i => items.push({ ...i, type: 'income' }));
    (md.expenses || []).filter(i => i.day === day).forEach(i => items.push({ ...i, type: 'expense' }));
    (md.debts || []).filter(i => i.day === day).forEach(i => items.push({ ...i, type: 'debt' }));
    recurringExpenses.filter(e => e.day === day && !isRecurringPaid(e.id) && !isRecurringSkipped(e.id)).forEach(e => items.push({ name: e.name, amount: e.amount, type: 'recurring' }));
    data.credits.filter(c => c.day === day && !isCreditPaid(c.id) && !isCreditSkipped(c.id)).forEach(c => items.push({ name: c.name, amount: c.monthlyPayment, type: 'credit' }));
    if (day === data.fotSettings.payDay1 && data.employees.some(e => !isEmployeePaid(e.id, 1))) items.push({ name: 'ФОТ (1)', amount: totalPay1, type: 'fot' });
    if (day === data.fotSettings.payDay2 && data.employees.some(e => !isEmployeePaid(e.id, 2))) items.push({ name: 'ФОТ (2)', amount: totalPay2, type: 'fot' });
    dds.filter(d => d.day === day).forEach(d => items.push({ ...d, done: true }));
    return items;
  };

  // Пропустить платёж — переносит в долги
  const skipPayment = (type, item) => {
    const newData = JSON.parse(JSON.stringify(data));
    if (!newData.months[selectedMonth].debts) newData.months[selectedMonth].debts = [];
    
    const { year, month: m } = parseMonthKey(selectedMonth);
    const debtName = `${item.name} (просрочка ${item.day} ${MONTHS_SHORT[m - 1]})`;
    
    newData.months[selectedMonth].debts.push({
      id: Date.now(),
      name: debtName,
      amount: item.amount,
      day: item.day,
      originalType: type
    });
    
    // Удаляем из плана
    const listType = type === 'expense' ? 'expenses' : type === 'debt' ? 'debts' : 'income';
    newData.months[selectedMonth][listType] = newData.months[selectedMonth][listType].filter(i => i.id !== item.id);
    
    save(newData);
  };

  const skipCreditPayment = (credit) => {
    const newData = JSON.parse(JSON.stringify(data));
    if (!newData.months[selectedMonth]) newData.months[selectedMonth] = { income: [], expenses: [], debts: [] };
    if (!newData.months[selectedMonth].debts) newData.months[selectedMonth].debts = [];
    
    const { month: m } = parseMonthKey(selectedMonth);
    const debtName = `${credit.name} (просрочка ${credit.day} ${MONTHS_SHORT[m - 1]})`;
    
    newData.months[selectedMonth].debts.push({
      id: Date.now(),
      name: debtName,
      amount: credit.monthlyPayment,
      day: credit.day,
      originalType: 'credit',
      creditId: credit.id
    });
    
    if (!newData.skippedCredits) newData.skippedCredits = {};
    if (!newData.skippedCredits[selectedMonth]) newData.skippedCredits[selectedMonth] = [];
    newData.skippedCredits[selectedMonth].push(credit.id);
    
    save(newData);
  };

  const skipEmployeePayment = (emp, payNum) => {
    const newData = JSON.parse(JSON.stringify(data));
    if (!newData.months[selectedMonth]) newData.months[selectedMonth] = { income: [], expenses: [], debts: [] };
    if (!newData.months[selectedMonth].debts) newData.months[selectedMonth].debts = [];
    
    const day = payNum === 1 ? data.fotSettings.payDay1 : data.fotSettings.payDay2;
    const salary = data.salaries?.[selectedMonth]?.[emp.id] || { pay1: 0, pay2: 0 };
    const amount = payNum === 1 ? salary.pay1 : salary.pay2;
    const { month: m } = parseMonthKey(selectedMonth);
    
    newData.months[selectedMonth].debts.push({
      id: Date.now(),
      name: `${emp.name} ЗП (просрочка ${day} ${MONTHS_SHORT[m - 1]})`,
      amount,
      day,
      originalType: 'salary',
      employeeId: emp.id,
      payNum
    });
    
    if (!newData.skippedSalaries) newData.skippedSalaries = {};
    if (!newData.skippedSalaries[selectedMonth]) newData.skippedSalaries[selectedMonth] = {};
    if (!newData.skippedSalaries[selectedMonth][emp.id]) newData.skippedSalaries[selectedMonth][emp.id] = {};
    newData.skippedSalaries[selectedMonth][emp.id][`pay${payNum}`] = true;
    
    save(newData);
  };

  const isCreditSkipped = (creditId) => data.skippedCredits?.[selectedMonth]?.includes(creditId);
  const isEmployeeSkipped = (empId, payNum) => data.skippedSalaries?.[selectedMonth]?.[empId]?.[`pay${payNum}`];

  // Компонент инпута с локальным стейтом - сохраняет при потере фокуса
  const EditableInput = ({ value, onSave, type = 'text', className, ...props }) => {
    const [localValue, setLocalValue] = useState(value);
    const [focused, setFocused] = useState(false);
    
    useEffect(() => {
      if (!focused) setLocalValue(value);
    }, [value, focused]);
    
    return (
      <input
        type={type}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); onSave(localValue); }}
        onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
        className={className}
        {...props}
      />
    );
  };

  const Row = ({ item, type, onDone, onSkip, onUpdate, onRemove, color, isOverdue }) => (
    <div className={`flex items-center gap-3 px-4 py-3 group ${isOverdue ? 'bg-red-50' : ''}`}>
      <button onClick={onDone} className="w-7 h-7 rounded-lg border-2 border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50 flex items-center justify-center transition-all flex-shrink-0" title="Оплачено">
        <Check size={14} className="text-emerald-400" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {isOverdue && <span className="text-red-500">⚠️</span>}
          <EditableInput 
            value={item.name} 
            onSave={(v) => onUpdate('name', v)} 
            placeholder="Название" 
            className={`bg-transparent focus:outline-none focus:bg-neutral-50 rounded min-w-0 font-medium ${isOverdue ? 'text-red-700' : 'text-neutral-800'}`}
          />
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <select
            value={item.day}
            onChange={(e) => onUpdate('day', parseInt(e.target.value))}
            className="text-xs text-neutral-500 bg-transparent hover:bg-neutral-100 rounded px-1 py-0.5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-300"
          >
            {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
              <option key={d} value={d}>{d} {MONTHS_SHORT[month - 1]}</option>
            ))}
          </select>
        </div>
      </div>
      <EditableInput 
        value={item.amount} 
        onSave={(v) => onUpdate('amount', v)} 
        className={`w-24 text-right bg-transparent focus:outline-none focus:bg-neutral-50 rounded font-semibold flex-shrink-0 ${isOverdue ? 'text-red-600' : color}`} 
      />
    </div>
  );

  // Проверка просрочки - только для текущего месяца
  const isCurrentMonth = selectedMonth === currentMonthKey;
  const isOverdueItem = (item) => isCurrentMonth && item.day < currentDay;

  const Section = ({ title, icon: Icon, items, type, bgColor, iconColor, textColor, isIncome, overdueItems = [] }) => {
    const total = items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const overdueTotal = overdueItems.reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const hasOverdue = overdueItems.length > 0;
    
    return (
      <div className="bg-white rounded-2xl sm:rounded-xl border border-neutral-100 sm:border-neutral-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-neutral-800">{title}</span>
            {hasOverdue && <span className="text-red-500 text-xs">⚠️</span>}
          </div>
          <span className={`text-sm font-semibold ${textColor}`}>{fmt(total)}</span>
        </div>
        <div className="divide-y divide-neutral-100">
          {/* Просроченные сверху */}
          {overdueItems.sort((a, b) => a.day - b.day).map(item => (
            <Row key={item.id} item={item} type={type} color={textColor} isOverdue={true}
              onDone={() => markDone(type, item)}
              onSkip={() => skipPayment(type, item)}
              onUpdate={(field, value) => update(type, item.id, field, value)}
              onRemove={() => remove(type, item.id)}
            />
          ))}
          {/* Обычные */}
          {items.filter(i => !overdueItems.find(o => o.id === i.id)).sort((a, b) => a.day - b.day).map(item => (
            <Row key={item.id} item={item} type={type} color={textColor} isOverdue={false}
              onDone={() => markDone(type, item)}
              onSkip={() => skipPayment(type, item)}
              onUpdate={(field, value) => update(type, item.id, field, value)}
              onRemove={() => remove(type, item.id)}
            />
          ))}
          <button onClick={() => add(type)} className="flex items-center justify-center gap-2 text-sm text-neutral-400 hover:text-neutral-600 py-3 transition-colors w-full">
            <Plus size={16} /> Добавить
          </button>
        </div>
      </div>
    );
  };

  // Активная привычка для отображения в дашборде
  const activeHabitsCount = (data?.habits || []).filter(h => !h.archived).length;
  const todayHabitsDone = (data?.habits || []).filter(h => !h.archived && isHabitCompleted(h.id, today)).length;

  return (
    <div className="min-h-screen bg-neutral-50" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      {/* Desktop Header - верхняя панель с табами */}
      <header className="hidden sm:flex h-14 bg-white border-b border-neutral-200 sticky top-0 z-50 items-center justify-between px-4">
        <div className="flex items-center gap-6">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-violet-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">B</span>
            </div>
            <span className="font-semibold text-neutral-800">Budget App</span>
          </div>
          
          {/* Main Tabs */}
          <nav className="flex items-center gap-1 bg-neutral-100 rounded-lg p-1">
            {[
              { id: 'finance', icon: Wallet, label: 'Финансы' },
              { id: 'habits', icon: Target, label: 'Привычки' },
              { id: 'calendar', icon: Calendar, label: 'Календарь' },
              { id: 'journal', icon: BookOpen, label: 'Дневник' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => { setMainTab(t.id); if (t.id === 'finance') setTab('budget'); if (t.id === 'habits') setTab('habits'); if (t.id === 'journal') setTab('journal'); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  mainTab === t.id ? 'bg-white shadow text-neutral-800' : 'text-neutral-500 hover:text-neutral-700'
                }`}
              >
                <t.icon size={16} />
                {t.label}
              </button>
            ))}
          </nav>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="p-2 hover:bg-neutral-100 rounded-lg text-neutral-500"><Search size={18} /></button>
          <button className="p-2 hover:bg-neutral-100 rounded-lg text-neutral-500"><Settings size={18} /></button>
          <button onClick={handleLogout} className="p-2 hover:bg-red-50 rounded-lg transition-colors group" title="Выйти">
            <LogOut size={18} className="text-neutral-400 group-hover:text-red-500" />
          </button>
        </div>
      </header>

      {/* Mobile Header */}
      <header className="sm:hidden bg-white border-b border-neutral-100 sticky top-0 z-50 safe-area-top">
        <div className="px-4 py-3">
          {mainTab === 'finance' && (
            <>
              <div className="flex items-center justify-between">
                <button onClick={() => changeMonth(-1)} className="w-10 h-10 flex items-center justify-center rounded-full active:bg-neutral-100">
                  <ChevronLeft size={22} className="text-neutral-600" />
                </button>
                <div className="text-center">
                  <h1 className="text-[17px] font-semibold text-neutral-800">{monthName}</h1>
                </div>
                <button onClick={() => changeMonth(1)} className="w-10 h-10 flex items-center justify-center rounded-full active:bg-neutral-100">
                  <ChevronRight size={22} className="text-neutral-600" />
                </button>
              </div>
              <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-hide">
                {[
                  { id: 'budget', label: 'Бюджет' },
                  { id: 'employees', label: 'ФОТ' },
                  { id: 'recurring', label: 'Постоянные' },
                  { id: 'credits', label: 'Кредиты' },
                  { id: 'dds', label: 'ДДС' },
                ].map(t => (
                  <button 
                    key={t.id} 
                    onClick={() => setTab(t.id)} 
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                      tab === t.id ? 'bg-blue-500 text-white' : 'bg-neutral-100 text-neutral-600 active:bg-neutral-200'
                    }`}
                  >
                    {t.label}
                    {t.id === 'dds' && dds.length > 0 && <span className="ml-1.5 bg-white/20 px-1.5 rounded-full text-xs">{dds.length}</span>}
                  </button>
                ))}
              </div>
            </>
          )}
          {mainTab === 'habits' && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-[17px] font-semibold text-neutral-800">
                    {tab === 'habits' ? 'Привычки' : 'Дневник'}
                  </h1>
                  <div className="text-xs text-neutral-400">{currentDay} {MONTHS_SHORT[today.getMonth()]} • {todayHabitsDone}/{activeHabitsCount} выполнено</div>
                </div>
                {tab === 'habits' && (
                  <button onClick={() => setShowAddHabit(true)} className="w-11 h-11 bg-blue-500 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/30 active:scale-95 transition-transform">
                    <Plus size={22} className="text-white" />
                  </button>
                )}
              </div>
              {tab === 'habits' && (
                <div className="flex gap-2 mt-3">
                  {[
                    { id: 'week', label: 'Неделя' },
                    { id: 'month', label: 'Месяц' },
                    { id: 'groups', label: 'Группы' },
                  ].map(t => (
                    <button 
                      key={t.id} 
                      onClick={() => setHabitView(t.id)} 
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                        habitView === t.id ? 'bg-blue-500 text-white' : 'bg-neutral-100 text-neutral-600'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                  {(data?.habits || []).filter(h => h.archived).length > 0 && (
                    <button 
                      onClick={() => setHabitView('archive')} 
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                        habitView === 'archive' ? 'bg-blue-500 text-white' : 'bg-neutral-100 text-neutral-600'
                      }`}
                    >
                      Архив
                    </button>
                  )}
                </div>
              )}
            </>
          )}
          
          {mainTab === 'calendar' && (
            <div className="text-center">
              <h1 className="text-[17px] font-semibold text-neutral-800">Календарь</h1>
            </div>
          )}
          
          {mainTab === 'journal' && (
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-[17px] font-semibold text-neutral-800">Дневник</h1>
                <div className="text-xs text-neutral-400">{currentDay} {MONTHS_SHORT[today.getMonth()]}</div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Bottom Navigation - Mobile Only */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-100 z-50 px-4 pb-6 pt-2 safe-area-bottom">
        <div className="flex items-center justify-around">
          <button onClick={() => { setMainTab('finance'); setTab('budget'); }} className={`flex flex-col items-center gap-1 py-2 px-3 rounded-2xl transition-all ${mainTab === 'finance' ? 'text-blue-600' : 'text-neutral-400'}`}>
            <Wallet size={24} strokeWidth={mainTab === 'finance' ? 2.5 : 1.5} />
            <span className="text-[10px] font-medium">Финансы</span>
          </button>
          <button onClick={() => { setMainTab('habits'); setTab('habits'); }} className={`flex flex-col items-center gap-1 py-2 px-3 rounded-2xl transition-all ${mainTab === 'habits' ? 'text-blue-600' : 'text-neutral-400'}`}>
            <Target size={24} strokeWidth={mainTab === 'habits' ? 2.5 : 1.5} />
            <span className="text-[10px] font-medium">Привычки</span>
          </button>
          <button onClick={() => { setMainTab('calendar'); }} className={`flex flex-col items-center gap-1 py-2 px-3 rounded-2xl transition-all ${mainTab === 'calendar' ? 'text-blue-600' : 'text-neutral-400'}`}>
            <Calendar size={24} strokeWidth={mainTab === 'calendar' ? 2.5 : 1.5} />
            <span className="text-[10px] font-medium">Календарь</span>
          </button>
          <button onClick={() => { setMainTab('journal'); setTab('journal'); }} className={`flex flex-col items-center gap-1 py-2 px-3 rounded-2xl transition-all ${mainTab === 'journal' ? 'text-blue-600' : 'text-neutral-400'}`}>
            <BookOpen size={24} strokeWidth={mainTab === 'journal' ? 2.5 : 1.5} />
            <span className="text-[10px] font-medium">Дневник</span>
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="flex flex-1 pb-20 sm:pb-0">
        {/* Calendar Sidebar - Desktop only */}
        {mainTab === 'calendar' && (
          <aside className="hidden sm:flex w-56 bg-white border-r border-neutral-200 flex-col flex-shrink-0 h-[calc(100vh-56px)] sticky top-14">
            {/* Mini Calendar */}
            <div className="p-3 border-b border-neutral-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-neutral-800">{MONTHS[calendarDate.getMonth()]} {calendarDate.getFullYear()}</span>
                <div className="flex gap-1">
                  <button onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))} className="p-1 hover:bg-neutral-100 rounded text-neutral-400 hover:text-neutral-600">
                    <ChevronLeft size={14} />
                  </button>
                  <button onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))} className="p-1 hover:bg-neutral-100 rounded text-neutral-400 hover:text-neutral-600">
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-0.5 text-center text-xs">
                {DAYS_SHORT.map(d => (
                  <div key={d} className="py-0.5 text-neutral-400 font-medium text-[10px]">{d[0]}</div>
                ))}
                {getCalendarMonthDays().slice(0, 35).map((day, i) => (
                  <button
                    key={i}
                    onClick={() => setCalendarDate(day.date)}
                    className={`py-0.5 rounded text-[10px] transition-colors ${
                      isTodayCal(day.date) ? 'bg-blue-500 text-white font-bold' :
                      isSelectedCal(day.date) ? 'bg-blue-100 text-blue-600 font-medium' :
                      day.isCurrentMonth ? 'text-neutral-700 hover:bg-neutral-100' : 'text-neutral-300'
                    }`}
                  >
                    {day.date.getDate()}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Projects & Filters */}
            <div className="flex-1 overflow-auto p-3">
              {/* All Tasks */}
              <button
                onClick={() => setSelectedProject('all')}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors mb-2 ${
                  selectedProject === 'all' ? 'bg-blue-50 text-blue-600' : 'text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                <Calendar size={14} />
                <span className="font-medium text-xs">Все события</span>
                <span className="ml-auto text-[10px] text-neutral-400">{(data?.calendarTasks || []).length}</span>
              </button>
              
              {/* Projects Section */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">Проекты</span>
                  <button onClick={() => { setNewProject({ name: '', color: 'blue', parentId: null }); setShowAddProject(true); }} className="p-0.5 hover:bg-neutral-100 rounded text-neutral-400 hover:text-neutral-600">
                    <Plus size={12} />
                  </button>
                </div>
                <div className="space-y-0.5">
                  {(data?.calendarProjects || []).map(project => (
                    <button
                      key={project.id}
                      onClick={() => setSelectedProject(project.id)}
                      className={`w-full flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors ${
                        selectedProject === project.id ? 'bg-blue-50 text-blue-600' : 'text-neutral-600 hover:bg-neutral-50'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full ${TASK_COLORS[project.color]?.dot || 'bg-neutral-400'}`} />
                      <span className="truncate">{project.name}</span>
                      <span className="ml-auto text-[10px] text-neutral-400">
                        {(data?.calendarTasks || []).filter(t => t.project === project.id).length}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Toggle payments visibility */}
              <div className="pt-2 border-t border-neutral-100">
                <button
                  onClick={() => setShowFinancialEvents(!showFinancialEvents)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                    showFinancialEvents ? 'bg-emerald-50 text-emerald-600' : 'text-neutral-500 hover:bg-neutral-50'
                  }`}
                >
                  <span>💰</span>
                  <span>Показать платежи</span>
                  <div className={`ml-auto w-6 h-3 rounded-full transition-colors ${showFinancialEvents ? 'bg-emerald-500' : 'bg-neutral-300'}`}>
                    <div className={`w-2 h-2 bg-white rounded-full shadow transition-transform mt-0.5 ${showFinancialEvents ? 'translate-x-3.5 ml-0.5' : 'ml-0.5'}`} />
                  </div>
                </button>
              </div>
            </div>
            
            {/* Add Project Button */}
            <div className="p-3 border-t border-neutral-100">
              <button onClick={() => { setNewProject({ name: '', color: 'blue', parentId: null }); setShowAddProject(true); }} className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50 rounded-lg transition-colors">
                <Plus size={16} />
                Новый проект
              </button>
            </div>
          </aside>
        )}

        {/* Main Content */}
        <main className={`flex-1 ${mainTab === 'calendar' ? 'sm:h-[calc(100vh-56px)] sm:overflow-hidden sm:flex sm:flex-col' : 'max-w-4xl mx-auto'} px-4 py-4 sm:py-6 sm:px-4`}>
        {/* ФИНАНСЫ */}
        {mainTab === 'finance' && (
          <>
        {/* Mobile: Gradient balance card */}
        <div className="sm:hidden bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-4 text-white mb-4">
          <div className="text-sm opacity-80 mb-1">Текущий баланс</div>
          <div className="text-3xl font-bold">{fmt(totalBalance)}</div>
          <div className="flex gap-6 mt-4">
            <div>
              <div className="text-xs opacity-70">Приходы</div>
              <div className="text-lg font-semibold text-emerald-300">+{fmtShort(totalIncome)}</div>
            </div>
            <div>
              <div className="text-xs opacity-70">Расходы</div>
              <div className="text-lg font-semibold text-red-300">−{fmtShort(totalOut)}</div>
            </div>
            <div>
              <div className="text-xs opacity-70">К концу</div>
              <div className={`text-lg font-semibold ${endBalance >= 0 ? 'text-white' : 'text-red-300'}`}>{fmtShort(endBalance)}</div>
            </div>
          </div>
        </div>

        {/* Desktop: Finance sub-header */}
        <div className="hidden sm:flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button onClick={() => changeMonth(-1)} className="p-1.5 hover:bg-neutral-100 rounded-lg"><ChevronLeft size={20} className="text-neutral-400" /></button>
              <span className="text-lg font-semibold text-neutral-800 min-w-[150px] text-center">{monthName}</span>
              <button onClick={() => changeMonth(1)} className="p-1.5 hover:bg-neutral-100 rounded-lg"><ChevronRight size={20} className="text-neutral-400" /></button>
            </div>
          </div>
          <div className="flex bg-neutral-100 rounded-lg p-1">
            {[
              { id: 'budget', label: 'Бюджет' },
              { id: 'employees', label: 'Сотрудники' },
              { id: 'recurring', label: 'Пост.' },
              { id: 'credits', label: 'Кредиты' },
              { id: 'dds', label: 'ДДС' },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} className={`px-3 py-1.5 rounded-md text-sm transition-all ${tab === t.id ? 'bg-white text-neutral-800 shadow-sm font-medium' : 'text-neutral-500'}`}>
                {t.label}
                {t.id === 'dds' && dds.length > 0 && <span className="ml-1 text-xs bg-emerald-500 text-white px-1.5 rounded-full">{dds.length}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Desktop: Original finance state */}
        <div className="hidden sm:block bg-white rounded-xl border border-neutral-200 overflow-hidden mb-4 sm:mb-6">
          <div className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-3 bg-neutral-50 border-b border-neutral-100">
            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-blue-100 flex items-center justify-center"><TrendingUp size={12} className="text-blue-600 sm:w-[14px] sm:h-[14px]" /></div>
            <span className="font-medium text-neutral-700 text-sm sm:text-base">Финансовое состояние</span>
          </div>
          <div className="p-3 sm:p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-3 sm:mb-4">
              <div className="text-center">
                <div className="text-[10px] sm:text-xs text-neutral-400 mb-0.5 sm:mb-1">Начало</div>
                <div className={`text-sm sm:text-lg font-semibold ${prevBalance >= 0 ? 'text-neutral-700' : 'text-red-500'}`}>{fmtShort(prevBalance)}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] sm:text-xs text-neutral-400 mb-0.5 sm:mb-1">Приходы</div>
                <div className="text-sm sm:text-lg font-semibold text-emerald-600">+{fmtShort(totalIncome)}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] sm:text-xs text-neutral-400 mb-0.5 sm:mb-1">Расходы</div>
                <div className="text-sm sm:text-lg font-semibold text-rose-600">−{fmtShort(totalOut)}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] sm:text-xs text-neutral-400 mb-0.5 sm:mb-1">Конец</div>
                <div className={`text-sm sm:text-lg font-semibold ${endBalance >= 0 ? 'text-blue-600' : 'text-red-500'}`}>{fmtShort(endBalance)}</div>
              </div>
            </div>
            <div className="h-32 sm:h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                  <XAxis 
                    dataKey="day" 
                    tick={({ x, y, payload }) => (
                      <text x={x} y={y + 10} textAnchor="middle" fontSize={9} fill={payload.value === currentDay ? '#3b82f6' : '#a3a3a3'} fontWeight={payload.value === currentDay ? 'bold' : 'normal'}>
                        {payload.value}
                      </text>
                    )}
                    stroke="#a3a3a3" 
                    interval="preserveStartEnd" 
                  />
                  <YAxis tick={{ fontSize: 9 }} stroke="#a3a3a3" tickFormatter={v => `${Math.round(v/1000)}K`} width={35} />
                  <Tooltip formatter={(v) => fmt(v)} labelFormatter={(d) => `${d} ${MONTHS_SHORT[month-1]}`} />
                  <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
                  <ReferenceLine x={currentDay} stroke="#3b82f6" strokeDasharray="4 4" strokeWidth={1} />
                  <Line 
                    type="monotone" 
                    dataKey="balance" 
                    stroke="#3b82f6" 
                    strokeWidth={2} 
                    dot={(props) => {
                      const { cx, cy, payload } = props;
                      if (payload.day === currentDay) {
                        return (
                          <g>
                            <circle cx={cx} cy={cy} r={6} fill="#3b82f6" stroke="#fff" strokeWidth={2} />
                            <circle cx={cx} cy={cy} r={10} fill="none" stroke="#3b82f6" strokeWidth={1} opacity={0.3} />
                          </g>
                        );
                      }
                      return null;
                    }}
                    activeDot={{ r: 4, fill: '#3b82f6' }}
                    name="Баланс" 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Счета - скрыто на мобиле (баланс уже в карточке) */}
        <div className="hidden sm:block bg-white rounded-xl border border-neutral-200 p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <span className="text-xs sm:text-sm font-medium text-neutral-500">Счета</span>
            <span className={`text-base sm:text-lg font-semibold ${totalBalance >= 0 ? 'text-neutral-800' : 'text-red-500'}`}>{fmt(totalBalance)}</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            {data.accounts.map(acc => (
              <div key={acc.id} className="bg-neutral-50 rounded-lg p-1.5 sm:p-2.5">
                <div className="text-[10px] sm:text-xs text-neutral-400 mb-0.5 sm:mb-1 truncate">{acc.name}</div>
                <input type="number" value={acc.balance} onChange={(e) => updateAccount(acc.id, e.target.value)} className={`w-full bg-transparent text-xs sm:text-sm font-semibold focus:outline-none ${acc.balance >= 0 ? 'text-neutral-700' : 'text-red-500'}`} />
              </div>
            ))}
          </div>
        </div>

        {tab === 'budget' && (
          <div className="space-y-4">
            {/* Предупреждение о просрочках */}
            {isCurrentMonth && (() => {
              const overdueRecurring = recurringExpenses.filter(e => !isRecurringPaid(e.id) && !isRecurringSkipped(e.id) && e.day < currentDay);
              const overdueCredits = data.credits.filter(c => !isCreditPaid(c.id) && !isCreditSkipped(c.id) && c.day < currentDay);
              const overdueExpenses = (md.expenses || []).filter(i => i.day < currentDay);
              const totalOverdue = overdueRecurring.length + overdueCredits.length + overdueExpenses.length;
              const totalOverdueAmount = 
                overdueRecurring.reduce((s, e) => s + e.amount, 0) +
                overdueCredits.reduce((s, c) => s + c.monthlyPayment, 0) +
                overdueExpenses.reduce((s, e) => s + e.amount, 0);
              
              if (totalOverdue === 0) return null;
              
              return (
                <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-lg">⚠️</span>
                      </div>
                      <div>
                        <div className="font-medium text-red-800">{totalOverdue} просрочено</div>
                        <div className="text-sm text-red-600">{fmt(totalOverdueAmount)}</div>
                      </div>
                    </div>
                    <button 
                      onClick={transferAllOverdueToDebts}
                      className="px-4 py-2 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white rounded-xl text-sm font-medium transition-colors flex-shrink-0"
                    >
                      В долги
                    </button>
                  </div>
                </div>
              );
            })()}
            
            <Section 
              title="Приходы" 
              icon={ArrowDownLeft} 
              items={md.income || []} 
              type="income" 
              bgColor="bg-emerald-100" 
              iconColor="text-emerald-600" 
              textColor="text-emerald-600" 
              isIncome 
              overdueItems={(md.income || []).filter(i => isOverdueItem(i))}
            />
            <Section 
              title="Расходы" 
              icon={ArrowUpRight} 
              items={md.expenses || []} 
              type="expenses" 
              bgColor="bg-amber-100" 
              iconColor="text-amber-600" 
              textColor="text-amber-600" 
              overdueItems={(md.expenses || []).filter(i => isOverdueItem(i))}
            />
            <Section 
              title="Долги (разовые)" 
              icon={CreditCard} 
              items={md.debts || []} 
              type="debts" 
              bgColor="bg-red-100" 
              iconColor="text-red-600" 
              textColor="text-red-600" 
              overdueItems={(md.debts || []).filter(i => isOverdueItem(i))}
            />
            
            {/* ФОТ */}
            <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-neutral-50 border-b border-neutral-100">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-violet-100 flex items-center justify-center"><Users size={14} className="text-violet-600" /></div>
                  <span className="font-medium text-neutral-700">ФОТ</span>
                </div>
                <span className="text-sm font-medium text-violet-600">{fmt(planSalary)}</span>
              </div>
              <div className="px-4 py-2">
                <div className="flex items-center gap-2 py-2 text-sm text-neutral-500">
                  <div className="w-5"></div>
                  <div className="w-16">{data.fotSettings.payDay1} {MONTHS_SHORT[month-1]}</div>
                  <div className="flex-1">Выплата 1</div>
                  <div className="w-24 text-right">{fmt(totalPay1 - dds.filter(d => d.type === 'salary' && d.payNum === 1).reduce((s,d) => s + d.amount, 0))}</div>
                  <div className="w-7"></div>
                </div>
                <div className="flex items-center gap-2 py-2 text-sm text-neutral-500">
                  <div className="w-5"></div>
                  <div className="w-16">{data.fotSettings.payDay2} {MONTHS_SHORT[month-1]}</div>
                  <div className="flex-1">Выплата 2</div>
                  <div className="w-24 text-right">{fmt(totalPay2 - dds.filter(d => d.type === 'salary' && d.payNum === 2).reduce((s,d) => s + d.amount, 0))}</div>
                  <div className="w-7"></div>
                </div>
              </div>
            </div>

            {/* Постоянные расходы */}
            <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-neutral-50 border-b border-neutral-100">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-amber-100 flex items-center justify-center"><ArrowUpRight size={14} className="text-amber-600" /></div>
                  <span className="font-medium text-neutral-700">Постоянные расходы</span>
                  {isCurrentMonth && recurringExpenses.filter(e => !isRecurringPaid(e.id) && !isRecurringSkipped(e.id) && e.day < currentDay).length > 0 && (
                    <span className="text-red-500 text-xs">⚠️ просрочено</span>
                  )}
                </div>
                <span className="text-sm font-medium text-amber-600">{fmt(planRecurring)}</span>
              </div>
              <div className="px-4 py-1">
                {recurringExpenses.filter(e => !isRecurringPaid(e.id) && !isRecurringSkipped(e.id)).sort((a, b) => a.day - b.day).map(expense => {
                  const isOverdue = isCurrentMonth && expense.day < currentDay;
                  return (
                  <div key={expense.id} className={`flex items-center gap-2 py-2.5 border-b border-neutral-100 last:border-0 group ${isOverdue ? 'bg-red-50' : ''}`}>
                    <button onClick={() => markRecurringExpenseDone(expense)} className="w-5 h-5 rounded border-2 border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50 flex items-center justify-center transition-all flex-shrink-0" title="Оплачено">
                      <Check size={12} className="text-emerald-400 group-hover:text-emerald-600" />
                    </button>
                    <button onClick={() => skipRecurringExpense(expense)} className="w-5 h-5 rounded border-2 border-orange-300 hover:border-orange-500 hover:bg-orange-50 flex items-center justify-center transition-all flex-shrink-0 text-[10px] font-bold text-orange-400 hover:text-orange-600" title="Пропустить → в долг">
                      ✕
                    </button>
                    {isOverdue && <span className="text-red-500">⚠️</span>}
                    <div className="w-16 flex-shrink-0">
                      <span className={`text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-neutral-600'}`}>{String(expense.day).padStart(2, '0')}</span>
                      <span className="text-xs text-neutral-400 ml-1">{MONTHS_SHORT[month - 1]}</span>
                    </div>
                    <span className={`flex-1 ${isOverdue ? 'text-red-700 font-medium' : 'text-neutral-700'}`}>{expense.name}</span>
                    <span className={`w-28 text-right font-medium ${isOverdue ? 'text-red-600' : 'text-amber-600'}`}>{fmt(expense.amount)}</span>
                    <div className="w-7"></div>
                  </div>
                  );
                })}
              </div>
            </div>

            {/* Кредиты */}
            <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-neutral-50 border-b border-neutral-100">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-rose-100 flex items-center justify-center"><CreditCard size={14} className="text-rose-600" /></div>
                  <span className="font-medium text-neutral-700">Кредиты</span>
                  {isCurrentMonth && data.credits.filter(c => !isCreditPaid(c.id) && !isCreditSkipped(c.id) && c.day < currentDay).length > 0 && (
                    <span className="text-red-500 text-xs">⚠️ просрочено</span>
                  )}
                </div>
                <span className="text-sm font-medium text-rose-600">{fmt(planCredits)}</span>
              </div>
              <div className="px-4 py-1">
                {data.credits.filter(c => !isCreditPaid(c.id) && !isCreditSkipped(c.id)).sort((a, b) => a.day - b.day).map(credit => {
                  const isOverdue = isCurrentMonth && credit.day < currentDay;
                  return (
                  <div key={credit.id} className={`flex items-center gap-2 py-2.5 border-b border-neutral-100 last:border-0 group ${isOverdue ? 'bg-red-50' : ''}`}>
                    <button onClick={() => markCreditDone(credit)} className="w-5 h-5 rounded border-2 border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50 flex items-center justify-center transition-all flex-shrink-0" title="Оплачено">
                      <Check size={12} className="text-emerald-400 group-hover:text-emerald-600" />
                    </button>
                    <button onClick={() => skipCreditPayment(credit)} className="w-5 h-5 rounded border-2 border-orange-300 hover:border-orange-500 hover:bg-orange-50 flex items-center justify-center transition-all flex-shrink-0 text-[10px] font-bold text-orange-400 hover:text-orange-600" title="Пропустить → в долг">
                      ✕
                    </button>
                    {isOverdue && <span className="text-red-500">⚠️</span>}
                    <div className="w-16 flex-shrink-0">
                      <span className={`text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-neutral-600'}`}>{String(credit.day).padStart(2, '0')}</span>
                      <span className="text-xs text-neutral-400 ml-1">{MONTHS_SHORT[month - 1]}</span>
                    </div>
                    <span className={`flex-1 ${isOverdue ? 'text-red-700 font-medium' : 'text-neutral-700'}`}>{credit.name}</span>
                    <span className={`w-28 text-right font-medium ${isOverdue ? 'text-red-600' : 'text-rose-600'}`}>{fmt(credit.monthlyPayment)}</span>
                    <div className="w-7"></div>
                  </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {tab === 'employees' && (
          <div className="space-y-3 sm:space-y-4">
            <div className="bg-white rounded-xl border border-neutral-200 p-3 sm:p-4">
              <div className="flex items-center gap-2 mb-2 sm:mb-3">
                <Users size={16} className="text-violet-500 sm:w-[18px] sm:h-[18px]" />
                <span className="font-medium text-neutral-700 text-sm sm:text-base">Даты выплат</span>
              </div>
              <div className="flex gap-3 sm:gap-4">
                {[1, 2].map(num => (
                  <div key={num} className="flex items-center gap-1.5 sm:gap-2">
                    <span className="text-xs sm:text-sm text-neutral-500">Выплата {num}:</span>
                    <input type="number" value={data.fotSettings[`payDay${num}`]} onChange={(e) => updateFotSettings(`payDay${num}`, e.target.value)} className="w-10 sm:w-14 text-center bg-neutral-100 rounded-lg px-1 sm:px-2 py-1 sm:py-1.5 text-neutral-700 text-sm font-medium focus:outline-none" min="1" max="31" />
                  </div>
                ))}
              </div>
            </div>

            {/* Мобильная версия: карточки */}
            <div className="sm:hidden space-y-2">
              {data.employees.map(emp => {
                const salary = getEmployeeSalary(emp.id);
                const paid1 = isEmployeePaid(emp.id, 1);
                const paid2 = isEmployeePaid(emp.id, 2);
                const skipped1 = isEmployeeSkipped(emp.id, 1);
                const skipped2 = isEmployeeSkipped(emp.id, 2);
                const done1 = paid1 || skipped1;
                const done2 = paid2 || skipped2;
                return (
                  <div key={emp.id} className="bg-white rounded-xl border border-neutral-200 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <EditableInput value={emp.name} onSave={(v) => updateEmployee(emp.id, 'name', v)} placeholder="Имя" className="font-medium text-neutral-800 bg-transparent focus:outline-none focus:bg-neutral-50 rounded px-1 text-sm" />
                      <span className="text-sm font-semibold text-neutral-700">{fmt(salary.pay1 + salary.pay2)}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center gap-1.5 bg-neutral-50 rounded-lg p-2">
                        <EditableInput value={salary.pay1} onSave={(v) => updateEmployee(emp.id, 'pay1', v)} className={`w-full text-xs font-medium bg-transparent focus:outline-none ${done1 ? 'text-neutral-300 line-through' : 'text-violet-600'}`} />
                        {!done1 && (
                          <>
                            <button onClick={() => markEmployeeDone(emp, 1)} className="w-5 h-5 rounded border-2 border-emerald-300 flex items-center justify-center flex-shrink-0"><Check size={10} className="text-emerald-400" /></button>
                            <button onClick={() => skipEmployeePayment(emp, 1)} className="w-5 h-5 rounded border-2 border-orange-300 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-orange-400">✕</button>
                          </>
                        )}
                        {paid1 && <div className="w-5 h-5 rounded bg-emerald-500 flex items-center justify-center flex-shrink-0"><Check size={10} className="text-white" /></div>}
                        {skipped1 && <div className="w-5 h-5 rounded bg-orange-500 flex items-center justify-center flex-shrink-0 text-[10px] text-white font-bold">!</div>}
                      </div>
                      <div className="flex items-center gap-1.5 bg-neutral-50 rounded-lg p-2">
                        <EditableInput value={salary.pay2} onSave={(v) => updateEmployee(emp.id, 'pay2', v)} className={`w-full text-xs font-medium bg-transparent focus:outline-none ${done2 ? 'text-neutral-300 line-through' : 'text-violet-600'}`} />
                        {!done2 && (
                          <>
                            <button onClick={() => markEmployeeDone(emp, 2)} className="w-5 h-5 rounded border-2 border-emerald-300 flex items-center justify-center flex-shrink-0"><Check size={10} className="text-emerald-400" /></button>
                            <button onClick={() => skipEmployeePayment(emp, 2)} className="w-5 h-5 rounded border-2 border-orange-300 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-orange-400">✕</button>
                          </>
                        )}
                        {paid2 && <div className="w-5 h-5 rounded bg-emerald-500 flex items-center justify-center flex-shrink-0"><Check size={10} className="text-white" /></div>}
                        {skipped2 && <div className="w-5 h-5 rounded bg-orange-500 flex items-center justify-center flex-shrink-0 text-[10px] text-white font-bold">!</div>}
                      </div>
                    </div>
                  </div>
                );
              })}
              <button onClick={addEmployee} className="flex items-center justify-center gap-1 w-full py-2 text-xs text-neutral-400 hover:text-neutral-600 bg-white rounded-xl border border-dashed border-neutral-300">
                <Plus size={12} /> Добавить
              </button>
            </div>

            {/* Десктопная версия: таблица */}
            <div className="hidden sm:block bg-white rounded-xl border border-neutral-200 overflow-hidden">
              <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-neutral-50 border-b border-neutral-100 text-sm font-medium text-neutral-500">
                <div className="col-span-4">Сотрудник</div>
                <div className="col-span-3 text-center">Выплата 1 ({data.fotSettings.payDay1})</div>
                <div className="col-span-3 text-center">Выплата 2 ({data.fotSettings.payDay2})</div>
                <div className="col-span-2 text-right">Итого</div>
              </div>
              <div className="divide-y divide-neutral-100">
                {data.employees.map(emp => {
                  const salary = getEmployeeSalary(emp.id);
                  const paid1 = isEmployeePaid(emp.id, 1);
                  const paid2 = isEmployeePaid(emp.id, 2);
                  const skipped1 = isEmployeeSkipped(emp.id, 1);
                  const skipped2 = isEmployeeSkipped(emp.id, 2);
                  const done1 = paid1 || skipped1;
                  const done2 = paid2 || skipped2;
                  return (
                    <div key={emp.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center group">
                      <div className="col-span-4">
                        <EditableInput value={emp.name} onSave={(v) => updateEmployee(emp.id, 'name', v)} placeholder="Имя" className="w-full bg-transparent text-neutral-700 focus:outline-none focus:bg-neutral-50 rounded px-1" />
                      </div>
                      <div className="col-span-3 flex items-center justify-center gap-1">
                        <EditableInput value={salary.pay1} onSave={(v) => updateEmployee(emp.id, 'pay1', v)} className={`w-20 text-right bg-neutral-50 rounded px-2 py-1 font-medium focus:outline-none ${done1 ? 'text-neutral-300 line-through' : 'text-violet-600'}`} />
                        {!done1 && (
                          <>
                            <button onClick={() => markEmployeeDone(emp, 1)} className="w-5 h-5 rounded border-2 border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50 flex items-center justify-center transition-all" title="Оплачено">
                              <Check size={10} className="text-emerald-400" />
                            </button>
                            <button onClick={() => skipEmployeePayment(emp, 1)} className="w-5 h-5 rounded border-2 border-orange-300 hover:border-orange-500 hover:bg-orange-50 flex items-center justify-center transition-all text-[10px] font-bold text-orange-400" title="В долг">
                              ✕
                            </button>
                          </>
                        )}
                        {paid1 && <div className="w-5 h-5 rounded bg-emerald-500 flex items-center justify-center"><Check size={10} className="text-white" /></div>}
                        {skipped1 && <div className="w-5 h-5 rounded bg-orange-500 flex items-center justify-center text-[10px] text-white font-bold">!</div>}
                      </div>
                      <div className="col-span-3 flex items-center justify-center gap-1">
                        <EditableInput value={salary.pay2} onSave={(v) => updateEmployee(emp.id, 'pay2', v)} className={`w-20 text-right bg-neutral-50 rounded px-2 py-1 font-medium focus:outline-none ${done2 ? 'text-neutral-300 line-through' : 'text-violet-600'}`} />
                        {!done2 && (
                          <>
                            <button onClick={() => markEmployeeDone(emp, 2)} className="w-5 h-5 rounded border-2 border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50 flex items-center justify-center transition-all" title="Оплачено">
                              <Check size={10} className="text-emerald-400" />
                            </button>
                            <button onClick={() => skipEmployeePayment(emp, 2)} className="w-5 h-5 rounded border-2 border-orange-300 hover:border-orange-500 hover:bg-orange-50 flex items-center justify-center transition-all text-[10px] font-bold text-orange-400" title="В долг">
                              ✕
                            </button>
                          </>
                        )}
                        {paid2 && <div className="w-5 h-5 rounded bg-emerald-500 flex items-center justify-center"><Check size={10} className="text-white" /></div>}
                        {skipped2 && <div className="w-5 h-5 rounded bg-orange-500 flex items-center justify-center text-[10px] text-white font-bold">!</div>}
                      </div>
                      <div className="col-span-2 text-right font-medium text-neutral-700">{fmt(salary.pay1 + salary.pay2)}</div>
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-neutral-50 border-t border-neutral-100 font-medium">
                <div className="col-span-4 text-neutral-700">Итого</div>
                <div className="col-span-3 text-center text-violet-600">{fmt(totalPay1)}</div>
                <div className="col-span-3 text-center text-violet-600">{fmt(totalPay2)}</div>
                <div className="col-span-2 text-right text-neutral-800">{fmt(totalSalary)}</div>
              </div>
              <div className="p-3 border-t border-neutral-100">
                <button onClick={addEmployee} className="flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-600 transition-colors">
                  <Plus size={14} /> Добавить сотрудника
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'recurring' && (
          <div className="space-y-4">
            <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-amber-600">Постоянные расходы</div>
                  <div className="text-2xl font-bold text-amber-700">{fmt(totalRecurring)}</div>
                </div>
                <div>
                  <div className="text-sm text-amber-600">Оплачено в этом месяце</div>
                  <div className="text-2xl font-bold text-emerald-600">{fmt(ddsRecurring)}</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
              <div className="divide-y divide-neutral-100">
                {recurringExpenses.map(expense => (
                  <div key={expense.id} className="p-4 group">
                    <div className="flex items-center gap-3 mb-2">
                      <EditableInput value={expense.name} onSave={(v) => updateRecurringExpense(expense.id, 'name', v)} placeholder="Название" className="flex-1 bg-transparent text-neutral-800 font-medium focus:outline-none focus:bg-neutral-50 rounded px-1" />
                      <button onClick={() => removeRecurringExpense(expense.id)} className="text-neutral-200 group-hover:text-neutral-400 hover:!text-red-400 transition-colors p-1"><Trash2 size={16} /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs text-neutral-400 mb-1">Сумма</div>
                        <EditableInput value={expense.amount} onSave={(v) => updateRecurringExpense(expense.id, 'amount', v)} className="w-full bg-neutral-50 rounded-lg px-3 py-2 text-amber-600 font-medium focus:outline-none" />
                      </div>
                      <div>
                        <div className="text-xs text-neutral-400 mb-1">День платежа</div>
                        <EditableInput type="number" value={expense.day} onSave={(v) => updateRecurringExpense(expense.id, 'day', v)} className="w-full bg-neutral-50 rounded-lg px-3 py-2 text-neutral-700 font-medium focus:outline-none" min="1" max="31" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-3 border-t border-neutral-100">
                <button onClick={addRecurringExpense} className="flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-600 transition-colors"><Plus size={14} /> Добавить постоянный расход</button>
              </div>
            </div>
          </div>
        )}

        {tab === 'credits' && (
          <div className="space-y-4">
            <div className="bg-rose-50 rounded-xl border border-rose-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-rose-600">Общая сумма долга</div>
                  <div className="text-2xl font-bold text-rose-700">{fmt(totalCreditsDebt)}</div>
                </div>
                <div>
                  <div className="text-sm text-rose-600">Ежемесячный платёж</div>
                  <div className="text-2xl font-bold text-rose-700">{fmt(totalCreditsMonthly)}</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
              <div className="divide-y divide-neutral-100">
                {data.credits.map(credit => (
                  <div key={credit.id} className="p-4 group">
                    <div className="flex items-center gap-3 mb-2">
                      <input type="text" value={credit.name} onChange={(e) => updateCredit(credit.id, 'name', e.target.value)} placeholder="Название" className="flex-1 bg-transparent text-neutral-800 font-medium focus:outline-none" />
                      <button onClick={() => removeCredit(credit.id)} className="text-neutral-200 group-hover:text-neutral-400 hover:!text-red-400 transition-colors p-1"><Trash2 size={16} /></button>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <div className="text-xs text-neutral-400 mb-1">Общий долг</div>
                        <input type="number" value={credit.totalDebt} onChange={(e) => updateCredit(credit.id, 'totalDebt', e.target.value)} className="w-full bg-neutral-50 rounded-lg px-3 py-2 text-neutral-700 font-medium focus:outline-none" />
                      </div>
                      <div>
                        <div className="text-xs text-neutral-400 mb-1">Платёж / мес</div>
                        <input type="number" value={credit.monthlyPayment} onChange={(e) => updateCredit(credit.id, 'monthlyPayment', e.target.value)} className="w-full bg-neutral-50 rounded-lg px-3 py-2 text-rose-600 font-medium focus:outline-none" />
                      </div>
                      <div>
                        <div className="text-xs text-neutral-400 mb-1">День платежа</div>
                        <input type="number" value={credit.day} onChange={(e) => updateCredit(credit.id, 'day', e.target.value)} className="w-full bg-neutral-50 rounded-lg px-3 py-2 text-neutral-700 font-medium focus:outline-none" min="1" max="31" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-3 border-t border-neutral-100">
                <button onClick={addCredit} className="flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-600 transition-colors"><Plus size={14} /> Добавить кредит</button>
              </div>
            </div>
          </div>
        )}

        {tab === 'dds' && (
          <div className="space-y-4">
            <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4">
              <div className="grid grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-xs text-emerald-600">Приходы</div>
                  <div className="text-xl font-bold text-emerald-700">+{fmtShort(ddsIncome)}</div>
                </div>
                <div>
                  <div className="text-xs text-amber-600">Расходы</div>
                  <div className="text-xl font-bold text-amber-700">−{fmtShort(ddsExpenses + ddsDebts)}</div>
                </div>
                <div>
                  <div className="text-xs text-violet-600">ЗП</div>
                  <div className="text-xl font-bold text-violet-700">−{fmtShort(ddsSalary)}</div>
                </div>
                <div>
                  <div className="text-xs text-rose-600">Кредиты</div>
                  <div className="text-xl font-bold text-rose-700">−{fmtShort(ddsCredits)}</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
              <div className="px-4 py-3 bg-neutral-50 border-b border-neutral-100 flex items-center gap-2">
                <List size={18} className="text-neutral-500" />
                <span className="font-medium text-neutral-700">Движение денежных средств</span>
                <span className="text-sm text-neutral-400">({dds.length} операций)</span>
              </div>
              {dds.length === 0 ? (
                <div className="p-8 text-center text-neutral-400">
                  Нет выполненных операций.<br />
                  <span className="text-sm">Отмечайте галочками операции в Бюджете, чтобы они появились здесь.</span>
                </div>
              ) : (
                <div className="divide-y divide-neutral-100">
                  {dds.sort((a, b) => a.day - b.day).map(item => (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-3 group">
                      <div className={`w-2 h-2 rounded-full ${
                        item.type === 'income' ? 'bg-emerald-500' :
                        item.type === 'salary' ? 'bg-violet-500' :
                        item.type === 'credit' ? 'bg-rose-500' :
                        'bg-amber-500'
                      }`}></div>
                      <div className="w-12 text-sm text-neutral-500">{item.day} {MONTHS_SHORT[month-1]}</div>
                      <div className="flex-1 text-neutral-700">{item.name}</div>
                      <div className={`font-medium ${item.type === 'income' ? 'text-emerald-600' : 'text-neutral-700'}`}>
                        {item.type === 'income' ? '+' : '−'}{fmt(item.amount)}
                      </div>
                      <button onClick={() => removeDDS(item.id)} className="text-neutral-200 group-hover:text-neutral-400 hover:!text-red-400 transition-colors p-1">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        </>
        )}

        {/* ПРИВЫЧКИ */}
        {mainTab === 'habits' && (
          <>
        {tab === 'habits' && (() => {
          const weekDays = getWeekDays(today);
          const groups = data.habitGroups || [];
          const activeHabits = (data.habits || []).filter(h => !h.archived);
          const archivedHabits = (data.habits || []).filter(h => h.archived);
          
          // Статистика за неделю
          let weekTotal = 0, weekDone = 0;
          weekDays.forEach(day => {
            if (day <= today) {
              activeHabits.forEach(h => {
                if (new Date(h.createdAt) <= day) {
                  weekTotal++;
                  if (isHabitCompleted(h.id, day)) weekDone++;
                }
              });
            }
          });
          const weekPct = weekTotal > 0 ? Math.round((weekDone / weekTotal) * 100) : 0;
          
          // Статистика за сегодня
          const todayDone = activeHabits.filter(h => isHabitCompleted(h.id, today)).length;
          const todayTotal = activeHabits.length;
          const todayPct = todayTotal > 0 ? Math.round((todayDone / todayTotal) * 100) : 0;
          
          // Лучший стрик
          const getStreak = (habitId) => {
            let streak = 0;
            const sortedDays = [...weekDays].filter(d => d <= today).sort((a, b) => b - a);
            for (const day of sortedDays) {
              if (isHabitCompleted(habitId, day)) streak++;
              else break;
            }
            return streak;
          };
          const bestStreak = Math.max(...activeHabits.map(h => getStreak(h.id)), 0);

          return (
          <div className="space-y-4">
            {/* AI Quote - только десктоп */}
            <div className="hidden sm:block bg-gradient-to-r from-violet-500 to-blue-500 rounded-xl p-4 text-white">
              <div className="flex items-start gap-3">
                <Sparkles size={20} />
                <div className="flex-1">
                  <div className="text-xs opacity-80 mb-1">Мысль дня</div>
                  <p className="text-sm font-medium">{quoteLoading ? '...' : quote}</p>
                </div>
                <button onClick={loadQuote} className="p-1.5 hover:bg-white/20 rounded-lg">
                  <Sparkles size={14} className={quoteLoading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {/* Dashboard - только десктоп */}
            <div className="hidden sm:grid grid-cols-4 gap-3">
              {/* Сегодня - большой круг */}
              <div className="col-span-2 sm:col-span-1 bg-white rounded-xl border-2 border-blue-200 p-4">
                <div className="flex items-center gap-4">
                  <div className="relative w-16 h-16">
                    <svg className="w-16 h-16 -rotate-90">
                      <circle cx="32" cy="32" r="28" fill="none" stroke="#e5e5e5" strokeWidth="6" />
                      <circle cx="32" cy="32" r="28" fill="none" stroke="#3b82f6" strokeWidth="6" 
                        strokeDasharray={`${todayPct * 1.76} 176`} strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center text-lg font-bold text-blue-600">{todayPct}%</div>
                  </div>
                  <div>
                    <div className="text-xs text-neutral-500">Сегодня</div>
                    <div className="text-2xl font-bold">{todayDone}<span className="text-neutral-400 text-base">/{todayTotal}</span></div>
                  </div>
                </div>
              </div>
              
              {/* За неделю */}
              <div className="bg-white rounded-xl border p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Target size={16} className="text-emerald-500" />
                  <span className="text-xs text-neutral-500">За неделю</span>
                </div>
                <div className="text-2xl font-bold text-emerald-600">{weekPct}%</div>
                <div className="mt-2 h-2 bg-neutral-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${weekPct}%` }} />
                </div>
              </div>
              
              {/* Привычек */}
              <div className="bg-white rounded-xl border p-4">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 size={16} className="text-violet-500" />
                  <span className="text-xs text-neutral-500">Привычек</span>
                </div>
                <div className="text-2xl font-bold">{activeHabits.length}</div>
                {archivedHabits.length > 0 && <div className="text-xs text-neutral-400">+{archivedHabits.length} в архиве</div>}
              </div>
              
              {/* Лучший стрик */}
              <div className="bg-white rounded-xl border p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp size={16} className="text-amber-500" />
                  <span className="text-xs text-neutral-500">Стрик</span>
                </div>
                <div className="text-2xl font-bold">{bestStreak} <span className="text-sm text-neutral-400">дн.</span></div>
              </div>
            </div>

            {/* Controls - только десктоп */}
            <div className="hidden sm:flex items-center justify-between flex-wrap gap-2">
              <div className="flex bg-neutral-100 rounded-lg p-1">
                <button onClick={() => { setHabitView('week'); setHabitWeekOffset(0); }} className={`px-3 py-1 rounded text-sm ${habitView === 'week' ? 'bg-white shadow font-medium' : 'text-neutral-500'}`}>Неделя</button>
                <button onClick={() => { setHabitView('month'); setHabitMonthOffset(0); }} className={`px-3 py-1 rounded text-sm ${habitView === 'month' ? 'bg-white shadow font-medium' : 'text-neutral-500'}`}>Месяц</button>
                <button onClick={() => setHabitView('groups')} className={`px-3 py-1 rounded text-sm ${habitView === 'groups' ? 'bg-white shadow font-medium' : 'text-neutral-500'}`}>Группы</button>
                {archivedHabits.length > 0 && (
                  <button onClick={() => setHabitView('archive')} className={`px-3 py-1 rounded text-sm ${habitView === 'archive' ? 'bg-white shadow font-medium' : 'text-neutral-500'}`}>Архив</button>
                )}
              </div>
              <button onClick={() => setShowAddHabit(true)} className="p-2 bg-blue-500 text-white rounded-lg"><Plus size={18} /></button>
            </div>

            {/* Week/Month Navigation */}
            {(habitView === 'week' || habitView === 'month') && (
              <div className="flex items-center justify-center gap-3 bg-white rounded-2xl sm:rounded-xl border p-2">
                <button 
                  onClick={() => habitView === 'week' ? setHabitWeekOffset(habitWeekOffset - 1) : setHabitMonthOffset(habitMonthOffset - 1)} 
                  className="p-2 hover:bg-neutral-100 rounded-lg active:bg-neutral-200"
                >
                  <ChevronLeft size={20} className="text-neutral-600" />
                </button>
                <div className="text-center min-w-[160px]">
                  <div className="font-medium text-neutral-800">
                    {habitView === 'week' ? getHabitWeekRange(habitWeekOffset) : getHabitMonthName(habitMonthOffset)}
                  </div>
                  {habitView === 'week' && habitWeekOffset === 0 && <div className="text-xs text-blue-500">Текущая неделя</div>}
                  {habitView === 'week' && habitWeekOffset === -1 && <div className="text-xs text-neutral-400">Прошлая неделя</div>}
                  {habitView === 'month' && habitMonthOffset === 0 && <div className="text-xs text-blue-500">Текущий месяц</div>}
                  {habitView === 'month' && habitMonthOffset === -1 && <div className="text-xs text-neutral-400">Прошлый месяц</div>}
                </div>
                <button 
                  onClick={() => habitView === 'week' ? setHabitWeekOffset(habitWeekOffset + 1) : setHabitMonthOffset(habitMonthOffset + 1)} 
                  className={`p-2 rounded-lg ${
                    (habitView === 'week' && habitWeekOffset >= 0) || (habitView === 'month' && habitMonthOffset >= 0)
                      ? 'text-neutral-300 cursor-not-allowed' 
                      : 'hover:bg-neutral-100 active:bg-neutral-200 text-neutral-600'
                  }`}
                  disabled={(habitView === 'week' && habitWeekOffset >= 0) || (habitView === 'month' && habitMonthOffset >= 0)}
                >
                  <ChevronRight size={20} />
                </button>
                {((habitView === 'week' && habitWeekOffset !== 0) || (habitView === 'month' && habitMonthOffset !== 0)) && (
                  <button 
                    onClick={() => habitView === 'week' ? setHabitWeekOffset(0) : setHabitMonthOffset(0)} 
                    className="px-3 py-1 text-xs bg-blue-500 text-white rounded-lg"
                  >
                    Сегодня
                  </button>
                )}
              </div>
            )}

            {/* Week View - компактные чекбоксы, широкое название */}
            {habitView === 'week' && (() => {
              const displayWeekDays = getWeekDays(today, habitWeekOffset);
              return (
              <div className="bg-white rounded-2xl sm:rounded-xl border overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 sm:p-3 font-medium text-neutral-700 text-sm">Привычка</th>
                      {displayWeekDays.map((day, i) => {
                        const isToday = fmtDate(day) === todayKey;
                        return (
                          <th key={i} className={`w-8 sm:w-10 p-1 sm:p-2 text-center ${isToday ? 'bg-blue-500 text-white' : ''}`}>
                            <div className={`text-[9px] sm:text-[10px] font-normal ${isToday ? 'text-blue-100' : 'text-neutral-400'}`}>{DAYS_SHORT[i]}</div>
                            <div className="text-xs sm:text-sm font-bold">{day.getDate()}</div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map(group => {
                      const groupHabits = activeHabits.filter(h => h.groupId === group.id);
                      if (groupHabits.length === 0) return null;
                      return (
                        <React.Fragment key={group.id}>
                          <tr className={HABIT_COLORS[group.color].bg}>
                            <td colSpan={8} className={`px-2 sm:px-3 py-1 text-xs font-medium ${HABIT_COLORS[group.color].text}`}>{group.name}</td>
                          </tr>
                          {groupHabits.map(habit => (
                            <tr 
                              key={habit.id} 
                              draggable
                              onDragStart={(e) => handleHabitDragStart(e, habit)}
                              onDragEnd={handleHabitDragEnd}
                              onDragOver={(e) => handleHabitDragOver(e, habit)}
                              onDrop={(e) => handleHabitDrop(e, habit)}
                              className={`border-b last:border-0 group/row hover:bg-neutral-50 cursor-grab active:cursor-grabbing transition-all ${
                                dragOverHabit === habit.id ? 'bg-blue-50 border-t-2 border-t-blue-400' : ''
                              }`}
                            >
                              <td className="p-2 sm:p-3">
                                <div className="flex items-center gap-1 sm:gap-2">
                                  <GripVertical size={12} className="text-neutral-300 group-hover/row:text-neutral-400 flex-shrink-0 cursor-grab sm:w-[14px] sm:h-[14px]" />
                                  <div className="flex flex-col min-w-0">
                                    <span className="text-xs sm:text-sm text-neutral-700 truncate">{habit.name}</span>
                                    {habit.times && habit.times.length > 0 && (
                                      <span className="text-[10px] text-neutral-400">{habit.times.join(', ')}</span>
                                    )}
                                    {habit.courseDays && (
                                      <span className="text-[10px] text-amber-500">курс {habit.courseDays}д</span>
                                    )}
                                  </div>
                                  <div className="hidden sm:flex opacity-0 group-hover/row:opacity-100 items-center gap-1 ml-auto">
                                    <button onClick={() => setEditingHabit(habit)} className="p-1 hover:bg-blue-100 rounded" title="Редактировать">
                                      <Edit3 size={12} className="text-blue-500" />
                                    </button>
                                    <button onClick={() => archiveHabit(habit.id)} className="p-1 hover:bg-amber-100 rounded" title="В архив (история сохранится)">
                                      <Archive size={12} className="text-amber-500" />
                                    </button>
                                    <button onClick={() => { if(confirm('Удалить привычку? История будет потеряна.')) removeHabit(habit.id); }} className="p-1 hover:bg-red-100 rounded" title="Удалить навсегда">
                                      <Trash2 size={12} className="text-red-400" />
                                    </button>
                                  </div>
                                </div>
                              </td>
                              {displayWeekDays.map((day, i) => {
                                const done = isHabitCompleted(habit.id, day);
                                const isToday = fmtDate(day) === todayKey;
                                const future = day > today;
                                return (
                                  <td key={i} className={`w-8 sm:w-10 p-0.5 sm:p-1 text-center ${isToday ? 'bg-blue-50' : ''}`}>
                                    <button onClick={() => !future && toggleHabitCompletion(habit.id, day)} disabled={future} 
                                      style={{ touchAction: 'manipulation' }}
                                      className={`w-6 h-6 sm:w-7 sm:h-7 mx-auto rounded flex items-center justify-center transition-all ${
                                        done ? `${HABIT_COLORS[group.color].fill} text-white` : 
                                        future ? 'bg-neutral-100' : 
                                        `border-2 ${HABIT_COLORS[group.color].border} hover:bg-neutral-50`
                                      }`}>
                                      {done && <Check size={12} />}
                                    </button>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
                {activeHabits.length === 0 && <div className="p-8 text-center text-neutral-400 text-sm">Нет привычек. Добавьте первую!</div>}
              </div>
              );
            })()}

            {/* Month View - календарь */}
            {habitView === 'month' && (() => {
              const monthDays = getMonthDaysHabits(today, habitMonthOffset);
              const targetDate = new Date(today.getFullYear(), today.getMonth() + habitMonthOffset, 1);
              const firstDayOfMonth = targetDate.getDay();
              const startPad = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
              
              // Функция проверки - была ли привычка активна в этот день
              const isHabitActiveOnDay = (habit, day) => {
                const dayKey = fmtDate(day);
                const createdAt = habit.createdAt || '2020-01-01';
                const archivedAt = habit.archivedAt || '2099-12-31';
                return dayKey >= createdAt && dayKey < archivedAt;
              };

              return (
                <div className="bg-white rounded-xl border overflow-hidden">
                  {/* Header с днями недели */}
                  <div className="grid grid-cols-7 border-b bg-neutral-50">
                    {DAYS_SHORT.map((d, i) => (
                      <div key={i} className="text-xs text-neutral-500 text-center py-2 font-medium">{d}</div>
                    ))}
                  </div>
                  
                  {/* Календарная сетка */}
                  <div className="grid grid-cols-7">
                    {/* Пустые ячейки в начале */}
                    {Array.from({ length: startPad }).map((_, i) => (
                      <div key={`pad-${i}`} className="min-h-[80px] sm:min-h-[100px] border-b border-r border-neutral-100 bg-neutral-50/30"></div>
                    ))}
                    
                    {/* Дни месяца */}
                    {monthDays.map((day, i) => {
                      const dayKey = fmtDate(day);
                      const isToday = dayKey === todayKey;
                      const future = day > today;
                      
                      // Привычки активные в этот день (не архивированные до этого дня)
                      const dayHabits = (data.habits || []).filter(h => {
                        if (h.archived && h.archivedAt && dayKey >= h.archivedAt) return false;
                        if (h.createdAt && dayKey < h.createdAt) return false;
                        return true;
                      });
                      
                      const completedCount = dayHabits.filter(h => isHabitCompleted(h.id, day)).length;
                      const totalCount = dayHabits.length;
                      const allDone = totalCount > 0 && completedCount === totalCount;
                      
                      return (
                        <div key={i} className={`min-h-[80px] sm:min-h-[100px] border-b border-r border-neutral-100 p-1 ${isToday ? 'bg-blue-50 ring-2 ring-inset ring-blue-400' : ''} ${future ? 'bg-neutral-50/50' : ''}`}>
                          <div className={`text-xs font-medium mb-1 flex items-center justify-between ${isToday ? 'text-blue-600' : 'text-neutral-500'}`}>
                            <span>{day.getDate()}</span>
                            {totalCount > 0 && !future && (
                              <span className={`text-[10px] px-1 rounded ${allDone ? 'bg-emerald-100 text-emerald-600' : 'bg-neutral-100 text-neutral-500'}`}>
                                {completedCount}/{totalCount}
                              </span>
                            )}
                          </div>
                          <div className="space-y-0.5">
                            {dayHabits.slice(0, 4).map(habit => {
                              const group = groups.find(g => g.id === habit.groupId);
                              const done = isHabitCompleted(habit.id, day);
                              const colorClass = group ? HABIT_COLORS[group.color] : HABIT_COLORS.blue;
                              return (
                                <button 
                                  key={habit.id}
                                  onClick={() => !future && toggleHabitCompletion(habit.id, day)}
                                  disabled={future}
                                  className={`w-full text-left text-[9px] sm:text-[10px] px-1 py-0.5 rounded truncate flex items-center gap-1 ${
                                    done ? `${colorClass.fill} text-white` : 
                                    future ? 'bg-neutral-100 text-neutral-400' :
                                    `${colorClass.bg} ${colorClass.text}`
                                  }`}
                                >
                                  {done && <Check size={8} className="flex-shrink-0" />}
                                  <span className="truncate">{habit.name}</span>
                                </button>
                              );
                            })}
                            {dayHabits.length > 4 && (
                              <div className="text-[9px] text-neutral-400 px-1">+{dayHabits.length - 4}</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Groups View */}
            {habitView === 'groups' && (
              <div className="space-y-3">
                <div className="flex justify-end">
                  <button onClick={() => setShowAddHabitGroup(true)} className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 rounded-lg text-sm flex items-center gap-1">
                    <Plus size={16} /> Группа
                  </button>
                </div>
                {(data.habitGroups || []).map(group => (
                  <div key={group.id} className="bg-white rounded-xl border p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-4 h-4 rounded-full ${HABIT_COLORS[group.color].fill}`}></div>
                      {editingGroup === group.id ? (
                        <input type="text" value={group.name} onChange={e => updateHabitGroup(group.id, { name: e.target.value })} className="flex-1 px-2 py-1 border rounded" autoFocus />
                      ) : (
                        <span className="flex-1 font-medium">{group.name}</span>
                      )}
                      <div className="flex gap-1">
                        {editingGroup === group.id ? (
                          <button onClick={() => setEditingGroup(null)} className="p-1.5 hover:bg-neutral-100 rounded"><Save size={16} className="text-emerald-500" /></button>
                        ) : (
                          <button onClick={() => setEditingGroup(group.id)} className="p-1.5 hover:bg-neutral-100 rounded"><Edit3 size={16} className="text-neutral-400" /></button>
                        )}
                        <button onClick={() => removeHabitGroup(group.id)} className="p-1.5 hover:bg-red-50 rounded"><Trash2 size={16} className="text-neutral-400 hover:text-red-400" /></button>
                      </div>
                    </div>
                    {editingGroup === group.id && (
                      <div className="flex gap-2 mb-3 pb-3 border-b">
                        {Object.keys(HABIT_COLORS).map(c => (
                          <button key={c} onClick={() => updateHabitGroup(group.id, { color: c })} 
                            className={`w-6 h-6 rounded-full ${HABIT_COLORS[c].fill} ${group.color === c ? 'ring-2 ring-offset-2 ring-neutral-400' : ''}`} />
                        ))}
                      </div>
                    )}
                    <div className="space-y-1">
                      {activeHabits.filter(h => h.groupId === group.id).map(habit => (
                        <div key={habit.id} className="flex items-center justify-between py-2 px-2 -mx-2 rounded hover:bg-neutral-50 group/item text-sm text-neutral-600">
                          <span>{habit.name}</span>
                          <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100">
                            <button onClick={() => archiveHabit(habit.id)} className="p-1.5 hover:bg-amber-100 rounded" title="В архив">
                              <Archive size={14} className="text-amber-500" />
                            </button>
                            <button onClick={() => { if(confirm('Удалить? История будет потеряна.')) removeHabit(habit.id); }} className="p-1.5 hover:bg-red-100 rounded" title="Удалить">
                              <Trash2 size={14} className="text-red-400" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Archive View */}
            {habitView === 'archive' && (
              <div className="bg-white rounded-xl border overflow-hidden">
                <div className="px-4 py-3 bg-neutral-50 border-b flex items-center gap-2">
                  <Archive size={18} className="text-neutral-500" />
                  <span className="font-medium">Архив привычек</span>
                  <span className="text-sm text-neutral-400">({archivedHabits.length})</span>
                </div>
                {archivedHabits.length === 0 ? (
                  <div className="p-8 text-center text-neutral-400 text-sm">Архив пуст</div>
                ) : (
                  <div className="divide-y">
                    {archivedHabits.map(habit => {
                      const group = groups.find(g => g.id === habit.groupId);
                      return (
                        <div key={habit.id} className="flex items-center justify-between p-4">
                          <div>
                            <div className="font-medium text-neutral-700">{habit.name}</div>
                            <div className="text-xs text-neutral-400">
                              {group && <span className={HABIT_COLORS[group.color]?.text}>{group.name}</span>}
                              {habit.archivedAt && <span className="ml-2">Архивирован: {habit.archivedAt}</span>}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => unarchiveHabit(habit.id)} className="p-2 hover:bg-emerald-50 rounded-lg" title="Восстановить">
                              <RotateCcw size={16} className="text-emerald-500" />
                            </button>
                            <button onClick={() => removeHabit(habit.id)} className="p-2 hover:bg-red-50 rounded-lg" title="Удалить навсегда">
                              <Trash2 size={16} className="text-neutral-400 hover:text-red-400" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
        })()}
        </>
        )}

        {/* КАЛЕНДАРЬ */}
        {mainTab === 'calendar' && (
          <div className="flex flex-col h-full sm:h-[calc(100vh-120px)]">
            {/* Calendar Header - Fixed at top */}
            <div className="bg-white rounded-xl border border-neutral-200 p-3 mb-3 flex-shrink-0">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2 sm:gap-4">
                  <button 
                    onClick={() => setCalendarDate(today)}
                    className="px-2 sm:px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    Сегодня
                  </button>
                  <div className="flex items-center border border-neutral-200 rounded-lg bg-white">
                    <button onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth(), calendarDate.getDate() - (calendarView === 'month' ? 30 : calendarView === 'week' ? 7 : 1)))} className="p-1.5 sm:p-2 hover:bg-neutral-50 rounded-l-lg border-r border-neutral-200">
                      <ChevronLeft size={16} />
                    </button>
                    <span className="px-2 sm:px-4 text-sm font-medium min-w-[120px] sm:min-w-[180px] text-center">
                      {calendarView === 'month' ? `${MONTHS[calendarDate.getMonth()]} ${calendarDate.getFullYear()}` : 
                       calendarView === 'week' ? `${getCalendarWeekDays()[0].getDate()} - ${getCalendarWeekDays()[6].getDate()} ${MONTHS[calendarDate.getMonth()].slice(0,3)}` :
                       `${calendarDate.getDate()} ${MONTHS[calendarDate.getMonth()].slice(0,3)} ${calendarDate.getFullYear()}`}
                    </span>
                    <button onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth(), calendarDate.getDate() + (calendarView === 'month' ? 30 : calendarView === 'week' ? 7 : 1)))} className="p-1.5 sm:p-2 hover:bg-neutral-50 rounded-r-lg border-l border-neutral-200">
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="flex bg-neutral-100 rounded-lg p-0.5 sm:p-1">
                    {[
                      { id: 'day', label: 'День' },
                      { id: 'week', label: 'Неделя' },
                      { id: 'month', label: 'Месяц' },
                    ].map(v => (
                      <button
                        key={v.id}
                        onClick={() => setCalendarView(v.id)}
                        className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all ${
                          calendarView === v.id ? 'bg-white shadow text-neutral-800' : 'text-neutral-500 hover:text-neutral-700'
                        }`}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                  
                  <button 
                    onClick={() => setShowAddTask(true)}
                    className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors text-sm"
                  >
                    <Plus size={16} />
                    <span className="hidden sm:inline">Добавить</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Calendar Content */}
            <div className="flex-1 flex flex-col min-h-0">

            {/* Week View */}
            {calendarView === 'week' && (
              <div className="bg-white rounded-xl border border-neutral-200 flex flex-col flex-1 min-h-0">
                {/* FIXED HEADER SECTION */}
                <div className="flex-shrink-0">
                  {/* Days Header */}
                  <div className="grid grid-cols-8 border-b border-neutral-200">
                    <div className="p-2 sm:p-3 text-center text-xs text-neutral-400 border-r border-neutral-100"></div>
                    {getCalendarWeekDays().map((day, i) => (
                      <div 
                        key={i} 
                        onClick={() => { setCalendarDate(day); setCalendarView('day'); }}
                        className={`p-2 sm:p-3 text-center border-r border-neutral-100 last:border-0 cursor-pointer hover:bg-neutral-50 ${isTodayCal(day) ? 'bg-blue-50' : ''}`}
                      >
                        <div className="text-[10px] sm:text-xs text-neutral-400 mb-1">{DAYS_SHORT[i]}</div>
                        <div className={`w-6 h-6 sm:w-8 sm:h-8 mx-auto flex items-center justify-center rounded-full text-sm sm:text-lg font-semibold ${
                          isTodayCal(day) ? 'bg-blue-500 text-white' : 'text-neutral-800'
                        }`}>
                          {day.getDate()}
                        </div>
                      </div>
                    ))}
                  </div>
                
                  {/* Habits Row */}
                  <div className="grid grid-cols-8 border-b border-neutral-200 bg-gradient-to-r from-emerald-50 to-white">
                    <div className="p-1 sm:p-2 text-right text-[10px] text-neutral-500 border-r border-neutral-100 flex items-center justify-end font-medium">
                      <Target size={12} className="mr-1" />
                      Привычки
                    </div>
                    {getCalendarWeekDays().map((day, i) => {
                      const dateKey = fmtDateCal(day);
                      const activeHabits = (data?.habits || []).filter(h => !h.archived);
                      const completedHabits = activeHabits.filter(h => (data?.habitCompletions?.[dateKey] || []).includes(h.id));
                      const uncompletedHabits = activeHabits.filter(h => !(data?.habitCompletions?.[dateKey] || []).includes(h.id));
                      
                      return (
                        <div key={i} onClick={() => setMainTab('habits')} className="p-0.5 border-r border-neutral-100 last:border-0 min-h-[40px] cursor-pointer hover:bg-emerald-50/50">
                          <div className="space-y-0.5">
                            {uncompletedHabits.slice(0, 2).map(habit => (
                              <div key={habit.id} className="text-[8px] px-1 py-0.5 bg-neutral-100 text-neutral-600 rounded truncate">
                                {habit.name.slice(0, 10)}
                              </div>
                            ))}
                            {completedHabits.length > 0 && <div className="text-[8px] text-emerald-500 px-1">✓ {completedHabits.length}</div>}
                            {uncompletedHabits.length > 2 && <div className="text-[8px] text-neutral-400 px-1">+{uncompletedHabits.length - 2}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                
                  {/* Payments Row */}
                  {showFinancialEvents && (
                    <div className="grid grid-cols-8 border-b border-neutral-200 bg-gradient-to-r from-rose-50 to-white">
                      <div className="p-1 sm:p-2 text-right text-[10px] text-neutral-500 border-r border-neutral-100 flex items-center justify-end font-medium">
                        💰 Платежи
                      </div>
                      {getCalendarWeekDays().map((day, i) => {
                        const events = getFinancialEventsForDate(day);
                        return (
                          <div key={i} className="p-0.5 border-r border-neutral-100 last:border-0 min-h-[40px]">
                            {events.slice(0, 2).map(event => (
                              <div key={event.id} className={`text-[8px] px-1 py-0.5 rounded truncate mb-0.5 ${
                                event.type === 'income' ? 'bg-emerald-100 text-emerald-700' :
                                event.type === 'credit' ? 'bg-rose-100 text-rose-700' :
                                event.type === 'recurring' ? 'bg-amber-100 text-amber-700' :
                                'bg-violet-100 text-violet-700'
                              }`}>
                                {event.title?.slice(0, 8)} {event.amount >= 1000 ? Math.round(event.amount/1000) + 'к' : event.amount}
                              </div>
                            ))}
                            {events.length > 2 && <div className="text-[8px] text-neutral-400 px-1">+{events.length - 2}</div>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                
                {/* SCROLLABLE TIME GRID */}
                <div ref={calendarGridRef} className="flex-1 overflow-y-auto">
                  {calendarHours.map(hour => {
                    const isCurrentHour = currentTime.getHours() === hour;
                    const currentMinuteOffset = currentTime.getMinutes() / 60 * 60;
                    
                    return (
                      <div key={hour} className="grid grid-cols-8 border-b border-neutral-100 relative">
                          <div className="p-1 sm:p-2 text-right text-[10px] sm:text-xs text-neutral-400 pr-1 sm:pr-3 border-r border-neutral-100 h-[60px] flex items-start justify-end">
                            {String(hour).padStart(2, '0')}:00
                          </div>
                          {getCalendarWeekDays().map((day, dayIndex) => {
                            const dayTasks = getTasksForDate(day).filter(t => parseInt(t.time.split(':')[0]) === hour);
                            const showTimeLine = isTodayCal(day) && isCurrentHour;
                            const isDropTarget = dropTarget && dropTarget.date === fmtDateCal(day) && dropTarget.hour === hour;
                            
                            return (
                              <div 
                                key={dayIndex}
                                data-hour={hour}
                                data-date={fmtDateCal(day)}
                                onClick={(e) => { 
                                  if (e.target === e.currentTarget) {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const relativeY = e.clientY - rect.top;
                                    const minutes = Math.floor(relativeY / rect.height * 60 / 15) * 15;
                                    handleCellClick(day, hour + minutes / 60); 
                                  }
                                }}
                                onDragOver={(e) => handleDragOver(e, day, hour, e.currentTarget)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, day, hour, e.currentTarget)}
                                className={`h-[60px] border-r border-neutral-100 last:border-0 relative cursor-pointer transition-colors ${
                                  isTodayCal(day) ? 'bg-blue-50/30' : ''
                                } ${
                                  isDropTarget ? 'bg-blue-100 ring-2 ring-inset ring-blue-400' : 'hover:bg-blue-50/50'
                                } ${
                                  dragData ? 'hover:bg-blue-100' : ''
                                }`}
                              >
                                {/* Drop indicator line */}
                                {isDropTarget && dropTarget.minute !== undefined && (
                                  <div 
                                    className="absolute left-0 right-0 h-0.5 bg-blue-500 z-30 pointer-events-none"
                                    style={{ top: `${(dropTarget.minute / 60) * 60}px` }}
                                  >
                                    <div className="absolute -left-1 -top-1 w-2 h-2 bg-blue-500 rounded-full" />
                                  </div>
                                )}
                                
                                {/* Current time line */}
                                {showTimeLine && (
                                  <div 
                                    className="absolute left-0 right-0 h-0.5 bg-red-500 z-20 pointer-events-none"
                                    style={{ top: `${currentMinuteOffset}px` }}
                                  >
                                    <div className="absolute -left-1 -top-1 w-2 h-2 bg-red-500 rounded-full" />
                                  </div>
                                )}
                                
                                {/* 15-min grid lines */}
                                <div className="absolute inset-0 pointer-events-none">
                                  <div className="absolute left-0 right-0 top-[15px] border-t border-dashed border-neutral-200/40" />
                                  <div className="absolute left-0 right-0 top-[30px] border-t border-dashed border-neutral-300/50" />
                                  <div className="absolute left-0 right-0 top-[45px] border-t border-dashed border-neutral-200/40" />
                                </div>
                                
                                {dayTasks.map(task => {
                                  const startMinute = parseInt(task.time?.split(':')[1]) || 0;
                                  const TypeIcon = TASK_TYPES[task.type]?.icon || User;
                                  const taskHeight = Math.max(((task.duration || 60) / 60) * 60 - 2, 22);
                                  const isDragging = dragData?.type === 'task' && dragData?.data?.id === task.id;
                                  
                                  return (
                                    <div
                                      key={task.id}
                                      draggable
                                      onDragStart={(e) => handleDragStart(e, 'task', task)}
                                      onDragEnd={handleDragEnd}
                                      onClick={(e) => { e.stopPropagation(); setEditingTask(task); }}
                                      className={`absolute left-0.5 right-0.5 px-1.5 py-0.5 rounded ${TASK_COLORS[task.color]?.bg || 'bg-blue-500'} text-white text-[11px] cursor-grab active:cursor-grabbing hover:brightness-110 transition-all shadow-sm group z-10 select-none ${
                                        isDragging ? 'opacity-50' : ''
                                      } ${
                                        resizingTask?.id === task.id ? 'ring-2 ring-white cursor-ns-resize' : ''
                                      }`}
                                      style={{
                                        top: `${(startMinute / 60) * 60 + 1}px`,
                                        height: `${taskHeight}px`,
                                      }}
                                    >
                                      <div className="flex items-center gap-1 overflow-hidden">
                                        <TypeIcon size={10} className="flex-shrink-0" />
                                        <span className="font-medium truncate">{task.title}</span>
                                      </div>
                                      {(task.duration || 60) >= 30 && (
                                        <div className="text-white/80 text-[9px]">
                                          {task.time} - {task.endTime}
                                        </div>
                                      )}
                                      {/* Resize handle */}
                                      <div
                                        onMouseDown={(e) => handleResizeStart(e, task)}
                                        className="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize hover:bg-white/30 rounded-b opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                      >
                                        <div className="w-8 h-1 bg-white/60 rounded-full" />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Month View */}
            {calendarView === 'month' && (
              <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
                {/* Toggle for financial events */}
                <div className="px-4 py-2 border-b border-neutral-100 flex items-center justify-between bg-neutral-50">
                  <span className="text-sm text-neutral-600">Показывать платежи</span>
                  <button
                    onClick={() => setShowFinancialEvents(!showFinancialEvents)}
                    className={`w-10 h-6 rounded-full transition-colors ${showFinancialEvents ? 'bg-blue-500' : 'bg-neutral-300'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-1 ${showFinancialEvents ? 'translate-x-4' : ''}`} />
                  </button>
                </div>
                
                <div className="grid grid-cols-7 border-b border-neutral-200">
                  {DAYS_SHORT.map(d => (
                    <div key={d} className="p-3 text-center text-sm font-medium text-neutral-500 border-r border-neutral-100 last:border-0">
                      {d}
                    </div>
                  ))}
                </div>
                
                <div className="grid grid-cols-7">
                  {getCalendarMonthDays().map((day, i) => {
                    const dayTasks = getTasksForDate(day.date);
                    const financialEvents = showFinancialEvents ? getFinancialEventsForDate(day.date) : [];
                    const allItems = [...dayTasks, ...financialEvents];
                    
                    return (
                      <div
                        key={i}
                        onClick={(e) => { 
                          if (e.target === e.currentTarget || e.target.closest('.day-number')) {
                            handleCellClick(day.date);
                          }
                        }}
                        onDoubleClick={() => { setCalendarDate(day.date); setCalendarView('day'); }}
                        onDragOver={handleTaskDragOver}
                        onDrop={(e) => { e.stopPropagation(); handleTaskDrop(e, day.date); }}
                        className={`min-h-[100px] p-1.5 border-r border-b border-neutral-100 cursor-pointer hover:bg-neutral-50 transition-colors ${
                          !day.isCurrentMonth ? 'bg-neutral-50' : ''
                        } ${isSelectedCal(day.date) ? 'bg-blue-50' : ''} ${dragData ? 'hover:ring-2 hover:ring-inset hover:ring-blue-300' : ''}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className={`day-number w-6 h-6 flex items-center justify-center rounded-full text-xs ${
                            isTodayCal(day.date) ? 'bg-blue-500 text-white font-bold' :
                            day.isCurrentMonth ? 'text-neutral-800' : 'text-neutral-400'
                          }`}>
                            {day.date.getDate()}
                          </div>
                          {/* Financial indicators */}
                          {financialEvents.length > 0 && (
                            <div className="flex gap-0.5">
                              {financialEvents.some(e => e.type === 'income') && <div className="w-2 h-2 rounded-full bg-emerald-500" title="Приход" />}
                              {financialEvents.some(e => e.type === 'credit') && <div className="w-2 h-2 rounded-full bg-rose-500" title="Кредит" />}
                              {financialEvents.some(e => e.type === 'recurring') && <div className="w-2 h-2 rounded-full bg-amber-500" title="Пост. расход" />}
                              {financialEvents.some(e => e.type === 'salary') && <div className="w-2 h-2 rounded-full bg-violet-500" title="ФОТ" />}
                            </div>
                          )}
                        </div>
                        <div className="space-y-0.5">
                          {/* Tasks */}
                          {dayTasks.slice(0, 1).map(task => {
                            const TypeIcon = TASK_TYPES[task.type]?.icon || User;
                            return (
                              <div
                                key={task.id}
                                draggable
                                onDragStart={(e) => { e.stopPropagation(); handleTaskDragStart(e, task); }}
                                onDragEnd={() => setDraggedTask(null)}
                                onClick={(e) => { e.stopPropagation(); setEditingTask(task); }}
                                className={`px-1 py-0.5 rounded text-[10px] ${TASK_COLORS[task.color]?.light || 'bg-blue-100'} ${TASK_COLORS[task.color]?.text || 'text-blue-600'} truncate flex items-center gap-0.5 cursor-grab`}
                              >
                                <TypeIcon size={8} />
                                <span className="truncate">{task.title}</span>
                              </div>
                            );
                          })}
                          {/* Financial events */}
                          {financialEvents.slice(0, 2).map(event => (
                            <div
                              key={event.id}
                              onClick={(e) => e.stopPropagation()}
                              className={`px-1 py-0.5 rounded text-[10px] flex items-center gap-0.5 ${
                                event.isPaid ? 'opacity-50 line-through' : ''
                              } ${
                                event.type === 'income' ? 'bg-emerald-100 text-emerald-700' :
                                event.type === 'credit' ? 'bg-rose-100 text-rose-700' :
                                event.type === 'recurring' ? 'bg-amber-100 text-amber-700' :
                                event.type === 'salary' ? 'bg-violet-100 text-violet-700' :
                                'bg-red-100 text-red-700'
                              }`}
                            >
                              <span>{event.icon}</span>
                              <span className="truncate">{event.title}</span>
                            </div>
                          ))}
                          {allItems.length > 3 && (
                            <div className="text-[10px] text-neutral-400 px-1">+{allItems.length - 3}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Day View */}
            {calendarView === 'day' && (
              <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden flex flex-col h-full">
                <div className="p-4 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between flex-shrink-0">
                  <div>
                    <h2 className="text-lg font-semibold text-neutral-800">
                      {DAYS_FULL[(calendarDate.getDay() + 6) % 7]}, {calendarDate.getDate()} {MONTHS[calendarDate.getMonth()]}
                    </h2>
                    <p className="text-sm text-neutral-500">{getTasksForDate(calendarDate).length} задач, {getFinancialEventsForDate(calendarDate).length} платежей</p>
                  </div>
                  <button 
                    onClick={() => setShowAddTask(true)}
                    className="sm:hidden w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center shadow-lg"
                  >
                    <Plus size={20} className="text-white" />
                  </button>
                </div>
                
                {/* Financial events at top of day */}
                {getFinancialEventsForDate(calendarDate).length > 0 && (
                  <div className="p-3 border-b border-neutral-200 bg-gradient-to-r from-neutral-50 to-white flex-shrink-0">
                    <div className="text-xs font-semibold text-neutral-500 mb-2">💰 Платежи на этот день</div>
                    <div className="flex flex-wrap gap-2">
                      {getFinancialEventsForDate(calendarDate).map(event => (
                        <div
                          key={event.id}
                          className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 ${
                            event.isPaid ? 'opacity-50' : ''
                          } ${
                            event.type === 'income' ? 'bg-emerald-100 text-emerald-700' :
                            event.type === 'credit' ? 'bg-rose-100 text-rose-700' :
                            event.type === 'recurring' ? 'bg-amber-100 text-amber-700' :
                            event.type === 'salary' ? 'bg-violet-100 text-violet-700' :
                            'bg-red-100 text-red-700'
                          }`}
                        >
                          <span>{event.icon}</span>
                          <span className={event.isPaid ? 'line-through' : ''}>{event.title}</span>
                          <span className="font-semibold">{fmt(event.amount)}</span>
                          {event.isPaid && <Check size={14} className="text-emerald-500" />}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div ref={calendarGridRef} className="flex-1 overflow-auto min-h-0">
                  {calendarHours.map(hour => {
                    const hourTasks = getTasksForDate(calendarDate).filter(t => parseInt(t.time.split(':')[0]) === hour);
                    const isCurrentHour = isTodayCal(calendarDate) && currentTime.getHours() === hour;
                    const currentMinuteOffset = currentTime.getMinutes() / 60 * 100;
                    
                    return (
                      <div key={hour} className="flex border-b border-neutral-100 relative min-h-[60px]">
                        <div className="w-16 p-3 text-right text-sm text-neutral-400 border-r border-neutral-100 flex-shrink-0">
                          {String(hour).padStart(2, '0')}:00
                        </div>
                        <div 
                          className="flex-1 p-2 cursor-pointer hover:bg-blue-50/30 relative"
                          onClick={(e) => {
                            if (e.target === e.currentTarget) {
                              const rect = e.currentTarget.getBoundingClientRect();
                              const relativeY = e.clientY - rect.top;
                              const minutes = Math.round(relativeY / rect.height * 60 / 15) * 15;
                              handleCellClick(calendarDate, hour + minutes / 60);
                            }
                          }}
                        >
                          {/* Current time line */}
                          {isCurrentHour && (
                            <div 
                              className="absolute left-0 right-0 h-0.5 bg-red-500 z-20 pointer-events-none"
                              style={{ top: `${currentMinuteOffset}%` }}
                            >
                              <div className="absolute -left-1 -top-1 w-2 h-2 bg-red-500 rounded-full" />
                            </div>
                          )}
                          
                          {hourTasks.map(task => {
                            const TypeIcon = TASK_TYPES[task.type]?.icon || User;
                            return (
                              <div
                                key={task.id}
                                onClick={(e) => { e.stopPropagation(); setEditingTask(task); }}
                                className={`${TASK_COLORS[task.color]?.light || 'bg-blue-100'} border-l-4 ${TASK_COLORS[task.color]?.border || 'border-blue-500'} rounded-r-lg p-3 mb-2 cursor-pointer hover:shadow-md transition-shadow`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <TypeIcon size={16} className={TASK_COLORS[task.color]?.text || 'text-blue-600'} />
                                    <span className={`font-medium ${TASK_COLORS[task.color]?.text || 'text-blue-600'}`}>{task.title}</span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${TASK_TYPES[task.type]?.color || 'text-blue-500'} bg-white`}>
                                      {TASK_TYPES[task.type]?.label || 'Задача'}
                                    </span>
                                  </div>
                                  <button onClick={(e) => { e.stopPropagation(); removeCalendarTask(task.id); }} className="p-1 hover:bg-white/50 rounded">
                                    <Trash2 size={14} className="text-neutral-400" />
                                  </button>
                                </div>
                                <div className="flex items-center gap-4 mt-2 text-sm text-neutral-500">
                                  <span className="flex items-center gap-1"><Clock size={12} /> {task.time} - {task.endTime}</span>
                                  {task.assignee && <span className="flex items-center gap-1"><User size={12} /> {task.assignee}</span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            </div>
          </div>
        )}

        {/* ДНЕВНИК - отдельный таб */}
        {mainTab === 'journal' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold">Сегодня, {today.getDate()} {MONTHS_SHORT[today.getMonth()]}</h2>
                {data.journal?.[todayKey] && <span className="text-xs text-neutral-400">Сохранено</span>}
              </div>
              <textarea value={journalText} onChange={e => setJournalText(e.target.value)} placeholder="Как прошёл твой день?" className="w-full px-3 py-2 rounded-lg border mb-3 h-32 resize-none focus:outline-none focus:border-blue-400 text-sm" />
              <button onClick={sendJournal} disabled={aiLoading || !journalText.trim()} className="w-full py-2 bg-violet-500 hover:bg-violet-600 disabled:bg-neutral-300 text-white rounded-lg font-medium flex items-center justify-center gap-2 text-sm">
                {aiLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Send size={16} />Сохранить</>}
              </button>
              {aiResponse && (
                <div className="bg-violet-50 rounded-xl p-3 border border-violet-200 mt-3">
                  <div className="flex items-center gap-2 mb-2"><Sparkles size={14} className="text-violet-500" /><span className="text-xs font-medium text-violet-700">Ответ AI</span></div>
                  <p className="text-sm text-neutral-700">{aiResponse}</p>
                </div>
              )}
            </div>
            <div className="bg-white rounded-xl border p-4">
              <h2 className="font-semibold mb-3">История</h2>
              {Object.keys(data.journal || {}).length === 0 ? (
                <div className="text-center py-8 text-neutral-400 text-sm">Записей пока нет</div>
              ) : selectedJournalDate ? (
                <div>
                  <button onClick={() => setSelectedJournalDate(null)} className="text-sm text-blue-500 mb-3 flex items-center gap-1"><ChevronLeft size={16} /> Назад</button>
                  <div className="text-sm font-medium mb-1">{(() => { const d = new Date(selectedJournalDate); return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`; })()}</div>
                  <div className="bg-neutral-50 rounded-lg p-3 mb-3"><p className="text-sm whitespace-pre-wrap">{data.journal[selectedJournalDate]?.text}</p></div>
                  {data.journal[selectedJournalDate]?.aiResponse && (
                    <div className="bg-violet-50 rounded-lg p-3 border border-violet-200">
                      <div className="flex items-center gap-2 mb-2"><Sparkles size={14} className="text-violet-500" /><span className="text-xs font-medium text-violet-700">AI</span></div>
                      <p className="text-sm">{data.journal[selectedJournalDate]?.aiResponse}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {Object.entries(data.journal || {}).sort(([a], [b]) => b.localeCompare(a)).map(([date, entry]) => (
                    <div key={date} className="flex items-start gap-2 bg-neutral-50 hover:bg-neutral-100 rounded-lg p-3">
                      <button onClick={() => setSelectedJournalDate(date)} className="flex-1 text-left">
                        <div className="text-sm font-medium">{(() => { const d = new Date(date); return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`; })()}</div>
                        <p className="text-xs text-neutral-500 line-clamp-2">{entry.text}</p>
                      </button>
                      <button onClick={() => deleteJournalEntry(date)} className="p-1 hover:bg-red-100 rounded"><Trash2 size={14} className="text-neutral-300 hover:text-red-400" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Add Habit Modal */}
        {showAddHabit && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl w-full max-w-sm p-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between mb-4"><h2 className="text-lg font-semibold">Новая привычка</h2><button onClick={() => setShowAddHabit(false)}><X size={20} className="text-neutral-400" /></button></div>
              <input value={newHabit.name} onChange={e => setNewHabit({ ...newHabit, name: e.target.value })} placeholder="Название" className="w-full px-3 py-2 rounded-lg border mb-3" autoFocus />
              
              <div className="text-sm text-neutral-500 mb-2">Курс (дней, пусто = бессрочно)</div>
              <input
                type="number"
                value={newHabit.courseDays || ''}
                onChange={e => setNewHabit({ ...newHabit, courseDays: e.target.value ? parseInt(e.target.value) : null })}
                placeholder="∞"
                className="w-full px-3 py-2 rounded-lg border text-sm mb-3"
              />
              
              <div className="text-sm text-neutral-500 mb-2">Время приёма</div>
              <div className="flex flex-wrap gap-2 mb-2">
                {(newHabit.times || []).map((time, idx) => (
                  <div key={idx} className="flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-1 rounded-lg text-sm">
                    <input
                      type="text"
                      value={time}
                      onChange={e => {
                        const newTimes = [...newHabit.times];
                        newTimes[idx] = e.target.value;
                        setNewHabit({ ...newHabit, times: newTimes });
                      }}
                      placeholder="утром"
                      className="bg-transparent border-none text-sm w-20 outline-none"
                    />
                    <button 
                      onClick={() => setNewHabit({ ...newHabit, times: newHabit.times.filter((_, i) => i !== idx) })}
                      className="text-blue-400 hover:text-blue-600"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <button 
                onClick={() => setNewHabit({ ...newHabit, times: [...(newHabit.times || []), ''] })}
                className="text-sm text-blue-500 hover:text-blue-600 mb-3 flex items-center gap-1"
              >
                <Plus size={14} /> Добавить время
              </button>
              
              <div className="text-sm text-neutral-500 mb-2">Группа</div>
              <div className="flex flex-wrap gap-2 mb-4">
                {(data.habitGroups || []).map(g => (
                  <button key={g.id} onClick={() => setNewHabit({ ...newHabit, groupId: g.id })} className={`px-3 py-1.5 rounded-lg text-sm ${newHabit.groupId === g.id ? `${HABIT_COLORS[g.color].fill} text-white` : `${HABIT_COLORS[g.color].bg} ${HABIT_COLORS[g.color].text}`}`}>{g.name}</button>
                ))}
              </div>
              <button onClick={addHabit} className="w-full py-2 bg-blue-500 text-white rounded-lg font-medium">Добавить</button>
            </div>
          </div>
        )}

        {/* Edit Habit Modal */}
        {editingHabit && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl w-full max-w-sm p-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between mb-4">
                <h2 className="text-lg font-semibold">Редактировать привычку</h2>
                <button onClick={() => setEditingHabit(null)}><X size={20} className="text-neutral-400" /></button>
              </div>
              
              <input 
                value={editingHabit.name} 
                onChange={e => setEditingHabit({ ...editingHabit, name: e.target.value })} 
                placeholder="Название" 
                className="w-full px-3 py-2 rounded-lg border mb-3" 
              />
              
              <div className="text-sm text-neutral-500 mb-2">Курс (дней, пусто = бессрочно)</div>
              <input
                type="number"
                value={editingHabit.courseDays || ''}
                onChange={e => setEditingHabit({ ...editingHabit, courseDays: e.target.value ? parseInt(e.target.value) : null })}
                placeholder="∞"
                className="w-full px-3 py-2 rounded-lg border text-sm mb-3"
              />
              
              <div className="text-sm text-neutral-500 mb-2">Время приёма</div>
              <div className="flex flex-wrap gap-2 mb-2">
                {(editingHabit.times || []).map((time, idx) => (
                  <div key={idx} className="flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-1 rounded-lg text-sm">
                    <input
                      type="text"
                      value={time}
                      onChange={e => {
                        const newTimes = [...(editingHabit.times || [])];
                        newTimes[idx] = e.target.value;
                        setEditingHabit({ ...editingHabit, times: newTimes });
                      }}
                      placeholder="утром"
                      className="bg-transparent border-none text-sm w-20 outline-none"
                    />
                    <button 
                      onClick={() => setEditingHabit({ ...editingHabit, times: (editingHabit.times || []).filter((_, i) => i !== idx) })}
                      className="text-blue-400 hover:text-blue-600"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <button 
                onClick={() => setEditingHabit({ ...editingHabit, times: [...(editingHabit.times || []), ''] })}
                className="text-sm text-blue-500 hover:text-blue-600 mb-3 flex items-center gap-1"
              >
                <Plus size={14} /> Добавить время
              </button>
              
              <div className="text-sm text-neutral-500 mb-2">Группа</div>
              <div className="flex flex-wrap gap-2 mb-4">
                {(data.habitGroups || []).map(g => (
                  <button 
                    key={g.id} 
                    onClick={() => setEditingHabit({ ...editingHabit, groupId: g.id })} 
                    className={`px-3 py-1.5 rounded-lg text-sm ${editingHabit.groupId === g.id ? `${HABIT_COLORS[g.color].fill} text-white` : `${HABIT_COLORS[g.color].bg} ${HABIT_COLORS[g.color].text}`}`}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
              
              <button 
                onClick={() => {
                  updateHabit(editingHabit.id, { 
                    name: editingHabit.name, 
                    courseDays: editingHabit.courseDays, 
                    times: editingHabit.times,
                    groupId: editingHabit.groupId
                  });
                  setEditingHabit(null);
                }} 
                className="w-full py-2 bg-blue-500 text-white rounded-lg font-medium"
              >
                Сохранить
              </button>
            </div>
          </div>
        )}

        {/* Add Task Modal */}
        {showAddTask && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl w-full max-w-lg p-6">
              <div className="flex justify-between mb-4">
                <h2 className="text-lg font-semibold">Новое событие</h2>
                <button onClick={() => setShowAddTask(false)}><X size={20} className="text-neutral-400" /></button>
              </div>
              
              <input 
                value={newTask.title}
                onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                placeholder="Название события" 
                className="w-full px-4 py-3 bg-neutral-100 rounded-xl text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
                autoFocus
              />
              
              <textarea
                value={newTask.description || ''}
                onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                placeholder="Описание (опционально)"
                className="w-full px-4 py-3 bg-neutral-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4 h-20 resize-none text-sm"
              />
              
              <div className="mb-4">
                <label className="text-sm font-medium text-neutral-500 mb-2 block">Тип задачи</label>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setNewTask({ ...newTask, type: 'executor' })}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all ${
                      newTask.type === 'executor' ? 'bg-blue-100 text-blue-600 ring-2 ring-blue-500' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                  >
                    <User size={18} /> Исполнитель
                  </button>
                  <button 
                    onClick={() => setNewTask({ ...newTask, type: 'control' })}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all ${
                      newTask.type === 'control' ? 'bg-amber-100 text-amber-600 ring-2 ring-amber-500' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                  >
                    <Eye size={18} /> Контроль
                  </button>
                </div>
              </div>
              
              <div className="mb-4">
                <label className="text-sm font-medium text-neutral-500 mb-2 block">Проект</label>
                <select 
                  value={newTask.project || ''}
                  onChange={e => setNewTask({ ...newTask, project: e.target.value })}
                  className="w-full px-4 py-3 bg-neutral-100 rounded-xl focus:outline-none"
                >
                  <option value="">Без проекта</option>
                  {(data?.calendarProjects || []).map(p => (
                    <optgroup key={p.id} label={p.name}>
                      <option value={p.id}>{p.name}</option>
                      {(p.subprojects || []).map(sp => (
                        <option key={sp.id} value={sp.id}>↳ {sp.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-sm font-medium text-neutral-500 mb-2 block">Дата</label>
                  <input 
                    type="date" 
                    value={newTask.date}
                    onChange={e => setNewTask({ ...newTask, date: e.target.value })}
                    className="w-full px-4 py-3 bg-neutral-100 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-500 mb-2 block">Время</label>
                  <input 
                    type="time" 
                    value={newTask.time}
                    onChange={e => setNewTask({ ...newTask, time: e.target.value })}
                    className="w-full px-4 py-3 bg-neutral-100 rounded-xl focus:outline-none"
                  />
                </div>
              </div>
              
              {newTask.type === 'control' && (
                <div className="mb-4">
                  <label className="text-sm font-medium text-neutral-500 mb-2 block">Исполнитель</label>
                  <select 
                    value={newTask.assignee || ''}
                    onChange={e => setNewTask({ ...newTask, assignee: e.target.value })}
                    className="w-full px-4 py-3 bg-neutral-100 rounded-xl focus:outline-none"
                  >
                    <option value="">Выберите...</option>
                    {(data?.employees || []).map(emp => (
                      <option key={emp.id} value={emp.name}>{emp.name}</option>
                    ))}
                  </select>
                </div>
              )}
              
              <div className="mb-4">
                <label className="text-sm font-medium text-neutral-500 mb-2 block">Цвет</label>
                <div className="flex gap-2">
                  {Object.keys(TASK_COLORS).map(c => (
                    <button 
                      key={c}
                      onClick={() => setNewTask({ ...newTask, color: c })}
                      className={`w-10 h-10 rounded-full ${TASK_COLORS[c].bg} ${newTask.color === c ? 'ring-2 ring-offset-2 ring-neutral-400' : ''} hover:scale-110 transition-transform`}
                    />
                  ))}
                </div>
              </div>
              
              <div className="flex gap-3">
                <button onClick={() => setShowAddTask(false)} className="flex-1 py-3 rounded-xl font-medium text-neutral-600 hover:bg-neutral-100 transition-colors">
                  Отмена
                </button>
                <button onClick={addCalendarTask} className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-colors">
                  Создать
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Task Modal */}
        {editingTask && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between mb-4">
                <h2 className="text-lg font-semibold">Редактировать задачу</h2>
                <button onClick={() => setEditingTask(null)}><X size={20} className="text-neutral-400" /></button>
              </div>
              
              <input 
                value={editingTask.title}
                onChange={e => setEditingTask({ ...editingTask, title: e.target.value })}
                placeholder="Название события" 
                className="w-full px-4 py-3 bg-neutral-100 rounded-xl text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
              />
              
              <textarea
                value={editingTask.description || ''}
                onChange={e => setEditingTask({ ...editingTask, description: e.target.value })}
                placeholder="Описание (опционально)"
                className="w-full px-4 py-3 bg-neutral-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4 h-20 resize-none text-sm"
              />
              
              <div className="mb-4">
                <label className="text-sm font-medium text-neutral-500 mb-2 block">Тип задачи</label>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setEditingTask({ ...editingTask, type: 'executor' })}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all ${
                      editingTask.type === 'executor' ? 'bg-blue-100 text-blue-600 ring-2 ring-blue-500' : 'bg-neutral-100 text-neutral-600'
                    }`}
                  >
                    <User size={18} /> Исполнитель
                  </button>
                  <button 
                    onClick={() => setEditingTask({ ...editingTask, type: 'control' })}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all ${
                      editingTask.type === 'control' ? 'bg-amber-100 text-amber-600 ring-2 ring-amber-500' : 'bg-neutral-100 text-neutral-600'
                    }`}
                  >
                    <Eye size={18} /> Контроль
                  </button>
                </div>
              </div>
              
              <div className="mb-4">
                <label className="text-sm font-medium text-neutral-500 mb-2 block">Проект</label>
                <select 
                  value={editingTask.project || ''}
                  onChange={e => setEditingTask({ ...editingTask, project: e.target.value })}
                  className="w-full px-4 py-3 bg-neutral-100 rounded-xl focus:outline-none"
                >
                  <option value="">Без проекта</option>
                  {(data?.calendarProjects || []).map(p => (
                    <optgroup key={p.id} label={p.name}>
                      <option value={p.id}>{p.name}</option>
                      {(p.subprojects || []).map(sp => (
                        <option key={sp.id} value={sp.id}>↳ {sp.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-sm font-medium text-neutral-500 mb-2 block">Дата</label>
                  <input 
                    type="date" 
                    value={editingTask.date}
                    onChange={e => setEditingTask({ ...editingTask, date: e.target.value })}
                    className="w-full px-4 py-3 bg-neutral-100 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-500 mb-2 block">Время</label>
                  <input 
                    type="time" 
                    value={editingTask.time}
                    onChange={e => setEditingTask({ ...editingTask, time: e.target.value })}
                    className="w-full px-4 py-3 bg-neutral-100 rounded-xl focus:outline-none"
                  />
                </div>
              </div>
              
              {editingTask.type === 'control' && (
                <div className="mb-4">
                  <label className="text-sm font-medium text-neutral-500 mb-2 block">Исполнитель</label>
                  <select 
                    value={editingTask.assignee || ''}
                    onChange={e => setEditingTask({ ...editingTask, assignee: e.target.value })}
                    className="w-full px-4 py-3 bg-neutral-100 rounded-xl focus:outline-none"
                  >
                    <option value="">Выберите...</option>
                    {(data?.employees || []).map(emp => (
                      <option key={emp.id} value={emp.name}>{emp.name}</option>
                    ))}
                  </select>
                </div>
              )}
              
              <div className="mb-4">
                <label className="text-sm font-medium text-neutral-500 mb-2 block">Цвет</label>
                <div className="flex gap-2">
                  {Object.keys(TASK_COLORS).map(c => (
                    <button 
                      key={c}
                      onClick={() => setEditingTask({ ...editingTask, color: c })}
                      className={`w-10 h-10 rounded-full ${TASK_COLORS[c].bg} ${editingTask.color === c ? 'ring-2 ring-offset-2 ring-neutral-400' : ''} hover:scale-110 transition-transform`}
                    />
                  ))}
                </div>
              </div>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => { removeCalendarTask(editingTask.id); setEditingTask(null); }} 
                  className="py-3 px-4 rounded-xl font-medium text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
                <button onClick={() => setEditingTask(null)} className="flex-1 py-3 rounded-xl font-medium text-neutral-600 hover:bg-neutral-100 transition-colors">
                  Отмена
                </button>
                <button 
                  onClick={() => { updateCalendarTask(editingTask.id, editingTask); setEditingTask(null); }} 
                  className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-colors"
                >
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Project Modal */}
        {showAddProject && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl w-full max-w-sm p-4">
              <div className="flex justify-between mb-4">
                <h2 className="text-lg font-semibold">{newProject.parentId ? 'Новый подпроект' : 'Новый проект'}</h2>
                <button onClick={() => setShowAddProject(false)}><X size={20} className="text-neutral-400" /></button>
              </div>
              <input 
                value={newProject.name} 
                onChange={e => setNewProject({ ...newProject, name: e.target.value })} 
                placeholder="Название" 
                className="w-full px-3 py-2 rounded-lg border mb-3" 
                autoFocus 
              />
              <div className="text-sm text-neutral-500 mb-2">Цвет</div>
              <div className="flex gap-2 mb-4">
                {Object.keys(TASK_COLORS).map(c => (
                  <button 
                    key={c} 
                    onClick={() => setNewProject({ ...newProject, color: c })} 
                    className={`w-8 h-8 rounded-full ${TASK_COLORS[c].bg} ${newProject.color === c ? 'ring-2 ring-offset-2 ring-neutral-400' : ''}`} 
                  />
                ))}
              </div>
              <button onClick={addCalendarProject} className="w-full py-2 bg-blue-500 text-white rounded-lg font-medium">Добавить</button>
            </div>
          </div>
        )}

        {/* Add Group Modal */}
        {showAddHabitGroup && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl w-full max-w-sm p-4">
              <div className="flex justify-between mb-4"><h2 className="text-lg font-semibold">Новая группа</h2><button onClick={() => setShowAddHabitGroup(false)}><X size={20} className="text-neutral-400" /></button></div>
              <input value={newHabitGroup.name} onChange={e => setNewHabitGroup({ ...newHabitGroup, name: e.target.value })} placeholder="Название" className="w-full px-3 py-2 rounded-lg border mb-3" autoFocus />
              <div className="text-sm text-neutral-500 mb-2">Цвет</div>
              <div className="flex gap-2 mb-4">
                {Object.keys(HABIT_COLORS).map(c => (
                  <button key={c} onClick={() => setNewHabitGroup({ ...newHabitGroup, color: c })} className={`w-8 h-8 rounded-full ${HABIT_COLORS[c].fill} ${newHabitGroup.color === c ? 'ring-2 ring-offset-2 ring-neutral-400' : ''}`} />
                ))}
              </div>
              <button onClick={addHabitGroup} className="w-full py-2 bg-blue-500 text-white rounded-lg font-medium">Добавить</button>
            </div>
          </div>
        )}
      </main>
      </div>
    </div>
  );
}
